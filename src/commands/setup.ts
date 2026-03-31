// src/commands/setup.ts
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const CLAUDE_SETTINGS_PATH = join(homedir(), '.claude', 'settings.json');
const DEFAULT_HITL_CONFIG_PATH = join(homedir(), '.hitl.json');
const CLAUDE_MD_PATH = join(homedir(), '.claude', 'CLAUDE.md');

const DEFAULT_HITL_CONFIG = {
  approval: {
    url: 'http://localhost:9457',
    pollIntervalMs: 1000,
    timeoutMs: 300000,
  },
  rules: [
    { tool: 'Bash', pattern: 'rm *' },
    { tool: 'Bash', pattern: 'rm -rf *' },
    { tool: 'Bash', pattern: 'git push*' },
    { tool: 'Bash', pattern: 'curl * | *' },
  ],
};

const SKILL_SECTION = `
## HITL Approval Plugin

This project uses the \`claude-hitl-approval\` plugin. When a command is blocked by the HITL hook, you will see an error containing "HITL:" in the message.

**Rules you MUST follow when you see HITL output:**
1. If you see \`HITL_CONTEXT_REQUIRED\`: You MUST retry the same command immediately, but this time include a detailed \`description\` parameter explaining (1) what the command does and (2) why you are running it in the current context. This is NOT a blocked command — it is a request for you to provide context for human review.
2. If denied (contains "Command denied"): tell the user the command was denied and stop. Do NOT retry.
3. If timed out (contains "timed out"): tell the user it timed out and ask them to approve at the HITL dashboard, then wait for them to ask you to retry.
4. For denied/timed out: NEVER retry the blocked command automatically. Do NOT run any additional commands.

**Config file:** \`~/.hitl.json\` — edit \`rules\` to add/remove patterns requiring approval.
**Rule format:** \`{ "tool": "Bash", "pattern": "rm *" }\` — tool name + glob pattern on command string.
`;

function resolveHookCommand(): string {
  // If globally installed, use the bin name directly
  try {
    const result = Bun.spawnSync(['which', 'claude-hitl-hook']);
    if (result.exitCode === 0) return 'claude-hitl-hook';
  } catch {}
  // Otherwise use absolute path to the hook script
  const hookPath = join(import.meta.dir, '../hook/hook.ts');
  return `bun ${hookPath}`;
}

export function runSetup(): void {
  // 1. Install PreToolUse hook into ~/.claude/settings.json
  mkdirSync(join(homedir(), '.claude'), { recursive: true });
  let settings: Record<string, unknown> = {};
  if (existsSync(CLAUDE_SETTINGS_PATH)) {
    settings = JSON.parse(readFileSync(CLAUDE_SETTINGS_PATH, 'utf-8')) as Record<string, unknown>;
  }

  const hookCommand = resolveHookCommand();
  const hooks = (settings['hooks'] as Record<string, unknown> | undefined) ?? {};
  const preToolUse = (hooks['PreToolUse'] as unknown[] | undefined) ?? [];

  const hookEntry = { matcher: '', hooks: [{ type: 'command', command: hookCommand }] };
  const alreadyInstalled = (preToolUse as Array<{ hooks?: Array<{ command?: string }> }>)
    .some(h => h.hooks?.some(hh => hh.command?.includes('claude-hitl-hook') || hh.command?.includes('hook/hook.ts')));

  if (!alreadyInstalled) {
    preToolUse.push(hookEntry);
    hooks['PreToolUse'] = preToolUse;
    settings['hooks'] = hooks;
    writeFileSync(CLAUDE_SETTINGS_PATH, JSON.stringify(settings, null, 2));
    console.log(`✓ Hook installed in ${CLAUDE_SETTINGS_PATH}`);
  } else {
    console.log(`  Hook already installed in ${CLAUDE_SETTINGS_PATH}`);
  }

  // 2. Create default ~/.hitl.json if not present
  if (!existsSync(DEFAULT_HITL_CONFIG_PATH)) {
    writeFileSync(DEFAULT_HITL_CONFIG_PATH, JSON.stringify(DEFAULT_HITL_CONFIG, null, 2));
    console.log(`✓ Default config created at ${DEFAULT_HITL_CONFIG_PATH}`);
  } else {
    console.log(`  Config already exists at ${DEFAULT_HITL_CONFIG_PATH}`);
  }

  // 3. Append HITL skill section to ~/.claude/CLAUDE.md
  const existingMd = existsSync(CLAUDE_MD_PATH)
    ? readFileSync(CLAUDE_MD_PATH, 'utf-8')
    : '';
  if (!existingMd.includes('HITL Approval Plugin')) {
    writeFileSync(CLAUDE_MD_PATH, existingMd + SKILL_SECTION);
    console.log(`✓ HITL skill appended to ${CLAUDE_MD_PATH}`);
  } else {
    console.log(`  HITL skill already in ${CLAUDE_MD_PATH}`);
  }

  console.log('');
  console.log('Setup complete. Next steps:');
  console.log('  1. Run: claude-hitl local');
  console.log('  2. Start a new Claude Code session');
  console.log('  3. Claude will now prompt for approval on matched commands');
}
