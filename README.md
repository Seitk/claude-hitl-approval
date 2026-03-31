# Claude Human-in-the-Loop Approval

An approval gate for [Claude Code](https://docs.anthropic.com/en/docs/claude-code) that intercepts dangerous commands before they run and requires human approval via a web UI.

When Claude tries to execute a command matching your rules (e.g. `rm *`, `git push`), the hook first asks Claude to explain what it's doing and why. Claude re-submits the command with context, then the hook opens a browser page and waits for you to approve or deny.

Flow: Claude runs command -> hook intercepts -> browser opens -> you approve/deny -> Claude continues or stops

## Quick Start

Requires [Bun](https://bun.sh) runtime.

```bash
# 1. Install
bun install -g claude-hitl-approval

# 2. Set up (installs hook + creates config + updates CLAUDE.md)
claude-hitl setup

# 3. Start the approval server (keep running in a terminal)
claude-hitl local
```

That's it. Start Claude Code normally — when it triggers a matched command, your browser opens with the approval page.

## How It Works

```
Claude Code                    HITL Hook                     Local Server
    |                              |                              |
    |-- tool_call (Bash: rm -rf) ->|                              |
    |                              |  [no description — reject]   |
    |<-- HITL_CONTEXT_REQUIRED ----|                              |
    |                              |                              |
    |-- tool_call (Bash: rm -rf   |                              |
    |   + description: "...") --->|                              |
    |                              |-- POST /requests ----------->|
    |                              |                              |-- [store in DB]
    |                              |<--- requestId ---------------|
    |                              |                              |
    |                              |-- open browser -------------->  (approval page)
    |                              |                              |
    |                              |-- poll GET /status --------->|
    |                              |   ...                        |
    |                              |                     user clicks [Approve]
    |                              |<-- { status: approved } -----|
    |                              |                              |
    |<-- exit 0 (allow) -----------|                              |
    |                              |                              |
```

1. Claude Code's `PreToolUse` hook sends the tool call to the HITL hook script
2. The hook checks if the command matches any rule in `.hitl.json`
3. If matched but no description provided, the hook rejects with `HITL_CONTEXT_REQUIRED` — asking Claude to explain what it's doing and why
4. Claude re-submits the same command with a description providing context from its conversation
5. The hook creates an approval request (with Claude's description) on the local server and opens the browser
6. The hook polls until you approve, deny, or the request times out
7. On approval, the hook exits 0 (allow). On denial/timeout, it exits 2 (block).

## Configuration

HITL looks for `.hitl.json` in your **current working directory first**, then falls back to `~/.hitl.json`. The `setup` command creates a default config at `~/.hitl.json`.

> **Tip:** If you have a project-level `.hitl.json`, it takes full precedence over the global `~/.hitl.json`. Rules in the global config won't apply when a local config exists. Use a local `.hitl.json` to define project-specific rules (e.g. gating MCP tools only used in that project), and the global `~/.hitl.json` for rules you want everywhere.

```json
{
  "approval": {
    "url": "http://localhost:9457",
    "pollIntervalMs": 1000,
    "timeoutMs": 300000
  },
  "rules": [
    { "tool": "Bash", "pattern": "rm *" },
    { "tool": "Bash", "pattern": "git push*" },
    { "tool": "Bash", "pattern": "curl * | *" },
    { "tool": "mcp__joke-server__tell_joke", "pattern": "*" }
  ]
}
```

### Rules

Each rule has a `tool` name and a glob `pattern`. When both match, the command requires approval.

| Field     | Description                                                                                           |
| --------- | ----------------------------------------------------------------------------------------------------- |
| `tool`    | The Claude Code tool name: `Bash`, `Write`, `Edit`, or an MCP tool like `mcp__server__tool`           |
| `pattern` | Glob pattern matched against the command string. `*` matches any characters including `/` and spaces. |

For `Bash` tools, the command string is the shell command. For `Write`/`Edit` tools, it's the file path. For MCP tools, it's the JSON-stringified tool input.

#### Common Rules

```json
{ "tool": "Bash", "pattern": "rm *" }
{ "tool": "Bash", "pattern": "git push*" }
{ "tool": "Bash", "pattern": "git reset*" }
{ "tool": "Bash", "pattern": "curl * | *" }
{ "tool": "Bash", "pattern": "docker rm*" }
{ "tool": "Write", "pattern": "*/package.json" }
```

#### Gating MCP Tools

When Claude calls an MCP tool, the tool name follows the format `mcp__<server-name>__<tool-name>`. For example, to require approval for a joke MCP server:

```json
{ "tool": "mcp__joke-server__tell_joke", "pattern": "*" }
```

See `examples/mcp-server/` for a full working example.

### Data Storage

Approval requests are stored in a SQLite database at `~/.hitl/hitl.db`. This directory is created automatically when you first start the server. The database persists across package upgrades and reinstalls.

### Environment Variables

**Hook** (runs on every Claude Code tool call):

| Variable                          | Default                 | Description                                    |
| --------------------------------- | ----------------------- | ---------------------------------------------- |
| `CLAUDE_HITL_APPROVAL_SERVER_URL` | `http://localhost:9457` | Approval server URL the hook sends requests to |

**Local server** (`claude-hitl local`):

| Variable                       | Default           | Description                |
| ------------------------------ | ----------------- | -------------------------- |
| `HITL_APPROVAL_SERVER_PORT`    | `9457`            | Port the server listens on |
| `HITL_APPROVAL_SERVER_DB_PATH` | `~/.hitl/hitl.db` | SQLite database path       |

## CLI Commands

| Command                   | Description                            |
| ------------------------- | -------------------------------------- |
| `claude-hitl local`       | Start the local approval server        |
| `claude-hitl setup`       | Install hook and create default config |
| `claude-hitl status <id>` | Check status of an approval request    |
| `claude-hitl list`        | List recent approval requests          |

### What `setup` Does

1. Installs the `PreToolUse` hook into `~/.claude/settings.json`
2. Creates a default `~/.hitl.json` config with sensible rules
3. Appends HITL instructions to `~/.claude/CLAUDE.md` so Claude knows how to handle blocked commands

## Installation

### npm / bun (recommended)

```bash
bun install -g claude-hitl-approval
# or
npm install -g claude-hitl-approval
```

### From Source

```bash
git clone https://github.com/Seitk/claude-hitl-approval.git
cd claude-hitl-approval
bun install
bun src/cli.ts setup
```

## Data Layer: SQLite vs Custom API

By default, the local server stores approval requests in SQLite. If you want to use your own backend for storage (e.g. a shared database, an internal approval service) while keeping the local server's web UI, you can configure an API data source.

Add `dataSource` to your `.hitl.json`:

```json
{
  "approval": { "url": "http://localhost:9457" },
  "rules": [],
  "dataSource": {
    "type": "api",
    "url": "https://your-api.example.com",
    "headers": {
      "Authorization": "Bearer your-token"
    }
  }
}
```

When `type` is `"api"`, the local server delegates all data operations to your API instead of SQLite. The web UI, JWT auth, and hook polling all remain the same.

### API Contract

Your API must implement these endpoints:

| Method | Endpoint                    | Request Body                                            | Response                                             |
| ------ | --------------------------- | ------------------------------------------------------- | ---------------------------------------------------- |
| `POST` | `/requests`                 | `InsertPayload` JSON                                    | `201` (reject duplicate `id` with `409`)             |
| `GET`  | `/requests/:id`             | -                                                       | `ApprovalRequest` JSON or `404`                      |
| `GET`  | `/requests/:id/status`      | -                                                       | `{ "status": "pending\|approved\|denied" }` or `404` |
| `POST` | `/requests/:id/resolve`     | `{ "status": "approved\|denied", "resolvedBy": "..." }` | `{ "updated": true\|false }`                         |
| `POST` | `/requests/:id/description` | `{ "description": "..." }`                              | `200`                                                |
| `GET`  | `/requests?limit=N`         | -                                                       | `ApprovalRequest[]` JSON                             |

**Important:** `POST /requests` must be insert-only. If a request with the same `id` already exists, reject it with `409` -- never upsert. The `command` field is immutable once created. `POST /requests/:id/resolve` must only resolve requests that are still `pending`.

**`InsertPayload`** shape:

```json
{
  "id": "uuid",
  "tool": "Bash",
  "command": "rm -rf dist",
  "workdir": "/project",
  "sessionId": "sess-123",
  "userId": "user",
  "requestedAt": 1711900000000
}
```

**`ApprovalRequest`** shape (extends InsertPayload):

```json
{
  "id": "uuid",
  "tool": "Bash",
  "command": "rm -rf dist",
  "description": "Recursively deletes the dist build output directory.",
  "workdir": "/project",
  "sessionId": "sess-123",
  "userId": "user",
  "status": "pending",
  "requestedAt": 1711900000000,
  "resolvedAt": null,
  "resolvedBy": null
}
```

See `examples/custom-api/` for a working reference implementation.

## Project Structure

```
src/
  cli.ts                    # CLI entry point
  hook/hook.ts              # PreToolUse hook (runs on every tool call)
  shared/
    types.ts                # Core interfaces (DataStore, ApprovalRequest, etc.)
    config.ts               # Config loader (.hitl.json)
    patterns.ts             # Glob pattern matching for rules
  local-server/
    server.ts               # Express app
    routes.ts               # HTTP endpoints + description generation
    db.ts                   # SQLite store (SqliteStore)
    api-store.ts            # Remote API store (ApiStore)
    store.ts                # Factory: creates the right DataStore from config
    auth.ts                 # JWT token generation & validation
    config.ts               # Server config (port, dataSource)
  commands/
    local.ts                # `claude-hitl local`
    setup.ts                # `claude-hitl setup`
    status.ts               # `claude-hitl status <id>`
    list.ts                 # `claude-hitl list`
web/
  index.html                # Single-page UI (dashboard + detail views)
  app.js                    # Frontend logic
examples/
  basic/                    # Simple setup: .hitl.json + demo script
  mcp-server/               # MCP joke server gated by HITL
  custom-handler/           # Your own approval server (replaces `claude-hitl local`)
  custom-api/               # Local server UI backed by your own storage API
```

## Development

```bash
git clone https://github.com/Seitk/claude-hitl-approval.git
cd claude-hitl-approval
bun install

# Run tests
bun test

# Run tests in watch mode
bun test --watch

# Start the server from source
bun src/cli.ts local
```

## License

MIT
