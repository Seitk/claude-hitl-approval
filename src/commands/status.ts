// src/commands/status.ts
import { loadConfig } from '../shared/config';

export async function runStatus(requestId: string): Promise<void> {
  const config = loadConfig();
  const url = `${config.approval.url}/api/requests/${requestId}`;
  try {
    const res = await fetch(url);
    if (res.status === 404) {
      console.error(`Request not found: ${requestId}`);
      process.exit(1);
    }
    if (!res.ok) {
      console.error(`Error: HTTP ${res.status}`);
      process.exit(1);
    }
    const r = await res.json() as {
      id: string; tool: string; command: string; workdir: string;
      status: string; requestedAt: number; resolvedAt: number | null; resolvedBy: string | null;
    };
    console.log(`Request ID : ${r.id}`);
    console.log(`Tool       : ${r.tool}`);
    console.log(`Command    : ${r.command}`);
    console.log(`Workdir    : ${r.workdir}`);
    console.log(`Status     : ${r.status.toUpperCase()}`);
    console.log(`Requested  : ${new Date(r.requestedAt).toLocaleString()}`);
    if (r.resolvedAt) {
      console.log(`Resolved   : ${new Date(r.resolvedAt).toLocaleString()} by ${r.resolvedBy}`);
    }
  } catch (err) {
    console.error(`Failed to reach approval service: ${(err as Error).message}`);
    console.error('Ensure the service is running: claude-hitl local');
    process.exit(1);
  }
}
