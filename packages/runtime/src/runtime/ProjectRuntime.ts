import type { IProjectData } from '@lowcode3d/shared'
import { migrateProjectData } from '@lowcode3d/shared'
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js'
import { Engine } from '../core/Engine'
import { SceneSerializer } from '../core/SceneSerializer'
import { eventBus, type EventName, type Payload } from '../events'
import { RuntimeEventSystem } from '../events'
import { RuntimeDataBinding, RuntimeDataSource } from '../data'
import { getModelLoader, getTextureLoader } from '../loaders'

export interface ProjectRuntimeOptions {
  backgroundColor?: string
  enableShadows?: boolean
  antialias?: boolean
  pixelRatio?: number
  onProgress?: (event: ProjectRuntimeProgressEvent) => void
  onWarning?: (message: string, detail?: unknown) => void
  onError?: (error: unknown) => void
}

export type ProjectRuntimeLoadPhase =
  | 'idle'
  | 'init'
  | 'migrate'
  | 'preload'
  | 'deserialize'
  | 'data'
  | 'ready'
  | 'error'

export interface ProjectRuntimeProgressEvent {
  phase: Exclude<ProjectRuntimeLoadPhase, 'idle'>
  progress: number
  message: string
}

export interface ProjectRuntimeLoadWarning {
  message: string
  detail?: unknown
}

export interface ProjectRuntimeLoadState {
  phase: ProjectRuntimeLoadPhase
  progress: number
  message: string
  errors: unknown[]
  warnings: ProjectRuntimeLoadWarning[]
}

interface ResourcePreloadTask {
  key: string
  label: string
  load: () => Promise<unknown>
}

/**
 * 统一项目运行时入口。
 * 负责承接 SDK、预览页和后续发布页的共同运行时能力。
 */
export class ProjectRuntime {
  private engine: Engine
  private options: ProjectRuntimeOptions = {}
  private eventSystem: RuntimeEventSystem
  private dataSource: RuntimeDataSource
  private dataBinding: RuntimeDataBinding
  private loadErrors: unknown[] = []
  private loadWarnings: ProjectRuntimeLoadWarning[] = []
  private loadState: ProjectRuntimeLoadState = {
    phase: 'idle',
    progress: 0,
    message: '',
    errors: this.loadErrors,
    warnings: this.loadWarnings,
  }

  constructor() {
    this.engine = Engine.getInstance()
    this.eventSystem = new RuntimeEventSystem(this.engine)
    this.dataSource = new RuntimeDataSource()
    this.dataBinding = new RuntimeDataBinding(this.engine)
  }

  init(container: HTMLElement, options: ProjectRuntimeOptions = {}): void {
    this.options = options
    this.notifyProgress('init', 0, '初始化运行时')

    if (!this.engine.isInitialized) {
      this.engine.init({
        container,
        backgroundColor: options.backgroundColor,
        enableShadows: options.enableShadows,
        antialias: options.antialias,
        pixelRatio: options.pixelRatio,
      })
    }

    this.eventSystem.attach(container)
    window.addEventListener('resize', this.onResize)
    this.notifyProgress('init', 20, '运行时初始化完成')
  }

  async loadProject(projectData: IProjectData): Promise<IProjectData> {
    this.resetLoadState()
    try {
      this.notifyProgress('migrate', 25, '迁移项目数据')
      const migrated = migrateProjectData(projectData)

      this.notifyProgress('preload', 40, '预加载项目资源')
      await this.preloadProjectResources(migrated)

      this.notifyProgress('deserialize', 70, '重建运行时场景')
      await SceneSerializer.deserialize(migrated)
      this.applyPostProcessing(migrated)
      this.eventSystem.bindProject(migrated)
      this.dataSource.bindDataSources(migrated.dataSources)
      this.dataBinding.bindBindings(migrated.bindings)

      this.notifyProgress('data', 90, '刷新初始数据源')
      await this.refreshInitialDataSources(migrated)

      this.notifyProgress('ready', 100, '项目加载完成')
      return migrated
    } catch (error) {
      this.recordLoadError(error)
      this.notifyProgress('error', 100, '项目加载失败')
      this.options.onError?.(error)
      throw error
    }
  }

