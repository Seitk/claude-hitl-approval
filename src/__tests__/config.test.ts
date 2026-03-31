import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { mkdirSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { loadConfig } from '../shared/config';

describe('loadConfig', () => {
  let testDir: string;
  let homeDir: string;
  let baseDir: string;

  beforeEach(() => {
    baseDir = join(tmpdir(), `hitl-test-${Date.now()}`);
    testDir = join(baseDir, 'cwd');
    homeDir = join(baseDir, 'home');
    mkdirSync(testDir, { recursive: true });
    mkdirSync(homeDir, { recursive: true });
    delete process.env.CLAUDE_HITL_APPROVAL_SERVER_URL;
  });

  afterEach(() => {
    rmSync(baseDir, { recursive: true, force: true });
  });

  it('returns defaults when no config file exists', () => {
    const config = loadConfig(testDir, homeDir);
    expect(config.approval.url).toBe('http://localhost:9457');
    expect(config.approval.pollIntervalMs).toBe(1000);
    expect(config.approval.timeoutMs).toBe(300000);
    expect(config.rules).toEqual([]);
  });

  it('loads .hitl.json from cwd', () => {
    writeFileSync(
      join(testDir, '.hitl.json'),
      JSON.stringify({
        approval: { url: 'http://localhost:9999' },
        rules: [{ tool: 'Bash', pattern: 'rm *' }],
      }),
    );
    const config = loadConfig(testDir, homeDir);
    expect(config.approval.url).toBe('http://localhost:9999');
    expect(config.rules).toHaveLength(1);
  });

  it('loads .hitl.json from home directory when no cwd config', () => {
    writeFileSync(
      join(homeDir, '.hitl.json'),
      JSON.stringify({
        approval: { url: 'http://localhost:7777' },
        rules: [{ tool: 'Bash', pattern: 'git push*' }],
      }),
    );
    const config = loadConfig(testDir, homeDir);
    expect(config.approval.url).toBe('http://localhost:7777');
    expect(config.rules).toHaveLength(1);
    expect(config.rules[0].pattern).toBe('git push*');
  });

  it('cwd config takes precedence over home config', () => {
    writeFileSync(
      join(testDir, '.hitl.json'),
      JSON.stringify({ approval: { url: 'http://cwd.example.com' } }),
    );
    writeFileSync(
      join(homeDir, '.hitl.json'),
      JSON.stringify({ approval: { url: 'http://home.example.com' } }),
    );
    const config = loadConfig(testDir, homeDir);
    expect(config.approval.url).toBe('http://cwd.example.com');
  });

  it('CLAUDE_HITL_APPROVAL_SERVER_URL overrides file config', () => {
    writeFileSync(
      join(testDir, '.hitl.json'),
      JSON.stringify({ approval: { url: 'http://localhost:9999' } }),
    );
    process.env.CLAUDE_HITL_APPROVAL_SERVER_URL = 'http://custom.example.com';
    const config = loadConfig(testDir, homeDir);
    expect(config.approval.url).toBe('http://custom.example.com');
  });
});
