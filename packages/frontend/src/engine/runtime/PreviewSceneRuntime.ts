import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js'
import type { IProjectData, ISceneObjectData, ILightData, PrimitiveType } from '@lowcode3d/shared'
import { AnimationEngine } from '../animation'
import {
  clearMaterialColorCycles,
  restoreMaterialColorCycles,
} from '../materials/MaterialColorCycleRunner'
import { getModelLoader } from '../loaders/ModelLoader'
import {
  BillboardFactory,
  BillboardMode,
  getBillboardManager,
  ObjectFactory,
  type IBillboardData,
} from '../objects'

export interface PendingUserModel {
  data: ISceneObjectData
  loaded: boolean
}

export interface UserModelImportResult {
  imported: string[]
  skipped: string[]
  failed: string[]
}

export interface PreviewRuntimeOptions {
  transparent?: boolean
  interactive?: boolean
  autoPlayAnimations?: boolean
}

/**
 * Preview 场景运行时
 * 将预览页的项目反序列化、动画播放和资源释放集中起来，后续可复用于发布页和 iframe runtime。
 */
export class PreviewSceneRuntime {
  private options: Required<PreviewRuntimeOptions> = {
    transparent: false,
    interactive: true,
    autoPlayAnimations: true,
  }
  private container: HTMLElement | null = null
  private renderer: THREE.WebGLRenderer | null = null
  private scene: THREE.Scene | null = null
  private camera: THREE.PerspectiveCamera | null = null
  private controls: OrbitControls | null = null
  private animationEngine: AnimationEngine | null = null
  private animationFrameId: number | null = null
  private clock = new THREE.Clock()
  private environmentMap: THREE.Texture | null = null
  private userModelCache = new Map<string, THREE.Group>()

  public pendingUserModels: PendingUserModel[] = []

