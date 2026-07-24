import type { IProjectData } from '@lowcode3d/shared'
import { ProjectRuntime } from './runtime'
import type { ProjectRuntimeLoadState, ProjectRuntimeOptions } from './runtime'
import type { EventName, Payload } from './events'

export interface ViewerOptions extends ProjectRuntimeOptions {
  backgroundColor?: string
  enableShadows?: boolean
  antialias?: boolean
  pixelRatio?: number
  onProgress?: ProjectRuntimeOptions['onProgress']
  onWarning?: ProjectRuntimeOptions['onWarning']
  onError?: ProjectRuntimeOptions['onError']
}

export class LowCode3DViewer {
  private runtime: ProjectRuntime
  private container: HTMLElement
  private options: ViewerOptions

  constructor(container: HTMLElement, options: ViewerOptions = {}) {
    this.container = container
    this.options = options
    this.runtime = new ProjectRuntime()
  }

  async init(options?: ViewerOptions): Promise<void> {
    this.options = {
      ...this.options,
      ...options,
    }
    this.runtime.init(this.container, this.options)
  }

  async loadScene(
    config: IProjectData,
    _modelMap?: Array<{ name: string; url: string }>
  ): Promise<void> {
    // 注意：modelMap 参数在当前版本中未使用
    // 如果需要支持用户导入的模型，需要在 SceneSerializer 中添加支持
    await this.runtime.loadScene(config)
  }

  async loadProject(config: IProjectData): Promise<IProjectData> {
    return this.runtime.loadProject(config)
  }

  getLoadState(): ProjectRuntimeLoadState {
    return this.runtime.getLoadState()
  }

  setDataSourceData(sourceId: string, data: unknown): void {
    this.runtime.setDataSourceData(sourceId, data)
  }

  refreshDataSource(sourceId: string): Promise<unknown> {
    return this.runtime.refreshDataSource(sourceId)
  }

  playAnimation(clipId?: string): void {
    this.runtime.playAnimation(clipId)
  }

  pauseAnimation(clipId?: string): void {
    this.runtime.pauseAnimation(clipId)
  }

  stopAnimation(clipId?: string): void {
    this.runtime.stopAnimation(clipId)
  }

  setObjectVisible(objectId: string, visible: boolean): boolean {
    return this.runtime.setObjectVisible(objectId, visible)
  }

  focusObject(objectId: string, padding?: number): boolean {
    return this.runtime.focusObject(objectId, padding)
  }

  takeScreenshot(mimeType?: string, quality?: number): string {
    return this.runtime.takeScreenshot(mimeType, quality)
  }

  emit<E extends EventName>(
    event: E,
    ...args: Payload<E> extends undefined ? [] : [payload: Payload<E>]
  ): void
  emit(event: EventName, payload?: unknown): void {
    const emit = this.runtime.emit as (event: EventName, payload?: unknown) => void
    if (arguments.length === 1) {
      emit(event)
      return
    }

    emit(event, payload)
  }

  dispose(): void {
    this.runtime.dispose()
  }
}
