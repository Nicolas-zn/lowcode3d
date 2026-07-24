/**
 * 认证 API
 * 处理用户注册、登录相关接口
 */
import { post, get, setToken } from './http'

export interface User {
  id: string
  email: string
  nickname: string
  avatarUrl?: string
  role?: 'admin' | 'user' | 'tempuser'
  createdAt: string
}

export interface LoginData {
  email: string
  password: string
}

export interface RegisterData {
  email: string
  password: string
  nickname?: string
}

export interface AuthResult {
  user: User
  token: string
}

/**
 * 用户登录
 */
export async function login(data: LoginData): Promise<AuthResult> {
  const response = await post<AuthResult>('/auth/login', data)
  if (response.success && response.data) {
    setToken(response.data.token)
    return response.data
  }
  throw new Error(response.error || '登录失败')
}

/**
 * 用户注册
 */
export async function register(data: RegisterData): Promise<AuthResult> {
  const response = await post<AuthResult>('/auth/register', data)
  if (response.success && response.data) {
    setToken(response.data.token)
    return response.data
  }
  throw new Error(response.error || '注册失败')
}

/**
 * 获取当前用户信息
 */
export async function getCurrentUser(): Promise<User> {
  const response = await get<User>('/auth/me')
  if (response.success && response.data) {
    return response.data
  }
  throw new Error(response.error || '获取用户信息失败')
}

/**
 * 刷新 Token
 */
export async function refreshToken(): Promise<string> {
  const response = await post<{ token: string }>('/auth/refresh')
  if (response.success && response.data) {
    setToken(response.data.token)
    return response.data.token
  }
  throw new Error(response.error || '刷新Token失败')
}
