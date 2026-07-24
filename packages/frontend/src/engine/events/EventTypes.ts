/**
 * 全局事件类型映射
 *
 * 所有业务通信必须通过 EventBus，Three.js 只负责渲染。
 * 每个事件都有严格的 payload 类型定义，确保类型安全。
 */
import type * as THREE from 'three'
import type { IAssetManifestItem, ISceneObject } from '@lowcode3d/shared'
import type { ISelectionEvent } from '../interaction/SelectionManager'
import type { TransformMode } from '../interaction/TransformManager'
import type { ISnappingConfig, SnappingPreset } from '../helpers'

// ─── Scene Object Events ────────────────────────────────────────────────────

export interface ObjectAddedPayload {
  object: THREE.Object3D
  metadata?: ISceneObject
}

export interface ObjectRemovedPayload {
  id: string
}

export interface ObjectUpdatedPayload {
  id: string
  changes: Partial<ISceneObject>
}

// ─── Selection Events ───────────────────────────────────────────────────────

export type SelectionChangedPayload = ISelectionEvent

// ─── Transform Events ───────────────────────────────────────────────────────

export interface TransformChangedPayload {
  objectId?: string
}

// ─── Property Events ────────────────────────────────────────────────────────

export interface PropertyChangedPayload {
  target: object
  property: string
  value: unknown
}

// ─── History Events ─────────────────────────────────────────────────────────

export interface HistoryChangedPayload {
  canUndo: boolean
  canRedo: boolean
  undoName: string | null
  redoName: string | null
}

// ─── Scene Lifecycle Events ─────────────────────────────────────────────────

export interface SceneLoadedPayload {
  projectData: unknown
}

export interface SceneClearedPayload {}

// ─── Editor Mode Events ─────────────────────────────────────────────────────

export type EditorMode = 'browse' | 'select' | 'move' | 'rotate' | 'scale'

export interface ModeChangedPayload {
  mode: EditorMode
}

export type LeftSidebarTab =
  | 'scene'
  | 'models'
  | 'materials'
  | 'components'
  | 'annotations'
  | 'lights'

export interface OpenLeftSidebarTabPayload {
  tab: LeftSidebarTab
}

// ─── Viewport Events ────────────────────────────────────────────────────────

export interface ResizePayload {
  width: number
  height: number
}

// ─── Snapping Events ────────────────────────────────────────────────────────

export interface SnappingChangedPayload {
  enabled: boolean
  preset: SnappingPreset | null
  config: ISnappingConfig
}

// ─── Group Events ───────────────────────────────────────────────────────────

export interface GroupPayload {
  objectIds?: string[]
}

// ─── Material Events ────────────────────────────────────────────────────────

export interface ApplyMaterialPresetPayload {
  presetId: string
  targetId?: string
  /** 预设的具体材质属性（由 MaterialLibrary 传递给 MaterialPanel 同步 UI） */
  preset?: Record<string, unknown>
}

export interface ResourceRepairRequestedPayload {
  repairAssetId: string
  asset: IAssetManifestItem
}

// ─── Editor UI Events ───────────────────────────────────────────────────────

export interface ToggleSpacePayload {
  space?: 'world' | 'local'
}

// ─── Camera Events ──────────────────────────────────────────────────────────

export interface CameraChangedPayload {
  type?: 'perspective' | 'orthographic'
  preset?: 'front' | 'back' | 'left' | 'right' | 'top' | 'bottom'
}

export interface FocusObjectPayload {
  objectId: string
}

// ─── Command Events (用于从 UI 发起业务操作) ─────────────────────────────────

export interface RequestAddObjectPayload {
  type: string
  options?: Record<string, unknown>
}

export interface RequestRemoveObjectPayload {
  objectId: string
}

export interface RequestTransformPayload {
  objectId: string
  mode: TransformMode
}

// ─── Animation Events ──────────────────────────────────────────────────────

export interface AnimationChangedPayload {
  reason:
    | 'keyframe-added'
    | 'keyframe-removed'
    | 'timeline-settings'
    | 'clip-settings'
    | 'loaded'
    | 'cleared'
  objectId?: string
  propertyName?: string
  clipId?: string
}

// ─── Runtime Low-code Events ───────────────────────────────────────────────

export interface RuntimePopupPayload {
  title: string
  content: string
}

export interface RuntimeMessagePayload {
  name: string
  data?: unknown
}

// ─── 完整事件映射 ────────────────────────────────────────────────────────────

