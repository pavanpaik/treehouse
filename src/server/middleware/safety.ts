import path from 'path';
import { FastifyRequest, FastifyReply } from 'fastify';

/**
 * Path traversal prevention middleware.
 * Ensures all resolved paths stay within the rootDir.
 */
export function safetyMiddleware(rootDir: string) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    // Only validate paths on /api/fs routes
    if (!request.url.startsWith('/api/fs')) return;

    const query = request.query as Record<string, string>;
    const body = request.body as Record<string, string> | null;

    // Collect all path params from query or body
    const pathsToCheck: string[] = [];
    for (const key of ['path', 'oldPath', 'newPath']) {
      if (query[key]) pathsToCheck.push(query[key]);
      if (body?.[key]) pathsToCheck.push(body[key]);
    }

    for (const relPath of pathsToCheck) {
      const resolved = path.resolve(rootDir, relPath);
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
