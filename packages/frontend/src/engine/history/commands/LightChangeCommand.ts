import * as THREE from 'three'
import type { ILightProps } from '../../lights'
import { getLightManager } from '../../lights'
import { eventBus } from '../../events'
import { BaseCommand, type ICommand } from '../Command'

type LightPatch = Partial<Omit<ILightProps, 'type' | 'position' | 'target'>>

function capturePatch(light: THREE.Light, patch: LightPatch): LightPatch {
  const props = getLightManager().getLightProps(light)
  if (!props) return {}

  const result: LightPatch = {}
  for (const key of Object.keys(patch) as Array<keyof LightPatch>) {
    result[key] = props[key] as never
  }
  return result
}

/**
 * 灯光属性变更命令。
 */
export class LightChangeCommand extends BaseCommand {
  readonly name: string

  private _light: THREE.Light
  private _oldPatch: LightPatch
  private _newPatch: LightPatch
  private _timestamp: number

  constructor(light: THREE.Light, patch: LightPatch) {
    super()
    this._light = light
    this._newPatch = { ...patch }
    this._oldPatch = capturePatch(light, patch)
    this._timestamp = Date.now()
    this.name = `修改 "${light.name || 'Light'}" 灯光`
  }

  execute(): void {
    this._apply(this._newPatch)
  }

  undo(): void {
    this._apply(this._oldPatch)
  }

  canMergeWith(command: ICommand): boolean {
    if (!(command instanceof LightChangeCommand)) return false
    if (command._light !== this._light) return false
    const thisKeys = Object.keys(this._newPatch).sort().join(',')
    const commandKeys = Object.keys(command._newPatch).sort().join(',')
    return thisKeys === commandKeys && this._timestamp - command._timestamp < 500
  }

  mergeWith(command: ICommand): void {
    if (command instanceof LightChangeCommand) {
      this._oldPatch = command._oldPatch
    }
  }

  private _apply(patch: LightPatch): void {
    const lightManager = getLightManager()

    if (patch.color !== undefined) lightManager.updateColor(this._light, patch.color)
    if (patch.intensity !== undefined) lightManager.updateIntensity(this._light, patch.intensity)
    if (patch.castShadow !== undefined) lightManager.updateCastShadow(this._light, patch.castShadow)
    if (patch.distance !== undefined) lightManager.updateDistance(this._light, patch.distance)
    if (patch.decay !== undefined) lightManager.updateDecay(this._light, patch.decay)
    if (patch.angle !== undefined) lightManager.updateAngle(this._light, patch.angle)
    if (patch.penumbra !== undefined) lightManager.updatePenumbra(this._light, patch.penumbra)
    if (patch.groundColor !== undefined)
      lightManager.updateGroundColor(this._light, patch.groundColor)

    eventBus.emit('scene:property-changed', {
      target: this._light,
      property: 'light',
      value: patch,
    })
  }
}
