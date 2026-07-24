/**
 * 健康检查路由
 */
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { sqlite } from '../db/index.js'

export async function healthRoutes(fastify: FastifyInstance) {
  /**
   * 健康检查
   * GET /health
   */
  fastify.get('/health', async (_request: FastifyRequest, _reply: FastifyReply) => {
    const checks: Record<string, { status: string; message?: string }> = {
      server: { status: 'ok' },
    }

    // 检查数据库连接
    try {
      sqlite.prepare('SELECT 1').get()
      checks.database = { status: 'ok' }
    } catch (error) {
      checks.database = {
        status: 'error',
        message: error instanceof Error ? error.message : 'Unknown error',
      }
    }

    // 判断整体状态
    const isHealthy = Object.values(checks).every((check) => check.status === 'ok')

    return {
      success: true,
      status: isHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '0.1.0',
      checks,
    }
  })

  /**
   * 就绪检查（用于 Kubernetes）
   * GET /ready
   */
  fastify.get('/ready', async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      sqlite.prepare('SELECT 1').get()
      return {
        success: true,
        status: 'ready',
      }
    } catch {
      return reply.status(503).send({
        success: false,
        status: 'not_ready',
        error: 'Database connection failed',
      })
    }
  })

  /**
   * 存活检查（用于 Kubernetes）
   * GET /live
   */
  fastify.get('/live', async (_request: FastifyRequest, _reply: FastifyReply) => {
    return {
      success: true,
      status: 'alive',
      timestamp: new Date().toISOString(),
    }
  })
}
