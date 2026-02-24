import Dexie, { Table } from 'dexie';

export interface Project {
  id?: number;
  name: string;
  createdAt: number;
  updatedAt: number;
}

export interface File {
  id?: number;
  projectId: number;
  path: string;
  content: string;
  createdAt: number;
  updatedAt: number;
}

export interface Settings {
  id?: number;
  provider: 'gemini' | 'openai' | 'openrouter' | 'ollama';
  apiKey: string;
  modelName: string;
  ollamaUrl: string;
}

export class WPPluginDB extends Dexie {
  projects!: Table<Project>;
  files!: Table<File>;
  settings!: Table<Settings>;

  constructor() {
    super('WPPluginDB');
    this.version(1).stores({
      projects: '++id, name, createdAt, updatedAt',
      files: '++id, projectId, path, [projectId+path]',
      settings: '++id, provider'
    });
  }
}

export const db = new WPPluginDB();

// Initialize default settings if not exists
db.on('populate', () => {
  db.settings.add({
    id: 1,
    provider: 'gemini',
    apiKey: '',
    modelName: 'gemini-2.5-flash',
    ollamaUrl: 'http://localhost:11434'
  });
});
