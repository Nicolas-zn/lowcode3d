# 基础用法

基础集成示例。

## Vue 3 完整示例

```vue
<template>
  <div class="viewer-container">
    <LowCode3DViewer
      ref="viewerRef"
      :scene-data="sceneData"
      :model-mappings="modelMappings"
      @scene-loaded="onLoaded"
      @click="onClick"
    />

    <div v-if="selectedObject" class="info-panel">
      <h3>{{ selectedObject.name }}</h3>
      <p>位置: {{ formatPosition(selectedObject.position) }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { LowCode3DViewer } from '@lowcode3d/vue3'
import type { Object3D } from 'three'
import sceneData from './scene.json'

const viewerRef = ref()
const selectedObject = ref<Object3D | null>(null)

const modelMappings = {
  origin_building: '/models/building.glb',
  origin_tree: '/models/tree.glb',
}

function onLoaded(manager) {
  console.log('场景加载完成')
  // 可以在这里做初始化操作
}

function onClick(object: Object3D | null) {
  selectedObject.value = object
}

function formatPosition(pos: THREE.Vector3) {
  return `(${pos.x.toFixed(2)}, ${pos.y.toFixed(2)}, ${pos.z.toFixed(2)})`
}
</script>

<style scoped>
.viewer-container {
  position: relative;
  width: 100%;
  height: 100vh;
}

.info-panel {
  position: absolute;
  top: 20px;
  right: 20px;
  background: rgba(0, 0, 0, 0.7);
  color: white;
  padding: 16px;
  border-radius: 8px;
}
</style>
```

## React 完整示例

```tsx
import { useState, useRef } from 'react'
import { LowCode3DViewer, LowCode3DViewerRef } from '@lowcode3d/react'
import type { Object3D } from 'three'
import sceneData from './scene.json'

function App() {
  const viewerRef = useRef<LowCode3DViewerRef>(null)
  const [selectedObject, setSelectedObject] = useState<Object3D | null>(null)

  const modelMappings = {
    origin_building: '/models/building.glb',
  }

  return (
    <div style={{ position: 'relative', width: '100%', height: '100vh' }}>
      <LowCode3DViewer
        ref={viewerRef}
        sceneData={sceneData}
        modelMappings={modelMappings}
        onClick={setSelectedObject}
      />

      {selectedObject && (
        <div className="info-panel">
          <h3>{selectedObject.name}</h3>
        </div>
      )}
    </div>
  )
}
```

## Runtime 完整示例

```typescript
import { createSceneManager } from '@lowcode3d/runtime'

async function init() {
  const container = document.getElementById('viewer')!

  const manager = createSceneManager({
    container,
    width: window.innerWidth,
    height: window.innerHeight,
  })

  // 加载场景
  await manager.loadScene(sceneData, {
    modelMappings: {
      origin_id: '/models/local.glb',
    },
    onProgress: (p) => {
      document.getElementById('progress')!.textContent = `${(p * 100).toFixed(0)}%`
    },
  })

  // 事件监听
  manager.on('click', (obj) => {
    if (obj) {
      showInfoPanel(obj)
    }
  })

  // 开始渲染
  manager.start()

  // 响应窗口大小变化
  window.addEventListener('resize', () => {
    manager.resize(window.innerWidth, window.innerHeight)
  })
}

init()
```
