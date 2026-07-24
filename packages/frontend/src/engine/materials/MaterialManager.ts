/**
 * 材质管理器
 * 提供材质提取、更新和管理的工具函数
 */
import * as THREE from 'three'
import { getTextureLoader } from '../loaders/TextureLoader'

/**
 * PBR 材质属性接口
 */
export interface IPBRMaterialProps {
  color: string
  metalness: number
  roughness: number
  opacity: number
  transparent: boolean
  emissive?: string
  emissiveIntensity?: number
  wireframe?: boolean
  flatShading?: boolean
  side?: 'front' | 'back' | 'double'
}

/**
 * 纹理槽位类型
 */
export type TextureSlot =
  | 'map'
  | 'normalMap'
  | 'roughnessMap'
  | 'metalnessMap'
  | 'aoMap'
  | 'emissiveMap'

/**
 * 纹理信息
 */
export interface ITextureInfo {
  slot: TextureSlot
  url: string | null
  texture: THREE.Texture | null
}

/**
 * 材质信息
 */
export interface IMaterialInfo {
  uuid: string
  name: string
  type: string
  props: IPBRMaterialProps
  textures: Record<TextureSlot, ITextureInfo>
}

/**
 * 材质管理器类
 */
export class MaterialManager {
  private static _instance: MaterialManager | null = null

  private constructor() {}

  /**
   * 获取单例实例
   */
  static getInstance(): MaterialManager {
    if (!MaterialManager._instance) {
      MaterialManager._instance = new MaterialManager()
    }
    return MaterialManager._instance
  }

  /**
   * 从对象中提取材质
   * @param object Three.js 对象
   * @returns 材质数组（因为一个对象可能有多个材质）
   */
  extractMaterials(object: THREE.Object3D): THREE.Material[] {
    const materials: THREE.Material[] = []
    const seen = new Set<string>()

    object.traverse((child) => {
      if (child instanceof THREE.Mesh && child.material) {
        const mats = Array.isArray(child.material) ? child.material : [child.material]
        mats.forEach((mat) => {
          if (!seen.has(mat.uuid)) {
            seen.add(mat.uuid)
            materials.push(mat)
          }
        })
      }
    })

    return materials
  }

  /**
   * 获取对象的主材质（第一个材质）
   * 如果对象本身是 Mesh，直接返回其材质
   */
  getPrimaryMaterial(object: THREE.Object3D): THREE.Material | null {
    // 如果对象本身是 Mesh，直接返回其材质
    if (object instanceof THREE.Mesh && object.material) {
      const material = Array.isArray(object.material) ? object.material[0] : object.material
      return material || null
    }

    // 否则遍历子对象查找第一个材质
    const materials = this.extractMaterials(object)
    return materials[0] || null
  }

  /**
   * 获取 PBR 材质属性
   */
  getMaterialProps(material: THREE.Material): IPBRMaterialProps | null {
    if (!(material instanceof THREE.MeshStandardMaterial)) {
      return null
    }

    // 优先使用 userData 中存储的用户设置（用于选择高亮状态下的材质）
    const userEmissive = material.userData.userEmissive
    const emissiveHex = userEmissive !== undefined ? userEmissive : material.emissive.getHex()
    const emissiveIntensity =
      material.userData.userEmissiveIntensity !== undefined
        ? material.userData.userEmissiveIntensity
        : material.emissiveIntensity

    return {
      color: '#' + material.color.getHexString(),
      metalness: material.metalness,
      roughness: material.roughness,
      opacity: material.opacity,
      transparent: material.transparent,
      emissive: '#' + emissiveHex.toString(16).padStart(6, '0'),
      emissiveIntensity: emissiveIntensity,
      wireframe: material.wireframe,
      flatShading: material.flatShading,
      side: this._sideToString(material.side),
    }
  }

  /**
   * 获取材质完整信息
   */
  getMaterialInfo(material: THREE.Material): IMaterialInfo | null {
    if (!(material instanceof THREE.MeshStandardMaterial)) {
      return null
    }

    const props = this.getMaterialProps(material)
    if (!props) return null

    return {
      uuid: material.uuid,
      name: material.name || 'Unnamed Material',
      type: material.type,
      props,
      textures: {
        map: this._getTextureInfo('map', material.map),
        normalMap: this._getTextureInfo('normalMap', material.normalMap),
        roughnessMap: this._getTextureInfo('roughnessMap', material.roughnessMap),
        metalnessMap: this._getTextureInfo('metalnessMap', material.metalnessMap),
        aoMap: this._getTextureInfo('aoMap', material.aoMap),
        emissiveMap: this._getTextureInfo('emissiveMap', material.emissiveMap),
      },
    }
  }

  /**
   * 更新材质颜色
   */
  updateColor(material: THREE.Material, color: string): void {
    if (material instanceof THREE.MeshStandardMaterial) {
      material.color.set(color)
      material.needsUpdate = true
    }
  }

  /**
   * 更新金属度
   */
  updateMetalness(material: THREE.Material, metalness: number): void {
    if (material instanceof THREE.MeshStandardMaterial) {
      material.metalness = Math.max(0, Math.min(1, metalness))
      material.needsUpdate = true
    }
  }

  /**
   * 更新粗糙度
   */
  updateRoughness(material: THREE.Material, roughness: number): void {
    if (material instanceof THREE.MeshStandardMaterial) {
      material.roughness = Math.max(0, Math.min(1, roughness))
      material.needsUpdate = true
    }
  }

  /**
   * 更新不透明度
   */
  updateOpacity(material: THREE.Material, opacity: number): void {
    if (material instanceof THREE.MeshStandardMaterial) {
      material.opacity = Math.max(0, Math.min(1, opacity))
      material.transparent = opacity < 1
      material.needsUpdate = true
    }
  }

