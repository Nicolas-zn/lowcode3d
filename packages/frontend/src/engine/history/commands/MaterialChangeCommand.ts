import * as THREE from 'three'
import type { IPBRMaterialProps } from '../../materials'
import { getEngine } from '../../core/Engine'
import { getMaterialManager } from '../../materials'
import { eventBus } from '../../events'
import { BaseCommand, type ICommand } from '../Command'

type MaterialPatch = Partial<IPBRMaterialProps>

function normalizePatch(material: THREE.MeshStandardMaterial, patch: MaterialPatch): MaterialPatch {
  const result: MaterialPatch = {}

  for (const key of Object.keys(patch) as Array<keyof MaterialPatch>) {
    if (key === 'color') {
      result.color = '#' + material.color.getHexString()
    } else if (key === 'emissive') {
      result.emissive = '#' + material.emissive.getHexString()
    } else if (key === 'side') {
      result.side =
        material.side === THREE.BackSide
          ? 'back'
          : material.side === THREE.DoubleSide
            ? 'double'
            : 'front'
    } else {
      result[key] = material[key] as never
    }
  }

  return result
}

/**
 * MeshStandardMaterial 属性变更命令。
 */
export class MaterialChangeCommand extends BaseCommand {
  readonly name: string

  private _object: THREE.Object3D
  private _material: THREE.MeshStandardMaterial
  private _oldPatch: MaterialPatch
  private _newPatch: MaterialPatch
  private _timestamp: number

  constructor(object: THREE.Object3D, material: THREE.MeshStandardMaterial, patch: MaterialPatch) {
    super()
    this._object = object
    this._material = material
    this._newPatch = { ...patch }
    this._oldPatch = normalizePatch(material, patch)
    this._timestamp = Date.now()
    this.name = `修改 "${object.name || 'Object'}" 材质`
  }

  execute(): void {
    this._apply(this._newPatch)
  }

  undo(): void {
    this._apply(this._oldPatch)
  }

  canMergeWith(command: ICommand): boolean {
    if (!(command instanceof MaterialChangeCommand)) return false
    if (command._object !== this._object) return false
    if (command._material !== this._material) return false

    const thisKeys = Object.keys(this._newPatch).sort().join(',')
    const commandKeys = Object.keys(command._newPatch).sort().join(',')
    return thisKeys === commandKeys && this._timestamp - command._timestamp < 500
  }

  mergeWith(command: ICommand): void {
    if (command instanceof MaterialChangeCommand) {
      this._oldPatch = command._oldPatch
    }
  }

  private _apply(patch: MaterialPatch): void {
    getMaterialManager().updateProps(this._material, patch)
    this._material.needsUpdate = true
    this._object.userData.materialModified = true

    const engine = getEngine()
    if (engine?.isInitialized) {
      engine.selectionManager.updateOriginalMaterial(this._object)
    }

    eventBus.emit('scene:property-changed', {
      target: this._material,
      property: 'material',
      value: patch,
    })
  }
}
