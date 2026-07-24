<script setup lang="ts">
/**
 * 画布面板组件
 * 3D 场景渲染和交互的核心组件
 */
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'
import { HomeFilled } from '@element-plus/icons-vue'
import * as THREE from 'three'
import {
  Engine,
  eventBus,
  getLightManager,
  getCommandBus,
  getEditorModeController,
  getHistoryManager,
  getHelperManager,
  getHotkeyManager,
  getSnappingManager,
  DEFAULT_HOTKEYS,
  type LightType,
  type SelectionChangedPayload,
} from '@/engine'
import { ObjectFactory, BillboardFactory } from '@/engine/objects'
import { BillboardMode } from '@/engine/objects/BillboardComponent'
import { SceneSerializer } from '@/engine/core/SceneSerializer'
import { markModelRootForSelection } from '@/engine/utils/modelSelection'
import { useSelectionStore } from '@/stores/selectionStore'
import { useResourceStore, type IModelLibraryItem } from '@/stores/resourceStore'
import { useThemeStore } from '@/stores/themeStore'
import { useProjectStore } from '@/stores/projectStore'
import { useEditorStateStore } from '@/stores/editorStateStore'
import type { ComponentInstance, IProjectData } from '@lowcode3d/shared'
import { ElMessage, ElLoading } from 'element-plus'

// 主题对应的背景色
const THEME_BACKGROUNDS = {
  dark: 0x1a1a2e,
  light: 0xe8eaed,
} as const

// 灯光拖拽数据类型
interface ILightDragData {
  type: 'light'
  lightType: LightType
  name: string
  component?: ComponentDragData
}

interface ComponentDragData {
  type: string
  props?: Record<string, unknown>
}

interface CanvasDragData {
  type: string
  item?: IModelLibraryItem
  lightType?: LightType
  name?: string
  asset?: any
  componentType?: string
  component?: ComponentDragData
}

interface DragPreviewContext {
  kind: 'primitive' | 'model' | 'light' | 'billboard' | 'custom_billboard'
  key: string
  item?: IModelLibraryItem
  lightType?: LightType
  name?: string
  asset?: any
  component?: ComponentDragData
}

const containerRef = ref<HTMLDivElement | null>(null)
let engine: Engine | null = null
const selectionStore = useSelectionStore()
const resourceStore = useResourceStore()
const themeStore = useThemeStore()
const projectStore = useProjectStore()
const editorStateStore = useEditorStateStore()
const commandBus = getCommandBus()
const editorModeController = getEditorModeController()

// 拖放状态
const isDragOver = ref(false)
let dragPreviewObject: THREE.Object3D | null = null
let dragPreviewContext: DragPreviewContext | null = null
let dragPreviewPosition = new THREE.Vector3()
let dragPreviewLoadToken = 0

// Raycaster 用于拖放位置计算
const raycaster = new THREE.Raycaster()
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)

const handleSelectionChange = (payload: SelectionChangedPayload) => {
  selectionStore.clearSelection()
  payload.selected.forEach((obj) => {
    selectionStore.addToSelection(obj.uuid)
  })
}

function parseDragData(event: DragEvent): CanvasDragData | null {
  const jsonData = event.dataTransfer?.getData('application/json')
  if (!jsonData) return null

  try {
    return JSON.parse(jsonData) as CanvasDragData
  } catch (error) {
    console.error('Invalid drag data:', error)
    return null
  }
}

function resolveDragContext(data: CanvasDragData): DragPreviewContext | null {
  if (data.component?.type === 'primitive' && data.item?.url) {
    return {
      kind: 'primitive',
      key: `primitive:${data.item.id}`,
      item: data.item,
      component: data.component,
    }
  }

  if (data.component?.type === 'light' && data.lightType) {
    return {
      kind: 'light',
      key: `light:${data.lightType}:${data.name || ''}`,
      lightType: data.lightType,
      name: data.name,
      component: data.component,
    }
  }

  if (data.component?.type === 'billboard' && data.asset) {
    return {
      kind: 'billboard',
      key: `billboard:${data.asset.id || data.asset.url || data.asset.name}`,
      asset: data.asset,
      component: data.component,
    }
  }

  if (data.component?.type === 'poi' && data.asset) {
    return {
      kind: 'custom_billboard',
      key: `poi:${data.asset.id || data.asset.url || data.asset.name}`,
      asset: data.asset,
      component: data.component,
    }
  }

  if (data.type === 'light' && data.lightType) {
    return {
      kind: 'light',
      key: `light:${data.lightType}:${data.name || ''}`,
      lightType: data.lightType,
      name: data.name,
      component: data.component,
    }
  }

  if (data.type === 'model' && data.item?.url) {
    return {
      kind: 'model',
      key: `model:${data.item.url}`,
      item: data.item,
      component: data.component,
    }
  }

  if (data.type === 'billboard') {
    return {
      kind: 'billboard',
      key: `billboard:${data.asset?.id || data.name || 'default'}`,
      asset: data.asset,
      component: data.component,
    }
  }

  if (data.type === 'custom_billboard' && data.asset) {
    return {
      kind: 'custom_billboard',
      key: `custom_billboard:${data.asset.id || data.asset.url || data.asset.name}`,
      asset: data.asset,
      component: data.component,
    }
  }

  return null
}

