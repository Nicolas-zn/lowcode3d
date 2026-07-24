# 前端架构

LowCode3D 编辑器前端采用 **Clean Architecture** 分层设计，遵循 SOLID 原则，将 Three.js 渲染与业务逻辑严格分离。

## 架构总览

```
┌─────────────────────────────────────────────────────────────┐
│                     Vue 3 UI 层                              │
│  Components (Toolbar, SceneTree, PropertyPanel, Canvas...)  │
│  Pinia Stores (selection, history, editor, scene...)        │
├──────────────────────────┬──────────────────────────────────┤
│                     EventBus 通信层                          │
│          强类型事件总线 · 发布/订阅 · 解耦桥梁              │
├──────────────────────────┴──────────────────────────────────┤
│                     Engine 引擎层                            │
│  ┌──────────┐ ┌────────────┐ ┌──────────┐ ┌─────────────┐ │
│  │  Scene    │ │  Render    │ │  Camera  │ │  Object     │ │
│  │  Manager  │ │  Manager   │ │  Manager │ │  Manager    │ │
│  └──────────┘ └────────────┘ └──────────┘ └─────────────┘ │
│  ┌──────────┐ ┌────────────┐ ┌──────────┐ ┌─────────────┐ │
│  │ Selection│ │  Transform │ │  History  │ │  Hotkey     │ │
│  │  Manager │ │  Manager   │ │  Manager  │ │  Manager    │ │
│  └──────────┘ └────────────┘ └──────────┘ └─────────────┘ │
│  ┌──────────┐ ┌────────────┐ ┌──────────┐ ┌─────────────┐ │
│  │  Helper  │ │  Snapping  │ │  Light   │ │  Material   │ │
│  │  Manager │ │  Manager   │ │  Manager │ │  Manager    │ │
│  └──────────┘ └────────────┘ └──────────┘ └─────────────┘ │
├─────────────────────────────────────────────────────────────┤
│                 Three.js (仅负责渲染)                        │
│           Scene · Camera · Renderer · Controls              │
└─────────────────────────────────────────────────────────────┘
```

## 核心设计原则

### Three.js 只负责渲染

所有业务逻辑（选择、变换、撤销/重做、快捷键等）均通过 **Engine 层的 Manager** 处理，Three.js 仅作为底层渲染引擎。UI 层不直接操作 Three.js 对象，而是通过 Manager API 或 EventBus 间接操作。

### EventBus 统一通信

UI 与 Engine 之间的通信全部走 **强类型 EventBus**，禁止使用 `window.dispatchEvent`。每个事件都有严格的 TypeScript 类型定义，确保编译期类型安全。详见 [事件系统](/guide/event-system)。

### Command 模式管理副作用

所有可撤销的操作（添加/删除对象、变换、属性修改等）封装为 **Command**，由 HistoryManager 统一执行和管理。详见 [命令系统](/guide/command-system)。

### 单例 Manager 模式

所有 Manager 采用单例模式，通过 `getInstance()` 获取，确保全局一致性。生命周期与编辑器一致，通过 `dispose()` 释放资源。

## 目录结构

```
packages/frontend/src/
├── engine/                    # 引擎核心层
│   ├── core/                  # 核心管理器
│   │   ├── Engine.ts          # 引擎单例入口
│   │   ├── SceneManager.ts    # 场景管理
│   │   ├── RenderManager.ts   # 渲染管理
│   │   ├── CameraManager.ts   # 相机管理
│   │   ├── PostProcessingManager.ts  # 后处理
│   │   └── SceneSerializer.ts # 场景序列化
│   ├── events/                # 事件系统
│   │   ├── EventBus.ts        # 事件总线实现
│   │   ├── EventTypes.ts      # 事件类型定义
│   │   └── index.ts
│   ├── objects/               # 对象系统
│   │   ├── ObjectManager.ts   # 对象注册与管理
│   │   ├── ObjectFactory.ts   # 对象创建工厂
│   │   └── BillboardFactory.ts # 广告牌工厂
│   ├── interaction/           # 交互系统
│   │   ├── SelectionManager.ts # 鼠标选择与多选
│   │   └── TransformManager.ts # 平移/旋转/缩放控制
│   ├── history/               # 历史记录系统
│   │   ├── Command.ts         # 命令接口与基类
│   │   ├── HistoryManager.ts  # 撤销/重做管理
│   │   └── commands/          # 具体命令实现
│   │       ├── AddObjectCommand.ts
│   │       ├── RemoveObjectCommand.ts
│   │       ├── TransformCommand.ts
│   │       └── PropertyChangeCommand.ts
│   ├── helpers/               # 辅助工具
│   │   ├── HelperManager.ts   # 网格/坐标轴/视图辅助
│   │   ├── HotkeyManager.ts   # 快捷键管理
│   │   └── SnappingManager.ts # 吸附管理
│   ├── lights/                # 灯光系统
│   │   └── LightManager.ts
│   ├── materials/             # 材质系统
│   │   └── MaterialManager.ts
│   ├── loaders/               # 资源加载器
│   │   ├── ModelLoader.ts     # GLB/GLTF 模型加载
│   │   └── TextureLoader.ts   # 纹理加载
│   ├── animation/             # 动画系统
│   │   ├── AnimationEngine.ts
│   │   └── AnimationRecorder.ts
│   ├── types/                 # 类型定义
│   │   └── IEngine.ts
│   └── index.ts               # 统一导出
│
├── components/                # Vue 3 组件层
│   ├── layout/                # 布局组件
│   │   ├── EditorLayout.vue   # 编辑器主布局
│   │   ├── Toolbar.vue        # 顶部工具栏
│   │   ├── FloatingToolbar.vue # 浮动工具栏
│   │   ├── LeftSidebar.vue    # 左侧面板
│   │   ├── RightSidebar.vue   # 右侧属性面板
│   │   ├── BottomPanel.vue    # 底部面板
│   │   └── SceneStats.vue     # 场景统计信息
│   ├── canvas/                # 画布
│   │   └── CanvasPanel.vue    # 3D 视口
│   ├── sidebar/               # 侧边栏面板
│   │   ├── SceneTree.vue      # 场景树
│   │   ├── ComponentLibrary.vue # 组件库
│   │   ├── ModelLibrary.vue   # 模型库
│   │   ├── MaterialLibrary.vue # 材质库
│   │   ├── LightLibrary.vue   # 灯光库
│   │   └── AnnotationLibrary.vue # 标注库
│   ├── properties/            # 属性面板
│   │   ├── MaterialPanel.vue  # 材质属性
│   │   ├── LightPanel.vue     # 灯光属性
│   │   ├── EnvironmentPanel.vue # 环境设置
│   │   ├── PostProcessingPanel.vue # 后处理设置
│   │   └── VideoPanel.vue     # 视频面板
│   └── bottom/                # 底部面板
│       └── TimelinePanel.vue  # 时间轴
│
├── stores/                    # Pinia 状态管理
│   ├── editorStore.ts         # 编辑器全局状态
│   ├── editorStateStore.ts    # 编辑器 UI 状态
│   ├── selectionStore.ts      # 选择状态
│   ├── historyStore.ts        # 历史记录状态
│   ├── sceneStore.ts          # 场景状态
│   ├── projectStore.ts        # 项目状态
│   ├── resourceStore.ts       # 资源状态
│   ├── themeStore.ts          # 主题状态
│   └── userStore.ts           # 用户状态
│
└── views/                     # 页面视图
    └── Login.vue              # 登录页
```

