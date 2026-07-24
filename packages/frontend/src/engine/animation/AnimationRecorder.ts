import * as THREE from 'three'
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js'
import { AnimationEngine } from './AnimationEngine'

interface TransformState {
  uuid: string
  position: THREE.Vector3
  rotation: THREE.Quaternion
  scale: THREE.Vector3
}

/**
 * AnimationRecorder - 动画录制器
 *
 * 监听 TransformControls 的变化，自动记录关键帧
 */
export class AnimationRecorder {
  private engine: AnimationEngine
  private transformControls: TransformControls | null = null
  private isRecording: boolean = false

  // 记录变换开始时的状态
  private transformStartState: TransformState | null = null

  constructor(engine: AnimationEngine) {
    this.engine = engine
  }

  /**
   * 绑定 TransformControls
   */
  bindTransformControls(controls: TransformControls): void {
    if (this.transformControls) {
      this.unbindTransformControls()
    }

    this.transformControls = controls

    // 监听拖动开始
    controls.addEventListener('mouseDown', this.onTransformStart)

    // 监听拖动结束
    controls.addEventListener('mouseUp', this.onTransformEnd)

    // 监听对象改变
    controls.addEventListener('objectChange', this.onObjectChange)
  }

  /**
   * 解绑 TransformControls
   */
  unbindTransformControls(): void {
    if (!this.transformControls) return

    this.transformControls.removeEventListener('mouseDown', this.onTransformStart)
    this.transformControls.removeEventListener('mouseUp', this.onTransformEnd)
    this.transformControls.removeEventListener('objectChange', this.onObjectChange)

    this.transformControls = null
  }

  /**
   * 变换开始时记录初始状态
   */
  private onTransformStart = (): void => {
    if (!this.transformControls || !this.transformControls.object) return

    const object = this.transformControls.object

    this.transformStartState = {
      uuid: object.uuid,
      position: object.position.clone(),
      rotation: object.quaternion.clone(),
      scale: object.scale.clone(),
    }
  }

  /**
   * 变换结束时记录关键帧
   */
  private onTransformEnd = (): void => {
    if (!this.transformControls || !this.transformControls.object || !this.transformStartState) {
      return
    }

    const object = this.transformControls.object
    const mode = this.transformControls.mode
    const currentTime = this.engine.getState().currentTime

    // 根据变换模式记录对应的属性
    switch (mode) {
      case 'translate':
        // 检查位置是否真的改变了
        if (!object.position.equals(this.transformStartState.position)) {
          this.engine.addKeyframe(object.uuid, 'position', currentTime, object.position.clone())
        }
        break

      case 'rotate':
        // 检查旋转是否改变
        if (!object.quaternion.equals(this.transformStartState.rotation)) {
          this.engine.addKeyframe(object.uuid, 'rotation', currentTime, object.quaternion.clone())
        }
        break

      case 'scale':
        // 检查缩放是否改变
        if (!object.scale.equals(this.transformStartState.scale)) {
          this.engine.addKeyframe(object.uuid, 'scale', currentTime, object.scale.clone())
        }
        break
    }

    this.transformStartState = null
  }

  /**
   * 对象改变时（实时预览，不记录关键帧）
   */
  private onObjectChange = (): void => {
    // 这里可以触发实时预览更新
    // 但不记录关键帧，避免产生过多的关键帧
  }

  /**
   * 手动记录当前对象的所有变换属性
   */
  recordCurrentTransform(object: THREE.Object3D): void {
    const currentTime = this.engine.getState().currentTime

    this.engine.addKeyframe(object.uuid, 'position', currentTime, object.position.clone())
    this.engine.addKeyframe(object.uuid, 'rotation', currentTime, object.quaternion.clone())
    this.engine.addKeyframe(object.uuid, 'scale', currentTime, object.scale.clone())
  }

  /**
   * 批量记录多个对象
   */
  recordMultipleObjects(objects: THREE.Object3D[]): void {
    objects.forEach((obj) => this.recordCurrentTransform(obj))
  }

  /**
   * 启用/禁用录制
   */
  setRecording(enabled: boolean): void {
    this.isRecording = enabled
    this.engine.setAutoKey(enabled)
  }

  /**
   * 获取录制状态
   */
  getRecordingState(): boolean {
    return this.isRecording
  }

  /**
   * 销毁
   */
  dispose(): void {
    this.unbindTransformControls()
    this.transformStartState = null
  }
}