function isPreviewObject(object: THREE.Object3D): boolean {
  let current: THREE.Object3D | null = object
  while (current) {
    if ((current.userData as Record<string, unknown>).isDragPreview) {
      return true
    }
    current = current.parent
  }
  return false
}

function applyPreviewMaterial(material: THREE.Material, opacity = 0.34): void {
  const previewMaterial = material as THREE.Material & {
    transparent?: boolean
    opacity?: number
    depthWrite?: boolean
    depthTest?: boolean
    side?: THREE.Side
    toneMapped?: boolean
  }
  previewMaterial.transparent = true
  previewMaterial.opacity = opacity
  previewMaterial.depthWrite = false
  previewMaterial.depthTest = true
  previewMaterial.toneMapped = false
  previewMaterial.needsUpdate = true
}

function applyPreviewObjectAppearance(object: THREE.Object3D, opacity = 0.34): void {
  object.traverse((child) => {
    child.userData = {
      ...(child.userData ?? {}),
      isDragPreview: true,
      selectable: false,
    }

    if (!(child instanceof THREE.Mesh)) return

    child.renderOrder = 999
    const materials = Array.isArray(child.material) ? child.material : [child.material]
    materials.forEach((material) => {
      if (material) applyPreviewMaterial(material, opacity)
    })
  })

  object.userData = {
    ...(object.userData ?? {}),
    isDragPreview: true,
    selectable: false,
  }
}

function updatePreviewPosition(
  object: THREE.Object3D,
  context: DragPreviewContext,
  position: THREE.Vector3
): void {
  switch (context.kind) {
    case 'primitive': {
      const primitiveType = context.item?.url.replace('__primitive__:', '') || 'box'
      if (primitiveType === 'plane' || primitiveType === 'circle' || primitiveType === 'ring') {
        object.position.set(position.x, 0.01, position.z)
      } else {
        object.position.set(position.x, position.y + 0.5, position.z)
      }
      break
    }
    case 'model': {
      const height =
        typeof object.userData.previewModelHeight === 'number'
          ? object.userData.previewModelHeight
          : new THREE.Box3().setFromObject(object).getSize(new THREE.Vector3()).y
      object.position.set(position.x, height / 2, position.z)
      break
    }
    case 'light': {
      object.position.set(position.x, context.lightType === 'ambient' ? 0 : 5, position.z)
      break
    }
    case 'billboard':
    case 'custom_billboard':
      object.position.copy(position)
      break
  }
}

function disposePreviewObject(object: THREE.Object3D): void {
  object.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      if ((child.userData as Record<string, unknown>).previewDisposesGeometry) {
        child.geometry?.dispose()
      }

      const materials = Array.isArray(child.material) ? child.material : [child.material]
      materials.forEach((material) => {
        material?.dispose()
      })
    }
  })
}

function clearDragPreview(): void {
  dragPreviewLoadToken += 1
  dragPreviewContext = null
  dragPreviewPosition = new THREE.Vector3()

  if (engine && dragPreviewObject) {
    engine.sceneManager.scene.remove(dragPreviewObject)
    disposePreviewObject(dragPreviewObject)
  }

  dragPreviewObject = null
}

function setDragPreviewObject(object: THREE.Object3D): void {
  if (!engine) return

  if (dragPreviewObject) {
    engine.sceneManager.scene.remove(dragPreviewObject)
    disposePreviewObject(dragPreviewObject)
  }

  dragPreviewObject = object
  engine.sceneManager.scene.add(object)

  if (dragPreviewContext) {
    updatePreviewPosition(object, dragPreviewContext, dragPreviewPosition)
  }
}

function createPlaceholderPreviewMesh(name: string): THREE.Mesh {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(1.2, 1.2, 1.2),
    new THREE.MeshStandardMaterial({
      color: 0x7db9ff,
      transparent: true,
      opacity: 0.24,
      metalness: 0.1,
      roughness: 0.25,
      depthWrite: false,
    })
  )
  mesh.name = name
  mesh.userData.previewDisposesGeometry = true
  return mesh
}

function createLightPreview(lightType: LightType, name?: string): THREE.Group {
  const group = new THREE.Group()
  group.name = name || `LightPreview-${lightType}`

  const body = new THREE.Mesh(
    new THREE.SphereGeometry(0.18, 18, 18),
    new THREE.MeshBasicMaterial({
      color: lightType === 'ambient' ? 0x9ca3af : 0xffd166,
      transparent: true,
      opacity: 0.38,
      depthWrite: false,
    })
  )
  body.userData.previewDisposesGeometry = true
  group.add(body)

  const halo = new THREE.Mesh(
    new THREE.RingGeometry(0.28, 0.42, 32),
    new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.18,
      depthWrite: false,
      side: THREE.DoubleSide,
    })
  )
  halo.rotation.x = -Math.PI / 2
  halo.position.y = -0.28
  halo.userData.previewDisposesGeometry = true
  group.add(halo)

  group.userData.previewDisposesGeometry = true
  applyPreviewObjectAppearance(group, 0.38)
  return group
}

