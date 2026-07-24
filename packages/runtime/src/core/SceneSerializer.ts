/**
 * 场景序列化器
 * 将三维场景导出为 IProjectData 格式，以及从 IProjectData 重建场景
 */
import * as THREE from 'three'
import type {
  ComponentInstance,
  IProjectData,
  ISceneObjectData,
  IModelOrigin,
  IOriginResources,
  ILightData,
  ICameraData,
  IEnvironmentData,
  PrimitiveType,
  IPrimitiveParams,
  IMaterialOverrides,
  IMaterialTextureData,
  IVector3,
  IHDRIOrigin,
  ITextureOrigin,
  IAssetManifest,
  IAssetManifestItem,
  MaterialTextureSlot,
  PostProcessingData,
} from '@lowcode3d/shared'
import { createDefaultProjectData, migrateProjectData } from '@lowcode3d/shared'
import { getEngine } from './Engine'
import { ObjectFactory } from '../objects/ObjectFactory'
import { BillboardFactory, type IBillboardData, BillboardMode } from '../objects'
import { getModelLoader } from '../loaders/ModelLoader'
import { getTextureLoader } from '../loaders/TextureLoader'
import { eventBus } from '../events'
import { getLightManager, type LightType } from '../lights'
import { markModelRootForSelection } from '../utils/modelSelection'

/**
 * 场景序列化器
 */
export class SceneSerializer {
  private static _modelOrigins = new Map<string, IModelOrigin>()
  private static _hdriOrigins = new Map<string, IHDRIOrigin>()
  private static _textureOrigins = new Map<string, ITextureOrigin>()

  private static _originIdCounter = 0

  /**
   * 生成唯一的 origin ID
   */
  private static _generateOriginId(): string {
    return `origin_${++this._originIdCounter}_${Date.now()}`
  }

  /**
   * 重置状态
   */
  static reset(): void {
    this._modelOrigins.clear()
    this._hdriOrigins.clear()
    this._textureOrigins.clear()
    this._originIdCounter = 0
  }

  private static _cloneProjectJson<T>(value: T | null | undefined, fallback: T): T {
    if (value === null || value === undefined) return fallback

    try {
      const json = JSON.stringify(value)
      return json === undefined ? fallback : (JSON.parse(json) as T)
    } catch {
      try {
        return structuredClone(value)
      } catch {
        return fallback
      }
    }
  }

  /**
   * 过滤 userData，移除循环引用和运行时对象
   */
  private static _filterUserData(
    userData?: Record<string, unknown>
  ): Record<string, unknown> | undefined {
    if (!userData) return undefined
    const cleanData = { ...userData }
    // 移除运行时循环引用属性
    if ('billboardComponent' in cleanData) {
      delete cleanData.billboardComponent
    }
    return cleanData
  }

  /**
   * 序列化当前场景为 IProjectData
   */
  static serialize(projectName: string, description?: string): IProjectData {
    const engine = getEngine()
    if (!engine) {
      throw new Error('Engine not initialized. Please refresh the page and try again.')
    }

    if (!engine.objectManager) {
      console.error('ObjectManager is undefined. Engine state:', {
        hasSceneManager: !!engine.sceneManager,
        hasCameraManager: !!engine.cameraManager,
        hasRenderManager: !!engine.renderManager,
        hasSelectionManager: !!engine.selectionManager,
        hasTransformManager: !!engine.transformManager,
      })
      throw new Error(
        'ObjectManager not initialized. This may be caused by a hot reload issue. Please refresh the page and try again.'
      )
    }

    this.reset()
    const now = new Date().toISOString()

    // 收集场景对象
    const sceneObjects: ISceneObjectData[] = []
    const components: ComponentInstance[] = []
    const componentKeys = new Set<string>()
    const objectManager = engine.objectManager

    for (const entry of objectManager.getAll()) {
      const objectData = this._serializeObject(entry.object, entry.metadata)
      if (objectData) {
        sceneObjects.push(objectData)
        const component = this._serializeComponentInstance(entry.object, objectData.uuid)
        if (component && this._appendComponentInstance(componentKeys, component)) {
          components.push(component)
        }
      }
    }

    // 收集灯光
    const lights = this._serializeLights(engine)
    this._serializeLightComponents(engine).forEach((component) => {
      if (this._appendComponentInstance(componentKeys, component)) {
        components.push(component)
      }
    })

    // 收集相机
    const camera = this._serializeCamera(engine)

    // 收集环境配置
    const environment = this._serializeEnvironment(engine)

    // 收集动画配置
    const animations = engine.animationEngine?.toJSON()

    // 构建 origin 资源列表
    const origin: IOriginResources = {
      models: Array.from(this._modelOrigins.values()),
      textures: Array.from(this._textureOrigins.values()),
      hdris: Array.from(this._hdriOrigins.values()),
    }

    // 收集资源依赖清单
    const assetManifest = this._buildAssetManifest(engine, origin, sceneObjects)

    const projectData: IProjectData = createDefaultProjectData({
      projectName,
      description,
      createdAt: now,
      updatedAt: now,
      origin,
      sceneObjects,
      components,
      lights,
      camera,
      cameraBookmarks: this._serializeCameraBookmarks(engine),
      environment,
      animations,
      postProcessing: this._serializePostProcessing(engine),
      events: this._serializeEvents(engine),
      dataSources: this._serializeDataSources(engine),
      bindings: this._serializeBindings(engine),
      assetManifest,
    })

    return projectData
  }

