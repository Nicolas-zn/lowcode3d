/**
 * 项目 API
 * 处理项目 CRUD 相关接口
 */
import { get, post, put, del } from './http'

export interface Project {
  id: string
  name: string
  description?: string
  ownerId: string
  sceneData?: unknown
  thumbnailUrl?: string | null
  isPublic: boolean
  status: 'draft' | 'published' | 'archived'
  createdAt: string
  updatedAt: string
}

export interface PublishedProject {
  id: string
  projectId: string
  ownerId: string
  version: number
  sceneData: unknown
  assetManifest?: unknown
  runtimeConfig?: unknown
  isLatest: boolean
  createdAt: string
}

export interface PublishProjectData {
  sceneData: unknown
  publishNote?: string
  sdkVersion?: string
  dataMode?: 'snapshot' | 'live' | 'external'
  embedDefaults?: {
    toolbar?: boolean
    controls?: boolean
    transparent?: boolean
    autoplay?: boolean
  }
  runtimeConfig?: Record<string, unknown>
}

export interface CreateProjectData {
  name: string
  description?: string
  isPublic?: boolean
  sceneData?: unknown
  thumbnailUrl?: string | null
}

export interface UpdateProjectData {
  name?: string
  description?: string
  sceneData?: unknown
  thumbnailUrl?: string | null
  isPublic?: boolean
  status?: 'draft' | 'published' | 'archived'
}

/**
 * 获取项目列表
 */
export async function getProjects(): Promise<Project[]> {
  const response = await get<Project[]>('/projects')
  if (response.success && response.data) {
    return response.data
  }
  throw new Error(response.error || '获取项目列表失败')
}

/**
 * 获取公开项目列表
 */
export async function getPublicProjects(): Promise<Project[]> {
  const response = await get<Project[]>('/projects/public')
  if (response.success && response.data) {
    return response.data
  }
  throw new Error(response.error || '获取公开项目列表失败')
}

/**
 * 获取项目详情
 */
export async function getProject(id: string): Promise<Project> {
  const response = await get<Project>(`/projects/${id}`)
  if (response.success && response.data) {
    return response.data
  }
  throw new Error(response.error || '获取项目详情失败')
}

/**
 * 创建项目
 */
export async function createProject(data: CreateProjectData): Promise<Project> {
  const response = await post<Project>('/projects', data)
  if (response.success && response.data) {
    return response.data
  }
  throw new Error(response.error || '创建项目失败')
}

/**
 * 更新项目
 */
export async function updateProject(id: string, data: UpdateProjectData): Promise<Project> {
  const response = await put<Project>(`/projects/${id}`, data)
  if (response.success && response.data) {
    return response.data
  }
  throw new Error(response.error || '更新项目失败')
}

/**
 * 发布项目快照
 */
export async function publishProject(
  id: string,
  data: unknown | PublishProjectData
): Promise<PublishedProject> {
  const body =
    typeof data === 'object' && data !== null && 'sceneData' in data ? data : { sceneData: data }
  const response = await post<PublishedProject>(`/projects/${id}/publish`, body)
  if (response.success && response.data) {
    return response.data
  }
  throw new Error(response.error || '发布项目失败')
}

/**
 * 获取最新发布快照
 */
export async function getPublishedProject(id: string): Promise<PublishedProject> {
  const response = await get<PublishedProject>(`/projects/${id}/published`)
  if (response.success && response.data) {
    return response.data
  }
  throw new Error(response.error || '获取发布快照失败')
}

export async function getPublishedVersions(id: string): Promise<PublishedProject[]> {
  const response = await get<PublishedProject[]>(`/projects/${id}/published/versions`)
  if (response.success && response.data) {
    return response.data
  }
  throw new Error(response.error || '获取发布版本失败')
}

export async function rollbackPublishedVersion(
  id: string,
  version: number
): Promise<PublishedProject> {
  const response = await post<PublishedProject>(`/projects/${id}/published/${version}/rollback`, {})
  if (response.success && response.data) {
    return response.data
  }
  throw new Error(response.error || '回滚发布版本失败')
}

/**
 * 删除项目
 */
export async function deleteProject(id: string): Promise<void> {
  const response = await del<void>(`/projects/${id}`)
  if (!response.success) {
    throw new Error(response.error || '删除项目失败')
  }
}
