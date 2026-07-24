# 快速开始

5 分钟快速集成 LowCode3D SDK。

## 安装

::: code-group

```bash [Vue 3]
npm install @lowcode3d/vue3
```

```bash [React]
npm install @lowcode3d/react
```

```bash [Runtime]
npm install @lowcode3d/runtime
```

:::

## Vue 3 示例

```vue
<template>
  <LowCode3DViewer
    :scene-data="sceneData"
    :model-mappings="modelMappings"
    @scene-loaded="onLoaded"
  />
</template>

<script setup>
import { LowCode3DViewer } from '@lowcode3d/vue3'
import sceneData from './scene.json'

const modelMappings = {
  origin_model_id: '/models/local.glb',
}

function onLoaded(manager) {
  console.log('场景加载完成')
}
</script>
```

## React 示例

```tsx
import { LowCode3DViewer } from '@lowcode3d/react'
import sceneData from './scene.json'

function App() {
  return (
    <LowCode3DViewer
      sceneData={sceneData}
      modelMappings={{ origin_id: '/models/local.glb' }}
      onSceneLoaded={(manager) => console.log('Loaded')}
    />
  )
}
```

## 获取场景数据

1. 在编辑器中设计 3D 场景
2. 点击 **导出** 按钮
3. 下载 `scene.json` 文件
4. 在项目中导入该文件

## 下一步

- [安装详解](/guide/installation)
- [场景数据格式](/guide/scene-data)
- [模型映射](/guide/model-mapping)
