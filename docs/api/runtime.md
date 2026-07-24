# Runtime API 二次开发文档

`@lowcode3d/runtime` 是核心渲染引擎，提供完整的 3D 场景管理、渲染、交互能力。

## 快速开始

### 安装

```bash
npm install @lowcode3d/runtime three
```

### 基础使用

```typescript
import { LowCode3DViewer } from '@lowcode3d/runtime'

// 创建查看器
const viewer = new LowCode3DViewer(document.getElementById('container'))

// 初始化
await viewer.init({
  backgroundColor: '#1a1a1a',
  enableShadows: true,
  antialias: true,
  pixelRatio: window.devicePixelRatio,
})

// 加载场景数据
await viewer.loadScene(sceneData)

// 清理
viewer.dispose()
```

---

## LowCode3DViewer

查看器主类，封装了引擎的初始化和场景加载。

### 构造函数

```typescript
const viewer = new LowCode3DViewer(container, options)
```

**参数:**

| 参数      | 类型            | 说明     |
| --------- | --------------- | -------- |
| container | `HTMLElement`   | 渲染容器 |
| options   | `ViewerOptions` | 可选配置 |

### 方法

#### `init(options?: ViewerOptions): Promise<void>`

初始化引擎。

**参数:**

| 属性            | 类型      | 默认值 | 说明                       |
| --------------- | --------- | ------ | -------------------------- |
| backgroundColor | `string`  | -      | 背景颜色                   |
| enableShadows   | `boolean` | -      | 是否启用阴影               |
| antialias       | `boolean` | `true` | 是否启用抗锯齿             |
| pixelRatio      | `number`  | -      | 像素比率，建议使用设备 DPR |

#### `loadScene(config: IProjectData): Promise<void>`

加载场景数据。

```typescript
await viewer.loadScene(sceneData)
```

#### `loadProject(projectData: IProjectData): Promise<IProjectData>`

加载完整 v1.3 项目数据，内部会执行协议迁移、场景恢复、事件绑定、数据源绑定和动画恢复。

```typescript
const migrated = await viewer.loadProject(projectData)
```

#### `setDataSourceData(sourceId: string, data: unknown): void`

由外部业务系统向运行时注入数据，并立即应用该数据源关联的属性绑定。

```typescript
viewer.setDataSourceData(sourceId, data)
```

#### `playAnimation(clipId?: string): void`

播放指定动画片段；不传 `clipId` 时播放当前项目中的动画动作。

```typescript
viewer.playAnimation(clipId)
```

#### `setObjectVisible(objectId: string, visible: boolean): boolean`

设置对象显隐，返回是否找到并成功更新对象。

```typescript
viewer.setObjectVisible(objectId, true)
```

#### `focusObject(objectId: string, padding?: number): boolean`

聚焦指定对象，适合外部列表、告警、数据卡片联动 3D 场景。

```typescript
viewer.focusObject(objectId)
```

#### `takeScreenshot(mimeType?: string, quality?: number): string`

导出当前画布截图，返回 data URL。

```typescript
const png = viewer.takeScreenshot('image/png', 1)
```

#### dispose(): void

销毁查看器并释放资源。

```typescript
viewer.dispose()
```

### 访问底层引擎

查看器内部使用 `Engine` 单例，可以通过 `viewer.engine` 访问：

```typescript
// 访问各个管理器
const engine = viewer.engine
const sceneManager = engine.sceneManager
const cameraManager = engine.cameraManager
const renderManager = engine.renderManager
const objectManager = engine.objectManager
const selectionManager = engine.selectionManager
const transformManager = engine.transformManager
```

---

## Engine

核心引擎类（单例模式），统一管理场景、渲染、相机及交互。

### 获取实例

```typescript
import { Engine, getEngine } from '@lowcode3d/runtime'

const engine = Engine.getInstance()
// 或
const engine = getEngine()
```

### 属性

| 属性             | 类型               | 说明         |
| ---------------- | ------------------ | ------------ |
| sceneManager     | `SceneManager`     | 场景管理器   |
| renderManager    | `RenderManager`    | 渲染管理器   |
| cameraManager    | `CameraManager`    | 相机管理器   |
| objectManager    | `ObjectManager`    | 对象管理器   |
| selectionManager | `SelectionManager` | 选择管理器   |
| transformManager | `TransformManager` | 变换管理器   |
| isInitialized    | `boolean`          | 是否已初始化 |