  /**
   * 序列化单个对象
   */
  private static _serializeObject(
    object: THREE.Object3D,
    metadata: {
      uuid: string
      name: string
      type: string
      visible: boolean
      locked: boolean
      userData?: Record<string, unknown>
    }
  ): ISceneObjectData | null {
    // 跳过不可选择的对象（如地板、辅助对象）
    if (object.userData.selectable === false) {
      return null
    }

    const objectData: ISceneObjectData = {
      uuid: metadata.uuid,
      name: metadata.name,
      type: 'model', // 默认类型
      transform: {
        position: this._toVector3(object.position),
        rotation: this._toVector3(object.rotation),
        scale: this._toVector3(object.scale),
      },
      visible: metadata.visible,
      locked: metadata.locked,
      userData: this._filterUserData(metadata.userData),
    }

    // 调试：输出广告牌的 transform
    if (object.userData.isBillboard) {
      console.log('📦 Serializing billboard:', metadata.name, {
        position: objectData.transform.position,
        rotation: objectData.transform.rotation,
        scale: objectData.transform.scale,
      })
    }

    // 判断对象类型
    if (object.userData.primitiveType) {
      // 基础几何体
      objectData.type = 'primitive'
      objectData.primitiveType = object.userData.primitiveType as PrimitiveType
      objectData.primitiveParams = object.userData.primitiveParams as IPrimitiveParams
    } else if (object.userData.isUserImported) {
      // 用户导入的本地模型 - 只存储文件名，不存储URL
      objectData.type = 'userModel'
      objectData.importedFileName = object.userData.importedFileName as string
      // 序列化被修改的子对象（通过 children 数组存储）
      // 注意：不在顶层存储 materialOverrides，避免被错误地应用到所有 mesh
      if (object.children.length > 0) {
        objectData.children = []
        this._serializeModelChildren(object, objectData.children)
      }
    } else if (object.userData.modelUrl) {
      // 外部模型（云端模型）
      objectData.type = 'model'
      const modelUrl = object.userData.modelUrl as string
      const libraryId = object.userData.libraryId as string | undefined

      // 查找或创建 origin
      let originId = this._findOriginByUrl(modelUrl)
      if (!originId) {
        originId = this._generateOriginId()
        this._modelOrigins.set(originId, {
          id: originId,
          libraryId,
          url: modelUrl,
          name: object.name || 'Model',
          category: object.userData.category as string | undefined,
        })
      }
      objectData.modelOriginId = originId

      // 序列化被修改的子对象（与 userModel 一样的处理）
      if (object.children.length > 0) {
        objectData.children = []
        this._serializeModelChildren(object, objectData.children)
      }
    } else if (object.userData.isBillboard) {
      // 广告牌
      objectData.type = 'billboard'
      objectData.billboardData = object.userData.billboardData as IBillboardData
    } else if (object instanceof THREE.Group) {
      objectData.type = 'group'
      // 序列化子对象
      if (object.children.length > 0) {
        objectData.children = []
        for (const child of object.children) {
          const childData = this._serializeObject(child, {
            uuid: child.uuid,
            name: child.name,
            type: child instanceof THREE.Mesh ? 'mesh' : 'group',
            visible: child.visible,
            locked: false,
            userData: this._filterUserData(child.userData),
          })
          if (childData) {
            objectData.children.push(childData)
          }
        }
      }
    } else if (object instanceof THREE.Mesh) {
      // 普通 Mesh - 检查是否有几何体类型
      const geometry = object.geometry
      if (geometry instanceof THREE.BoxGeometry) {
        objectData.type = 'primitive'
        objectData.primitiveType = 'box'
        objectData.primitiveParams = {
          width: geometry.parameters.width,
          height: geometry.parameters.height,
          depth: geometry.parameters.depth,
        }
      } else if (geometry instanceof THREE.SphereGeometry) {
        objectData.type = 'primitive'
        objectData.primitiveType = 'sphere'
        objectData.primitiveParams = {
          radius: geometry.parameters.radius,
          widthSegments: geometry.parameters.widthSegments,
          heightSegments: geometry.parameters.heightSegments,
        }
      } else if (geometry instanceof THREE.CylinderGeometry) {
        objectData.type = 'primitive'
        objectData.primitiveType = 'cylinder'
        objectData.primitiveParams = {
          radiusTop: geometry.parameters.radiusTop,
          radiusBottom: geometry.parameters.radiusBottom,
          height: geometry.parameters.height,
          radialSegments: geometry.parameters.radialSegments,
        }
      } else if (geometry instanceof THREE.ConeGeometry) {
        objectData.type = 'primitive'
        objectData.primitiveType = 'cone'
        objectData.primitiveParams = {
          radius: geometry.parameters.radius,
          height: geometry.parameters.height,
          radialSegments: geometry.parameters.radialSegments,
        }
      } else if (geometry instanceof THREE.TorusGeometry) {
        objectData.type = 'primitive'
        objectData.primitiveType = 'torus'
        objectData.primitiveParams = {
          radius: geometry.parameters.radius,
          tube: geometry.parameters.tube,
          radialSegments: geometry.parameters.radialSegments,
          tubularSegments: geometry.parameters.tubularSegments,
        }
      } else if (geometry instanceof THREE.PlaneGeometry) {
        objectData.type = 'primitive'
        objectData.primitiveType = 'plane'
        objectData.primitiveParams = {
          width: geometry.parameters.width,
          height: geometry.parameters.height,
        }
      } else if (geometry instanceof THREE.CircleGeometry) {
        objectData.type = 'primitive'
        objectData.primitiveType = 'circle'
        objectData.primitiveParams = {
          radius: geometry.parameters.radius,
          segments: geometry.parameters.segments,
        }
      } else if (geometry instanceof THREE.RingGeometry) {
        objectData.type = 'primitive'
        objectData.primitiveType = 'ring'
        objectData.primitiveParams = {
          innerRadius: geometry.parameters.innerRadius,
          outerRadius: geometry.parameters.outerRadius,
          thetaSegments: geometry.parameters.thetaSegments,
        }
      } else if (geometry instanceof THREE.TetrahedronGeometry) {
        objectData.type = 'primitive'
        objectData.primitiveType = 'tetrahedron'
        objectData.primitiveParams = {
          radius: geometry.parameters.radius,
          detail: geometry.parameters.detail,
        }
      } else if (geometry instanceof THREE.OctahedronGeometry) {
        objectData.type = 'primitive'
        objectData.primitiveType = 'octahedron'
        objectData.primitiveParams = {
          radius: geometry.parameters.radius,
          detail: geometry.parameters.detail,
        }
      } else if (geometry instanceof THREE.IcosahedronGeometry) {
        objectData.type = 'primitive'
        objectData.primitiveType = 'icosahedron'
        objectData.primitiveParams = {
          radius: geometry.parameters.radius,
          detail: geometry.parameters.detail,
        }
      } else if (geometry instanceof THREE.DodecahedronGeometry) {
        objectData.type = 'primitive'
        objectData.primitiveType = 'dodecahedron'
        objectData.primitiveParams = {
          radius: geometry.parameters.radius,
          detail: geometry.parameters.detail,
        }
      }

      // 序列化材质属性
      objectData.materialOverrides = this._serializeMaterial(object)
    }

    return objectData
  }

  private static _serializeComponentInstance(
    object: THREE.Object3D,
    objectUuid: string
  ): ComponentInstance | null {
    const source = object.userData.component
    if (!source || typeof source !== 'object') {
      return null
    }

    const component = source as Partial<ComponentInstance>
    if (!component.type) {
      return null
    }

    return {
      id: component.id ?? `${component.type}-${objectUuid}`,
      type: component.type,
      version: component.version ?? '1.0.0',
      objectUuid,
      props: component.props ?? {},
      enabled: component.enabled ?? true,
      unsupported: component.unsupported,
    }
  }

  private static _appendComponentInstance(
    keys: Set<string>,
    component: ComponentInstance
  ): boolean {
    const key = `${component.id}:${component.objectUuid ?? ''}`
    if (keys.has(key)) return false
    keys.add(key)
    return true
  }

