import * as THREE from 'three'
import type { IRenderManager } from '../types/IEngine'
import { PostProcessingManager } from './PostProcessingManager'
import type { IPostProcessingSettings } from './PostProcessingManager'
import type { PostProcessingData } from '@lowcode3d/shared'
import { eventBus } from '../events'

/**
 * 渲染管理器
 * 封装 THREE.WebGLRenderer，处理渲染循环和窗口适配
 */
export class RenderManager implements IRenderManager {
  public renderer: THREE.WebGLRenderer
  private _animationId: number | null = null
  private _renderCallback: (() => void) | null = null
  private _container: HTMLElement | null = null

  // 后处理管理器
  private _postProcessingManager: PostProcessingManager | null = null

  constructor(container: HTMLElement, options?: Partial<THREE.WebGLRendererParameters>) {
    this._container = container

    // 创建渲染器
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
      logarithmicDepthBuffer: true,
      ...options,
    })

    // 基础配置
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.setSize(container.clientWidth, container.clientHeight)

    // 默认启用阴影
    this.enableShadows(true)

    // 色调映射
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1

    // 输出编码
    this.renderer.outputColorSpace = THREE.SRGBColorSpace

    // 添加到容器
    container.appendChild(this.renderer.domElement)

    // 监听窗口变化
    this._handleResize = this._handleResize.bind(this)
    window.addEventListener('resize', this._handleResize)
  }

  /**
   * 获取画布元素
   */
  get domElement(): HTMLCanvasElement {
    return this.renderer.domElement
  }

  /**
   * 获取后处理管理器
   */
  get postProcessingManager(): PostProcessingManager | null {
    return this._postProcessingManager
  }

  /**
   * 初始化后处理
   */
  initPostProcessing(scene: THREE.Scene, camera: THREE.Camera): void {
    if (this._postProcessingManager) {
      console.warn('PostProcessingManager already initialized')
      return
    }

    this._postProcessingManager = new PostProcessingManager(this.renderer, scene, camera)

    console.log('✨ PostProcessingManager initialized')
  }

  /**
   * 更新后处理相机
   */
  updatePostProcessingCamera(camera: THREE.Camera): void {
    this._postProcessingManager?.setCamera(camera)
  }

  /**
   * 应用后处理设置
   */
  applyPostProcessingSettings(settings: Partial<IPostProcessingSettings>): void {
    this._postProcessingManager?.applyAllSettings(settings)
  }

  applyProjectPostProcessing(settings: PostProcessingData): void {
    this._postProcessingManager?.applyProjectSettings(settings)
  }

  /**
   * 设置渲染尺寸
   */
  setSize(width: number, height: number): void {
    this.renderer.setSize(width, height)
    this._postProcessingManager?.resize(width, height)
  }

  /**
   * 设置像素比率
   */
  setPixelRatio(ratio: number): void {
    this.renderer.setPixelRatio(Math.min(ratio, 2))
  }

  /**
   * 启用/禁用阴影
   */
  enableShadows(enabled: boolean): void {
    this.renderer.shadowMap.enabled = enabled
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
  }

  /**
   * 设置阴影类型
   */
  setShadowMapType(type: THREE.ShadowMapType): void {
    this.renderer.shadowMap.type = type
  }

  /**
   * 设置色调映射
   */
  setToneMapping(mapping: THREE.ToneMapping, exposure: number = 1): void {
    this.renderer.toneMapping = mapping
    this.renderer.toneMappingExposure = exposure
  }

  /**
   * 渲染场景
   * 如果后处理已启用，使用 Composer 渲染
   */
  render(scene: THREE.Scene, camera: THREE.Camera): void {
    if (this._postProcessingManager && this._postProcessingManager.enabled) {
      this._postProcessingManager.render()
    } else {
      this.renderer.render(scene, camera)
    }
  }

  /**
   * 开始渲染循环
   */
  startRenderLoop(callback: () => void): void {
    this._renderCallback = callback
    this._animate()
  }

  /**
   * 停止渲染循环
   */
  stopRenderLoop(): void {
    if (this._animationId !== null) {
      cancelAnimationFrame(this._animationId)
      this._animationId = null
    }
    this._renderCallback = null
  }

  /**
   * 内部渲染循环
   */
  private _animate = (): void => {
    this._animationId = requestAnimationFrame(this._animate)
    if (this._renderCallback) {
      this._renderCallback()
    }
  }

  /**
   * 响应窗口变化
   */
  private _handleResize(): void {
    if (!this._container) return

    const width = this._container.clientWidth
    const height = this._container.clientHeight

    this.setSize(width, height)

    eventBus.emit('viewport:resize', { width, height })
  }

  /**
   * 获取渲染信息
   */
  getInfo(): THREE.WebGLInfo {
    return this.renderer.info
  }

  /**
   * 截图
   */
  takeScreenshot(mimeType: string = 'image/png', quality: number = 1): string {
    return this.renderer.domElement.toDataURL(mimeType, quality)
  }

  /**
   * 释放资源
   */
  dispose(): void {
    this.stopRenderLoop()
    window.removeEventListener('resize', this._handleResize)

    if (this._postProcessingManager) {
      this._postProcessingManager.dispose()
      this._postProcessingManager = null
    }

    if (this._container && this.renderer.domElement.parentElement === this._container) {
      this._container.removeChild(this.renderer.domElement)
    }

    this.renderer.dispose()
    this._container = null
  }
}
