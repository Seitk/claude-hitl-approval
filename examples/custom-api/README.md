# Custom API Example

Use the provided HITL local server (web UI, JWT auth, AI descriptions) but swap out SQLite for your own API as the data backend.

## Architecture

```
Claude Code ──> HITL Hook ──> Local Server (UI + auth) ──> Your API (storage)
                                   :9457                    your-api.com
```

The local server still handles the web UI, JWT auth, and AI-generated descriptions. Your API just handles storage — creating, reading, resolving, and listing approval requests.

## Setup

Add `dataSource` to your `.hitl.json`:

```json
{
  "approval": { "url": "http://localhost:9457" },
  "rules": [
    { "tool": "Bash", "pattern": "rm *" }
  ],
  "dataSource": {
    "type": "api",
    "url": "https://your-api.example.com",
    "headers": {
      "Authorization": "Bearer your-token"
    }
  }
}
```

Then start the local server as usual:

```bash
claude-hitl local
```

## API Contract

Your API must implement these endpoints:

| Method | Endpoint | Request Body | Response |
|--------|----------|-------------|----------|
| `POST` | `/requests` | `InsertPayload` JSON | `201` (reject duplicate `id` with `409`) |
| `GET` | `/requests/:id` | - | `ApprovalRequest` JSON or `404` |
| `GET` | `/requests/:id/status` | - | `{ "status": "pending\|approved\|denied" }` or `404` |
| `POST` | `/requests/:id/resolve` | `{ "status", "resolvedBy" }` | `{ "updated": true\|false }` |
| `POST` | `/requests/:id/description` | `{ "description" }` | `200` |
| `GET` | `/requests?limit=N` | - | `ApprovalRequest[]` JSON |

See `api-server.ts` for a working reference implementation, and the project README for full request/response shapes.
