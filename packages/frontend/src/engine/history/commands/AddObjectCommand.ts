/**
 * 添加对象命令
 * 记录对象的添加操作
 */
import * as THREE from 'three'
import { BaseCommand } from '../Command'
import { getEngine } from '../../core/Engine'
import type { ISceneObject } from '@lowcode3d/shared'

/**
 * 添加对象命令
 */
export class AddObjectCommand extends BaseCommand {
  readonly name: string

  private _object: THREE.Object3D
  private _parent: THREE.Object3D | null
  private _index: number
  private _metadata?: Partial<ISceneObject>

  constructor(object: THREE.Object3D, metadata?: Partial<ISceneObject>, parent?: THREE.Object3D) {
    super()
    this._object = object
    this._parent = parent ?? null
    this._index = -1
    this._metadata = metadata

    this.name = `添加 "${object.name || 'Object'}"`
  }

  execute(): void {
    const engine = getEngine()
    if (!engine) return

    const parent = this._parent ?? engine.sceneManager.scene

    // 添加到父对象
    if (this._index >= 0 && this._index < parent.children.length) {
      // 恢复到原来的位置
      parent.children.splice(this._index, 0, this._object)
      this._object.parent = parent
    } else {
      parent.add(this._object)
    }

    engine.objectManager.add(this._object, this._metadata)
  }

  undo(): void {
    const engine = getEngine()
    if (!engine) return

    const parent = this._object.parent
    if (parent) {
      this._index = parent.children.indexOf(this._object)
      this._parent = parent
      parent.remove(this._object)
    }

    if (engine.objectManager.has(this._object.uuid)) {
      engine.objectManager.remove(this._object.uuid, { dispose: false })
    }

    engine.selectionManager.clearSelection()
  }
}
