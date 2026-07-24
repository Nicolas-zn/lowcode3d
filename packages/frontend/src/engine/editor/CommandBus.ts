import type * as THREE from 'three'
import type { ISceneObject } from '@lowcode3d/shared'
import type { AnimationEngine } from '../animation'
import type { IPBRMaterialProps } from '../materials'
import type { ILightProps } from '../lights'
import { getEngine } from '../core/Engine'
import {
  getHistoryManager,
  AddObjectCommand,
  RemoveObjectCommand,
  PropertyChangeCommand,
  TransformCommand,
  CompositeCommand,
  ReparentObjectCommand,
  GroupObjectsCommand,
  UngroupObjectsCommand,
  MaterialChangeCommand,
  LightChangeCommand,
  AnimationCommand,
} from '../history'

/**
 * 编辑命令入口
 * 让 UI 侧不直接操作历史管理器或对象管理器内部细节。
 */
export class CommandBus {
  private static _instance: CommandBus | null = null

  static getInstance(): CommandBus {
    if (!CommandBus._instance) {
      CommandBus._instance = new CommandBus()
    }
    return CommandBus._instance
  }

  static resetInstance(): void {
    CommandBus._instance = null
  }

  addObject(
    object: THREE.Object3D,
    metadata?: Partial<ISceneObject>,
    parent?: THREE.Object3D
  ): void {
    getHistoryManager().execute(new AddObjectCommand(object, metadata, parent))
  }

  removeObject(objectOrId: THREE.Object3D | string): void {
    const engine = getEngine()
    if (!engine?.isInitialized) return

    const object =
      typeof objectOrId === 'string'
        ? engine.objectManager.getObject(objectOrId) ||
          engine.sceneManager.scene.getObjectByProperty('uuid', objectOrId) ||
          null
        : objectOrId

    if (!object) return

    getHistoryManager().execute(new RemoveObjectCommand(object))
  }

  changeProperty(target: object, propertyPath: string, value: unknown): void {
    getHistoryManager().execute(PropertyChangeCommand.create(target, propertyPath, value))
  }

  changeProperties(
    name: string,
    changes: Array<{ target: object; propertyPath: string; value: unknown }>
  ): void {
    const commands = changes.map(({ target, propertyPath, value }) =>
      PropertyChangeCommand.create(target, propertyPath, value)
    )

    if (commands.length === 0) return
    if (commands.length === 1) {
      getHistoryManager().execute(commands[0])
      return
    }

    getHistoryManager().execute(new CompositeCommand(name, commands))
  }

  transformObject(
    object: THREE.Object3D,
    nextState: {
      position?: THREE.Vector3
      rotation?: THREE.Euler
      scale?: THREE.Vector3
    }
  ): void {
    getHistoryManager().execute(
      new TransformCommand(
        object,
        object.position,
        object.rotation,
        object.scale,
        nextState.position ?? object.position,
        nextState.rotation ?? object.rotation,
        nextState.scale ?? object.scale
      )
    )
  }

  transformObjects(
    name: string,
    transforms: Array<{
      object: THREE.Object3D
      position?: THREE.Vector3
      rotation?: THREE.Euler
      scale?: THREE.Vector3
    }>
  ): void {
    const commands = transforms.map(
      ({ object, position, rotation, scale }) =>
        new TransformCommand(
          object,
          object.position,
          object.rotation,
          object.scale,
          position ?? object.position,
          rotation ?? object.rotation,
          scale ?? object.scale
        )
    )

    if (commands.length === 0) return
    if (commands.length === 1) {
      getHistoryManager().execute(commands[0])
      return
    }

    getHistoryManager().execute(new CompositeCommand(name, commands))
  }

  reparentObject(
    object: THREE.Object3D,
    parent: THREE.Object3D,
    index: number | null = null
  ): void {
    getHistoryManager().execute(new ReparentObjectCommand(object, parent, index))
  }

  groupObjects(objects: THREE.Object3D[], groupName?: string): THREE.Group | null {
    if (objects.length < 2) return null

    const command = new GroupObjectsCommand(objects, groupName)
    getHistoryManager().execute(command)
    return command.group
  }

  ungroupObject(group: THREE.Group): void {
    getHistoryManager().execute(new UngroupObjectsCommand(group))
  }

  changeObjectName(object: THREE.Object3D, name: string): void {
    this.changeProperty(object, 'name', name)
  }

  changeObjectVisible(object: THREE.Object3D, visible: boolean): void {
    this.changeProperty(object, 'visible', visible)
  }

  changeObjectVisibleTree(object: THREE.Object3D, visible: boolean): void {
    const changes: Array<{ target: object; propertyPath: string; value: unknown }> = []
    object.traverse((child) => {
      if (child.visible !== visible) {
        changes.push({ target: child, propertyPath: 'visible', value: visible })
      }
    })

    this.changeProperties(`修改 "${object.name || 'Object'}" 可见性`, changes)
  }

  changeObjectLocked(object: THREE.Object3D, locked: boolean): void {
    this.changeProperties(`修改 "${object.name || 'Object'}" 锁定状态`, [
      { target: object, propertyPath: 'userData.locked', value: locked },
      { target: object, propertyPath: 'userData.selectable', value: !locked },
    ])
  }

  changeMaterial(
    object: THREE.Object3D,
    material: THREE.MeshStandardMaterial,
    patch: Partial<IPBRMaterialProps>
  ): void {
    getHistoryManager().execute(new MaterialChangeCommand(object, material, patch))
  }

  changeLight(
    light: THREE.Light,
    patch: Partial<Omit<ILightProps, 'type' | 'position' | 'target'>>
  ): void {
    getHistoryManager().execute(new LightChangeCommand(light, patch))
  }

  executeAnimationCommand(name: string, engine: AnimationEngine, mutator: () => void): void {
    const beforeData = engine.toJSON()
    mutator()
    const afterData = engine.toJSON()
    getHistoryManager().pushApplied(new AnimationCommand(name, engine, beforeData, afterData))
  }
}

export function getCommandBus(): CommandBus {
  return CommandBus.getInstance()
}
