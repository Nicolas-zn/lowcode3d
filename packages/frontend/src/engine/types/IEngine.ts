import type * as THREE from 'three'
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import type { AnimationEngine } from '../animation'

/**
 * 向量3接口
 */
export interface IVector3 {
  x: number
  y: number
  z: number
}

/**
 * 场景管理器接口
 */
export interface ISceneManager {
  scene: THREE.Scene
  setBackgroundColor(color: string | number): void
  setEnvironmentMap(url: string): Promise<void>
  addObject(object: THREE.Object3D): void
  removeObject(object: THREE.Object3D): void
  clear(): void
  dispose(): void
}

/**
 * 渲染管理器接口
 */
export interface IRenderManager {
  renderer: THREE.WebGLRenderer
  domElement: HTMLCanvasElement
  setSize(width: number, height: number): void
  setPixelRatio(ratio: number): void
  enableShadows(enabled: boolean): void
  render(scene: THREE.Scene, camera: THREE.Camera): void
  startRenderLoop(callback: () => void): void
  stopRenderLoop(): void
  dispose(): void
}

/**
 * 相机管理器接口
 */
export interface ICameraManager {
  camera: THREE.PerspectiveCamera | THREE.OrthographicCamera
  controls: OrbitControls
  setPosition(x: number, y: number, z: number): void
  setTarget(x: number, y: number, z: number): void
  setFov(fov: number): void
  switchToPerspective(): void
  switchToOrthographic(): void
  focusOnObject(object: THREE.Object3D, offset?: number): void
  setViewPreset(preset: 'front' | 'back' | 'left' | 'right' | 'top' | 'bottom'): void
  update(): void
  dispose(): void
}

/**
 * 引擎配置接口
 */
export interface IEngineConfig {
  container: HTMLElement
  antialias?: boolean
  pixelRatio?: number
  backgroundColor?: string | number
  enableShadows?: boolean
  shadowMapType?: THREE.ShadowMapType
}

/**
 * 引擎主接口
 */
export interface IEngine {
  sceneManager: ISceneManager
  renderManager: IRenderManager
  cameraManager: ICameraManager
  animationEngine: AnimationEngine
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  objectManager: any // 使用 any 避免循环依赖，实际类型在实现类中指定
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  selectionManager: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  transformManager: any

  init(config: IEngineConfig): void
  resize(): void
  render(): void
  dispose(): void
}
