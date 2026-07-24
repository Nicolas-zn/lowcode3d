/**
 * 灯光管理器
 * 提供灯光创建、编辑和可视化辅助的工具
 */
import * as THREE from 'three'
import type { IPresetLightingEnvironment } from '../data/presetLightingEnvironments'

/**
 * 灯光类型
 */
export type LightType = 'ambient' | 'directional' | 'point' | 'spot' | 'hemisphere'

/**
 * 灯光创建选项
 */
export interface ILightOptions {
  name?: string
  color?: number | string
  intensity?: number
  position?: { x: number; y: number; z: number }
  castShadow?: boolean
  // Point & Spot
  distance?: number
  decay?: number
  // Spot
  angle?: number
  penumbra?: number
  // Directional & Spot target
  target?: { x: number; y: number; z: number }
  // Hemisphere
  groundColor?: number | string
}

/**
 * 灯光属性接口
 */
export interface ILightProps {
  type: LightType
  color: string
  intensity: number
  castShadow: boolean
  distance?: number
  decay?: number
  angle?: number
  penumbra?: number
  groundColor?: string
  position: { x: number; y: number; z: number }
  target?: { x: number; y: number; z: number }
}

/**
 * 灯光与辅助对象的配对
 */
interface LightEntry {
  light: THREE.Light
  helper: THREE.Object3D | null
}

/**
 * 灯光管理器类
 */
export class LightManager {
  private static _instance: LightManager | null = null

  private _scene: THREE.Scene | null = null
  private _lights: Map<string, LightEntry> = new Map()
  private _helpersVisible: boolean = false

  private constructor() {}

  /**
   * 获取单例实例
   */
  static getInstance(): LightManager {
    if (!LightManager._instance) {
      LightManager._instance = new LightManager()
    }
    return LightManager._instance
  }

  /**
   * 绑定场景
   */
  bindScene(scene: THREE.Scene): void {
    this._scene = scene
  }

  /**
   * 创建环境光
   */
  createAmbientLight(options: ILightOptions = {}): THREE.AmbientLight {
    const { name, color = 0xffffff, intensity = 0.5 } = options

    const light = new THREE.AmbientLight(color, intensity)
    light.name = name || `AmbientLight_${this._lights.size + 1}`
    light.userData.lightType = 'ambient'
    light.userData.selectable = true

    this._registerLight(light, null)
    return light
  }

  /**
   * 创建平行光
   */
  createDirectionalLight(options: ILightOptions = {}): THREE.DirectionalLight {
    const {
      name,
      color = 0xffffff,
      intensity = 1,
      position = { x: 5, y: 10, z: 5 },
      castShadow = true,
      target = { x: 0, y: 0, z: 0 },
    } = options

    const light = new THREE.DirectionalLight(color, intensity)
    light.name = name || `DirectionalLight_${this._lights.size + 1}`
    light.position.set(position.x, position.y, position.z)
    light.castShadow = castShadow
    light.userData.lightType = 'directional'
    light.userData.selectable = true

    // 阴影配置
    if (castShadow) {
      light.shadow.mapSize.width = 2048
      light.shadow.mapSize.height = 2048
      light.shadow.camera.near = 0.5
      light.shadow.camera.far = 100
      light.shadow.camera.left = -20
      light.shadow.camera.right = 20
      light.shadow.camera.top = 20
      light.shadow.camera.bottom = -20
      light.shadow.bias = -0.0001
    }

    // 设置目标
    light.target.position.set(target.x, target.y, target.z)

    // 创建辅助器
    const helper = new THREE.DirectionalLightHelper(light, 2)
    helper.visible = this._helpersVisible

    this._registerLight(light, helper)
    return light
  }

  /**
   * 创建点光源
   */
  createPointLight(options: ILightOptions = {}): THREE.PointLight {
    const {
      name,
      color = 0xffffff,
      intensity = 1,
      position = { x: 0, y: 5, z: 0 },
      distance = 0,
      decay = 2,
      castShadow = true,
    } = options

    const light = new THREE.PointLight(color, intensity, distance, decay)
    light.name = name || `PointLight_${this._lights.size + 1}`
    light.position.set(position.x, position.y, position.z)
    light.castShadow = castShadow
    light.userData.lightType = 'point'
    light.userData.selectable = true

    // 阴影配置
    if (castShadow) {
      light.shadow.mapSize.width = 1024
      light.shadow.mapSize.height = 1024
      light.shadow.camera.near = 0.5
      light.shadow.camera.far = 50
      light.shadow.bias = -0.0001
    }

    // 创建辅助器
    const helper = new THREE.PointLightHelper(light, 0.5)
    helper.visible = this._helpersVisible

    this._registerLight(light, helper)
    return light
  }

