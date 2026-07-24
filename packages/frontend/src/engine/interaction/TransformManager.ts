import * as THREE from 'three'
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js'
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { getHistoryManager, TransformCommand } from '../history'

/**
 * 变换模式
 */
export type TransformMode = 'translate' | 'rotate' | 'scale'

/**
 * 变换事件
 */
export interface ITransformEvent {
  object: THREE.Object3D
  mode: TransformMode
  position: THREE.Vector3
  rotation: THREE.Euler
  scale: THREE.Vector3
}

/**
 * 变换管理器配置
 */
export interface ITransformManagerConfig {
  camera: THREE.Camera
  domElement: HTMLElement
  scene: THREE.Scene
  orbitControls?: OrbitControls
  onTransformStart?: (event: ITransformEvent) => void
  onTransformChange?: (event: ITransformEvent) => void
  onTransformEnd?: (event: ITransformEvent) => void
}

/**
 * 变换管理器
 * 集成 TransformControls，处理对象变换
 */
export class TransformManager {
  private _transformControls: TransformControls
  private _scene: THREE.Scene
  private _orbitControls?: OrbitControls
  private _currentObject: THREE.Object3D | null = null
  private _mode: TransformMode = 'translate'
  private _selectMode: boolean = true // 默认为选择模式

  // 事件回调
  private _onTransformStart?: (event: ITransformEvent) => void
  private _onTransformChange?: (event: ITransformEvent) => void
  private _onTransformEnd?: (event: ITransformEvent) => void

  // 变换前的状态（用于历史记录）
  private _transformStartState: {
    position: THREE.Vector3
    rotation: THREE.Euler
    scale: THREE.Vector3
  } | null = null

  constructor(config: ITransformManagerConfig) {
    this._scene = config.scene
    this._orbitControls = config.orbitControls
    this._onTransformStart = config.onTransformStart
    this._onTransformChange = config.onTransformChange
    this._onTransformEnd = config.onTransformEnd

    // 创建 TransformControls
    this._transformControls = new TransformControls(config.camera, config.domElement)
    this._transformControls.setMode('translate')

    // 添加到场景 (TransformControls 本身就是 Object3D)
    this._scene.add(this._transformControls)

    // 监听 TransformControls 事件
    this._transformControls.addEventListener('dragging-changed', (event) => {
      // 拖动时禁用 OrbitControls
      if (this._orbitControls) {
        this._orbitControls.enabled = !event.value
      }
    })

    this._transformControls.addEventListener('objectChange', () => {
      if (this._currentObject && this._onTransformChange) {
        this._onTransformChange(this._createTransformEvent())
      }
    })

    this._transformControls.addEventListener('mouseDown', () => {
      if (this._currentObject) {
        // 记录变换开始状态
        this._transformStartState = {
          position: this._currentObject.position.clone(),
          rotation: this._currentObject.rotation.clone(),
          scale: this._currentObject.scale.clone(),
        }

        if (this._onTransformStart) {
          this._onTransformStart(this._createTransformEvent())
        }
      }
    })

    this._transformControls.addEventListener('mouseUp', () => {
      if (this._currentObject) {
        // 创建历史记录命令
        if (this._transformStartState) {
          const hasChanged =
            !this._currentObject.position.equals(this._transformStartState.position) ||
            !this._rotationEquals(
              this._currentObject.rotation,
              this._transformStartState.rotation
            ) ||
            !this._currentObject.scale.equals(this._transformStartState.scale)

          if (hasChanged) {
            const command = TransformCommand.fromObject(
              this._currentObject,
              this._transformStartState
            )
            // 不执行命令（变换已经发生），直接登记到历史栈
            getHistoryManager().pushApplied(command)

            // 标记对象的变换已被修改（用于序列化）
            this._currentObject.userData.transformModified = true
          }

          this._transformStartState = null
        }

        if (this._onTransformEnd) {
          this._onTransformEnd(this._createTransformEvent())
        }
      }
    })
  }

  /**
   * 获取 TransformControls 实例
   */
  get controls(): TransformControls {
    return this._transformControls
  }

  /**
   * 获取当前模式
   */
  get mode(): TransformMode {
    return this._mode
  }

