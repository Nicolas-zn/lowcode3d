/**
 * 事件系统模块导出
 */
export { eventBus } from './EventBus'
export type { EventName, Payload, Callback } from './EventBus'
export { RuntimeEventSystem } from './RuntimeEventSystem'

export { EventNames } from './EventTypes'
export type {
  EventBusEventMap,
  // Scene Object
  ObjectAddedPayload,
  ObjectRemovedPayload,
  ObjectUpdatedPayload,
  // Selection
  SelectionChangedPayload,
  // Transform
  TransformChangedPayload,
  // Property
  PropertyChangedPayload,
  // History
  HistoryChangedPayload,
  // Scene Lifecycle
  SceneLoadedPayload,
  SceneClearedPayload,
  // Editor
  EditorMode,
  ModeChangedPayload,
  ResizePayload,
  SnappingChangedPayload,
  GroupPayload,
  ToggleSpacePayload,
  // Material
  ApplyMaterialPresetPayload,
  // Camera
  CameraChangedPayload,
  FocusObjectPayload,
  // Commands
  RequestAddObjectPayload,
  RequestRemoveObjectPayload,
  // Animation
  AnimationChangedPayload,
  RuntimePopupPayload,
  RuntimeMessagePayload,
} from './EventTypes'
