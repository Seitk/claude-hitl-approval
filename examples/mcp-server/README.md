# MCP Server Example

Gate an MCP tool with human-in-the-loop approval. This example runs a joke-telling MCP server — every call to `tell_joke` requires your approval before Claude can see the result.

## Setup

```bash
# Install dependencies for this example
cd examples/mcp-server
bun install

# Install claude-hitl-approval (if you haven't already)
bun install -g claude-hitl-approval
claude-hitl setup
```

Register the MCP server in your Claude Code settings (`~/.claude/settings.json`):

```json
{
  "mcpServers": {
    "joke-server": {
      "command": "bun",
      "args": ["<full-path-to>/examples/mcp-server/server.ts"]
    }
  }
}
```

## Try It

```bash
# Terminal 1: start the approval server
claude-hitl local

# Terminal 2: start Claude Code from this directory
cd examples/mcp-server
claude

# Ask Claude: "tell me a joke"
# Claude calls the tell_joke MCP tool → the hook intercepts it →
# your browser opens for approval → approve or deny.
```

## How It Works

When Claude calls an MCP tool, Claude Code fires a `PreToolUse` hook with the tool name in the format `mcp__<server>__<tool>`. For this example, that's `mcp__joke-server__tell_joke`.

The `.hitl.json` in this directory contains:

```json
{
  "rules": [
    { "tool": "mcp__joke-server__tell_joke", "pattern": "*" }
  ]
}
```

This gates **every** call to `tell_joke`, regardless of the input arguments. The `"pattern": "*"` matches any input. You could also match specific arguments — for example, `"pattern": "*ai*"` would only require approval for AI-category jokes.

## Gating Your Own MCP Tools

To gate any MCP tool, add a rule to `.hitl.json`:

```json
{ "tool": "mcp__<server-name>__<tool-name>", "pattern": "*" }
```

The tool name format is always `mcp__` + the server name from your `mcpServers` config + `__` + the tool name exposed by the server.
