# 开箱即用、一键部署的高性能三维编辑器

Lowcode3D 是一个面向商业化场景的低代码三维场景编辑器，基于 Vue 3、TypeScript 与 Three.js 构建，提供可视化场景搭建、模型资源管理、项目保存、在线预览与发布能力。项目采用前后端分离与 pnpm workspace 组织方式，既可以作为完整编辑器独立部署，也可以将运行时 SDK 集成到业务系统中。

![Image text](https://baas.nicowebgl.cn/storage/v1/object/public/images/lowcode3d/image1.png)
![Image text](https://baas.nicowebgl.cn/storage/v1/object/public/images/lowcode3d/image2.png)
![Image text](https://baas.nicowebgl.cn/storage/v1/object/public/images/lowcode3d/image3.png)

## 项目简介

Lowcode3D 适合用于搭建产品展示、数字展厅、三维看板、交互式空间展示、Web 3D 营销页等场景。编辑器侧提供接近专业创作工具的工作台体验，后端提供用户、项目、资源上传、发布快照等基础服务，运行时包则负责把编辑器产物稳定渲染到预览页或外部应用中。

核心能力：

- 三维可视化编辑：基于 Three.js 的实时场景编辑、对象选择、层级管理与属性配置。
- 资源管理：支持图片、纹理、HDR、GLTF/GLB 模型等资源上传与管理。
- 项目管理：支持项目创建、保存、编辑、恢复和在线预览。
- 发布能力：支持将项目发布为独立快照，避免草稿修改影响已发布页面。
- 高性能渲染：按 Three.js、引擎、Element Plus、Vue 等模块拆分构建产物，降低首屏压力。
- 一键部署：内置 Docker Compose 后端部署配置，SQLite 数据和上传文件自动持久化。
- 多框架运行时：包含 runtime、Vue 2、Vue 3、React 等包，便于在不同技术栈中复用编辑器产物。

## 技术栈

- 前端：Vue 3、Vite、TypeScript、Pinia、Element Plus
- 三维引擎：Three.js、GSAP、postprocessing、DRACO 解码器
- 后端：Fastify、SQLite、Drizzle ORM、JWT、Local Storage
- 工程化：pnpm workspace、ESLint、Prettier、Docker Compose

## 目录结构

```text
.
├── packages/
│   ├── frontend/      # 编辑器前端应用
│   ├── backend/       # Fastify API 服务
│   ├── shared/        # 前后端共享类型与场景数据协议
│   ├── runtime/       # 三维运行时 SDK
│   ├── vue2/          # Vue 2 运行时封装
│   ├── vue3/          # Vue 3 运行时封装
│   └── react/         # React 运行时封装
├── docker/            # Docker 镜像与环境变量示例
├── scripts/           # 引擎同步与包发布脚本
├── docker-compose.yml # 后端一键部署配置
└── pnpm-workspace.yaml
```

## 环境要求

- Node.js >= 20
- pnpm >= 8
- Docker 与 Docker Compose，用于生产或测试部署

## 快速开始

### 1. 安装依赖

```bash
pnpm install
```

### 2. 配置后端环境变量

```bash
cp packages/backend/.env.example packages/backend/.env
```

仓库当前开发配置使用 `PORT=4001`，用于配合前端 Vite 代理；`packages/backend/.env.example` 中保留的是通用默认端口 `4000`。如需直接按本仓库前端配置联调，请确认 `packages/backend/.env` 中的 `PORT` 为 `4001`。

### 3. 启动开发环境

分别启动前后端：

```bash
pnpm dev:backend
pnpm dev
```

或同时启动：

```bash
pnpm dev:all
```

默认访问地址：

- 编辑器前端：`http://localhost:3005`
- 后端 API：`http://localhost:4001`
- 健康检查：`http://localhost:4001/api/health`

如果使用仓库默认的前端开发代理配置，前端会把 `/api` 与 `/uploads` 转发到 `http://localhost:4001`，请保持后端端口一致。Docker 部署场景默认使用 `4000`。

### 4.注册首用户

```
curl --request POST \
  --url http://localhost:4001/api/auth/register \
  --header 'Accept: */*' \
  --header 'Accept-Encoding: gzip, deflate, br' \
  --header 'Cache-Control: no-cache' \
  --header 'Connection: keep-alive' \
  --header 'Content-Length: 92' \
  --header 'Content-Type: application/json' \
  --header 'Host: localhost:4001' \
  --header 'User-Agent: PostmanRuntime-ApipostRuntime/1.1.0' \
  --data '{
  "email":"admin@nico.com",
  "password":"123456",
  "nickname":"nico",
  "role":"admin"
}'
```

## 一键部署后端

项目根目录已经提供 `docker-compose.yml`，可直接构建并启动后端服务：

```bash
docker compose up -d --build
```

启动后，后端服务会监听：

```text
http://localhost:4000
```

检查服务状态：

```bash
docker compose ps
curl http://localhost:4000/api/health
```

数据会持久化到 Docker volume `lowcode3d-data`，包含 SQLite 数据库与上传文件。

### Docker 环境变量

生产环境建议在根目录创建 `.env`：

```bash
cp docker/.env.example .env
```

至少修改以下配置：

```env
JWT_SECRET=your-strong-secret
CORS_ORIGIN=https://your-editor-domain.com
```

常用变量：

| 变量            | 说明                           | 默认值                             |
| --------------- | ------------------------------ | ---------------------------------- |
| `JWT_SECRET`    | JWT 签名密钥，生产环境必须修改 | `change-this-secret-in-production` |
| `CORS_ORIGIN`   | 允许访问 API 的前端域名        | `https://editor3d.nicowebgl.cn`    |
| `DATABASE_URL`  | SQLite 数据库路径              | `/app/data/lowcode3d.db`           |
| `UPLOAD_DIR`    | 上传文件目录                   | `/app/data/uploads`                |
| `MAX_FILE_SIZE` | 单文件上传大小限制             | `52428800`                         |

## 部署前端

构建编辑器前端：

```bash
pnpm build
```

构建产物位于：

```text
packages/frontend/editor3d
```

将该目录部署到 Nginx、静态资源服务器或对象存储即可。生产环境前端默认使用 `/api` 作为接口前缀，建议在 Nginx 中把 `/api` 和 `/uploads` 反向代理到后端服务。

Nginx 示例：

```nginx
server {
    listen 80;
    server_name your-editor-domain.com;

    root /var/www/editor3d;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:4000/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    location /uploads/ {
        proxy_pass http://127.0.0.1:4000/uploads/;
        proxy_set_header Host $host;
    }
}
```

## 构建运行时与 SDK

同步编辑器引擎并构建运行时：

```bash
pnpm build:runtime
```

构建全部运行时包：

```bash
pnpm build:packages
```

发布包前可参考：

```bash
pnpm release
```

## 常用命令

| 命令                                        | 说明                                 |
| ------------------------------------------- | ------------------------------------ |
| `pnpm dev`                                  | 启动前端编辑器                       |
| `pnpm dev:backend`                          | 启动后端 API                         |
| `pnpm dev:all`                              | 同时启动前后端                       |
| `pnpm build`                                | 构建前端                             |
| `pnpm build:backend`                        | 构建后端                             |
| `pnpm build:runtime`                        | 同步引擎并构建运行时                 |
| `pnpm build:packages`                       | 构建 runtime、Vue 2、Vue 3、React 包 |
| `pnpm -F @lowcode3d/frontend run test:v1.3` | 运行 v1.3 运行时回归测试             |

## 后端 API 概览

后端默认提供以下接口分组：

- `/api/auth`：注册、登录、用户信息、Token 刷新
- `/api/projects`：项目创建、列表、详情、更新、删除、发布
- `/api/assets`：资源列表、资源详情、资源上传、URL 模型资源接入、删除
- `/api/upload`：文件、图片、模型等上传
- `/api/health`：健康检查

详细后端说明见 `packages/backend/README.md`。

## 生产部署建议

- 修改 `JWT_SECRET`，不要使用示例密钥。
- 将 `CORS_ORIGIN` 设置为真实前端域名。
- 使用 HTTPS 暴露前端与 API。
- 对 `/uploads` 做容量、备份和访问策略规划。
- 定期备份 Docker volume `lowcode3d-data` 中的 SQLite 数据和上传资源。
- 如需更高并发或团队协作能力，可将 SQLite 演进为独立数据库服务。

## 许可

当前仓库未声明开源许可证。如需商业使用、二次分发或对外发布，请先确认项目授权方式。
