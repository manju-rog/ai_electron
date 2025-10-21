import React, { useEffect, useRef } from 'react';
import * as monaco from 'monaco-editor';

// Configure Monaco workers
(self as any).MonacoEnvironment = {
  getWorkerUrl: function (moduleId: string, label: string) {
    if (label === 'json') {
      return './monaco-editor/esm/vs/language/json/json.worker.js';
    }
    if (label === 'css' || label === 'scss' || label === 'less') {
      return './monaco-editor/esm/vs/language/css/css.worker.js';
    }
    if (label === 'html' || label === 'handlebars' || label === 'razor') {
      return './monaco-editor/esm/vs/language/html/html.worker.js';
    }
    if (label === 'typescript' || label === 'javascript') {
      return './monaco-editor/esm/vs/language/typescript/ts.worker.js';
    }
    return './monaco-editor/esm/vs/editor/editor.worker.js';
  }
};

type Props = {
  value: string;
  language?: string;
  onChange: (v: string) => void;
};

export const EditorMonaco: React.FC<Props> = ({ value, language = 'typescript', onChange }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    editorRef.current = monaco.editor.create(containerRef.current, {
      value,
      language,
      theme: 'vs-dark',
      automaticLayout: true,
      fontLigatures: true,
      fontSize: 13,
      minimap: { enabled: true },
      scrollBeyondLastLine: false
    });

    const sub = editorRef.current.onDidChangeModelContent(() => {
      onChange(editorRef.current!.getValue());
    });

    return () => {
      sub.dispose();
      editorRef.current?.dispose();
    };
  }, []);

  // Keep external value in sync if needed (light touch)
  useEffect(() => {
    const ed = editorRef.current;
    if (ed && ed.getValue() !== value) ed.setValue(value);
  }, [value]);

  return <div ref={containerRef} style={{ height: '100%' }} />;
};