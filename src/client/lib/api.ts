import { FileContent, FileNode, SearchResult } from './types';

const BASE = '/api/fs';

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    ...init,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error ?? res.statusText);
  }
  return res.json() as Promise<T>;
}

export const api = {
  tree: (depth?: number): Promise<{ root: string; tree: FileNode[] }> =>
    request(`${BASE}/tree${depth !== undefined ? `?depth=${depth}` : ''}`),

  read: (path: string): Promise<FileContent> =>
    request(`${BASE}/read?path=${encodeURIComponent(path)}`),

  write: (path: string, content: string): Promise<{ ok: boolean }> =>
    request(`${BASE}/write`, {
      method: 'POST',
      body: JSON.stringify({ path, content }),
    }),

  mkdir: (path: string): Promise<{ ok: boolean }> =>
    request(`${BASE}/mkdir`, {
      method: 'POST',
      body: JSON.stringify({ path }),
    }),

  delete: (path: string): Promise<{ ok: boolean }> =>
    request(`${BASE}/delete`, {
      method: 'DELETE',
      body: JSON.stringify({ path }),
    }),

  rename: (oldPath: string, newPath: string): Promise<{ ok: boolean }> =>
    request(`${BASE}/rename`, {
      method: 'POST',
      body: JSON.stringify({ oldPath, newPath }),
    }),

  stat: (path: string) =>
    request<{
      path: string;
      size: number;
      modified: string;
      created: string;
      isDirectory: boolean;
      isFile: boolean;
    }>(`${BASE}/stat?path=${encodeURIComponent(path)}`),

  search: (q: string): Promise<{ results: SearchResult[]; query: string }> =>
    request(`${BASE}/search?q=${encodeURIComponent(q)}`),
};
