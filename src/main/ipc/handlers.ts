import { ipcMain, BrowserWindow, app } from 'electron'
import { join } from 'path'
import { writeFileSync } from 'fs'
import type { SearchOptions, SearchFilters, ExportOptions, Project } from '../../types/index'
import {
  getAllJobs, getReviews, getAnalysis,
  getAllProjects, getProject, findProjectByQuery, getProjectReviews,
  createProject, addJobToProject, updateProjectUpdatedAt,
  renameProject, deleteProject, mergeJobsIntoProject, deleteReview
} from '../../db/queries'
import { exportToJSON, exportToCSV, exportToHTML } from '../../services/exportService'
import { runSearch } from '../../services/searchService'
import { loadConfig } from '../../services/config'

export function registerIpcHandlers(mainWindow: BrowserWindow): void {
  const config = loadConfig()

  ipcMain.handle('search:start', async (_event, options: SearchOptions) => {
    const { job } = await runSearch(options, config, (progress) => {
      mainWindow.webContents.send('search:progress', progress)
    })
    // Auto-create or update project keyed on productQuery
    const now = new Date().toISOString()
    let project = findProjectByQuery(options.productQuery)
    if (!project) {
      const newProject: Project = {
        id: crypto.randomUUID(),
        name: options.productQuery,
        productQuery: options.productQuery,
        createdAt: now,
        updatedAt: now,
        jobIds: [],
        totalReviews: 0,
        validReviews: 0,
        lastSearchAt: now,
      }
      createProject(newProject)
      project = newProject
    }
    addJobToProject(project.id, job.id)
    updateProjectUpdatedAt(project.id)
    return job
  })

  ipcMain.handle('search:getJobs', async () => {
    return getAllJobs()
  })

  ipcMain.handle('reviews:get', async (_event, jobId: string, filters?: SearchFilters) => {
    return getReviews(jobId, filters)
  })

  ipcMain.handle('analysis:get', async (_event, jobId: string) => {
    return getAnalysis(jobId)
  })

  ipcMain.handle('export:results', async (_event, options: ExportOptions) => {
    try {
      const reviews = getReviews(options.jobId, options.filters)
      const downloadsPath = app.getPath('downloads')
      const timestamp = Date.now()
      const ext = options.format === 'html' ? 'html' : options.format
      const filename = `reviews-${options.jobId.slice(0, 8)}-${timestamp}.${ext}`
      const filePath = join(downloadsPath, filename)

      if (options.format === 'json') {
        writeFileSync(filePath, exportToJSON(reviews, options.jobId), 'utf-8')
      } else if (options.format === 'csv') {
        writeFileSync(filePath, exportToCSV(reviews), 'utf-8')
      } else {
        const analysis = getAnalysis(options.jobId)
        const productQuery = reviews[0]?.productQuery ?? options.jobId
        writeFileSync(filePath, exportToHTML(analysis, reviews, productQuery), 'utf-8')
      }

      return { success: true, path: filePath }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('reviews:delete', async (_event, id: string) => {
    deleteReview(id)
  })

  ipcMain.handle('projects:getAll', async () => getAllProjects())

  ipcMain.handle('projects:getReviews', async (_event, projectId: string, filters?: SearchFilters) => {
    return getProjectReviews(projectId, filters)
  })

  ipcMain.handle('projects:search', async (_event, projectId: string) => {
    const project = getProject(projectId)
    if (!project) throw new Error(`Project ${projectId} not found`)
    const { job } = await runSearch(
      { productQuery: project.productQuery, sources: ['reddit', 'youtube', 'trustpilot'], maxResults: 50 },
      config,
      (progress) => mainWindow.webContents.send('search:progress', progress)
    )
    addJobToProject(projectId, job.id)
    updateProjectUpdatedAt(projectId)
    return job
  })

  ipcMain.handle('projects:merge', async (_event, opts: { name: string; jobIds: string[]; productQuery: string }) => {
    return mergeJobsIntoProject(opts.name, opts.jobIds, opts.productQuery)
  })

  ipcMain.handle('projects:rename', async (_event, id: string, name: string) => {
    renameProject(id, name)
  })

  ipcMain.handle('projects:delete', async (_event, id: string) => {
    deleteProject(id)
  })
}
