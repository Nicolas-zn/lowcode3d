<script setup lang="ts">
/**
 * 预览页面
 * 以只读模式展示保存的 3D 场景
 */
import { computed, ref, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js'
import { ElMessage } from 'element-plus'
import { FullScreen } from '@element-plus/icons-vue'
import { projectsApi } from '@/api'
import type { Project } from '@/api/projects'
import { PreviewSceneRuntime, type PendingUserModel } from '@/engine/runtime'
import {
  ObjectFactory,
  BillboardFactory,
  BillboardMode,
  getBillboardManager,
  type IBillboardData,
} from '@/engine/objects'
import { getModelLoader } from '@/engine/loaders/ModelLoader'
import type { IProjectData, ISceneObjectData, ILightData, PrimitiveType } from '@lowcode3d/shared'

const route = useRoute()
const router = useRouter()

const isQueryEnabled = (value: unknown): boolean => {
  if (Array.isArray(value)) return value.some(isQueryEnabled)
  return value === '1' || value === 'true'
}

// 状态
const containerRef = ref<HTMLDivElement | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)
const project = ref<Project | null>(null)
const isFullscreen = ref(false)
const isEmbedMode = computed(() => isQueryEnabled(route.query.embed))
const showToolbar = computed(() => !isEmbedMode.value || route.query.toolbar !== '0')
const runtimeOptions = computed(() => ({
  transparent: isQueryEnabled(route.query.transparent),
  interactive: route.query.controls !== '0',
  autoPlayAnimations: route.query.autoplay !== '0',
}))

// 用户导入模型的待处理列表
const pendingUserModels = ref<PendingUserModel[]>([])
const showImportDialog = ref(false)
const userModelCache = new Map<string, THREE.Group>() // fileName -> model

// Three.js 实例
let renderer = undefined as THREE.WebGLRenderer | null | undefined
let scene = undefined as THREE.Scene | null | undefined
let camera = undefined as THREE.PerspectiveCamera | null | undefined
let controls = undefined as OrbitControls | null | undefined
let animationFrameId = undefined as number | null | undefined
let previewRuntime: PreviewSceneRuntime | null = null

// 初始化 Three.js 场景
const initScene = () => {
  if (!containerRef.value) return

  previewRuntime = new PreviewSceneRuntime()
  previewRuntime.init(containerRef.value, runtimeOptions.value)

  window.addEventListener('resize', handleResize)
  document.addEventListener('fullscreenchange', handleFullscreenChange)
}

// 渲染循环
const animate = () => {
  animationFrameId = requestAnimationFrame(animate)
  controls?.update()
  getBillboardManager().update()
  if (renderer && scene && camera) {
    renderer.render(scene, camera)
  }
}

// 处理窗口大小变化
const handleResize = () => {
  if (previewRuntime) {
    previewRuntime.resize()
    return
  }

  if (!containerRef.value || !renderer || !camera) return
  const width = containerRef.value.clientWidth
  const height = containerRef.value.clientHeight
  camera.aspect = width / height
  camera.updateProjectionMatrix()
  renderer.setSize(width, height)
}

// 处理全屏切换
const handleFullscreenChange = () => {
  isFullscreen.value = !!document.fullscreenElement
  // 延迟调用 resize 以确保全屏动画完成
  setTimeout(handleResize, 100)
}

