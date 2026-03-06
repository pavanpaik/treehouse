export interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileNode[];
  size?: number;
  modified?: string;
}

export interface FileContent {
  content: string;
  encoding: 'utf-8' | 'base64';
}

export interface WsEvent {
  type: 'file:created' | 'file:changed' | 'file:deleted' | 'dir:created' | 'dir:deleted';
  path: string;
}

export interface SearchResult {
  path: string;
  type: 'file' | 'directory';
  name: string;
}