async function hydrateModelPreview(context: DragPreviewContext, token: number): Promise<void> {
  if (!context.item?.url || token !== dragPreviewLoadToken) return

  try {
    if (!resourceStore.getClonedModel(context.item.url)) {
      await resourceStore.loadModel(context.item.url)
    }

    if (token !== dragPreviewLoadToken || dragPreviewContext?.key !== context.key) {
      return
    }

    const previewModel = resourceStore.getClonedModel(context.item.url)
    if (!previewModel) return

    applyPreviewObjectAppearance(previewModel)
    updatePreviewPosition(previewModel, context, dragPreviewPosition)
    previewModel.userData.previewModelHeight = new THREE.Box3()
      .setFromObject(previewModel)
      .getSize(new THREE.Vector3()).y
    setDragPreviewObject(previewModel)
  } catch (error) {
    console.warn('Failed to hydrate drag preview model:', error)
  }
}

function createDragPreviewObject(
  context: DragPreviewContext,
  position: THREE.Vector3
): THREE.Object3D | null {
  switch (context.kind) {
    case 'primitive': {
      if (!context.item?.url) return null
      const primitiveType = normalizePrimitiveType(context.item.url.replace('__primitive__:', ''))
      const preview = createPrimitive(primitiveType, position)
      if (preview) {
        applyPreviewObjectAppearance(preview)
        ;(preview.userData as Record<string, unknown>).previewDisposesGeometry = true
      }
      return preview
    }
    case 'model': {
      if (!context.item?.url) return null

      const cachedPreview = resourceStore.getClonedModel(context.item.url)
      if (cachedPreview) {
        applyPreviewObjectAppearance(cachedPreview)
        cachedPreview.userData.previewModelHeight = new THREE.Box3()
          .setFromObject(cachedPreview)
          .getSize(new THREE.Vector3()).y
        updatePreviewPosition(cachedPreview, context, position)
        return cachedPreview
      }

      const placeholder = createPlaceholderPreviewMesh(context.item.name)
      const wrapper = new THREE.Group()
      wrapper.name = `${context.item.name}-preview`
      wrapper.add(placeholder)
      wrapper.userData.previewDisposesGeometry = true
      wrapper.userData.previewModelHeight = 1.2
      applyPreviewObjectAppearance(wrapper)
      updatePreviewPosition(wrapper, context, position)

      const token = ++dragPreviewLoadToken
      void hydrateModelPreview(context, token)
      return wrapper
    }
    case 'light':
      return createLightPreview(context.lightType || 'point', context.name)
    case 'billboard': {
      const preview = new THREE.Mesh(
        new THREE.PlaneGeometry(1.5, 1.5),
        new THREE.MeshBasicMaterial({
          color: 0x7dd3fc,
          transparent: true,
          opacity: 0.3,
          depthWrite: false,
          side: THREE.DoubleSide,
        })
      )
      preview.userData.previewDisposesGeometry = true
      applyPreviewObjectAppearance(preview)
      return preview
    }
    case 'custom_billboard': {
      const preview = new THREE.Mesh(
        new THREE.PlaneGeometry(1.5, 1.2),
        new THREE.MeshBasicMaterial({
          color: 0xa78bfa,
          transparent: true,
          opacity: 0.3,
          depthWrite: false,
          side: THREE.DoubleSide,
        })
      )
      preview.userData.previewDisposesGeometry = true
      applyPreviewObjectAppearance(preview)
      return preview
    }
    default:
      return null
  }
}

function updateDragPreview(event: DragEvent): void {
  if (!engine || !containerRef.value) return

  const data = parseDragData(event)
  if (!data) {
    clearDragPreview()
    return
  }

  const context = resolveDragContext(data)
  if (!context) {
    clearDragPreview()
    return
  }

  const position = calculateDropPosition(event)
  dragPreviewPosition.copy(position)
  const previousKey = dragPreviewContext?.key
  dragPreviewContext = context

  if (!dragPreviewObject || previousKey !== context.key) {
    clearDragPreview()
    dragPreviewContext = context
    const previewObject = createDragPreviewObject(context, position)
    if (previewObject) {
      setDragPreviewObject(previewObject)
    }
  } else {
    updatePreviewPosition(dragPreviewObject, context, position)
  }
}

function setViewPreset(preset: 'front' | 'right' | 'top'): void {
  const currentEngine = Engine.getInstance()
  if (!currentEngine?.isInitialized) return
  currentEngine.cameraManager.setViewPreset(preset)
}

function resetView(): void {
  const currentEngine = Engine.getInstance()
  if (!currentEngine?.isInitialized) return
  currentEngine.cameraManager.resetView()
}

/**
 * 处理拖拽进入
 */
const handleDragEnter = (event: DragEvent) => {
  event.preventDefault()
  isDragOver.value = true
  updateDragPreview(event)
}

/**
 * 处理拖拽经过
 */
const handleDragOver = (event: DragEvent) => {
  event.preventDefault()
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'copy'
  }
  updateDragPreview(event)
}

