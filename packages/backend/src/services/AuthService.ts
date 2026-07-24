/**
 * 认证服务
 * 处理用户注册、登录等认证相关业务逻辑
 */
import bcrypt from 'bcryptjs'
import type { FastifyInstance } from 'fastify'
import { userRepository, type IUserRepository } from '../repositories/UserRepository.js'
import type { User } from '../db/schema.js'

export interface RegisterDTO {
  email: string
  password: string
  nickname?: string
}

export interface LoginDTO {
  email: string
  password: string
}

export interface AuthResult {
  token: string
  user: {
    id: string
    email: string
    nickname: string | null
    avatarUrl: string | null
    role: string
  }
}

export interface IAuthService {
  register(data: RegisterDTO, fastify: FastifyInstance): Promise<AuthResult>
  login(data: LoginDTO, fastify: FastifyInstance): Promise<AuthResult>
  getUserById(id: string): Promise<User | null>
  getUserByEmail(email: string): Promise<User | null>
}

export class AuthService implements IAuthService {
  private userRepo: IUserRepository

  constructor(userRepo: IUserRepository = userRepository) {
    this.userRepo = userRepo
  }

  /**
   * 用户注册
   */
  async register(data: RegisterDTO, fastify: FastifyInstance): Promise<AuthResult> {
    const { email, password, nickname } = data

    // 检查邮箱是否已存在
    const existingUser = await this.userRepo.findByEmail(email)
    if (existingUser) {
      throw new AuthError('该邮箱已被注册', 400)
    }

    // 密码加密
    const passwordHash = await bcrypt.hash(password, 10)

    // 创建用户
    const user = await this.userRepo.create({
      email,
      passwordHash,
      nickname: nickname || email.split('@')[0],
    })

    // 生成 JWT Token
    const token = fastify.jwt.sign({ id: user.id, email: user.email })

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        nickname: user.nickname,
        avatarUrl: user.avatarUrl,
        role: user.role,
      },
    }
  }

  /**
   * 用户登录
   */
  async login(data: LoginDTO, fastify: FastifyInstance): Promise<AuthResult> {
    const { email, password } = data

    // 查找用户
    const user = await this.userRepo.findByEmail(email)
    if (!user) {
      throw new AuthError('邮箱或密码错误', 401)
    }

    // 验证密码
    const isValid = await bcrypt.compare(password, user.passwordHash)
    if (!isValid) {
      throw new AuthError('邮箱或密码错误', 401)
    }

    // 生成 JWT Token
    const token = fastify.jwt.sign({ id: user.id, email: user.email })

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        nickname: user.nickname,
        avatarUrl: user.avatarUrl,
        role: user.role,
      },
    }
  }

  /**
   * 根据 ID 获取用户
   */
  async getUserById(id: string): Promise<User | null> {
    return await this.userRepo.findById(id)
  }

  /**
   * 根据邮箱获取用户
   */
  async getUserByEmail(email: string): Promise<User | null> {
    return await this.userRepo.findByEmail(email)
  }
}

/**
 * 认证错误类
 */
export class AuthError extends Error {
  public statusCode: number

  constructor(message: string, statusCode: number = 400) {
    super(message)
    this.name = 'AuthError'
    this.statusCode = statusCode
  }
}

// 导出单例实例
export const authService = new AuthService()
