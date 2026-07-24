/**
 * 认证中间件
 * JWT 验证和用户认证相关中间件
 */
import type { FastifyRequest, FastifyReply } from 'fastify'

/**
 * JWT 验证中间件
 * 用于保护需要认证的路由
 */
export async function verifyJWT(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  try {
    await request.jwtVerify()
  } catch (err) {
    reply.status(401).send({
      success: false,
      error: 'Unauthorized',
      message: '请先登录',
    })
  }
}

/**
 * 可选的 JWT 验证中间件
 * 如果提供了 token 则验证，否则继续
 */
export async function optionalJWT(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
  try {
    await request.jwtVerify()
  } catch {
    // 忽略错误，允许未认证用户访问
  }
}

/**
 * 获取当前用户 ID
 */
export function getCurrentUserId(request: FastifyRequest): string | null {
  const user = request.user as { id: string } | undefined
  return user?.id || null
}

/**
 * 获取当前用户信息
 */
export function getCurrentUser(request: FastifyRequest): { id: string; email: string } | null {
  const user = request.user as { id: string; email: string } | undefined
  return user || null
}
