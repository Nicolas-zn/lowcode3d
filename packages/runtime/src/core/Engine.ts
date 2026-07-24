import * as THREE from 'three'
import { SceneManager } from './SceneManager'
import { RenderManager } from './RenderManager'
import { CameraManager } from './CameraManager'
import { ObjectManager, getBillboardManager } from '../objects'
import { SelectionManager, TransformManager } from '../interaction'
import { getHelperManager } from '../helpers'
import { AnimationEngine, AnimationRecorder } from '../animation'
import type { IEngine, IEngineConfig } from '../types/IEngine'
import type { ISceneObject } from '@lowcode3d/shared'
import { eventBus } from '../events'

/**
 * 3D 引擎核心类
 * 单例模式，统一管理场景、渲染、相机及交互
 */
export class Engine implements IEngine {
  private static _instance: Engine | null = null

  public sceneManager!: SceneManager
  public renderManager!: RenderManager
  public cameraManager!: CameraManager
  public objectManager!: ObjectManager
  public selectionManager!: SelectionManager
  public transformManager!: TransformManager
  public animationEngine!: AnimationEngine

  private _isInitialized = false
  private _container: HTMLElement | null = null
  private _animationRecorder: AnimationRecorder | null = null

  /**
   * 获取单例实例
   */
  static getInstance(): Engine {
    if (!Engine._instance) {
      Engine._instance = new Engine()
    }
    return Engine._instance
  }

  /**
   * 销毁单例实例
   */
  static destroyInstance(): void {
    if (Engine._instance) {
      Engine._instance.dispose()
      Engine._instance = null
    }
  }

  private constructor() {
    // 私有构造函数，强制单例
  }

  /**
   * 初始化引擎
   */
  init(config: IEngineConfig): void {
    if (this._isInitialized) {
      console.warn('Engine already initialized')
      return
    }

    this._container = config.container

    // 1. 初始化场景管理器
    this.sceneManager = new SceneManager()
    if (config.backgroundColor !== undefined) {
      this.sceneManager.setBackgroundColor(config.backgroundColor)
    }

    // 2. 初始化渲染管理器
    this.renderManager = new RenderManager(config.container, {
      antialias: config.antialias ?? true,
    })
    if (config.pixelRatio !== undefined) {
      this.renderManager.setPixelRatio(config.pixelRatio)
    }
    if (config.enableShadows !== undefined) {
      this.renderManager.enableShadows(config.enableShadows)
    }
    if (config.shadowMapType !== undefined) {
      this.renderManager.setShadowMapType(config.shadowMapType)
    }

    // 3. 初始化相机管理器
    this.cameraManager = new CameraManager(config.container)

    // 4. 初始化对象管理器
    this.objectManager = new ObjectManager()
    this.objectManager.bindScene(this.sceneManager.scene)

    // 配置广告牌管理器
    getBillboardManager().setCamera(this.cameraManager.camera)

    // 5. 初始化交互管理器（使用 canvas 元素而不是 container，因为 canvas 在最上层接收事件）
    this._initInteraction(this.renderManager.domElement)

    // 6. 初始化动画系统，并绑定 TransformControls 支持自动关键帧
    this.animationEngine = new AnimationEngine(this.sceneManager.scene)
    this._animationRecorder = new AnimationRecorder(this.animationEngine)
    this._animationRecorder.bindTransformControls(this.transformManager.controls)

    // 添加默认灯光
    this._setupDefaultLights()

    // 辅助对象由 HelperManager 管理，在 CanvasPanel 中初始化

    // 7. 初始化后处理管理器
    this.renderManager.initPostProcessing(this.sceneManager.scene, this.cameraManager.camera)

    // 启动渲染循环
    this.renderManager.startRenderLoop(() => {
      this.render()
    })

    this._isInitialized = true
    eventBus.emit('engine:initialized')
    console.log('🚀 Engine initializedfffff')
  }

