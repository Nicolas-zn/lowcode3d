# 事件交互

基于 EventBus 的事件监听和交互示例。

## 监听选择变化

```typescript
import { eventBus } from '@/engine/events'

eventBus.on('scene:selection-changed', (payload) => {
  if (payload.selected.length > 0) {
    const object = payload.selected[0]
    console.log('选中了:', object.name)

    showInfoPanel({
      name: object.name,
      position: object.position.toArray(),
      userData: object.userData,
    })
  } else {
    clearSelection()
  }
})
```

## 监听对象添加/移除

```typescript
eventBus.on('scene:object-added', (payload) => {
  console.log('添加对象:', payload.object.name)
  updateSceneTree()
})

eventBus.on('scene:object-removed', (payload) => {
  console.log('移除对象:', payload.id)
  updateSceneTree()
})
```

## 监听变换完成

```typescript
eventBus.on('scene:transform-changed', (payload) => {
  if (payload.objectId) {
    console.log('变换完成:', payload.objectId)
    refreshPropertyPanel()
  }
})
```

## 监听历史记录

```typescript
eventBus.on('history:changed', (payload) => {
  undoButton.disabled = !payload.canUndo
  redoButton.disabled = !payload.canRedo
  undoButton.title = payload.undoName ? `撤销: ${payload.undoName}` : '撤销'
  redoButton.title = payload.redoName ? `重做: ${payload.redoName}` : '重做'
})
```

## 分类处理选中对象

```typescript
eventBus.on('scene:selection-changed', (payload) => {
  if (payload.selected.length === 0) return
  const object = payload.selected[0]
  const type = object.userData.type

  switch (type) {
    case 'building':
      showBuildingInfo(object)
      break
    case 'equipment':
      showEquipmentPanel(object)
      break
    case 'sensor':
      showSensorData(object)
      break
    default:
      showDefaultInfo(object)
  }
})
```

## Vue 3 组合式 API

```vue
<template>
  <div class="editor">
    <CanvasPanel />
    <div v-if="selectedObject" class="info-panel">
      <h3>{{ selectedObject.name }}</h3>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { eventBus } from '@/engine/events'
import type { SelectionChangedPayload } from '@/engine/events'
import type { Object3D } from 'three'

const selectedObject = ref<Object3D | null>(null)

function handleSelection(payload: SelectionChangedPayload) {
  selectedObject.value = payload.selected[0] ?? null
}

onMounted(() => {
  eventBus.on('scene:selection-changed', handleSelection)
})

onBeforeUnmount(() => {
  eventBus.off('scene:selection-changed', handleSelection)
})
</script>
```

## SDK 组件回调 (Vue 3)

```vue
<template>
  <LowCode3DViewer
    :scene-data="sceneData"
    @scene-loaded="onLoaded"
    @click="onClick"
    @hover="onHover"
  />
</template>

<script setup>
function onLoaded(manager) {
  console.log('场景加载完成')
}

function onClick(object) {
  if (object) {
    console.log('点击:', object.name)
  }
}

function onHover(object) {
  document.body.style.cursor = object ? 'pointer' : 'default'
}
</script>
```

## SDK 组件回调 (React)

```tsx
function useSceneInteraction(manager: SceneManager | null) {
  const [selected, setSelected] = useState<Object3D | null>(null)
  const [hovered, setHovered] = useState<Object3D | null>(null)

  useEffect(() => {
    if (!manager) return

    const handleClick = (obj: Object3D | null) => setSelected(obj)
    const handleHover = (obj: Object3D | null) => setHovered(obj)

    manager.on('click', handleClick)
    manager.on('hover', handleHover)

    return () => {
      manager.off('click', handleClick)
      manager.off('hover', handleHover)
    }
  }, [manager])

  return { selected, hovered }
}
```
