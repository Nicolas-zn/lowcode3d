import * as THREE from 'three'
import type { ISceneObject } from '@lowcode3d/shared'
import { BaseCommand } from '../Command'
import { getEngine } from '../../core/Engine'
import { eventBus } from '../../events'

interface IChildState {
  object: THREE.Object3D
  parent: THREE.Object3D | null
  index: number
  metadata: Partial<ISceneObject> | null
}

/**
 * 将多个对象成组。
 */
export class GroupObjectsCommand extends BaseCommand {
  readonly name: string

  private _group: THREE.Group
  private _children: THREE.Object3D[]
  private _childStates: IChildState[] = []
  private _initialized = false

  constructor(children: THREE.Object3D[], groupName?: string) {
    super()
    this._children = [...children]
    this._group = new THREE.Group()
    this._group.name = groupName || `Group_${Date.now()}`
    this._group.userData.selectable = true

    const box = new THREE.Box3()
    this._children.forEach((child) => box.expandByObject(child))
    if (!box.isEmpty()) {
      box.getCenter(this._group.position)
    }

    this.name = `成组 "${this._group.name}"`
  }

  get group(): THREE.Group {
    return this._group
  }

  execute(): void {
    const engine = getEngine()
    if (!engine?.isInitialized) return
    this._captureStates(engine)

    const scene = engine.sceneManager.scene
    if (!this._group.parent) {
      scene.add(this._group)
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
      if (engine.objectManager.has(state.object.uuid)) {
        engine.objectManager.unregister(state.object.uuid)
      }
      if (state.object.parent) {
        state.object.parent.remove(state.object)
      }
      this._group.attach(state.object)
    }

    eventBus.emit('scene:object-updated', { id: this._group.uuid, changes: {} })
  }

  undo(): void {
    const engine = getEngine()
    if (!engine?.isInitialized) return

    const scene = engine.sceneManager.scene
    for (const state of [...this._childStates].reverse()) {
      const parent = state.parent ?? scene
      if (state.object.parent) {
        state.object.parent.remove(state.object)
      }
      parent.attach(state.object)

      if (state.index >= 0 && state.index < parent.children.length - 1) {
        const currentIndex = parent.children.indexOf(state.object)
        if (currentIndex >= 0) {
          parent.children.splice(currentIndex, 1)
          parent.children.splice(state.index, 0, state.object)
        }
      }

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

  private _captureStates(engine: ReturnType<typeof getEngine>): void {
    if (this._initialized) return

    this._childStates = this._children.map((object) => {
      const entry = engine.objectManager.get(object.uuid)
      return {
        object,
        parent: object.parent,
        index: object.parent ? object.parent.children.indexOf(object) : -1,
        metadata: entry ? { ...entry.metadata } : null,
      }
    })

    this._initialized = true
  }
}
