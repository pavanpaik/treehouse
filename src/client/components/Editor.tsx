import { useEffect, useRef, useState } from 'react';

interface EditorProps {
  path: string | null;
  content: string;
  onChange: (content: string) => void;
  onSave: () => void;
  isDirty: boolean;
}

function getLanguage(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase() ?? '';
  const map: Record<string, string> = {
    ts: 'typescript', tsx: 'typescript', js: 'javascript', jsx: 'javascript',
    json: 'json', md: 'markdown', css: 'css', scss: 'scss', less: 'less',
    html: 'html', xml: 'xml', yaml: 'yaml', yml: 'yaml', sh: 'shell',
    bash: 'shell', py: 'python', rs: 'rust', go: 'go', java: 'java',
    c: 'c', cpp: 'cpp', cs: 'csharp', rb: 'ruby', php: 'php',
    sql: 'sql', graphql: 'graphql', toml: 'ini', dockerfile: 'dockerfile',
  };
  return map[ext] ?? 'plaintext';
}

export function Editor({ path, content, onChange, onSave, isDirty }: EditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const editorRef = useRef<any>(null);
  const [monacoLoaded, setMonacoLoaded] = useState(false);
  // Keep callback refs so Monaco's listener always calls the latest version
  const onChangeRef = useRef(onChange);
  const onSaveRef = useRef(onSave);
  onChangeRef.current = onChange;
  onSaveRef.current = onSave;

  // Initialize Monaco once. Container is always rendered so ref is always populated.
  useEffect(() => {
    let cancelled = false;

    import('../lib/monaco').then(({ monaco }) => {
      if (cancelled || !containerRef.current || editorRef.current) return;

      const editor = monaco.editor.create(containerRef.current, {
        value: '',
        language: 'plaintext',
        theme: 'vs-dark',
        fontSize: 14,
        fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
        minimap: { enabled: true },
        scrollBeyondLastLine: false,
        automaticLayout: true,
        tabSize: 2,
        wordWrap: 'on',
        padding: { top: 12 },
      });

      // Use refs so these listeners always see the latest callbacks
      editor.onDidChangeModelContent(() => {
        onChangeRef.current(editor.getValue());
      });
      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
        onSaveRef.current();
      });

      editorRef.current = editor;
      setMonacoLoaded(true);
    }).catch(err => {
      console.error('Monaco failed to load:', err);
    });

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync content when file changes
  useEffect(() => {
    if (!monacoLoaded || !editorRef.current) return;
    if (editorRef.current.getValue() !== content) {
      editorRef.current.setValue(content);
    }
  }, [content, monacoLoaded]);

  // Update language when file path changes
  useEffect(() => {
    if (!monacoLoaded || !editorRef.current || !path) return;
    import('../lib/monaco').then(({ monaco }) => {
      monaco.editor.setModelLanguage(editorRef.current.getModel(), getLanguage(path));
    });
  }, [path, monacoLoaded]);

  // Always render the container so the ref is populated when Monaco initializes.
  return (
    <div className="editor-root">
      {!path && (
        <div className="editor-empty">
          <div className="editor-empty-content">
            <div className="editor-empty-icon">🌳</div>
            <h2>treehouse</h2>
            <p>Select a file from the sidebar to start editing</p>
            <p className="editor-empty-hint">Right-click in the tree to create files</p>
          </div>
        </div>
      )}
      <div className="editor-wrapper" style={{ display: path ? 'flex' : 'none' }}>
        <div className="editor-header">
          <span className="editor-path">{path ?? ''}</span>
          {isDirty && <span className="editor-dirty">●</span>}
          <button className="editor-save-btn" onClick={onSave} disabled={!isDirty}>
            Save
          </button>
        </div>
        <div ref={containerRef} className="monaco-container" />
        {!monacoLoaded && (
          <div className="editor-loading">Loading editor...</div>
        )}
      </div>
    </div>
  );
}