  /**
   * 创建聚光灯
   */
  createSpotLight(options: ILightOptions = {}): THREE.SpotLight {
    const {
      name,
      color = 0xffffff,
      intensity = 1,
      position = { x: 0, y: 10, z: 0 },
      distance = 0,
      decay = 2,
      angle = Math.PI / 6,
      penumbra = 0.1,
      castShadow = true,
      target = { x: 0, y: 0, z: 0 },
    } = options

    const light = new THREE.SpotLight(color, intensity, distance, angle, penumbra, decay)
    light.name = name || `SpotLight_${this._lights.size + 1}`
    light.position.set(position.x, position.y, position.z)
    light.castShadow = castShadow
    light.userData.lightType = 'spot'
    light.userData.selectable = true

    // 阴影配置
    if (castShadow) {
      light.shadow.mapSize.width = 1024
      light.shadow.mapSize.height = 1024
      light.shadow.camera.near = 0.5
      light.shadow.camera.far = 50
      light.shadow.bias = -0.0001
    }

    // 设置目标
    light.target.position.set(target.x, target.y, target.z)

    // 创建辅助器
    const helper = new THREE.SpotLightHelper(light)
    helper.visible = this._helpersVisible

    this._registerLight(light, helper)
    return light
  }

  /**
   * 创建半球光
   */
  createHemisphereLight(options: ILightOptions = {}): THREE.HemisphereLight {
    const {
      name,
      color = 0xffffbb,
      groundColor = 0x080820,
      intensity = 0.5,
      position = { x: 0, y: 10, z: 0 },
    } = options

    const light = new THREE.HemisphereLight(color, groundColor, intensity)
    light.name = name || `HemisphereLight_${this._lights.size + 1}`
    light.position.set(position.x, position.y, position.z)
    light.userData.lightType = 'hemisphere'
    light.userData.selectable = true

    // 创建辅助器
    const helper = new THREE.HemisphereLightHelper(light, 1)
    helper.visible = this._helpersVisible

    this._registerLight(light, helper)
    return light
  }

  /**
   * 根据类型创建灯光
   */
  createLight(type: LightType, options: ILightOptions = {}): THREE.Light {
    switch (type) {
      case 'ambient':
        return this.createAmbientLight(options)
      case 'directional':
        return this.createDirectionalLight(options)
      case 'point':
        return this.createPointLight(options)
      case 'spot':
        return this.createSpotLight(options)
      case 'hemisphere':
        return this.createHemisphereLight(options)
      default:
        throw new Error(`Unknown light type: ${type}`)
    }
  }

  /**
   * 注册灯光
   */
  private _registerLight(light: THREE.Light, helper: THREE.Object3D | null): void {
    if (!this._scene) {
      console.warn('LightManager: Scene not bound')
      return
    }

    this._scene.add(light)
    if (light instanceof THREE.DirectionalLight || light instanceof THREE.SpotLight) {
      this._scene.add(light.target)
    }
    if (helper) {
      this._scene.add(helper)
    }

    this._lights.set(light.uuid, { light, helper })
  }

  /**
   * 移除灯光
   */
  removeLight(uuid: string): boolean {
    const entry = this._lights.get(uuid)
    if (!entry || !this._scene) return false

    this._scene.remove(entry.light)
    if (entry.helper) {
      this._scene.remove(entry.helper)
    }

    // 移除目标对象
    if (entry.light instanceof THREE.DirectionalLight || entry.light instanceof THREE.SpotLight) {
      this._scene.remove(entry.light.target)
    }

    this._lights.delete(uuid)
    return true
  }

  /**
   * 获取灯光属性
   */
  getLightProps(light: THREE.Light): ILightProps | null {
    const type = light.userData.lightType as LightType
    if (!type) return null

    const props: ILightProps = {
      type,
      color: '#' + (light.color as THREE.Color).getHexString(),
      intensity: light.intensity,
      castShadow: light.castShadow || false,
      position: {
        x: light.position.x,
        y: light.position.y,
        z: light.position.z,
      },
    }

    if (light instanceof THREE.PointLight || light instanceof THREE.SpotLight) {
      props.distance = light.distance
      props.decay = light.decay
    }

    if (light instanceof THREE.SpotLight) {
      props.angle = light.angle
      props.penumbra = light.penumbra
      props.target = {
        x: light.target.position.x,
        y: light.target.position.y,
        z: light.target.position.z,
      }
    }

    if (light instanceof THREE.DirectionalLight) {
      props.target = {
        x: light.target.position.x,
        y: light.target.position.y,
        z: light.target.position.z,
      }
    }

    if (light instanceof THREE.HemisphereLight) {
      props.groundColor = '#' + light.groundColor.getHexString()
    }

    return props
  }

