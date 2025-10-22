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
  original?: string;
  diff?: boolean;
};

export const EditorMonaco: React.FC<Props> = ({ value, language = 'typescript', onChange, original, diff }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | monaco.editor.IStandaloneDiffEditor | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    if (diff && original !== undefined) {
      // Create diff editor
      const diffEditor = monaco.editor.createDiffEditor(containerRef.current, {
        theme: 'vs-dark',
        automaticLayout: true,
        fontSize: 13,
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        readOnly: true
      });

      const originalModel = monaco.editor.createModel(original, language);
      const modifiedModel = monaco.editor.createModel(value, language);

      diffEditor.setModel({
        original: originalModel,
        modified: modifiedModel
      });

      editorRef.current = diffEditor;

      return () => {
        originalModel.dispose();
        modifiedModel.dispose();
        diffEditor.dispose();
      };
    } else {
      // Create regular editor
      const editor = monaco.editor.create(containerRef.current, {
        value,
        language,
        theme: 'vs-dark',
        automaticLayout: true,
        fontLigatures: true,
        fontSize: 13,
        minimap: { enabled: true },
        scrollBeyondLastLine: false
      });

      const sub = editor.onDidChangeModelContent(() => {
        onChange(editor.getValue());
      });

      editorRef.current = editor;

      return () => {
        sub.dispose();
        editor.dispose();
      };
    }
  }, [diff, original]);

  // Keep external value in sync for regular editor
  useEffect(() => {
    if (!diff && editorRef.current && 'getValue' in editorRef.current) {
      const ed = editorRef.current as monaco.editor.IStandaloneCodeEditor;
      if (ed.getValue() !== value) ed.setValue(value);
    }
  }, [value, diff]);

  return <div ref={containerRef} style={{ height: '100%' }} />;
};