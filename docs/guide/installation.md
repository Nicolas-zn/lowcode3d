# 安装

## 包管理器

::: code-group

```bash [npm]
npm install @lowcode3d/vue3
# 或
npm install @lowcode3d/react
```

```bash [pnpm]
pnpm add @lowcode3d/vue3
# 或
pnpm add @lowcode3d/react
```

```bash [yarn]
yarn add @lowcode3d/vue3
# 或
yarn add @lowcode3d/react
```

:::

## 依赖说明

SDK 包含以下依赖：

| 包名               | 说明            |
| ------------------ | --------------- |
| three              | Three.js 核心库 |
| @lowcode3d/runtime | 渲染引擎核心    |

## 仅使用 Runtime

如果不使用 Vue/React 组件封装，可以直接安装 runtime：

```bash
npm install @lowcode3d/runtime three
```

## 浏览器兼容性

- Chrome 80+
- Firefox 75+
- Safari 14+
- Edge 80+

::: warning 注意
需要浏览器支持 WebGL 2.0
:::

## TypeScript 支持

所有包均提供完整的 TypeScript 类型定义。

```typescript
import type { SceneManager, IProjectData } from '@lowcode3d/runtime'
```
