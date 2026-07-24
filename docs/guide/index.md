# 简介

LowCode3D/runtime 是商用级零代码 3D 可视化编辑器 [editor3d](https://editor3d.nicowebgl.cn) 的二次开发包，提供完整的 SDK 用于二次开发。

## [editor3d](https://editor3d.nicowebgl.cn)核心能力

- **可视化编辑器**: 拖拽式场景搭建，材质编辑，光照设置
- **JSON 数据导出**: 场景数据以标准 JSON 格式导出
- **SDK 集成**: 提供 Vue3/React/Vue2 组件快速集成
- **模型映射**: 支持将云端模型替换为本地资源

## LowCode3D/vue3 核心能力

- **恢复场景**: 完美恢复编辑器中的场景
- **快速集成**: 提供 Vue3/React/Vue2 组件快速集成，支持将编辑器中的场景快速集成到业务系统中

## LowCode3D/runtime 核心能力

- **二次业务开发**: 提供丰富的 API，支持二次业务开发

## 技术栈

| 模块       | 技术                          |
| ---------- | ----------------------------- |
| 编辑器     | Vue 3 + TypeScript + Three.js |
| 状态管理   | Pinia                         |
| UI 组件    | Element Plus                  |
| 构建工具   | Vite                          |
| SDK        | @lowcode3d/runtime            |
| Vue3 适配  | @lowcode3d/vue3               |
| React 适配 | @lowcode3d/react              |

## 工作流程

```
编辑器设计场景 → 导出 JSON → SDK 加载渲染 → 业务交互
```

## 编辑器架构

编辑器前端采用分层架构，Three.js 只负责渲染，所有业务逻辑通过强类型 EventBus 通信：

```
Vue 3 UI 层 (Components + Pinia Stores)
        ↕ EventBus 事件通信
Engine 引擎层 (Managers + Command)
        ↕
Three.js 渲染层
```

核心设计模式：

- **EventBus + 发布/订阅**：UI 与引擎之间的解耦通信
- **Command 模式**：所有可撤销操作封装为命令
- **单例 Manager**：统一管理场景、渲染、交互等子系统

## 下一步

- [快速开始](/guide/quickstart) - 5 分钟上手
- [安装指南](/guide/installation) - 详细安装说明
- [前端架构](/guide/architecture) - 了解编辑器架构设计
- [事件系统](/guide/event-system) - EventBus 事件通信
- [命令系统](/guide/command-system) - 撤销/重做与 Command 模式

## 二次开发

基于 Runtime SDK 将 3D 场景集成到你的业务系统中：

- [二次开发：快速上手](/guide/dev-getting-started) - 三种集成方式对比
- [二次开发：交互开发](/guide/dev-interaction) - 选择、高亮、聚焦、数据绑定
- [二次开发：场景操控](/guide/dev-scene-ops) - 动态对象、材质、相机、环境
- [二次开发：高级定制](/guide/dev-advanced) - 自定义命令、事件扩展、后处理、动画
