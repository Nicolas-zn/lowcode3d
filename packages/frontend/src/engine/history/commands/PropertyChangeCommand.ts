/**
 * 属性变更命令
 * 记录对象属性的变化
 */
import * as THREE from 'three'
import { BaseCommand, type ICommand } from '../Command'
import { getEngine } from '../../core/Engine'
import { eventBus } from '../../events'

/**
 * 获取嵌套属性值
 */
function getNestedValue(obj: unknown, path: string): unknown {
  const keys = path.split('.')
  let current: unknown = obj

  for (const key of keys) {
    if (current == null || typeof current !== 'object') {
      return undefined
    }
    current = (current as Record<string, unknown>)[key]
  }

  return current
}

/**
 * 设置嵌套属性值
 */
function setNestedValue(obj: unknown, path: string, value: unknown): void {
  const keys = path.split('.')
  let current: unknown = obj

  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i]
    if (current == null || typeof current !== 'object') {
      return
    }
    current = (current as Record<string, unknown>)[key]
  }

  if (current != null && typeof current === 'object') {
    const lastKey = keys[keys.length - 1]
    ;(current as Record<string, unknown>)[lastKey] = value
  }
}

/**
 * 深拷贝值
 */
function cloneValue(value: unknown): unknown {
  if (value === null || value === undefined) {
    return value
  }

  if (typeof value !== 'object') {
    return value
  }

  // 处理 Three.js 对象
  if ('clone' in value && typeof (value as { clone: () => unknown }).clone === 'function') {
    return (value as { clone: () => unknown }).clone()
  }

  // 普通对象深拷贝
  if (Array.isArray(value)) {
    return value.map(cloneValue)
  }

  const result: Record<string, unknown> = {}
  for (const key in value as Record<string, unknown>) {
    result[key] = cloneValue((value as Record<string, unknown>)[key])
  }
  return result
}

/**
 * 属性变更命令
 */
export class PropertyChangeCommand extends BaseCommand {
  readonly name: string

  private _target: object
  private _propertyPath: string
  private _oldValue: unknown
  private _newValue: unknown
  private _timestamp: number

  constructor(target: object, propertyPath: string, oldValue: unknown, newValue: unknown) {
    super()
    this._target = target
    this._propertyPath = propertyPath
    this._oldValue = cloneValue(oldValue)
    this._newValue = cloneValue(newValue)
    this._timestamp = Date.now()

    // 生成命令名称
    const targetName = 'name' in target && typeof target.name === 'string' ? target.name : 'Object'
    this.name = `修改 "${targetName}" 的 ${propertyPath}`
  }

  execute(): void {
    setNestedValue(this._target, this._propertyPath, cloneValue(this._newValue))

    if ('needsUpdate' in this._target) {
      ;(this._target as { needsUpdate: boolean }).needsUpdate = true
    }

    this._syncEngineState(this._newValue)

    eventBus.emit('scene:property-changed', {
      target: this._target,
      property: this._propertyPath,
      value: this._newValue,
    })
  }

  undo(): void {
    setNestedValue(this._target, this._propertyPath, cloneValue(this._oldValue))

    if ('needsUpdate' in this._target) {
      ;(this._target as { needsUpdate: boolean }).needsUpdate = true
    }

    this._syncEngineState(this._oldValue)

    eventBus.emit('scene:property-changed', {
      target: this._target,
      property: this._propertyPath,
      value: this._oldValue,
    })
  }

  /**
   * 检查是否可以与前一个命令合并
   */
  canMergeWith(command: ICommand): boolean {
    if (!(command instanceof PropertyChangeCommand)) return false
    if (command._target !== this._target) return false
    if (command._propertyPath !== this._propertyPath) return false

    // 300ms 内的同属性变更可以合并
    return this._timestamp - command._timestamp < 300
  }

  /**
   * 与前一个命令合并
   */
  mergeWith(command: ICommand): void {
    if (command instanceof PropertyChangeCommand) {
      // 保留旧的初始值
      this._oldValue = command._oldValue
    }
  }

  /**
   * 静态工厂方法：记录属性变更前后状态
   */
  static create(target: object, propertyPath: string, newValue: unknown): PropertyChangeCommand {
    const oldValue = getNestedValue(target, propertyPath)
    return new PropertyChangeCommand(target, propertyPath, oldValue, newValue)
  }

  private _syncEngineState(value: unknown): void {
    const engine = getEngine()
    if (!engine?.isInitialized) return

    if (this._target instanceof THREE.Object3D) {
      if (this._propertyPath === 'name' && typeof value === 'string') {
        engine.objectManager.updateMetadata(this._target.uuid, { name: value })
      }

      if (this._propertyPath === 'visible' && typeof value === 'boolean') {
        engine.objectManager.updateMetadata(this._target.uuid, { visible: value })
      }

      if (this._propertyPath === 'userData.locked' && typeof value === 'boolean') {
        engine.objectManager.updateMetadata(this._target.uuid, { locked: value })
      }
    }
  }
}
