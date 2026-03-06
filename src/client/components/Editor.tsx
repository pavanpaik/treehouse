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
  const editorRef = useRef<unknown>(null);
  const [monacoLoaded, setMonacoLoaded] = useState(false);

  // Lazy-load Monaco
  useEffect(() => {
    let cancelled = false;

    import('monaco-editor').then((monaco) => {
      if (cancelled || !containerRef.current || editorRef.current) return;

      const editor = monaco.editor.create(containerRef.current, {
        value: content,
        language: path ? getLanguage(path) : 'plaintext',
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

      editor.onDidChangeModelContent(() => {
        onChange(editor.getValue());
      });

      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, onSave);

      editorRef.current = editor;
      setMonacoLoaded(true);
    });

    return () => {
      cancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update content when file changes
  useEffect(() => {
    if (!monacoLoaded || !editorRef.current) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const editor = editorRef.current as any;
    const current = editor.getValue();
    if (current !== content) {
      editor.setValue(content);
    }
  }, [content, monacoLoaded]);

  // Update language when file changes
  useEffect(() => {
    if (!monacoLoaded || !editorRef.current || !path) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const editor = editorRef.current as any;
    import('monaco-editor').then((monaco) => {
      monaco.editor.setModelLanguage(editor.getModel(), getLanguage(path));
    });
  }, [path, monacoLoaded]);

  // Update save handler when it changes
  useEffect(() => {
    if (!monacoLoaded || !editorRef.current) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const editor = editorRef.current as any;
    import('monaco-editor').then((monaco) => {
      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, onSave);
    });
  }, [onSave, monacoLoaded]);

  if (!path) {
    return (
      <div className="editor-empty">
        <div className="editor-empty-content">
          <div className="editor-empty-icon">🌳</div>
          <h2>treehouse</h2>
          <p>Select a file from the sidebar to start editing</p>
          <p className="editor-empty-hint">Right-click in the tree to create files</p>
        </div>
      </div>
    );
  }

  return (
    <div className="editor-wrapper">
      <div className="editor-header">
        <span className="editor-path">{path}</span>
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
  );
}