  init(container: HTMLElement, options: PreviewRuntimeOptions = {}): void {
    this.options = {
      ...this.options,
      ...options,
    }
    this.container = container

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: this.options.transparent,
      powerPreference: 'high-performance',
      logarithmicDepthBuffer: true,
    })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.setSize(container.clientWidth, container.clientHeight)
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    container.appendChild(this.renderer.domElement)

    this.scene = new THREE.Scene()
    this.scene.background = this.options.transparent ? null : new THREE.Color(0x1a1a2e)

    this.camera = new THREE.PerspectiveCamera(
      60,
      container.clientWidth / container.clientHeight,
      0.1,
      10000
    )
    this.camera.position.set(5, 5, 5)

    this.controls = new OrbitControls(this.camera, this.renderer.domElement)
    this.controls.enableDamping = true
    this.controls.dampingFactor = 0.05
    this.controls.enabled = this.options.interactive

    this.animationEngine = new AnimationEngine(this.scene)

    getBillboardManager().setCamera(this.camera)
    this.addDefaultLights()
    this.start()
  }

  async loadProjectData(projectData: IProjectData): Promise<void> {
    if (!this.scene || !this.camera) return

    clearMaterialColorCycles()
    this.clearProjectObjects()
    this.pendingUserModels = []
    this.userModelCache.clear()
    this.animationEngine?.clear()

    const modelLoader = getModelLoader()
    const modelCache = new Map<string, THREE.Group>()

    for (const modelOrigin of projectData.origin.models) {
      if (modelOrigin.url.startsWith('__primitive__:')) continue

      try {
        const result = await modelLoader.loadModel(modelOrigin.url, { center: true })
        modelCache.set(modelOrigin.id, result.model)
      } catch (error) {
        console.warn(`Failed to load model: ${modelOrigin.url}`, error)
      }
    }

    const userModels = projectData.sceneObjects.filter((object) => object.type === 'userModel')
    this.pendingUserModels = userModels.map((data) => ({ data, loaded: false }))

    for (const objectData of projectData.sceneObjects) {
      if (objectData.type === 'userModel') continue

      const object = await this.createObjectFromData(
        objectData,
        projectData.origin.models,
        modelCache
      )
      if (object) {
        this.scene.add(object)
      }
    }

    this.restoreLights(projectData.lights)
    await this.restoreEnvironment(projectData)
    this.restoreCamera(projectData)

    if (projectData.animations?.tracks.length) {
      this.animationEngine?.fromJSON(projectData.animations)
      if (this.options.autoPlayAnimations) {
        this.animationEngine?.play()
      }
    }

    restoreMaterialColorCycles(this.scene)
  }

  async importUserModelFiles(files: FileList | File[]): Promise<UserModelImportResult> {
    const result: UserModelImportResult = {
      imported: [],
      skipped: [],
      failed: [],
    }

    if (!this.scene) return result

    const modelLoader = getModelLoader()

    for (const file of Array.from(files)) {
      const pendingItem = this.pendingUserModels.find(
        (item) => !item.loaded && item.data.importedFileName === file.name
      )

      if (!pendingItem) {
        result.skipped.push(file.name)
        continue
      }

      try {
        const objectUrl = URL.createObjectURL(file)
        const loaded = await modelLoader.loadModel(objectUrl)
        const model = loaded.model

        this.applyObjectData(model, pendingItem.data)

        if (pendingItem.data.children) {
          this.applyChildTransforms(model, pendingItem.data.children)
        }

        model.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.castShadow = true
            child.receiveShadow = true
          }
        })

        this.scene.add(model)
        restoreMaterialColorCycles(model)
        pendingItem.loaded = true
        this.userModelCache.set(file.name, model)
        result.imported.push(file.name)
      } catch (error) {
        console.error('Import user model error:', error)
        result.failed.push(file.name)
      }
    }

    return result
  }

  resize(): void {
    if (!this.container || !this.renderer || !this.camera) return

    const width = this.container.clientWidth
    const height = this.container.clientHeight
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(width, height)
  }

  dispose(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId)
      this.animationFrameId = null
    }

    this.animationEngine?.dispose()
    this.animationEngine = null
    this.controls?.dispose()
    this.controls = null

    getBillboardManager().clear()

    if (this.environmentMap) {
      this.environmentMap.dispose()
      this.environmentMap = null
    }

    this.disposeSceneObjects()

    if (this.renderer) {
      this.renderer.dispose()
      if (this.renderer.domElement.parentElement === this.container) {
        this.container?.removeChild(this.renderer.domElement)
      }
      this.renderer = null
    }

    this.scene = null
    this.camera = null
    this.container = null
    this.pendingUserModels = []
    this.userModelCache.clear()
  }

  private start(): void {
    this.clock.start()

    const render = () => {
      this.animationFrameId = requestAnimationFrame(render)
      const delta = this.clock.getDelta()

      this.controls?.update()
      getBillboardManager().update()
      this.animationEngine?.update(delta)

      if (this.renderer && this.scene && this.camera) {
        this.renderer.render(this.scene, this.camera)
      }
    }

    render()
  }

  private addDefaultLights(): void {
    if (!this.scene) return

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5)
    ambientLight.userData.isRuntimeDefault = true
    this.scene.add(ambientLight)

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1)
    directionalLight.position.set(5, 10, 5)
    directionalLight.castShadow = true
    directionalLight.userData.isRuntimeDefault = true
    this.scene.add(directionalLight)
  }

  private clearProjectObjects(): void {
    if (!this.scene) return

    const objectsToRemove: THREE.Object3D[] = []
    this.scene.traverse((object) => {
      if (object === this.scene) return
      objectsToRemove.push(object)
    })

    objectsToRemove.forEach((object) => {
      object.parent?.remove(object)
      this.disposeObject(object)
    })

    this.addDefaultLights()
  }

  private async createObjectFromData(
    objectData: ISceneObjectData,
    modelOrigins: IProjectData['origin']['models'],
    modelCache: Map<string, THREE.Group>
  ): Promise<THREE.Object3D | null> {
    let object: THREE.Object3D | null = null

    if (objectData.type === 'primitive' && objectData.primitiveType) {
      object = this.createPrimitive(objectData)
    } else if (objectData.type === 'model' && objectData.modelOriginId) {
      const modelOrigin = modelOrigins.find((model) => model.id === objectData.modelOriginId)
      if (modelOrigin) {
        if (modelOrigin.url.startsWith('__primitive__:')) {
          const primitiveType = modelOrigin.url.replace('__primitive__:', '') as PrimitiveType
          object = this.createPrimitiveByType(primitiveType, objectData.name)
        } else {
          const cachedModel = modelCache.get(objectData.modelOriginId)
          if (cachedModel) {
            object = getModelLoader().cloneModel(cachedModel)
            object.userData.modelUrl = modelOrigin.url
            object.userData.libraryId = modelOrigin.libraryId

            if (objectData.children?.length) {
              this.applyChildTransforms(object, objectData.children)
            }
          }
        }
      }
    } else if (objectData.type === 'billboard' && objectData.billboardData && this.camera) {
      const billboardData: IBillboardData = {
        mode: (objectData.billboardData.mode as BillboardMode) || BillboardMode.Y_LOCK,
        size: objectData.billboardData.size,
        texture: objectData.billboardData.texture,
        backTexture: objectData.billboardData.backTexture,
        animation: objectData.billboardData.animation,
        repeat: objectData.billboardData.repeat,
        isVideo: objectData.billboardData.isVideo,
      }
      object = await BillboardFactory.createFromData(billboardData, this.camera, objectData.name)
    } else if (objectData.type === 'group') {
      object = new THREE.Group()
      object.name = objectData.name

      if (objectData.children) {
        for (const childData of objectData.children) {
          const child = await this.createObjectFromData(childData, modelOrigins, modelCache)
          if (child) object.add(child)
        }
      }
    }

    if (object) {
      this.applyObjectData(object, objectData)

      if (objectData.materialOverrides && object instanceof THREE.Mesh) {
        this.applyMaterialOverrides(object, objectData.materialOverrides)
      }
    }

    return object
  }

  private createPrimitive(objectData: ISceneObjectData): THREE.Mesh | null {
    if (!objectData.primitiveType) return null
    const params = objectData.primitiveParams || {}

    switch (objectData.primitiveType) {
      case 'box':
        return ObjectFactory.createBox(params.width ?? 1, params.height ?? 1, params.depth ?? 1, {
          name: objectData.name,
        })
      case 'sphere':
        return ObjectFactory.createSphere(params.radius ?? 0.5, 32, 32, {
          name: objectData.name,
        })
      case 'cylinder':
        return ObjectFactory.createCylinder(
          params.radiusTop ?? 0.5,
          params.radiusBottom ?? 0.5,
          params.height ?? 1,
          32,
          { name: objectData.name }
        )
      case 'cone':
        return ObjectFactory.createCone(params.radius ?? 0.5, params.height ?? 1, 32, {
          name: objectData.name,
        })
      case 'torus':
        return ObjectFactory.createTorus(params.radius ?? 0.5, params.tube ?? 0.2, 16, 32, {
          name: objectData.name,
        })
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

  private createPrimitiveByType(type: PrimitiveType | 'cube', name: string): THREE.Mesh | null {
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

  private restoreLights(lights: ILightData[] = []): void {
    if (!this.scene || lights.length === 0) return

    const lightsToRemove: THREE.Light[] = []
    this.scene.traverse((object) => {
      if (object instanceof THREE.Light) {
        lightsToRemove.push(object)
      }
    })
    lightsToRemove.forEach((light) => light.parent?.remove(light))

    lights.forEach((lightData) => {
      const light = this.createLightFromData(lightData)
      if (light) this.scene?.add(light)
    })
  }

  private createLightFromData(lightData: ILightData): THREE.Light | null {
    const color = new THREE.Color(lightData.color)
    let light: THREE.Light | null = null

    switch (lightData.type) {
      case 'ambient':
        light = new THREE.AmbientLight(color, lightData.intensity)
        break
      case 'directional': {
        const directionalLight = new THREE.DirectionalLight(color, lightData.intensity)
        if (lightData.position) {
          directionalLight.position.set(
            lightData.position.x,
            lightData.position.y,
            lightData.position.z
          )
        }
        directionalLight.castShadow = lightData.castShadow ?? false
        light = directionalLight
        break
      }
      case 'point': {
        const pointLight = new THREE.PointLight(
          color,
          lightData.intensity,
          lightData.distance,
          lightData.decay
        )
        if (lightData.position) {
          pointLight.position.set(lightData.position.x, lightData.position.y, lightData.position.z)
        }
        pointLight.castShadow = lightData.castShadow ?? false
        light = pointLight
        break
      }
      case 'spot': {
        const spotLight = new THREE.SpotLight(
          color,
          lightData.intensity,
          lightData.distance,
          lightData.angle,
          lightData.penumbra,
          lightData.decay
        )
        if (lightData.position) {
          spotLight.position.set(lightData.position.x, lightData.position.y, lightData.position.z)
        }
        spotLight.castShadow = lightData.castShadow ?? false
        light = spotLight
        break
      }
      case 'hemisphere': {
        light = new THREE.HemisphereLight(
          color,
          new THREE.Color(lightData.groundColor ?? '#444444'),
          lightData.intensity
        )
        break
      }
    }

    if (light) {
      light.uuid = lightData.uuid
      light.name = lightData.name
    }

    return light
  }

  private async restoreEnvironment(projectData: IProjectData): Promise<void> {
    if (!this.scene) return

    if (this.options.transparent) {
      this.scene.background = null
    } else if (projectData.environment?.backgroundColor) {
      this.scene.background = new THREE.Color(projectData.environment.backgroundColor)
    }

    if (projectData.environment?.hdriOriginId && projectData.origin.hdris) {
      const hdriOrigin = projectData.origin.hdris.find(
        (hdri) => hdri.id === projectData.environment.hdriOriginId
      )

      if (hdriOrigin) {
        try {
          const loader = new RGBELoader()
          const texture = await new Promise<THREE.Texture>((resolve, reject) => {
            loader.load(hdriOrigin.url, resolve, undefined, reject)
          })
          texture.mapping = THREE.EquirectangularReflectionMapping
          this.environmentMap?.dispose()
          this.environmentMap = texture
          this.scene.environment = texture

          if (
            !this.options.transparent &&
            projectData.environment.backgroundType === 'environment'
          ) {
            this.scene.background = texture
          }
        } catch (error) {
          console.error('Failed to load HDRI:', error)
        }
      }
    }

    if (projectData.environment?.fog) {
      const fog = projectData.environment.fog
      if (fog.type === 'linear') {
        this.scene.fog = new THREE.Fog(new THREE.Color(fog.color), fog.near ?? 10, fog.far ?? 100)
      } else if (fog.type === 'exponential') {
        this.scene.fog = new THREE.FogExp2(new THREE.Color(fog.color), fog.density ?? 0.01)
      }
    } else {
      this.scene.fog = null
    }
  }

  private restoreCamera(projectData: IProjectData): void {
    if (!this.camera || !this.controls || !projectData.camera) return

    this.camera.position.set(
      projectData.camera.position.x,
      projectData.camera.position.y,
      projectData.camera.position.z
    )
    this.controls.target.set(
      projectData.camera.target.x,
      projectData.camera.target.y,
      projectData.camera.target.z
    )

    if (projectData.camera.fov) {
      this.camera.fov = projectData.camera.fov
    }
    this.camera.near = projectData.camera.near
    this.camera.far = projectData.camera.far
    this.camera.updateProjectionMatrix()
  }

  private applyObjectData(object: THREE.Object3D, objectData: ISceneObjectData): void {
    if (objectData.uuid) {
      object.uuid = objectData.uuid
    }
    object.name = objectData.name
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
    object.visible = objectData.visible
    object.userData = {
      ...object.userData,
      ...objectData.userData,
    }
  }

  private applyChildTransforms(parent: THREE.Object3D, childrenData: ISceneObjectData[]): void {
    childrenData.forEach((childData) => {
      const path = childData.userData?.path as string | undefined
      const child = path
        ? this.findChildByPath(parent, path) || this.findChildByName(parent, childData.name)
        : this.findChildByName(parent, childData.name)

      if (!child) return

      this.applyObjectData(child, childData)

      if (child instanceof THREE.Mesh && childData.materialOverrides) {
        this.applyMaterialOverrides(child, childData.materialOverrides)
      }
    })
  }

  private applyMaterialOverrides(
    mesh: THREE.Mesh,
    overrides: NonNullable<ISceneObjectData['materialOverrides']>
  ): void {
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]

    const clonedMaterials = materials.map((material) => {
      if (!(material instanceof THREE.MeshStandardMaterial)) return material

      const cloned = material.clone()
      if (overrides.color) cloned.color.set(overrides.color)
      if (overrides.metalness !== undefined) cloned.metalness = overrides.metalness
      if (overrides.roughness !== undefined) cloned.roughness = overrides.roughness
      if (overrides.opacity !== undefined) cloned.opacity = overrides.opacity
      if (overrides.transparent !== undefined) cloned.transparent = overrides.transparent
      if (overrides.emissive) cloned.emissive.set(overrides.emissive)
      if (overrides.emissiveIntensity !== undefined) {
        cloned.emissiveIntensity = overrides.emissiveIntensity
      }
      if (overrides.wireframe !== undefined) cloned.wireframe = overrides.wireframe
      if (overrides.side) {
        cloned.side =
          overrides.side === 'back'
            ? THREE.BackSide
            : overrides.side === 'double'
              ? THREE.DoubleSide
              : THREE.FrontSide
      }
      cloned.needsUpdate = true
      return cloned
    })

    mesh.material = Array.isArray(mesh.material) ? clonedMaterials : clonedMaterials[0]
  }

  private findChildByPath(parent: THREE.Object3D, path: string): THREE.Object3D | null {
    const parts = path.split('/')
    let current: THREE.Object3D | undefined = parent

    for (const part of parts) {
      if (!current) return null
      current = current.children.find((child) => child.name === part)
    }

    return current || null
  }

  private findChildByName(parent: THREE.Object3D, name: string): THREE.Object3D | null {
    for (const child of parent.children) {
      if (child.name === name) return child
      const found = this.findChildByName(child, name)
      if (found) return found
    }
    return null
  }

  private disposeSceneObjects(): void {
    if (!this.scene) return
    this.scene.traverse((object) => this.disposeObject(object))
    this.scene.clear()
  }

  private disposeObject(object: THREE.Object3D): void {
    if (!(object instanceof THREE.Mesh)) return

    object.geometry?.dispose()
    const materials = Array.isArray(object.material) ? object.material : [object.material]
    materials.forEach((material) => material.dispose())
  }
}
