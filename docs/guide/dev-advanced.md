# 二次开发：高级定制

本节介绍自定义命令、扩展事件系统、后处理效果、动画等高级开发内容。

## 自定义命令与撤销/重做

所有需要撤销的操作都应封装为 Command，通过 HistoryManager 执行。

### 创建自定义命令

```typescript
import { BaseCommand, getHistoryManager } from '@lowcode3d/runtime'
import * as THREE from 'three'

class SetVisibilityCommand extends BaseCommand {
  readonly name: string
  private object: THREE.Object3D
  private oldVisible: boolean
  private newVisible: boolean

  constructor(object: THREE.Object3D, visible: boolean) {
    super()
    this.name = `${visible ? '显示' : '隐藏'} ${object.name}`
    this.object = object
    this.oldVisible = object.visible
    this.newVisible = visible
  }

  execute(): void {
    this.object.visible = this.newVisible
  }

  undo(): void {
    this.object.visible = this.oldVisible
  }
}

// 使用
const historyManager = getHistoryManager()
historyManager.execute(new SetVisibilityCommand(mesh, false))

// 撤销
historyManager.undo()
```

### 批量操作命令

```typescript
class BatchCommand extends BaseCommand {
  readonly name: string
  private commands: BaseCommand[]

  constructor(name: string, commands: BaseCommand[]) {
    super()
    this.name = name
    this.commands = commands
  }

  execute(): void {
    for (const cmd of this.commands) {
      cmd.execute()
    }
  }

  undo(): void {
    for (let i = this.commands.length - 1; i >= 0; i--) {
      this.commands[i].undo()
    }
  }
}

// 使用：一次性修改多个对象颜色
const commands = selectedObjects.map(
  (obj) => new ChangeColorCommand(obj, new THREE.Color('#ff0000'))
)
historyManager.execute(new BatchCommand('批量修改颜色', commands))
```

### 可合并命令

适用于连续微调操作（如拖拽滑块实时改变属性），避免产生大量历史记录：

```typescript
class SetOpacityCommand extends BaseCommand {
  readonly name = '修改透明度'
  private mesh: THREE.Mesh
  private oldOpacity: number
  private newOpacity: number

  constructor(mesh: THREE.Mesh, opacity: number) {
    super()
    this.mesh = mesh
    this.newOpacity = opacity
    this.oldOpacity = (mesh.material as THREE.MeshStandardMaterial).opacity
  }

  execute(): void {
    const mat = this.mesh.material as THREE.MeshStandardMaterial
    mat.opacity = this.newOpacity
    mat.transparent = this.newOpacity < 1
    mat.needsUpdate = true
  }

  undo(): void {
    const mat = this.mesh.material as THREE.MeshStandardMaterial
    mat.opacity = this.oldOpacity
    mat.transparent = this.oldOpacity < 1
    mat.needsUpdate = true
  }

  canMergeWith(command: ICommand): boolean {
    return command instanceof SetOpacityCommand && command.mesh === this.mesh
  }

  mergeWith(command: ICommand): void {
    if (command instanceof SetOpacityCommand) {
      this.oldOpacity = command.oldOpacity
    }
  }
}
```

## 扩展事件系统

### 添加自定义事件

在 `EventTypes.ts` 中注册新事件：

```typescript
// 1. 定义 payload
export interface DeviceAlarmPayload {
  deviceId: string
  level: 'warning' | 'critical'
  message: string
  timestamp: number
}

// 2. 注册到 EventBusEventMap
export interface EventBusEventMap {
  // ... 现有事件
  'business:device-alarm': DeviceAlarmPayload
}
```

使用：

```typescript
// 触发
eventBus.emit('business:device-alarm', {
  deviceId: 'D001',
  level: 'critical',
  message: '温度超过阈值',
  timestamp: Date.now(),
})

// 监听
eventBus.on('business:device-alarm', (payload) => {
  // payload 自动推导为 DeviceAlarmPayload
  if (payload.level === 'critical') {
    highlightDevice(payload.deviceId, '#ff0000')
    showAlarmNotification(payload.message)
  }
})
```

### 事件调试

```typescript
eventBus.setDebug(true)

// 查看某个事件的监听器数量
console.log('监听器数:', eventBus.listenerCount('scene:selection-changed'))

// 清除某个事件的所有监听器
eventBus.removeAllListeners('business:device-alarm')
```

