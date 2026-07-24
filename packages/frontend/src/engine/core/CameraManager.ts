import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import type { CameraBookmarkData } from '@lowcode3d/shared'
import type { ICameraManager } from '../types/IEngine'
import { eventBus } from '../events'
import type { ResizePayload } from '../events'

/**
 * 相机管理器
 * 管理透视/正交相机切换、OrbitControls、视图预设
 */
export class CameraManager implements ICameraManager {
  public camera: THREE.PerspectiveCamera | THREE.OrthographicCamera
  public controls: OrbitControls

  private _perspectiveCamera: THREE.PerspectiveCamera
  private _orthographicCamera: THREE.OrthographicCamera
  private _aspect: number

  // 相机默认参数
  private static readonly DEFAULT_FOV = 60
  private static readonly DEFAULT_NEAR = 0.1
  private static readonly DEFAULT_FAR = 2000
  private static readonly INITIAL_POSITION = new THREE.Vector3(8, 8, 8)

  // 动态默认视角（可以被更新）
  private _defaultPosition: THREE.Vector3
  private _defaultTarget: THREE.Vector3

  constructor(domElement: HTMLElement, aspect?: number) {
    this._aspect = aspect || domElement.clientWidth / domElement.clientHeight

    // 创建透视相机
    this._perspectiveCamera = new THREE.PerspectiveCamera(
      CameraManager.DEFAULT_FOV,
      this._aspect,
      CameraManager.DEFAULT_NEAR,
      CameraManager.DEFAULT_FAR
    )
    this._perspectiveCamera.position.copy(CameraManager.INITIAL_POSITION)

    // 初始化动态默认视角
    this._defaultPosition = CameraManager.INITIAL_POSITION.clone()
    this._defaultTarget = new THREE.Vector3(0, 0, 0)

    // 创建正交相机
    const frustumSize = 10
    this._orthographicCamera = new THREE.OrthographicCamera(
      (frustumSize * this._aspect) / -2,
      (frustumSize * this._aspect) / 2,
      frustumSize / 2,
      frustumSize / -2,
      CameraManager.DEFAULT_NEAR,
      CameraManager.DEFAULT_FAR
    )
    this._orthographicCamera.position.copy(CameraManager.INITIAL_POSITION)

    // 默认使用透视相机
    this.camera = this._perspectiveCamera

    // 创建轨道控制器
    this.controls = new OrbitControls(this.camera, domElement)
    this._setupControls()

    this._boundHandleResize = (payload: ResizePayload) => this._handleResize(payload)
    eventBus.on('viewport:resize', this._boundHandleResize)
  }

  /**
   * 配置轨道控制器
   */
  private _setupControls(): void {
    this.controls.enableDamping = true
    this.controls.dampingFactor = 0.05
    this.controls.screenSpacePanning = true
    this.controls.minDistance = 1
    this.controls.maxDistance = 500
    this.controls.maxPolarAngle = Math.PI * 0.95
    this.controls.target.set(0, 0, 0)
  }

  /**
   * 设置相机位置
   */
  setPosition(x: number, y: number, z: number): void {
    this.camera.position.set(x, y, z)
    this._perspectiveCamera.position.set(x, y, z)
    this._orthographicCamera.position.set(x, y, z)
  }

  /**
   * 设置观察目标
   */
  setTarget(x: number, y: number, z: number): void {
    this.controls.target.set(x, y, z)
    this.camera.lookAt(x, y, z)
  }

  /**
   * 设置视野角度 (仅透视相机)
   */
  setFov(fov: number): void {
    if (this.camera instanceof THREE.PerspectiveCamera) {
      this.camera.fov = fov
      this.camera.updateProjectionMatrix()
    }
  }

  /**
   * 应用相机书签
   */
  applyBookmark(bookmark: CameraBookmarkData, animate: boolean = true): void {
    if (bookmark.type === 'orthographic') {
      this.switchToOrthographic()
    } else {
      this.switchToPerspective()
    }

    const position = new THREE.Vector3(
      bookmark.position.x,
      bookmark.position.y,
      bookmark.position.z
    )
    const target = new THREE.Vector3(bookmark.target.x, bookmark.target.y, bookmark.target.z)

    this.camera.near = bookmark.near
    this.camera.far = bookmark.far
    if (this.camera instanceof THREE.PerspectiveCamera && bookmark.fov) {
      this.camera.fov = bookmark.fov
    }
    if (this.camera instanceof THREE.OrthographicCamera && bookmark.zoom) {
      this.camera.zoom = bookmark.zoom
    }
    this.camera.updateProjectionMatrix()

    if (animate) {
      this._animateTo(position, target)
    } else {
      this.camera.position.copy(position)
      this.controls.target.copy(target)
      this.camera.lookAt(target)
      this.controls.update()
    }
  }

  /**
   * 切换到透视相机
   */
  switchToPerspective(): void {
    if (this.camera === this._perspectiveCamera) return

    // 复制位置和朝向
    this._perspectiveCamera.position.copy(this._orthographicCamera.position)
    this._perspectiveCamera.quaternion.copy(this._orthographicCamera.quaternion)

    this.camera = this._perspectiveCamera
    this.controls.object = this.camera
    this.camera.updateProjectionMatrix()
  }

