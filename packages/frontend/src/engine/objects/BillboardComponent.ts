/**
 * 广告牌模式
 */
export enum BillboardMode {
  /** 无旋转（静止） */
  NONE = 'NONE',
  /** 完全面向相机（包括Y轴） */
  FULL = 'FULL',
  /** 仅Y轴锁定（常用于立牌、树木等） */
  Y_LOCK = 'Y_LOCK',
}

/**
 * 广告牌动画类型
 */
export type BillboardAnimationType = 'NONE' | 'FLOAT' | 'SCALE'

/**
 * 广告牌数据接口
 */
export interface IBillboardData {
  mode: BillboardMode
  size: [number, number]
  texture: string
  backTexture?: string
  animation?: BillboardAnimationType
  repeat?: [number, number]
  isVideo?: boolean
}

import * as THREE from 'three'

/**
 * 广告牌组件
 * 使对象始终面向相机
 */
export class BillboardComponent {
  private _object: THREE.Object3D
  private _camera: THREE.Camera
  private _mode: BillboardMode
  private _target: THREE.Vector3
  private _animation: BillboardAnimationType = 'NONE'
  private _time: number = 0
  private _baseY: number = 0
  private _baseScale: THREE.Vector3 = new THREE.Vector3(1, 1, 1)

  constructor(
    object: THREE.Object3D,
    camera: THREE.Camera,
    mode: BillboardMode = BillboardMode.Y_LOCK
  ) {
    this._object = object
    this._camera = camera
    this._mode = mode
    this._target = new THREE.Vector3()

    // 存储到 userData 中，方便序列化和查找
    object.userData.billboardComponent = this
    object.userData.billboardMode = mode

    // 初始化基准状态
    this._baseY = object.position.y
    this._baseScale.copy(object.scale)

    // 注册到管理器
    getBillboardManager().register(this)
  }

  /**
   * 获取对象
   */
  get object(): THREE.Object3D {
    return this._object
  }

  /**
   * 获取/设置模式
   */
  get mode(): BillboardMode {
    return this._mode
  }

  set mode(value: BillboardMode) {
    this._mode = value
    this._object.userData.billboardMode = value
  }

  /**
   * 获取/设置动画
   */
  get animation(): BillboardAnimationType {
    return this._animation
  }

  set animation(value: BillboardAnimationType) {
    if (this._animation === value) return

    // 如果之前有动画，可能位置/缩放不在基准上，这里做个简单的重置
    if (this._animation === 'FLOAT') {
      this._object.position.y = this._baseY
    } else if (this._animation === 'SCALE') {
      this._object.scale.copy(this._baseScale)
    }

    this._animation = value
    this._object.userData.billboardAnimation = value
    this._time = 0

    // 更新基准（假设切换动画时物体处于正确状态）
    this._baseY = this._object.position.y
    this._baseScale.copy(this._object.scale)
  }

  /**
   * 同步基准变换（当外部修改了位置/缩放时调用）
   */
  syncBaseTransform(): void {
    // 1. 同步位置 (FLOAT 影响 Y)
    if (this._animation === 'FLOAT') {
      const amplitude = 0.3
      const offset = Math.sin(this._time * 2) * amplitude
      this._baseY = this._object.position.y - offset
    } else {
      this._baseY = this._object.position.y
    }

    // 2. 同步缩放 (SCALE 影响 scale)
    if (this._animation === 'SCALE') {
      const range = 0.3
      const factor = 1 + range * ((Math.sin(this._time * 3) + 1) / 2)
      if (factor > 0.001) {
        this._baseScale.copy(this._object.scale).divideScalar(factor)
      } else {
        this._baseScale.copy(this._object.scale)
      }
    } else {
      this._baseScale.copy(this._object.scale)
    }
  }

  /**
   * 更新相机引用
   */
  setCamera(camera: THREE.Camera): void {
    this._camera = camera
  }

