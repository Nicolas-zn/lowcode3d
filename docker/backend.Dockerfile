# ================================
# 阶段 1: 构建后端
# ================================
FROM node:20-alpine AS builder

# 安装 pnpm
RUN npm install -g pnpm

WORKDIR /app

# 复制 package.json、lock 文件和基础 TS 配置
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY tsconfig.base.json ./
COPY packages/backend/package.json ./packages/backend/
COPY packages/shared/package.json ./packages/shared/

# 安装依赖
RUN pnpm install --frozen-lockfile

# 复制源代码
COPY packages/backend ./packages/backend
COPY packages/shared ./packages/shared

# 构建
RUN pnpm --filter @lowcode3d/backend build

# ================================
# 阶段 2: 生产镜像
# ================================
FROM node:20-alpine

# 安装 pnpm
RUN npm install -g pnpm

WORKDIR /app

# 复制 package.json
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/backend/package.json ./packages/backend/
COPY packages/shared/package.json ./packages/shared/

# 只安装生产依赖。生产阶段没有 devDependencies，需跳过根 prepare(husky)。
# better-sqlite3/sharp 仍需要运行安装脚本来准备原生二进制。
RUN pnpm install --frozen-lockfile --prod --ignore-scripts \
    && pnpm --filter @lowcode3d/backend rebuild better-sqlite3 sharp

# 复制构建产物
COPY --from=builder /app/packages/backend/dist ./packages/backend/dist
COPY --from=builder /app/packages/shared ./packages/shared

# 创建数据目录
RUN mkdir -p /app/data/uploads && chown -R node:node /app/data

# 使用非 root 用户
USER node

WORKDIR /app/packages/backend

EXPOSE 4000

CMD ["node", "dist/backend/src/app.js"]