/**
 * 处理拖拽离开
 */
const handleDragLeave = (event: DragEvent) => {
  // 检查是否真正离开容器
  const relatedTarget = event.relatedTarget as HTMLElement | null
  if (relatedTarget && containerRef.value?.contains(relatedTarget)) {
    return
  }
  isDragOver.value = false
  clearDragPreview()
}

/**
 * 处理放置
 */
const handleDrop = async (event: DragEvent) => {
  event.preventDefault()
  isDragOver.value = false
  clearDragPreview()

  if (!engine || !event.dataTransfer || !containerRef.value) return

  // 获取拖拽数据
  const data = parseDragData(event)
  if (!data) {
    console.log('No drag data found')
    return
  }

  // 计算放置位置（使用 Raycaster 射线与地面相交）
  const dropPosition = calculateDropPosition(event)
  const dragContext = resolveDragContext(data)

  // 根据拖拽类型处理
  if (!dragContext) {
    console.log('Unknown drag data type:', data)
    return
  }

  if (dragContext.kind === 'primitive' && dragContext.item) {
    await createObjectFromItem(dragContext.item, dropPosition, dragContext.component)
  } else if (dragContext.kind === 'light' && dragContext.lightType && dragContext.name) {
    await createLightFromDrop(
      {
        type: 'light',
        lightType: dragContext.lightType,
        name: dragContext.name,
        component: dragContext.component,
      },
      dropPosition
    )
  } else if (dragContext.kind === 'billboard' && dragContext.asset) {
    await createCustomBillboardFromDrop(dragContext.asset, dropPosition, dragContext.component)
  } else if (dragContext.kind === 'custom_billboard' && dragContext.asset) {
    await createCustomBillboardFromDrop(dragContext.asset, dropPosition, dragContext.component)
  } else if (dragContext.kind === 'model' && dragContext.item) {
    await createObjectFromItem(dragContext.item, dropPosition)
  } else if (dragContext.kind === 'billboard') {
    await createBillboardFromDrop(dropPosition)
  }
}

/**
 * 从拖拽创建广告牌
 */
async function createBillboardFromDrop(position: THREE.Vector3) {
  if (!engine) return

  const billboard = await BillboardFactory.create({
    name: '广告牌',
    position: position,
    camera: engine.cameraManager.camera,
  })
  attachComponentInstance(billboard, { type: 'billboard' })

  // 将广告牌添加到对象管理器
  commandBus.addObject(billboard)

  ElMessage.success('已添加广告牌')
}

/**
 * 从自定义资源创建广告牌
 */
async function createCustomBillboardFromDrop(
  asset: any,
  position: THREE.Vector3,
  component?: ComponentDragData
) {
  if (!engine) return

  // 检查是否是内置标注或直接图片资源
  // 内置标注带有 place_icon 标签，或者是 svg/图片文件
  const isDirectImage =
    (asset.tags && asset.tags.includes('place_icon')) ||
    /\.(svg|png|jpg|jpeg|webp)$/i.test(asset.url)

  if (isDirectImage) {
    try {
      // 直接使用图片 URL 创建广告牌
      const billboard = await BillboardFactory.create({
        name: asset.name,
        position,
        camera: engine.cameraManager.camera,
        width: 2, // 默认尺寸
        height: 2,
        textureUrl: asset.url,
        mode: BillboardMode.Y_LOCK, // 默认始终面向相机（Y轴锁定）
        animation: 'NONE',
      })
      attachComponentInstance(billboard, component ?? { type: 'billboard' }, {
        assetUrl: asset.url,
        iconUrl: asset.url,
        label: asset.name,
      })

      commandBus.addObject(billboard)
      ElMessage.success(`已添加 ${asset.name}`)
    } catch (e) {
      console.error('Failed to create billboard from image:', e)
      ElMessage.error('创建广告牌失败')
    }
    return
  }

  // 原有逻辑：尝试从 URL 加载 JSON 配置
  try {
    const response = await fetch(asset.url)
    if (!response.ok) throw new Error('Failed to fetch billboard config')

    const config = await response.json()

    const billboard = await BillboardFactory.create({
      name: asset.name,
      position,
      camera: engine.cameraManager.camera,
      width: config.width,
      height: config.height,
      textureUrl: config.frontUrl,
      backTextureUrl: config.backUrl,
      mode: config.mode || BillboardMode.Y_LOCK,
      animation: config.animation || 'NONE',
      repeat: config.repeat,
      isVideo: config.isVideo,
    })
    attachComponentInstance(billboard, component ?? { type: 'billboard' }, {
      assetUrl: asset.url,
      label: asset.name,
    })

    commandBus.addObject(billboard)
    ElMessage.success('已添加广告牌')
  } catch (e) {
    console.error('Failed to create custom billboard:', e)
    ElMessage.error('创建广告牌失败：无法加载配置')
  }
}

/**
 * 从拖拽创建灯光
 */
