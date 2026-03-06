import { useState, useCallback } from 'react';
import { FileNode } from '../lib/types';

interface FileTreeProps {
  nodes: FileNode[];
  selectedPath: string | null;
  onSelect: (node: FileNode) => void;
  onDelete: (path: string) => void;
  onRename: (path: string) => void;
  onNewFile: (dirPath: string) => void;
  onNewDir: (dirPath: string) => void;
}

interface NodeProps {
  node: FileNode;
  depth: number;
  selectedPath: string | null;
  onSelect: (node: FileNode) => void;
  onDelete: (path: string) => void;
  onRename: (path: string) => void;
  onNewFile: (dirPath: string) => void;
  onNewDir: (dirPath: string) => void;
}

function FileIcon({ type, name }: { type: 'file' | 'directory'; name: string }) {
  if (type === 'directory') return <span className="icon">📁</span>;

  const ext = name.split('.').pop()?.toLowerCase();
  const icons: Record<string, string> = {
    ts: '🔷', tsx: '🔷', js: '🟡', jsx: '🟡', json: '📋',
    md: '📝', css: '🎨', scss: '🎨', html: '🌐', py: '🐍',
    rs: '🦀', go: '🐹', sh: '⚙️', yaml: '⚙️', yml: '⚙️',
    png: '🖼️', jpg: '🖼️', jpeg: '🖼️', gif: '🖼️', svg: '🖼️',
  };
  return <span className="icon">{icons[ext ?? ''] ?? '📄'}</span>;
}

function TreeNode({
  node, depth, selectedPath, onSelect, onDelete, onRename, onNewFile, onNewDir,
}: NodeProps) {
  const [expanded, setExpanded] = useState(depth < 2);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

  const isSelected = selectedPath === node.path;
  const indent = depth * 16;

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY });
  }, []);

  const closeMenu = useCallback(() => setContextMenu(null), []);

  return (
    <div className="tree-node">
      <div
        className={`tree-item ${isSelected ? 'selected' : ''}`}
        style={{ paddingLeft: `${indent + 8}px` }}
        onClick={() => {
          if (node.type === 'directory') {
            setExpanded((e) => !e);
          } else {
            onSelect(node);
          }
        }}
        onContextMenu={handleContextMenu}
      >
        {node.type === 'directory' && (
          <span className="expand-icon">{expanded ? '▾' : '▸'}</span>
        )}
        {node.type === 'file' && <span className="expand-icon" style={{ opacity: 0 }}>▸</span>}
        <FileIcon type={node.type} name={node.name} />
        <span className="node-name">{node.name}</span>
      </div>

      {contextMenu && (
        <>
          <div className="context-overlay" onClick={closeMenu} />
          <div className="context-menu" style={{ top: contextMenu.y, left: contextMenu.x }}>
            {node.type === 'directory' && (
              <>
                <button onClick={() => { onNewFile(node.path); closeMenu(); }}>New File</button>
                <button onClick={() => { onNewDir(node.path); closeMenu(); }}>New Folder</button>
                <hr />
              </>
            )}
            <button onClick={() => { onRename(node.path); closeMenu(); }}>Rename</button>
            <button className="danger" onClick={() => { onDelete(node.path); closeMenu(); }}>
              Delete
            </button>
          </div>
        </>
      )}

      {node.type === 'directory' && expanded && node.children && (
        <div className="tree-children">
          {node.children.map((child) => (
            <TreeNode
              key={child.path}
              node={child}
              depth={depth + 1}
              selectedPath={selectedPath}
              onSelect={onSelect}
              onDelete={onDelete}
              onRename={onRename}
              onNewFile={onNewFile}
              onNewDir={onNewDir}
            />
          ))}
          {node.children.length === 0 && (
            <div className="tree-empty" style={{ paddingLeft: `${indent + 32}px` }}>
              empty
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function FileTree({ nodes, selectedPath, onSelect, onDelete, onRename, onNewFile, onNewDir }: FileTreeProps) {
  return (
    <div className="file-tree">
      {nodes.map((node) => (
        <TreeNode
          key={node.path}
          node={node}
          depth={0}
          selectedPath={selectedPath}
          onSelect={onSelect}
          onDelete={onDelete}
          onRename={onRename}
          onNewFile={onNewFile}
          onNewDir={onNewDir}
        />
      ))}
      {nodes.length === 0 && <div className="tree-empty">No files found</div>}
    </div>
  );
}
