/**
 * 项目数据仓库
 * 负责项目数据的持久化操作
 */
import { eq, and, desc } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'
import { db, projects, type Project, type NewProject } from '../db/index.js'

export interface IProjectRepository {
  findById(id: string): Promise<Project | null>
  findByOwnerId(ownerId: string): Promise<Project[]>
  findByIdAndOwner(id: string, ownerId: string): Promise<Project | null>
  findByIdWithAccess(id: string, userId?: string): Promise<Project | null>
  findPublicProjects(): Promise<Project[]>
  create(data: Omit<NewProject, 'id'>): Promise<Project>
  update(id: string, data: Partial<NewProject>): Promise<Project | null>
  delete(id: string): Promise<boolean>
}

export class ProjectRepository implements IProjectRepository {
  /**
   * 根据 ID 查找项目
   */
  async findById(id: string): Promise<Project | null> {
    const result = await db.select().from(projects).where(eq(projects.id, id)).limit(1)
    return result[0] || null
  }

  /**
   * 根据所有者 ID 查找所有项目
   */
  async findByOwnerId(ownerId: string): Promise<Project[]> {
    return await db
      .select()
      .from(projects)
      .where(eq(projects.ownerId, ownerId))
      .orderBy(desc(projects.updatedAt))
  }

  /**
   * 根据 ID 和所有者查找项目（权限验证）
   */
  async findByIdAndOwner(id: string, ownerId: string): Promise<Project | null> {
    const result = await db
      .select()
      .from(projects)
      .where(and(eq(projects.id, id), eq(projects.ownerId, ownerId)))
      .limit(1)
    return result[0] || null
  }

  /**
   * 根据 ID 查找用户可访问的项目（自己的或公开的）
   */
  async findByIdWithAccess(id: string, userId?: string): Promise<Project | null> {
    // 首先尝试查找项目
    const project = await this.findById(id)
    if (!project) {
      return null
    }
    // 检查是否是自己的项目或者是公开项目
    if ((userId && project.ownerId === userId) || project.isPublic) {
      return project
    }
    return null
  }

  /**
   * 查找所有公开项目
   */
  async findPublicProjects(): Promise<Project[]> {
    return await db
      .select()
      .from(projects)
      .where(eq(projects.isPublic, true))
      .orderBy(desc(projects.updatedAt))
  }

  /**
   * 创建新项目
   */
  async create(data: Omit<NewProject, 'id'> & { id?: string }): Promise<Project> {
    const id = data.id || uuidv4()
    const now = new Date()

    await db.insert(projects).values({
      ...data,
      id,
      createdAt: now,
      updatedAt: now,
    })

    // SQLite 不支持 returning()，需要重新查询
    const project = await this.findById(id)
    if (!project) {
      throw new Error('Failed to create project')
    }
    return project
  }

  /**
   * 更新项目
   */
  async update(id: string, data: Partial<NewProject>): Promise<Project | null> {
    await db
      .update(projects)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(projects.id, id))

    return await this.findById(id)
  }

  /**
   * 删除项目
   */
  async delete(id: string): Promise<boolean> {
    const project = await this.findById(id)
    if (!project) return false

    await db.delete(projects).where(eq(projects.id, id))
    return true
  }
}

// 导出单例实例
export const projectRepository = new ProjectRepository()
