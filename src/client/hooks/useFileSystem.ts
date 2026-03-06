import { useState, useCallback } from 'react';
import { api } from '../lib/api';
import { FileNode, FileContent } from '../lib/types';

export function useFileSystem() {
  const [tree, setTree] = useState<FileNode[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshTree = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.tree();
      setTree(data.tree);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  const readFile = useCallback(async (path: string): Promise<FileContent | null> => {
    try {
      return await api.read(path);
    } catch (e) {
      setError(String(e));
      return null;
    }
  }, []);

  const writeFile = useCallback(async (path: string, content: string): Promise<boolean> => {
    try {
      await api.write(path, content);
      return true;
    } catch (e) {
      setError(String(e));
      return false;
    }
  }, []);

  const createFile = useCallback(
    async (path: string): Promise<boolean> => {
      try {
        await api.write(path, '');
        await refreshTree();
        return true;
      } catch (e) {
        setError(String(e));
        return false;
      }
    },
    [refreshTree]
  );

  const createDir = useCallback(
    async (path: string): Promise<boolean> => {
      try {
        await api.mkdir(path);
        await refreshTree();
        return true;
      } catch (e) {
        setError(String(e));
        return false;
      }
    },
    [refreshTree]
  );

  const deleteItem = useCallback(
    async (path: string): Promise<boolean> => {
      try {
        await api.delete(path);
        await refreshTree();
        return true;
      } catch (e) {
        setError(String(e));
        return false;
      }
    },
    [refreshTree]
  );

  const renameItem = useCallback(
    async (oldPath: string, newPath: string): Promise<boolean> => {
      try {
        await api.rename(oldPath, newPath);
        await refreshTree();
        return true;
      } catch (e) {
        setError(String(e));
        return false;
      }
    },
    [refreshTree]
  );

  return {
    tree,
    loading,
    error,
    refreshTree,
    readFile,
    writeFile,
    createFile,
    createDir,
    deleteItem,
    renameItem,
  };
}
