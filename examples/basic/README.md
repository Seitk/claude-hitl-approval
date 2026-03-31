# Basic Example

The simplest setup: a `.hitl.json` config and a script that requires approval to run.

## Setup

```bash
# Install globally (if you haven't already)
bun install -g claude-hitl-approval

# Run setup once
claude-hitl setup
```

## Try It

```bash
# Terminal 1: start the approval server
claude-hitl local

# Terminal 2: start Claude Code from this directory
cd examples/basic
claude

# Ask Claude: "run bun demo.ts"
# The hook intercepts the command and opens your browser for approval.
```

## How It Works

The `.hitl.json` in this directory contains a rule `{ "tool": "Bash", "pattern": "*demo.ts*" }`.
When Claude runs any Bash command containing `demo.ts`, the hook:

1. Creates an approval request on the local server
2. Opens the approval page in your browser
3. Polls until you click **Approve** or **Deny**
4. Allows or blocks the command based on your decision
