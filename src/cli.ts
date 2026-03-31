#!/usr/bin/env bun
// src/cli.ts

const [,, subcommand, ...args] = process.argv;

switch (subcommand) {
  case 'local': {
    const { runLocal } = await import('./commands/local');
    runLocal();
    break;
  }
  case 'setup': {
    const { runSetup } = await import('./commands/setup');
    runSetup();
    break;
  }
  case 'status': {
    const requestId = args[0];
    if (!requestId) { console.error('Usage: claude-hitl status <requestId>'); process.exit(1); }
    const { runStatus } = await import('./commands/status');
    await runStatus(requestId);
    break;
  }
  case 'list': {
    const { runList } = await import('./commands/list');
    await runList();
    break;
  }
  default:
    console.log('Usage: claude-hitl <command>');
    console.log('');
    console.log('Commands:');
    console.log('  local              Start the local approval service');
    console.log('  setup              Install hook and create default config');
    console.log('  status <id>        Check status of an approval request');
    console.log('  list               List recent approval requests');
    process.exit(subcommand ? 1 : 0);
}
