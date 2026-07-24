# 二次开发：交互开发

本节介绍如何在二次开发中实现对象选择、高亮、聚焦、数据绑定等交互功能。

## 对象选择

### 监听选择变化

通过 EventBus 监听用户在 3D 视口中的选择操作：

```typescript
import { eventBus } from '@lowcode3d/runtime'

eventBus.on('scene:selection-changed', (payload) => {
  const { selected, added, removed } = payload

  if (selected.length > 0) {
    const object = selected[0]
    console.log('选中:', object.name, object.uuid)
    console.log('位置:', object.position.toArray())
    console.log('自定义数据:', object.userData)
  } else {
    console.log('取消选择')
  }
})
```

### 编程式选择

通过 SelectionManager API 实现编程式选择：

```typescript
const engine = Engine.getInstance()
const { selectionManager, objectManager } = engine

// 选中单个对象
const object = objectManager.getObject('some-uuid')
if (object) {
  selectionManager.select(object)
}

// 多选
selectionManager.addToSelection(object1)
selectionManager.addToSelection(object2)

// 切换选择状态（选中则取消，未选中则添加）
selectionManager.toggleSelection(object)

// 清空选择
selectionManager.clearSelection()

// 获取当前选中对象
const selected = selectionManager.getSelected()

// 按 UUID 选择
selectionManager.selectByUUID('object-uuid')

// 禁用/启用选择
selectionManager.setEnabled(false)
```

## 对象查找

### 按 UUID 查找

```typescript
const object = objectManager.getObject('object-uuid')
const metadata = objectManager.getMetadata('object-uuid')
const entry = objectManager.get('object-uuid') // { object, metadata }
```

### 按名称查找

```typescript
const scene = engine.sceneManager.scene
const object = scene.getObjectByName('MyBuilding')
```

### 遍历所有对象

```typescript
const allEntries = objectManager.getAll()
for (const entry of allEntries) {
  console.log(entry.metadata.name, entry.metadata.type, entry.object.position)
}
```

### 获取可选择对象

```typescript
const selectables = objectManager.getSelectables()
```

## 对象高亮

### 通过轮廓高亮

利用后处理的 Outline 效果高亮对象：

```typescript
const postProcessing = engine.renderManager.postProcessingManager

// 设置轮廓效果参数
postProcessing.setOutlineSettings({
  enabled: true,
  edgeStrength: 3,
  edgeGlow: 0.5,
  edgeThickness: 1,
  visibleEdgeColor: '#00ff00',
  hiddenEdgeColor: '#190a05',
})

// 设置需要高亮的对象
postProcessing.setOutlineObjects([mesh1, mesh2])
```

### 通过材质高亮

直接修改材质实现自定义高亮效果：

```typescript
import * as THREE from 'three'

function highlightObject(object: THREE.Object3D) {
  object.traverse((child) => {
    if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial) {
      child.userData._originalEmissive = child.material.emissive.getHex()
      child.userData._originalEmissiveIntensity = child.material.emissiveIntensity
      child.material.emissive.setHex(0x333333)
      child.material.emissiveIntensity = 1.0
    }
  })
}

function unhighlightObject(object: THREE.Object3D) {
  object.traverse((child) => {
    if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial) {
      if (child.userData._originalEmissive !== undefined) {
        child.material.emissive.setHex(child.userData._originalEmissive)
        child.material.emissiveIntensity = child.userData._originalEmissiveIntensity
      }
    }
  })
}
```

## 相机聚焦

### 聚焦到对象

```typescript
engine.cameraManager.focusOn(object)
```

### 平滑飞行到目标

```typescript
import * as THREE from 'three'

function flyTo(targetPosition: THREE.Vector3, lookAt: THREE.Vector3, duration = 1000) {
  const camera = engine.cameraManager.camera
  const controls = engine.cameraManager.controls

  const startPos = camera.position.clone()
  const startTarget = controls.target.clone()
  const startTime = performance.now()

  function animate() {
    const elapsed = performance.now() - startTime
    const t = Math.min(elapsed / duration, 1)
    const eased = 1 - Math.pow(1 - t, 3) // easeOutCubic

    camera.position.lerpVectors(startPos, targetPosition, eased)
    controls.target.lerpVectors(startTarget, lookAt, eased)
    controls.update()

    if (t < 1) {
      requestAnimationFrame(animate)
    }
  }

  animate()
}

// 使用
flyTo(new THREE.Vector3(10, 8, 10), new THREE.Vector3(0, 0, 0), 1500)
```

