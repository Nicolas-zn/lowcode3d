/**
 * 辅助工具管理器
 * 管理 GridHelper、AxesHelper 和 ViewHelper
 */
import * as THREE from 'three'
import { ViewHelper } from 'three/examples/jsm/helpers/ViewHelper.js'

/**
 * 辅助工具配置
 */
export interface IHelperConfig {
  gridSize?: number
  gridDivisions?: number
  gridColor1?: number
  gridColor2?: number
  axesSize?: number
  showGrid?: boolean
  showAxes?: boolean
  showViewHelper?: boolean
}

/**
 * 辅助工具管理器类
 */
export class HelperManager {
  private static _instance: HelperManager | null = null

  private _scene: THREE.Scene | null = null
  private _camera: THREE.Camera | null = null
  private _renderer: THREE.WebGLRenderer | null = null
  private _domElement: HTMLElement | null = null

  private _gridHelper: THREE.GridHelper | null = null
  private _axesHelper: THREE.AxesHelper | null = null
  private _viewHelper: ViewHelper | null = null

  private _gridVisible: boolean = true
  private _axesVisible: boolean = true
  private _viewHelperVisible: boolean = true

  private constructor() {}

  /**
   * 获取单例实例
   */
  static getInstance(): HelperManager {
    if (!HelperManager._instance) {
      HelperManager._instance = new HelperManager()
    }
    return HelperManager._instance
  }

  /**
   * 重置单例（用于测试）
   */
  static resetInstance(): void {
    if (HelperManager._instance) {
      HelperManager._instance.dispose()
      HelperManager._instance = null
    }
  }

  /**
   * 初始化辅助工具
   */
  init(
    scene: THREE.Scene,
    camera: THREE.Camera,
    renderer: THREE.WebGLRenderer,
    domElement: HTMLElement,
    config: IHelperConfig = {}
  ): void {
    this._scene = scene
    this._camera = camera
    this._renderer = renderer
    this._domElement = domElement

    const {
      gridSize = 40,
      gridDivisions = 40,
      gridColor1 = 0x444466,
      gridColor2 = 0x333355,
      axesSize = 5,
      showGrid = true,
      showAxes = true,
      showViewHelper = true,
    } = config

    // 创建网格辅助
    this._createGridHelper(gridSize, gridDivisions, gridColor1, gridColor2)

    // 创建坐标轴辅助
    this._createAxesHelper(axesSize)

    // 创建视图辅助（ViewHelper）
    this._createViewHelper()

    // 设置初始可见性
    this.setGridVisible(showGrid)
    this.setAxesVisible(showAxes)
    this.setViewHelperVisible(showViewHelper)
  }

  /**
   * 创建网格辅助
   */
  private _createGridHelper(size: number, divisions: number, color1: number, color2: number): void {
    if (!this._scene) return

    // 移除旧的网格
    if (this._gridHelper) {
      this._scene.remove(this._gridHelper)
      this._gridHelper.dispose()
    }

    this._gridHelper = new THREE.GridHelper(size, divisions, color1, color2)
    this._gridHelper.name = 'GridHelper'
    this._gridHelper.userData.isHelper = true
    this._scene.add(this._gridHelper)
  }

  /**
   * 创建坐标轴辅助
   */
  private _createAxesHelper(size: number): void {
    if (!this._scene) return

    // 移除旧的坐标轴
    if (this._axesHelper) {
      this._scene.remove(this._axesHelper)
      this._axesHelper.dispose()
    }

    this._axesHelper = new THREE.AxesHelper(size)
    this._axesHelper.name = 'AxesHelper'
    this._axesHelper.userData.isHelper = true
    this._scene.add(this._axesHelper)
  }

  /**
   * 创建视图辅助（ViewHelper）
   */
  private _createViewHelper(): void {
    if (!this._camera || !this._renderer) return

    this._viewHelper = new ViewHelper(
      this._camera as THREE.PerspectiveCamera,
      this._renderer.domElement
    )
  }

  /**
   * 检查是否已初始化
   */
  isInitialized(): boolean {
    return this._scene !== null && this._renderer !== null
  }

  /**
   * 渲染视图辅助（需要在主渲染循环中调用）
   */
  renderViewHelper(): void {
    // 确保已初始化且可见
    if (!this._viewHelper || !this._viewHelperVisible || !this._renderer) return

    // 保存 renderer 状态
    const prevAutoClear = this._renderer.autoClear
    const prevAutoClearColor = this._renderer.autoClearColor
    const prevAutoClearDepth = this._renderer.autoClearDepth

    // 禁用自动清除，防止 ViewHelper 清除主场景
    this._renderer.autoClear = false
    this._renderer.autoClearColor = false
    this._renderer.autoClearDepth = false

    // 清除深度缓冲区，确保 ViewHelper 始终在最上层
    this._renderer.clearDepth()

    // 渲染 ViewHelper
    this._viewHelper.render(this._renderer)

    // 恢复 renderer 状态
    this._renderer.autoClear = prevAutoClear
    this._renderer.autoClearColor = prevAutoClearColor
    this._renderer.autoClearDepth = prevAutoClearDepth
  }