// 加载场景数据
const loadSceneData = async (projectData: IProjectData) => {
  if (previewRuntime) {
    await previewRuntime.loadProjectData(projectData)
    pendingUserModels.value = previewRuntime.pendingUserModels
    showImportDialog.value = pendingUserModels.value.length > 0
    return
  }

  if (!scene) return

  // 加载模型
  const modelLoader = getModelLoader()
  const modelCache = new Map<string, THREE.Group>()

  // 预加载外部模型
  for (const modelOrigin of projectData.origin.models) {
    if (!modelOrigin.url.startsWith('__primitive__:')) {
      try {
        const result = await modelLoader.loadModel(modelOrigin.url, {
          center: true,
        })
        modelCache.set(modelOrigin.id, result.model)
      } catch (e) {
        console.warn(`Failed to load model: ${modelOrigin.url}`, e)
      }
    }
  }

  // 检查是否有用户导入的模型
  const userModels = projectData.sceneObjects.filter((o) => o.type === 'userModel')
  if (userModels.length > 0) {
    pendingUserModels.value = userModels.map((data) => ({ data, loaded: false }))
    showImportDialog.value = true
  }

  // 重建场景对象（跳过 userModel，等待用户导入）
  for (const objectData of projectData.sceneObjects) {
    if (objectData.type === 'userModel') {
      continue // 跳过，等待用户导入
    }
    const object = await createObjectFromData(objectData, projectData.origin.models, modelCache)
    if (object) {
      scene.add(object)
    }
  }

  // 清除默认灯光，然后恢复项目灯光
  if (projectData.lights && projectData.lights.length > 0) {
    // 移除默认灯光
    const lightsToRemove: THREE.Light[] = []
    scene.traverse((obj) => {
      if (obj instanceof THREE.Light) {
        lightsToRemove.push(obj)
      }
    })
    lightsToRemove.forEach((light) => scene?.remove(light))

    // 恢复项目灯光
    for (const lightData of projectData.lights) {
      const light = createLightFromData(lightData)
      if (light) {
        scene.add(light)
      }
    }
  }

  // 恢复相机位置
  if (camera && projectData.camera) {
    camera.position.set(
      projectData.camera.position.x,
      projectData.camera.position.y,
      projectData.camera.position.z
    )
    if (controls && projectData.camera.target) {
      controls.target.set(
        projectData.camera.target.x,
        projectData.camera.target.y,
        projectData.camera.target.z
      )
    }
  }

  // 恢复环境
  if (projectData.environment?.backgroundColor && scene) {
    scene.background = new THREE.Color(projectData.environment.backgroundColor)
  }

  // 恢复 HDRI
  if (projectData.environment?.hdriOriginId && projectData.origin.hdris && scene) {
    const hdriOrigin = projectData.origin.hdris.find(
      (h) => h.id === projectData.environment.hdriOriginId
    )
    if (hdriOrigin) {
      try {
        const loader = new RGBELoader()
        const texture = await new Promise<THREE.Texture>((resolve, reject) => {
          loader.load(hdriOrigin.url, resolve, undefined, reject)
        })
        texture.mapping = THREE.EquirectangularReflectionMapping
        scene.environment = texture

        if (projectData.environment.backgroundType === 'environment') {
          scene.background = texture
        }
      } catch (e) {
        console.error('Failed to load HDRI:', e)
      }
    }
  }

  // 恢复雾效
  if (projectData.environment?.fog && scene) {
    const fog = projectData.environment.fog
    if (fog.type === 'linear') {
      scene.fog = new THREE.Fog(new THREE.Color(fog.color), fog.near ?? 10, fog.far ?? 100)
    } else if (fog.type === 'exponential') {
      scene.fog = new THREE.FogExp2(new THREE.Color(fog.color), fog.density ?? 0.01)
    }
  }
}

// 创建对象
const createObjectFromData = async (
  objectData: ISceneObjectData,
  modelOrigins: IProjectData['origin']['models'],
  modelCache: Map<string, THREE.Group>
): Promise<THREE.Object3D | null> => {
  let object: THREE.Object3D | null = null

  if (objectData.type === 'primitive' && objectData.primitiveType) {
    object = createPrimitive(objectData)
  } else if (objectData.type === 'model' && objectData.modelOriginId) {
    const modelOrigin = modelOrigins.find((m) => m.id === objectData.modelOriginId)
    if (modelOrigin) {
      if (modelOrigin.url.startsWith('__primitive__:')) {
        const primitiveType = modelOrigin.url.replace('__primitive__:', '') as PrimitiveType
        object = createPrimitiveByType(primitiveType, objectData.name)
      } else {
        const cachedModel = modelCache.get(objectData.modelOriginId)
        if (cachedModel) {
          object = getModelLoader().cloneModel(cachedModel)

          // 应用子对象的材质和变换修改
          if (objectData.children && objectData.children.length > 0) {
            applyChildTransforms(object, objectData.children)
          }
        }
      }
    }
  } else if (objectData.type === 'billboard' && objectData.billboardData) {
    // 广告牌
    const billboardData: IBillboardData = {
      mode: (objectData.billboardData.mode as BillboardMode) || BillboardMode.Y_LOCK,
      size: objectData.billboardData.size,
      texture: objectData.billboardData.texture,
      backTexture: objectData.billboardData.backTexture,
      animation: objectData.billboardData.animation,
      repeat: objectData.billboardData.repeat,
      isVideo: objectData.billboardData.isVideo,
    }

    if (camera) {
      object = await BillboardFactory.createFromData(billboardData, camera, objectData.name)
    }
  } else if (objectData.type === 'group') {
    object = new THREE.Group()
    object.name = objectData.name
    if (objectData.children) {
      for (const childData of objectData.children) {
        const child = await createObjectFromData(childData, modelOrigins, modelCache)
        if (child) {
          object.add(child)
        }
      }
    }
  }

  if (object) {
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

    // 应用材质
    if (objectData.materialOverrides && object instanceof THREE.Mesh) {
      const material = object.material
      if (material instanceof THREE.MeshStandardMaterial) {
        const overrides = objectData.materialOverrides
        if (overrides.color) material.color.set(overrides.color)
        if (overrides.metalness !== undefined) material.metalness = overrides.metalness
        if (overrides.roughness !== undefined) material.roughness = overrides.roughness
        if (overrides.opacity !== undefined) material.opacity = overrides.opacity
        if (overrides.transparent !== undefined) material.transparent = overrides.transparent
        if (overrides.emissive) material.emissive.set(overrides.emissive)
        if (overrides.emissiveIntensity !== undefined)
          material.emissiveIntensity = overrides.emissiveIntensity
        if (overrides.wireframe !== undefined) material.wireframe = overrides.wireframe
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
        material.needsUpdate = true
      }
    }
  }

  return object
}