### 方法

#### init(config: IEngineConfig): void

初始化引擎。

```typescript
engine.init({
  container: document.getElementById('viewer'),
  backgroundColor: '#1a1a1a',
  enableShadows: true,
  antialias: true,
  pixelRatio: window.devicePixelRatio,
})
```

#### `resize(): void`

响应窗口大小变化。

```typescript
window.addEventListener('resize', () => {
  engine.resize()
})
```

#### `addObject(object: THREE.Object3D, metadata?: Partial<ISceneObject>): void`

添加对象到场景。

```typescript
const mesh = new THREE.Mesh(geometry, material)
engine.addObject(mesh, {
  name: 'MyMesh',
  visible: true,
})
```

#### `removeObject(object: THREE.Object3D): void`

从场景移除对象。

```typescript
engine.removeObject(mesh)
```

#### `takeScreenshot(mimeType?: string, quality?: number): string`

截取当前场景图片。

```typescript
const dataUrl = engine.takeScreenshot('image/png', 0.9)
```

#### `dispose(): void`

释放所有资源。

```typescript
engine.dispose()
```

---

## SceneManager

场景管理器，负责场景、环境、背景等。

### 属性

| 属性  | 类型          | 说明          |
| ----- | ------------- | ------------- |
| scene | `THREE.Scene` | Three.js 场景 |

### 方法

#### `setBackgroundColor(color: string): void`

设置背景颜色。

```typescript
sceneManager.setBackgroundColor('#1a1a1a')
```

#### `setEnvironmentMap(url: string): Promise<void>`

设置环境贴图（HDRI）。

```typescript
await sceneManager.setEnvironmentMap('/path/to/environment.hdr')
```

#### `addObject(object: THREE.Object3D): void`

添加对象到场景。

```typescript
sceneManager.addObject(mesh)
```

#### `removeObject(object: THREE.Object3D): void`

从场景移除对象。

```typescript
sceneManager.removeObject(mesh)
```

---

## CameraManager

相机管理器，管理相机和轨道控制器。

### 属性

| 属性     | 类型                      | 说明       |
| -------- | ------------------------- | ---------- |
| camera   | `THREE.PerspectiveCamera` | 当前相机   |
| controls | `OrbitControls`           | 轨道控制器 |

### 方法

#### `setCamera(type: 'perspective' | 'orthographic'): void`

切换相机类型。

```typescript
cameraManager.setCamera('orthographic')
```

#### `focusOn(target: THREE.Object3D | THREE.Vector3): void`

聚焦到目标对象或位置。

```typescript
cameraManager.focusOn(mesh)
```

#### `update(): void`

更新控制器（每帧调用）。

```typescript
cameraManager.update()
```

---

## RenderManager

渲染管理器，负责 WebGL 渲染和后处理。

### 属性

| 属性                  | 类型                    | 说明         |
| --------------------- | ----------------------- | ------------ |
| renderer              | `THREE.WebGLRenderer`   | WebGL 渲染器 |
| domElement            | `HTMLCanvasElement`     | Canvas 元素  |
| postProcessingManager | `PostProcessingManager` | 后处理管理器 |

### 方法

#### `setSize(width: number, height: number): void`

设置渲染尺寸。

```typescript
renderManager.setSize(800, 600)
```

#### `setPixelRatio(ratio: number): void`

设置像素比率。

```typescript
renderManager.setPixelRatio(window.devicePixelRatio)
```

#### `enableShadows(enabled: boolean): void`

启用/禁用阴影。

```typescript
renderManager.enableShadows(true)
```

#### `render(scene: THREE.Scene, camera: THREE.Camera): void`

渲染一帧。

```typescript
renderManager.render(scene, camera)
```

#### `takeScreenshot(mimeType?: string, quality?: number): string`

截图。

```typescript
const dataUrl = renderManager.takeScreenshot('image/jpeg', 0.8)
```

---

## ObjectManager

对象管理器，统一管理场景中的所有对象及其元数据。

### 方法

#### `add(object: THREE.Object3D, metadata?: Partial<ISceneObject>): IObjectEntry`

添加对象。

```typescript
const entry = objectManager.add(mesh, {
  name: 'MyMesh',
  type: 'mesh',
  visible: true,
})
```

#### `remove(id: string): boolean`

移除对象（通过 UUID）。

```typescript
objectManager.remove(mesh.uuid)
```