  async loadScene(projectData: IProjectData): Promise<IProjectData> {
    return this.loadProject(projectData)
  }

  getLoadState(): ProjectRuntimeLoadState {
    return {
      phase: this.loadState.phase,
      progress: this.loadState.progress,
      message: this.loadState.message,
      errors: [...this.loadErrors],
      warnings: this.loadWarnings.map((warning) => ({ ...warning })),
    }
  }

  setDataSourceData(sourceId: string, data: unknown): void {
    this.dataSource.setDataSourceData(sourceId, data)
    this.dataBinding.applyBindings(sourceId, data)
  }

  getDataSourceData(sourceId: string): unknown {
    return this.dataSource.getDataSourceData(sourceId)
  }

  async refreshDataSource(sourceId: string): Promise<unknown> {
    const data = await this.dataSource.refreshDataSource(sourceId)
    this.dataBinding.applyBindings(sourceId, data)
    return data
  }

  playAnimation(clipId?: string): void {
    this.engine.animationEngine?.play(clipId)
  }

  applyPostProcessing(projectData: IProjectData): void {
    this.engine.renderManager?.applyProjectPostProcessing(projectData.postProcessing)
  }

  pauseAnimation(clipId?: string): void {
    this.engine.animationEngine?.pause(clipId)
  }

  stopAnimation(clipId?: string): void {
    this.engine.animationEngine?.stop(clipId)
  }

  setObjectVisible(objectId: string, visible: boolean): boolean {
    const object =
      this.engine.objectManager?.getObject(objectId) ||
      this.engine.sceneManager?.scene.getObjectByProperty('uuid', objectId)

    if (!object) {
      this.recordLoadWarning(`对象不存在，无法设置可见性：${objectId}`)
      return false
    }

    object.visible = visible
    eventBus.emit('scene:object-updated', {
      id: objectId,
      changes: { visible },
    })
    return true
  }

  focusObject(objectId: string, padding = 1.5): boolean {
    const object =
      this.engine.objectManager?.getObject(objectId) ||
      this.engine.sceneManager?.scene.getObjectByProperty('uuid', objectId)

    if (!object) {
      this.recordLoadWarning(`对象不存在，无法聚焦：${objectId}`)
      return false
    }

    this.engine.cameraManager.focusOnObject(object, padding, true)
    return true
  }

  takeScreenshot(mimeType = 'image/png', quality = 1): string {
    return this.engine.renderManager.takeScreenshot(mimeType, quality)
  }

  emit<E extends EventName>(
    event: E,
    ...args: Payload<E> extends undefined ? [] : [payload: Payload<E>]
  ): void
  emit(event: EventName, payload?: unknown): void {
    const emit = eventBus.emit as (event: EventName, payload?: unknown) => void
    if (arguments.length === 1) {
      emit(event)
      return
    }

    emit(event, payload)
  }

  resize(): void {
    this.engine.resize()
  }

  dispose(): void {
    window.removeEventListener('resize', this.onResize)
    this.eventSystem.dispose()
    this.dataSource.clear()
    Engine.destroyInstance()
  }

  private async preloadProjectResources(projectData: IProjectData): Promise<void> {
    const tasks = [
      ...this.preloadOriginModels(projectData),
      ...this.preloadOriginTextures(projectData),
      ...this.preloadOriginHdris(projectData),
    ]

    if (tasks.length === 0) {
      this.notifyProgress('preload', 55, '无外部资源需要预加载')
      return
    }

    let completed = 0

    await Promise.all(
      tasks.map(async (task) => {
        try {
          await task.load()
        } catch (error) {
          this.recordLoadWarning(`资源预加载失败：${task.label}`, error)
        } finally {
          completed += 1
          const progress = 40 + Math.round((completed / tasks.length) * 20)
          this.notifyProgress('preload', progress, `预加载资源 ${completed}/${tasks.length}`)
        }
      })
    )
  }