## 后处理效果

### Bloom（泛光）

```typescript
const postProcessing = engine.renderManager.postProcessingManager

postProcessing.setBloomSettings({
  enabled: true,
  strength: 0.5,
  radius: 0.4,
  threshold: 0.85,
})
```

### Outline（轮廓）

```typescript
postProcessing.setOutlineSettings({
  enabled: true,
  edgeStrength: 3,
  edgeGlow: 0.5,
  edgeThickness: 1,
  pulsePeriod: 2, // 脉冲周期（秒），0 为不脉冲
  visibleEdgeColor: '#ffff00',
  hiddenEdgeColor: '#190a05',
})

// 动态设置需要轮廓的对象
postProcessing.setOutlineObjects([mesh1, mesh2])
```

### 根据业务状态动态切换效果

```typescript
function setAlarmMode(enabled: boolean) {
  if (enabled) {
    postProcessing.setBloomSettings({ enabled: true, strength: 1.0, threshold: 0.5 })
    postProcessing.setOutlineSettings({
      enabled: true,
      visibleEdgeColor: '#ff0000',
      pulsePeriod: 1,
    })
  } else {
    postProcessing.setBloomSettings({ enabled: false })
    postProcessing.setOutlineSettings({
      enabled: true,
      visibleEdgeColor: '#ffffff',
      pulsePeriod: 0,
    })
  }
}
```

## 动画

### 基于 requestAnimationFrame

```typescript
const clock = new THREE.Clock()

function animate() {
  const delta = clock.getDelta()
  const elapsed = clock.getElapsedTime()

  // 旋转动画
  turbine.rotation.y += delta * 2

  // 浮动动画
  indicator.position.y = Math.sin(elapsed * 2) * 0.3 + 2

  requestAnimationFrame(animate)
}

animate()
```

### 基于 GSAP

```typescript
import { gsap } from 'gsap'

// 平滑移动对象
gsap.to(object.position, {
  x: 5,
  y: 0,
  z: 0,
  duration: 2,
  ease: 'power2.inOut',
})

// 相机飞行
gsap.to(engine.cameraManager.camera.position, {
  x: 10,
  y: 10,
  z: 10,
  duration: 1.5,
  ease: 'power2.out',
  onUpdate: () => {
    engine.cameraManager.controls.update()
  },
})

// 材质渐变
gsap.to(mesh.material.color, {
  r: 1,
  g: 0,
  b: 0,
  duration: 0.5,
})
```

### 对象路径动画

```typescript
const path = new THREE.CatmullRomCurve3([
  new THREE.Vector3(0, 1, 0),
  new THREE.Vector3(5, 2, 3),
  new THREE.Vector3(10, 1, 0),
  new THREE.Vector3(5, 3, -3),
])
path.closed = true

let progress = 0
const speed = 0.1

function animateAlongPath() {
  progress = (progress + speed * clock.getDelta()) % 1
  const point = path.getPointAt(progress)
  object.position.copy(point)

  const tangent = path.getTangentAt(progress)
  object.lookAt(point.clone().add(tangent))

  requestAnimationFrame(animateAlongPath)
}

animateAlongPath()
```

## 快捷键扩展

### 注册自定义快捷键

```typescript
import { getHotkeyManager } from '@lowcode3d/runtime'

const hotkeyManager = getHotkeyManager()

hotkeyManager.register('ctrl+shift+h', () => {
  toggleAllLabels()
})

hotkeyManager.register('f', () => {
  const selected = engine.selectionManager.getSelected()
  if (selected.length > 0) {
    engine.cameraManager.focusOn(selected[0])
  }
})
```

### 注销快捷键

```typescript
hotkeyManager.unregister('ctrl+shift+h')
```

### 内置快捷键

| 快捷键         | 操作         |
| -------------- | ------------ |
| `T`            | 平移模式     |
| `R`            | 旋转模式     |
| `S`            | 缩放模式     |
| `Q`            | 切换坐标空间 |
| `Ctrl+Z`       | 撤销         |
| `Ctrl+Shift+Z` | 重做         |
| `Delete`       | 删除选中对象 |
| `Ctrl+G`       | 成组         |
| `Ctrl+Shift+G` | 解组         |
| `Escape`       | 取消选择     |