#### `get(id: string): IObjectEntry | undefined`

获取对象条目（包含对象和元数据）。

```typescript
const entry = objectManager.get(mesh.uuid)
console.log(entry.object, entry.metadata)
```

#### `getObject(id: string): THREE.Object3D | undefined`

获取 Three.js 对象。

```typescript
const obj = objectManager.getObject(mesh.uuid)
```

#### `getMetadata(id: string): ISceneObject | undefined`

获取元数据。

```typescript
const meta = objectManager.getMetadata(mesh.uuid)
```

#### `updateTransform(id: string): void`

更新对象变换并同步元数据。

```typescript
mesh.position.set(1, 2, 3)
objectManager.updateTransform(mesh.uuid)
```

#### `updateMetadata(id: string, updates: Partial<ISceneObject>): void`

更新元数据。

```typescript
objectManager.updateMetadata(mesh.uuid, {
  name: 'NewName',
  visible: false,
})
```

#### `getAll(): IObjectEntry[]`

获取所有对象。

```typescript
const allObjects = objectManager.getAll()
```

#### `getSelectables(): THREE.Object3D[]`

获取所有可选择对象。

```typescript
const selectables = objectManager.getSelectables()
```

---

## SelectionManager

选择管理器，处理鼠标选择和高亮。

### 方法

#### `select(object: THREE.Object3D): void`

选中单个对象。

```typescript
selectionManager.select(mesh)
```

#### `addToSelection(object: THREE.Object3D): void`

添加到选择（多选）。

```typescript
selectionManager.addToSelection(mesh)
```

#### `removeFromSelection(object: THREE.Object3D): void`

从选择中移除。

```typescript
selectionManager.removeFromSelection(mesh)
```

#### `clearSelection(): void`

清空选择。

```typescript
selectionManager.clearSelection()
```

#### `getSelected(): THREE.Object3D[]`

获取当前选中对象。

```typescript
const selected = selectionManager.getSelected()
```

#### `setEnabled(enabled: boolean): void`

启用/禁用选择功能。

```typescript
selectionManager.setEnabled(false)
```

### 事件

通过配置回调监听选择变化：

```typescript
new SelectionManager({
  domElement: canvas,
  camera: camera,
  scene: scene,
  onSelectionChange: (event) => {
    console.log('选中:', event.selected)
    console.log('新增:', event.added)
    console.log('移除:', event.removed)
  },
})
```

---

## TransformManager

变换管理器，处理对象的移动、旋转、缩放。

### 属性

| 属性          | 类型                | 说明         |
| ------------- | ------------------- | ------------ |
| controls      | `TransformControls` | 变换控制器   |
| mode          | `TransformMode`     | 当前模式     |
| currentObject | `THREE.Object3D`    | 当前附加对象 |

### 方法

#### `attach(object: THREE.Object3D): void`

附加到对象。

```typescript
transformManager.attach(mesh)
```

#### `detach(): void`

分离对象。

```typescript
transformManager.detach()
```

#### `setMode(mode: 'translate' | 'rotate' | 'scale'): void`

设置变换模式。

```typescript
transformManager.setMode('rotate')
```

#### `setSpace(space: 'local' | 'world'): void`

设置坐标空间。

```typescript
transformManager.setSpace('local')
```

#### `setSelectMode(enabled: boolean): void`

设置选择模式（选择模式下不显示变换控件）。

```typescript
transformManager.setSelectMode(true)
```

#### `setTranslationSnap(value: number | null): void`

设置平移吸附。

```typescript
transformManager.setTranslationSnap(0.5) // 0.5 单位吸附
```

#### `setRotationSnap(value: number | null): void`

设置旋转吸附。

```typescript
transformManager.setRotationSnap(Math.PI / 12) // 15度吸附
```

### 快捷键

- `T`: 切换到平移模式
- `R`: 切换到旋转模式
- `S`: 切换到缩放模式
- `Q`: 切换坐标空间（本地/世界）
- `ESC`: 取消选择

---

## PostProcessingManager

后处理管理器，提供 Bloom、Outline 等效果。

### 方法

#### `setBloomSettings(settings: IBloomSettings): void`

设置泛光效果。

```typescript
renderManager.postProcessingManager.setBloomSettings({
  enabled: true,
  strength: 0.5,
  radius: 0.4,
  threshold: 0.85,
})
```

