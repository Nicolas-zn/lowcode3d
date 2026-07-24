# 命令系统

LowCode3D 使用 **Command 模式** 封装所有可撤销的操作，配合 **HistoryManager** 实现完整的撤销/重做功能。

## 设计理念

```
用户操作 → 创建 Command → HistoryManager.execute(command)
                                │
                                ├── command.execute()    → 执行操作
                                ├── 压入 undo 栈         → 记录历史
                                └── eventBus.emit()      → 通知 UI
```

每个可撤销的操作都封装为一个 Command 对象，Command 内部包含执行（execute）和撤销（undo）的完整逻辑。HistoryManager 负责维护撤销/重做栈。

## 命令接口

```typescript
interface ICommand {
  readonly name: string
  execute(): void
  undo(): void
  canMergeWith?(command: ICommand): boolean
  mergeWith?(command: ICommand): void
}
```

| 方法             | 说明                                       |
| ---------------- | ------------------------------------------ |
| `name`           | 命令名称，用于 UI 显示（如 "移动 立方体"） |
| `execute()`      | 执行命令                                   |
| `undo()`         | 撤销命令                                   |
| `canMergeWith()` | 是否可以与前一个命令合并（可选）           |
| `mergeWith()`    | 与前一个命令合并（可选）                   |

## 内置命令

### AddObjectCommand

添加对象到场景。

```typescript
import { AddObjectCommand } from '@/engine/history'

const command = new AddObjectCommand(engine, mesh, {
  name: 'MyCube',
  type: 'mesh',
})
historyManager.execute(command)
```

- `execute()`: 将对象添加到场景，通过 ObjectManager 注册，发出 `scene:object-added` 事件
- `undo()`: 从场景移除对象，发出 `scene:object-removed` 事件

### RemoveObjectCommand

从场景移除对象。

```typescript
import { RemoveObjectCommand } from '@/engine/history'

const command = new RemoveObjectCommand(engine, object)
historyManager.execute(command)
```

- `execute()`: 移除对象，发出 `scene:object-removed` 事件
- `undo()`: 恢复对象到场景，发出 `scene:object-added` 事件

### TransformCommand

记录对象变换（位置/旋转/缩放）。

```typescript
import { TransformCommand } from '@/engine/history'

const command = new TransformCommand(engine, object, {
  oldPosition: oldPos.clone(),
  newPosition: newPos.clone(),
  oldRotation: oldRot.clone(),
  newRotation: newRot.clone(),
  oldScale: oldScale.clone(),
  newScale: newScale.clone(),
})
historyManager.execute(command)
```

- `execute()`: 将变换应用到对象，发出 `scene:transform-changed` 事件
- `undo()`: 恢复到变换前的状态

### PropertyChangeCommand

修改对象属性（如名称、可见性、材质参数等）。

```typescript
import { PropertyChangeCommand } from '@/engine/history'

const command = new PropertyChangeCommand(target, 'visible', true, false)
historyManager.execute(command)
```

- `execute()`: 应用新值，发出 `scene:property-changed` 事件
- `undo()`: 恢复旧值

## HistoryManager

### 获取实例

```typescript
import { getHistoryManager } from '@/engine/history'

const historyManager = getHistoryManager()
```

### 执行命令

```typescript
historyManager.execute(command)
```

执行时会：

1. 调用 `command.execute()`
2. 检查是否可以与上一个命令合并
3. 将命令压入撤销栈
4. 清空重做栈
5. 通过 EventBus 发出 `history:changed` 事件

### 撤销 / 重做

```typescript
historyManager.undo() // 撤销
historyManager.redo() // 重做
```

### 状态查询

```typescript
historyManager.canUndo // boolean
historyManager.canRedo // boolean
historyManager.undoName // string | null, 下一个可撤销的命令名
historyManager.redoName // string | null, 下一个可重做的命令名
historyManager.undoStackSize // number
historyManager.redoStackSize // number
```

### 清空历史

```typescript
historyManager.clear()
```

### 配置

```typescript
const historyManager = HistoryManager.getInstance({
  maxHistorySize: 100, // 最大历史记录数，默认 100
  onChange: (event) => {
    // 历史变化回调
    console.log(event.canUndo, event.canRedo)
  },
})
```

## 监听历史变化

通过 EventBus 监听：

```typescript
import { eventBus } from '@/engine/events'

eventBus.on('history:changed', (payload) => {
  console.log('可撤销:', payload.canUndo)
  console.log('可重做:', payload.canRedo)
  console.log('撤销操作:', payload.undoName)
  console.log('重做操作:', payload.redoName)
})
```

## 自定义命令

继承 `BaseCommand` 创建自定义命令：

```typescript
import { BaseCommand } from '@/engine/history'

class ChangeColorCommand extends BaseCommand {
  readonly name = '修改颜色'

  private mesh: THREE.Mesh
  private oldColor: THREE.Color
  private newColor: THREE.Color

  constructor(mesh: THREE.Mesh, newColor: THREE.Color) {
    super()
    this.mesh = mesh
    this.newColor = newColor.clone()
    this.oldColor = (mesh.material as THREE.MeshStandardMaterial).color.clone()
  }

  execute(): void {
    const material = this.mesh.material as THREE.MeshStandardMaterial
    material.color.copy(this.newColor)
    material.needsUpdate = true
  }

  undo(): void {
    const material = this.mesh.material as THREE.MeshStandardMaterial
    material.color.copy(this.oldColor)
    material.needsUpdate = true
  }
}

// 使用
const command = new ChangeColorCommand(mesh, new THREE.Color('#ff0000'))
historyManager.execute(command)
```

## 命令合并

对于连续的细粒度操作（如拖拽时的连续变换），可以通过命令合并避免产生过多历史记录：

```typescript
class ContinuousTransformCommand extends BaseCommand {
  readonly name = '移动对象'

  private mesh: THREE.Mesh
  private startPosition: THREE.Vector3
  private endPosition: THREE.Vector3

  constructor(mesh: THREE.Mesh, startPos: THREE.Vector3, endPos: THREE.Vector3) {
    super()
    this.mesh = mesh
    this.startPosition = startPos.clone()
    this.endPosition = endPos.clone()
  }

  execute(): void {
    this.mesh.position.copy(this.endPosition)
  }

  undo(): void {
    this.mesh.position.copy(this.startPosition)
  }

  canMergeWith(command: ICommand): boolean {
    return command instanceof ContinuousTransformCommand && command.mesh === this.mesh
  }

  mergeWith(command: ICommand): void {
    if (command instanceof ContinuousTransformCommand) {
      this.startPosition.copy(command.startPosition)
    }
  }
}
```

## 快捷键绑定

撤销/重做已通过 `HotkeyManager` 绑定到快捷键：

| 快捷键                       | 操作 |
| ---------------------------- | ---- |
| `Ctrl+Z` / `⌘+Z`             | 撤销 |
| `Ctrl+Shift+Z` / `⌘+Shift+Z` | 重做 |

::: warning 注意
所有可撤销操作必须通过 `historyManager.execute(command)` 执行，直接修改对象状态不会记录到历史中。
:::
