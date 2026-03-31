#!/usr/bin/env bun
// src/hook/hook.ts

import { loadConfig } from '../shared/config';
import { matchesAnyRule } from '../shared/patterns';
import type { HookInput } from '../shared/types';
import open from 'open';

// ── Pure helpers (exported for tests) ────────────────────────────────────────

export function extractCommand(
  toolName: string,
  toolInput: Record<string, unknown>,
): string {
  switch (toolName) {
    case 'Bash':
      return String(toolInput['command'] ?? '');
    case 'Write':
    case 'Edit':
      return String(toolInput['file_path'] ?? '');
    default:
      return JSON.stringify(toolInput);
  }
}

export function buildDenialMessage(
  requestId: string,
  reason: 'denied' | 'timeout',
): string {
  if (reason === 'timeout') {
    return `HITL: Command approval timed out. Request ${requestId}. Do NOT retry — ask the user to approve and retry.`;
  }
  return `HITL: Command denied by user. Request ${requestId}. Do NOT retry this command.`;
}

// ── Main hook logic ───────────────────────────────────────────────────────────

async function main(): Promise<void> {
  let input: HookInput;
  try {
    const raw = await Bun.stdin.text();
    input = JSON.parse(raw) as HookInput;
  } catch {
    // Cannot parse input — allow to avoid blocking all commands
    process.exit(0);
  }

  const cwd = input.workspace?.current_dir ?? process.cwd();
  const config = loadConfig(cwd);
  const command = extractCommand(input.tool_name, input.tool_input);

  if (!matchesAnyRule(input.tool_name, command, config.rules)) {
    process.exit(0);
  }

  // Create approval request
  let requestId: string;
  try {
    const res = await fetch(`${config.approval.url}/requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tool: input.tool_name,
        command,
        workdir: cwd,
        sessionId: input.session_id ?? null,
      }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = (await res.json()) as { requestId: string };
    requestId = body.requestId;
  } catch (err) {
    console.error(`HITL: Failed to reach approval service: ${(err as Error).message}`);
    console.error(`HITL: Ensure the service is running: claude-hitl local`);
    process.exit(2);
  }

  // Open browser to approval page
  await open(`${config.approval.url}/requests/${requestId}`);

  // Poll for status
  const deadline = Date.now() + config.approval.timeoutMs;
  while (Date.now() < deadline) {
    await Bun.sleep(config.approval.pollIntervalMs);
    try {
      const res = await fetch(
        `${config.approval.url}/requests/${requestId}/status`,
      );
      if (!res.ok) continue;
      const { status } = (await res.json()) as { status: string };
      if (status === 'approved') {
        process.exit(0);
      }
      if (status === 'denied') {
        console.error(buildDenialMessage(requestId, 'denied'));
        process.exit(2);
      }
      // status === 'pending' → keep polling
    } catch {
      // Network error — keep polling
    }
  }

  // Timeout
  console.error(buildDenialMessage(requestId, 'timeout'));
  process.exit(2);
}

// Only run main() when executed directly (not when imported in tests)
if (import.meta.main) {
  main();
}
