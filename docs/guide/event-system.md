# 事件系统

LowCode3D 使用强类型 **EventBus** 作为全局事件总线，所有业务通信的唯一通道。禁止使用 `window.dispatchEvent` 进行跨模块通信。

## 设计理念

- **Three.js 只负责渲染**：所有业务通信走 EventBus
- **强类型**：每个事件都有对应的 TypeScript payload 类型，emit / on / off 均有编译期检查
- **解耦**：UI 层和 Engine 层通过事件解耦，互不依赖
- **常量化**：提供 `EventNames` 常量对象，避免魔法字符串

## 基础用法

### 导入

```typescript
import { eventBus, EventNames } from '@/engine/events'
```

### 订阅事件

```typescript
import type { SelectionChangedPayload } from '@/engine/events'

function handleSelectionChanged(payload: SelectionChangedPayload) {
  console.log('选中对象:', payload.selected)
}

eventBus.on('scene:selection-changed', handleSelectionChanged)
```

### 取消订阅

```typescript
eventBus.off('scene:selection-changed', handleSelectionChanged)
```

### 触发事件

```typescript
eventBus.emit('scene:object-added', {
  object: mesh,
  metadata: { name: 'MyCube', type: 'mesh' },
})
```

### 单次监听

```typescript
eventBus.once('scene:loaded', (payload) => {
  console.log('场景首次加载完成:', payload.projectData)
})
```

### 使用常量名称

```typescript
eventBus.on(EventNames.SELECTION_CHANGED, (payload) => {
  // payload 自动推导为 SelectionChangedPayload
})

eventBus.emit(EventNames.OBJECT_ADDED, {
  object: mesh,
})
```

## 在 Vue 组件中使用

推荐在 `onMounted` / `onBeforeUnmount` 中配对注册和注销：

```vue
<script setup lang="ts">
import { onMounted, onBeforeUnmount } from 'vue'
import { eventBus } from '@/engine/events'
import type { HistoryChangedPayload } from '@/engine/events'

function handleHistoryChanged(payload: HistoryChangedPayload) {
  console.log('可撤销:', payload.canUndo, '可重做:', payload.canRedo)
}

onMounted(() => {
  eventBus.on('history:changed', handleHistoryChanged)
})

onBeforeUnmount(() => {
  eventBus.off('history:changed', handleHistoryChanged)
})
</script>
```

## 在 Pinia Store 中使用

```typescript
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { eventBus } from '@/engine/events'
import type { HistoryChangedPayload } from '@/engine/events'

export const useHistoryStore = defineStore('history', () => {
  const canUndo = ref(false)
  const canRedo = ref(false)

  function handleHistoryChanged(payload: HistoryChangedPayload) {
    canUndo.value = payload.canUndo
    canRedo.value = payload.canRedo
  }

  eventBus.on('history:changed', handleHistoryChanged)

  return { canUndo, canRedo }
})
```

## 调试模式

开启调试模式后，所有事件的触发都会打印到控制台：

```typescript
eventBus.setDebug(true)
// 控制台输出: [EventBus] scene:selection-changed { selected: [...], added: [...] }
```

## 完整事件列表

### 场景对象事件

| 事件名                 | 常量             | Payload                | 触发时机       |
| ---------------------- | ---------------- | ---------------------- | -------------- |
| `scene:object-added`   | `OBJECT_ADDED`   | `ObjectAddedPayload`   | 对象添加到场景 |
| `scene:object-removed` | `OBJECT_REMOVED` | `ObjectRemovedPayload` | 对象从场景移除 |
| `scene:object-updated` | `OBJECT_UPDATED` | `ObjectUpdatedPayload` | 对象元数据更新 |

```typescript
interface ObjectAddedPayload {
  object: THREE.Object3D
  metadata?: ISceneObject
}

interface ObjectRemovedPayload {
  id: string
}

interface ObjectUpdatedPayload {
  id: string
  changes: Partial<ISceneObject>
}
```

