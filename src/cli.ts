#!/usr/bin/env node
import { Command } from 'commander';
import path from 'path';
import { createServer } from './server/index';

const program = new Command();

program
  .name('treehouse')
  .description('Local filesystem UI — browse, edit, and manage files in your browser')
  .argument('[root]', 'Root directory to serve', '.')
  .option('-p, --port <number>', 'Port to listen on', '3000')
  .option('--host <string>', 'Host to bind to', '127.0.0.1')
  .option('--readonly', 'Disable write operations')
  .option('--no-open', "Don't auto-open browser")
  .option('--plugin <path...>', 'Load plugin(s) — path or package name')
  .option('--token <string>', 'Require auth token for API access')
  .option('--ignore <patterns...>', 'Additional ignore patterns')
  .option('--depth <number>', 'Max directory tree depth', '10')
  .version('0.1.0')
  .action(async (root: string, options) => {
    const rootDir = path.resolve(process.cwd(), root);
    const port = parseInt(options.port, 10);

    const server = await createServer({
      rootDir,
      port,
      host: options.host,
      readonly: options.readonly ?? false,
      token: options.token,
      ignorePatterns: options.ignore ?? [],
      maxDepth: parseInt(options.depth, 10),
      plugins: options.plugin ?? [],
    });

    await server.listen({ port, host: options.host });
    const url = `http://${options.host}:${port}`;
    console.log(`\n  treehouse running at ${url}`);
    console.log(`  serving: ${rootDir}\n`);

    if (options.open !== false) {
      const { default: open } = await import('open');
      await open(url);
    }
  });

program.parse();
