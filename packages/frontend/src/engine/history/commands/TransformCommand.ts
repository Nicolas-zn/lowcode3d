/**
 * 变换命令
 * 记录对象的变换（位置、旋转、缩放）变化
 */
import * as THREE from 'three'
import { BaseCommand, type ICommand } from '../Command'
import { eventBus } from '../../events'
import { getEngine } from '../../core/Engine'

/**
 * 变换命令
 */
export class TransformCommand extends BaseCommand {
  readonly name: string

  private _object: THREE.Object3D
  private _oldPosition: THREE.Vector3
  private _oldRotation: THREE.Euler
  private _oldScale: THREE.Vector3
  private _newPosition: THREE.Vector3
  private _newRotation: THREE.Euler
  private _newScale: THREE.Vector3
  private _timestamp: number

  constructor(
    object: THREE.Object3D,
    oldPosition: THREE.Vector3,
    oldRotation: THREE.Euler,
    oldScale: THREE.Vector3,
    newPosition: THREE.Vector3,
    newRotation: THREE.Euler,
    newScale: THREE.Vector3
  ) {
    super()
    this._object = object
    this._oldPosition = oldPosition.clone()
    this._oldRotation = oldRotation.clone()
    this._oldScale = oldScale.clone()
    this._newPosition = newPosition.clone()
    this._newRotation = newRotation.clone()
    this._newScale = newScale.clone()
    this._timestamp = Date.now()

    this.name = `变换 "${object.name || 'Object'}"`
  }

  execute(): void {
    this._object.position.copy(this._newPosition)
    this._object.rotation.copy(this._newRotation)
    this._object.scale.copy(this._newScale)
    this._object.userData.transformModified = true

    const engine = getEngine()
    if (engine?.isInitialized) {
      engine.objectManager.updateTransform(this._object.uuid)
    }

    eventBus.emit('scene:transform-changed', { objectId: this._object.uuid })
  }

  undo(): void {
    this._object.position.copy(this._oldPosition)
    this._object.rotation.copy(this._oldRotation)
    this._object.scale.copy(this._oldScale)
    this._object.userData.transformModified = true

    const engine = getEngine()
    if (engine?.isInitialized) {
      engine.objectManager.updateTransform(this._object.uuid)
    }

    eventBus.emit('scene:transform-changed', { objectId: this._object.uuid })
  }

  /**
   * 检查是否可以与前一个命令合并
   * 同一对象在短时间内的连续变换可以合并
   */
  canMergeWith(command: ICommand): boolean {
    if (!(command instanceof TransformCommand)) return false
    if (command._object !== this._object) return false

    // 500ms 内的变换可以合并
    return this._timestamp - command._timestamp < 500
  }

  /**
   * 与前一个命令合并
   */
  mergeWith(command: ICommand): void {
    if (command instanceof TransformCommand) {
      // 保留旧的初始状态
      this._oldPosition = command._oldPosition
      this._oldRotation = command._oldRotation
      this._oldScale = command._oldScale
    }
  }

  /**
   * 静态工厂方法：从当前状态创建命令
   */
  static fromObject(
    object: THREE.Object3D,
    oldState: { position: THREE.Vector3; rotation: THREE.Euler; scale: THREE.Vector3 }
  ): TransformCommand {
    return new TransformCommand(
      object,
      oldState.position,
      oldState.rotation,
      oldState.scale,
      object.position.clone(),
      object.rotation.clone(),
      object.scale.clone()
    )
  }
}