  /**
   * 切换到正交相机
   */
  switchToOrthographic(): void {
    if (this.camera === this._orthographicCamera) return

    // 复制位置和朝向
    this._orthographicCamera.position.copy(this._perspectiveCamera.position)
    this._orthographicCamera.quaternion.copy(this._perspectiveCamera.quaternion)

    this.camera = this._orthographicCamera
    this.controls.object = this.camera
    this._updateOrthographicCamera()
  }

  /**
   * 重置视图到默认位置
   */
  resetView(): void {
    this._animateTo(this._defaultPosition.clone(), this._defaultTarget.clone())
  }

  /**
   * 设置默认视角
   */
  setDefaultView(position: THREE.Vector3, target: THREE.Vector3): void {
    this._defaultPosition = position.clone()
    this._defaultTarget = target.clone()
  }

  /**
   * 聚焦到指定包围盒
   */
  focusOnBox(box: THREE.Box3, offset: number = 2, setAsDefault: boolean = false): void {
    if (box.isEmpty()) return

    const center = box.getCenter(new THREE.Vector3())
    const size = box.getSize(new THREE.Vector3())

    const maxDim = Math.max(size.x, size.y, size.z)
    const fov = this.camera instanceof THREE.PerspectiveCamera ? this.camera.fov : 50
    const cameraDistance = (maxDim / (2 * Math.tan((fov * Math.PI) / 360))) * offset

    const direction = this.camera.position.clone().sub(this.controls.target).normalize()
    if (direction.lengthSq() < 0.0001) {
      direction.set(1, 1, 1).normalize()
    }

    const newPosition = center.clone().add(direction.multiplyScalar(cameraDistance))

    // 平滑过渡
    this._animateTo(newPosition, center)

    // 如果需要，设置为默认视角
    if (setAsDefault) {
      this.setDefaultView(newPosition, center)
    }
  }

  /**
   * 聚焦到指定对象
   * @param object 目标对象
   * @param offset 距离倍数
   * @param setAsDefault 是否设置为默认视角
   */
  focusOnObject(object: THREE.Object3D, offset: number = 2, setAsDefault: boolean = false): void {
    const box = new THREE.Box3().setFromObject(object)
    this.focusOnBox(box, offset, setAsDefault)
  }

  /**
   * 设置视图预设
   */
  setViewPreset(preset: 'front' | 'back' | 'left' | 'right' | 'top' | 'bottom'): void {
    const distance = this.camera.position.distanceTo(this.controls.target)
    const target = this.controls.target.clone()
    let newPosition: THREE.Vector3

    switch (preset) {
      case 'front':
        newPosition = new THREE.Vector3(0, 0, distance).add(target)
        break
      case 'back':
        newPosition = new THREE.Vector3(0, 0, -distance).add(target)
        break
      case 'left':
        newPosition = new THREE.Vector3(-distance, 0, 0).add(target)
        break
      case 'right':
        newPosition = new THREE.Vector3(distance, 0, 0).add(target)
        break
      case 'top':
        newPosition = new THREE.Vector3(0, distance, 0.001).add(target)
        break
      case 'bottom':
        newPosition = new THREE.Vector3(0, -distance, 0.001).add(target)
        break
      default:
        return
    }

    this._animateTo(newPosition, target)
  }

  /**
   * 平滑动画到目标位置
   */
  private _animateTo(
    targetPosition: THREE.Vector3,
    targetLookAt: THREE.Vector3,
    duration: number = 500
  ): void {
    const startPosition = this.camera.position.clone()
    const startTarget = this.controls.target.clone()
    const startTime = performance.now()

    const animate = () => {
      const elapsed = performance.now() - startTime
      const progress = Math.min(elapsed / duration, 1)

      // Ease out 曲线
      const eased = 1 - Math.pow(1 - progress, 3)

      this.camera.position.lerpVectors(startPosition, targetPosition, eased)
      this.controls.target.lerpVectors(startTarget, targetLookAt, eased)

      if (progress < 1) {
        requestAnimationFrame(animate)
      }
    }

    animate()
  }

  /**
   * 更新控制器
   */
  update(): void {
    this.controls.update()
  }

  /**
   * 处理窗口大小变化
   */
  private _boundHandleResize!: (payload: ResizePayload) => void

  private _handleResize({ width, height }: ResizePayload): void {
    this._aspect = width / height

    if (this.camera instanceof THREE.PerspectiveCamera) {
      this.camera.aspect = this._aspect
      this.camera.updateProjectionMatrix()
    } else {
      this._updateOrthographicCamera()
    }

    // 同时更新非活动相机
    this._perspectiveCamera.aspect = this._aspect
    this._perspectiveCamera.updateProjectionMatrix()
  }

  /**
   * 更新正交相机
   */
  private _updateOrthographicCamera(): void {
    const frustumSize = 10
    this._orthographicCamera.left = (frustumSize * this._aspect) / -2
    this._orthographicCamera.right = (frustumSize * this._aspect) / 2
    this._orthographicCamera.top = frustumSize / 2
    this._orthographicCamera.bottom = frustumSize / -2
    this._orthographicCamera.updateProjectionMatrix()
  }

  /**
   * 启用/禁用控制器
   */
  setControlsEnabled(enabled: boolean): void {
    this.controls.enabled = enabled
  }

  /**
   * 释放资源
   */
  dispose(): void {
    eventBus.off('viewport:resize', this._boundHandleResize)
    this.controls.dispose()
  }
}