  /**
   * 序列化材质
   */
  private static _serializeMaterial(mesh: THREE.Mesh): IMaterialOverrides | undefined {
    const material = mesh.material
    if (!material || Array.isArray(material)) {
      return undefined
    }

    if (material instanceof THREE.MeshStandardMaterial) {
      // 转换 side 值
      let side: 'front' | 'back' | 'double' | undefined
      if (material.side === THREE.BackSide) {
        side = 'back'
      } else if (material.side === THREE.DoubleSide) {
        side = 'double'
      } else {
        side = 'front'
      }

      return {
        presetId: this._serializeMaterialPresetId(mesh, material),
        presetName: this._serializeMaterialPresetName(mesh, material),
        color: '#' + material.color.getHexString(),
        metalness: material.metalness,
        roughness: material.roughness,
        opacity: material.opacity,
        transparent: material.transparent,
        emissive: '#' + material.emissive.getHexString(),
        emissiveIntensity: material.emissiveIntensity,
        wireframe: material.wireframe,
        side,
        textures: this._serializeMaterialTextures(material),
      }
    }

    return undefined
  }

  private static _serializeMaterialPresetId(
    mesh: THREE.Mesh,
    material: THREE.MeshStandardMaterial
  ): string | undefined {
    const presetId = material.userData?.materialPresetId ?? mesh.userData?.materialPresetId
    return typeof presetId === 'string' && presetId.trim() !== '' ? presetId : undefined
  }

  private static _serializeMaterialPresetName(
    mesh: THREE.Mesh,
    material: THREE.MeshStandardMaterial
  ): string | undefined {
    const presetName = material.userData?.materialPresetName ?? mesh.userData?.materialPresetName
    return typeof presetName === 'string' && presetName.trim() !== '' ? presetName : undefined
  }

  private static _serializeMaterialTextures(
    material: THREE.MeshStandardMaterial
  ): IMaterialOverrides['textures'] | undefined {
    const slots: MaterialTextureSlot[] = [
      'map',
      'normalMap',
      'roughnessMap',
      'metalnessMap',
      'aoMap',
      'emissiveMap',
      'alphaMap',
    ]
    const textures: IMaterialOverrides['textures'] = {}

    slots.forEach((slot) => {
      const texture = material[slot] as THREE.Texture | null
      const data = this._serializeMaterialTexture(slot, texture)
      if (data) {
        textures[slot] = data
      }
    })

    return Object.keys(textures).length > 0 ? textures : undefined
  }

  private static _serializeMaterialTexture(
    slot: MaterialTextureSlot,
    texture: THREE.Texture | null
  ): IMaterialTextureData | undefined {
    const url = this._getTextureUrl(texture)
    if (!texture || !url) return undefined

    const originId = this._findOrCreateTextureOrigin(url, slot)
    return {
      originId,
      url,
      repeat: [texture.repeat.x, texture.repeat.y],
      offset: [texture.offset.x, texture.offset.y],
      rotation: texture.rotation,
      colorSpace: this._serializeColorSpace(texture.colorSpace),
      wrapS: this._serializeWrapping(texture.wrapS),
      wrapT: this._serializeWrapping(texture.wrapT),
    }
  }

  private static _getTextureUrl(texture: THREE.Texture | null): string | undefined {
    if (!texture) return undefined
    const url = texture.userData?.url
    return typeof url === 'string' && url.trim() !== '' ? url : undefined
  }

  private static _findOrCreateTextureOrigin(url: string, slot: MaterialTextureSlot): string {
    for (const [id, origin] of this._textureOrigins) {
      if (origin.url === url) return id
    }

    const originId = this._generateOriginId()
    this._textureOrigins.set(originId, {
      id: originId,
      url,
      name: url.split('/').pop() || `${slot} texture`,
      type: this._textureOriginTypeFromSlot(slot),
    })
    return originId
  }

  private static _textureOriginTypeFromSlot(slot: MaterialTextureSlot): ITextureOrigin['type'] {
    if (slot === 'normalMap') return 'normal'
    if (slot === 'roughnessMap') return 'roughness'
    if (slot === 'metalnessMap') return 'metalness'
    if (slot === 'aoMap') return 'ao'
    if (slot === 'emissiveMap') return 'emissive'
    return 'diffuse'
  }

  private static _serializeColorSpace(
    colorSpace: THREE.ColorSpace
  ): IMaterialTextureData['colorSpace'] {
    if (colorSpace === THREE.SRGBColorSpace) return 'srgb'
    if (colorSpace === THREE.LinearSRGBColorSpace) return 'linear'
    return 'none'
  }

  private static _serializeWrapping(
    wrapping: THREE.Wrapping
  ): NonNullable<IMaterialTextureData['wrapS']> {
    if (wrapping === THREE.ClampToEdgeWrapping) return 'clamp'
    if (wrapping === THREE.MirroredRepeatWrapping) return 'mirror'
    return 'repeat'
  }

  /**
   * 递归序列化模型子对象变换
   * 只序列化被修改过的子对象（通过 userData.materialModified 或 transformModified 标记）
   */
  private static _serializeModelChildren(
    object: THREE.Object3D,
    children: ISceneObjectData[]
  ): void {
    // 递归遍历所有子对象，收集被修改的
    this._collectModifiedChildren(object, children, '')
  }

  /**
   * 递归收集被修改的子对象
   * @param object 当前对象
   * @param children 收集结果数组
   * @param path 对象路径（用于嵌套场景）
   */
  private static _collectModifiedChildren(
    object: THREE.Object3D,
    children: ISceneObjectData[],
    path: string
  ): void {
    for (const child of object.children) {
      const childPath = path ? `${path}/${child.name}` : child.name

      // 检查这个子对象是否被修改过（材质或变换）
      const isMaterialModified = child.userData.materialModified === true
      const isTransformModified = child.userData.transformModified === true
      const isModified = isMaterialModified || isTransformModified

      if (isModified && child instanceof THREE.Mesh) {
        // 只序列化被修改的子对象
        // 注意：不保存 uuid，因为它是运行时生成的，每次加载模型都会变化
        // 只使用 name 和 path 来标识子对象
        const childData: ISceneObjectData = {
          name: child.name || 'unnamed',
          type: 'mesh',
          transform: {
            position: this._toVector3(child.position),
            rotation: this._toVector3(child.rotation),
            scale: this._toVector3(child.scale),
          },
          visible: child.visible,
          locked: false,
          userData: { path: childPath },
          uuid: '',
        }

        // 只有材质被修改时才序列化材质覆盖
        if (isMaterialModified) {
          childData.materialOverrides = this._serializeMaterial(child)
        }

        children.push(childData)
      }

      // 始终递归检查子对象，因为修改可能在任何层级
      if (child.children.length > 0) {
        this._collectModifiedChildren(child, children, childPath)
      }
    }
  }

  /**
   * 根据 URL 查找 origin ID
   */
  private static _findOriginByUrl(url: string): string | null {
    for (const [id, origin] of this._modelOrigins) {
      if (origin.url === url) {
        return id
      }
    }
    return null
  }

