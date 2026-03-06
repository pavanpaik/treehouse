import chokidar from 'chokidar';
import path from 'path';
import { FastifyInstance } from 'fastify';
import { WebSocket } from 'ws';

export function setupWatcher(app: FastifyInstance, rootDir: string, ignorePatterns: string[]) {
  const clients = new Set<WebSocket>();

  const watcher = chokidar.watch(rootDir, {
    ignored: [/(^|[/\\])\../, 'node_modules/**', ...ignorePatterns],
    persistent: true,
    ignoreInitial: true,
  });

  function broadcast(event: object) {
    const msg = JSON.stringify(event);
    for (const client of clients) {
      if (client.readyState === 1 /* OPEN */) {
        client.send(msg);
      }
    }
  }

  watcher
    .on('add', (filePath) =>
      broadcast({ type: 'file:created', path: path.relative(rootDir, filePath) })
    )
    .on('change', (filePath) =>
      broadcast({ type: 'file:changed', path: path.relative(rootDir, filePath) })
    )
    .on('unlink', (filePath) =>
      broadcast({ type: 'file:deleted', path: path.relative(rootDir, filePath) })
    )
    .on('addDir', (dirPath) =>
      broadcast({ type: 'dir:created', path: path.relative(rootDir, dirPath) })
    )
    .on('unlinkDir', (dirPath) =>
      broadcast({ type: 'dir:deleted', path: path.relative(rootDir, dirPath) })
    );

  app.get('/ws', { websocket: true }, (socket) => {
    clients.add(socket);

    socket.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === 'watch:add' && msg.pattern) {
          watcher.add(path.join(rootDir, msg.pattern));
        } else if (msg.type === 'watch:remove' && msg.pattern) {
          watcher.unwatch(path.join(rootDir, msg.pattern));
        }
      } catch {
        // ignore malformed messages
      }
    });

    socket.on('close', () => clients.delete(socket));
    socket.on('error', () => clients.delete(socket));
  });

  process.on('SIGINT', () => {
    watcher.close();
    process.exit(0);
  });
}