  /**
   * 初始化交互系统 (选择与变换)
   */
  private _initInteraction(container: HTMLElement): void {
    this.selectionManager = new SelectionManager({
      domElement: container,
      camera: this.cameraManager.camera,
      scene: this.sceneManager.scene,
      onSelectionChange: (event) => {
        const selected = event.selected
        if (selected.length > 0) {
          this.transformManager.attach(selected[selected.length - 1])
        } else {
          this.transformManager.detach()
        }

        this.renderManager.postProcessingManager?.setOutlineObjects(selected)

        eventBus.emit('scene:selection-changed', event)
      },
    })

    // 初始化变换管理器
    this.transformManager = new TransformManager({
      camera: this.cameraManager.camera,
      domElement: container,
      scene: this.sceneManager.scene,
      orbitControls: this.cameraManager.controls,
      onTransformChange: () => {
        // 变换发生时，可能需要通知对象管理器更新元数据
        if (this.transformManager.currentObject) {
          const object = this.transformManager.currentObject
          this.objectManager.updateTransform(object.uuid)

          // 如果是广告牌，更新其动画基础变换，防止动画与手动变换冲突
          if (object.userData.billboardComponent) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ;(object.userData.billboardComponent as any).syncBaseTransform()
          }
        }
      },
    })
  }

  /**
   * 设置默认灯光
   */
  private _setupDefaultLights(): void {
    // 环境光
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4)
    ambientLight.name = 'DefaultAmbientLight'
    this.sceneManager.addObject(ambientLight)

    // 主平行光
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8)
    directionalLight.name = 'DefaultDirectionalLight'
    directionalLight.position.set(10, 15, 10)
    directionalLight.castShadow = true

    // 阴影配置
    directionalLight.shadow.mapSize.width = 2048
    directionalLight.shadow.mapSize.height = 2048
    directionalLight.shadow.camera.near = 0.5
    directionalLight.shadow.camera.far = 100
    directionalLight.shadow.camera.left = -20
    directionalLight.shadow.camera.right = 20
    directionalLight.shadow.camera.top = 20
    directionalLight.shadow.camera.bottom = -20
    directionalLight.shadow.bias = -0.0001

    this.sceneManager.addObject(directionalLight)
  }

  /**
   * 响应窗口大小变化
   */
  resize(): void {
    if (!this._container) return

    const width = this._container.clientWidth
    const height = this._container.clientHeight

    this.renderManager.setSize(width, height)
    eventBus.emit('viewport:resize', { width, height })
  }

  private _clock = new THREE.Clock()

  // ... (省略中间代码)

  /**
   * 渲染一帧
   */
  render(): void {
    if (!this._isInitialized) return

    const delta = this._clock.getDelta()

    // 更新控制器
    this.cameraManager.update()

    // 更新动画时间线
    this.animationEngine.update(delta)

    // 更新广告牌
    getBillboardManager().update(delta)

    // 更新 ViewHelper 动画（在主渲染之前）
    const helperManager = getHelperManager()
    helperManager.updateViewHelper(delta)
    this.selectionManager.updateBoundingBoxes()

    // 渲染场景
    this.renderManager.render(this.sceneManager.scene, this.cameraManager.camera)

    // 渲染视图辅助（ViewHelper，在场景渲染后单独渲染，使用独立 viewport）
    helperManager.renderViewHelper()
  }

  /**
   * 添加物体到场景 (代理到 ObjectManager)
   */
  addObject(object: THREE.Object3D, metadata?: Partial<ISceneObject>): void {
    this.objectManager.add(object, metadata)
  }

  /**
   * 从场景移除物体 (代理到 ObjectManager)
   */
  removeObject(object: THREE.Object3D): void {
    this.objectManager.remove(object.uuid)
  }

  /**
   * 截图
   */
  takeScreenshot(mimeType?: string, quality?: number): string {
    return this.renderManager.takeScreenshot(mimeType, quality)
  }

  /**
   * 获取渲染信息
   */
  getRenderInfo(): THREE.WebGLInfo {
    return this.renderManager.getInfo()
  }

  /**
   * 是否已初始化
   */
  get isInitialized(): boolean {
    return this._isInitialized
  }

  /**
   * 释放所有资源
   */
  dispose(): void {
    if (!this._isInitialized) return

    console.log('🧹 Disposing engine...')

    // 停止渲染循环
    this.renderManager.stopRenderLoop()

    // 释放管理器
    if (this._animationRecorder) {
      this._animationRecorder.dispose()
      this._animationRecorder = null
    }
    if (this.animationEngine) this.animationEngine.dispose()
    if (this.transformManager) this.transformManager.dispose()
    if (this.selectionManager) this.selectionManager.dispose()
    if (this.objectManager) this.objectManager.dispose()

    this.cameraManager.dispose()
    this.renderManager.dispose()
    this.sceneManager.dispose()

    // 辅助对象由 HelperManager 管理

    this._container = null
    this._isInitialized = false
    eventBus.emit('engine:disposed')

    console.log('✅ Engine disposed')
  }
}

// 导出单例获取方法
export const getEngine = (): Engine => Engine.getInstance()