  private preloadOriginModels(projectData: IProjectData): ResourcePreloadTask[] {
    const seen = new Set<string>()

    return projectData.origin.models
      .filter((model) => model.url && !model.url.startsWith('__primitive__:'))
      .filter((model) => {
        if (seen.has(model.url)) return false
        seen.add(model.url)
        return true
      })
      .map((model) => ({
        key: model.url,
        label: model.name || model.url,
        load: () =>
          getModelLoader().loadModel(model.url, {
            center: true,
          }),
      }))
  }

  private preloadOriginTextures(projectData: IProjectData): ResourcePreloadTask[] {
    const urls = new Map<string, string>()

    projectData.origin.textures.forEach((texture) => {
      if (texture.url) urls.set(texture.url, texture.name || texture.url)
    })

    this.collectSceneTextureUrls(projectData.sceneObjects).forEach(({ url, label }) => {
      if (url) urls.set(url, label)
    })

    return Array.from(urls.entries()).map(([url, label]) => ({
      key: url,
      label,
      load: () => getTextureLoader().loadTexture(url),
    }))
  }

  private preloadOriginHdris(projectData: IProjectData): ResourcePreloadTask[] {
    const rgbeLoader = new RGBELoader()
    const seen = new Set<string>()

    return projectData.origin.hdris
      .filter((hdri) => hdri.url)
      .filter((hdri) => {
        if (seen.has(hdri.url)) return false
        seen.add(hdri.url)
        return true
      })
      .map((hdri) => ({
        key: hdri.url,
        label: hdri.name || hdri.url,
        load: () =>
          new Promise((resolve, reject) => {
            rgbeLoader.load(
              hdri.url,
              (texture) => {
                texture.dispose()
                resolve(texture)
              },
              undefined,
              reject
            )
          }),
      }))
  }

  private collectSceneTextureUrls(
    objects: IProjectData['sceneObjects']
  ): Array<{ url: string; label: string }> {
    const urls: Array<{ url: string; label: string }> = []

    objects.forEach((object) => {
      if (object.billboardData?.texture) {
        urls.push({ url: object.billboardData.texture, label: `${object.name} 正面纹理` })
      }
      if (object.billboardData?.backTexture) {
        urls.push({ url: object.billboardData.backTexture, label: `${object.name} 背面纹理` })
      }

      const textures = object.materialOverrides?.textures
      if (textures) {
        Object.entries(textures).forEach(([slot, texture]) => {
          if (texture?.url) {
            urls.push({ url: texture.url, label: `${object.name} ${slot}` })
          }
        })
      }

      if (object.children?.length) {
        urls.push(...this.collectSceneTextureUrls(object.children))
      }
    })

    return urls
  }

  private onResize = (): void => {
    this.resize()
  }

  private resetLoadState(): void {
    this.loadErrors = []
    this.loadWarnings = []
    this.loadState = {
      phase: 'idle',
      progress: 0,
      message: '',
      errors: this.loadErrors,
      warnings: this.loadWarnings,
    }
  }

  private recordLoadWarning(message: string, detail?: unknown): void {
    const warning = { message, detail }
    this.loadWarnings.push(warning)
    this.loadState.warnings = this.loadWarnings
    this.options.onWarning?.(message, detail)
  }

  private recordLoadError(error: unknown): void {
    this.loadErrors.push(error)
    this.loadState.errors = this.loadErrors
  }

  private notifyProgress(
    phase: ProjectRuntimeProgressEvent['phase'],
    progress: number,
    message: string
  ): void {
    this.loadState = {
      phase,
      progress,
      message,
      errors: this.loadErrors,
      warnings: this.loadWarnings,
    }
    this.options.onProgress?.({ phase, progress, message })
  }

  private async refreshInitialDataSources(projectData: IProjectData): Promise<void> {
    for (const source of projectData.dataSources.filter((item) => item.enabled)) {
      try {
        const data = await this.dataSource.refreshDataSource(source.id)
        this.dataBinding.applyBindings(source.id, data)
      } catch (error) {
        this.recordLoadWarning(`数据源刷新失败：${source.name}`, error)
      }
    }
  }
}
