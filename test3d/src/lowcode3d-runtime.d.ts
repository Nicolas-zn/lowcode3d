declare module '@lowcode3d/runtime' {
  import type { IProjectData } from '@lowcode3d/shared'

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

  export interface ViewerOptions {
    backgroundColor?: string
    enableShadows?: boolean
    antialias?: boolean
    pixelRatio?: number
    onProgress?: (event: ProjectRuntimeProgressEvent) => void
    onWarning?: (message: string, detail?: unknown) => void
    onError?: (error: unknown) => void
  }

  export class LowCode3DViewer {
    constructor(container: HTMLElement, options?: ViewerOptions)
    init(options?: ViewerOptions): Promise<void>
    loadScene(config: IProjectData, modelMap?: Array<{ name: string; url: string }>): Promise<void>
    loadProject(config: IProjectData): Promise<IProjectData>
    dispose(): void
  }
}