### 选择事件

| 事件名                    | 常量                | Payload                   | 触发时机     |
| ------------------------- | ------------------- | ------------------------- | ------------ |
| `scene:selection-changed` | `SELECTION_CHANGED` | `SelectionChangedPayload` | 选择状态变化 |

```typescript
// SelectionChangedPayload = ISelectionEvent
interface ISelectionEvent {
  selected: THREE.Object3D[]
  added: THREE.Object3D[]
  removed: THREE.Object3D[]
}
```

### 变换事件

| 事件名                    | 常量                | Payload                   | 触发时机     |
| ------------------------- | ------------------- | ------------------------- | ------------ |
| `scene:transform-changed` | `TRANSFORM_CHANGED` | `TransformChangedPayload` | 对象变换完成 |

```typescript
interface TransformChangedPayload {
  objectId?: string
}
```

### 属性事件

| 事件名                   | 常量               | Payload                  | 触发时机     |
| ------------------------ | ------------------ | ------------------------ | ------------ |
| `scene:property-changed` | `PROPERTY_CHANGED` | `PropertyChangedPayload` | 对象属性修改 |

```typescript
interface PropertyChangedPayload {
  target: object
  property: string
  value: unknown
}
```

### 历史记录事件

| 事件名            | 常量              | Payload                 | 触发时机        |
| ----------------- | ----------------- | ----------------------- | --------------- |
| `history:changed` | `HISTORY_CHANGED` | `HistoryChangedPayload` | 撤销/重做栈变化 |
| `history:undo`    | `HISTORY_UNDO`    | `undefined`             | 请求撤销        |
| `history:redo`    | `HISTORY_REDO`    | `undefined`             | 请求重做        |

```typescript
interface HistoryChangedPayload {
  canUndo: boolean
  canRedo: boolean
  undoName: string | null
  redoName: string | null
}
```

### 场景生命周期事件

| 事件名          | 常量            | Payload               | 触发时机         |
| --------------- | --------------- | --------------------- | ---------------- |
| `scene:loaded`  | `SCENE_LOADED`  | `SceneLoadedPayload`  | 场景数据加载完成 |
| `scene:cleared` | `SCENE_CLEARED` | `SceneClearedPayload` | 场景被清空       |

### 编辑器模式事件

| 事件名                | 常量           | Payload              | 触发时机     |
| --------------------- | -------------- | -------------------- | ------------ |
| `editor:mode-changed` | `MODE_CHANGED` | `ModeChangedPayload` | 编辑模式切换 |

```typescript
type EditorMode = 'browse' | 'select' | 'move' | 'rotate' | 'scale'

interface ModeChangedPayload {
  mode: EditorMode
}
```

### 视口事件

| 事件名            | 常量     | Payload         | 触发时机     |
| ----------------- | -------- | --------------- | ------------ |
| `viewport:resize` | `RESIZE` | `ResizePayload` | 视口尺寸变化 |

```typescript
interface ResizePayload {
  width: number
  height: number
}
```

### 吸附事件

| 事件名                    | 常量               | Payload                  | 触发时机     |
| ------------------------- | ------------------ | ------------------------ | ------------ |
| `editor:snapping-changed` | `SNAPPING_CHANGED` | `SnappingChangedPayload` | 吸附配置变化 |

```typescript
interface SnappingChangedPayload {
  enabled: boolean
  preset: SnappingPreset | null
  config: ISnappingConfig
}
```

### 分组事件

| 事件名                   | 常量               | Payload        | 触发时机 |
| ------------------------ | ------------------ | -------------- | -------- |
| `scene:group-selected`   | `GROUP_SELECTED`   | `GroupPayload` | 请求成组 |
| `scene:ungroup-selected` | `UNGROUP_SELECTED` | `GroupPayload` | 请求解组 |