// 创建基础几何体
const createPrimitive = (objectData: ISceneObjectData): THREE.Mesh | null => {
  if (!objectData.primitiveType) return null
  const params = objectData.primitiveParams || {}

  switch (objectData.primitiveType) {
    case 'box':
      return ObjectFactory.createBox(params.width ?? 1, params.height ?? 1, params.depth ?? 1, {
        name: objectData.name,
      })
    case 'sphere':
      return ObjectFactory.createSphere(params.radius ?? 0.5, 32, 32, { name: objectData.name })
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

// 根据类型创建基础几何体
const createPrimitiveByType = (type: PrimitiveType | 'cube', name: string): THREE.Mesh | null => {
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

// 创建灯光
const createLightFromData = (lightData: ILightData): THREE.Light | null => {
  let light: THREE.Light | null = null
  const color = new THREE.Color(lightData.color)

  switch (lightData.type) {
    case 'ambient':
      light = new THREE.AmbientLight(color, lightData.intensity)
      break
    case 'directional': {
      const dirLight = new THREE.DirectionalLight(color, lightData.intensity)
      if (lightData.position) {
        dirLight.position.set(lightData.position.x, lightData.position.y, lightData.position.z)
      }
      dirLight.castShadow = lightData.castShadow ?? false
      light = dirLight
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
  }

  if (light) {
    light.name = lightData.name
  }

  return light
}

/**
 * 应用子对象材质修改
 * childrenData 是扁平数组，只包含被修改过的子对象
 * 通过 name 或 path 在模型树中查找并应用材质
 */
const applyChildTransforms = (parent: THREE.Object3D, childrenData: ISceneObjectData[]): void => {
  for (const childData of childrenData) {
    // 尝试通过 path 或 name 找到子对象
    let child: THREE.Object3D | null = null

    // 如果有 path，使用 path 查找（支持嵌套结构）
    const path = childData.userData?.path as string | undefined
    if (path) {
      child = findChildByPath(parent, path)
    }

    // 如果没找到，尝试通过 name 递归查找
    if (!child) {
      child = findChildByName(parent, childData.name)
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
        let material = child.material

        // 克隆材质，避免修改共享材质影响其他 mesh
        if (material instanceof THREE.MeshStandardMaterial) {
          const clonedMaterial = material.clone()
          child.material = clonedMaterial
          material = clonedMaterial

          const overrides = childData.materialOverrides
          if (overrides.color) material.color.set(overrides.color)
          if (overrides.metalness !== undefined) material.metalness = overrides.metalness
          if (overrides.roughness !== undefined) material.roughness = overrides.roughness
          if (overrides.opacity !== undefined) material.opacity = overrides.opacity
          if (overrides.transparent !== undefined) material.transparent = overrides.transparent
          if (overrides.emissive) material.emissive.set(overrides.emissive)
          if (overrides.emissiveIntensity !== undefined)
            material.emissiveIntensity = overrides.emissiveIntensity
          if (overrides.wireframe !== undefined) material.wireframe = overrides.wireframe
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
          material.needsUpdate = true
        } else if (Array.isArray(material)) {
          // 处理多材质情况
          child.material = material.map((mat) => {
            if (mat instanceof THREE.MeshStandardMaterial) {
              const cloned = mat.clone()
              const overrides = childData.materialOverrides!
              if (overrides.color) cloned.color.set(overrides.color)
              if (overrides.metalness !== undefined) cloned.metalness = overrides.metalness
              if (overrides.roughness !== undefined) cloned.roughness = overrides.roughness
              if (overrides.opacity !== undefined) cloned.opacity = overrides.opacity
              if (overrides.transparent !== undefined) cloned.transparent = overrides.transparent
              if (overrides.emissive) cloned.emissive.set(overrides.emissive)
              if (overrides.emissiveIntensity !== undefined)
                cloned.emissiveIntensity = overrides.emissiveIntensity
              if (overrides.wireframe !== undefined) cloned.wireframe = overrides.wireframe
              if (overrides.side) {
                switch (overrides.side) {
                  case 'front':
                    cloned.side = THREE.FrontSide
                    break
                  case 'back':
                    cloned.side = THREE.BackSide
                    break
                  case 'double':
                    cloned.side = THREE.DoubleSide
                    break
                }
              }
              cloned.needsUpdate = true
              return cloned
            }
            return mat
          })
        }
      }
    }
  }
}

/**
 * 通过路径查找子对象
 */
const findChildByPath = (parent: THREE.Object3D, path: string): THREE.Object3D | null => {
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
const findChildByName = (parent: THREE.Object3D, name: string): THREE.Object3D | null => {
  for (const child of parent.children) {
    if (child.name === name) return child
    const found = findChildByName(child, name)
    if (found) return found
  }
  return null
}

// 返回编辑器
// const handleBack = () => {
//   if (project.value?.id) {
//     router.push(`/editor/${project.value.id}`)
//   } else {
//     router.push('/assets')
//   }
// }

// 处理用户导入模型文件
const handleImportUserModel = async () => {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.gltf,.glb'
  input.multiple = true

  input.onchange = async (e) => {
    const files = (e.target as HTMLInputElement).files
    if (!files || files.length === 0) return

    if (previewRuntime) {
      const result = await previewRuntime.importUserModelFiles(files)
      pendingUserModels.value = previewRuntime.pendingUserModels

      result.skipped.forEach((fileName) => {
        ElMessage.warning(`文件 ${fileName} 不在待导入列表中`)
      })
      result.failed.forEach((fileName) => {
        ElMessage.error(`导入 ${fileName} 失败`)
      })
      result.imported.forEach((fileName) => {
        ElMessage.success(`已导入: ${fileName}`)
      })

      const allLoaded = pendingUserModels.value.every((item) => item.loaded)
      if (allLoaded) {
        showImportDialog.value = false
        ElMessage.success('所有模型已导入完成')
      }
      return
    }

    const modelLoader = getModelLoader()

    for (const file of files) {
      try {
        // 查找匹配的待导入模型
        const pendingItem = pendingUserModels.value.find(
          (item) => !item.loaded && item.data.importedFileName === file.name
        )

        if (!pendingItem) {
          ElMessage.warning(`文件 ${file.name} 不在待导入列表中`)
          continue
        }

        // 加载模型
        const objectUrl = URL.createObjectURL(file)
        const result = await modelLoader.loadModel(objectUrl)
        const model = result.model

        // 应用保存的变换
        model.position.set(
          pendingItem.data.transform.position.x,
          pendingItem.data.transform.position.y,
          pendingItem.data.transform.position.z
        )
        model.rotation.set(
          pendingItem.data.transform.rotation.x,
          pendingItem.data.transform.rotation.y,
          pendingItem.data.transform.rotation.z
        )
        model.scale.set(
          pendingItem.data.transform.scale.x,
          pendingItem.data.transform.scale.y,
          pendingItem.data.transform.scale.z
        )
        model.visible = pendingItem.data.visible
        model.name = pendingItem.data.name

        // 注意：子对象的材质修改通过 applyChildTransforms 处理
        // 不要在这里对所有 mesh 应用同一个 materialOverrides

        // 应用子对象材质修改（只包含用户修改过的子对象）
        if (pendingItem.data.children) {
          applyChildTransforms(model, pendingItem.data.children)
        }

        // 设置阴影
        model.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.castShadow = true
            child.receiveShadow = true
          }
        })

        // 添加到场景
        scene?.add(model)

        // 标记为已加载
        pendingItem.loaded = true
        userModelCache.set(file.name, model)

        ElMessage.success(`已导入: ${file.name}`)
      } catch (err) {
        console.error('Import model error:', err)
        ElMessage.error(`导入 ${file.name} 失败`)
      }
    }

    // 检查是否所有模型都已加载
    const allLoaded = pendingUserModels.value.every((item) => item.loaded)
    if (allLoaded) {
      showImportDialog.value = false
      ElMessage.success('所有模型已导入完成')
    }
  }

  input.click()
}

// 跳过导入用户模型
const handleSkipImport = () => {
  showImportDialog.value = false
  ElMessage.info('用户模型未导入，部分对象可能缺失')
}

// 刷新场景
// const handleRefresh = async () => {
//   const loadingInstance = ElLoading.service({
//     target: containerRef.value!,
//     text: '正在刷新场景...',
//     background: 'rgba(0, 0, 0, 0.7)',
//   })

//   try {
//     const projectId = route.params.id as string
//     let proj: Project | null = null

//     if (projectId === 'local') {
//       const localData = localStorage.getItem('lowcode3d_preview_data')
//       if (localData) {
//         const sceneData = JSON.parse(localData) as IProjectData
//         proj = {
//           id: 'local',
//           name: sceneData.projectName,
//           description: sceneData.description,
//           thumbnailUrl: '',
//           sceneData: sceneData,
//           createdAt: sceneData.createdAt,
//           updatedAt: sceneData.updatedAt,
//           ownerId: 'local',
//           isPublic: false,
//           status: 'published',
//         }
//       }
//     } else {
//       proj = await projectsApi.getProject(projectId)
//     }

//     if (!proj) throw new Error('Refresh failed')
//     project.value = proj

//     // 清空场景（保留灯光和地板）
//     if (scene) {
//       const objectsToRemove: THREE.Object3D[] = []
//       scene.traverse((obj) => {
//         if (!(obj instanceof THREE.Light) && obj !== scene && !obj.userData.isFloor) {
//           objectsToRemove.push(obj)
//         }
//       })
//       objectsToRemove.forEach((obj) => obj.parent?.remove(obj))
//     }

//     // 重新加载
//     if (proj.sceneData) {
//       await loadSceneData(proj.sceneData as IProjectData)
//     }

//     ElMessage.success('场景已刷新')
//   } catch (e) {
//     ElMessage.error('刷新失败')
//   } finally {
//     loadingInstance.close()
//   }
// }

// 切换全屏
const toggleFullscreen = () => {
  if (!document.fullscreenElement) {
    containerRef.value?.requestFullscreen()
    isFullscreen.value = true
  } else {
    document.exitFullscreen()
    isFullscreen.value = false
  }
}

// 加载项目
const loadProject = async () => {
  const projectId = route.params.id as string

  if (!projectId) {
    error.value = '项目ID不存在'
    loading.value = false
    return
  }

  try {
    let proj: Project | null = null

    // 如果 ID 是 local，从 localStorage加载
    if (projectId === 'local') {
      const localData = localStorage.getItem('lowcode3d_preview_data')
      if (localData) {
        const sceneData = JSON.parse(localData) as IProjectData
        proj = {
          id: 'local',
          name: sceneData.projectName,
          description: sceneData.description,
          thumbnailUrl: '',
          sceneData: sceneData,
          createdAt: sceneData.createdAt,
          updatedAt: sceneData.updatedAt,
          ownerId: 'local',
          isPublic: false,
          status: 'published',
        }
      } else {
        throw new Error('未找到预览数据')
      }
    } else {
      // 公开预览优先读取最新发布快照，避免草稿继续编辑影响已发布链接。
      try {
        const published = await projectsApi.getPublishedProject(projectId)
        const sceneData = published.sceneData as IProjectData
        proj = {
          id: published.projectId,
          name: sceneData.projectName,
          description: sceneData.description,
          thumbnailUrl: '',
          sceneData,
          createdAt: published.createdAt,
          updatedAt: published.createdAt,
          ownerId: published.ownerId,
          isPublic: true,
          status: 'published',
        }
      } catch (publishedError) {
        console.warn('未读取到发布快照，回退项目详情:', publishedError)
        proj = await projectsApi.getProject(projectId)
      }
    }

    if (!proj) throw new Error('Project not found')
    project.value = proj

    // 先将 loading 设为 false，让 canvas 容器渲染
    loading.value = false

    // 等待 DOM 更新后初始化场景
    await nextTick()

    // 初始化场景
    initScene()

    // 加载场景数据
    if (proj.sceneData) {
      await loadSceneData(proj.sceneData as IProjectData)
    }
  } catch (e) {
    console.error('加载项目失败:', e)
    error.value = (e as Error).message || '加载项目失败'
    loading.value = false
  }
}

onMounted(() => {
  loadProject()
})

onBeforeUnmount(() => {
  previewRuntime?.dispose()
  previewRuntime = null

  // 清理资源
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId)
  }
  window.removeEventListener('resize', handleResize)
  document.removeEventListener('fullscreenchange', handleFullscreenChange)
  controls?.dispose()
  renderer?.dispose()
  getBillboardManager().clear()
})
</script>