  /**
   * 更新自发光颜色
   */
  updateEmissive(material: THREE.Material, color: string): void {
    if (material instanceof THREE.MeshStandardMaterial) {
      material.emissive.set(color)
      // 存储用户设置的值到 userData（用于选择高亮时的同步）
      material.userData.userEmissive = material.emissive.getHex()
      material.needsUpdate = true
    }
  }

  /**
   * 更新自发光强度
   */
  updateEmissiveIntensity(material: THREE.Material, intensity: number): void {
    if (material instanceof THREE.MeshStandardMaterial) {
      material.emissiveIntensity = Math.max(0, intensity)
      // 存储用户设置的值到 userData
      material.userData.userEmissiveIntensity = material.emissiveIntensity
      material.needsUpdate = true
    }
  }

  /**
   * 更新线框模式
   */
  updateWireframe(material: THREE.Material, wireframe: boolean): void {
    if (material instanceof THREE.MeshStandardMaterial) {
      material.wireframe = wireframe
      material.needsUpdate = true
    }
  }

  /**
   * 更新面渲染方向
   */
  updateSide(material: THREE.Material, side: 'front' | 'back' | 'double'): void {
    if (material instanceof THREE.MeshStandardMaterial) {
      material.side = this._stringToSide(side)
      material.needsUpdate = true
    }
  }

  /**
   * 批量更新材质属性
   */
  updateProps(material: THREE.Material, props: Partial<IPBRMaterialProps>): void {
    if (!(material instanceof THREE.MeshStandardMaterial)) return

    if (props.color !== undefined) this.updateColor(material, props.color)
    if (props.metalness !== undefined) this.updateMetalness(material, props.metalness)
    if (props.roughness !== undefined) this.updateRoughness(material, props.roughness)
    if (props.opacity !== undefined) this.updateOpacity(material, props.opacity)
    if (props.transparent !== undefined) {
      material.transparent = props.transparent
      material.needsUpdate = true
    }
    if (props.emissive !== undefined) this.updateEmissive(material, props.emissive)
    if (props.emissiveIntensity !== undefined)
      this.updateEmissiveIntensity(material, props.emissiveIntensity)
    if (props.wireframe !== undefined) this.updateWireframe(material, props.wireframe)
    if (props.flatShading !== undefined) {
      material.flatShading = props.flatShading
      material.needsUpdate = true
    }
    if (props.side !== undefined) this.updateSide(material, props.side)
  }

  /**
   * 设置纹理
   */
  async setTexture(material: THREE.Material, slot: TextureSlot, url: string): Promise<void> {
    if (!(material instanceof THREE.MeshStandardMaterial)) return

    const textureLoader = getTextureLoader()

    try {
      // 根据纹理类型设置颜色空间
      const colorSpace =
        slot === 'map' || slot === 'emissiveMap' ? THREE.SRGBColorSpace : THREE.LinearSRGBColorSpace

      const texture = await textureLoader.loadTexture(url, { colorSpace })

      // 释放旧纹理
      const oldTexture = material[slot]
      if (oldTexture) {
        oldTexture.dispose()
      }

      // 设置新纹理
      material[slot] = texture
      material.needsUpdate = true
    } catch (error) {
      console.error(`Failed to load texture for ${slot}:`, error)
      throw error
    }
  }

  /**
   * 移除纹理
   */
  removeTexture(material: THREE.Material, slot: TextureSlot): void {
    if (!(material instanceof THREE.MeshStandardMaterial)) return

    const texture = material[slot]
    if (texture) {
      texture.dispose()
      material[slot] = null
      material.needsUpdate = true
    }
  }

  /**
   * 克隆材质
   */
  cloneMaterial(material: THREE.Material): THREE.Material {
    const cloned = material.clone()
    cloned.uuid = THREE.MathUtils.generateUUID()
    return cloned
  }

  /**
   * 将所有对象的材质替换为新材质
   */
  replaceMaterial(object: THREE.Object3D, newMaterial: THREE.Material): void {
    object.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        // 释放旧材质
        if (Array.isArray(child.material)) {
          child.material.forEach((mat) => mat.dispose())
        } else if (child.material) {
          child.material.dispose()
        }
        // 设置新材质
        child.material = newMaterial
      }
    })
  }

  /**
   * 获取纹理信息
   */
  private _getTextureInfo(slot: TextureSlot, texture: THREE.Texture | null): ITextureInfo {
    return {
      slot,
      url: texture?.userData?.url || null,
      texture,
    }
  }

  /**
   * Side 枚举转字符串
   */
  private _sideToString(side: THREE.Side): 'front' | 'back' | 'double' {
    switch (side) {
      case THREE.FrontSide:
        return 'front'
      case THREE.BackSide:
        return 'back'
      case THREE.DoubleSide:
        return 'double'
      default:
        return 'front'
    }
  }

  /**
   * 字符串转 Side 枚举
   */
  private _stringToSide(side: 'front' | 'back' | 'double'): THREE.Side {
    switch (side) {
      case 'front':
        return THREE.FrontSide
      case 'back':
        return THREE.BackSide
      case 'double':
        return THREE.DoubleSide
      default:
        return THREE.FrontSide
    }
  }
}

// 导出单例获取函数
export function getMaterialManager(): MaterialManager {
  return MaterialManager.getInstance()
}

// 导出便捷函数
export function extractMaterials(object: THREE.Object3D): THREE.Material[] {
  return getMaterialManager().extractMaterials(object)
}

export function getPrimaryMaterial(object: THREE.Object3D): THREE.Material | null {
  return getMaterialManager().getPrimaryMaterial(object)
}

export function getMaterialProps(material: THREE.Material): IPBRMaterialProps | null {
  return getMaterialManager().getMaterialProps(material)
}