  /**
   * 更新视图辅助（动画）
   */
  updateViewHelper(delta: number): void {
    if (!this._viewHelper || !this._viewHelperVisible) return

    if (this._viewHelper.animating) {
      this._viewHelper.update(delta)
    }
  }

  /**
   * 处理视图辅助点击
   */
  handleViewHelperClick(event: PointerEvent): boolean {
    if (!this._viewHelper || !this._viewHelperVisible || !this._domElement) return false

    const rect = this._domElement.getBoundingClientRect()
    const x = event.clientX - rect.left
    const y = event.clientY - rect.top

    // ViewHelper 位于右上角，检查点击是否在其区域内
    const helperSize = 128
    const padding = 10
    const helperX = rect.width - helperSize - padding
    const helperY = padding

    if (x >= helperX && x <= helperX + helperSize && y >= helperY && y <= helperY + helperSize) {
      // 模拟点击事件
      const mockEvent = {
        clientX: x,
        clientY: y,
        offsetX: x - helperX,
        offsetY: y - helperY,
      }

      this._viewHelper.handleClick(mockEvent as MouseEvent)
      return true
    }

    return false
  }

  /**
   * 设置网格可见性
   */
  setGridVisible(visible: boolean): void {
    this._gridVisible = visible
    if (this._gridHelper) {
      this._gridHelper.visible = visible
    }
  }

  /**
   * 获取网格可见性
   */
  isGridVisible(): boolean {
    return this._gridVisible
  }

  /**
   * 切换网格可见性
   */
  toggleGrid(): boolean {
    this.setGridVisible(!this._gridVisible)
    return this._gridVisible
  }

  /**
   * 设置坐标轴可见性
   */
  setAxesVisible(visible: boolean): void {
    this._axesVisible = visible
    if (this._axesHelper) {
      this._axesHelper.visible = visible
    }
  }

  /**
   * 获取坐标轴可见性
   */
  isAxesVisible(): boolean {
    return this._axesVisible
  }

  /**
   * 切换坐标轴可见性
   */
  toggleAxes(): boolean {
    this.setAxesVisible(!this._axesVisible)
    return this._axesVisible
  }

  /**
   * 设置视图辅助可见性
   */
  setViewHelperVisible(visible: boolean): void {
    this._viewHelperVisible = visible
  }

  /**
   * 获取视图辅助可见性
   */
  isViewHelperVisible(): boolean {
    return this._viewHelperVisible
  }

  /**
   * 切换视图辅助可见性
   */
  toggleViewHelper(): boolean {
    this._viewHelperVisible = !this._viewHelperVisible
    return this._viewHelperVisible
  }

  /**
   * 更新网格配置
   */
  updateGrid(size?: number, divisions?: number, color1?: number, color2?: number): void {
    if (!this._scene || !this._gridHelper) return

    const currentSize = size ?? 40
    const currentDivisions = divisions ?? 40
    const currentColor1 = color1 ?? 0x444466
    const currentColor2 = color2 ?? 0x333355

    const wasVisible = this._gridVisible
    this._createGridHelper(currentSize, currentDivisions, currentColor1, currentColor2)
    this.setGridVisible(wasVisible)
  }

  /**
   * 更新坐标轴大小
   */
  updateAxes(size: number): void {
    if (!this._scene) return

    const wasVisible = this._axesVisible
    this._createAxesHelper(size)
    this.setAxesVisible(wasVisible)
  }

  /**
   * 获取 GridHelper 实例
   */
  get gridHelper(): THREE.GridHelper | null {
    return this._gridHelper
  }

  /**
   * 获取 AxesHelper 实例
   */
  get axesHelper(): THREE.AxesHelper | null {
    return this._axesHelper
  }

  /**
   * 获取 ViewHelper 实例
   */
  get viewHelper(): ViewHelper | null {
    return this._viewHelper
  }

  /**
   * 销毁所有辅助工具
   */
  dispose(): void {
    if (this._scene) {
      if (this._gridHelper) {
        this._scene.remove(this._gridHelper)
        this._gridHelper.dispose()
        this._gridHelper = null
      }

      if (this._axesHelper) {
        this._scene.remove(this._axesHelper)
        this._axesHelper.dispose()
        this._axesHelper = null
      }
    }

    this._viewHelper = null
    this._scene = null
    this._camera = null
    this._renderer = null
    this._domElement = null
    HelperManager._instance = null
  }
}

/**
 * 获取 HelperManager 单例
 */
export function getHelperManager(): HelperManager {
  return HelperManager.getInstance()
}
