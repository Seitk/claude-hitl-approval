// src/commands/list.ts
import { loadConfig } from '../shared/config';

export async function runList(): Promise<void> {
  const config = loadConfig();
  try {
    const res = await fetch(`${config.approval.url}/api/requests`);
    if (!res.ok) { console.error(`Error: HTTP ${res.status}`); process.exit(1); }
    const requests = await res.json() as Array<{
      id: string; tool: string; command: string; status: string; requestedAt: number;
    }>;
    if (requests.length === 0) { console.log('No requests found.'); return; }

    const idW = 10, toolW = 8, statusW = 10;
    const sep = `${'-'.repeat(idW)}  ${'-'.repeat(toolW)}  ${'-'.repeat(statusW)}  ${'─'.repeat(40)}  ${'─'.repeat(22)}`;
    console.log(`${'ID'.padEnd(idW)}  ${'TOOL'.padEnd(toolW)}  ${'STATUS'.padEnd(statusW)}  ${'COMMAND'.padEnd(40)}  REQUESTED`);
    console.log(sep);
    for (const r of requests) {
      const id = r.id.slice(0, idW).padEnd(idW);
      const tool = r.tool.padEnd(toolW);
      const status = r.status.toUpperCase().padEnd(statusW);
      const cmd = r.command.slice(0, 40).padEnd(40);
      const ts = new Date(r.requestedAt).toLocaleString();
      console.log(`${id}  ${tool}  ${status}  ${cmd}  ${ts}`);
    }
  } catch (err) {
    console.error(`Failed to reach approval service: ${(err as Error).message}`);
    process.exit(1);
  }
}
