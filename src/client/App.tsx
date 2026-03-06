import { useEffect, useState, useCallback } from 'react';
import { FileTree } from './components/FileTree';
import { Editor } from './components/Editor';
import { Toolbar } from './components/Toolbar';
import { useFileSystem } from './hooks/useFileSystem';
import { useWebSocket } from './hooks/useWebSocket';
import { FileNode, SearchResult } from './lib/types';
import { api } from './lib/api';

export function App() {
  const {
    tree, loading, error,
    refreshTree, readFile, writeFile,
    createFile, createDir, deleteItem, renameItem,
  } = useFileSystem();

  const [selectedNode, setSelectedNode] = useState<FileNode | null>(null);
  const [editorContent, setEditorContent] = useState('');
  const [savedContent, setSavedContent] = useState('');
  const [isDirty, setIsDirty] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[] | null>(null);
  const [notification, setNotification] = useState<string | null>(null);

  // Load tree on mount
  useEffect(() => {
    refreshTree();
  }, [refreshTree]);

  // WebSocket for live updates
  useWebSocket(useCallback((event) => {
    if (['file:created', 'file:deleted', 'dir:created', 'dir:deleted'].includes(event.type)) {
      refreshTree();
    }
    if (event.type === 'file:changed' && selectedNode?.path === event.path) {
      // Reload file if not dirty
      if (!isDirty) {
        readFile(event.path).then((fc) => {
          if (fc) {
            setEditorContent(fc.content);
            setSavedContent(fc.content);
          }
        });
      }
    }
  }, [refreshTree, selectedNode, isDirty, readFile]));

  // Search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults(null);
      return;
    }
    const timer = setTimeout(async () => {
      const data = await api.search(searchQuery);
      setSearchResults(data.results);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const showNotification = useCallback((msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3000);
  }, []);

  const handleSelectFile = useCallback(async (node: FileNode) => {
    if (isDirty && selectedNode) {
      const ok = window.confirm('You have unsaved changes. Discard them?');
      if (!ok) return;
    }
    setSelectedNode(node);
    const fc = await readFile(node.path);
    if (fc) {
      setEditorContent(fc.content);
      setSavedContent(fc.content);
      setIsDirty(false);
    }
  }, [isDirty, selectedNode, readFile]);

  const handleEditorChange = useCallback((content: string) => {
    setEditorContent(content);
    setIsDirty(content !== savedContent);
  }, [savedContent]);

  const handleSave = useCallback(async () => {
    if (!selectedNode) return;
    const ok = await writeFile(selectedNode.path, editorContent);
    if (ok) {
      setSavedContent(editorContent);
      setIsDirty(false);
      showNotification('Saved');
    }
  }, [selectedNode, editorContent, writeFile, showNotification]);

  const handleNewFile = useCallback(async (dirPath: string) => {
    const name = window.prompt('File name:');
    if (!name) return;
    const fullPath = dirPath ? `${dirPath}/${name}` : name;
    await createFile(fullPath);
    showNotification(`Created ${fullPath}`);
  }, [createFile, showNotification]);

  const handleNewDir = useCallback(async (dirPath: string) => {
    const name = window.prompt('Folder name:');
    if (!name) return;
    const fullPath = dirPath ? `${dirPath}/${name}` : name;
    await createDir(fullPath);
    showNotification(`Created ${fullPath}`);
  }, [createDir, showNotification]);

  const handleDelete = useCallback(async (path: string) => {
    const ok = window.confirm(`Delete "${path}"? This cannot be undone.`);
    if (!ok) return;
    await deleteItem(path);
    if (selectedNode?.path === path) {
      setSelectedNode(null);
      setEditorContent('');
      setSavedContent('');
      setIsDirty(false);
    }
    showNotification(`Deleted ${path}`);
  }, [deleteItem, selectedNode, showNotification]);

  const handleRename = useCallback(async (oldPath: string) => {
    const newName = window.prompt('New name:', oldPath.split('/').pop());
    if (!newName) return;
    const parts = oldPath.split('/');
    parts[parts.length - 1] = newName;
    const newPath = parts.join('/');
    await renameItem(oldPath, newPath);
    if (selectedNode?.path === oldPath) {
      setSelectedNode((n) => n ? { ...n, path: newPath, name: newName } : null);
    }
    showNotification(`Renamed to ${newName}`);
  }, [renameItem, selectedNode, showNotification]);

  return (
    <div className="app">
      <aside className="sidebar">
        <Toolbar
          onNewFile={handleNewFile}
          onNewDir={handleNewDir}
          onRefresh={refreshTree}
          onSearch={setSearchQuery}
          searchQuery={searchQuery}
        />

        {error && <div className="error-banner">{error}</div>}
        {loading && <div className="loading-indicator">Loading...</div>}

        {searchResults !== null ? (
          <div className="search-results">
            <div className="search-results-header">
              {searchResults.length} result{searchResults.length !== 1 ? 's' : ''}
            </div>
            {searchResults.map((r) => (
              <div
                key={r.path}
                className={`search-result ${selectedNode?.path === r.path ? 'selected' : ''}`}
                onClick={() => {
                  if (r.type === 'file') {
                    handleSelectFile({ name: r.name, path: r.path, type: r.type });
                  }
                }}
              >
                <span>{r.type === 'directory' ? '📁' : '📄'}</span>
                <span className="search-result-name">{r.name}</span>
                <span className="search-result-path">{r.path}</span>
              </div>
            ))}
          </div>
        ) : (
          <FileTree
            nodes={tree}
            selectedPath={selectedNode?.path ?? null}
            onSelect={handleSelectFile}
            onDelete={handleDelete}
            onRename={handleRename}
            onNewFile={handleNewFile}
            onNewDir={handleNewDir}
          />
        )}
      </aside>

      <main className="main-content">
        <Editor
          path={selectedNode?.path ?? null}
          content={editorContent}
          onChange={handleEditorChange}
          onSave={handleSave}
          isDirty={isDirty}
        />
      </main>

      {notification && (
        <div className="notification">{notification}</div>
      )}
    </div>
  );
}
