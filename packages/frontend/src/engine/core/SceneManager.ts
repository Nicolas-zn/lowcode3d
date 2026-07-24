import * as THREE from 'three'
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js'
import type { ISceneManager } from '../types/IEngine'

/**
 * 场景管理器
 * 封装 THREE.Scene，提供场景操作的高级API
 */
export class SceneManager implements ISceneManager {
  public scene: THREE.Scene
  private _environmentMap: THREE.Texture | null = null
  private _rgbeLoader: RGBELoader

  constructor() {
    this.scene = new THREE.Scene()
    this._rgbeLoader = new RGBELoader()

    // 默认背景色
    this.scene.background = new THREE.Color(0x1a1a2e)
  }

  /**
   * 设置背景颜色
   */
  setBackgroundColor(color: string | number): void {
    this.scene.background = new THREE.Color(color)
    this.scene.userData.backgroundType = 'color'
  }

  /**
   * 设置环境贴图 (HDR)
   */
  async setEnvironmentMap(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this._rgbeLoader.load(
        url,
        (texture) => {
          texture.mapping = THREE.EquirectangularReflectionMapping
          this.scene.environment = texture
          this._environmentMap = texture
          // 保存信息用于序列化
          this.scene.userData.environmentUrl = url
          resolve()
        },
        undefined,
        (error) => {
          console.error('Failed to load environment map:', error)
          reject(error)
        }
      )
    })
  }

  /**
   * 设置背景为环境贴图
   */
  setBackgroundAsEnvironment(): void {
    if (this._environmentMap) {
      this.scene.background = this._environmentMap
      this.scene.userData.backgroundType = 'environment'
    }
  }

  /**
   * 添加对象到场景
   */
  addObject(object: THREE.Object3D): void {
    this.scene.add(object)
  }

  /**
   * 从场景移除对象
   */
  removeObject(object: THREE.Object3D): void {
    this.scene.remove(object)
  }

  /**
   * 获取场景中所有可选择对象
   */
  getSelectableObjects(): THREE.Object3D[] {
    const selectables: THREE.Object3D[] = []
    this.scene.traverse((object) => {
      if (object.userData.selectable !== false && object instanceof THREE.Mesh) {
        selectables.push(object)
      }
    })
    return selectables
  }

  /**
   * 根据 UUID 查找对象
   */
  getObjectByUUID(uuid: string): THREE.Object3D | undefined {
    return this.scene.getObjectByProperty('uuid', uuid)
  }

  /**
   * 设置雾效
   */
  setFog(type: 'linear' | 'exponential', color: string | number, ...args: number[]): void {
    if (type === 'linear') {
      const [near = 10, far = 100] = args
      this.scene.fog = new THREE.Fog(new THREE.Color(color), near, far)
    } else {
      const [density = 0.01] = args
      this.scene.fog = new THREE.FogExp2(new THREE.Color(color), density)
    }
  }

  /**
   * 清除雾效
   */
  clearFog(): void {
    this.scene.fog = null
  }

  /**
   * 清空场景（保留灯光和相机）
   */
  clear(): void {
    const objectsToRemove: THREE.Object3D[] = []

    this.scene.traverse((object) => {
      if (
        !(object instanceof THREE.Camera) &&
        !(object instanceof THREE.Light) &&
        object !== this.scene
      ) {
        objectsToRemove.push(object)
      }
    })

    objectsToRemove.forEach((obj) => {
      if (obj.parent) {
        obj.parent.remove(obj)
      }
    })
  }

  /**
   * 释放资源
   */
  dispose(): void {
    // 释放环境贴图
    if (this._environmentMap) {
      this._environmentMap.dispose()
      this._environmentMap = null
    }

    // 遍历场景释放所有几何体和材质
    this.scene.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.geometry?.dispose()
        if (Array.isArray(object.material)) {
          object.material.forEach((mat) => mat.dispose())
        } else {
          object.material?.dispose()
        }
      }
    })

    // 清空场景
    this.scene.clear()
  }
}
