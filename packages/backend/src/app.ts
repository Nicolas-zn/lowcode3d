/**
 * Lowcode3D Backend Application
 * Fastify + SQLite + Local Storage
 */
import 'dotenv/config'
import Fastify from 'fastify'
import cors from '@fastify/cors'
import jwt from '@fastify/jwt'
import multipart from '@fastify/multipart'
import fastifyStatic from '@fastify/static'
import { resolve } from 'path'
import { fileURLToPath } from 'url'
import bcrypt from 'bcryptjs'

import { userRepository } from './repositories/UserRepository.js'
import { authRoutes } from './routes/auth.js'
import { projectRoutes } from './routes/projects.js'
import { healthRoutes } from './routes/health.js'
import { uploadRoutes } from './routes/upload.js'
import { assetRoutes } from './routes/assets.js'

import { testConnection, initDatabase, closeConnection } from './db/index.js'
import { storageService } from './services/StorageService.js'

// 创建 Fastify 实例
// 在 ESM 中，使用 import.meta.resolve 来解析 pino-pretty 的路径
const getLoggerConfig = () => {
  if (process.env.NODE_ENV === 'development') {
    try {
      // 使用 import.meta.resolve 解析 pino-pretty 模块路径
      // 返回的是 file:// URL，需要转换为文件路径
      const pinoPrettyUrl = import.meta.resolve('pino-pretty')
      const pinoPrettyPath = fileURLToPath(pinoPrettyUrl)
      return {
        level: process.env.LOG_LEVEL || 'info',
        transport: {
          target: pinoPrettyPath,
          options: {
            colorize: true,
          },
        },
      }
    } catch (error) {
      // 如果解析失败，回退到普通日志
      console.warn('Failed to resolve pino-pretty, using default logger:', error)
      return {
        level: process.env.LOG_LEVEL || 'info',
      }
    }
  }
  return {
    level: process.env.LOG_LEVEL || 'info',
  }
}

const fastify = Fastify({
  logger: getLoggerConfig(),
})

// 注册 CORS 插件
const getCorsOrigin = () => {
  const origin = process.env.CORS_ORIGIN
  if (!origin || origin === 'true') return true
  if (origin === '*') return '*'
  if (origin.includes(',')) {
    return origin.split(',').map((o) => o.trim())
  }
  return origin
}

console.log('CORS Origins Configured:', getCorsOrigin())

await fastify.register(cors, {
  origin: getCorsOrigin(),
  credentials: true,
})

// 注册 JWT 插件
await fastify.register(jwt, {
  secret: process.env.JWT_SECRET || 'default-secret-change-me-in-production',
  sign: {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },
})

// 注册 Multipart 插件（文件上传）
await fastify.register(multipart, {
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE || '52428800', 10), // 默认 50MB
    files: 10, // 最多 10 个文件
  },
})

// 注册静态文件服务（用于访问上传的文件）
const uploadDir = resolve(process.env.UPLOAD_DIR || './data/uploads')
await fastify.register(fastifyStatic, {
  root: uploadDir,
  prefix: '/uploads/',
  decorateReply: false,
})

// JWT 验证装饰器
fastify.decorate(
  'authenticate',
  async function (
    request: { jwtVerify: () => Promise<void>; user?: { id: string; email: string }; log: any },
    reply: { status: (code: number) => { send: (data: unknown) => void } }
  ) {
    try {
      await request.jwtVerify()
    } catch (err) {
      // 在开发环境下，如果验证失败（通常是没传Token），自动注入开发用户
      if (process.env.NODE_ENV === 'development') {
        request.log.warn('⚠️  Dev Mode: Authentication failed, using mock user')

        const devEmail = 'dev@local'
        let devUser = await userRepository.findByEmail(devEmail)

        if (!devUser) {
          request.log.info('Creating default dev user...')
          const passwordHash = await bcrypt.hash('123456', 10)
          devUser = await userRepository.create({
            email: devEmail,
            nickname: 'Developer',
            passwordHash,
            avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Developer',
          })
        }

        request.user = {
          id: devUser.id,
          email: devUser.email,
        }
        return
      }

      reply.status(401).send({
        success: false,
        error: 'Unauthorized',
      })
    }
  }
)

// JWT 可选验证装饰器
fastify.decorate(
  'authenticateOptional',
  async function (
    request: { jwtVerify: () => Promise<void>; user?: { id: string; email: string }; log: any },
    _reply: any
  ) {
    try {
      await request.jwtVerify()
    } catch (err) {
      // 验证失败也不报错，只是 user 为 undefined
      // 开发环境下也不强制 mock 用户，因为这是可选验证
    }
  }
)

// 全局错误处理
fastify.setErrorHandler((error, request, reply) => {
  request.log.error(error)

  // 验证错误
  if (error.validation) {
    return reply.status(400).send({
      success: false,
      error: '请求参数验证失败',
      details: error.validation,
    })
  }

  // 其他错误
  return reply.status(error.statusCode || 500).send({
    success: false,
    error: error.message || '服务器内部错误',
  })
})

// 注册路由
await fastify.register(healthRoutes, { prefix: '/api' })
await fastify.register(authRoutes, { prefix: '/api/auth' })
await fastify.register(projectRoutes, { prefix: '/api/projects' })
await fastify.register(uploadRoutes, { prefix: '/api/upload' })
await fastify.register(assetRoutes, { prefix: '/api/assets' })

// 启动服务器
const start = async () => {
  try {
    const port = parseInt(process.env.PORT || '4001', 10)
    const host = process.env.HOST || '0.0.0.0'

    // 初始化数据库
    const dbConnected = await testConnection()
    if (dbConnected) {
      await initDatabase()
    } else {
      console.error('❌ Database connection failed, exiting...')
      process.exit(1)
    }

    // 初始化存储服务
    try {
      await storageService.initialize()
    } catch (error) {
      console.warn('⚠️  Storage service initialization failed:', error)
    }

    // 启动服务器
    await fastify.listen({ port, host })
    console.log(`🚀 Server running at http://${host}:${port}`)
    console.log(`📚 API docs: http://${host}:${port}/api/health`)
    console.log(`📁 Upload files at: http://${host}:${port}/uploads/`)
  } catch (err) {
    fastify.log.error(err)
    process.exit(1)
  }
}

// 优雅关闭
const gracefulShutdown = async (signal: string) => {
  console.log(`\n${signal} received, shutting down gracefully...`)
  try {
    await fastify.close()
    await closeConnection()
    console.log('Server closed successfully')
    process.exit(0)
  } catch (err) {
    console.error('Error during shutdown:', err)
    process.exit(1)
  }
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))
process.on('SIGINT', () => gracefulShutdown('SIGINT'))

start()
