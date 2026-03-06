import fs from 'fs/promises';
import path from 'path';
import { FastifyInstance } from 'fastify';
import { safePath, bodyPathSafetyHook } from '../middleware/safety';
import { ServerOptions } from '../index';

const DEFAULT_IGNORE = ['node_modules', '.git', '.DS_Store', '*.env', '.env*'];

interface TreeNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: TreeNode[];
  size?: number;
  modified?: string;
}

async function buildTree(
  rootDir: string,
  dir: string,
  relBase: string,
  depth: number,
  maxDepth: number,
  ignorePatterns: string[]
): Promise<TreeNode[]> {
  if (depth > maxDepth) return [];

  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }

  const nodes: TreeNode[] = [];
  const allIgnore = [...DEFAULT_IGNORE, ...ignorePatterns];

  for (const entry of entries) {
    // Check ignore patterns
    const shouldIgnore = allIgnore.some((pattern) => {
      if (pattern.startsWith('*')) return entry.name.endsWith(pattern.slice(1));
      return entry.name === pattern || entry.name.startsWith(pattern.replace('*', ''));
    });
    if (shouldIgnore) continue;

    const fullPath = path.join(dir, entry.name);
    const relPath = path.join(relBase, entry.name);

    if (entry.isDirectory()) {
      const children = await buildTree(
        rootDir,
        fullPath,
        relPath,
        depth + 1,
        maxDepth,
        ignorePatterns
      );
      nodes.push({ name: entry.name, path: relPath, type: 'directory', children });
    } else {
      let stat;
      try {
        stat = await fs.stat(fullPath);
      } catch {
        continue;
      }
      nodes.push({
        name: entry.name,
        path: relPath,
        type: 'file',
        size: stat.size,
        modified: stat.mtime.toISOString(),
      });
    }
  }

  return nodes.sort((a, b) => {
    // Directories first, then alphabetical
    if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

export function fsRoutes(app: FastifyInstance, options: ServerOptions) {
  const { rootDir, readonly, maxDepth, ignorePatterns } = options;
  const bodyGuard = { preHandler: bodyPathSafetyHook(rootDir) };

  // GET /api/fs/tree
  app.get<{ Querystring: { depth?: string } }>('/tree', async (request) => {
    const depth = request.query.depth ? parseInt(request.query.depth, 10) : maxDepth;
    const tree = await buildTree(rootDir, rootDir, '', 0, depth, ignorePatterns);
    return { root: rootDir, tree };
  });

  // GET /api/fs/read
  app.get<{ Querystring: { path: string } }>('/read', async (request, reply) => {
    const filePath = safePath(rootDir, request.query.path);
    try {
      const stat = await fs.stat(filePath);
      if (stat.isDirectory()) {
        reply.code(400).send({ error: 'Path is a directory' });
        return;
      }

      // Return binary files as base64
      const content = await fs.readFile(filePath);
      const isText = isTextFile(filePath);

      if (isText) {
        return { content: content.toString('utf-8'), encoding: 'utf-8' };
      } else {
        return { content: content.toString('base64'), encoding: 'base64' };
      }
    } catch (err: unknown) {
      const e = err as NodeJS.ErrnoException;
      if (e.code === 'ENOENT') {
        reply.code(404).send({ error: 'File not found' });
      } else {
        reply.code(500).send({ error: String(err) });
      }
    }
  });

  // POST /api/fs/write
  app.post<{ Body: { path: string; content: string } }>('/write', bodyGuard, async (request, reply) => {
    if (readonly) return reply.code(403).send({ error: 'Read-only mode' });
    const filePath = safePath(rootDir, request.body.path);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, request.body.content, 'utf-8');
    return { ok: true };
  });

  // POST /api/fs/mkdir
  app.post<{ Body: { path: string } }>('/mkdir', bodyGuard, async (request, reply) => {
    if (readonly) return reply.code(403).send({ error: 'Read-only mode' });
    const dirPath = safePath(rootDir, request.body.path);
    await fs.mkdir(dirPath, { recursive: true });
    return { ok: true };
  });

  // DELETE /api/fs/delete
  app.delete<{ Body: { path: string } }>('/delete', bodyGuard, async (request, reply) => {
    if (readonly) return reply.code(403).send({ error: 'Read-only mode' });
    const targetPath = safePath(rootDir, request.body.path);
    await fs.rm(targetPath, { recursive: true, force: true });
    return { ok: true };
  });

  // POST /api/fs/rename
  app.post<{ Body: { oldPath: string; newPath: string } }>('/rename', bodyGuard, async (request, reply) => {
    if (readonly) return reply.code(403).send({ error: 'Read-only mode' });
    const oldPath = safePath(rootDir, request.body.oldPath);
    const newPath = safePath(rootDir, request.body.newPath);
    await fs.mkdir(path.dirname(newPath), { recursive: true });
    await fs.rename(oldPath, newPath);
    return { ok: true };
  });

  // GET /api/fs/stat
  app.get<{ Querystring: { path: string } }>('/stat', async (request, reply) => {
    const filePath = safePath(rootDir, request.query.path);
    try {
      const stat = await fs.stat(filePath);
      return {
        path: request.query.path,
        size: stat.size,
        modified: stat.mtime.toISOString(),
        created: stat.birthtime.toISOString(),
        isDirectory: stat.isDirectory(),
        isFile: stat.isFile(),
      };
    } catch {
      reply.code(404).send({ error: 'Not found' });
    }
  });

  // GET /api/fs/search
  app.get<{ Querystring: { q: string } }>('/search', async (request) => {
    const query = request.query.q.toLowerCase();
    const results: Array<{ path: string; type: 'file' | 'directory'; name: string }> = [];

    async function searchDir(dir: string, relBase: string, depth: number) {
      if (depth > maxDepth) return;
      let entries;
      try {
        entries = await fs.readdir(dir, { withFileTypes: true });
      } catch {
        return;
      }

      for (const entry of entries) {
        if (entry.name === 'node_modules' || entry.name === '.git') continue;
        const relPath = path.join(relBase, entry.name);
        if (entry.name.toLowerCase().includes(query)) {
          results.push({
            path: relPath,
            type: entry.isDirectory() ? 'directory' : 'file',
            name: entry.name,
          });
        }
        if (entry.isDirectory()) {
          await searchDir(path.join(dir, entry.name), relPath, depth + 1);
        }
        if (results.length >= 100) return;
      }
    }

    await searchDir(rootDir, '', 0);
    return { results, query };
  });
}

function isTextFile(filePath: string): boolean {
  const textExts = [
    '.txt', '.md', '.ts', '.tsx', '.js', '.jsx', '.json', '.yaml', '.yml',
    '.toml', '.env', '.sh', '.bash', '.zsh', '.css', '.scss', '.less',
    '.html', '.htm', '.xml', '.svg', '.vue', '.py', '.rb', '.go', '.rs',
    '.java', '.c', '.cpp', '.h', '.cs', '.php', '.sql', '.graphql', '.gql',
    '.dockerfile', '.gitignore', '.gitattributes', '.editorconfig', '.eslintrc',
    '.prettierrc', '.babelrc', '.lock', '.log',
  ];
  const ext = path.extname(filePath).toLowerCase();
  const basename = path.basename(filePath).toLowerCase();
  return textExts.includes(ext) || ['makefile', 'dockerfile', 'readme', 'license'].includes(basename);
}
