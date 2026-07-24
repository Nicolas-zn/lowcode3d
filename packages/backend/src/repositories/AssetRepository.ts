/**
 * 资源数据仓库
 * 负责资源数据的持久化操作
 */
import { eq, and, or, desc } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'
import { db, assets, type Asset, type NewAsset } from '../db/index.js'

export type AssetType = 'model' | 'texture' | 'hdri' | 'billboard' | 'place_icon' | 'other'

export interface IAssetRepository {
  findById(id: string): Promise<Asset | null>
  findByOwnerId(ownerId: string): Promise<Asset[]>
  findViewable(viewerId: string): Promise<Asset[]>
  findByOwnerAndType(ownerId: string, type: AssetType): Promise<Asset[]>
  findViewableByType(viewerId: string, type: AssetType): Promise<Asset[]>
  findByIdAndOwner(id: string, ownerId: string): Promise<Asset | null>
  create(data: Omit<NewAsset, 'id'>): Promise<Asset>
  update(id: string, data: Partial<NewAsset>): Promise<Asset | null>
  delete(id: string): Promise<boolean>
}

export class AssetRepository implements IAssetRepository {
  /**
   * 根据 ID 查找资源
   */
  async findById(id: string): Promise<Asset | null> {
    const result = await db.select().from(assets).where(eq(assets.id, id)).limit(1)
    return result[0] || null
  }

  /**
   * 根据所有者 ID 查找所有资源
   */
  async findByOwnerId(ownerId: string): Promise<Asset[]> {
    return await db
      .select()
      .from(assets)
      .where(eq(assets.ownerId, ownerId))
      .orderBy(desc(assets.createdAt))
  }

  /**
   * 查找用户可见的资源（自己的 + 公开的）
   */
  async findViewable(viewerId: string): Promise<Asset[]> {
    return await db
      .select()
      .from(assets)
      .where(or(eq(assets.ownerId, viewerId), eq(assets.isPublic, true)))
      .orderBy(desc(assets.createdAt))
  }

  /**
   * 根据所有者和类型查找资源
   */
  async findByOwnerAndType(ownerId: string, type: AssetType): Promise<Asset[]> {
    return await db
      .select()
      .from(assets)
      .where(and(eq(assets.ownerId, ownerId), eq(assets.type, type)))
      .orderBy(desc(assets.createdAt))
  }

  /**
   * 根据类型查找可见资源（自己的 + 公开的）
   */
  async findViewableByType(viewerId: string, type: AssetType): Promise<Asset[]> {
    return await db
      .select()
      .from(assets)
      .where(
        and(eq(assets.type, type), or(eq(assets.ownerId, viewerId), eq(assets.isPublic, true)))
      )
      .orderBy(desc(assets.createdAt))
  }

  /**
   * 根据 ID 和所有者查找资源（权限验证）
   */
  async findByIdAndOwner(id: string, ownerId: string): Promise<Asset | null> {
    const result = await db
      .select()
      .from(assets)
      .where(and(eq(assets.id, id), eq(assets.ownerId, ownerId)))
      .limit(1)
    return result[0] || null
  }

  /**
   * 创建新资源
   */
  async create(data: Omit<NewAsset, 'id'>): Promise<Asset> {
    const id = uuidv4()
    const now = new Date()

    await db.insert(assets).values({
      id,
      ...data,
      createdAt: now,
    })

    const asset = await this.findById(id)
    if (!asset) {
      throw new Error('Failed to create asset')
    }
    return asset
  }

  /**
   * 更新资源
   */
  async update(id: string, data: Partial<NewAsset>): Promise<Asset | null> {
    await db.update(assets).set(data).where(eq(assets.id, id))

    return await this.findById(id)
  }

  /**
   * 删除资源
   */
  async delete(id: string): Promise<boolean> {
    const asset = await this.findById(id)
    if (!asset) return false

    await db.delete(assets).where(eq(assets.id, id))
    return true
  }
}

// 导出单例实例
export const assetRepository = new AssetRepository()
