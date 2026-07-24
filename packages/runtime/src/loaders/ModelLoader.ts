/**
 * 模型加载器
 * 封装 GLTFLoader 和 FBXLoader 等，提供统一的模型加载接口
 */
import * as THREE from 'three'
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js'
import { markModelRootForSelection } from '../utils/modelSelection'

/**
 * 加载进度回调
 */
export type LoadProgressCallback = (progress: number) => void

/**
 * 模型加载选项
 */
export interface IModelLoadOptions {
  /** 是否启用 DRACO 解压 */
  useDraco?: boolean
  /** 进度回调 */
  onProgress?: LoadProgressCallback
  /** 是否自动居中模型 */
  center?: boolean
  /** 是否自动缩放模型 */
  autoScale?: boolean
  /** 目标尺寸（自动缩放时使用） */
  targetSize?: number
}

/**
 * 加载结果
 */
export interface IModelLoadResult {
  /** 模型 Group */
  model: THREE.Group
  /** 原始 GLTF 数据 (仅 GLTF/GLB) */
  gltf?: GLTF
  /** 动画 Clips */
  animations: THREE.AnimationClip[]
  /** 包围盒 */
  boundingBox: THREE.Box3
  /** 模型尺寸 */
  size: THREE.Vector3
}

/**
 * 模型加载器类
 */
export class ModelLoader {
  private static _instance: ModelLoader | null = null

  private _gltfLoader: GLTFLoader
  private _dracoLoader: DRACOLoader
  private _fbxLoader: FBXLoader
  private _loadingManager: THREE.LoadingManager

  /** 加载中的任务 */
  private _loadingTasks: Map<string, Promise<IModelLoadResult>> = new Map()

  constructor() {
    // 创建加载管理器
    this._loadingManager = new THREE.LoadingManager()

    // 创建 DRACO 加载器
    this._dracoLoader = new DRACOLoader(this._loadingManager)
    // 使用本地 decoder，满足私有化和断网部署场景。
    this._dracoLoader.setDecoderPath('/draco/')
    this._dracoLoader.setDecoderConfig({ type: 'js' })

    // 创建 GLTF 加载器
    this._gltfLoader = new GLTFLoader(this._loadingManager)
    this._gltfLoader.setDRACOLoader(this._dracoLoader)

    // 创建 FBX 加载器
    this._fbxLoader = new FBXLoader(this._loadingManager)
  }

  /**
   * 获取单例实例
   */
  static getInstance(): ModelLoader {
    if (!ModelLoader._instance) {
      ModelLoader._instance = new ModelLoader()
    }
    return ModelLoader._instance
  }

  /**
   * 加载模型
   * @param url 模型 URL
   * @param options 加载选项
   */
  async loadModel(url: string, options: IModelLoadOptions = {}): Promise<IModelLoadResult> {
    // 检查是否正在加载相同的模型
    const existingTask = this._loadingTasks.get(url)
    if (existingTask) {
      return existingTask
    }

    const { onProgress } = options

    // 创建加载任务
    const loadTask = new Promise<IModelLoadResult>((resolve, reject) => {
      const ext = url.split('.').pop()?.toLowerCase() || ''
      const isFbx = ext === 'fbx'

      const onProgressCallback = (event: ProgressEvent) => {
        if (event.lengthComputable && onProgress) {
          const progress = (event.loaded / event.total) * 100
          onProgress(progress)
        }
      }

      const onError = (error: unknown) => {
        this._loadingTasks.delete(url)
        console.error('Failed to load model:', url, error)
        reject(new Error(`Failed to load model: ${url}`))
      }

      if (isFbx) {
        this._fbxLoader.load(
          url,
          (object) => {
            this._processLoadedModel(object, undefined, url, options, resolve)
          },
          onProgressCallback,
          onError
        )
      } else {
        this._gltfLoader.load(
          url,
          (gltf) => {
            this._processLoadedModel(gltf.scene, gltf, url, options, resolve)
          },
          onProgressCallback,
          onError
        )
      }
    })

    this._loadingTasks.set(url, loadTask)
    return loadTask
  }

