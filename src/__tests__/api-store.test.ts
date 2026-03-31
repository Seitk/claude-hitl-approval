// src/__tests__/api-store.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import express from 'express';
import type { Server } from 'http';
import { ApiStore } from '../local-server/api-store';
import type { ApprovalRequest, InsertPayload } from '../shared/types';

/**
 * Spins up a minimal Express server that mimics the remote API contract,
 * backed by an in-memory Map, so we can integration-test ApiStore.
 */
function createFakeApi() {
  const app = express();
  app.use(express.json());
  const db = new Map<string, ApprovalRequest>();

  app.post('/requests', (req, res) => {
    const body = req.body as InsertPayload;
    db.set(body.id, {
      ...body,
      description: null,
      status: 'pending',
      resolvedAt: null,
      resolvedBy: null,
    });
    res.status(201).json({ ok: true });
  });

  app.get('/requests/:id', (req, res) => {
    const record = db.get(req.params['id']!);
    if (!record) { res.status(404).json({ error: 'Not found' }); return; }
    res.json(record);
  });

  app.get('/requests/:id/status', (req, res) => {
    const record = db.get(req.params['id']!);
    if (!record) { res.status(404).json({ error: 'Not found' }); return; }
    res.json({ status: record.status });
  });

  app.post('/requests/:id/resolve', (req, res) => {
    const record = db.get(req.params['id']!);
    if (!record || record.status !== 'pending') {
      res.json({ updated: false });
      return;
    }
    const { status, resolvedBy } = req.body as { status: string; resolvedBy: string };
    record.status = status as ApprovalRequest['status'];
    record.resolvedAt = Date.now();
    record.resolvedBy = resolvedBy;
    res.json({ updated: true });
  });

  app.post('/requests/:id/description', (req, res) => {
    const record = db.get(req.params['id']!);
    if (!record) { res.status(404).json({ error: 'Not found' }); return; }
    record.description = (req.body as { description: string }).description;
    res.json({ ok: true });
  });

  app.get('/requests', (req, res) => {
    const limit = parseInt((req.query['limit'] as string) ?? '50', 10);
    const all = [...db.values()]
      .sort((a, b) => b.requestedAt - a.requestedAt)
      .slice(0, limit);
    res.json(all);
  });

  return app;
}

describe('ApiStore', () => {
  let server: Server;
  let store: ApiStore;
  let port: number;

  beforeEach(async () => {
    const app = createFakeApi();
    await new Promise<void>((resolve) => {
      server = app.listen(0, '127.0.0.1', () => resolve());
    });
    const addr = server.address();
    port = typeof addr === 'object' && addr ? addr.port : 0;
    store = new ApiStore(`http://127.0.0.1:${port}`);
  });

  afterEach(() => {
    server.close();
  });

  it('inserts and retrieves a request', async () => {
    await store.insertRequest({
      id: 'api-1',
      tool: 'Bash',
      command: 'ls',
      workdir: '/',
      sessionId: null,
      userId: 'user',
      requestedAt: 1000,
    });

    const req = await store.getRequest('api-1');
    expect(req).not.toBeNull();
    expect(req!.tool).toBe('Bash');
    expect(req!.status).toBe('pending');
  });

  it('returns null for unknown id', async () => {
    expect(await store.getRequest('nope')).toBeNull();
  });

  it('getRequestStatus returns pending initially', async () => {
    await store.insertRequest({
      id: 'api-2',
      tool: 'Bash',
      command: 'pwd',
      workdir: '/',
      sessionId: null,
      userId: 'user',
      requestedAt: 2000,
    });
    expect(await store.getRequestStatus('api-2')).toBe('pending');
  });

  it('resolves a pending request', async () => {
    await store.insertRequest({
      id: 'api-3',
      tool: 'Bash',
      command: 'rm -rf',
      workdir: '/',
      sessionId: null,
      userId: 'user',
      requestedAt: 3000,
    });
    const updated = await store.resolveRequest('api-3', 'approved', 'web-ui');
    expect(updated).toBe(true);
    expect(await store.getRequestStatus('api-3')).toBe('approved');
  });

  it('cannot resolve an already-resolved request', async () => {
    await store.insertRequest({
      id: 'api-4',
      tool: 'Bash',
      command: 'ls',
      workdir: '/',
      sessionId: null,
      userId: 'user',
      requestedAt: 4000,
    });
    await store.resolveRequest('api-4', 'approved', 'web-ui');
    const updated = await store.resolveRequest('api-4', 'denied', 'web-ui');
    expect(updated).toBe(false);
  });

  it('lists requests', async () => {
    await store.insertRequest({ id: 'a', tool: 'Bash', command: 'ls', workdir: '/', sessionId: null, userId: 'user', requestedAt: 1000 });
    await store.insertRequest({ id: 'b', tool: 'Bash', command: 'pwd', workdir: '/', sessionId: null, userId: 'user', requestedAt: 2000 });
    const list = await store.listRequests();
    expect(list).toHaveLength(2);
    expect(list[0].id).toBe('b'); // most recent first
  });

  it('updates description on an existing request', async () => {
    await store.insertRequest({ id: 'api-desc', tool: 'Bash', command: 'rm -rf dist', workdir: '/', sessionId: null, userId: 'user', requestedAt: 6000 });
    await store.updateDescription('api-desc', 'Deletes the dist directory.');
    const req = await store.getRequest('api-desc');
    expect(req!.description).toBe('Deletes the dist directory.');
  });

  it('sends custom headers', async () => {
    // Just verify construction doesn't throw; the fake server doesn't check headers
    const customStore = new ApiStore(`http://127.0.0.1:${port}`, {
      Authorization: 'Bearer test-token',
    });
    await customStore.insertRequest({
      id: 'hdr-1',
      tool: 'Bash',
      command: 'echo hi',
      workdir: '/',
      sessionId: null,
      userId: 'user',
      requestedAt: 5000,
    });
    const req = await customStore.getRequest('hdr-1');
    expect(req).not.toBeNull();
  });
});
