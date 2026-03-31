// src/local-server/store.ts
import type { DataSourceConfig, DataStore } from '../shared/types';
import { initDb, SqliteStore } from './db';
import { ApiStore } from './api-store';

export function createStore(config?: DataSourceConfig): DataStore {
  if (config?.type === 'api') {
    if (!config.url) {
      throw new Error('dataSource.url is required when type is "api"');
    }
    return new ApiStore(config.url, config.headers);
  }

  // Default: SQLite
  const dbPath = config?.dbPath;
  const db = initDb(dbPath);
  return new SqliteStore(db);
}
