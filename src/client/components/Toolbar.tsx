import { useState } from 'react';

interface ToolbarProps {
  onNewFile: (dirPath: string) => void;
  onNewDir: (dirPath: string) => void;
  onRefresh: () => void;
  onSearch: (q: string) => void;
  searchQuery: string;
}

export function Toolbar({ onNewFile, onNewDir, onRefresh, onSearch, searchQuery }: ToolbarProps) {
  const [showSearch, setShowSearch] = useState(false);

  return (
    <div className="toolbar">
      <span className="toolbar-title">🌳 treehouse</span>
      <div className="toolbar-actions">
        <button
          className="toolbar-btn"
          title="New File"
          onClick={() => onNewFile('')}
        >
          +📄
        </button>
        <button
          className="toolbar-btn"
          title="New Folder"
          onClick={() => onNewDir('')}
        >
          +📁
        </button>
        <button
          className="toolbar-btn"
          title="Search"
          onClick={() => setShowSearch((s) => !s)}
        >
          🔍
        </button>
        <button
          className="toolbar-btn"
          title="Refresh"
          onClick={onRefresh}
        >
          ↻
        </button>
      </div>
      {showSearch && (
        <div className="toolbar-search">
          <input
            type="text"
            placeholder="Search files..."
            value={searchQuery}
            onChange={(e) => onSearch(e.target.value)}
            autoFocus
          />
        </div>
      )}
    </div>
  );
}
