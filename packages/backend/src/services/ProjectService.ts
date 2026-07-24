/**
 * 项目服务
 * 处理项目 CRUD 相关业务逻辑
 */
import { projectRepository, type IProjectRepository } from '../repositories/ProjectRepository.js'
import {
  publishedProjectRepository,
  type IPublishedProjectRepository,
} from '../repositories/PublishedProjectRepository.js'
import type { Project, NewProject, PublishedProject } from '../db/schema.js'
import type { ISceneData, IProjectSettings } from '@lowcode3d/shared'

export interface CreateProjectDTO {
  name: string
  description?: string
  ownerId: string
  sceneData?: ISceneData | null
  thumbnailUrl?: string | null
  isPublic?: boolean
}

export interface UpdateProjectDTO {
  name?: string
  description?: string
  sceneData?: ISceneData | null
  thumbnailUrl?: string | null
  isPublic?: boolean
  status?: 'draft' | 'published' | 'archived'
  settings?: Partial<IProjectSettings>
}

export interface ProjectResult {
  id: string
  name: string
  description: string | null
  ownerId: string
  thumbnailUrl: string | null
  isPublic: boolean
  status: string
  sceneData: ISceneData | null
  settings: IProjectSettings
  createdAt: Date
  updatedAt: Date
}

export interface PublishedProjectResult {
  id: string
  projectId: string
  ownerId: string
  version: number
  sceneData: ISceneData
  assetManifest: unknown
  runtimeConfig: unknown
  isLatest: boolean
  createdAt: Date
}

export interface PublishProjectOptions {
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

export interface IProjectService {
  getProjectsByOwner(ownerId: string): Promise<ProjectResult[]>
  getPublicProjects(): Promise<ProjectResult[]>
  getProjectById(id: string, ownerId?: string): Promise<ProjectResult | null>
  createProject(data: CreateProjectDTO): Promise<ProjectResult>
  updateProject(id: string, ownerId: string, data: UpdateProjectDTO): Promise<ProjectResult>
  publishProject(
    id: string,
    ownerId: string,
    sceneData: ISceneData,
    options?: PublishProjectOptions
  ): Promise<PublishedProjectResult>
  getLatestPublishedProject(id: string): Promise<PublishedProjectResult | null>
  getPublishedVersions(id: string, ownerId?: string): Promise<PublishedProjectResult[]>
  rollbackPublishedVersion(
    id: string,
    ownerId: string,
    version: number
  ): Promise<PublishedProjectResult>
  deleteProject(id: string, ownerId: string): Promise<void>
}

export class ProjectService implements IProjectService {
  private projectRepo: IProjectRepository
  private publishedProjectRepo: IPublishedProjectRepository

  constructor(
    projectRepo: IProjectRepository = projectRepository,
    publishedProjectRepo: IPublishedProjectRepository = publishedProjectRepository
  ) {
    this.projectRepo = projectRepo
    this.publishedProjectRepo = publishedProjectRepo
  }

  /**
   * 获取用户的所有项目
   */
  async getProjectsByOwner(ownerId: string): Promise<ProjectResult[]> {
    const projects = await this.projectRepo.findByOwnerId(ownerId)
    return projects.map(this.toProjectResult)
  }

  /**
   * 获取所有公开项目
   */
  async getPublicProjects(): Promise<ProjectResult[]> {
    const projects = await this.projectRepo.findPublicProjects()
    return projects.map(this.toProjectResult)
  }

  /**
   * 获取项目详情（可访问自己的项目或公开项目）
   */
  async getProjectById(id: string, ownerId?: string): Promise<ProjectResult | null> {
    const project = await this.projectRepo.findByIdWithAccess(id, ownerId)
    if (!project) {
      return null
    }
    return this.toProjectResult(project)
  }

  /**
   * 创建新项目
   */
  async createProject(data: CreateProjectDTO): Promise<ProjectResult> {
    const projectData: Omit<NewProject, 'id'> = {
      name: data.name,
      description: data.description || null,
      sceneJson: data.sceneData ?? null,
      thumbnailUrl: data.thumbnailUrl ?? null,
      ownerId: data.ownerId,
      isPublic: data.isPublic ?? false,
      status: 'draft',
      settings: {
        width: 1920,
        height: 1080,
        backgroundColor: '#1a1a2e',
        fogEnabled: false,
      },
    }

    const project = await this.projectRepo.create(projectData)
    return this.toProjectResult(project)
  }

  /**
   * 更新项目
   */
  async updateProject(id: string, ownerId: string, data: UpdateProjectDTO): Promise<ProjectResult> {
    // 验证项目所有权
    const existing = await this.projectRepo.findByIdAndOwner(id, ownerId)
    if (!existing) {
      throw new ProjectError('项目不存在或无权访问', 404)
    }

    // 构建更新数据
    const updateData: Partial<NewProject> = {}

    if (data.name !== undefined) updateData.name = data.name
    if (data.description !== undefined) updateData.description = data.description
    if (data.sceneData !== undefined) updateData.sceneJson = data.sceneData
    if (data.thumbnailUrl !== undefined) updateData.thumbnailUrl = data.thumbnailUrl
    if (data.isPublic !== undefined) updateData.isPublic = data.isPublic
    if (data.status !== undefined) updateData.status = data.status
    if (data.settings !== undefined) {
      updateData.settings = {
        ...(existing.settings as IProjectSettings),
        ...data.settings,
      }
    }

    const project = await this.projectRepo.update(id, updateData)
    if (!project) {
      throw new ProjectError('更新项目失败', 500)
    }

    return this.toProjectResult(project)
  }