/**
 * EventBusEventMap: 所有事件名 → payload 类型的完整映射。
 * 新增事件时只需在此添加一行，即可获得全局类型推导。
 */
export interface EventBusEventMap {
  // Scene Object
  'scene:object-added': ObjectAddedPayload
  'scene:object-removed': ObjectRemovedPayload
  'scene:object-updated': ObjectUpdatedPayload

  // Selection
  'scene:selection-changed': SelectionChangedPayload

  // Transform
  'scene:transform-changed': TransformChangedPayload

  // Property
  'scene:property-changed': PropertyChangedPayload

  // History
  'history:changed': HistoryChangedPayload
  'history:undo': undefined
  'history:redo': undefined

  // Animation
  'animation:changed': AnimationChangedPayload

  // Runtime Low-code
  'runtime:popup': RuntimePopupPayload
  'runtime:message': RuntimeMessagePayload

  // Scene Lifecycle
  'scene:loaded': SceneLoadedPayload
  'scene:cleared': SceneClearedPayload
  'engine:initialized': undefined
  'engine:disposed': undefined

  // Editor Mode
  'editor:mode-changed': ModeChangedPayload

  // Viewport
  'viewport:resize': ResizePayload

  // Snapping
  'editor:snapping-changed': SnappingChangedPayload

  // Group
  'scene:group-selected': GroupPayload
  'scene:ungroup-selected': GroupPayload

  // Material
  'material:apply-preset': ApplyMaterialPresetPayload

  // Resources
  'resource:repair-requested': ResourceRepairRequestedPayload

  // Editor UI
  'editor:toggle-space': ToggleSpacePayload
  'editor:toggle-axes': undefined
  'editor:toggle-viewhelper': undefined
  'editor:save-project': undefined
  'editor:open-left-tab': OpenLeftSidebarTabPayload
  'editor:open-onboarding': undefined

  // Camera
  'camera:changed': CameraChangedPayload
  'camera:focus-object': FocusObjectPayload

  // Command Requests (UI → Engine)
  'command:add-object': RequestAddObjectPayload
  'command:remove-object': RequestRemoveObjectPayload
}

/**
 * 事件名称常量，避免魔法字符串
 */
export const EventNames = {
  // Scene Object
  OBJECT_ADDED: 'scene:object-added',
  OBJECT_REMOVED: 'scene:object-removed',
  OBJECT_UPDATED: 'scene:object-updated',

  // Selection
  SELECTION_CHANGED: 'scene:selection-changed',

  // Transform
  TRANSFORM_CHANGED: 'scene:transform-changed',

  // Property
  PROPERTY_CHANGED: 'scene:property-changed',

  // History
  HISTORY_CHANGED: 'history:changed',
  HISTORY_UNDO: 'history:undo',
  HISTORY_REDO: 'history:redo',

  // Animation
  ANIMATION_CHANGED: 'animation:changed',

  // Scene Lifecycle
  SCENE_LOADED: 'scene:loaded',
  SCENE_CLEARED: 'scene:cleared',
  ENGINE_INITIALIZED: 'engine:initialized',
  ENGINE_DISPOSED: 'engine:disposed',

  // Editor Mode
  MODE_CHANGED: 'editor:mode-changed',

  // Viewport
  RESIZE: 'viewport:resize',

  // Snapping
  SNAPPING_CHANGED: 'editor:snapping-changed',

  // Group
  GROUP_SELECTED: 'scene:group-selected',
  UNGROUP_SELECTED: 'scene:ungroup-selected',

  // Material
  APPLY_MATERIAL_PRESET: 'material:apply-preset',

  // Resources
  RESOURCE_REPAIR_REQUESTED: 'resource:repair-requested',

  // Editor UI
  TOGGLE_SPACE: 'editor:toggle-space',
  TOGGLE_AXES: 'editor:toggle-axes',
  TOGGLE_VIEWHELPER: 'editor:toggle-viewhelper',
  SAVE_PROJECT: 'editor:save-project',
  OPEN_ONBOARDING: 'editor:open-onboarding',

  // Camera
  CAMERA_CHANGED: 'camera:changed',
  FOCUS_OBJECT: 'camera:focus-object',

  // Commands
  CMD_ADD_OBJECT: 'command:add-object',
  CMD_REMOVE_OBJECT: 'command:remove-object',
} as const satisfies Record<string, keyof EventBusEventMap>