  /**
   * 处理加载后的模型数据
   */
  private _processLoadedModel(
    object: THREE.Group | THREE.Object3D,
    gltf: GLTF | undefined,
    url: string,
    options: IModelLoadOptions,
    resolve: (value: IModelLoadResult) => void
  ) {
    const { center = true, autoScale = false, targetSize = 2 } = options

    let model: THREE.Group
    // 确保模型包裹在 Group 中
    if (object instanceof THREE.Group) {
      model = object
    } else {
      model = new THREE.Group()
      model.add(object)
    }

    model.name = this._extractModelName(url)

    // 获取动画
    // FBXLoader 返回的对象通常包含 animations 数组
    // GLTF 则在 gltf对象的 animations 属性
    const animations = gltf ? gltf.animations || [] : (object as any).animations || []

    // 计算包围盒
    const boundingBox = new THREE.Box3().setFromObject(model)
    const size = new THREE.Vector3()
    boundingBox.getSize(size)

    // 居中处理
    if (center) {
      const centerPoint = new THREE.Vector3()
      boundingBox.getCenter(centerPoint)
      model.position.sub(centerPoint)
      model.position.y += size.y / 2 // 让模型底部在原点
    }

    // 自动缩放
    if (autoScale) {
      const maxDim = Math.max(size.x, size.y, size.z)
      if (maxDim > 0) {
        const scale = targetSize / maxDim
        model.scale.setScalar(scale)
      }
    }

    // 设置阴影
    model.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true
        child.receiveShadow = true
      }
    })

    // 标记为模型根，点击子 Mesh 时默认选择整体模型
    markModelRootForSelection(model, { modelUrl: url })

    const result: IModelLoadResult = {
      model,
      gltf,
      animations,
      boundingBox,
      size,
    }

    this._loadingTasks.delete(url)
    resolve(result)
  }

  /**
   * 批量加载模型
   * @param urls 模型 URL 列表
   * @param onTotalProgress 总进度回调
   */
  async loadModels(
    urls: string[],
    onTotalProgress?: (progress: number, current: number, total: number) => void
  ): Promise<IModelLoadResult[]> {
    const results: IModelLoadResult[] = []
    const total = urls.length

    for (let i = 0; i < total; i++) {
      const result = await this.loadModel(urls[i], {
        onProgress: (progress) => {
          if (onTotalProgress) {
            const totalProgress = ((i + progress / 100) / total) * 100
            onTotalProgress(totalProgress, i + 1, total)
          }
        },
      })
      results.push(result)
    }

    return results
  }

  /**
   * 克隆已加载的模型
   * @param model 原始模型
   */
  cloneModel(model: THREE.Group): THREE.Group {
    const cloned = model.clone()

    // 深度克隆材质
    cloned.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        if (Array.isArray(child.material)) {
          child.material = child.material.map((mat) => mat.clone())
        } else if (child.material) {
          child.material = child.material.clone()
        }
      }
    })

    // 生成新的 UUID
    cloned.uuid = THREE.MathUtils.generateUUID()

    // 确保 userData 被正确复制，并用新 UUID 重建模型根选择关系
    cloned.userData = { ...model.userData }
    markModelRootForSelection(cloned, {
      modelUrl: cloned.userData.modelUrl,
      libraryId: cloned.userData.libraryId,
      isUserImported: cloned.userData.isUserImported,
      importedFileName: cloned.userData.importedFileName,
    })

    return cloned
  }

  /**
   * 预加载模型（不返回结果，用于缓存）
   */
  async preload(urls: string[]): Promise<void> {
    await Promise.all(
      urls.map((url) =>
        this.loadModel(url).catch((err) => {
          console.warn('Failed to preload model:', url, err)
        })
      )
    )
  }

  /**
   * 取消正在进行的加载任务
   */
  cancelLoading(url: string): boolean {
    return this._loadingTasks.delete(url)
  }

  /**
   * 取消所有加载任务
   */
  cancelAll(): void {
    this._loadingTasks.clear()
  }

  /**
   * 检查是否正在加载
   */
  isLoading(url: string): boolean {
    return this._loadingTasks.has(url)
  }

  /**
   * 获取正在加载的任务数量
   */
  get loadingCount(): number {
    return this._loadingTasks.size
  }

  /**
   * 从 URL 提取模型名称
   */
  private _extractModelName(url: string): string {
    const parts = url.split('/')
    const filename = parts[parts.length - 1]
    return filename.replace(/\.(gltf|glb|fbx)$/i, '')
  }

  /**
   * 释放资源
   */
  dispose(): void {
    this._dracoLoader.dispose()
    this._loadingTasks.clear()
  }
}

// 导出单例获取函数
export function getModelLoader(): ModelLoader {
  return ModelLoader.getInstance()
}
