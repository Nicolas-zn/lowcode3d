/**
 * 项目数据类型定义
 * 用于保存/加载场景，不序列化整个 THREE.js scene
 */

import type { IVector3 } from './index.js'
import type { ComponentInstance } from './component.js'
import type { DataBindingConfig, DataSourceConfig } from './dataBinding.js'
import type { RuntimeEventConfig } from './events.js'
import type { PostProcessingData, PublishConfig, RuntimeConfig } from './runtime.js'

/**
 * 模型资源来源
 */
export interface IModelOrigin {
  /** 唯一标识 */
  id: string
  /** 模型库项ID（从模型库拖拽来的） */
  libraryId?: string
  /** 模型URL或 "__primitive__:box" 这类内置基础形状格式 */
  url: string
  /** 模型名称 */
  name: string
  /** 分类 */
  category?: string
}

/**
 * 纹理资源来源
 */
export interface ITextureOrigin {
  id: string
  url: string
  name: string
  type: 'diffuse' | 'normal' | 'roughness' | 'metalness' | 'ao' | 'emissive'
}

/**
 * HDRI环境贴图来源
 */
export interface IHDRIOrigin {
  id: string
  url: string
  name: string
}

/**
 * 原始资源记录
 */
export interface IOriginResources {
  /** 加载的外部模型 */
  models: IModelOrigin[]
  /** 加载的纹理 */
  textures: ITextureOrigin[]
  /** 加载的HDRI环境贴图 */
  hdris: IHDRIOrigin[]
}

/**
 * 基础几何体类型
 */
export type PrimitiveType =
  | 'box'
  | 'sphere'
  | 'cylinder'
  | 'cone'
  | 'torus'
  | 'plane'
  | 'circle'
  | 'ring'
  | 'tetrahedron'
  | 'octahedron'
  | 'icosahedron'
  | 'dodecahedron'

/**
 * 基础几何体参数
 */
export interface IPrimitiveParams {
  // Box
  width?: number
  height?: number
  depth?: number
  // Sphere
  radius?: number
  widthSegments?: number
  heightSegments?: number
  // Cylinder
  radiusTop?: number
  radiusBottom?: number
  radialSegments?: number
  // Cone (使用 radius, height, radialSegments)
  // Torus
  tube?: number
  tubularSegments?: number
  // Plane (使用 width, height)
  // Circle
  segments?: number
  // Ring
  innerRadius?: number
  outerRadius?: number
  thetaSegments?: number
  // Polyhedron
  detail?: number
}

/**
 * 材质覆盖属性
 */
export type MaterialTextureSlot =
  | 'map'
  | 'normalMap'
  | 'roughnessMap'
  | 'metalnessMap'
  | 'aoMap'
  | 'emissiveMap'
  | 'alphaMap'

export type MaterialTextureColorSpace = 'srgb' | 'linear' | 'none'

export interface IMaterialTextureData {
  originId?: string
  url: string
  repeat: [number, number]
  offset: [number, number]
  rotation: number
  colorSpace: MaterialTextureColorSpace
  wrapS?: 'repeat' | 'clamp' | 'mirror'
  wrapT?: 'repeat' | 'clamp' | 'mirror'
}

export interface IMaterialOverrides {
  presetId?: string
  presetName?: string
  color?: string
  metalness?: number
  roughness?: number
  opacity?: number
  transparent?: boolean
  emissive?: string
  emissiveIntensity?: number
  wireframe?: boolean
  side?: 'front' | 'back' | 'double'
  textures?: Partial<Record<MaterialTextureSlot, IMaterialTextureData>>
}

/**
 * 变换数据
 */
export interface ITransformData {
  position: IVector3
  rotation: IVector3
  scale: IVector3
}

/**
 * 场景对象数据
 */
export interface ISceneObjectData {
  /** 唯一标识 */
  uuid: string
  /** 对象名称 */
  name: string
  /** 对象类型 */
  type: 'primitive' | 'model' | 'group' | 'light' | 'userModel' | 'mesh' | 'billboard'

  /** 广告牌数据 */
  billboardData?: {
    mode: 'NONE' | 'FULL' | 'Y_LOCK'
    animation?: 'NONE' | 'FLOAT' | 'SCALE'
    size: [number, number]
    texture: string
    backTexture?: string
    repeat?: [number, number]
    isVideo?: boolean
  }

  /** 对于基础几何体 */
  primitiveType?: PrimitiveType
  primitiveParams?: IPrimitiveParams

  /** 对于外部模型 - 引用 origin.models 中的 id */
  modelOriginId?: string

  /** 对于用户导入的本地模型 - 存储文件名（不含 URL） */
  importedFileName?: string

  /** 变换属性 */
  transform: ITransformData

  /** 材质属性修改 */
  materialOverrides?: IMaterialOverrides

  /** 显示状态 */
  visible: boolean
  /** 锁定状态 */
  locked: boolean

  /** 用户自定义数据 */
  userData?: Record<string, unknown>

  /** 子对象（用于 group） */
  children?: ISceneObjectData[]
}

/**
 * 灯光数据
 */
