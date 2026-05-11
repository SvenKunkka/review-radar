import { contextBridge, ipcRenderer } from 'electron'
import type { SearchOptions, SearchFilters, ExportOptions, SearchProgress } from '../types/index'

contextBridge.exposeInMainWorld('electronAPI', {
  // --- Existing ---
  startSearch: (options: SearchOptions) => ipcRenderer.invoke('search:start', options),
  getJobs: () => ipcRenderer.invoke('search:getJobs'),
  getReviews: (jobId: string, filters?: SearchFilters) => ipcRenderer.invoke('reviews:get', jobId, filters),
  getAnalysis: (jobId: string) => ipcRenderer.invoke('analysis:get', jobId),
  exportResults: (options: ExportOptions) => ipcRenderer.invoke('export:results', options),
  onProgress: (callback: (progress: SearchProgress) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, progress: SearchProgress) => callback(progress)
    ipcRenderer.on('search:progress', listener)
    return () => ipcRenderer.removeListener('search:progress', listener)
  },

  // --- Projects ---
  getProjects: () => ipcRenderer.invoke('projects:getAll'),
  getProjectReviews: (projectId: string, filters?: SearchFilters) => ipcRenderer.invoke('projects:getReviews', projectId, filters),
  searchProject: (projectId: string) => ipcRenderer.invoke('projects:search', projectId),
  mergeIntoProject: (opts: { name: string; jobIds: string[]; productQuery: string }) => ipcRenderer.invoke('projects:merge', opts),
  renameProject: (id: string, name: string) => ipcRenderer.invoke('projects:rename', id, name),
  deleteProject: (id: string) => ipcRenderer.invoke('projects:delete', id),
  deleteReview: (id: string) => ipcRenderer.invoke('reviews:delete', id),
})