  /**
   * 序列化灯光
   */
  private static _serializeLights(engine: ReturnType<typeof getEngine>): ILightData[] {
    if (!engine) return []

    const lights: ILightData[] = []
    const scene = engine.sceneManager.scene

    scene.traverse((object) => {
      if (object instanceof THREE.Light && object.userData.selectable !== false) {
        const lightData: ILightData = {
          uuid: object.uuid,
          name: object.name || 'Light',
          type: 'point',
          color: '#' + object.color.getHexString(),
          intensity: object.intensity,
        }

        if (object instanceof THREE.AmbientLight) {
          lightData.type = 'ambient'
        } else if (object instanceof THREE.DirectionalLight) {
          lightData.type = 'directional'
          lightData.position = this._toVector3(object.position)
          lightData.target = this._toVector3(object.target.position)
          lightData.castShadow = object.castShadow
        } else if (object instanceof THREE.PointLight) {
          lightData.type = 'point'
          lightData.position = this._toVector3(object.position)
          lightData.distance = object.distance
          lightData.decay = object.decay
          lightData.castShadow = object.castShadow
        } else if (object instanceof THREE.SpotLight) {
          lightData.type = 'spot'
          lightData.position = this._toVector3(object.position)
          lightData.target = this._toVector3(object.target.position)
          lightData.distance = object.distance
          lightData.decay = object.decay
          lightData.angle = object.angle
          lightData.penumbra = object.penumbra
          lightData.castShadow = object.castShadow
        } else if (object instanceof THREE.HemisphereLight) {
          lightData.type = 'hemisphere'
          lightData.groundColor = '#' + object.groundColor.getHexString()
        }

        lights.push(lightData)
      }
    })

    return lights
  }

  private static _serializeLightComponents(
    engine: ReturnType<typeof getEngine>
  ): ComponentInstance[] {
    if (!engine) return []

    const components: ComponentInstance[] = []
    const scene = engine.sceneManager.scene

    scene.traverse((object) => {
      if (!(object instanceof THREE.Light) || object.userData.selectable === false) {
        return
      }

      const component = this._serializeComponentInstance(object, object.uuid)
      if (component) {
        components.push(component)
      }
    })

    return components
  }

  private static _serializeEvents(engine: ReturnType<typeof getEngine>) {
    if (!engine) return []

    const events = engine.sceneManager.scene.userData.runtimeEvents
    return Array.isArray(events) ? this._cloneProjectJson(events, []) : []
  }

  private static _serializeDataSources(engine: ReturnType<typeof getEngine>) {
    if (!engine) return []

    const dataSources = engine.sceneManager.scene.userData.dataSources
    return Array.isArray(dataSources) ? this._cloneProjectJson(dataSources, []) : []
  }

  private static _serializeBindings(engine: ReturnType<typeof getEngine>) {
    if (!engine) return []

    const bindings = engine.sceneManager.scene.userData.dataBindings
    return Array.isArray(bindings) ? this._cloneProjectJson(bindings, []) : []
  }

  private static _serializePostProcessing(
    engine: ReturnType<typeof getEngine>
  ): PostProcessingData | undefined {
    if (!engine) return undefined
    return engine.renderManager.postProcessingManager?.toProjectData()
  }

  /**
   * 序列化相机
   */
  private static _serializeCamera(engine: ReturnType<typeof getEngine>): ICameraData {
    if (!engine) {
      return {
        type: 'perspective',
        position: { x: 5, y: 5, z: 5 },
        target: { x: 0, y: 0, z: 0 },
        fov: 60,
        near: 0.1,
        far: 1000,
      }
    }

    const cameraManager = engine.cameraManager
    const camera = cameraManager.camera

    const cameraData: ICameraData = {
      type: camera instanceof THREE.PerspectiveCamera ? 'perspective' : 'orthographic',
      position: this._toVector3(camera.position),
      target: this._toVector3(cameraManager.controls.target),
      near: camera.near,
      far: camera.far,
    }

    if (camera instanceof THREE.PerspectiveCamera) {
      cameraData.fov = camera.fov
    } else if (camera instanceof THREE.OrthographicCamera) {
      cameraData.zoom = camera.zoom
    }

    return cameraData
  }

  private static _serializeCameraBookmarks(engine: ReturnType<typeof getEngine>) {
    if (!engine) return []

    const bookmarks = engine.sceneManager.scene.userData.cameraBookmarks
    return Array.isArray(bookmarks) ? this._cloneProjectJson(bookmarks, []) : []
  }

  /**
   * 序列化环境
   */
  private static _serializeEnvironment(engine: ReturnType<typeof getEngine>): IEnvironmentData {
    if (!engine) {
      return {
        backgroundColor: '#1a1a2e',
      }
    }

    const scene = engine.sceneManager.scene
    let backgroundColor = '#1a1a2e'

    if (scene.background instanceof THREE.Color) {
      backgroundColor = '#' + scene.background.getHexString()
    }

    const backgroundType = scene.userData.backgroundType || 'color'
    let hdriOriginId: string | undefined

    if (scene.userData.environmentUrl) {
      const url = scene.userData.environmentUrl
      // 查找是否已存在
      for (const origin of this._hdriOrigins.values()) {
        if (origin.url === url) {
          hdriOriginId = origin.id
          break
        }
      }
      // 不存在则添加
      if (!hdriOriginId) {
        hdriOriginId = this._generateOriginId()
        this._hdriOrigins.set(hdriOriginId, {
          id: hdriOriginId,
          url,
          name: url.split('/').pop() || 'Environment',
        })
      }
    }

    const envData: IEnvironmentData = {
      backgroundColor,
      backgroundType,
      hdriOriginId,
    }

    // 处理雾效
    if (scene.fog) {
      if (scene.fog instanceof THREE.Fog) {
        envData.fog = {
          type: 'linear',
          color: '#' + scene.fog.color.getHexString(),
          near: scene.fog.near,
          far: scene.fog.far,
        }
      } else if (scene.fog instanceof THREE.FogExp2) {
        envData.fog = {
          type: 'exponential',
          color: '#' + scene.fog.color.getHexString(),
          density: scene.fog.density,
        }
      }
    }

    return envData
  }

