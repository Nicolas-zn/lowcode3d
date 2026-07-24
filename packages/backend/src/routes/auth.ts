/**
 * 认证路由
 * 处理用户注册、登录和认证相关 API
 */
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { authService, AuthError } from '../services/AuthService.js'

interface RegisterBody {
  email: string
  password: string
  nickname?: string
}

interface LoginBody {
  email: string
  password: string
}

// JSON Schema 验证
const registerSchema = {
  body: {
    type: 'object',
    required: ['email', 'password'],
    properties: {
      email: { type: 'string', format: 'email' },
      password: { type: 'string', minLength: 6 },
      nickname: { type: 'string', minLength: 2, maxLength: 50 },
    },
  },
}

const loginSchema = {
  body: {
    type: 'object',
    required: ['email', 'password'],
    properties: {
      email: { type: 'string', format: 'email' },
      password: { type: 'string', minLength: 1 },
    },
  },
}

export async function authRoutes(fastify: FastifyInstance) {
  /**
   * 用户注册
   * POST /auth/register
   */
  fastify.post(
    '/register',
    { schema: registerSchema },
    async (request: FastifyRequest<{ Body: RegisterBody }>, reply: FastifyReply) => {
      try {
        const result = await authService.register(request.body, fastify)
        return {
          success: true,
          data: result,
        }
      } catch (error) {
        if (error instanceof AuthError) {
          return reply.status(error.statusCode).send({
            success: false,
            error: error.message,
          })
        }
        request.log.error(error)
        return reply.status(500).send({
          success: false,
          error: '注册失败，请稍后重试',
        })
      }
    }
  )

  /**
   * 用户登录
   * POST /auth/login
   */
  fastify.post(
    '/login',
    { schema: loginSchema },
    async (request: FastifyRequest<{ Body: LoginBody }>, reply: FastifyReply) => {
      try {
        const result = await authService.login(request.body, fastify)
        return {
          success: true,
          data: result,
        }
      } catch (error) {
        if (error instanceof AuthError) {
          return reply.status(error.statusCode).send({
            success: false,
            error: error.message,
          })
        }
        request.log.error(error)
        return reply.status(500).send({
          success: false,
          error: '登录失败，请稍后重试',
        })
      }
    }
  )

  /**
   * 获取当前用户信息
   * GET /auth/me
   */
  fastify.get(
    '/me',
    { preHandler: [fastify.authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const payload = request.user as { id: string; email: string }
        const user = await authService.getUserById(payload.id)

        if (!user) {
          return reply.status(404).send({
            success: false,
            error: '用户不存在',
          })
        }

        return {
          success: true,
          data: {
            id: user.id,
            email: user.email,
            nickname: user.nickname,
            avatarUrl: user.avatarUrl,
            role: user.role,
            createdAt: user.createdAt,
          },
        }
      } catch (error) {
        request.log.error(error)
        return reply.status(500).send({
          success: false,
          error: '获取用户信息失败',
        })
      }
    }
  )

  /**
   * 刷新 Token
   * POST /auth/refresh
   */
  fastify.post(
    '/refresh',
    { preHandler: [fastify.authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const payload = request.user as { id: string; email: string }
        const user = await authService.getUserById(payload.id)

        if (!user) {
          return reply.status(401).send({
            success: false,
            error: '用户不存在',
          })
        }

        // 生成新 Token
        const token = fastify.jwt.sign({ id: user.id, email: user.email })

        return {
          success: true,
          data: { token },
        }
      } catch (error) {
        request.log.error(error)
        return reply.status(500).send({
          success: false,
          error: '刷新 Token 失败',
        })
      }
    }
  )
}
