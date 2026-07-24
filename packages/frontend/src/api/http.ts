/**
 * HTTP 请求封装
 * 基于 fetch API 的封装，支持 JWT 认证
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api'

// 开发调试：打印 API 基础 URL
console.log('[HTTP] API_BASE_URL:', API_BASE_URL, 'ENV:', import.meta.env.VITE_API_BASE_URL)

interface RequestOptions extends RequestInit {
  params?: Record<string, string | number>
}

interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
  message?: string
  total?: number
}

// 获取 Token
function getToken(): string | null {
  return localStorage.getItem('token')
}

// 设置 Token
export function setToken(token: string): void {
  localStorage.setItem('token', token)
}

// 清除 Token
export function clearToken(): void {
  localStorage.removeItem('token')
}

// 请求封装
async function request<T>(endpoint: string, options: RequestOptions = {}): Promise<ApiResponse<T>> {
  const { params, ...fetchOptions } = options

  // 构建 URL
  let url = `${API_BASE_URL}${endpoint}`
  if (params) {
    const searchParams = new URLSearchParams()
    Object.entries(params).forEach(([key, value]) => {
      searchParams.append(key, String(value))
    })
    url += `?${searchParams.toString()}`
  }

  // 设置默认 headers
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  }

  // 只在有 body 时才设置 Content-Type
  if (fetchOptions.body) {
    headers['Content-Type'] = 'application/json'
  }

  // 添加 Token
  const token = getToken()
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      headers,
    })

    const data: ApiResponse<T> = await response.json()

    // 处理非成功响应
    if (!response.ok) {
      // 401 未授权 - 只有在非登录请求时才跳转
      if (response.status === 401 && !endpoint.includes('/auth/login')) {
        clearToken()
        window.location.href = '/#/login'
        // 返回一个 rejected promise 阻止后续处理
        return Promise.reject(new Error('Unauthorized'))
      }
      // 返回包含错误信息的响应，让调用者处理
      return data
    }

    return data
  } catch (error) {
    console.error('Request error:', error)
    throw error
  }
}

// GET 请求
export async function get<T>(
  endpoint: string,
  params?: Record<string, string | number>
): Promise<ApiResponse<T>> {
  return request<T>(endpoint, { method: 'GET', params })
}

// POST 请求
export async function post<T>(endpoint: string, body?: unknown): Promise<ApiResponse<T>> {
  return request<T>(endpoint, {
    method: 'POST',
    body: body ? JSON.stringify(body) : undefined,
  })
}

// PUT 请求
export async function put<T>(endpoint: string, body?: unknown): Promise<ApiResponse<T>> {
  return request<T>(endpoint, {
    method: 'PUT',
    body: body ? JSON.stringify(body) : undefined,
  })
}

// DELETE 请求
export async function del<T>(endpoint: string): Promise<ApiResponse<T>> {
  return request<T>(endpoint, { method: 'DELETE' })
}

export default {
  get,
  post,
  put,
  del,
  setToken,
  clearToken,
}