### 相机预设视角

```typescript
eventBus.emit('camera:changed', { preset: 'front' })
eventBus.emit('camera:changed', { preset: 'top' })
eventBus.emit('camera:changed', { type: 'orthographic' })
```

## 业务数据绑定

### 在 userData 中存储业务数据

编辑器中的每个对象都有 `userData` 字段，可以存储自定义业务数据。在编辑器中设置后，数据会随场景 JSON 一起导出：

```typescript
// 遍历场景对象，根据 userData 绑定业务数据
eventBus.on('scene:loaded', () => {
  const allObjects = objectManager.getAll()

  for (const entry of allObjects) {
    const { object, metadata } = entry
    const deviceId = object.userData.deviceId

    if (deviceId) {
      fetchDeviceData(deviceId).then((data) => {
        updateDeviceStatus(object, data)
      })
    }
  }
})
```

### 根据对象类型分类处理

```typescript
eventBus.on('scene:selection-changed', (payload) => {
  if (payload.selected.length === 0) return
  const object = payload.selected[0]

  switch (object.userData.type) {
    case 'device':
      showDevicePanel(object.userData.deviceId)
      break
    case 'area':
      showAreaStatistics(object.userData.areaId)
      break
    case 'sensor':
      showSensorChart(object.userData.sensorId)
      break
    default:
      showObjectInfo(object)
  }
})
```

### 实时数据驱动

通过 WebSocket 接收实时数据，驱动 3D 场景中的对象状态：

```typescript
const ws = new WebSocket('wss://api.example.com/realtime')

ws.onmessage = (event) => {
  const data = JSON.parse(event.data)

  const object = objectManager.getObject(data.objectId)
  if (!object) return

  switch (data.type) {
    case 'temperature':
      updateHeatColor(object, data.value)
      break
    case 'status':
      updateStatusLight(object, data.value)
      break
    case 'position':
      object.position.set(data.x, data.y, data.z)
      objectManager.updateTransform(object.uuid)
      break
  }
}

function updateHeatColor(object: THREE.Object3D, temperature: number) {
  object.traverse((child) => {
    if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial) {
      const t = Math.min(temperature / 100, 1)
      child.material.color.setHSL(0.6 - t * 0.6, 1, 0.5) // 蓝→红
      child.material.needsUpdate = true
    }
  })
}
```

## Vue 3 集成示例

完整的 Vue 3 交互集成示例：

```vue
<template>
  <div class="viewer-container">
    <div id="viewer-canvas" ref="canvasRef" />

    <div v-if="selectedDevice" class="device-panel">
      <h3>{{ selectedDevice.name }}</h3>
      <p>状态: {{ selectedDevice.status }}</p>
      <p>温度: {{ selectedDevice.temperature }}°C</p>
      <el-button @click="focusOnDevice">聚焦</el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { Engine, eventBus } from '@lowcode3d/runtime'
import type { SelectionChangedPayload } from '@lowcode3d/runtime'

const canvasRef = ref<HTMLElement>()
const selectedDevice = ref<{ name: string; status: string; temperature: number } | null>(null)

let engine: Engine

function handleSelection(payload: SelectionChangedPayload) {
  if (payload.selected.length === 0) {
    selectedDevice.value = null
    return
  }

  const object = payload.selected[0]
  if (object.userData.deviceId) {
    fetchDeviceInfo(object.userData.deviceId)
  }
}

async function fetchDeviceInfo(deviceId: string) {
  const res = await fetch(`/api/devices/${deviceId}`)
  selectedDevice.value = await res.json()
}

function focusOnDevice() {
  const selected = engine.selectionManager.getSelected()
  if (selected.length > 0) {
    engine.cameraManager.focusOn(selected[0])
  }
}

onMounted(async () => {
  engine = Engine.getInstance()
  engine.init({
    container: canvasRef.value!,
    backgroundColor: '#1a1a1a',
    enableShadows: true,
  })

  eventBus.on('scene:selection-changed', handleSelection)
})

onBeforeUnmount(() => {
  eventBus.off('scene:selection-changed', handleSelection)
  Engine.destroyInstance()
})
</script>
```

## 下一步

- [场景操控](/guide/dev-scene-ops) - 动态添加/删除对象、材质修改
- [高级定制](/guide/dev-advanced) - 自定义命令、扩展事件、后处理效果