export interface ILightData {
  uuid: string
  name: string
  type: 'ambient' | 'directional' | 'point' | 'spot' | 'hemisphere'
  color: string
  intensity: number
  position?: IVector3
  target?: IVector3
  castShadow?: boolean
  distance?: number
  decay?: number
  angle?: number
  penumbra?: number
  groundColor?: string // for hemisphere light
}

/**
 * 相机数据
 */
export interface ICameraData {
  type: 'perspective' | 'orthographic'
  position: IVector3
  target: IVector3
  fov?: number
  near: number
  far: number
  zoom?: number
}

/**
 * 相机书签数据
 * 供事件动作 switchCamera 和编辑器快速视角复用。
 */
export interface CameraBookmarkData extends ICameraData {
  id: string
  name: string
  createdAt: string
  updatedAt: string
}

/**
 * 环境数据
 */
export interface IEnvironmentData {
  backgroundColor: string
  backgroundType?: 'color' | 'environment'
  hdriOriginId?: string
  fog?: {
    type: 'linear' | 'exponential'
    color: string
    near?: number
    far?: number
    density?: number
  }
}

/**
 * 用户操作类型
 */
export type UserOperationType =
  | 'add'
  | 'remove'
  | 'transform'
  | 'material'
  | 'visibility'
  | 'rename'
  | 'lock'
  | 'group'
  | 'ungroup'

/**
 * 用户操作记录
 */
export interface IUserOperation {
  id: string
  timestamp: string
  type: UserOperationType
  targetUuid: string
  data: Record<string, unknown>
}

/**
 * 动画关键帧数据
 * value 使用纯 JSON 值，避免在 SQLite 中持久化 THREE.js 类实例。
 */
export interface IAnimationKeyframeData {
  time: number
  value: number | number[]
  propertyName?: string
}

export type AnimationLoopMode = 'once' | 'repeat' | 'pingPong'

export interface IAnimationTargetRef {
  objectUuid: string
  componentId?: string
}

export interface IAnimationClipData {
  id: string
  name: string
  duration: number
  loop: AnimationLoopMode
  autoplay: boolean
  enabled: boolean
  trackIds: string[]
}

/**
 * 动画轨道数据
 */
export interface IAnimationTrackData {
  id?: string
  clipId?: string
  uuid: string
  objectName: string
  propertyName: string
  targetRef?: IAnimationTargetRef
  keyframes: IAnimationKeyframeData[]
  interpolation: number
  easing?: string
}

/**
 * 场景动画数据
 */
export interface IAnimationData {
  duration: number
  fps: number
  clips: IAnimationClipData[]
  tracks: IAnimationTrackData[]
}

/**
 * 项目资源依赖类型
 */
export type AssetManifestType =
  | 'model'
  | 'texture'
  | 'hdri'
  | 'billboard'
  | 'video'
  | 'localModel'
  | 'unknown'

/**
 * 项目资源依赖项
 */
export interface IAssetManifestItem {
  id: string
  type: AssetManifestType
  name: string
  url?: string
  hash?: string
  fileSize?: number
  mimeType?: string
  objectUuid?: string
  source: 'origin' | 'sceneObject' | 'material' | 'environment'
  usage: string[]
  referencedBy: string[]
  requiredForPublish: boolean
  status: 'ready' | 'localOnly' | 'embedded' | 'missing'
  publicAccess?: 'public' | 'private' | 'unknown'
  corsStatus?: 'ok' | 'blocked' | 'unknown'
}

/**
 * 项目资源依赖清单
 */
export interface IAssetManifest {
  generatedAt: string
  items: IAssetManifestItem[]
}

/**
 * 项目数据格式
 * 用于保存和导出项目
 */
export interface IProjectData {
  /** 数据版本号 */
  version: string
  /** 协议版本号 */
  schemaVersion: string
  /** 项目名称 */
  projectName: string
  /** 项目描述 */
  description?: string
  /** 创建时间 (ISO 8601) */
  createdAt: string
  /** 更新时间 (ISO 8601) */
  updatedAt: string

  /** 原始资源记录 - 加载的各类资源及其URL */
  origin: IOriginResources

  /** 场景对象列表 */
  sceneObjects: ISceneObjectData[]

  /** 低代码组件实例 */
  components: ComponentInstance[]

  /** 灯光配置 */
  lights: ILightData[]

  /** 相机配置 */
  camera: ICameraData

  /** 相机书签 */
  cameraBookmarks: CameraBookmarkData[]

  /** 环境配置 */
  environment: IEnvironmentData

  /** 动画数据 */
  animations?: IAnimationData

  /** 运行时交互事件 */
  events: RuntimeEventConfig[]

  /** 数据源配置 */
  dataSources: DataSourceConfig[]

  /** 属性数据绑定 */
  bindings: DataBindingConfig[]

  /** 运行时配置 */
  runtimeConfig: RuntimeConfig

  /** 后处理配置 */
  postProcessing: PostProcessingData

  /** 发布配置 */
  publishConfig: PublishConfig

  /** 项目资源依赖清单，用于发布检查和资源审计 */
  assetManifest?: IAssetManifest

  /** 用户操作记录（可选，用于记录操作历史） */
  userOperations?: IUserOperation[]
}

/** 当前数据版本 */
export const PROJECT_DATA_VERSION = '1.3.0'
