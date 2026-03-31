// src/local-server/config.ts
import { loadConfig } from '../shared/config';
import type { DataSourceConfig } from '../shared/types';

export interface ServerConfig {
  port: number;
  dataSource?: DataSourceConfig;
}

export function loadServerConfig(): ServerConfig {
  const config = loadConfig();
  return {
    port: parseInt(process.env.HITL_APPROVAL_SERVER_PORT ?? '9457', 10),
    dataSource: config.dataSource,
  };
}
