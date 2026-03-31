// src/local-server/routes.ts
import type { Express, Request, Response } from 'express';
import type { AuthService, DataStore } from '../shared/types';
import { randomUUID } from 'crypto';
import { join } from 'path';
import { readFileSync } from 'fs';
import { spawn } from 'child_process';

function serveHtml(
  res: Response,
  requestId: string | null,
  actionToken: string | null,
): void {
  const htmlPath = join(import.meta.dir, '../../web/index.html');
  let html = readFileSync(htmlPath, 'utf-8');
  const initScript = `<script>
window.__HITL_REQUEST_ID__ = ${JSON.stringify(requestId)};
window.__HITL_ACTION_TOKEN__ = ${JSON.stringify(actionToken)};
</script>`;
  html = html.replace('<!-- HITL_INIT_SCRIPT_PLACEHOLDER -->', initScript);
  res.setHeader('Content-Type', 'text/html');
  res.send(html);
}

function generateDescription(
  store: DataStore,
  requestId: string,
  tool: string,
  command: string,
): void {
  const prompt = `In one short sentence (under 30 words), describe what this ${tool} command does and flag any risks. Be direct, no preamble.\n\nCommand: ${command}`;

  const child = spawn('claude', ['--print', prompt], {
    stdio: ['ignore', 'pipe', 'ignore'],
    timeout: 30_000,
  });

  let output = '';
  child.stdout.on('data', (chunk: Buffer) => { output += chunk.toString(); });
  child.on('close', (code) => {
    if (code === 0 && output.trim()) {
      store.updateDescription(requestId, output.trim()).catch(() => {});
    }
  });
  child.on('error', () => {});
}

function parseDescriptionFromCommand(command: string): string | null {
  try {
    const parsed = JSON.parse(command);
    if (parsed && typeof parsed.description === 'string' && parsed.description.trim()) {
      return parsed.description.trim();
    }
  } catch {
    // Not JSON — ignore
  }
  return null;
}

export function registerRoutes(
  app: Express,
  store: DataStore,
  auth: AuthService,
): void {
  // Create approval request (hook)
  app.post('/requests', async (req: Request, res: Response) => {
    const { tool, command, description, workdir, sessionId } = req.body as {
      tool?: string;
      command?: string;
      description?: string;
      workdir?: string;
      sessionId?: string;
    };
    if (!tool || !command || !workdir) {
      res.status(400).json({ error: 'tool, command, workdir are required' });
      return;
    }
    const id = randomUUID();
    // Try description from dedicated field first, then parse from command JSON
    const callerDescription = description?.trim()
      || parseDescriptionFromCommand(command)
      || null;
    await store.insertRequest({
      id,
      tool,
      command,
      description: callerDescription,
      workdir,
      sessionId: sessionId ?? null,
      userId: 'user',
      requestedAt: Date.now(),
    });
    // Only generate async description if caller didn't provide one
    if (!callerDescription) {
      generateDescription(store, id, tool, command);
    }
    res.status(201).json({ requestId: id });
  });

  // Poll status (hook) — register BEFORE the generic /:id route
  app.get('/requests/:id/status', async (req: Request, res: Response) => {
    const status = await store.getRequestStatus(req.params['id']!);
    if (!status) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    res.json({ status });
  });

  // Serve approval detail page (browser) — generates JWT
  app.get('/requests/:id', async (req: Request, res: Response) => {
    const record = await store.getRequest(req.params['id']!);
    if (!record) {
      res.status(404).send('Request not found');
      return;
    }
    const token = auth.generateToken(record.id);
    serveHtml(res, record.id, token);
  });

  // Get full request detail as JSON (web UI JS)
  app.get('/api/requests/:id', async (req: Request, res: Response) => {
    const record = await store.getRequest(req.params['id']!);
    if (!record) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    res.json(record);
  });

  // Approve (requires JWT)
  app.post('/requests/:id/approve', async (req: Request, res: Response) => {
    const token = req.headers['x-hitl-web-token'] as string | undefined;
    if (!token) {
      res.status(401).json({ error: 'Missing X-HITL-Web-Token header' });
      return;
    }
    const { valid, error } = auth.validateToken(token, req.params['id']!);
    if (!valid) {
      res.status(401).json({ error });
      return;
    }
    const updated = await store.resolveRequest(req.params['id']!, 'approved', 'web-ui');
    if (!updated) {
      res.status(409).json({ error: 'Request not pending or not found' });
      return;
    }
    res.json({ status: 'approved' });
  });

  // Deny (requires JWT)
  app.post('/requests/:id/deny', async (req: Request, res: Response) => {
    const token = req.headers['x-hitl-web-token'] as string | undefined;
    if (!token) {
      res.status(401).json({ error: 'Missing X-HITL-Web-Token header' });
      return;
    }
    const { valid, error } = auth.validateToken(token, req.params['id']!);
    if (!valid) {
      res.status(401).json({ error });
      return;
    }
    const updated = await store.resolveRequest(req.params['id']!, 'denied', 'web-ui');
    if (!updated) {
      res.status(409).json({ error: 'Request not pending or not found' });
      return;
    }
    res.json({ status: 'denied' });
  });

  // List requests as JSON (CLI + dashboard)
  app.get('/api/requests', async (_req: Request, res: Response) => {
    res.json(await store.listRequests(50));
  });

  // Dashboard (browser)
  app.get('/', (_req: Request, res: Response) => {
    serveHtml(res, null, null);
  });
}
