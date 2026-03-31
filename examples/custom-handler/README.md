# Custom Handler Example

Build your own approval server from scratch, replacing `claude-hitl local` entirely. You own the UI, storage, and approval flow.

## Architecture

```
Claude Code ──> HITL Hook ──> Your Server (everything is yours)
                                  :4000
```

The hook doesn't care what server it talks to. It only needs two endpoints:

| Endpoint | Purpose |
|----------|---------|
| `POST /requests` | Hook sends `{ tool, command, workdir, sessionId }`, expects `{ requestId }` back |
| `GET /requests/:id/status` | Hook polls this, expects `{ status: "pending" \| "approved" \| "denied" }` |

Everything else — the approval page, the dashboard, the database, auth, notifications — is up to you.

## Try It

```bash
# Terminal 1: start your custom server
bun examples/custom-handler/server.ts

# Terminal 2: start Claude Code from this directory
cd examples/custom-handler
claude

# Ask Claude to run: rm -rf dist
# The hook sends the request to your server at :4000
# Your approval page opens in the browser
```

## What This Example Includes

- `server.ts` — a minimal Express server with:
  - In-memory request storage (swap with your database)
  - A simple HTML approval page with Approve/Deny buttons
  - A basic dashboard listing all requests
- `.hitl.json` — config pointing `approval.url` to `http://localhost:4000`

## Customization Ideas

- **Slack/Discord notifications** — send a message when a new request comes in
- **Team-based approval** — require approval from a specific team member
- **Auto-approve policies** — approve safe commands automatically, require approval for dangerous ones
- **Audit logging** — log all decisions to a database for compliance
- **Custom UI** — build a React/Vue/Svelte frontend instead of inline HTML
