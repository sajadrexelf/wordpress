import React, { useState, useEffect } from 'react';
import { db, Project, File, Settings } from '../db';
import { useLiveQuery } from 'dexie-react-hooks';
import { Folder, File as FileIcon, Settings as SettingsIcon, Plus, Download, Trash2 } from 'lucide-react';
import JSZip from 'jszip';

interface SidebarProps {
  onSelectFile: (file: File) => void;
  onOpenSettings: () => void;
  currentFileId?: number;
}

export function Sidebar({ onSelectFile, onOpenSettings, currentFileId }: SidebarProps) {
  const projects = useLiveQuery(() => db.projects.toArray());
  const files = useLiveQuery(() => db.files.toArray());
  const [activeProjectId, setActiveProjectId] = useState<number | null>(null);

  useEffect(() => {
    if (projects && projects.length > 0 && !activeProjectId) {
      setActiveProjectId(projects[0].id!);
    }
  }, [projects]);

  const handleCreateProject = async () => {
    const name = prompt('Enter project name (e.g., my-awesome-plugin):');
    if (name) {
      const id = await db.projects.add({
        name,
        createdAt: Date.now(),
        updatedAt: Date.now()
      });
      setActiveProjectId(id);
      
      // Create main plugin file
      await db.files.add({
        projectId: id,
        path: `${name}/${name}.php`,
        content: `<?php\n/*\nPlugin Name: ${name}\nDescription: A custom WordPress plugin.\nVersion: 1.0.0\nAuthor: AI Builder\nLicense: GPLv2 or later\n*/\n\nif ( ! defined( 'ABSPATH' ) ) {\n\texit; // Exit if accessed directly.\n}\n\n// Your code starts here.\n`,
        createdAt: Date.now(),
        updatedAt: Date.now()
      });
    }
  };

  const handleDeleteProject = async (id: number) => {
    if (confirm('Are you sure you want to delete this project?')) {
      await db.projects.delete(id);
      await db.files.where('projectId').equals(id).delete();
      if (activeProjectId === id) {
        setActiveProjectId(null);
      }
    }
  };

  const handleExport = async (projectId: number, projectName: string) => {
    try {
      const projectFiles = await db.files.where('projectId').equals(projectId).toArray();
      const zip = new JSZip();
      
      projectFiles.forEach(f => {
        zip.file(f.path, f.content);
      });

      const content = await zip.generateAsync({ type: 'blob' });
      
      const url = URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${projectName}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export failed", err);
      alert("Export failed. Check console for details.");
    }
  };

  const projectFiles = files?.filter(f => f.projectId === activeProjectId) || [];

  return (
    <div className="w-64 bg-slate-900 text-slate-300 flex flex-col h-full border-r border-slate-800">
      <div className="p-4 flex items-center justify-between border-b border-slate-800">
        <h2 className="font-semibold text-white">WP Builder</h2>
        <div className="flex gap-2">
          <button onClick={handleCreateProject} className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white" title="New Project">
            <Plus size={18} />
          </button>
          <button onClick={onOpenSettings} className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white" title="Settings">
            <SettingsIcon size={18} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {projects?.map(p => (
          <div key={p.id} className="mb-4">
            <div 
              className={`flex items-center justify-between p-2 rounded cursor-pointer ${activeProjectId === p.id ? 'bg-slate-800 text-white' : 'hover:bg-slate-800/50'}`}
              onClick={() => setActiveProjectId(p.id!)}
            >
              <div className="flex items-center gap-2">
                <Folder size={16} className="text-blue-400" />
                <span className="text-sm font-medium truncate w-32">{p.name}</span>
              </div>
              <div className="flex gap-1">
                <button onClick={(e) => { e.stopPropagation(); handleExport(p.id!, p.name); }} className="p-1 hover:text-emerald-400" title="Export ZIP">
                  <Download size={14} />
                </button>
                <button onClick={(e) => { e.stopPropagation(); handleDeleteProject(p.id!); }} className="p-1 hover:text-red-400" title="Delete">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
            
            {activeProjectId === p.id && (
              <div className="ml-4 mt-1 space-y-1">
                {projectFiles.map(f => (
                  <div 
                    key={f.id}
                    className={`flex items-center gap-2 p-1.5 rounded cursor-pointer text-sm ${currentFileId === f.id ? 'bg-indigo-500/20 text-indigo-300' : 'hover:bg-slate-800/50 text-slate-400'}`}
                    onClick={() => onSelectFile(f)}
                  >
                    <FileIcon size={14} />
                    <span className="truncate">{f.path.replace(`${p.name}/`, '')}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
