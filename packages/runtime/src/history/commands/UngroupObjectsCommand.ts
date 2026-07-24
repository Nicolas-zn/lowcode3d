import * as THREE from 'three'
import type { ISceneObject } from '@lowcode3d/shared'
import { BaseCommand } from '../Command'
import { getEngine } from '../../core/Engine'
import { eventBus } from '../../events'

interface IChildState {
  object: THREE.Object3D
  parent: THREE.Object3D
  index: number
  metadata: Partial<ISceneObject> | null
}

/**
 * 将 Group 解组。
 */
export class UngroupObjectsCommand extends BaseCommand {
  readonly name: string

  private _group: THREE.Group
  private _groupParent: THREE.Object3D | null
  private _groupIndex: number
  private _childStates: IChildState[] = []
  private _initialized = false

  constructor(group: THREE.Group) {
    super()
    this._group = group
    this._groupParent = group.parent
    this._groupIndex = group.parent ? group.parent.children.indexOf(group) : -1
    this.name = `解组 "${group.name || 'Group'}"`
  }

  execute(): void {
    const engine = getEngine()
    if (!engine?.isInitialized) return
    this._captureStates(engine)
    this._releaseGroup(engine)
  }

  undo(): void {
    const engine = getEngine()
    if (!engine?.isInitialized) return

    const parent = this._groupParent ?? engine.sceneManager.scene
    if (!this._group.parent) {
      parent.add(this._group)
      this._restoreIndex(parent, this._group, this._groupIndex)
    }
    if (!engine.objectManager.has(this._group.uuid)) {
      engine.objectManager.add(this._group, {
        name: this._group.name,
        type: 'group',
        visible: this._group.visible,
        locked: false,
        userData: { selectable: true },
      })
    }

    for (const state of this._childStates) {
      if (state.object.parent) {
        state.object.parent.remove(state.object)
      }
      this._group.attach(state.object)
      if (engine.objectManager.has(state.object.uuid)) {
        engine.objectManager.unregister(state.object.uuid)
      }
    }

    eventBus.emit('scene:object-updated', { id: this._group.uuid, changes: {} })
  }

  private _captureStates(engine: ReturnType<typeof getEngine>): void {
    if (this._initialized) return

    const children = [...this._group.children]
    this._childStates = children.map((object) => {
      const entry = engine.objectManager.get(object.uuid)
      return {
        object,
        parent: this._group,
        index: this._group.children.indexOf(object),
        metadata: entry ? { ...entry.metadata } : null,
      }
    })

    this._initialized = true
  }

  private _releaseGroup(engine: ReturnType<typeof getEngine>): void {
    const parent = this._groupParent ?? engine.sceneManager.scene

    for (const state of this._childStates) {
      if (state.object.parent) {
        state.object.parent.remove(state.object)
      }
      parent.attach(state.object)

      this._restoreIndex(parent, state.object, state.index)

      if (!engine.objectManager.has(state.object.uuid)) {
        engine.objectManager.add(state.object, state.metadata ?? undefined)
      }
    }

    if (this._group.parent) {
      this._group.parent.remove(this._group)
    }
    if (engine.objectManager.has(this._group.uuid)) {
      engine.objectManager.remove(this._group.uuid, { dispose: false })
    }

    eventBus.emit('scene:object-updated', { id: this._group.uuid, changes: {} })
  }

  private _restoreIndex(parent: THREE.Object3D, object: THREE.Object3D, index: number): void {
    if (index < 0 || index >= parent.children.length - 1) return

    const currentIndex = parent.children.indexOf(object)
    if (currentIndex < 0) return

    parent.children.splice(currentIndex, 1)
    parent.children.splice(index, 0, object)
  }
}
