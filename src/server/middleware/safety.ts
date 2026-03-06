import path from 'path';
import { FastifyRequest, FastifyReply } from 'fastify';

/**
 * Path traversal prevention middleware.
 * Ensures all resolved paths stay within the rootDir.
 */
/**
 * onRequest hook — validates query-string path params (available before body parsing).
 */
export function safetyMiddleware(rootDir: string) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.url.startsWith('/api/fs')) return;

    const query = request.query as Record<string, string>;
    for (const key of ['path', 'oldPath', 'newPath']) {
      if (!query[key]) continue;
      const resolved = path.resolve(rootDir, query[key]);
      if (!resolved.startsWith(rootDir + path.sep) && resolved !== rootDir) {
        reply.code(403).send({ error: 'Path traversal detected' });
        return;
      }
    }
  };
}

/**
 * preHandler hook — validates body path params (available after body parsing).
 * Register this as a preHandler on write routes.
 */
export function bodyPathSafetyHook(rootDir: string) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as Record<string, string> | null;
    if (!body) return;

    for (const key of ['path', 'oldPath', 'newPath']) {
      if (!body[key]) continue;
      const resolved = path.resolve(rootDir, body[key]);
      if (!resolved.startsWith(rootDir + path.sep) && resolved !== rootDir) {
        reply.code(403).send({ error: 'Path traversal detected' });
        return;
      }
    }
  };
}

/**
 * Safely resolve a relative path against rootDir.
 * Throws if the path escapes the root.
 */
export function safePath(rootDir: string, relPath: string): string {
  const resolved = path.resolve(rootDir, relPath);
  if (!resolved.startsWith(rootDir + path.sep) && resolved !== rootDir) {
    throw new Error(`Path traversal detected: ${relPath}`);
  }
  return resolved;
}
