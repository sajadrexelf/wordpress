import React, { useEffect, useState } from 'react';
import Editor from '@monaco-editor/react';
import { db, File } from '../db';

interface CodeEditorProps {
  file: File | null;
}

export function CodeEditor({ file }: CodeEditorProps) {
  const [content, setContent] = useState('');

  useEffect(() => {
    if (file) {
      setContent(file.content);
    } else {
      setContent('');
    }
  }, [file?.id]);

  const handleEditorChange = async (value: string | undefined) => {
    if (value !== undefined && file?.id) {
      setContent(value);
      await db.files.update(file.id, {
        content: value,
        updatedAt: Date.now()
      });
    }
  };

  if (!file) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-950 text-slate-500">
        Select a file to start editing
      </div>
    );
  }

  const language = file.path.endsWith('.php') ? 'php' :
                   file.path.endsWith('.js') ? 'javascript' :
                   file.path.endsWith('.css') ? 'css' :
                   file.path.endsWith('.json') ? 'json' :
                   file.path.endsWith('.html') ? 'html' : 'plaintext';

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-950">
      <div className="h-10 bg-slate-900 border-b border-slate-800 flex items-center px-4 text-sm text-slate-400 font-mono">
        {file.path}
      </div>
      <div className="flex-1 relative">
        <Editor
          height="100%"
          language={language}
          theme="vs-dark"
          value={content}
          onChange={handleEditorChange}
          options={{
            minimap: { enabled: false },
            fontSize: 14,
            wordWrap: 'on',
            padding: { top: 16 },
            scrollBeyondLastLine: false,
          }}
        />
      </div>
    </div>
  );
}