async function createLightFromDrop(data: ILightDragData, position: THREE.Vector3) {
  if (!engine) return

  const lightManager = getLightManager()

  // 根据灯光类型调整位置
  const lightPosition = {
    x: position.x,
    y: data.lightType === 'ambient' ? 0 : 5,
    z: position.z,
  }

  const light = lightManager.createLight(data.lightType, {
    position: lightPosition,
  })
  attachComponentInstance(light, data.component ?? { type: 'light' }, {
    lightType: data.lightType,
  })

  // 将灯光添加到对象管理器
  commandBus.addObject(light, {
    name: light.name,
    type: 'light',
  })

  ElMessage.success(`已添加 ${data.name}`)
}

/**
 * 计算放置位置
 * 优先与场景中的 Mesh 相交，否则与地面平面相交
 */
function calculateDropPosition(event: DragEvent): THREE.Vector3 {
  if (!engine || !containerRef.value) {
    return new THREE.Vector3(0, 0, 0)
  }

  const rect = containerRef.value.getBoundingClientRect()
  const x = ((event.clientX - rect.left) / rect.width) * 2 - 1
  const y = -((event.clientY - rect.top) / rect.height) * 2 + 1

  // 设置 Raycaster
  const camera = engine.cameraManager.camera
  raycaster.setFromCamera(new THREE.Vector2(x, y), camera)

  // 首先尝试与场景中的 Mesh 相交
  const scene = engine.sceneManager.scene
  const intersects = raycaster.intersectObjects(scene.children, true)

  // 过滤出有效的 Mesh 交点（排除辅助对象等）
  for (const intersect of intersects) {
    const obj = intersect.object
    if (isPreviewObject(obj)) {
      continue
    }
    // 排除辅助线、网格、TransformControls 等
    if (
      obj instanceof THREE.Mesh &&
      !obj.name.includes('Helper') &&
      !obj.name.includes('Grid') &&
      !(obj as any).isTransformControlsPlane
    ) {
      // 在碰撞点上方一点放置，避免穿透
      const pos = intersect.point.clone()
      pos.y += 0.01 // 略微抬高
      return pos
    }
  }

  // 如果没有 Mesh 交点，回退到地面平面
  const intersection = new THREE.Vector3()
  const hasIntersection = raycaster.ray.intersectPlane(groundPlane, intersection)

  if (hasIntersection) {
    // 将位置取整到 0.5 的倍数，使放置更整齐
    intersection.x = Math.round(intersection.x * 2) / 2
    intersection.z = Math.round(intersection.z * 2) / 2
    intersection.y = 0 // 确保在地面上
    return intersection
  }

  // 如果没有交点，使用默认位置
  return new THREE.Vector3(0, 0, 0)
}

/**
 * 根据模型库项创建对象
 */
async function createObjectFromItem(
  item: IModelLibraryItem,
  position: THREE.Vector3,
  component?: ComponentDragData
) {
  if (!engine || !item || !item.url) {
    console.error('Invalid item or missing url:', item)
    return
  }

  // 检查是否是基础形状
  if (item.url.startsWith('__primitive__:')) {
    const primitiveType = item.url.replace('__primitive__:', '')
    const object = createPrimitive(primitiveType, position)
    if (object) {
      attachComponentInstance(object, component ?? { type: 'primitive' }, {
        primitiveType: normalizePrimitiveType(primitiveType),
      })
      commandBus.addObject(object, {
        name: item.name,
        type: 'mesh',
      })
      ElMessage.success(`已添加 ${item.name}`)
    }
    return
  }

  // 加载外部模型
  const loading = ElLoading.service({
    target: containerRef.value!,
    text: `正在加载 ${item.name}...`,
    background: 'rgba(0, 0, 0, 0.5)',
  })

  try {
    const result = await resourceStore.loadModel(item.url, (progress) => {
      loading.setText(`正在加载 ${item.name}... ${Math.round(progress)}%`)
    })

    // 克隆模型（以便多次放置）
    const model = result.model.clone()
    model.position.copy(position)
    model.position.y = result.size.y / 2 // 调整 Y 位置使底部在地面

    // 设置模型根节点为可选择，点击子 Mesh 时默认选择整体模型
    markModelRootForSelection(model, {
      name: item.name,
      modelUrl: item.url,
      libraryId: item.id,
    })
    if (component) {
      attachComponentInstance(model, component)
    }

    commandBus.addObject(model, {
      name: item.name,
      type: 'model',
      modelUrl: item.url,
    })

    // 聚焦模型
    engine.cameraManager.focusOnObject(model)

    ElMessage.success(`已添加 ${item.name}`)
  } catch (error) {
    console.error('Failed to load model:', error)
    ElMessage.error(`加载 ${item.name} 失败`)
  } finally {
    loading.close()
  }
}

/**
 * 创建基础形状
 */
