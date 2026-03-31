// src/commands/local.ts
import { createStore } from '../local-server/store';
import { createAuthService } from '../local-server/auth';
import { startServer } from '../local-server/server';
import { loadServerConfig } from '../local-server/config';

export function runLocal(): void {
  const { port, dataSource } = loadServerConfig();
  const store = createStore(dataSource);
  const auth = createAuthService();
  startServer(port, store, auth);
}
