import React, { useState, useRef, useEffect } from 'react';
import { Send, Loader2, Bot, User } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { ChatMessage, streamAIResponse } from '../services/ai';
import { db, Settings, Project } from '../db';
import { WP_PLUGIN_GUIDELINES } from '../constants';

interface ChatProps {
  settings: Settings;
  activeProject: Project | null;
  onFilesUpdated: () => void;
}

export function Chat({ settings, activeProject, onFilesUpdated }: ChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const parseAndApplyFileChanges = async (content: string, projectId: number) => {
    const fileRegex = /<file\s+path="([^"]+)">([\s\S]*?)<\/file>/g;
    let match;
    let updated = false;

    while ((match = fileRegex.exec(content)) !== null) {
      const path = match[1];
      const fileContent = match[2].trim();

      const existingFile = await db.files.where({ projectId, path }).first();
      if (existingFile) {
        await db.files.update(existingFile.id!, { content: fileContent, updatedAt: Date.now() });
      } else {
        await db.files.add({ projectId, path, content: fileContent, createdAt: Date.now(), updatedAt: Date.now() });
      }
      updated = true;
    }

    if (updated) {
      onFilesUpdated();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading || !activeProject) return;

    const userMessage: ChatMessage = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      // Gather context
      const projectFiles = await db.files.where('projectId').equals(activeProject.id!).toArray();
      const contextMessage = `Current project files:\n\n${projectFiles.map(f => `--- ${f.path} ---\n${f.content}\n`).join('\n')}`;

      const fullMessages: ChatMessage[] = [
        { role: 'system', content: WP_PLUGIN_GUIDELINES },
        { role: 'system', content: contextMessage },
        ...messages,
        userMessage
      ];

      setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

      let fullResponse = '';
      for await (const chunk of streamAIResponse(fullMessages, settings)) {
        fullResponse += chunk;
        setMessages(prev => {
          const newMessages = [...prev];
          newMessages[newMessages.length - 1].content = fullResponse;
          return newMessages;
        });
      }

      await parseAndApplyFileChanges(fullResponse, activeProject.id!);

    } catch (error: any) {
      setMessages(prev => [...prev, { role: 'assistant', content: `**Error:** ${error.message}` }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-96 bg-slate-900 border-l border-slate-800 flex flex-col h-full">
      <div className="h-14 border-b border-slate-800 flex items-center px-4">
        <h3 className="font-semibold text-slate-200 flex items-center gap-2">
          <Bot size={18} className="text-emerald-400" />
          AI Assistant
        </h3>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-slate-500 mt-10 text-sm">
            Ask the AI to generate or modify your WordPress plugin.
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${msg.role === 'user' ? 'bg-indigo-500' : 'bg-emerald-600'}`}>
              {msg.role === 'user' ? <User size={16} className="text-white" /> : <Bot size={16} className="text-white" />}
            </div>
            <div className={`max-w-[80%] rounded-xl p-3 text-sm ${msg.role === 'user' ? 'bg-indigo-500/20 text-indigo-100' : 'bg-slate-800 text-slate-300'}`}>
              <div className="markdown-body prose prose-invert prose-sm max-w-none">
                <ReactMarkdown>{msg.content}</ReactMarkdown>
              </div>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center shrink-0">
              <Bot size={16} className="text-white" />
            </div>
            <div className="bg-slate-800 rounded-xl p-3 flex items-center">
              <Loader2 size={16} className="animate-spin text-emerald-400" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 border-t border-slate-800 bg-slate-900">
        <form onSubmit={handleSubmit} className="relative">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
            placeholder={activeProject ? "Ask AI to write code..." : "Create a project first..."}
            disabled={!activeProject || isLoading}
            className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-4 pr-12 py-3 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 resize-none"
            rows={3}
          />
          <button
            type="submit"
            disabled={!input.trim() || !activeProject || isLoading}
            className="absolute right-3 bottom-3 p-1.5 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Send size={16} />
          </button>
        </form>
      </div>
    </div>
  );
}
