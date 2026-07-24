/**
 * 存储服务
 * 基于 @fastify/multipart 处理本地文件上传和管理
 */
import { existsSync, mkdirSync, writeFileSync, unlinkSync, statSync, readFileSync } from 'fs'
import { join, extname, basename } from 'path'
import { createHash } from 'crypto'

/**
 * 上传结果接口
 */
export interface UploadResult {
  url: string
  filePath: string
  fileName: string
  originalName: string
  mimeType: string
  fileSize: number
  hash?: string
}

/**
 * 上传选项接口
 */
export interface UploadOptions {
  /** 目标文件夹 */
  folder?: string
  /** 是否计算文件哈希 */
  computeHash?: boolean
  /** 自定义文件名（不包含扩展名） */
  customFileName?: string
  /** 是否保留原始文件名 */
  keepOriginalName?: boolean
}

/**
 * 存储配置接口
 */
export interface StorageConfig {
  /** 上传目录 */
  uploadDir: string
  /** 公共 URL 基础路径 */
  publicUrlBase: string
  /** 最大文件大小（字节） */
  maxFileSize: number
  /** 允许的 MIME 类型 */
  allowedMimeTypes: string[]
  /** 允许的文件扩展名 */
  allowedExtensions: string[]
}

/**
 * 存储服务接口
 */
export interface IStorageService {
  uploadFile(
    buffer: Buffer,
    fileName: string,
    mimeType: string,
    options?: UploadOptions
  ): Promise<UploadResult>
  deleteFile(filePath: string): Promise<void>
  getFileUrl(filePath: string): string
  fileExists(filePath: string): boolean
  getConfig(): StorageConfig
}

/**
 * 存储服务类
 * 处理文件的上传、删除和访问
 */
export class StorageService implements IStorageService {
  private config: StorageConfig

  constructor(config?: Partial<StorageConfig>) {
    this.config = {
      uploadDir: config?.uploadDir || process.env.UPLOAD_DIR || './data/uploads',
      publicUrlBase: config?.publicUrlBase || process.env.PUBLIC_URL_BASE || '/uploads',
      maxFileSize: config?.maxFileSize || parseInt(process.env.MAX_FILE_SIZE || '52428800', 10), // 默认 50MB
      allowedMimeTypes: config?.allowedMimeTypes || StorageService.getDefaultAllowedMimeTypes(),
      allowedExtensions: config?.allowedExtensions || StorageService.getDefaultAllowedExtensions(),
    }
  }

  /**
   * 获取配置
   */
  getConfig(): StorageConfig {
    return { ...this.config }
  }

  /**
   * 初始化存储服务（确保目录存在）
   */
  async initialize(): Promise<void> {
    try {
      // 创建上传目录结构
      const dirs = ['models', 'textures', 'thumbnails', 'hdri', 'other', 'temp']
      for (const dir of dirs) {
        const path = join(this.config.uploadDir, dir)
        if (!existsSync(path)) {
          mkdirSync(path, { recursive: true })
        }
      }
      console.log(`✅ Storage service initialized, upload dir: ${this.config.uploadDir}`)
    } catch (error) {
      console.error('❌ Failed to initialize storage service:', error)
      throw error
    }
  }

