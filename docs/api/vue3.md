# Vue3 组件

`@lowcode3d/vue3` 提供开箱即用的 Vue 3 组件。

## 安装

```bash
npm install @lowcode3d/vue3
```

## LowCode3DViewer

主要的场景渲染组件。

### 基础用法

```vue
<template>
  <LowCode3DViewer
    :scene-data="sceneData"
    :model-mappings="modelMappings"
    :width="800"
    :height="600"
    @scene-loaded="onLoaded"
    @click="onClick"
    @error="onError"
  />
</template>

<script setup>
import { LowCode3DViewer } from '@lowcode3d/vue3'
import sceneData from './scene.json'

const modelMappings = {
  origin_id: '/models/local.glb',
}

function onLoaded(manager) {
  console.log('场景加载完成', manager)
}

function onClick(object) {
  console.log('点击对象', object?.name)
}

function onError(error) {
  console.error('加载错误', error)
}
</script>
```

### Props

| 属性          | 类型                     | 默认值   | 说明                  |
| ------------- | ------------------------ | -------- | --------------------- |
| sceneData     | `IProjectData`           | 必填     | 场景 JSON 数据        |
| modelMappings | `Record<string, string>` | `{}`     | 模型 ID 到 URL 的映射 |
| width         | `number \| string`       | `'100%'` | 容器宽度              |
| height        | `number \| string`       | `'100%'` | 容器高度              |
| autoRotate    | `boolean`                | `false`  | 是否自动旋转          |
| showStats     | `boolean`                | `false`  | 显示性能统计          |

### Events

| 事件         | 参数                         | 说明         |
| ------------ | ---------------------------- | ------------ |
| scene-loaded | `(manager: SceneManager)`    | 场景加载完成 |
| click        | `(object: Object3D \| null)` | 点击事件     |
| hover        | `(object: Object3D \| null)` | 悬停事件     |
| error        | `(error: Error)`             | 错误事件     |

### Expose

通过 ref 访问组件实例：

```vue
<template>
  <LowCode3DViewer ref="viewerRef" :scene-data="sceneData" />
</template>

<script setup>
import { ref } from 'vue'

const viewerRef = ref()

// 获取 SceneManager
const manager = viewerRef.value?.getManager()

// 获取 Three.js 对象
const scene = manager?.getScene()
</script>
```

| 方法         | 返回值         | 说明           |
| ------------ | -------------- | -------------- |
| getManager() | `SceneManager` | 获取场景管理器 |

## 类型定义

```typescript
import type { LowCode3DViewerProps, LowCode3DViewerExpose } from '@lowcode3d/vue3'
```
