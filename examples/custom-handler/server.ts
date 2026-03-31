#!/usr/bin/env bun
// examples/custom-handler/server.ts
//
// A complete custom approval server that replaces `claude-hitl local`.
// You own everything: the UI, the storage, the approval flow.
//
// The HITL hook doesn't care what server it talks to — it just needs
// these endpoints to work:
//   POST /requests           → create a request, return { requestId }
//   GET  /requests/:id/status → return { status }
//
// Everything else (the approval page, how you store data, who can approve)
// is up to you.
//
// Usage:
//   bun examples/custom-handler/server.ts
//
// Then configure .hitl.json to point at this server:
//   { "approval": { "url": "http://localhost:4000" } }

import express from 'express';

// ── Types ────────────────────────────────────────────────────────────────────

interface ApprovalRequest {
  id: string;
  tool: string;
  command: string;
  workdir: string;
  sessionId: string | null;
  status: 'pending' | 'approved' | 'denied';
  createdAt: number;
}

// ── In-memory store (swap with your own database) ────────────────────────────

const store = new Map<string, ApprovalRequest>();

// ── Server ───────────────────────────────────────────────────────────────────

const app = express();
app.use(express.json());

// ── Hook endpoints (required — the hook calls these) ─────────────────────────

// The hook POSTs here when a command matches a rule.
app.post('/requests', (req, res) => {
  const { tool, command, workdir, sessionId } = req.body as {
    tool: string;
    command: string;
    workdir: string;
    sessionId?: string;
  };

  const id = crypto.randomUUID();
  store.set(id, {
    id,
    tool,
    command,
    workdir,
    sessionId: sessionId ?? null,
    status: 'pending',
    createdAt: Date.now(),
  });

  console.log(`[NEW] ${id.slice(0, 8)}  ${tool}: ${command}`);
  res.status(201).json({ requestId: id });
});

// The hook polls this until status is no longer "pending".
app.get('/requests/:id/status', (req, res) => {
  const record = store.get(req.params['id']!);
  if (!record) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  res.json({ status: record.status });
});

// ── Your custom approval page ────────────────────────────────────────────────

// Serve a simple approval page — replace with your own UI.
app.get('/requests/:id', (req, res) => {
  const record = store.get(req.params['id']!);
  if (!record) {
    res.status(404).send('Not found');
    return;
  }

  // Simple inline HTML — in production you'd serve a proper frontend
  res.send(`<!DOCTYPE html>
<html>
<head>
  <title>Approve: ${record.command}</title>
  <style>
    body { font-family: system-ui; max-width: 600px; margin: 4rem auto; padding: 0 1rem; }
    pre { background: #f5f5f5; padding: 1rem; border-radius: 6px; overflow-x: auto; }
    .actions { display: flex; gap: 1rem; margin-top: 2rem; }
    button { padding: 0.75rem 2rem; border: none; border-radius: 6px; font-size: 1rem; cursor: pointer; }
    .approve { background: #22c55e; color: white; }
    .deny { background: #ef4444; color: white; }
    .status { margin-top: 2rem; padding: 1rem; border-radius: 6px; font-weight: bold; }
    .status-approved { background: #dcfce7; color: #166534; }
    .status-denied { background: #fee2e2; color: #991b1b; }
  </style>
</head>
<body>
  <h1>Approval Request</h1>
  <p><strong>Tool:</strong> ${record.tool}</p>
  <p><strong>Command:</strong></p>
  <pre>${record.command}</pre>
  <p><strong>Working directory:</strong> ${record.workdir}</p>

  ${record.status === 'pending' ? `
  <div class="actions">
    <form method="POST" action="/requests/${record.id}/approve">
      <button class="approve" type="submit">Approve</button>
    </form>
    <form method="POST" action="/requests/${record.id}/deny">
      <button class="deny" type="submit">Deny</button>
    </form>
  </div>
  ` : `
  <div class="status status-${record.status}">
    ${record.status.toUpperCase()}
  </div>
  `}
</body>
</html>`);
});

// Handle approve/deny form submissions
app.post('/requests/:id/approve', (req, res) => {
  const record = store.get(req.params['id']!);
  if (!record || record.status !== 'pending') {
    res.redirect(`/requests/${req.params['id']}`);
    return;
  }
  record.status = 'approved';
  console.log(`[APPROVED] ${record.id.slice(0, 8)}`);
  res.redirect(`/requests/${req.params['id']}`);
});

app.post('/requests/:id/deny', (req, res) => {
  const record = store.get(req.params['id']!);
  if (!record || record.status !== 'pending') {
    res.redirect(`/requests/${req.params['id']}`);
    return;
  }
  record.status = 'denied';
  console.log(`[DENIED] ${record.id.slice(0, 8)}`);
  res.redirect(`/requests/${req.params['id']}`);
});

// Simple dashboard
app.get('/', (_req, res) => {
  const requests = [...store.values()].sort((a, b) => b.createdAt - a.createdAt);
  const rows = requests.map(r =>
    `<tr>
      <td><a href="/requests/${r.id}">${r.id.slice(0, 8)}</a></td>
      <td>${r.tool}</td>
      <td><code>${r.command}</code></td>
      <td>${r.status}</td>
    </tr>`
  ).join('');

  res.send(`<!DOCTYPE html>
<html>
<head>
  <title>Custom Approval Server</title>
  <style>
    body { font-family: system-ui; max-width: 800px; margin: 2rem auto; padding: 0 1rem; }
    table { width: 100%; border-collapse: collapse; }
    th, td { text-align: left; padding: 0.5rem; border-bottom: 1px solid #eee; }
    code { background: #f5f5f5; padding: 0.2rem 0.4rem; border-radius: 3px; }
  </style>
</head>
<body>
  <h1>Custom Approval Server</h1>
  ${requests.length === 0
    ? '<p>No requests yet. Waiting for Claude to trigger a matched command...</p>'
    : `<table>
        <thead><tr><th>ID</th><th>Tool</th><th>Command</th><th>Status</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>`
  }
</body>
</html>`);
});

// ── Start ────────────────────────────────────────────────────────────────────

const PORT = 4000;

app.listen(PORT, '127.0.0.1', () => {
  console.log(`Custom approval server at http://localhost:${PORT}`);
  console.log('Point your .hitl.json at this URL:');
  console.log(`  { "approval": { "url": "http://localhost:${PORT}" } }`);
});
