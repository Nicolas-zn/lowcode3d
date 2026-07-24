/**
 * 资源服务
 * 处理资源 CRUD 相关业务逻辑
 */
import {
  assetRepository,
  type IAssetRepository,
  type AssetType,
} from '../repositories/AssetRepository.js'
import { storageService, StorageService } from './StorageService.js'
import type { Asset, NewAsset } from '../db/schema.js'

export interface CreateAssetDTO {
  ownerId: string
  name: string
  type: AssetType
  category?: string
  filePath: string
  fileName: string
  mimeType: string
  fileSize: number
  thumbnailPath?: string
  isPublic?: boolean
  metadata?: Record<string, unknown>
}

export interface AssetResult {
  id: string
  name: string
  type: string
  category: string | null
  url: string
  fileName: string
  mimeType: string
  fileSize: number
  thumbnailUrl: string | null
  metadata: Record<string, unknown> | null
  isPublic: boolean
  createdAt: Date
}

export interface IAssetService {
  getAssetsByOwner(ownerId: string): Promise<AssetResult[]>
  getAssetsByType(ownerId: string, type: AssetType): Promise<AssetResult[]>
  getAssetById(id: string, ownerId: string): Promise<AssetResult | null>
  createAsset(data: CreateAssetDTO): Promise<AssetResult>
  updateAsset(id: string, ownerId: string, data: Partial<CreateAssetDTO>): Promise<AssetResult>
  deleteAsset(id: string, ownerId: string): Promise<void>
}

export class AssetService implements IAssetService {
  private assetRepo: IAssetRepository

  constructor(assetRepo: IAssetRepository = assetRepository) {
    this.assetRepo = assetRepo
  }

  /**
   * 获取用户的所有资源
   */
  async getAssetsByOwner(ownerId: string): Promise<AssetResult[]> {
    const assets = await this.assetRepo.findViewable(ownerId)
    return assets.map((asset) => this.toAssetResult(asset))
  }

  /**
   * 按类型获取用户资源
   */
  async getAssetsByType(ownerId: string, type: AssetType): Promise<AssetResult[]> {
    const assets = await this.assetRepo.findViewableByType(ownerId, type)
    return assets.map((asset) => this.toAssetResult(asset))
  }

  /**
   * 获取资源详情
   */
  async getAssetById(id: string, ownerId: string): Promise<AssetResult | null> {
    const asset = await this.assetRepo.findByIdAndOwner(id, ownerId)
    if (!asset) {
      return null
    }
    return this.toAssetResult(asset)
  }

  /**
   * 创建新资源
   */
  async createAsset(data: CreateAssetDTO): Promise<AssetResult> {
    const assetData: Omit<NewAsset, 'id'> = {
      ownerId: data.ownerId,
      name: data.name,
      type: data.type,
      category: data.category || null,
      filePath: data.filePath,
      fileName: data.fileName,
      mimeType: data.mimeType,
      fileSize: data.fileSize,
      thumbnailPath: data.thumbnailPath || null,
      isPublic: data.isPublic ?? true,
      metadata: data.metadata || null,
    }

    const asset = await this.assetRepo.create(assetData)
    return this.toAssetResult(asset)
  }

  /**
   * 更新资源
   */
  async updateAsset(
    id: string,
    ownerId: string,
    data: Partial<CreateAssetDTO>
  ): Promise<AssetResult> {
    const existing = await this.assetRepo.findByIdAndOwner(id, ownerId)
    if (!existing) {
      throw new AssetError('资源不存在或无权访问', 404)
    }

    const updates: Partial<NewAsset> = {}
    if (data.name !== undefined) updates.name = data.name
    if (data.category !== undefined) updates.category = data.category
    if (data.metadata !== undefined) updates.metadata = data.metadata
    if (data.isPublic !== undefined) updates.isPublic = data.isPublic

    // 如果上传了新文件
    if (data.filePath && data.fileName) {
      // 删除旧文件
      await storageService.deleteFile(existing.filePath)
      updates.filePath = data.filePath
      updates.fileName = data.fileName
      updates.mimeType = data.mimeType
      updates.fileSize = data.fileSize
    }

    // 如果上传了新的缩略图
    if (data.thumbnailPath) {
      // 删除旧缩略图
      if (existing.thumbnailPath) {
        await storageService.deleteFile(existing.thumbnailPath)
      }
      updates.thumbnailPath = data.thumbnailPath
    }

    const updated = await this.assetRepo.update(id, updates)
    if (!updated) {
      throw new AssetError('更新失败', 500)
    }
    return this.toAssetResult(updated)
  }

  /**
   * 删除资源
   */
  async deleteAsset(id: string, ownerId: string): Promise<void> {
    // 验证资源所有权
    const existing = await this.assetRepo.findByIdAndOwner(id, ownerId)
    if (!existing) {
      throw new AssetError('资源不存在或无权访问', 404)
    }

    // 删除物理文件
    await storageService.deleteFile(existing.filePath)

    // 删除缩略图（如果存在）
    if (existing.thumbnailPath) {
      await storageService.deleteFile(existing.thumbnailPath)
    }

    // 删除数据库记录
    const deleted = await this.assetRepo.delete(id)
    if (!deleted) {
      throw new AssetError('删除资源失败', 500)
    }
  }

  /**
   * 转换数据库模型为返回结果
   */
  private toAssetResult(asset: Asset): AssetResult {
    const metadata = asset.metadata as Record<string, unknown> | null

    return {
      id: asset.id,
      name: asset.name,
      type: asset.type,
      category: asset.category,
      url: this.isExternalUrlAsset(asset)
        ? asset.filePath
        : storageService.getFileUrl(asset.filePath),
      fileName: asset.fileName,
      mimeType: asset.mimeType,
      fileSize: asset.fileSize,
      thumbnailUrl: asset.thumbnailPath ? storageService.getFileUrl(asset.thumbnailPath) : null,
      metadata,
      isPublic: asset.isPublic,
      createdAt: asset.createdAt,
    }
  }

  private isExternalUrlAsset(asset: Asset): boolean {
    return StorageService.isExternalUrl(asset.filePath)
  }
}

/**
 * 资源错误类
 */
export class AssetError extends Error {
  public statusCode: number

  constructor(message: string, statusCode: number = 400) {
    super(message)
    this.name = 'AssetError'
    this.statusCode = statusCode
  }
}

// 导出单例实例
export const assetService = new AssetService()
