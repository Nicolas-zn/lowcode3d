/**
 * 纹理加载器
 * 封装 THREE.TextureLoader，提供统一的纹理加载接口
 */
import * as THREE from 'three'

/**
 * 纹理加载选项
 */
export interface ITextureLoadOptions {
  /** 水平环绕方式 */
  wrapS?: THREE.Wrapping
  /** 垂直环绕方式 */
  wrapT?: THREE.Wrapping
  /** 放大滤波 */
  magFilter?: THREE.MagnificationTextureFilter
  /** 缩小滤波 */
  minFilter?: THREE.MinificationTextureFilter
  /** 各向异性过滤级别 */
  anisotropy?: number
  /** 是否翻转 Y 轴 */
  flipY?: boolean
  /** 颜色空间 */
  colorSpace?: THREE.ColorSpace
}

/**
 * 纹理加载器类
 */
export class TextureLoaderService {
  private static _instance: TextureLoaderService | null = null

  private _loader: THREE.TextureLoader
  private _cache: Map<string, THREE.Texture> = new Map()
  private _loadingTasks: Map<string, Promise<THREE.Texture>> = new Map()

  constructor() {
    this._loader = new THREE.TextureLoader()
  }

  /**
   * 获取单例实例
   */
  static getInstance(): TextureLoaderService {
    if (!TextureLoaderService._instance) {
      TextureLoaderService._instance = new TextureLoaderService()
    }
    return TextureLoaderService._instance
  }

  /**
   * 加载纹理
   */
  async loadTexture(url: string, options: ITextureLoadOptions = {}): Promise<THREE.Texture> {
    // 检查缓存
    const cached = this._cache.get(url)
    if (cached) {
      return cached
    }

    // 检查是否正在加载
    const existingTask = this._loadingTasks.get(url)
    if (existingTask) {
      return existingTask
    }

    // 创建加载任务
    const loadTask = new Promise<THREE.Texture>((resolve, reject) => {
      this._loader.load(
        url,
        (texture) => {
          // 应用选项
          this._applyOptions(texture, options)
          texture.userData.url = url

          // 缓存
          this._cache.set(url, texture)
          this._loadingTasks.delete(url)

          resolve(texture)
        },
        undefined,
        (error) => {
          this._loadingTasks.delete(url)
          reject(error)
        }
      )
    })

    this._loadingTasks.set(url, loadTask)
    return loadTask
  }

  /**
   * 应用纹理选项
   */
  private _applyOptions(texture: THREE.Texture, options: ITextureLoadOptions): void {
    const {
      wrapS = THREE.RepeatWrapping,
      wrapT = THREE.RepeatWrapping,
      magFilter = THREE.LinearFilter,
      minFilter = THREE.LinearMipmapLinearFilter,
      anisotropy = 4,
      flipY = true,
      colorSpace = THREE.SRGBColorSpace,
    } = options

    texture.wrapS = wrapS
    texture.wrapT = wrapT
    texture.magFilter = magFilter
    texture.minFilter = minFilter
    texture.anisotropy = anisotropy
    texture.flipY = flipY
    texture.colorSpace = colorSpace
  }

  /**
   * 从缓存获取纹理
   */
  getFromCache(url: string): THREE.Texture | undefined {
    return this._cache.get(url)
  }

  /**
   * 检查是否已缓存
   */
  isCached(url: string): boolean {
    return this._cache.has(url)
  }

  /**
   * 清除指定缓存
   */
  clearCache(url: string): boolean {
    const texture = this._cache.get(url)
    if (texture) {
      texture.dispose()
      this._cache.delete(url)
      return true
    }
    return false
  }

  /**
   * 清除所有缓存
   */
  clearAllCache(): void {
    this._cache.forEach((texture) => texture.dispose())
    this._cache.clear()
  }

  /**
   * 释放资源
   */
  dispose(): void {
    this.clearAllCache()
    this._loadingTasks.clear()
  }
}

// 导出单例获取函数
export function getTextureLoader(): TextureLoaderService {
  return TextureLoaderService.getInstance()
}
