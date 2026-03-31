import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import type { HitlConfig } from './types';

const DEFAULTS: HitlConfig = {
  approval: {
    url: 'http://localhost:9457',
    pollIntervalMs: 1000,
    timeoutMs: 300000,
  },
  rules: [],
};

export function loadConfig(cwd: string = process.cwd(), home: string = homedir()): HitlConfig {
  const candidates = [join(cwd, '.hitl.json'), join(home, '.hitl.json')];

  let file: Partial<HitlConfig> = {};
  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      file = JSON.parse(readFileSync(candidate, 'utf-8')) as Partial<HitlConfig>;
      break;
    }
  }

  const url =
    process.env.CLAUDE_HITL_APPROVAL_SERVER_URL ??
    file.approval?.url ??
    DEFAULTS.approval.url;

  return {
    approval: {
      url,
      pollIntervalMs: file.approval?.pollIntervalMs ?? DEFAULTS.approval.pollIntervalMs,
      timeoutMs: file.approval?.timeoutMs ?? DEFAULTS.approval.timeoutMs,
    },
    rules: file.rules ?? DEFAULTS.rules,
    dataSource: file.dataSource,
  };
}
