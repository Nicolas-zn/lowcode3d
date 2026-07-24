/**
 * 发布项目快照仓库
 */
import { and, desc, eq } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'
import {
  db,
  publishedProjects,
  type NewPublishedProject,
  type PublishedProject,
} from '../db/index.js'

export interface IPublishedProjectRepository {
  findLatestByProjectId(projectId: string): Promise<PublishedProject | null>
  findByProjectId(projectId: string): Promise<PublishedProject[]>
  getNextVersion(projectId: string): Promise<number>
  setLatestVersion(projectId: string, version: number): Promise<PublishedProject | null>
  createSnapshot(
    data: Omit<NewPublishedProject, 'id' | 'version' | 'isLatest'>
  ): Promise<PublishedProject>
}

export class PublishedProjectRepository implements IPublishedProjectRepository {
  async findLatestByProjectId(projectId: string): Promise<PublishedProject | null> {
    const result = await db
      .select()
      .from(publishedProjects)
      .where(and(eq(publishedProjects.projectId, projectId), eq(publishedProjects.isLatest, true)))
      .orderBy(desc(publishedProjects.version))
      .limit(1)

    return result[0] || null
  }

  async findByProjectId(projectId: string): Promise<PublishedProject[]> {
    return await db
      .select()
      .from(publishedProjects)
      .where(eq(publishedProjects.projectId, projectId))
      .orderBy(desc(publishedProjects.version))
  }

  async getNextVersion(projectId: string): Promise<number> {
    const snapshots = await this.findByProjectId(projectId)
    const latestVersion = snapshots[0]?.version ?? 0
    return latestVersion + 1
  }

  async createSnapshot(
    data: Omit<NewPublishedProject, 'id' | 'version' | 'isLatest'>
  ): Promise<PublishedProject> {
    const id = uuidv4()
    const version = await this.getNextVersion(data.projectId)

    await db
      .update(publishedProjects)
      .set({ isLatest: false })
      .where(eq(publishedProjects.projectId, data.projectId))

    await db.insert(publishedProjects).values({
      ...data,
      id,
      version,
      isLatest: true,
      createdAt: new Date(),
    })

    const snapshot = await this.findLatestByProjectId(data.projectId)
    if (!snapshot) {
      throw new Error('Failed to create published project snapshot')
    }
    return snapshot
  }

  async setLatestVersion(projectId: string, version: number): Promise<PublishedProject | null> {
    await db
      .update(publishedProjects)
      .set({ isLatest: false })
      .where(eq(publishedProjects.projectId, projectId))

    await db
      .update(publishedProjects)
      .set({ isLatest: true })
      .where(
        and(eq(publishedProjects.projectId, projectId), eq(publishedProjects.version, version))
      )

    const snapshots = await this.findByProjectId(projectId)
    return snapshots.find((snapshot) => snapshot.version === version) ?? null
  }
}

export const publishedProjectRepository = new PublishedProjectRepository()
