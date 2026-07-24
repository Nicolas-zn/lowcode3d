/**
 * 移除对象命令
 * 记录对象的移除操作
 */
import * as THREE from 'three'
import { BaseCommand } from '../Command'
import { getEngine } from '../../core/Engine'
import type { ISceneObject } from '@lowcode3d/shared'

/**
 * 移除对象命令
 */
export class RemoveObjectCommand extends BaseCommand {
  readonly name: string

  private _object: THREE.Object3D
  private _parent: THREE.Object3D | null = null
  private _index: number = -1
  private _metadata: Partial<ISceneObject> | null = null

  constructor(object: THREE.Object3D) {
    super()
    this._object = object

    this.name = `删除 "${object.name || 'Object'}"`
  }

  execute(): void {
    const engine = getEngine()
    if (!engine) return

    // 保存当前状态
    const parent = this._object.parent
    if (parent) {
      this._parent = parent
      this._index = parent.children.indexOf(this._object)
    }

    // 保存元数据
    const entry = engine.objectManager.get(this._object.uuid)
    if (entry) {
      this._metadata = { ...entry.metadata }
    }

    // 清除选择
    if (engine.selectionManager.isSelected(this._object)) {
      engine.selectionManager.clearSelection()
    }

    // 从父对象移除
    if (parent) {
      parent.remove(this._object)
    }

    // 从对象管理器移除
    if (engine.objectManager.has(this._object.uuid)) {
      engine.objectManager.remove(this._object.uuid, { dispose: false })
    }
  }

  undo(): void {
    const engine = getEngine()
    if (!engine) return

    const parent = this._parent ?? engine.sceneManager.scene

    if (this._index >= 0 && this._index < parent.children.length) {
      parent.children.splice(this._index, 0, this._object)
      this._object.parent = parent
    } else {
      parent.add(this._object)
    }

    if (!engine.objectManager.has(this._object.uuid)) {
      engine.objectManager.add(this._object, this._metadata ?? undefined)
    }
  }
}
