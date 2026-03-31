// src/local-server/server.ts
import express from 'express';
import { join } from 'path';
import type { AuthService, DataStore } from '../shared/types';
import { registerRoutes } from './routes';

export function createApp(store: DataStore, auth: AuthService) {
  const app = express();
  app.use(express.json());
  app.use(express.static(join(import.meta.dir, '../../web')));
  registerRoutes(app, store, auth);
  return app;
}

export function startServer(port: number, store: DataStore, auth: AuthService): void {
  const app = createApp(store, auth);
  app.listen(port, '127.0.0.1', () => {
    console.log(`HITL approval service running at http://localhost:${port}`);
    console.log(`Dashboard: http://localhost:${port}/`);
  });
}