```typescript
interface GroupPayload {
  objectIds?: string[]
}
```

### 材质事件

| 事件名                  | 常量                    | Payload                      | 触发时机     |
| ----------------------- | ----------------------- | ---------------------------- | ------------ |
| `material:apply-preset` | `APPLY_MATERIAL_PRESET` | `ApplyMaterialPresetPayload` | 应用材质预设 |

```typescript
interface ApplyMaterialPresetPayload {
  presetId: string
  targetId?: string
  preset?: Record<string, unknown>
}
```

### 编辑器 UI 事件

| 事件名                     | 常量                | Payload              | 触发时机       |
| -------------------------- | ------------------- | -------------------- | -------------- |
| `editor:toggle-space`      | `TOGGLE_SPACE`      | `ToggleSpacePayload` | 切换坐标空间   |
| `editor:toggle-axes`       | `TOGGLE_AXES`       | `undefined`          | 切换坐标轴显示 |
| `editor:toggle-viewhelper` | `TOGGLE_VIEWHELPER` | `undefined`          | 切换视图辅助器 |
| `editor:save-project`      | `SAVE_PROJECT`      | `undefined`          | 保存项目       |

### 相机事件

| 事件名                | 常量             | Payload                | 触发时机   |
| --------------------- | ---------------- | ---------------------- | ---------- |
| `camera:changed`      | `CAMERA_CHANGED` | `CameraChangedPayload` | 相机切换   |
| `camera:focus-object` | `FOCUS_OBJECT`   | `FocusObjectPayload`   | 聚焦到对象 |

```typescript
interface CameraChangedPayload {
  type?: 'perspective' | 'orthographic'
  preset?: 'front' | 'back' | 'left' | 'right' | 'top' | 'bottom'
}

interface FocusObjectPayload {
  objectId: string
}
```

### 命令请求事件

UI 层通过命令请求事件发起业务操作（UI → Engine）：

| 事件名                  | 常量                | Payload                      | 说明         |
| ----------------------- | ------------------- | ---------------------------- | ------------ |
| `command:add-object`    | `CMD_ADD_OBJECT`    | `RequestAddObjectPayload`    | 请求添加对象 |
| `command:remove-object` | `CMD_REMOVE_OBJECT` | `RequestRemoveObjectPayload` | 请求删除对象 |

```typescript
interface RequestAddObjectPayload {
  type: string
  options?: Record<string, unknown>
}

interface RequestRemoveObjectPayload {
  objectId: string
}
```

## EventBus API

| 方法                         | 说明                       |
| ---------------------------- | -------------------------- |
| `on(event, callback)`        | 订阅事件                   |
| `off(event, callback)`       | 取消订阅                   |
| `once(event, callback)`      | 单次订阅（触发后自动取消） |
| `emit(event, payload?)`      | 触发事件                   |
| `removeAllListeners(event?)` | 移除事件的所有监听器       |
| `listenerCount(event)`       | 获取某事件的监听器数量     |
| `setDebug(enabled)`          | 开启/关闭调试模式          |
| `dispose()`                  | 销毁，清空所有监听器       |

## 新增事件

在 `EventTypes.ts` 中添加新事件只需两步：

**1. 定义 payload 类型：**

```typescript
export interface MyCustomPayload {
  data: string
  timestamp: number
}
```

**2. 在 `EventBusEventMap` 中注册：**

```typescript
export interface EventBusEventMap {
  // ... 现有事件
  'custom:my-event': MyCustomPayload
}
```

完成后，`eventBus.emit('custom:my-event', ...)` 和 `eventBus.on('custom:my-event', ...)` 自动获得完整的类型推导。

::: tip 命名规范
事件名采用 `domain:action` 格式，如 `scene:object-added`、`editor:mode-changed`、`history:changed`。常见 domain 包括：`scene`、`editor`、`history`、`viewport`、`camera`、`material`、`command`。
:::
