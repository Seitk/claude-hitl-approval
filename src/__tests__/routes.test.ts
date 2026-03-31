// src/__tests__/routes.test.ts
import { describe, it, expect, beforeEach } from 'bun:test';
import request from 'supertest';
import { initDb, SqliteStore } from '../local-server/db';
import { createAuthService } from '../local-server/auth';
import { createApp } from '../local-server/server';
import type { DataStore } from '../shared/types';

describe('API routes', () => {
  let store: DataStore;
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    const db = initDb(':memory:');
    store = new SqliteStore(db);
    const auth = createAuthService();
    app = createApp(store, auth);
  });

  describe('POST /requests', () => {
    it('creates a request and returns requestId', async () => {
      const res = await request(app)
        .post('/requests')
        .send({ tool: 'Bash', command: 'rm -rf dist', workdir: '/project' });
      expect(res.status).toBe(201);
      expect(res.body.requestId).toBeDefined();
      expect(typeof res.body.requestId).toBe('string');
    });

    it('returns 400 when required fields are missing', async () => {
      const res = await request(app).post('/requests').send({ tool: 'Bash' });
      expect(res.status).toBe(400);
    });
  });

  describe('GET /requests/:id/status', () => {
    it('returns pending for a new request', async () => {
      const create = await request(app)
        .post('/requests')
        .send({ tool: 'Bash', command: 'ls', workdir: '/' });
      const { requestId } = create.body;

      const res = await request(app).get(`/requests/${requestId}/status`);
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('pending');
    });

    it('returns 404 for unknown id', async () => {
      const res = await request(app).get('/requests/nope/status');
      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/requests/:id', () => {
    it('returns full request detail as JSON', async () => {
      const create = await request(app)
        .post('/requests')
        .send({ tool: 'Bash', command: 'ls', workdir: '/home', sessionId: 'sess-1' });
      const { requestId } = create.body;

      const res = await request(app).get(`/api/requests/${requestId}`);
      expect(res.status).toBe(200);
      expect(res.body.tool).toBe('Bash');
      expect(res.body.command).toBe('ls');
      expect(res.body.workdir).toBe('/home');
    });
  });

  describe('GET /api/requests', () => {
    it('returns a list of requests', async () => {
      await request(app).post('/requests').send({ tool: 'Bash', command: 'ls', workdir: '/' });
      await request(app).post('/requests').send({ tool: 'Bash', command: 'pwd', workdir: '/' });

      const res = await request(app).get('/api/requests');
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
    });
  });

  describe('Approve/Deny with JWT', () => {
    it('denies approve without token', async () => {
      const create = await request(app)
        .post('/requests')
        .send({ tool: 'Bash', command: 'ls', workdir: '/' });
      const { requestId } = create.body;

      const res = await request(app).post(`/requests/${requestId}/approve`);
      expect(res.status).toBe(401);
    });

    it('approves with valid token from page load', async () => {
      const create = await request(app)
        .post('/requests')
        .send({ tool: 'Bash', command: 'ls', workdir: '/' });
      const { requestId } = create.body;

      // Load the detail page to generate a JWT
      const pageRes = await request(app).get(`/requests/${requestId}`);
      expect(pageRes.status).toBe(200);

      // Extract token from HTML
      const match = pageRes.text.match(/window\.__HITL_ACTION_TOKEN__\s*=\s*"([^"]+)"/);
      expect(match).not.toBeNull();
      const token = match![1];

      const approveRes = await request(app)
        .post(`/requests/${requestId}/approve`)
        .set('X-HITL-Web-Token', token);
      expect(approveRes.status).toBe(200);
      expect(approveRes.body.status).toBe('approved');

      // Status should now be approved
      const statusRes = await request(app).get(`/requests/${requestId}/status`);
      expect(statusRes.body.status).toBe('approved');
    });

    it('rejects token reuse', async () => {
      const create = await request(app)
        .post('/requests')
        .send({ tool: 'Bash', command: 'ls', workdir: '/' });
      const { requestId } = create.body;

      const pageRes = await request(app).get(`/requests/${requestId}`);
      const match = pageRes.text.match(/window\.__HITL_ACTION_TOKEN__\s*=\s*"([^"]+)"/);
      const token = match![1];

      await request(app)
        .post(`/requests/${requestId}/approve`)
        .set('X-HITL-Web-Token', token);

      // Reuse same token on deny — should fail
      const res = await request(app)
        .post(`/requests/${requestId}/deny`)
        .set('X-HITL-Web-Token', token);
      // Token is single-use (401) or request already resolved (409)
      expect([401, 409]).toContain(res.status);
    });
  });
});
