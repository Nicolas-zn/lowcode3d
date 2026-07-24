/**
 * 用户信息接口
 */
export interface IUser {
  id: string
  email: string
  nickname?: string
  avatarUrl?: string
  createdAt: Date
  updatedAt: Date
}

/**
 * 项目信息接口
 */
export interface IProject {
  id: string
  name: string
  description?: string
  ownerId: string
  thumbnailUrl?: string
  isPublic: boolean
  status: 'draft' | 'published' | 'archived'
  sceneData: ISceneData | null
  settings: IProjectSettings
  createdAt: Date
  updatedAt: Date
}

/**
 * 项目设置
 */
export interface IProjectSettings {
  width: number
  height: number
  backgroundColor: string
  fogEnabled: boolean
  fogColor?: string
  fogDensity?: number
}

/**
 * 场景数据结构
 */
export interface ISceneData {
  version: string
  objects: ISceneObject[]
  lights: ILightConfig[]
  camera: ICameraConfig
  environment?: IEnvironmentConfig
  animations?: IAnimationTrack[]
}

/**
 * 场景对象接口
 */
export interface ISceneObject {
  uuid: string
  name: string
  type: 'mesh' | 'group' | 'model' | 'light' | 'camera'
  visible: boolean
  locked: boolean
  position: IVector3
  rotation: IVector3
  scale: IVector3
  children?: ISceneObject[]
  materialId?: string
  geometryType?: string
  modelUrl?: string
  userData?: Record<string, unknown>
}

/**
 * 三维向量
 */
export interface IVector3 {
  x: number
  y: number
  z: number
}

/**
 * 灯光配置
 */
export interface ILightConfig {
  uuid: string
  name: string
  type: 'ambient' | 'directional' | 'point' | 'spot'
  color: string
  intensity: number
  position?: IVector3
  target?: IVector3
  castShadow?: boolean
  distance?: number
  decay?: number
  angle?: number
  penumbra?: number
}

/**
 * 相机配置
 */
export interface ICameraConfig {
  type: 'perspective' | 'orthographic'
  position: IVector3
  target: IVector3
  fov?: number
  near: number
  far: number
  zoom?: number
}

/**
 * 环境配置
 */
export interface IEnvironmentConfig {
  background: string | null
  environmentMap?: string
  fog?: {
    type: 'linear' | 'exponential'
    color: string
    near?: number
    far?: number
    density?: number
  }
}

/**
 * 动画轨道
 */
export interface IAnimationTrack {
  id: string
  targetUUID: string
  property: string
  keyframes: IKeyframe[]
}

/**
 * 关键帧
 */
export interface IKeyframe {
  time: number
  value: number | IVector3
  easing: 'linear' | 'easeIn' | 'easeOut' | 'easeInOut'
}

/**
 * 交互事件配置
 */
export interface IEventConfig {
  trigger: 'click' | 'hover' | 'doubleClick'
  action: 'openLink' | 'playAnimation' | 'switchCamera' | 'showPopup' | 'runScript'
  payload: Record<string, unknown>
}

/**
 * API 响应基础结构
 */
export interface IApiResponse<T = unknown> {
  success: boolean
  data?: T
  message?: string
  error?: string
}

/**
 * 分页响应
 */
export interface IPaginatedResponse<T> extends IApiResponse<T[]> {
  total: number
  page: number
  pageSize: number
}

// Project Data Types (for save/load)
export * from './projectData.js'
export * from './component.js'
export * from './events.js'
export * from './dataBinding.js'
export * from './runtime.js'
