import { FastifyInstance } from 'fastify';
import path from 'path';
import { TreehousePlugin } from './types';

export async function loadPlugins(
  app: FastifyInstance,
  pluginPaths: string[],
  rootDir: string
): Promise<void> {
  for (const pluginPath of pluginPaths) {
    try {
      const resolved = pluginPath.startsWith('.')
        ? path.resolve(process.cwd(), pluginPath)
        : pluginPath;

      const mod = await import(resolved);
      const plugin: TreehousePlugin = mod.default ?? mod;

      if (plugin.onStart) {
        await plugin.onStart(rootDir);
      }

      if (plugin.registerRoutes) {
        plugin.registerRoutes(app, rootDir);
      }

      console.log(`  plugin loaded: ${plugin.name}@${plugin.version}`);
    } catch (err) {
      console.error(`  failed to load plugin: ${pluginPath}`, err);
    }
  }
}
