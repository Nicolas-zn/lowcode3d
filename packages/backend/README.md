# Lowcode3D Backend

基于 Fastify + SQLite + Drizzle ORM 的后端服务。

## 技术栈

- **Fastify** - 高性能 Web 框架
- **SQLite** - 轻量级嵌入式数据库
- **Drizzle ORM** - TypeScript ORM
- **JWT** - 用户认证
- **Local Storage** - 本地文件存储

## 快速开始

### 1. 安装依赖

```bash
pnpm install
```

### 2. 配置环境变量

```bash
cp .env.example .env
```

根据需要修改 `.env` 文件中的配置。

### 3. 启动开发服务器

```bash
pnpm dev
```

服务器将在 `http://localhost:4000` 启动。

## 项目结构

```
src/
├── app.ts              # 应用入口
├── db/
│   ├── index.ts        # 数据库连接
│   └── schema.ts       # 数据库 Schema
├── middlewares/
│   └── auth.ts         # JWT 认证中间件
├── repositories/
│   ├── UserRepository.ts
│   ├── ProjectRepository.ts
│   └── AssetRepository.ts
├── routes/
│   ├── auth.ts         # 认证路由
│   ├── projects.ts     # 项目路由
│   ├── assets.ts       # 资源路由
│   ├── upload.ts       # 上传路由
│   └── health.ts       # 健康检查
├── services/
│   ├── AuthService.ts
│   ├── ProjectService.ts
│   ├── AssetService.ts
│   └── StorageService.ts
└── types/
    └── fastify.d.ts    # 类型声明
```

## API 接口

### 认证 API

| 方法 | 路径               | 描述             |
| ---- | ------------------ | ---------------- |
| POST | /api/auth/register | 用户注册         |
| POST | /api/auth/login    | 用户登录         |
| GET  | /api/auth/me       | 获取当前用户信息 |
| POST | /api/auth/refresh  | 刷新 Token       |

### 项目 API

| 方法   | 路径              | 描述         |
| ------ | ----------------- | ------------ |
| GET    | /api/projects     | 获取项目列表 |
| POST   | /api/projects     | 创建项目     |
| GET    | /api/projects/:id | 获取项目详情 |
| PUT    | /api/projects/:id | 更新项目     |
| DELETE | /api/projects/:id | 删除项目     |

### 资源 API

| 方法   | 路径                   | 描述           |
| ------ | ---------------------- | -------------- |
| GET    | /api/assets            | 获取资源列表   |
| GET    | /api/assets?type=model | 按类型获取资源 |
| GET    | /api/assets/:id        | 获取资源详情   |
| POST   | /api/assets/upload     | 上传资源       |
| DELETE | /api/assets/:id        | 删除资源       |

### 上传 API

| 方法 | 路径              | 描述         |
| ---- | ----------------- | ------------ |
| POST | /api/upload/file  | 上传文件     |
| POST | /api/upload/files | 批量上传     |
| POST | /api/upload/image | 上传图片     |
| POST | /api/upload/model | 上传 3D 模型 |

## 数据存储

所有数据存储在 `data/` 目录下：

```
data/
├── lowcode3d.db        # SQLite 数据库文件
└── uploads/            # 上传文件目录
    ├── models/         # 3D 模型
    ├── textures/       # 纹理图片
    ├── thumbnails/     # 缩略图
    ├── hdri/           # HDR 环境贴图
    └── other/          # 其他文件
```

## 数据库管理

```bash
# 生成迁移文件
pnpm db:generate

# 执行迁移
pnpm db:migrate

# 推送 Schema 到数据库
pnpm db:push

# 打开 Drizzle Studio
pnpm db:studio
```

## 环境变量

| 变量           | 描述           | 默认值              |
| -------------- | -------------- | ------------------- |
| PORT           | 服务端口       | 4000                |
| HOST           | 服务地址       | 0.0.0.0             |
| NODE_ENV       | 环境           | development         |
| JWT_SECRET     | JWT 密钥       | -                   |
| JWT_EXPIRES_IN | Token 过期时间 | 7d                  |
| DATABASE_URL   | 数据库路径     | ./data/lowcode3d.db |
| UPLOAD_DIR     | 上传目录       | ./data/uploads      |
| MAX_FILE_SIZE  | 最大文件大小   | 52428800 (50MB)     |
| CORS_ORIGIN    | 允许的跨域源   | \*                  |
