import * as THREE from 'three'
import type { DataBindingConfig, BindingTransformConfig } from '@lowcode3d/shared'
import type { Engine } from '../core/Engine'
import { eventBus } from '../events'

const BINDABLE_PROPERTIES = new Set([
  'visible',
  'position.x',
  'position.y',
  'position.z',
  'scale.x',
  'scale.y',
  'scale.z',
  'material.color',
  'material.opacity',
  'userData.label',
  'component.props.label',
  'component.props.statusColor',
])

export class RuntimeDataBinding {
  private engine: Engine
  private bindings: DataBindingConfig[] = []

  constructor(engine: Engine) {
    this.engine = engine
  }

  bindBindings(bindings: DataBindingConfig[]): void {
    this.bindings = bindings.filter((binding) => binding.enabled)
  }

  applyBindings(sourceId: string, data: unknown): void {
    this.bindings
      .filter((binding) => binding.sourceId === sourceId)
      .forEach((binding) => this.applyBinding(binding, data))
  }

  applyAll(dataBySource: Map<string, unknown>): void {
    dataBySource.forEach((data, sourceId) => this.applyBindings(sourceId, data))
  }

  private applyBinding(binding: DataBindingConfig, sourceData: unknown): void {
    if (!BINDABLE_PROPERTIES.has(binding.propertyPath)) return

    const object = this.findObject(binding.objectUuid)
    if (!object) return

    const rawValue = this.resolveDataPath(sourceData, binding.dataPath)
    const value = this.transformValue(
      rawValue === undefined ? binding.fallbackValue : rawValue,
      binding.transform
    )
    this.writeProperty(object, binding.propertyPath, value)
  }

  resolveDataPath(data: unknown, path: string): unknown {
    if (!path) return data

    return path.split('.').reduce<unknown>((current, key) => {
      if (current === null || current === undefined) return undefined
      if (Array.isArray(current) && /^\d+$/.test(key)) {
        return current[Number(key)]
      }
      if (typeof current === 'object' && key in current) {
        return (current as Record<string, unknown>)[key]
      }
      return undefined
    }, data)
  }

  private transformValue(value: unknown, transform?: BindingTransformConfig): unknown {
    if (!transform || transform.type === 'identity') return value

    if (transform.type === 'boolean') {
      return Boolean(value)
    }

    if (transform.type === 'formatText') {
      const template = transform.options?.template
      return typeof template === 'string'
        ? template.replace(/\{value\}/g, String(value ?? ''))
        : value
    }

    if (transform.type === 'numberRange') {
      const numberValue = Number(value)
      if (!Number.isFinite(numberValue)) return value
      const min = Number(transform.options?.min ?? 0)
      const max = Number(transform.options?.max ?? 1)
      return Math.min(max, Math.max(min, numberValue))
    }

    if (transform.type === 'mapValue') {
      const map = transform.options?.map
      if (map && typeof map === 'object') {
        return (map as Record<string, unknown>)[String(value)] ?? value
      }
    }

    return value
  }

  private writeProperty(object: THREE.Object3D, propertyPath: string, value: unknown): void {
    switch (propertyPath) {
      case 'visible':
        this.setObjectVisible(object, Boolean(value))
        break
      case 'position.x':
      case 'position.y':
      case 'position.z':
        this.setVectorAxis(object.position, propertyPath, value)
        break
      case 'scale.x':
      case 'scale.y':
      case 'scale.z':
        this.setVectorAxis(object.scale, propertyPath, value)
        break
      case 'material.color':
        this.setMaterialColor(object, value)
        break
      case 'material.opacity':
        this.setMaterialOpacity(object, value)
        break
      case 'userData.label':
        object.userData.label = String(value ?? '')
        break
      case 'component.props.label':
      case 'component.props.statusColor':
        this.setComponentProp(object, propertyPath.replace('component.props.', ''), value)
        break
      default:
        break
    }
  }

  private setVectorAxis(vector: THREE.Vector3, propertyPath: string, value: unknown): void {
    const axis = propertyPath.endsWith('.x') ? 'x' : propertyPath.endsWith('.y') ? 'y' : 'z'
    const numberValue = Number(value)
    if (Number.isFinite(numberValue)) {
      vector[axis] = numberValue
    }
  }

  setObjectVisible(object: THREE.Object3D, visible: boolean): void {
    object.visible = visible
    eventBus.emit('scene:object-updated', {
      id: object.uuid,
      changes: { visible },
    })
  }

  setMaterialColor(object: THREE.Object3D, value: unknown): void {
    const materials = this.getMaterials(object)
    materials.forEach((material) => {
      if (material instanceof THREE.MeshStandardMaterial && typeof value === 'string') {
        material.color.set(value)
        material.needsUpdate = true
      }
    })
  }

  private setMaterialOpacity(object: THREE.Object3D, value: unknown): void {
    const opacity = Number(value)
    if (!Number.isFinite(opacity)) return

    this.getMaterials(object).forEach((material) => {
      if (material instanceof THREE.MeshStandardMaterial) {
        material.opacity = Math.min(1, Math.max(0, opacity))
        material.transparent = material.opacity < 1
        material.needsUpdate = true
      }
    })
  }

  private getMaterials(object: THREE.Object3D): THREE.Material[] {
    if (!(object instanceof THREE.Mesh)) return []
    return Array.isArray(object.material) ? object.material : [object.material]
  }

  private setComponentProp(object: THREE.Object3D, key: string, value: unknown): void {
    const component = object.userData.component
    if (!component || typeof component !== 'object') return

    const props = ((component as { props?: Record<string, unknown> }).props ??= {})
    props[key] = value
  }

  private findObject(objectUuid: string): THREE.Object3D | null {
    return (
      this.engine.objectManager?.getObject(objectUuid) ??
      this.engine.sceneManager.scene.getObjectByProperty('uuid', objectUuid) ??
      null
    )
  }
}