#### `setOutlineSettings(settings: IOutlineSettings): void`

设置轮廓效果。

```typescript
renderManager.postProcessingManager.setOutlineSettings({
  enabled: true,
  edgeStrength: 3,
  edgeGlow: 0.5,
  edgeThickness: 1,
  pulsePeriod: 0,
  visibleEdgeColor: '#ffffff',
  hiddenEdgeColor: '#190a05',
})
```

#### `setOutlineObjects(objects: THREE.Object3D[]): void`

设置需要轮廓高亮的对象。

```typescript
renderManager.postProcessingManager.setOutlineObjects([mesh1, mesh2])
```

---

## 加载器系统

### ModelLoader

模型加载器，支持 GLB/GLTF 格式。

```typescript
import { getModelLoader } from '@lowcode3d/runtime'

const loader = getModelLoader()
const result = await loader.load('/path/to/model.glb', {
  onProgress: (progress) => {
    console.log(`加载进度: ${progress * 100}%`)
  },
})

console.log(result.scene) // THREE.Group
console.log(result.animations) // THREE.AnimationClip[]
```

### TextureLoader

纹理加载器。

```typescript
import { getTextureLoader } from '@lowcode3d/runtime'

const loader = getTextureLoader()
const texture = await loader.load('/path/to/texture.jpg')
```

---

## 材质系统

### MaterialManager

材质管理器，提供材质创建和管理功能。

```typescript
import { getMaterialManager } from '@lowcode3d/runtime'

const materialManager = getMaterialManager()

// 创建 PBR 材质
const material = materialManager.createPBRMaterial({
  color: '#ffffff',
  metalness: 0.5,
  roughness: 0.5,
  emissive: '#000000',
  emissiveIntensity: 0,
})

// 应用到对象
materialManager.applyMaterial(mesh, material)
```

### 工具函数

#### `extractMaterials(object: THREE.Object3D): THREE.Material[]`

提取对象的所有材质。

```typescript
import { extractMaterials } from '@lowcode3d/runtime'

const materials = extractMaterials(mesh)
```

#### `getPrimaryMaterial(object: THREE.Object3D): THREE.Material | null`

获取对象的主材质。

```typescript
import { getPrimaryMaterial } from '@lowcode3d/runtime'

const material = getPrimaryMaterial(mesh)
```

---

## 灯光系统

### LightManager

灯光管理器。

```typescript
import { getLightManager } from '@lowcode3d/runtime'

const lightManager = getLightManager()

// 创建平行光
const directionalLight = lightManager.createLight('directional', {
  color: '#ffffff',
  intensity: 1,
  position: { x: 10, y: 10, z: 10 },
  castShadow: true,
})

// 添加到场景
sceneManager.addObject(directionalLight)
```

支持的灯光类型：

- `ambient`: 环境光
- `directional`: 平行光
- `point`: 点光源
- `spot`: 聚光灯
- `hemisphere`: 半球光

---

## 历史记录系统

### HistoryManager

历史记录管理器，支持撤销/重做。

```typescript
import { getHistoryManager } from '@lowcode3d/runtime'

const historyManager = getHistoryManager()

// 撤销
historyManager.undo()

// 重做
historyManager.redo()

// 清空历史
historyManager.clear()

// 通过 EventBus 监听历史变化
eventBus.on('history:changed', (payload) => {
  console.log('可撤销:', payload.canUndo)
  console.log('可重做:', payload.canRedo)
})
```

### 自定义命令

```typescript
import { BaseCommand } from '@lowcode3d/runtime'

class MyCommand extends BaseCommand {
  execute(): void {
    // 执行操作
  }

  undo(): void {
    // 撤销操作
  }

  redo(): void {
    // 重做操作
  }
}

// 执行命令
const command = new MyCommand()
historyManager.execute(command)
```

---

## 辅助工具系统

### HelperManager

辅助对象管理器。

```typescript
import { getHelperManager } from '@lowcode3d/runtime'

const helperManager = getHelperManager()

// 显示/隐藏网格
helperManager.setGridVisible(true)

// 显示/隐藏坐标轴
helperManager.setAxesVisible(true)

// 显示/隐藏视图辅助器
helperManager.setViewHelperVisible(true)
```

### HotkeyManager

快捷键管理器。