function createPrimitive(type: string, position: THREE.Vector3): THREE.Object3D | null {
  const color = Math.random() * 0xffffff
  const options = {
    color,
    position: { x: position.x, y: position.y + 0.5, z: position.z },
    userData: { selectable: true },
  }

  switch (type) {
    case 'box':
    case 'cube':
      return ObjectFactory.createBox(1, 1, 1, options)
    case 'sphere':
      return ObjectFactory.createSphere(0.5, 32, 32, options)
    case 'cylinder':
      return ObjectFactory.createCylinder(0.5, 0.5, 1, 32, options)
    case 'cone':
      return ObjectFactory.createCone(0.5, 1, 32, options)
    case 'torus':
      return ObjectFactory.createTorus(0.5, 0.2, 16, 32, options)
    case 'circle': {
      const circle = ObjectFactory.createCircle(0.5, 32, {
        ...options,
        position: { x: position.x, y: 0.01, z: position.z },
      })
      circle.rotation.x = -Math.PI / 2
      return circle
    }
    case 'ring': {
      const ring = ObjectFactory.createRing(0.3, 0.5, 32, {
        ...options,
        position: { x: position.x, y: 0.01, z: position.z },
      })
      ring.rotation.x = -Math.PI / 2
      return ring
    }
    case 'tetrahedron':
      return ObjectFactory.createTetrahedron(0.65, 0, options)
    case 'octahedron':
      return ObjectFactory.createOctahedron(0.65, 0, options)
    case 'icosahedron':
      return ObjectFactory.createIcosahedron(0.65, 0, options)
    case 'dodecahedron':
      return ObjectFactory.createDodecahedron(0.65, 0, options)
    case 'plane': {
      const plane = ObjectFactory.createPlane(2, 2, 1, 1, {
        ...options,
        position: { x: position.x, y: 0.01, z: position.z },
      })
      plane.rotation.x = -Math.PI / 2
      return plane
    }
    default:
      return null
  }
}

function normalizePrimitiveType(type: string): string {
  return type === 'cube' ? 'box' : type
}

function attachComponentInstance(
  object: THREE.Object3D,
  component: ComponentDragData,
  extraProps: Record<string, unknown> = {}
) {
  const instance: ComponentInstance = {
    id: `${component.type}-${crypto.randomUUID()}`,
    type: component.type,
    version: '1.0.0',
    objectUuid: object.uuid,
    enabled: true,
    props: {
      ...(component.props ?? {}),
      ...extraProps,
    },
  }

  object.userData.component = instance
}

// 获取当前主题的背景色
const getThemeBackground = () => {
  return themeStore.isDark ? THEME_BACKGROUNDS.dark : THEME_BACKGROUNDS.light
}

// 初始化引擎
const initEngine = async () => {
  if (!containerRef.value) return

  engine = Engine.getInstance()
  engine.init({
    container: containerRef.value,
    antialias: true,
    backgroundColor: getThemeBackground(),
    enableShadows: true,
  })

  // 初始化灯光管理器
  const lightManager = getLightManager()
  lightManager.bindScene(engine.sceneManager.scene)

  // 初始化辅助工具管理器
  const helperManager = getHelperManager()
  helperManager.init(
    engine.sceneManager.scene,
    engine.cameraManager.camera,
    engine.renderManager.renderer,
    containerRef.value,
    { showGrid: true, showAxes: true, showViewHelper: true }
  )

  // 初始化吸附管理器
  const snappingManager = getSnappingManager()
  snappingManager.bindTransformManager(engine.transformManager)

  // 初始化快捷键
  initHotkeys()

  eventBus.on('scene:selection-changed', handleSelectionChange)

  // 检查是否有已保存的场景数据需要恢复
  const currentProject = projectStore.currentProject
  if (currentProject?.sceneData) {
    try {
      console.log('正在恢复已保存的场景...')
      await SceneSerializer.deserialize(currentProject.sceneData as IProjectData)
      console.log('场景恢复完成')
    } catch (e) {
      console.error('恢复场景失败:', e)
      ElMessage.warning('恢复场景失败，已加载默认场景')
      // 恢复失败时添加示例对象
      addSampleObjects()
    }
  } else {
    // 没有已保存的场景，添加示例对象
    addSampleObjects()
  }

  editorStateStore.markAsSaved()
}