  /**
   * 发布项目不可变快照
   */
  async publishProject(
    id: string,
    ownerId: string,
    sceneData: ISceneData,
    options: PublishProjectOptions = {}
  ): Promise<PublishedProjectResult> {
    const existing = await this.projectRepo.findByIdAndOwner(id, ownerId)
    if (!existing) {
      throw new ProjectError('项目不存在或无权访问', 404)
    }

    const project = await this.projectRepo.update(id, {
      sceneJson: sceneData,
      isPublic: true,
      status: 'published',
    })

    if (!project) {
      throw new ProjectError('发布项目失败', 500)
    }

    const sceneSnapshot = sceneData as unknown as Record<string, unknown>
    const runtimeConfig = {
      ...(options.runtimeConfig ?? {}),
      projectName: project.name,
      publishNote: options.publishNote ?? '',
      publishedAt: new Date().toISOString(),
      sdkVersion: options.sdkVersion ?? '1.3.0',
      dataMode: options.dataMode ?? 'snapshot',
      previewUrl: `/preview/${id}`,
      embedUrl: `/preview/${id}?embed=1`,
      embedDefaults: {
        toolbar: options.embedDefaults?.toolbar ?? false,
        controls: options.embedDefaults?.controls ?? true,
        transparent: options.embedDefaults?.transparent ?? false,
        autoplay: options.embedDefaults?.autoplay ?? true,
      },
    }
    const snapshot = await this.publishedProjectRepo.createSnapshot({
      projectId: id,
      ownerId,
      sceneJson: sceneData,
      assetManifest: sceneSnapshot.assetManifest ?? null,
      runtimeConfig,
      createdAt: new Date(),
    })

    return this.toPublishedProjectResult(snapshot)
  }

  /**
   * 获取最新发布快照
   */
  async getLatestPublishedProject(id: string): Promise<PublishedProjectResult | null> {
    const project = await this.projectRepo.findById(id)
    if (!project?.isPublic) {
      return null
    }

    const snapshot = await this.publishedProjectRepo.findLatestByProjectId(id)
    return snapshot ? this.toPublishedProjectResult(snapshot) : null
  }

  async getPublishedVersions(id: string, ownerId?: string): Promise<PublishedProjectResult[]> {
    const project = ownerId
      ? await this.projectRepo.findByIdWithAccess(id, ownerId)
      : await this.projectRepo.findById(id)
    if (!project?.isPublic && project?.ownerId !== ownerId) {
      return []
    }

    const snapshots = await this.publishedProjectRepo.findByProjectId(id)
    return snapshots.map(this.toPublishedProjectResult)
  }

  async rollbackPublishedVersion(
    id: string,
    ownerId: string,
    version: number
  ): Promise<PublishedProjectResult> {
    const existing = await this.projectRepo.findByIdAndOwner(id, ownerId)
    if (!existing) {
      throw new ProjectError('项目不存在或无权访问', 404)
    }

    const snapshot = await this.publishedProjectRepo.setLatestVersion(id, version)
    if (!snapshot) {
      throw new ProjectError('发布版本不存在', 404)
    }

    await this.projectRepo.update(id, {
      sceneJson: snapshot.sceneJson,
      isPublic: true,
      status: 'published',
    })

    return this.toPublishedProjectResult(snapshot)
  }

  /**
   * 删除项目
   */
  async deleteProject(id: string, ownerId: string): Promise<void> {
    // 验证项目所有权
    const existing = await this.projectRepo.findByIdAndOwner(id, ownerId)
    if (!existing) {
      throw new ProjectError('项目不存在或无权访问', 404)
    }

    const deleted = await this.projectRepo.delete(id)
    if (!deleted) {
      throw new ProjectError('删除项目失败', 500)
    }
  }

  /**
   * 转换数据库模型为返回结果
   */
  private toProjectResult(project: Project): ProjectResult {
    return {
      id: project.id,
      name: project.name,
      description: project.description,
      ownerId: project.ownerId,
      thumbnailUrl: project.thumbnailUrl,
      isPublic: project.isPublic,
      status: project.status,
      sceneData: project.sceneJson as ISceneData | null,
      settings: project.settings as IProjectSettings,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
    }
  }

  private toPublishedProjectResult(snapshot: PublishedProject): PublishedProjectResult {
    return {
      id: snapshot.id,
      projectId: snapshot.projectId,
      ownerId: snapshot.ownerId,
      version: snapshot.version,
      sceneData: snapshot.sceneJson as ISceneData,
      assetManifest: snapshot.assetManifest,
      runtimeConfig: snapshot.runtimeConfig,
      isLatest: snapshot.isLatest,
      createdAt: snapshot.createdAt,
    }
  }
}

/**
 * 项目错误类
 */
export class ProjectError extends Error {
  public statusCode: number

  constructor(message: string, statusCode: number = 400) {
    super(message)
    this.name = 'ProjectError'
    this.statusCode = statusCode
  }
}

// 导出单例实例
export const projectService = new ProjectService()
