#!/usr/bin/env bun
// examples/custom-api/api-server.ts
//
// A sample API server that implements the DataStore contract.
// The HITL local server delegates all data operations here
// when configured with dataSource.type = "api".
//
// This gives you full control over storage (use Postgres, Redis,
// a shared team database, etc.) while reusing the HITL web UI.
//
// Usage:
//   bun examples/custom-api/api-server.ts
//
// Then start the HITL local server (it reads .hitl.json in this directory):
//   cd examples/custom-api && claude-hitl local

import express from 'express';

// ── Types ────────────────────────────────────────────────────────────────────

interface ApprovalRequest {
  id: string;
  tool: string;
  command: string;
  workdir: string;
  sessionId: string | null;
  userId: string;
  description: string | null;
  status: 'pending' | 'approved' | 'denied';
  requestedAt: number;
  resolvedAt: number | null;
  resolvedBy: string | null;
}

// ── In-memory store (replace with your database) ─────────────────────────────

const store = new Map<string, ApprovalRequest>();

// ── Server ───────────────────────────────────────────────────────────────────

const app = express();
app.use(express.json());

// Create a new approval request
// Must reject duplicate IDs with 409 — never upsert.
app.post('/requests', (req, res) => {
  const body = req.body as Omit<ApprovalRequest, 'status' | 'resolvedAt' | 'resolvedBy'>;

  if (store.has(body.id)) {
    res.status(409).json({ error: 'Request already exists' });
    return;
  }

  const record: ApprovalRequest = {
    ...body,
    description: null,
    status: 'pending',
    resolvedAt: null,
    resolvedBy: null,
  };

  store.set(body.id, record);
  console.log(`[CREATE] ${record.id.slice(0, 8)}  ${record.tool}: ${record.command}`);
  res.status(201).json({ ok: true });
});

// Get full request by ID
app.get('/requests/:id', (req, res) => {
  const record = store.get(req.params['id']!);
  if (!record) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  res.json(record);
});

// Get status only (used by hook polling)
app.get('/requests/:id/status', (req, res) => {
  const record = store.get(req.params['id']!);
  if (!record) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  res.json({ status: record.status });
});

// Resolve a request (approve or deny)
// Must only resolve requests that are still 'pending'.
app.post('/requests/:id/resolve', (req, res) => {
  const record = store.get(req.params['id']!);
  if (!record || record.status !== 'pending') {
    res.json({ updated: false });
    return;
  }

  const { status, resolvedBy } = req.body as { status: string; resolvedBy: string };
  record.status = status as ApprovalRequest['status'];
  record.resolvedAt = Date.now();
  record.resolvedBy = resolvedBy;

  console.log(`[${status.toUpperCase()}] ${record.id.slice(0, 8)}  by ${resolvedBy}`);
  res.json({ updated: true });
});

// Update AI-generated description (called async by the local server)
app.post('/requests/:id/description', (req, res) => {
  const record = store.get(req.params['id']!);
  if (!record) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  record.description = (req.body as { description: string }).description;
  console.log(`[DESC]   ${record.id.slice(0, 8)}  ${record.description.slice(0, 60)}`);
  res.json({ ok: true });
});

// List requests (newest first)
app.get('/requests', (req, res) => {
  const limit = parseInt((req.query['limit'] as string) ?? '50', 10);
  const all = [...store.values()]
    .sort((a, b) => b.requestedAt - a.requestedAt)
    .slice(0, limit);
  res.json(all);
});

// ── Start ────────────────────────────────────────────────────────────────────

const PORT = 4000;

app.listen(PORT, '127.0.0.1', () => {
  console.log(`Custom API server running at http://localhost:${PORT}`);
  console.log('Waiting for requests from HITL local server...');
});