  /**
   * 上传文件
   */
  async uploadFile(
    buffer: Buffer,
    originalFileName: string,
    mimeType: string,
    options: UploadOptions = {}
  ): Promise<UploadResult> {
    const {
      folder = 'other',
      computeHash = false,
      customFileName,
      keepOriginalName = false,
    } = options

    // 验证文件大小
    if (buffer.length > this.config.maxFileSize) {
      throw new StorageError(
        `文件大小超过限制，最大允许 ${Math.floor(this.config.maxFileSize / 1024 / 1024)}MB`,
        'FILE_TOO_LARGE'
      )
    }

    // 验证 MIME 类型
    if (!this.isAllowedMimeType(mimeType)) {
      throw new StorageError(`不支持的文件类型: ${mimeType}`, 'INVALID_MIME_TYPE')
    }

    // 生成文件名
    const ext = extname(originalFileName) || this.getExtensionFromMime(mimeType)
    let uniqueFileName: string

    if (customFileName) {
      uniqueFileName = `${customFileName}${ext}`
    } else if (keepOriginalName) {
      // 保留原始文件名，但添加时间戳避免冲突
      const nameWithoutExt = basename(originalFileName, ext)
      const sanitizedName = this.sanitizeFileName(nameWithoutExt)
      uniqueFileName = `${sanitizedName}-${Date.now()}${ext}`
    } else {
      const timestamp = Date.now()
      const randomStr = Math.random().toString(36).substring(2, 8)
      uniqueFileName = `${timestamp}-${randomStr}${ext}`
    }

    // 确保目录存在
    const targetDir = join(this.config.uploadDir, folder)
    if (!existsSync(targetDir)) {
      mkdirSync(targetDir, { recursive: true })
    }

    // 写入文件
    const filePath = join(targetDir, uniqueFileName)
    writeFileSync(filePath, buffer)

    // 计算哈希（可选）
    let hash: string | undefined
    if (computeHash) {
      hash = this.computeFileHash(buffer)
    }

    // 返回相对路径和 URL
    const relativePath = join(folder, uniqueFileName)

    return {
      url: `${this.config.publicUrlBase}/${relativePath.replace(/\\/g, '/')}`,
      filePath: relativePath,
      fileName: uniqueFileName,
      originalName: originalFileName,
      mimeType,
      fileSize: buffer.length,
      hash,
    }
  }

  /**
   * 从 Fastify multipart 文件对象上传
   */
  async uploadFromMultipart(
    fileData: {
      file: AsyncIterable<Buffer>
      filename: string
      mimetype: string
    },
    options: UploadOptions = {}
  ): Promise<UploadResult> {
    // 读取文件内容
    const chunks: Buffer[] = []
    for await (const chunk of fileData.file) {
      chunks.push(chunk)
    }
    const buffer = Buffer.concat(chunks)

    return this.uploadFile(buffer, fileData.filename, fileData.mimetype, options)
  }

  /**
   * 删除文件
   */
  async deleteFile(filePath: string): Promise<void> {
    if (StorageService.isExternalUrl(filePath)) {
      return
    }

    const fullPath = join(this.config.uploadDir, filePath)
    if (existsSync(fullPath)) {
      unlinkSync(fullPath)
    }
  }

  /**
   * 批量删除文件
   */
  async deleteFiles(filePaths: string[]): Promise<{ deleted: string[]; failed: string[] }> {
    const deleted: string[] = []
    const failed: string[] = []

    for (const filePath of filePaths) {
      try {
        await this.deleteFile(filePath)
        deleted.push(filePath)
      } catch {
        failed.push(filePath)
      }
    }

    return { deleted, failed }
  }

  /**
   * 获取文件 URL
   */
  getFileUrl(filePath: string): string {
    if (StorageService.isExternalUrl(filePath)) {
      return filePath
    }

    return `${this.config.publicUrlBase}/${filePath.replace(/\\/g, '/')}`
  }

  /**
   * 获取文件完整路径
   */
  getFullPath(filePath: string): string {
    return join(this.config.uploadDir, filePath)
  }

  /**
   * 检查文件是否存在
   */
  fileExists(filePath: string): boolean {
    const fullPath = join(this.config.uploadDir, filePath)
    return existsSync(fullPath)
  }

  /**
   * 获取文件大小
   */
  getFileSize(filePath: string): number {
    const fullPath = join(this.config.uploadDir, filePath)
    if (!existsSync(fullPath)) return 0
    return statSync(fullPath).size
  }

  /**
   * 获取文件信息
   */
  getFileInfo(filePath: string): { size: number; mtime: Date; exists: boolean } | null {
    const fullPath = join(this.config.uploadDir, filePath)
    if (!existsSync(fullPath)) {
      return null
    }
    const stats = statSync(fullPath)
    return {
      size: stats.size,
      mtime: stats.mtime,
      exists: true,
    }
  }

  /**
   * 读取文件内容
   */
  readFile(filePath: string): Buffer | null {
    const fullPath = join(this.config.uploadDir, filePath)
    if (!existsSync(fullPath)) {
      return null
    }
    return readFileSync(fullPath)
  }

  /**
   * 验证 MIME 类型
   */
  isAllowedMimeType(mimeType: string): boolean {
    return this.config.allowedMimeTypes.includes(mimeType)
  }

  /**
   * 验证文件扩展名
   */
  isAllowedExtension(fileName: string): boolean {
    const ext = extname(fileName).toLowerCase()
    return this.config.allowedExtensions.includes(ext)
  }

