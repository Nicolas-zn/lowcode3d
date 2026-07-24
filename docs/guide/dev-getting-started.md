# 二次开发：快速上手

本指南面向希望基于 LowCode3D Runtime 进行二次开发的前端开发者，帮助你快速将 3D 场景集成到业务系统中，并实现自定义交互。

## 开发模式选择

根据业务需求，有三种集成方式：

| 方式                | 适合场景         | 开发量 | 自由度 |
| ------------------- | ---------------- | ------ | ------ |
| **Vue3/React 组件** | 快速展示场景     | 最小   | 低     |
| **Runtime SDK**     | 自定义交互和 UI  | 中等   | 中     |
| **Engine 直接调用** | 深度定制引擎行为 | 较大   | 高     |

## 方式一：Vue3 组件集成

最快的方式，几行代码即可展示 3D 场景：

```vue
<template>
  <LowCode3DViewer
    :scene-data="sceneData"
    :model-mappings="modelMappings"
    @scene-loaded="onLoaded"
    @click="onClick"
  />
</template>

<script setup lang="ts">
import { LowCode3DViewer } from '@lowcode3d/vue3'
import sceneData from './scene.json'

const modelMappings = {
  origin_building: '/models/building.glb',
}

function onLoaded(manager) {
  console.log('场景加载完成')
}

function onClick(object) {
  if (object) {
    console.log('点击了:', object.name)
  }
}
</script>
```

## 方式二：Runtime SDK

需要自定义 UI 或更复杂的交互时：

```typescript
import { LowCode3DViewer, eventBus } from '@lowcode3d/runtime'
import type { SelectionChangedPayload } from '@lowcode3d/runtime'

const container = document.getElementById('viewer')!
const viewer = new LowCode3DViewer(container)

await viewer.init({
  backgroundColor: '#1a1a1a',
  enableShadows: true,
  antialias: true,
  pixelRatio: window.devicePixelRatio,
})

await viewer.loadScene(sceneData)

eventBus.on('scene:selection-changed', (payload: SelectionChangedPayload) => {
  if (payload.selected.length > 0) {
    showInfoPanel(payload.selected[0])
  }
})
```

## 方式三：Engine 直接调用

需要深度控制引擎行为时：

```typescript
import { Engine, eventBus } from '@lowcode3d/runtime'
import * as THREE from 'three'

const engine = Engine.getInstance()

engine.init({
  container: document.getElementById('viewer')!,
  backgroundColor: '#1a1a1a',
  enableShadows: true,
  antialias: true,
  pixelRatio: window.devicePixelRatio,
})

// 直接访问各子管理器
const { sceneManager, objectManager, selectionManager, cameraManager, renderManager } = engine
```

## 获取场景数据

二次开发的第一步是从编辑器获取场景数据：

1. 在 [editor3d](https://editor3d.nicowebgl.cn) 中搭建 3D 场景
2. 点击 **导出** 按钮，下载 `scene.json`
3. 在项目中导入该文件

```typescript
import sceneData from './scene.json'
```

场景数据的完整格式说明见 [场景数据](/guide/scene-data)。

## 模型映射

编辑器中使用的模型存储在云端，实际部署时需要映射到本地资源：

```typescript
const modelMappings = {
  origin_xxx: '/assets/models/building.glb',
  origin_yyy: '/assets/models/tree.glb',
}
```

详见 [模型映射](/guide/model-mapping)。

## 环境准备

### 安装依赖

::: code-group

```bash [npm]
npm install @lowcode3d/runtime three
```

```bash [pnpm]
pnpm add @lowcode3d/runtime three
```

:::

### TypeScript 配置

SDK 提供完整的类型定义，推荐在 `tsconfig.json` 中启用严格模式：

```json
{
  "compilerOptions": {
    "strict": true,
    "moduleResolution": "bundler"
  }
}
```

### 导入类型

```typescript
import type {
  IProjectData,
  ISceneObject,
  IEngineConfig,
  SelectionChangedPayload,
  HistoryChangedPayload,
  ObjectAddedPayload,
} from '@lowcode3d/runtime'
```

## 下一步

- [交互开发](/guide/dev-interaction) - 选择、高亮、聚焦、数据绑定
- [场景操控](/guide/dev-scene-ops) - 动态添加/删除对象、材质修改、相机控制
- [高级定制](/guide/dev-advanced) - 自定义命令、扩展事件、后处理效果
