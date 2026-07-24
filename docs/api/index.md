# API 概览

LowCode3D SDK 提供三种使用方式。

## 包结构

| 包名               | 说明         | 适用场景          |
| ------------------ | ------------ | ----------------- |
| @lowcode3d/vue3    | Vue 3 组件   | Vue 3 项目        |
| @lowcode3d/react   | React 组件   | React 项目        |
| @lowcode3d/runtime | 核心渲染引擎 | 无框架/自定义集成 |

## 依赖关系

```
@lowcode3d/vue3    ─┐
                    ├──> @lowcode3d/runtime ──> three
@lowcode3d/react   ─┘
```

## API 文档

- [Vue3 组件 API](/api/vue3)
- [React 组件 API](/api/react)
- [Runtime API](/api/runtime)