## 吸附系统

### 使用预设

```typescript
import { getSnappingManager, SNAPPING_PRESETS } from '@lowcode3d/runtime'

const snappingManager = getSnappingManager()

snappingManager.applyPreset(SNAPPING_PRESETS.METRIC)
```

### 自定义吸附参数

```typescript
snappingManager.setConfig({
  translation: 0.25, // 0.25 单位步进
  rotation: Math.PI / 24, // 7.5 度步进
  scale: 0.1,
})
```

## 完整业务示例：智慧园区

```typescript
import { Engine, eventBus, getHistoryManager, SceneSerializer } from '@lowcode3d/runtime'
import * as THREE from 'three'

class SmartCampusApp {
  private engine: Engine
  private ws: WebSocket | null = null

  constructor(container: HTMLElement) {
    this.engine = Engine.getInstance()
    this.engine.init({
      container,
      backgroundColor: '#1a1a2e',
      enableShadows: true,
      antialias: true,
      pixelRatio: Math.min(window.devicePixelRatio, 2),
    })
  }

  async loadCampus(sceneJson: string) {
    await SceneSerializer.importFromJSON(sceneJson)
    this.bindEvents()
    this.connectRealtime()
  }

  private bindEvents() {
    eventBus.on('scene:selection-changed', (payload) => {
      if (payload.selected.length > 0) {
        const obj = payload.selected[0]
        if (obj.userData.buildingId) {
          this.onBuildingSelected(obj.userData.buildingId)
        }
      }
    })
  }

  private connectRealtime() {
    this.ws = new WebSocket('wss://campus-api.example.com/ws')
    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data)
      this.handleRealtimeData(data)
    }
  }

  private handleRealtimeData(data: { type: string; targetId: string; value: number }) {
    const object = this.engine.objectManager.getObject(data.targetId)
    if (!object) return

    if (data.type === 'energy') {
      this.updateEnergyHeatmap(object, data.value)
    }
  }

  private updateEnergyHeatmap(object: THREE.Object3D, value: number) {
    const t = Math.min(value / 100, 1)
    object.traverse((child) => {
      if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial) {
        child.material.emissive.setHSL(0.3 - t * 0.3, 1, 0.2 * t)
        child.material.emissiveIntensity = t * 2
      }
    })
  }

  private onBuildingSelected(buildingId: string) {
    console.log('选中建筑:', buildingId)
  }

  dispose() {
    this.ws?.close()
    Engine.destroyInstance()
  }
}

// 初始化
const app = new SmartCampusApp(document.getElementById('campus-viewer')!)
const sceneJson = await fetch('/api/campus/scene').then((r) => r.text())
await app.loadCampus(sceneJson)
```

## 最佳实践

### 1. 资源管理

```typescript
// 移除对象时自动释放几何体和材质
engine.removeObject(mesh)

// 销毁引擎时释放所有资源
Engine.destroyInstance()
```

### 2. 性能优化

```typescript
// 限制像素比率
engine.renderManager.setPixelRatio(Math.min(window.devicePixelRatio, 2))

// 按需启用后处理
postProcessing.setBloomSettings({ enabled: false }) // 不需要时关闭

// 大场景使用 LOD
const lod = new THREE.LOD()
lod.addLevel(highDetailMesh, 0)
lod.addLevel(lowDetailMesh, 50)
engine.addObject(lod)
```

### 3. 错误处理

```typescript
try {
  await SceneSerializer.importFromJSON(json)
} catch (error) {
  console.error('加载场景失败:', error)
  showErrorNotification('场景加载失败，请检查数据格式')
}
```

### 4. 组件卸载

在 Vue/React 组件卸载时务必清理：

```typescript
// Vue 3
onBeforeUnmount(() => {
  eventBus.off('scene:selection-changed', handler)
  Engine.destroyInstance()
})

// React
useEffect(() => {
  return () => {
    eventBus.off('scene:selection-changed', handler)
    Engine.destroyInstance()
  }
}, [])
```

### 5. 使用 EventBus 而非直接轮询

```typescript
// ✅ 推荐：事件驱动
eventBus.on('scene:selection-changed', updateUI)

// ❌ 避免：轮询
setInterval(() => {
  const selected = engine.selectionManager.getSelected()
  updateUI(selected)
}, 100)
```
