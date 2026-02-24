/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { CodeEditor } from './components/CodeEditor';
import { Chat } from './components/Chat';
import { SettingsModal } from './components/SettingsModal';
import { db, File, Settings, Project } from './db';
import { useLiveQuery } from 'dexie-react-hooks';

export default function App() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [activeProject, setActiveProject] = useState<Project | null>(null);

  const settings = useLiveQuery(() => db.settings.get(1));
  const projects = useLiveQuery(() => db.projects.toArray());

  // Initialize default data if empty
  useEffect(() => {
    const initDb = async () => {
      const settingsCount = await db.settings.count();
      if (settingsCount === 0) {
        await db.settings.add({
          id: 1,
          provider: 'gemini',
          apiKey: '',
          modelName: 'gemini-2.5-flash',
          ollamaUrl: 'http://localhost:11434'
        });
      }

      const projectsCount = await db.projects.count();
      if (projectsCount === 0) {
        const id = await db.projects.add({
          name: 'my-first-plugin',
          createdAt: Date.now(),
          updatedAt: Date.now()
        });
        await db.files.add({
          projectId: id,
          path: 'my-first-plugin/my-first-plugin.php',
          content: `<?php\n/*\nPlugin Name: My First Plugin\nDescription: A custom WordPress plugin.\nVersion: 1.0.0\nAuthor: AI Builder\nLicense: GPLv2 or later\n*/\n\nif ( ! defined( 'ABSPATH' ) ) {\n\texit; // Exit if accessed directly.\n}\n\n// Your code starts here.\n`,
          createdAt: Date.now(),
          updatedAt: Date.now()
        });
      }
    };
    initDb();
  }, []);

  useEffect(() => {
    if (selectedFile) {
      const project = projects?.find(p => p.id === selectedFile.projectId);
      setActiveProject(project || null);
    } else if (projects && projects.length > 0) {
      setActiveProject(projects[0]);
    } else {
      setActiveProject(null);
    }
  }, [selectedFile, projects]);

  const handleFilesUpdated = async () => {
    if (selectedFile) {
      const updatedFile = await db.files.get(selectedFile.id!);
      if (updatedFile) {
        setSelectedFile(updatedFile);
      }
    }
  };

  return (
    <div className="flex h-screen w-full bg-slate-950 text-slate-300 font-sans overflow-hidden">
      <Sidebar 
        onSelectFile={setSelectedFile} 
        onOpenSettings={() => setIsSettingsOpen(true)} 
        currentFileId={selectedFile?.id}
      />
      
      <main className="flex-1 flex flex-col min-w-0">
        <CodeEditor file={selectedFile} />
      </main>

      {settings && (
        <Chat 
          settings={settings} 
          activeProject={activeProject} 
          onFilesUpdated={handleFilesUpdated}
        />
      )}

      {isSettingsOpen && settings && (
        <SettingsModal 
          settings={settings} 
          onClose={() => setIsSettingsOpen(false)} 
        />
      )}
    </div>
  );
}
