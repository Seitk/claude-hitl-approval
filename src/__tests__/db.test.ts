// src/__tests__/db.test.ts
import { describe, it, expect, beforeEach } from 'bun:test';
import { Database } from 'bun:sqlite';
import { initDb, insertRequest, getRequest, getRequestStatus, resolveRequest, updateDescription, listRequests } from '../local-server/db';

function makeTestDb(): Database {
  return initDb(':memory:');
}

describe('db', () => {
  let db: Database;

  beforeEach(() => {
    db = makeTestDb();
  });

  it('inserts and retrieves a request', () => {
    insertRequest(db, {
      id: 'test-id-1',
      tool: 'Bash',
      command: 'rm -rf ./dist',
      workdir: '/project',
      sessionId: 'sess-1',
      userId: 'user',
      requestedAt: 1000,
    });
    const req = getRequest(db, 'test-id-1');
    expect(req).not.toBeNull();
    expect(req!.tool).toBe('Bash');
    expect(req!.command).toBe('rm -rf ./dist');
    expect(req!.status).toBe('pending');
    expect(req!.resolvedAt).toBeNull();
  });

  it('returns null for unknown id', () => {
    expect(getRequest(db, 'nope')).toBeNull();
  });

  it('getRequestStatus returns pending initially', () => {
    insertRequest(db, { id: 'test-id-2', tool: 'Bash', command: 'ls', workdir: '/', sessionId: null, userId: 'user', requestedAt: 1000 });
    expect(getRequestStatus(db, 'test-id-2')).toBe('pending');
  });

  it('resolves a pending request to approved', () => {
    insertRequest(db, { id: 'test-id-3', tool: 'Bash', command: 'ls', workdir: '/', sessionId: null, userId: 'user', requestedAt: 1000 });
    const changed = resolveRequest(db, 'test-id-3', 'approved', 'web-ui');
    expect(changed).toBe(true);
    expect(getRequestStatus(db, 'test-id-3')).toBe('approved');
  });

  it('cannot resolve an already-resolved request', () => {
    insertRequest(db, { id: 'test-id-4', tool: 'Bash', command: 'ls', workdir: '/', sessionId: null, userId: 'user', requestedAt: 1000 });
    resolveRequest(db, 'test-id-4', 'approved', 'web-ui');
    const changed = resolveRequest(db, 'test-id-4', 'denied', 'web-ui');
    expect(changed).toBe(false);
    expect(getRequestStatus(db, 'test-id-4')).toBe('approved');
  });

  it('inserts request with null description by default', () => {
    insertRequest(db, { id: 'desc-1', tool: 'Bash', command: 'ls', workdir: '/', sessionId: null, userId: 'user', requestedAt: 1000 });
    const req = getRequest(db, 'desc-1');
    expect(req!.description).toBeNull();
  });

  it('updates description on an existing request', () => {
    insertRequest(db, { id: 'desc-2', tool: 'Bash', command: 'rm -rf dist', workdir: '/', sessionId: null, userId: 'user', requestedAt: 1000 });
    updateDescription(db, 'desc-2', 'Recursively deletes the dist directory.');
    const req = getRequest(db, 'desc-2');
    expect(req!.description).toBe('Recursively deletes the dist directory.');
  });

  it('listRequests returns requests in descending order', () => {
    insertRequest(db, { id: 'a', tool: 'Bash', command: 'ls', workdir: '/', sessionId: null, userId: 'user', requestedAt: 1000 });
    insertRequest(db, { id: 'b', tool: 'Bash', command: 'pwd', workdir: '/', sessionId: null, userId: 'user', requestedAt: 2000 });
    const list = listRequests(db);
    expect(list[0].id).toBe('b');
    expect(list[1].id).toBe('a');
  });
});