  /**
   * 获取当前附加的对象
   */
  get currentObject(): THREE.Object3D | null {
    return this._currentObject
  }

  /**
   * 更新相机
   */
  setCamera(camera: THREE.Camera): void {
    this._transformControls.camera = camera
  }

  /**
   * 绑定 OrbitControls
   */
  setOrbitControls(controls: OrbitControls): void {
    this._orbitControls = controls
  }

  /**
   * 附加到对象
   */
  attach(object: THREE.Object3D): void {
    // 如果处于选择模式，不附加 TransformControls
    if (this._selectMode) {
      this._currentObject = object
      return
    }

    // 防止附加到 TransformControls 自身或其子对象
    if (this._isTransformControlsObject(object)) {
      console.warn('TransformManager: Cannot attach to TransformControls itself')
      return
    }

    // 确保对象在场景中
    if (!object.parent) {
      this._scene.add(object)
    }

    // 确保对象的世界矩阵是最新的
    object.updateMatrixWorld(true)

    this._currentObject = object
    this._transformControls.attach(object)
  }

  /**
   * 设置选择模式
   * 在选择模式下，选中对象不会显示 TransformControls
   */
  setSelectMode(enabled: boolean): void {
    this._selectMode = enabled
    if (enabled) {
      // 进入选择模式时，分离当前对象的 TransformControls
      this._transformControls.detach()
    } else if (this._currentObject) {
      // 退出选择模式时，如果有选中对象，重新附加
      this._transformControls.attach(this._currentObject)
    }
  }

  /**
   * 检查对象是否是 TransformControls 的一部分
   */
  private _isTransformControlsObject(object: THREE.Object3D): boolean {
    let current: THREE.Object3D | null = object
    while (current) {
      if (
        current === this._transformControls ||
        current.type === 'TransformControls' ||
        current.type === 'TransformControlsGizmo' ||
        current.type === 'TransformControlsPlane'
      ) {
        return true
      }
      current = current.parent
    }
    return false
  }

  /**
   * 分离对象
   */
  detach(): void {
    this._currentObject = null
    this._transformControls.detach()
  }

  /**
   * 设置变换模式
   */
  setMode(mode: TransformMode): void {
    this._mode = mode
    this._transformControls.setMode(mode)
  }

  /**
   * 设置空间 (local/world)
   */
  setSpace(space: 'local' | 'world'): void {
    this._transformControls.setSpace(space)
  }

  /**
   * 切换空间
   */
  toggleSpace(): void {
    const currentSpace = this._transformControls.space
    this._transformControls.setSpace(currentSpace === 'local' ? 'world' : 'local')
  }

  /**
   * 设置平移吸附
   */
  setTranslationSnap(value: number | null): void {
    this._transformControls.setTranslationSnap(value)
  }

  /**
   * 设置旋转吸附
   */
  setRotationSnap(value: number | null): void {
    this._transformControls.setRotationSnap(value)
  }

  /**
   * 设置缩放吸附
   */
  setScaleSnap(value: number | null): void {
    this._transformControls.setScaleSnap(value)
  }

  /**
   * 设置控件尺寸
   */
  setSize(size: number): void {
    this._transformControls.setSize(size)
  }

  /**
   * 显示/隐藏控件
   */
  setVisible(visible: boolean): void {
    this._transformControls.visible = visible
    this._transformControls.enabled = visible
  }

  /**
   * 创建变换事件对象
   */
  private _createTransformEvent(): ITransformEvent {
    return {
      object: this._currentObject!,
      mode: this._mode,
      position: this._currentObject!.position.clone(),
      rotation: this._currentObject!.rotation.clone(),
      scale: this._currentObject!.scale.clone(),
    }
  }

  /**
   * 比较两个旋转是否相等
   */
  private _rotationEquals(a: THREE.Euler, b: THREE.Euler): boolean {
    const epsilon = 0.0001
    return (
      Math.abs(a.x - b.x) < epsilon &&
      Math.abs(a.y - b.y) < epsilon &&
      Math.abs(a.z - b.z) < epsilon
    )
  }

  /**
   * 销毁管理器
   */
  dispose(): void {
    this._transformControls.detach()
    this._scene.remove(this._transformControls)
    this._transformControls.dispose()
    this._currentObject = null
  }
}