// 初始化快捷键
const initHotkeys = () => {
  const hotkeyManager = getHotkeyManager()

  // 工具模式切换
  hotkeyManager.register(
    'tool.browse',
    { key: 'v', description: '浏览模式', category: 'tool' },
    () => {
      editorModeController.setMode('browse')
    }
  )

  hotkeyManager.register(
    'tool.select',
    { key: 'c', description: '选择模式', category: 'tool' },
    () => {
      editorModeController.setMode('select')
    }
  )

  hotkeyManager.register(
    'tool.move',
    { key: 'm', description: '移动模式', category: 'tool' },
    () => {
      editorModeController.setMode('move')
    }
  )

  hotkeyManager.register(
    'tool.rotate',
    { key: 'r', description: '旋转模式', category: 'tool' },
    () => {
      editorModeController.setMode('rotate')
    }
  )

  hotkeyManager.register(
    'tool.scale',
    { key: 's', description: '缩放模式', category: 'tool' },
    () => {
      editorModeController.setMode('scale')
    }
  )

  hotkeyManager.register(
    'tool.space',
    { key: 'x', description: '切换坐标空间', category: 'tool' },
    () => {
      editorModeController.toggleSpace()
    }
  )

  hotkeyManager.register(
    'tool.axes',
    { key: 'a', shift: true, description: '切换坐标轴', category: 'tool' },
    () => {
      eventBus.emit('editor:toggle-axes')
    }
  )

  hotkeyManager.register(
    'tool.viewhelper',
    { key: 'h', shift: true, description: '切换视图辅助', category: 'tool' },
    () => {
      eventBus.emit('editor:toggle-viewhelper')
    }
  )

  hotkeyManager.register('transform.translate', DEFAULT_HOTKEYS['transform.translate'], () => {
    editorModeController.setMode('move')
  })

  hotkeyManager.register('transform.rotate', DEFAULT_HOTKEYS['transform.rotate'], () => {
    editorModeController.setMode('rotate')
  })

  hotkeyManager.register('transform.scale', DEFAULT_HOTKEYS['transform.scale'], () => {
    editorModeController.setMode('scale')
  })

  hotkeyManager.register('transform.space', DEFAULT_HOTKEYS['transform.space'], () => {
    editorModeController.toggleSpace()
  })

  // 编辑操作
  hotkeyManager.register('edit.delete', DEFAULT_HOTKEYS['edit.delete'], () => {
    if (selectionStore.selectedIds.length > 0) {
      const idsToRemove = [...selectionStore.selectedIds]
      idsToRemove.forEach((id) => commandBus.removeObject(id))
    }
  })

  hotkeyManager.register('edit.delete.backspace', DEFAULT_HOTKEYS['edit.delete.backspace'], () => {
    if (selectionStore.selectedIds.length > 0) {
      const idsToRemove = [...selectionStore.selectedIds]
      idsToRemove.forEach((id) => commandBus.removeObject(id))
    }
  })

  hotkeyManager.register('edit.undo', DEFAULT_HOTKEYS['edit.undo'], () => {
    const historyManager = getHistoryManager()
    if (historyManager.undo()) {
      ElMessage.info(`撤销: ${historyManager.redoName || '操作'}`)
    }
  })

  hotkeyManager.register('edit.redo', DEFAULT_HOTKEYS['edit.redo'], () => {
    const historyManager = getHistoryManager()
    if (historyManager.redo()) {
      ElMessage.info(`重做: ${historyManager.undoName || '操作'}`)
    }
  })

  hotkeyManager.register('edit.redo.y', DEFAULT_HOTKEYS['edit.redo.y'], () => {
    const historyManager = getHistoryManager()
    if (historyManager.redo()) {
      ElMessage.info(`重做: ${historyManager.undoName || '操作'}`)
    }
  })

  hotkeyManager.register('edit.group', DEFAULT_HOTKEYS['edit.group'], () => {
    eventBus.emit('scene:group-selected', {})
  })

  hotkeyManager.register('edit.ungroup', DEFAULT_HOTKEYS['edit.ungroup'], () => {
    eventBus.emit('scene:ungroup-selected', {})
  })

  // 视图操作
  hotkeyManager.register('view.focus', DEFAULT_HOTKEYS['view.focus'], () => {
    const selected = engine?.selectionManager.getPrimarySelected()
    if (selected) {
      engine?.cameraManager.focusOnObject(selected)
    }
  })

  // 工具切换
  hotkeyManager.register('tool.grid', DEFAULT_HOTKEYS['tool.grid'], () => {
    getHelperManager().toggleGrid()
  })

  hotkeyManager.register('tool.snap', DEFAULT_HOTKEYS['tool.snap'], () => {
    getSnappingManager().toggle()
  })

  // 通用
  hotkeyManager.register('general.escape', DEFAULT_HOTKEYS['general.escape'], () => {
    engine?.selectionManager.clearSelection()
  })

  hotkeyManager.register('general.save', DEFAULT_HOTKEYS['general.save'], () => {
    eventBus.emit('editor:save-project')
  })
}

// 添加示例对象
const addSampleObjects = () => {
  if (!engine) return

  // 重置计数器
  ObjectFactory.resetCounter()

  // 立方体
  const cube = ObjectFactory.createBox(1, 1, 1, {
    color: 0x409eff,
    position: { x: 0, y: 0.5, z: 0 },
    userData: { selectable: true },
  })
  engine.addObject(cube)

  // 球体
  const sphere = ObjectFactory.createSphere(0.5, 32, 32, {
    color: 0x67c23a,
    position: { x: 2, y: 0.5, z: 0 },
    userData: { selectable: true },
  })
  engine.addObject(sphere)

  // 圆柱体
  const cylinder = ObjectFactory.createCylinder(0.4, 0.4, 1, 32, {
    color: 0xe6a23c,
    position: { x: -2, y: 0.5, z: 0 },
    userData: { selectable: true },
  })
  engine.addObject(cylinder)

  // 地板
  // const floor = ObjectFactory.createFloor(40)
  // engine.addObject(floor)
}

onMounted(() => {
  initEngine()
})

// 监听主题变化，更新场景背景色
watch(
  () => themeStore.isDark,
  (isDark) => {
    if (engine) {
      const bgColor = isDark ? THEME_BACKGROUNDS.dark : THEME_BACKGROUNDS.light
      engine.sceneManager.setBackgroundColor(bgColor)
    }
  }
)