## 数据流

```
用户操作 (点击/拖拽/快捷键)
    │
    ▼
Vue Component / HotkeyManager
    │
    ├─── 可撤销操作 ──▶ HistoryManager.execute(Command)
    │                         │
    │                         ├── Command.execute()
    │                         │     └── 修改 Engine 状态
    │                         │
    │                         └── eventBus.emit('history:changed')
    │                               └── historyStore 更新 UI
    │
    └─── 普通操作 ────▶ Manager API 调用
                             │
                             └── eventBus.emit('scene:*')
                                   └── Vue Components / Stores 响应
```

### 示例：选择对象的数据流

```
1. 用户点击 3D 视口中的对象
2. SelectionManager 通过 Raycaster 检测到命中
3. SelectionManager 更新内部选择状态
4. SelectionManager 调用 onSelectionChange 回调
5. Engine 将 TransformControls 附着到选中对象
6. Engine 通过 eventBus.emit('scene:selection-changed', payload) 广播
7. selectionStore 接收事件，更新 Pinia 状态
8. SceneTree.vue 高亮对应节点
9. RightSidebar.vue 显示选中对象的属性面板
```

## Manager 一览

| Manager                 | 职责                       | 获取方式                                     |
| ----------------------- | -------------------------- | -------------------------------------------- |
| `Engine`                | 引擎入口，管理所有子管理器 | `Engine.getInstance()` / `getEngine()`       |
| `SceneManager`          | Three.js 场景、环境、背景  | `engine.sceneManager`                        |
| `RenderManager`         | WebGL 渲染、后处理         | `engine.renderManager`                       |
| `CameraManager`         | 相机、轨道控制器           | `engine.cameraManager`                       |
| `ObjectManager`         | 对象注册、元数据管理       | `engine.objectManager`                       |
| `SelectionManager`      | 鼠标选择、多选             | `engine.selectionManager`                    |
| `TransformManager`      | 平移/旋转/缩放控制         | `engine.transformManager`                    |
| `HistoryManager`        | 撤销/重做                  | `getHistoryManager()`                        |
| `HotkeyManager`         | 快捷键注册与处理           | `getHotkeyManager()`                         |
| `HelperManager`         | 网格、坐标轴、视图辅助器   | `getHelperManager()`                         |
| `SnappingManager`       | 变换吸附                   | `getSnappingManager()`                       |
| `LightManager`          | 灯光创建与管理             | `getLightManager()`                          |
| `MaterialManager`       | 材质创建与管理             | `getMaterialManager()`                       |
| `ModelLoader`           | GLB/GLTF 模型加载          | `getModelLoader()`                           |
| `PostProcessingManager` | Bloom/Outline 等效果       | `engine.renderManager.postProcessingManager` |

## Pinia Store 与 Engine 的关系

Store 作为 Vue 响应式层，通过 EventBus 与 Engine 同步状态：

| Store            | 关联事件                     | 说明               |
| ---------------- | ---------------------------- | ------------------ |
| `selectionStore` | `scene:selection-changed`    | 同步选择状态到 Vue |
| `historyStore`   | `history:changed`            | 同步撤销/重做状态  |
| `editorStore`    | `editor:mode-changed`        | 同步编辑模式       |
| `sceneStore`     | `scene:object-added/removed` | 同步场景对象列表   |

## 下一步

- [事件系统](/guide/event-system) - EventBus 的使用方式和事件列表
- [命令系统](/guide/command-system) - Command 模式与撤销/重做
- [场景数据](/guide/scene-data) - 导出的 JSON 数据格式