```typescript
import { getHotkeyManager } from '@lowcode3d/runtime'

const hotkeyManager = getHotkeyManager()

// 注册快捷键
hotkeyManager.register('ctrl+s', () => {
  console.log('保存')
})

// 注销快捷键
hotkeyManager.unregister('ctrl+s')
```

### SnappingManager

吸附管理器。

```typescript
import { getSnappingManager, SNAPPING_PRESETS } from '@lowcode3d/runtime'

const snappingManager = getSnappingManager()

// 应用预设
snappingManager.applyPreset(SNAPPING_PRESETS.METRIC)

// 自定义吸附
snappingManager.setConfig({
  translation: 0.5,
  rotation: Math.PI / 12,
  scale: 0.1,
})
```

---

## 事件系统

引擎通过强类型 **EventBus** 进行事件通信。所有事件都有严格的 TypeScript payload 类型定义。

> 完整的事件列表和用法详见 [事件系统指南](/guide/event-system)。

### 导入

```typescript
import { eventBus, EventNames } from '@lowcode3d/runtime'
import type { SelectionChangedPayload, ObjectAddedPayload } from '@lowcode3d/runtime'
```

### scene:selection-changed

选择变化事件。

```typescript
eventBus.on('scene:selection-changed', (payload) => {
  console.log('选中对象:', payload.selected)
  console.log('新增:', payload.added)
  console.log('移除:', payload.removed)
})
```

### scene:object-added

对象添加事件。

```typescript
eventBus.on('scene:object-added', (payload) => {
  console.log('添加对象:', payload.object.name)
  console.log('元数据:', payload.metadata)
})
```

### scene:object-removed

对象移除事件。

```typescript
eventBus.on('scene:object-removed', (payload) => {
  console.log('移除对象:', payload.id)
})
```

### history:changed

历史记录变化事件。

```typescript
eventBus.on('history:changed', (payload) => {
  console.log('可撤销:', payload.canUndo)
  console.log('可重做:', payload.canRedo)
  console.log('撤销操作:', payload.undoName)
})
```

### 其他事件

| 事件名                    | 说明             |
| ------------------------- | ---------------- |
| `scene:transform-changed` | 对象变换完成     |
| `scene:property-changed`  | 对象属性修改     |
| `scene:loaded`            | 场景数据加载完成 |
| `editor:mode-changed`     | 编辑模式切换     |
| `viewport:resize`         | 视口尺寸变化     |
| `editor:snapping-changed` | 吸附配置变化     |
| `material:apply-preset`   | 应用材质预设     |
| `camera:changed`          | 相机切换         |

### 调试模式

```typescript
eventBus.setDebug(true)
```

---

## 类型定义

```typescript
import type {
  // 核心
  IEngine,
  IEngineConfig,
  ISceneManager,
  IRenderManager,
  ICameraManager,

  // 对象
  IObjectEntry,
  ISceneObject,
  IMeshOptions,

  // 交互
  ISelectionEvent,
  ISelectionManagerConfig,
  TransformMode,
  ITransformEvent,
  ITransformManagerConfig,

  // 后处理
  IBloomSettings,
  IOutlineSettings,
  IPostProcessingSettings,

  // 材质
  IPBRMaterialProps,
  TextureSlot,
  ITextureInfo,
  IMaterialInfo,

  // 灯光
  LightType,
  ILightOptions,
  ILightProps,

  // 历史
  ICommand,
  IHistoryChangeEvent,
  IHistoryManagerConfig,

  // 辅助
  IHelperConfig,
  IHotkeyConfig,
  HotkeyHandler,
  ISnappingConfig,
  SnappingPreset,

  // 加载器
  IModelLoadOptions,
  IModelLoadResult,
  LoadProgressCallback,
  ITextureLoadOptions,

  // 通用
  IVector3,
} from '@lowcode3d/runtime'
```

---

## 完整示例

### 创建自定义 3D 查看器