onBeforeUnmount(() => {
  eventBus.off('scene:selection-changed', handleSelectionChange)
  clearDragPreview()

  // 清理管理器
  getHelperManager().dispose()
  getHotkeyManager().dispose()

  // 销毁引擎实例
  Engine.destroyInstance()
  engine = null
})
</script>

<template>
  <div
    ref="containerRef"
    class="canvas-panel"
    :class="{ 'drag-over': isDragOver }"
    @dragenter="handleDragEnter"
    @dragover="handleDragOver"
    @dragleave="handleDragLeave"
    @drop="handleDrop"
  >
    <div class="viewport-widget" aria-label="视角快捷控制">
      <el-tooltip content="恢复默认视角" placement="left">
        <button
          class="view-button view-home"
          @pointerdown.stop.prevent
          @click.stop.prevent="resetView"
        >
          <el-icon>
            <HomeFilled />
          </el-icon>
        </button>
      </el-tooltip>
      <div class="view-axis">
        <el-tooltip content="顶视图" placement="left">
          <button
            class="view-button axis-y"
            @pointerdown.stop.prevent
            @click.stop.prevent="setViewPreset('top')"
          >
            Y
          </button>
        </el-tooltip>
        <el-tooltip content="正视图" placement="left">
          <button
            class="view-button axis-z"
            @pointerdown.stop.prevent
            @click.stop.prevent="setViewPreset('front')"
          >
            Z
          </button>
        </el-tooltip>
        <el-tooltip content="右视图" placement="left">
          <button
            class="view-button axis-x"
            @pointerdown.stop.prevent
            @click.stop.prevent="setViewPreset('right')"
          >
            X
          </button>
        </el-tooltip>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.canvas-panel {
  width: 100%;
  height: 100%;
  overflow: hidden;
  background-color: var(--lc-bg-canvas);
  outline: none;
  position: relative;

  :deep(canvas) {
    position: relative;
    z-index: 1;
  }

  &.drag-over {
    &::after {
      content: '';
      position: absolute;
      inset: 8px;
      border: 2px dashed var(--el-color-primary);
      border-radius: 12px;
      pointer-events: none;
      animation: pulse 1.5s ease-in-out infinite;
    }
  }
}

.viewport-widget {
  position: absolute;
  top: 18px;
  right: 18px;
  z-index: 120;
  pointer-events: auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 6px;
  background: rgba(34, 40, 50, 0.9);
  border: 1px solid var(--lc-border-subtle);
  border-radius: var(--lc-radius-lg);
  box-shadow: var(--lc-shadow-floating);
  backdrop-filter: blur(10px);
}

.view-axis {
  display: grid;
  grid-template-columns: repeat(2, 28px);
  gap: 4px;

  .axis-y {
    grid-column: 1 / -1;
    justify-self: center;
  }
}

.view-button {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--lc-text-secondary);
  background: var(--lc-bg-control);
  border: 1px solid var(--lc-border-subtle);
  border-radius: var(--lc-radius-md);
  font-family: var(--lc-font-mono);
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  transition:
    color 0.15s ease,
    background-color 0.15s ease,
    border-color 0.15s ease,
    transform 0.15s ease;

  &:hover {
    color: var(--lc-text-primary);
    background: var(--lc-bg-control-hover);
    border-color: var(--lc-border-strong);
    transform: translateY(-1px);
  }
}

.view-home {
  width: 60px;
}

.axis-x {
  color: var(--lc-axis-x);
}

.axis-y {
  color: var(--lc-axis-y);
}

.axis-z {
  color: var(--lc-axis-z);
}

.canvas-empty-overlay {
  position: absolute;
  inset: 0;
  z-index: 80;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;

  :deep(.empty-state) {
    min-width: 360px;
    pointer-events: auto;
    background: rgba(27, 31, 38, 0.86);
    border: 1px solid var(--lc-border-subtle);
    border-radius: var(--lc-radius-lg);
    box-shadow: var(--lc-shadow-floating);
    backdrop-filter: blur(12px);
  }
}

// 深色主题
html.dark .canvas-panel {
  background-color: var(--lc-bg-canvas);
}

:global(html.dark) .canvas-panel {
  background-color: var(--lc-bg-canvas);
}

.drop-indicator {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: rgba(79, 140, 255, 0.1);
  pointer-events: none;
  z-index: 100;
}

.drop-indicator-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 32px 48px;
  background-color: var(--lc-bg-panel-raised);
  border-radius: var(--lc-radius-lg);
  border: 1px solid var(--lc-selection-border);
  color: var(--lc-accent);
  font-size: 13px;
  font-weight: 500;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

:global(html.dark) .drop-indicator-content {
  background-color: rgba(26, 26, 46, 0.95);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.drop-icon {
  width: 48px;
  height: 48px;
  animation: bounce 1s ease-in-out infinite;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 0.5;
  }

  50% {
    opacity: 1;
  }
}

@keyframes bounce {
  0%,
  100% {
    transform: translateY(0);
  }

  50% {
    transform: translateY(8px);
  }
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
