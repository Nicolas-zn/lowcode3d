# React 组件

`@lowcode3d/react` 提供 React 组件封装。

## 安装

```bash
npm install @lowcode3d/react
```

## LowCode3DViewer

主要的场景渲染组件。

### 基础用法

```tsx
import { LowCode3DViewer } from '@lowcode3d/react'
import sceneData from './scene.json'

function App() {
  const modelMappings = {
    origin_id: '/models/local.glb',
  }

  return (
    <LowCode3DViewer
      sceneData={sceneData}
      modelMappings={modelMappings}
      width={800}
      height={600}
      onSceneLoaded={(manager) => console.log('Loaded', manager)}
      onClick={(object) => console.log('Clicked', object?.name)}
      onError={(error) => console.error(error)}
    />
  )
}
```

### Props

| 属性          | 类型                                 | 默认值   | 说明           |
| ------------- | ------------------------------------ | -------- | -------------- |
| sceneData     | `IProjectData`                       | 必填     | 场景 JSON 数据 |
| modelMappings | `Record<string, string>`             | `{}`     | 模型映射       |
| width         | `number \| string`                   | `'100%'` | 容器宽度       |
| height        | `number \| string`                   | `'100%'` | 容器高度       |
| autoRotate    | `boolean`                            | `false`  | 自动旋转       |
| onSceneLoaded | `(manager: SceneManager) => void`    | -        | 加载完成回调   |
| onClick       | `(object: Object3D \| null) => void` | -        | 点击回调       |
| onHover       | `(object: Object3D \| null) => void` | -        | 悬停回调       |
| onError       | `(error: Error) => void`             | -        | 错误回调       |

### Ref 访问

```tsx
import { useRef } from 'react'
import { LowCode3DViewer, LowCode3DViewerRef } from '@lowcode3d/react'

function App() {
  const viewerRef = useRef<LowCode3DViewerRef>(null)

  const handleClick = () => {
    const manager = viewerRef.current?.getManager()
    const scene = manager?.getScene()
    console.log(scene)
  }

  return (
    <>
      <LowCode3DViewer ref={viewerRef} sceneData={sceneData} />
      <button onClick={handleClick}>获取场景</button>
    </>
  )
}
```

### Hooks

```tsx
import { useScene3D } from '@lowcode3d/react'

function MyComponent() {
  const { manager, isLoading, error } = useScene3D(containerRef, {
    sceneData,
    modelMappings,
  })

  if (isLoading) return <div>加载中...</div>
  if (error) return <div>错误: {error.message}</div>

  return <div ref={containerRef} />
}
```

## TypeScript

```typescript
import type { LowCode3DViewerProps, LowCode3DViewerRef } from '@lowcode3d/react'
```