```typescript
import { LowCode3DViewer, eventBus } from '@lowcode3d/runtime'
import type { IProjectData } from '@lowcode3d/shared'
import type { SelectionChangedPayload } from '@lowcode3d/runtime'

class My3DViewer {
  private viewer: LowCode3DViewer
  private container: HTMLElement

  constructor(container: HTMLElement) {
    this.container = container
    this.viewer = new LowCode3DViewer(container)
  }

  async init() {
    await this.viewer.init({
      backgroundColor: '#1a1a1a',
      enableShadows: true,
      antialias: true,
      pixelRatio: window.devicePixelRatio,
    })

    // 通过 EventBus 监听选择变化
    eventBus.on('scene:selection-changed', this.onSelectionChange)

    // 监听窗口大小变化
    window.addEventListener('resize', this.onResize)
  }

  async loadScene(data: IProjectData) {
    await this.viewer.loadScene(data)
  }

  private onSelectionChange = (payload: SelectionChangedPayload) => {
    console.log('选中对象:', payload.selected)
  }

  private onResize = () => {
    this.viewer.engine.resize()
  }

  dispose() {
    eventBus.off('scene:selection-changed', this.onSelectionChange)
    window.removeEventListener('resize', this.onResize)
    this.viewer.dispose()
  }
}

// 使用
const viewer = new My3DViewer(document.getElementById('viewer'))
await viewer.init()
await viewer.loadScene(sceneData)
```

### 直接使用 Engine

```typescript
import { Engine, eventBus } from '@lowcode3d/runtime'
import * as THREE from 'three'

const engine = Engine.getInstance()

// 初始化
engine.init({
  container: document.getElementById('viewer'),
  backgroundColor: '#1a1a1a',
  enableShadows: true,
})

// 添加自定义对象
const geometry = new THREE.BoxGeometry(1, 1, 1)
const material = new THREE.MeshStandardMaterial({ color: '#ff0000' })
const cube = new THREE.Mesh(geometry, material)
cube.userData.selectable = true

engine.addObject(cube, {
  name: 'MyCube',
  type: 'mesh',
})

// 通过 EventBus 监听选择
eventBus.on('scene:selection-changed', (payload) => {
  if (payload.selected.length > 0) {
    console.log('选中:', payload.selected[0].name)
  }
})

// 响应窗口大小
window.addEventListener('resize', () => {
  engine.resize()
})
```

---

## 最佳实践

### 1. 资源管理

始终在不需要时释放资源：

```typescript
// 移除对象时会自动释放资源
engine.removeObject(mesh)

// 销毁引擎时释放所有资源
engine.dispose()
```

### 2. 性能优化

```typescript
// 使用合适的像素比率
engine.renderManager.setPixelRatio(Math.min(window.devicePixelRatio, 2))

// 按需启用阴影
engine.renderManager.enableShadows(true)

// 控制后处理效果
engine.renderManager.postProcessingManager.setBloomSettings({
  enabled: true,
  strength: 0.3, // 降低强度以提升性能
})
```

### 3. 对象标记

使用 `userData` 标记对象属性：

```typescript
mesh.userData.selectable = true // 可选择
mesh.userData.locked = false // 未锁定
mesh.userData.customData = {
  /* 自定义数据 */
}
```

### 4. 事件监听

使用 EventBus 而不是轮询：

```typescript
// ✅ 好的做法：通过 EventBus 监听
eventBus.on('scene:selection-changed', handler)

// ❌ 避免轮询
setInterval(() => {
  const selected = engine.selectionManager.getSelected()
  // ...
}, 100)

// ❌ 避免使用 window 事件（已废弃）
window.addEventListener('engine:selection-changed', handler)
```

### 5. 错误处理

```typescript
try {
  await viewer.loadScene(sceneData)
} catch (error) {
  console.error('加载场景失败:', error)
  // 显示错误提示
}
```

---

## 常见问题

### Q: 如何禁用对象选择？

```typescript
// 方法1: 禁用选择管理器
engine.selectionManager.setEnabled(false)

// 方法2: 标记对象为不可选择
mesh.userData.selectable = false
```

### Q: 如何自定义变换控件样式？

```typescript
const controls = engine.transformManager.controls
controls.setSize(1.5) // 调整大小
```

### Q: 如何实现相机动画？

```typescript
import { gsap } from 'gsap'

const camera = engine.cameraManager.camera
gsap.to(camera.position, {
  x: 10,
  y: 10,
  z: 10,
  duration: 1,
  onUpdate: () => {
    camera.lookAt(0, 0, 0)
  },
})
```

### Q: 如何获取场景中的所有对象？

```typescript
const allObjects = engine.objectManager.getAll()
allObjects.forEach((entry) => {
  console.log(entry.object.name, entry.metadata)
})
```

---

## 更多资源

- [Vue3 组件文档](./vue3.md)
- [React 组件文档](./react.md)
- [示例代码](../examples/)
- [GitHub 仓库](https://github.com/your-repo/lowcode3d)
