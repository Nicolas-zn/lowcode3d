// 核心类
export { Engine, getEngine } from './core/Engine'
export { SceneManager } from './core/SceneManager'
export { RenderManager } from './core/RenderManager'
export { CameraManager } from './core/CameraManager'
export { SceneSerializer } from './core/SceneSerializer'
export { PostProcessingManager } from './core/PostProcessingManager'
export type {
  IBloomSettings,
  IOutlineSettings,
  IPostProcessingSettings,
} from './core/PostProcessingManager'

// 对象系统
export { ObjectFactory, ObjectManager } from './objects'
export type { IMeshOptions, IObjectEntry } from './objects'

// 交互系统
export { SelectionManager, TransformManager } from './interaction'
export type {
  ISelectionEvent,
  ISelectionManagerConfig,
  TransformMode,
  ITransformEvent,
  ITransformManagerConfig,
} from './interaction'

// 加载器系统
export { ModelLoader, getModelLoader, TextureLoaderService, getTextureLoader } from './loaders'
export type {
  IModelLoadOptions,
  IModelLoadResult,
  LoadProgressCallback,
  ITextureLoadOptions,
} from './loaders'

// 材质系统
export {
  MaterialManager,
  getMaterialManager,
  extractMaterials,
  getPrimaryMaterial,
  getMaterialProps,
} from './materials'
export type { IPBRMaterialProps, TextureSlot, ITextureInfo, IMaterialInfo } from './materials'

// 灯光系统
export { LightManager, getLightManager } from './lights'
export type { LightType, ILightOptions, ILightProps } from './lights'

// 历史记录系统
export {
  HistoryManager,
  getHistoryManager,
  BaseCommand,
  TransformCommand,
  AddObjectCommand,
  RemoveObjectCommand,
  PropertyChangeCommand,
} from './history'
export type { ICommand, IHistoryChangeEvent, IHistoryManagerConfig } from './history'

// 辅助工具系统
export {
  HelperManager,
  getHelperManager,
  HotkeyManager,
  getHotkeyManager,
  DEFAULT_HOTKEYS,
  SnappingManager,
  getSnappingManager,
  SNAPPING_PRESETS,
} from './helpers'
export type {
  IHelperConfig,
  IHotkeyConfig,
  HotkeyHandler,
  ISnappingConfig,
  SnappingPreset,
} from './helpers'

// 类型
export type {
  IEngine,
  IEngineConfig,
  ISceneManager,
  IRenderManager,
  ICameraManager,
  IVector3,
} from './types/IEngine'

export { LowCode3DViewer } from './LowCode3DViewer'
export type { ViewerOptions } from './LowCode3DViewer'
export { ProjectRuntime } from './runtime'
export type {
  ProjectRuntimeLoadPhase,
  ProjectRuntimeLoadState,
  ProjectRuntimeLoadWarning,
  ProjectRuntimeOptions,
  ProjectRuntimeProgressEvent,
} from './runtime'
export * from './components'
export * from './data'
