import * as THREE from 'three'
import { BaseCommand } from '../Command'
import { eventBus } from '../../events'

/**
 * 重新挂载对象到新的父级
 */
export class ReparentObjectCommand extends BaseCommand {
  readonly name: string

  private _object: THREE.Object3D
  private _newParent: THREE.Object3D
  private _oldParent: THREE.Object3D | null
  private _oldIndex: number
  private _newIndex: number | null

  constructor(object: THREE.Object3D, newParent: THREE.Object3D, newIndex: number | null = null) {
    super()
    this._object = object
    this._newParent = newParent
    this._newIndex = newIndex
    this._oldParent = object.parent
    this._oldIndex = object.parent ? object.parent.children.indexOf(object) : -1
    this.name = `调整 "${object.name || 'Object'}" 层级`
  }

  execute(): void {
    this._moveTo(this._newParent, this._newIndex)
    eventBus.emit('scene:object-updated', { id: this._object.uuid, changes: {} })
  }

  undo(): void {
    this._moveTo(this._oldParent ?? this._newParent, this._oldIndex)
    eventBus.emit('scene:object-updated', { id: this._object.uuid, changes: {} })
  }

  private _moveTo(parent: THREE.Object3D, index: number | null): void {
    parent.attach(this._object)

    if (index !== null && index >= 0 && index < parent.children.length - 1) {
      const currentIndex = parent.children.indexOf(this._object)
      if (currentIndex >= 0) {
        parent.children.splice(currentIndex, 1)
        parent.children.splice(index, 0, this._object)
      }
    }

    this._object.updateMatrixWorld(true)
  }
}
