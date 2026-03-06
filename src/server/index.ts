import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import fastifyCors from '@fastify/cors';
import fastifyWebsocket from '@fastify/websocket';
import path from 'path';
import { fsRoutes } from './routes/fs';
import { safetyMiddleware } from './middleware/safety';
import { setupWatcher } from './watcher';
import { loadPlugins } from '../plugins/loader';

export interface ServerOptions {
  rootDir: string;
  port: number;
  host: string;
  readonly: boolean;
  token?: string;
  ignorePatterns: string[];
  maxDepth: number;
  plugins: string[];
}

export async function createServer(options: ServerOptions) {
  const app = Fastify({ logger: false });

  await app.register(fastifyCors, {
    origin: [`http://${options.host}:${options.port}`, 'http://localhost:5173'],
    credentials: true,
  });

  await app.register(fastifyWebsocket);

  // Auth token middleware
  if (options.token) {
    app.addHook('onRequest', async (request, reply) => {
      const auth = request.headers.authorization;
      if (!auth || auth !== `Bearer ${options.token}`) {
        reply.code(401).send({ error: 'Unauthorized' });
      }
    });
  }

  // Register safety middleware
  app.decorateRequest('resolvedPath', '');
  app.addHook('onRequest', safetyMiddleware(options.rootDir));

  // Register filesystem routes
  await app.register(
    async (instance) => {
      fsRoutes(instance, options);
    },
    { prefix: '/api/fs' }
  );

  // Setup WebSocket file watcher
  setupWatcher(app, options.rootDir, options.ignorePatterns);

  // Load plugins
  if (options.plugins.length > 0) {
    await loadPlugins(app, options.plugins, options.rootDir);
  }

  // Serve static client files
  const clientDir = path.join(__dirname, '../client');
  await app.register(fastifyStatic, {
    root: clientDir,
    prefix: '/',
    decorateReply: false,
  });

  // SPA fallback — serve index.html for all non-API routes
  app.setNotFoundHandler(async (_request, reply) => {
    reply.sendFile('index.html', clientDir);
  });

  return app;
}