<template>
  <div class="preview-page">
    <!-- 加载状态 -->
    <div v-if="loading" class="loading-container">
      <div class="loading-spinner"></div>
      <p>正在加载场景...</p>
    </div>

    <!-- 错误状态 -->
    <div v-else-if="error" class="error-container">
      <p>{{ error }}</p>
      <el-button type="primary" @click="router.push('/assets')">返回项目列表</el-button>
    </div>

    <!-- 预览内容 -->
    <template v-else>
      <!-- 用户模型导入提示 -->
      <el-dialog
        v-model="showImportDialog"
        title="导入用户模型"
        width="480px"
        :close-on-click-modal="false"
        :close-on-press-escape="false"
        :show-close="false"
      >
        <div class="import-dialog-content">
          <p>此场景包含用户导入的模型，请导入以下文件：</p>
          <ul class="pending-models-list">
            <li v-for="item in pendingUserModels" :key="item.data.uuid">
              <span :class="{ loaded: item.loaded }">{{ item.data.importedFileName }}</span>
              <el-tag v-if="item.loaded" type="success" size="small">已导入</el-tag>
              <el-tag v-else type="warning" size="small">待导入</el-tag>
            </li>
          </ul>
        </div>
        <template #footer>
          <el-button @click="handleSkipImport">跳过</el-button>
          <el-button type="primary" @click="handleImportUserModel">选择文件导入</el-button>
        </template>
      </el-dialog>

      <!-- 浮动头部 -->
      <div v-if="showToolbar" class="floating-header">
        <span class="project-name">{{ project?.name }}</span>
        <el-button :icon="FullScreen" circle size="large" title="全屏" @click="toggleFullscreen" />
      </div>

      <!-- 3D 画布 -->
      <div ref="containerRef" class="preview-canvas"></div>
    </template>
  </div>
