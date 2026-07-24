import * as THREE from 'three'
import type { ISceneObject, IVector3 } from '@lowcode3d/shared'
import { eventBus } from '../events'

/**
 * 对象注册信息
 */
export interface IObjectEntry {
  object: THREE.Object3D
  metadata: ISceneObject
}

export interface IRemoveObjectOptions {
  dispose?: boolean
}

/**
 * 对象管理器
 * 统一管理场景中的所有对象
 */
export class ObjectManager {
  private _objects: Map<string, IObjectEntry> = new Map()
  private _scene: THREE.Scene | null = null

  /**
   * 绑定场景
   */
  bindScene(scene: THREE.Scene): void {
    this._scene = scene
  }

  /**
   * 添加对象
   */
  add(object: THREE.Object3D, metadata?: Partial<ISceneObject>): IObjectEntry {
    if (!this._scene) {
      throw new Error('ObjectManager: Scene not bound')
    }

    if (metadata?.name) {
      object.name = metadata.name
    }

    // 生成元数据
    const meta: ISceneObject = {
      uuid: object.uuid,
      name: object.name || `Object_${this._objects.size + 1}`,
      type: this._getObjectType(object),
      visible: object.visible,
      locked: false,
      position: this._toVector3(object.position),
      rotation: this._toVector3(object.rotation),
      scale: this._toVector3(object.scale),
      userData: object.userData,
      ...metadata,
    }

    // 如果对象还没有父节点，添加到场景
    if (!object.parent) {
      this._scene.add(object)
    }

    // 注册
    const entry: IObjectEntry = { object, metadata: meta }
    this._objects.set(object.uuid, entry)

    eventBus.emit('scene:object-added', { object, metadata: meta })

    return entry
  }

  /**
   * 移除对象
   */
  remove(id: string, options: IRemoveObjectOptions = {}): boolean {
    const entry = this._objects.get(id)
    if (!entry) return false

    const { dispose = true } = options

    // 从场景移除
    if (entry.object.parent) {
      entry.object.parent.remove(entry.object)
    } else if (this._scene) {
      this._scene.remove(entry.object)
    }

    if (dispose) {
      this._disposeObject(entry.object)
    }

    // 从注册表删除
    this._objects.delete(id)

    eventBus.emit('scene:object-removed', { id })

    return true
  }

  /**
   * 仅从对象注册表注销，不从父级移除，也不释放资源。
   * 用于成组、解组、命令撤销这类需要保留 Object3D 实例的场景。
   */
  unregister(id: string): IObjectEntry | undefined {
    const entry = this._objects.get(id)
    if (!entry) return undefined

    this._objects.delete(id)
    return entry
  }

  /**
   * 获取对象
   */
  get(id: string): IObjectEntry | undefined {
    return this._objects.get(id)
  }

  /**
   * 获取 THREE.Object3D
   */
  getObject(id: string): THREE.Object3D | undefined {
    return this._objects.get(id)?.object
  }

  /**
   * 获取元数据
   */
  getMetadata(id: string): ISceneObject | undefined {
    return this._objects.get(id)?.metadata
  }

  /**
   * 更新对象变换并同步元数据
   */
  updateTransform(id: string): void {
    const entry = this._objects.get(id)
    if (!entry) return

    entry.metadata.position = this._toVector3(entry.object.position)
    entry.metadata.rotation = this._toVector3(entry.object.rotation)
    entry.metadata.scale = this._toVector3(entry.object.scale)
  }

  /**
   * 更新元数据
   */
  updateMetadata(id: string, updates: Partial<ISceneObject>): void {
    const entry = this._objects.get(id)
    if (!entry) return

    Object.assign(entry.metadata, updates)

    // 同步到对象
    if (updates.name !== undefined) {
      entry.object.name = updates.name
    }
    if (updates.visible !== undefined) {
      entry.object.visible = updates.visible
    }
  }

  /**
   * 获取所有对象
   */
  getAll(): IObjectEntry[] {
    return Array.from(this._objects.values())
  }

  /**
   * 获取所有可选择对象
   */
  getSelectables(): THREE.Object3D[] {
    const selectables: THREE.Object3D[] = []
    for (const entry of this._objects.values()) {
      if (entry.object.userData.selectable !== false) {
        selectables.push(entry.object)
      }
    }
    return selectables
  }

  /**
   * 获取对象数量
   */
  get count(): number {
    return this._objects.size
  }

  /**
   * 检查对象是否存在
   */
  has(id: string): boolean {
    return this._objects.has(id)
  }

  /**
   * 清空所有对象
   */
  clear(): void {
    for (const [id] of this._objects) {
      this.remove(id)
    }
  }

  /**
   * 批量导出元数据
   */
  exportMetadata(): ISceneObject[] {
    return Array.from(this._objects.values()).map((entry) => entry.metadata)
  }

  /**
   * 获取对象类型
   */
  private _getObjectType(object: THREE.Object3D): ISceneObject['type'] {
    if (object instanceof THREE.Light) return 'light'
    if (object instanceof THREE.Camera) return 'camera'
    if (object instanceof THREE.Group) return 'group'
    if (object instanceof THREE.Mesh) return 'mesh'
    return 'mesh'
  }

  /**
   * 转换为 IVector3
   */
  private _toVector3(v: THREE.Vector3 | THREE.Euler): IVector3 {
    return { x: v.x, y: v.y, z: v.z }
  }

  /**
   * 释放对象资源
   */
  private _disposeObject(object: THREE.Object3D): void {
    object.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry?.dispose()
        if (Array.isArray(child.material)) {
          child.material.forEach((mat) => mat.dispose())
        } else {
          child.material?.dispose()
        }
      }
    })
  }

  /**
   * 销毁管理器
   */
  dispose(): void {
    this.clear()
    this._scene = null
  }
}