  /**
   * 构建资源依赖清单
   */
  private static _buildAssetManifest(
    engine: ReturnType<typeof getEngine>,
    origin: IOriginResources,
    sceneObjects: ISceneObjectData[]
  ): IAssetManifest {
    const items: IAssetManifestItem[] = []
    const seen = new Set<string>()
    const now = new Date().toISOString()

    const pushItem = (
      item: Omit<IAssetManifestItem, 'usage' | 'referencedBy'> &
        Partial<Pick<IAssetManifestItem, 'usage' | 'referencedBy'>>
    ) => {
      const key = `${item.type}:${item.url || ''}:${item.objectUuid || ''}:${item.source}`
      if (seen.has(key)) return
      seen.add(key)
      items.push({
        ...item,
        usage: item.usage ?? [item.source],
        referencedBy: item.referencedBy ?? (item.objectUuid ? [item.objectUuid] : []),
        publicAccess: this.getPublicAccess(item.url),
        corsStatus: this.getCorsStatus(item.url),
      })
    }

    origin.models.forEach((model) => {
      pushItem({
        id: model.id,
        type: model.url.startsWith('__primitive__:') ? 'unknown' : 'model',
        name: model.name,
        url: model.url,
        source: 'origin',
        requiredForPublish: !model.url.startsWith('__primitive__:'),
        status: model.url.startsWith('__primitive__:')
          ? 'embedded'
          : this.getAssetStatus(model.url),
        usage: ['scene'],
      })
    })

    origin.textures.forEach((texture) => {
      pushItem({
        id: texture.id,
        type: 'texture',
        name: texture.name,
        url: texture.url,
        source: 'material',
        requiredForPublish: true,
        status: this.getAssetStatus(texture.url),
        usage: [`material.${texture.type}`],
      })
    })

    origin.hdris.forEach((hdri) => {
      pushItem({
        id: hdri.id,
        type: 'hdri',
        name: hdri.name,
        url: hdri.url,
        source: 'origin',
        requiredForPublish: true,
        status: this.getAssetStatus(hdri.url),
        usage: ['environment'],
      })
    })

    const visitSceneObjects = (objects: ISceneObjectData[]) => {
      objects.forEach((object) => {
        if (object.type === 'userModel' && object.importedFileName) {
          pushItem({
            id: object.uuid || object.importedFileName,
            type: 'localModel',
            name: object.name,
            source: 'sceneObject',
            requiredForPublish: false,
            status: 'localOnly',
            objectUuid: object.uuid,
            usage: ['sceneObject'],
            referencedBy: [object.uuid],
          })
        }

        if (object.type === 'billboard' && object.billboardData) {
          pushItem({
            id: `${object.uuid}:billboard:texture`,
            type: object.billboardData.isVideo ? 'video' : 'billboard',
            name: object.name,
            url: object.billboardData.texture,
            source: 'sceneObject',
            requiredForPublish: true,
            status: this.getAssetStatus(object.billboardData.texture),
            objectUuid: object.uuid,
            usage: ['billboard.texture'],
            referencedBy: [object.uuid],
          })

          if (object.billboardData.backTexture) {
            pushItem({
              id: `${object.uuid}:billboard:backTexture`,
              type: 'texture',
              name: `${object.name} 背面纹理`,
              url: object.billboardData.backTexture,
              source: 'sceneObject',
              requiredForPublish: true,
              status: this.getAssetStatus(object.billboardData.backTexture),
              objectUuid: object.uuid,
              usage: ['billboard.backTexture'],
              referencedBy: [object.uuid],
            })
          }
        }

        if (object.children?.length) {
          visitSceneObjects(object.children)
        }
      })
    }

    visitSceneObjects(sceneObjects)

    engine.sceneManager.scene.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return

      const meshMaterials = Array.isArray(object.material) ? object.material : [object.material]
      meshMaterials.forEach((material) => {
        if (!(material instanceof THREE.MeshStandardMaterial)) return

        const slots: Array<[string, THREE.Texture | null]> = [
          ['map', material.map],
          ['normalMap', material.normalMap],
          ['roughnessMap', material.roughnessMap],
          ['metalnessMap', material.metalnessMap],
          ['aoMap', material.aoMap],
          ['emissiveMap', material.emissiveMap],
        ]

        slots.forEach(([slot, texture]) => {
          const url = this._getTextureUrl(texture)
          if (!url) return

          pushItem({
            id: `${material.uuid}:${slot}:${url}`,
            type: 'texture',
            name: `${object.name || 'Material'} ${slot}`,
            url,
            objectUuid: object.uuid,
            source: 'material',
            requiredForPublish: true,
            status: this.getAssetStatus(url),
            usage: [`material.${slot}`],
            referencedBy: [object.uuid],
          })
        })
      })
    })

    return {
      generatedAt: now,
      items,
    }
  }

  private static getAssetStatus(url?: string): IAssetManifestItem['status'] {
    if (!url) return 'missing'
    if (
      url.startsWith('blob:') ||
      url.startsWith('data:') ||
      url.includes('localhost') ||
      url.includes('127.0.0.1')
    ) {
      return url.startsWith('data:') ? 'embedded' : 'localOnly'
    }
    return 'ready'
  }

  private static getPublicAccess(url?: string): NonNullable<IAssetManifestItem['publicAccess']> {
    if (!url) return 'unknown'
    if (url.startsWith('blob:') || url.includes('localhost') || url.includes('127.0.0.1')) {
      return 'private'
    }
    if (url.startsWith('data:') || url.startsWith('http://') || url.startsWith('https://')) {
      return 'public'
    }
    return 'unknown'
  }

  private static getCorsStatus(url?: string): NonNullable<IAssetManifestItem['corsStatus']> {
    if (!url) return 'unknown'
    if (url.includes('localhost') || url.includes('127.0.0.1')) return 'blocked'
    return url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')
      ? 'ok'
      : 'unknown'
  }

  /**
   * 从 IProjectData 反序列化并重建场景
   */
  static async deserialize(data: IProjectData): Promise<void> {
    const projectData = migrateProjectData(data)
    const engine = getEngine()
    if (!engine) {
      throw new Error('Engine not initialized')
    }

    // 清空当前场景
    engine.animationEngine?.clear()
    engine.objectManager.clear()

    // 重建环境
    await this._deserializeEnvironment(projectData.environment, projectData.origin, engine)
    this._deserializePostProcessing(projectData.postProcessing, engine)

    // 加载模型并重建对象
    const modelLoader = getModelLoader()
    const modelCache = new Map<string, THREE.Group>()

    // 预加载所有模型
    for (const modelOrigin of projectData.origin.models) {
      if (!modelOrigin.url.startsWith('__primitive__:')) {
        try {
          const result = await modelLoader.loadModel(modelOrigin.url, {
            center: true,
          })
          modelCache.set(modelOrigin.id, result.model)
          console.log('📦 [Framework] Model loaded successfully:', modelOrigin.url)
        } catch (e) {
          console.warn(`Failed to load model: ${modelOrigin.url}`, e)
        }
      }
    }

    // 重建场景对象
    for (const objectData of projectData.sceneObjects) {
      await this._deserializeObject(objectData, projectData.origin, modelCache, engine)
    }

    // 恢复灯光
    this._deserializeLights(projectData.lights, engine)

    // 恢复相机
    this._deserializeCamera(projectData.camera, engine)
    engine.sceneManager.scene.userData.cameraBookmarks = this._cloneProjectJson(
      projectData.cameraBookmarks,
      []
    )

    // 恢复动画
    if (projectData.animations) {
      engine.animationEngine.fromJSON(projectData.animations)
    }

    engine.sceneManager.scene.userData.runtimeEvents = this._cloneProjectJson(
      projectData.events,
      []
    )
    engine.sceneManager.scene.userData.dataSources = this._cloneProjectJson(
      projectData.dataSources,
      []
    )
    engine.sceneManager.scene.userData.dataBindings = this._cloneProjectJson(
      projectData.bindings,
      []
    )

    eventBus.emit('scene:loaded', { projectData })
  }

  /**
   * 反序列化灯光
   */
  private static _deserializeLights(
    lights: ILightData[],
    engine: ReturnType<typeof getEngine>
  ): void {
    if (!engine) return

    const scene = engine.sceneManager.scene
    getLightManager().clearAllLights()

    const staleLights: THREE.Light[] = []
    scene.traverse((object) => {
      if (object instanceof THREE.Light) {
        staleLights.push(object)
      }
    })

    staleLights.forEach((light) => {
      engine.objectManager.unregister(light.uuid)
      light.parent?.remove(light)
    })

    lights.forEach((lightData) => {
      const light = this._createLightFromData(lightData)
      if (!light) return

      light.uuid = lightData.uuid
      light.name = lightData.name
      light.userData.selectable = true
      light.userData.lightType = lightData.type

      engine.objectManager.add(light, {
        name: lightData.name,
        type: 'light',
      })
    })
  }

  private static _createLightFromData(lightData: ILightData): THREE.Light | null {
    const lightManager = getLightManager()
    const options = {
      name: lightData.name,
      color: lightData.color,
      intensity: lightData.intensity,
      position: lightData.position,
      target: lightData.target,
      castShadow: lightData.castShadow,
      distance: lightData.distance,
      decay: lightData.decay,
      angle: lightData.angle,
      penumbra: lightData.penumbra,
      groundColor: lightData.groundColor,
    }

    try {
      return lightManager.createLight(lightData.type as LightType, options)
    } catch (error) {
      console.warn('Failed to restore light:', lightData, error)
      return null
    }
  }

  /**
   * 反序列化单个对象
   */
  private static async _deserializeObject(
    objectData: ISceneObjectData,
    origin: IOriginResources,
    modelCache: Map<string, THREE.Group>,
    engine: ReturnType<typeof getEngine>
  ): Promise<THREE.Object3D | null> {
    if (!engine) return null

    let object: THREE.Object3D | null = null

    // 调试：输出每个对象的反序列化信息
    console.log('🔄 [Framework] Deserializing object:', {
      name: objectData.name,
      type: objectData.type,
      modelOriginId: objectData.modelOriginId,
    })

    if (objectData.type === 'billboard' && objectData.billboardData) {
      // 广告牌
      if (!objectData.billboardData.mode) {
        // 兼容旧数据或默认值
        ;(objectData.billboardData as IBillboardData).mode = BillboardMode.Y_LOCK
      }

      const billboardData: IBillboardData = {
        mode: objectData.billboardData.mode as BillboardMode,
        size: objectData.billboardData.size,
        texture: objectData.billboardData.texture,
        backTexture: objectData.billboardData.backTexture,
        animation: objectData.billboardData.animation,
        repeat: objectData.billboardData.repeat,
        isVideo: objectData.billboardData.isVideo,
      }

      object = await BillboardFactory.createFromData(
        billboardData,
        engine.cameraManager.camera,
        objectData.name
      )
    } else if (objectData.type === 'primitive' && objectData.primitiveType) {
      object = this._createPrimitive(objectData)
    } else if (objectData.type === 'model' && objectData.modelOriginId) {
      const modelOrigin = origin.models.find((m) => m.id === objectData.modelOriginId)
      if (modelOrigin) {
        if (modelOrigin.url.startsWith('__primitive__:')) {
          // 基础几何体
          const primitiveType = modelOrigin.url.replace('__primitive__:', '') as PrimitiveType
          object = this._createPrimitiveByType(primitiveType, objectData.name)
        } else {
          // 外部模型
          const cachedModel = modelCache.get(objectData.modelOriginId)
          console.log(`🔍 [Runtime] Looking for model in cache: ${objectData.modelOriginId}`, {
            found: !!cachedModel,
            url: modelOrigin.url,
          })

          if (cachedModel) {
            object = getModelLoader().cloneModel(cachedModel)
            markModelRootForSelection(object, {
              name: objectData.name,
              modelUrl: modelOrigin.url,
              libraryId: modelOrigin.libraryId,
            })

            // 应用子对象的材质和变换修改
            if (objectData.children && objectData.children.length > 0) {
              await this.applyChildTransforms(object, objectData.children)
            }
          }
        }
      }
    } else if (objectData.type === 'userModel' && objectData.importedFileName) {
      // 用户导入的本地模型 - 需要重新加载
      // 注意：这里无法直接加载，因为文件路径可能已经失效
      // 可以考虑提示用户重新导入，或者在序列化时保存完整的模型数据
      console.warn('User imported model cannot be restored:', objectData.importedFileName)
      // 创建一个占位符对象
      object = new THREE.Group()
      object.name = objectData.name + ' (需要重新导入)'
    } else if (objectData.type === 'group') {
      object = new THREE.Group()
      object.name = objectData.name

      // 递归创建子对象
      if (objectData.children) {
        for (const childData of objectData.children) {
          const child = await this._deserializeObject(childData, origin, modelCache, engine)
          if (child) {
            object.add(child)
          }
        }
      }
    }

    if (object) {
      if (objectData.uuid) {
        object.uuid = objectData.uuid
      }

      // 应用变换
      object.position.set(
        objectData.transform.position.x,
        objectData.transform.position.y,
        objectData.transform.position.z
      )
      object.rotation.set(
        objectData.transform.rotation.x,
        objectData.transform.rotation.y,
        objectData.transform.rotation.z
      )
      object.scale.set(
        objectData.transform.scale.x,
        objectData.transform.scale.y,
        objectData.transform.scale.z
      )

      // 应用可见性
      object.visible = objectData.visible

      // 应用材质覆盖
      if (objectData.materialOverrides && object instanceof THREE.Mesh) {
        await this._applyMaterialOverrides(object, objectData.materialOverrides)
      }

      // 应用用户数据
      object.userData = {
        ...object.userData,
        ...objectData.userData,
        selectable: true,
      }

      if (objectData.type === 'model') {
        markModelRootForSelection(object, {
          name: objectData.name,
          modelUrl: object.userData.modelUrl,
          libraryId: object.userData.libraryId,
        })
      } else {
        object.name = objectData.name
      }

      // 添加到场景
      engine.objectManager.add(object, {
        name: objectData.name,
        locked: objectData.locked,
      })
    }

    return object
  }

  /**
   * 创建基础几何体
   */
  private static _createPrimitive(objectData: ISceneObjectData): THREE.Mesh | null {
    if (!objectData.primitiveType) return null

    const params = objectData.primitiveParams || {}

    switch (objectData.primitiveType) {
      case 'box':
        return ObjectFactory.createBox(params.width ?? 1, params.height ?? 1, params.depth ?? 1, {
          name: objectData.name,
        })
      case 'sphere':
        return ObjectFactory.createSphere(
          params.radius ?? 0.5,
          params.widthSegments ?? 32,
          params.heightSegments ?? 32,
          { name: objectData.name }
        )
      case 'cylinder':
        return ObjectFactory.createCylinder(
          params.radiusTop ?? 0.5,
          params.radiusBottom ?? 0.5,
          params.height ?? 1,
          params.radialSegments ?? 32,
          { name: objectData.name }
        )
      case 'cone':
        return ObjectFactory.createCone(
          params.radius ?? 0.5,
          params.height ?? 1,
          params.radialSegments ?? 32,
          { name: objectData.name }
        )
      case 'torus':
        return ObjectFactory.createTorus(
          params.radius ?? 0.5,
          params.tube ?? 0.2,
          params.radialSegments ?? 16,
          params.tubularSegments ?? 32,
          { name: objectData.name }
        )
      case 'plane':
        return ObjectFactory.createPlane(params.width ?? 1, params.height ?? 1, 1, 1, {
          name: objectData.name,
        })
      case 'circle':
        return ObjectFactory.createCircle(params.radius ?? 0.5, params.segments ?? 32, {
          name: objectData.name,
        })
      case 'ring':
        return ObjectFactory.createRing(
          params.innerRadius ?? 0.3,
          params.outerRadius ?? 0.5,
          params.thetaSegments ?? 32,
          { name: objectData.name }
        )
      case 'tetrahedron':
        return ObjectFactory.createTetrahedron(params.radius ?? 0.65, params.detail ?? 0, {
          name: objectData.name,
        })
      case 'octahedron':
        return ObjectFactory.createOctahedron(params.radius ?? 0.65, params.detail ?? 0, {
          name: objectData.name,
        })
      case 'icosahedron':
        return ObjectFactory.createIcosahedron(params.radius ?? 0.65, params.detail ?? 0, {
          name: objectData.name,
        })
      case 'dodecahedron':
        return ObjectFactory.createDodecahedron(params.radius ?? 0.65, params.detail ?? 0, {
          name: objectData.name,
        })
      default:
        return null
    }
  }

  /**
   * 根据类型创建基础几何体
   */
  private static _createPrimitiveByType(
    type: PrimitiveType | 'cube',
    name: string
  ): THREE.Mesh | null {
    switch (type) {
      case 'box':
      case 'cube':
        return ObjectFactory.createBox(1, 1, 1, { name })
      case 'sphere':
        return ObjectFactory.createSphere(0.5, 32, 32, { name })
      case 'cylinder':
        return ObjectFactory.createCylinder(0.5, 0.5, 1, 32, { name })
      case 'cone':
        return ObjectFactory.createCone(0.5, 1, 32, { name })
      case 'torus':
        return ObjectFactory.createTorus(0.5, 0.2, 16, 32, { name })
      case 'plane':
        return ObjectFactory.createPlane(1, 1, 1, 1, { name })
      case 'circle':
        return ObjectFactory.createCircle(0.5, 32, { name })
      case 'ring':
        return ObjectFactory.createRing(0.3, 0.5, 32, { name })
      case 'tetrahedron':
        return ObjectFactory.createTetrahedron(0.65, 0, { name })
      case 'octahedron':
        return ObjectFactory.createOctahedron(0.65, 0, { name })
      case 'icosahedron':
        return ObjectFactory.createIcosahedron(0.65, 0, { name })
      case 'dodecahedron':
        return ObjectFactory.createDodecahedron(0.65, 0, { name })
      default:
        return null
    }
  }

  /**
   * 应用材质覆盖
   */
  private static async _applyMaterialOverrides(
    mesh: THREE.Mesh,
    overrides: IMaterialOverrides
  ): Promise<void> {
    const material = mesh.material
    if (!material || Array.isArray(material)) return

    if (material instanceof THREE.MeshStandardMaterial) {
      await this._applyMaterialOverridesToMaterial(material, overrides)
    }
  }

  /**
   * 应用材质覆盖到单个材质对象
   */
  private static async _applyMaterialOverridesToMaterial(
    material: THREE.MeshStandardMaterial,
    overrides: IMaterialOverrides
  ): Promise<void> {
    if (overrides.color) {
      material.color.set(overrides.color)
    }
    if (overrides.metalness !== undefined) {
      material.metalness = overrides.metalness
    }
    if (overrides.roughness !== undefined) {
      material.roughness = overrides.roughness
    }
    if (overrides.opacity !== undefined) {
      material.opacity = overrides.opacity
    }
    if (overrides.transparent !== undefined) {
      material.transparent = overrides.transparent
    }
    if (overrides.emissive) {
      material.emissive.set(overrides.emissive)
    }
    if (overrides.emissiveIntensity !== undefined) {
      material.emissiveIntensity = overrides.emissiveIntensity
    }
    if (overrides.wireframe !== undefined) {
      material.wireframe = overrides.wireframe
    }
    if (overrides.side) {
      switch (overrides.side) {
        case 'front':
          material.side = THREE.FrontSide
          break
        case 'back':
          material.side = THREE.BackSide
          break
        case 'double':
          material.side = THREE.DoubleSide
          break
      }
    }
    if (overrides.textures) {
      await Promise.all(
        Object.entries(overrides.textures).map(([slot, textureData]) =>
          this._applyMaterialTexture(
            material,
            slot as MaterialTextureSlot,
            textureData as IMaterialTextureData
          )
        )
      )
    }
    material.needsUpdate = true
  }

  private static async _applyMaterialTexture(
    material: THREE.MeshStandardMaterial,
    slot: MaterialTextureSlot,
    textureData?: IMaterialTextureData
  ): Promise<void> {
    if (!textureData?.url) return

    try {
      const texture = await getTextureLoader().loadTexture(textureData.url, {
        colorSpace: this._deserializeColorSpace(textureData.colorSpace),
      })
      texture.userData.url = textureData.url
      texture.repeat.set(textureData.repeat?.[0] ?? 1, textureData.repeat?.[1] ?? 1)
      texture.offset.set(textureData.offset?.[0] ?? 0, textureData.offset?.[1] ?? 0)
      texture.rotation = textureData.rotation ?? 0
      texture.wrapS = this._deserializeWrapping(textureData.wrapS)
      texture.wrapT = this._deserializeWrapping(textureData.wrapT)
      material[slot] = texture
    } catch (error) {
      console.warn(`Failed to restore material texture ${slot}:`, error)
    }
  }

  private static _deserializeColorSpace(
    colorSpace?: IMaterialTextureData['colorSpace']
  ): THREE.ColorSpace {
    if (colorSpace === 'linear') return THREE.LinearSRGBColorSpace
    if (colorSpace === 'none') return THREE.NoColorSpace
    return THREE.SRGBColorSpace
  }

  private static _deserializeWrapping(wrap?: IMaterialTextureData['wrapS']): THREE.Wrapping {
    if (wrap === 'clamp') return THREE.ClampToEdgeWrapping
    if (wrap === 'mirror') return THREE.MirroredRepeatWrapping
    return THREE.RepeatWrapping
  }

  /**
   * 反序列化环境
   */
  private static async _deserializeEnvironment(
    envData: IEnvironmentData,
    origin: IOriginResources,
    engine: ReturnType<typeof getEngine>
  ): Promise<void> {
    if (!engine) return

    engine.sceneManager.setBackgroundColor(envData.backgroundColor)

    // 恢复 HDRI
    if (envData.hdriOriginId && origin.hdris) {
      const hdriOrigin = origin.hdris.find((h) => h.id === envData.hdriOriginId)
      if (hdriOrigin) {
        try {
          await engine.sceneManager.setEnvironmentMap(hdriOrigin.url)

          // 如果背景类型是 environment，则应用
          if (envData.backgroundType === 'environment') {
            engine.sceneManager.setBackgroundAsEnvironment()
          }
        } catch (e) {
          console.error('Failed to restore HDRI:', e)
        }
      }
    }

    if (envData.fog) {
      if (envData.fog.type === 'linear') {
        engine.sceneManager.setFog(
          'linear',
          envData.fog.color,
          envData.fog.near ?? 10,
          envData.fog.far ?? 100
        )
      } else {
        engine.sceneManager.setFog('exponential', envData.fog.color, envData.fog.density ?? 0.01)
      }
    } else {
      engine.sceneManager.clearFog()
    }
  }

  private static _deserializePostProcessing(
    postProcessing: PostProcessingData,
    engine: ReturnType<typeof getEngine>
  ): void {
    if (!engine) return
    engine.renderManager.applyProjectPostProcessing(postProcessing)
  }

  /**
   * 反序列化相机
   */
  private static _deserializeCamera(
    cameraData: ICameraData,
    engine: ReturnType<typeof getEngine>
  ): void {
    if (!engine) return

    const camera = engine.cameraManager.camera
    camera.position.set(cameraData.position.x, cameraData.position.y, cameraData.position.z)
    camera.near = cameraData.near
    camera.far = cameraData.far

    if (camera instanceof THREE.PerspectiveCamera && cameraData.fov) {
      camera.fov = cameraData.fov
      camera.updateProjectionMatrix()
    }

    engine.cameraManager.controls.target.set(
      cameraData.target.x,
      cameraData.target.y,
      cameraData.target.z
    )
    engine.cameraManager.controls.update()
  }

  /**
   * 转换为 IVector3
   */
  private static _toVector3(v: THREE.Vector3 | THREE.Euler): IVector3 {
    return { x: v.x, y: v.y, z: v.z }
  }

  /**
   * 应用子对象的变换和材质修改
   * childrenData 是扁平数组，只包含被修改过的子对象
   */
  static async applyChildTransforms(
    parent: THREE.Object3D,
    childrenData: ISceneObjectData[]
  ): Promise<void> {
    let failCount = 0

    for (const childData of childrenData) {
      // 尝试通过 path 或 name 找到子对象
      let child: THREE.Object3D | null = null

      // 如果有 path，使用 path 查找
      const path = childData.userData?.path as string | undefined
      if (path) {
        child = this._findChildByPath(parent, path)
      }

      // 如果没找到，尝试通过 name 递归查找
      if (!child) {
        child = this._findChildByName(parent, childData.name)
      }

      if (child) {
        // 应用变换（位置、旋转、缩放）
        if (childData.transform) {
          child.position.set(
            childData.transform.position.x,
            childData.transform.position.y,
            childData.transform.position.z
          )
          child.rotation.set(
            childData.transform.rotation.x,
            childData.transform.rotation.y,
            childData.transform.rotation.z
          )
          child.scale.set(
            childData.transform.scale.x,
            childData.transform.scale.y,
            childData.transform.scale.z
          )
        }

        // 应用材质覆盖
        if (child instanceof THREE.Mesh && childData.materialOverrides) {
          // 克隆材质，避免修改共享材质影响其他 mesh
          const originalMaterial = child.material
          if (originalMaterial instanceof THREE.MeshStandardMaterial) {
            const clonedMaterial = originalMaterial.clone()
            child.material = clonedMaterial
            await this._applyMaterialOverrides(child, childData.materialOverrides)
            // 标记材质已被修改
            child.userData.materialModified = true
          } else if (Array.isArray(originalMaterial)) {
            const nextMaterials = await Promise.all(
              originalMaterial.map(async (mat) => {
                if (mat instanceof THREE.MeshStandardMaterial) {
                  const cloned = mat.clone()
                  // 对每个材质应用覆盖
                  if (childData.materialOverrides) {
                    await this._applyMaterialOverridesToMaterial(
                      cloned,
                      childData.materialOverrides
                    )
                  }
                  return cloned
                }
                return mat
              })
            )
            child.material = nextMaterials
            child.userData.materialModified = true
          }
        }
      } else {
        // 找不到子对象，输出详细错误信息
        failCount++
        console.error('❌ Cannot find child object in model:', {
          parentName: parent.name,
          childName: childData.name,
          childPath: path || 'N/A',
          childType: childData.type,
          hasTransform: !!childData.transform,
          hasMaterial: !!childData.materialOverrides,
          availableChildren: parent.children.map((c) => ({
            name: c.name,
            type: c.type,
            hasChildren: c.children.length > 0,
          })),
          suggestion: path
            ? `The path "${path}" does not exist in the model. Check if the model structure has changed.`
            : `The name "${childData.name}" was not found. Try using a path instead of just a name.`,
        })
      }
    }

    // 输出总结（如果有失败的）
    if (failCount > 0) {
      console.warn(
        `⚠️ applyChildTransforms: ${failCount} of ${childrenData.length} child object(s) could not be found. Their modifications were not applied.`
      )
    }
  }

  /**
   * 通过路径查找子对象
   */
  private static _findChildByPath(parent: THREE.Object3D, path: string): THREE.Object3D | null {
    const parts = path.split('/')
    let current: THREE.Object3D | undefined = parent

    for (const part of parts) {
      if (!current) return null
      current = current.children.find((c) => c.name === part)
    }

    return current || null
  }

  /**
   * 递归通过名称查找子对象
   */
  private static _findChildByName(parent: THREE.Object3D, name: string): THREE.Object3D | null {
    for (const child of parent.children) {
      if (child.name === name) return child
      const found = this._findChildByName(child, name)
      if (found) return found
    }
    return null
  }

  /**
   * 导出为 JSON 字符串
   */
  static exportToJSON(projectName: string, description?: string): string {
    const data = this.serialize(projectName, description)
    return JSON.stringify(data, null, 2)
  }

  /**
   * 从 JSON 字符串导入
   */
  static async importFromJSON(json: string): Promise<IProjectData> {
    const data = migrateProjectData(JSON.parse(json))
    await this.deserialize(data)
    return data
  }
}