  /**
   * 更新灯光颜色
   */
  updateColor(light: THREE.Light, color: string | number): void {
    light.color.set(color)
    this._updateHelper(light)
  }

  /**
   * 更新灯光强度
   */
  updateIntensity(light: THREE.Light, intensity: number): void {
    light.intensity = Math.max(0, intensity)
    this._updateHelper(light)
  }

  /**
   * 更新投射阴影
   */
  updateCastShadow(light: THREE.Light, castShadow: boolean): void {
    if ('castShadow' in light) {
      light.castShadow = castShadow
    }
  }

  /**
   * 更新距离（Point/Spot）
   */
  updateDistance(light: THREE.Light, distance: number): void {
    if (light instanceof THREE.PointLight || light instanceof THREE.SpotLight) {
      light.distance = Math.max(0, distance)
    }
  }

  /**
   * 更新衰减（Point/Spot）
   */
  updateDecay(light: THREE.Light, decay: number): void {
    if (light instanceof THREE.PointLight || light instanceof THREE.SpotLight) {
      light.decay = Math.max(0, decay)
    }
  }

  /**
   * 更新角度（Spot）
   */
  updateAngle(light: THREE.Light, angle: number): void {
    if (light instanceof THREE.SpotLight) {
      light.angle = Math.max(0, Math.min(Math.PI / 2, angle))
      this._updateHelper(light)
    }
  }

  /**
   * 更新半影（Spot）
   */
  updatePenumbra(light: THREE.Light, penumbra: number): void {
    if (light instanceof THREE.SpotLight) {
      light.penumbra = Math.max(0, Math.min(1, penumbra))
    }
  }

  /**
   * 更新地面颜色（Hemisphere）
   */
  updateGroundColor(light: THREE.Light, color: string | number): void {
    if (light instanceof THREE.HemisphereLight) {
      light.groundColor.set(color)
      this._updateHelper(light)
    }
  }

  /**
   * 更新辅助器
   */
  private _updateHelper(light: THREE.Light): void {
    const entry = this._lights.get(light.uuid)
    if (!entry?.helper) return

    if (entry.helper instanceof THREE.DirectionalLightHelper) {
      entry.helper.update()
    } else if (entry.helper instanceof THREE.SpotLightHelper) {
      entry.helper.update()
    } else if (entry.helper instanceof THREE.PointLightHelper) {
      entry.helper.update()
    } else if (entry.helper instanceof THREE.HemisphereLightHelper) {
      entry.helper.update()
    }
  }

  /**
   * 设置所有辅助器可见性
   */
  setHelpersVisible(visible: boolean): void {
    this._helpersVisible = visible
    this._lights.forEach((entry) => {
      if (entry.helper) {
        entry.helper.visible = visible
      }
    })
  }

  /**
   * 获取所有灯光
   */
  getAllLights(): THREE.Light[] {
    return Array.from(this._lights.values()).map((entry) => entry.light)
  }

  /**
   * 获取灯光数量
   */
  get count(): number {
    return this._lights.size
  }

  /**
   * 判断对象是否是灯光
   */
  static isLight(object: THREE.Object3D): object is THREE.Light {
    return object instanceof THREE.Light
  }

  /**
   * 获取灯光类型
   */
  static getLightType(light: THREE.Light): LightType | null {
    return light.userData.lightType || null
  }

  /**
   * 清除所有灯光
   */
  clearAllLights(): void {
    const uuids = Array.from(this._lights.keys())
    uuids.forEach((uuid) => this.removeLight(uuid))
  }

  /**
   * 应用预设灯光环境
   */
  applyPreset(preset: IPresetLightingEnvironment): THREE.Light[] {
    // 清除现有灯光
    this.clearAllLights()

    // 创建预设中的所有灯光
    const createdLights: THREE.Light[] = []
    preset.lights.forEach((lightConfig) => {
      const light = this.createLight(lightConfig.type, lightConfig.options)
      createdLights.push(light)
    })

    return createdLights
  }

  /**
   * 释放资源
   */
  dispose(): void {
    this._lights.forEach((entry) => {
      if (this._scene) {
        this._scene.remove(entry.light)
        if (entry.helper) {
          this._scene.remove(entry.helper)
        }
      }
    })
    this._lights.clear()
    this._scene = null
  }
}

// 导出单例获取函数
export function getLightManager(): LightManager {
  return LightManager.getInstance()
}