  /**
   * 更新广告牌朝向和动画
   * 应在每帧渲染循环中调用
   */
  update(dt: number = 0.016): void {
    // 1. 检测外部变换并同步基准值
    if (this._animation === 'FLOAT') {
      const amplitude = 0.3
      const offset = Math.sin(this._time * 2) * amplitude
      // 如果当前位置与预期位置偏差较大，说明发生了外部移动
      if (Math.abs(this._object.position.y - (this._baseY + offset)) > 0.001) {
        this._baseY = this._object.position.y - offset
      }
    } else {
      // 非 FLOAT 动画，Y 轴应该与 baseY 一致
      if (Math.abs(this._object.position.y - this._baseY) > 0.001) {
        this._baseY = this._object.position.y
      }
    }

    if (this._animation === 'SCALE') {
      const range = 0.3
      const factor = 1 + range * ((Math.sin(this._time * 3) + 1) / 2)
      // 简单检测 scale 变化 (这里简化处理，只检测 X 轴)
      const expectedScaleX = this._baseScale.x * factor
      if (Math.abs(this._object.scale.x - expectedScaleX) > 0.001) {
        this._baseScale.copy(this._object.scale).divideScalar(factor)
      }
    } else {
      if (this._object.scale.distanceTo(this._baseScale) > 0.001) {
        this._baseScale.copy(this._object.scale)
      }
    }

    // 2. 更新动画
    if (this._animation !== 'NONE') {
      this._time += dt

      if (this._animation === 'FLOAT') {
        const amplitude = 0.3
        const offset = Math.sin(this._time * 2) * amplitude
        this._object.position.y = this._baseY + offset
      } else if (this._animation === 'SCALE') {
        const range = 0.3
        const factor = 1 + range * ((Math.sin(this._time * 3) + 1) / 2)
        this._object.scale.copy(this._baseScale).multiplyScalar(factor)
      }
    }

    // 2. 更新朝向
    if (this._mode === BillboardMode.NONE) {
      return
    }

    this._target.copy(this._camera.position)

    if (this._mode === BillboardMode.Y_LOCK) {
      // Y轴锁定模式：只在水平面上旋转
      this._target.y = this._object.position.y
    }

    this._object.lookAt(this._target)
  }

  /**
   * 销毁组件
   */
  dispose(): void {
    getBillboardManager().unregister(this)
    delete this._object.userData.billboardComponent
    delete this._object.userData.billboardMode
    delete this._object.userData.billboardAnimation
  }
}

/**
 * 广告牌管理器
 * 统一管理场景中的所有广告牌组件
 */
export class BillboardManager {
  private static _instance: BillboardManager | null = null

  private _billboards: Set<BillboardComponent> = new Set()
  private _camera: THREE.Camera | null = null

  private constructor() {}

  static getInstance(): BillboardManager {
    if (!BillboardManager._instance) {
      BillboardManager._instance = new BillboardManager()
    }
    return BillboardManager._instance
  }

  static resetInstance(): void {
    if (BillboardManager._instance) {
      BillboardManager._instance._billboards.clear()
    }
    BillboardManager._instance = null
  }

  /**
   * 设置相机
   */
  setCamera(camera: THREE.Camera): void {
    this._camera = camera
    // 更新所有广告牌的相机引用
    this._billboards.forEach((billboard) => {
      billboard.setCamera(camera)
    })
  }

  /**
   * 注册广告牌
   */
  register(billboard: BillboardComponent): void {
    this._billboards.add(billboard)
    if (this._camera) {
      billboard.setCamera(this._camera)
    }
  }

  /**
   * 注销广告牌
   */
  unregister(billboard: BillboardComponent): void {
    this._billboards.delete(billboard)
  }

  /**
   * 注销对象关联的广告牌
   */
  unregisterByObject(object: THREE.Object3D): void {
    const component = object.userData.billboardComponent as BillboardComponent | undefined
    if (component) {
      this._billboards.delete(component)
      component.dispose()
    }
  }

  /**
   * 更新所有广告牌
   * 应在渲染循环中调用
   */
  update(dt: number = 0.016): void {
    this._billboards.forEach((billboard) => {
      billboard.update(dt)
    })
  }

  /**
   * 获取所有广告牌数量
   */
  get count(): number {
    return this._billboards.size
  }

  /**
   * 清空所有广告牌
   */
  clear(): void {
    this._billboards.clear()
  }
}

/**
 * 获取广告牌管理器实例
 */
export function getBillboardManager(): BillboardManager {
  return BillboardManager.getInstance()
}
