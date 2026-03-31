// src/local-server/db.ts
import { Database } from 'bun:sqlite';
import { mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';
import type { ApprovalRequest, InsertPayload, DataStore } from '../shared/types';

export function getDbPath(): string {
  return (
    process.env.HITL_APPROVAL_SERVER_DB_PATH ??
    join(homedir(), '.hitl', 'hitl.db')
  );
}

export function initDb(path: string = getDbPath()): Database {
  if (path !== ':memory:') {
    mkdirSync(dirname(path), { recursive: true });
  }
  const db = new Database(path);
  db.run(`CREATE TABLE IF NOT EXISTS requests (
    id            TEXT PRIMARY KEY,
    tool          TEXT NOT NULL,
    command       TEXT NOT NULL,
    description   TEXT,
    workdir       TEXT NOT NULL,
    session_id    TEXT,
    user_id       TEXT NOT NULL DEFAULT 'user',
    status        TEXT NOT NULL DEFAULT 'pending',
    requested_at  INTEGER NOT NULL,
    resolved_at   INTEGER,
    resolved_by   TEXT
  )`);
  // Migrate existing tables that don't have the description column
  try {
    db.run(`ALTER TABLE requests ADD COLUMN description TEXT`);
  } catch {
    // Column already exists — ignore
  }
  return db;
}

export function insertRequest(db: Database, req: InsertPayload): void {
  db.run(
    `INSERT INTO requests (id, tool, command, description, workdir, session_id, user_id, requested_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [req.id, req.tool, req.command, req.description, req.workdir, req.sessionId, req.userId, req.requestedAt],
  );
}

export function getRequest(db: Database, id: string): ApprovalRequest | null {
  const row = db.query('SELECT * FROM requests WHERE id = ?').get(id) as Record<string, unknown> | null;
  return row ? rowToRequest(row) : null;
}

export function getRequestStatus(
  db: Database,
  id: string,
): ApprovalRequest['status'] | null {
  const row = db
    .query('SELECT status FROM requests WHERE id = ?')
    .get(id) as { status: string } | null;
  return (row?.status as ApprovalRequest['status']) ?? null;
}

export function updateDescription(db: Database, id: string, description: string): void {
  db.run(`UPDATE requests SET description = ? WHERE id = ?`, [description, id]);
}

export function resolveRequest(
  db: Database,
  id: string,
  status: 'approved' | 'denied',
  resolvedBy: string,
): boolean {
  const result = db.run(
    `UPDATE requests SET status = ?, resolved_at = ?, resolved_by = ?
     WHERE id = ? AND status = 'pending'`,
    [status, Date.now(), resolvedBy, id],
  );
  return result.changes > 0;
}

export function listRequests(db: Database, limit = 50): ApprovalRequest[] {
  const rows = db
    .query('SELECT * FROM requests ORDER BY requested_at DESC LIMIT ?')
    .all(limit) as Record<string, unknown>[];
  return rows.map(rowToRequest);
}

export class SqliteStore implements DataStore {
  constructor(private db: Database) {}

  async insertRequest(req: InsertPayload): Promise<void> {
    insertRequest(this.db, req);
  }

  async getRequest(id: string): Promise<ApprovalRequest | null> {
    return getRequest(this.db, id);
  }

  async getRequestStatus(id: string): Promise<ApprovalRequest['status'] | null> {
    return getRequestStatus(this.db, id);
  }

  async resolveRequest(id: string, status: 'approved' | 'denied', resolvedBy: string): Promise<boolean> {
    return resolveRequest(this.db, id, status, resolvedBy);
  }

  async updateDescription(id: string, description: string): Promise<void> {
    updateDescription(this.db, id, description);
  }

  async listRequests(limit = 50): Promise<ApprovalRequest[]> {
    return listRequests(this.db, limit);
  }
}

function rowToRequest(row: Record<string, unknown>): ApprovalRequest {
  return {
    id: row['id'] as string,
    tool: row['tool'] as string,
    command: row['command'] as string,
    description: (row['description'] as string | null) ?? null,
    workdir: row['workdir'] as string,
    sessionId: row['session_id'] as string | null,
    userId: row['user_id'] as string,
    status: row['status'] as ApprovalRequest['status'],
    requestedAt: row['requested_at'] as number,
    resolvedAt: row['resolved_at'] as number | null,
    resolvedBy: row['resolved_by'] as string | null,
  };
}