</template>

<style scoped lang="scss">
.preview-page {
  width: 100vw;
  height: 100vh;
  background-color: #000;
  position: relative;
  overflow: hidden;
}

.loading-container,
.error-container {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #fff;

  .loading-spinner {
    width: 40px;
    height: 40px;
    border: 3px solid rgba(255, 255, 255, 0.3);
    border-radius: 50%;
    border-top-color: #fff;
    animation: spin 1s ease-in-out infinite;
    margin-bottom: 16px;
  }

  p {
    font-size: 14px;
    opacity: 0.8;
  }
}

.floating-header {
  position: absolute;
  top: 24px;
  right: 24px;
  display: flex;
  align-items: center;
  gap: 16px;
  z-index: 100;
  pointer-events: none; // 让鼠标事件穿透空白区域

  // 子元素恢复鼠标事件
  > * {
    pointer-events: auto;
  }

  .project-name {
    color: rgba(255, 255, 255, 0.9);
    font-size: 18px;
    font-weight: 500;
    text-shadow: 0 2px 4px rgba(0, 0, 0, 0.5);
    background: rgba(0, 0, 0, 0.3);
    padding: 6px 16px;
    border-radius: 20px;
    backdrop-filter: blur(4px);
  }

  .el-button {
    background: rgba(0, 0, 0, 0.3);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #fff;
    backdrop-filter: blur(4px);

    &:hover {
      background: rgba(0, 0, 0, 0.5);
      border-color: rgba(255, 255, 255, 0.3);
    }
  }
}

.preview-canvas {
  width: 100%;
  height: 100%;
  outline: none;
}

// 导入对话框样式
.import-dialog-content {
  p {
    margin-bottom: 12px;
    color: var(--el-text-color-regular);
  }
}

.pending-models-list {
  list-style: none;
  padding: 0;
  margin: 0;
  max-height: 300px;
  overflow-y: auto;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 4px;

  li {
    padding: 8px 12px;
    border-bottom: 1px solid var(--el-border-color-lighter);
    display: flex;
    align-items: center;
    justify-content: space-between;

    &:last-child {
      border-bottom: none;
    }

    span {
      font-size: 13px;
      color: var(--el-text-color-primary);

      &.loaded {
        color: var(--el-color-success);
      }
    }
  }
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
```
