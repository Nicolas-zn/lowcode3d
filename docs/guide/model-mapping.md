# 模型映射

将云端模型替换为本地资源。

## 为什么需要模型映射？

编辑器中使用的模型通常存储在云端，但实际部署时可能需要：

- 使用本地 CDN 加速
- 替换为优化后的模型
- 使用私有存储

## 使用方式

```typescript
// 场景数据中的 origin.models
// [{ id: "origin_xxx", url: "https://cloud.com/model.glb" }]

// 映射配置
const modelMappings = {
  'origin_xxx': '/assets/models/local-model.glb'
}

// 传入组件
<LowCode3DViewer
  :scene-data="sceneData"
  :model-mappings="modelMappings"
/>
```

## 映射规则

| 场景   | 行为               |
| ------ | ------------------ |
| 有映射 | 使用映射的本地路径 |
| 无映射 | 使用原始 URL       |

## 批量映射

```typescript
// 根据规则批量生成映射
const modelMappings = {}

sceneData.origin.models.forEach((model) => {
  // 将云端 URL 替换为本地路径
  const filename = model.url.split('/').pop()
  modelMappings[model.id] = `/assets/models/${filename}`
})
```

## 动态加载

```typescript
async function loadWithLocalModels(sceneData) {
  const mappings = {}

  for (const model of sceneData.origin.models) {
    // 检查本地是否存在
    const localPath = `/models/${model.id}.glb`
    const exists = await checkFileExists(localPath)

    if (exists) {
      mappings[model.id] = localPath
    }
  }

  return mappings
}
```

## 注意事项

::: tip 提示
模型映射只替换 URL，不改变场景中的任何其他属性（位置、旋转、材质等）。
:::

::: warning 注意
确保本地模型与原模型的结构一致，否则材质覆盖可能无法正确应用。
:::