  /**
   * 根据 MIME 类型获取文件扩展名
   */
  private getExtensionFromMime(mimeType: string): string {
    const mimeMap: Record<string, string> = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/gif': '.gif',
      'image/webp': '.webp',
      'image/svg+xml': '.svg',
      'model/gltf-binary': '.glb',
      'model/gltf+json': '.gltf',
      'application/octet-stream': '.bin',
      'application/json': '.json',
      'text/plain': '.txt',
      'image/vnd.radiance': '.hdr',
    }
    return mimeMap[mimeType] || ''
  }

  /**
   * 计算文件哈希
   */
  private computeFileHash(buffer: Buffer): string {
    return createHash('md5').update(buffer).digest('hex')
  }

  /**
   * 清理文件名（移除非法字符）
   */
  private sanitizeFileName(fileName: string): string {
    return fileName
      .replace(/[<>:"/\\|?*]/g, '') // 移除非法字符
      .replace(/\s+/g, '_') // 空格替换为下划线
      .substring(0, 100) // 限制长度
  }

  // ==================== 静态方法 ====================

  /**
   * 根据文件扩展名判断资源类型
   */
  static getAssetType(fileName: string): 'model' | 'texture' | 'hdri' | 'other' {
    const ext = extname(fileName).toLowerCase()

    const modelExts = ['.glb', '.gltf', '.fbx', '.obj', '.stl', '.dae', '.3ds']
    const textureExts = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.svg', '.bmp', '.tga']
    const hdriExts = ['.hdr', '.exr']

    if (modelExts.includes(ext)) return 'model'
    if (textureExts.includes(ext)) return 'texture'
    if (hdriExts.includes(ext)) return 'hdri'
    return 'other'
  }

  /**
   * 根据资源类型获取存储文件夹
   */
  static getFolderByAssetType(assetType: string): string {
    const folderMap: Record<string, string> = {
      model: 'models',
      texture: 'textures',
      hdri: 'hdri',
      billboard: 'billboards',
      place_icon: 'icons',
      other: 'other',
    }
    return folderMap[assetType] || 'other'
  }

  /**
   * 获取默认允许的 MIME 类型
   */
  static getDefaultAllowedMimeTypes(): string[] {
    return [
      // 图片
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'image/svg+xml',
      'image/bmp',
      'image/targa',
      'image/x-targa',
      // 3D 模型
      'model/gltf-binary',
      'model/gltf+json',
      'application/octet-stream', // .glb 文件
      'application/vnd.autodesk.fbx', // .fbx 文件
      // HDR
      'image/vnd.radiance',
      // 其他
      'application/json',
      'text/plain',
    ]
  }

  /**
   * 获取默认允许的文件扩展名
   */
  static getDefaultAllowedExtensions(): string[] {
    return [
      // 图片
      '.jpg',
      '.jpeg',
      '.png',
      '.gif',
      '.webp',
      '.svg',
      '.bmp',
      '.tga',
      // 3D 模型
      '.glb',
      '.gltf',
      '.fbx',
      '.obj',
      '.stl',
      '.dae',
      '.3ds',
      // HDR
      '.hdr',
      '.exr',
      // 其他
      '.json',
      '.txt',
    ]
  }

  /**
   * 获取允许的文件类型（兼容旧接口）
   */
  static getAllowedMimeTypes(): string[] {
    return StorageService.getDefaultAllowedMimeTypes()
  }

  /**
   * 判断路径是否为外部 URL
   */
  static isExternalUrl(value: string): boolean {
    return /^https?:\/\//i.test(value)
  }

  /**
   * 验证文件类型（兼容旧接口）
   */
  static isAllowedMimeType(mimeType: string): boolean {
    return StorageService.getDefaultAllowedMimeTypes().includes(mimeType)
  }

  /**
   * 获取最大文件大小（字节）
   */
  static getMaxFileSize(): number {
    return parseInt(process.env.MAX_FILE_SIZE || '52428800', 10) // 默认 50MB
  }
}

/**
 * 存储错误类
 */
export class StorageError extends Error {
  public code: string

  constructor(message: string, code: string = 'STORAGE_ERROR') {
    super(message)
    this.name = 'StorageError'
    this.code = code
  }
}

// 导出单例实例
export const storageService = new StorageService()
