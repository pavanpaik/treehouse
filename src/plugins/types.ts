import { FastifyInstance } from 'fastify';

export interface TreehousePlugin {
  name: string;
  version: string;

  /** Server-side: register additional routes */
  registerRoutes?: (app: FastifyInstance, rootDir: string) => void;

  /**
   * Client-side: React component module path to render in plugin panel.
   * Passed as a module path that gets dynamically imported.
   */
  clientEntry?: string;

  /** Lifecycle hooks */
  onStart?: (rootDir: string) => void | Promise<void>;
  onStop?: () => void | Promise<void>;
}
