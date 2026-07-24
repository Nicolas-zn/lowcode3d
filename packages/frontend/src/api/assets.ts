/**
 * 资源 API 模块
 * 处理模型、纹理等资源的上传和管理
 */
import { get, post, del } from './http'

/**
 * 资源类型
 */
export type AssetType =
  | 'model'
  | 'texture'
  | 'material'
  | 'hdri'
  | 'billboard'
  | 'place_icon'
  | 'other'

/**
 * 资源项接口
 */
export interface Asset {
  id: string
  name: string
  type: AssetType
  category: string | null
  url: string
  fileName: string
  mimeType: string
  fileSize: number
  thumbnailUrl: string | null
  metadata: Record<string, unknown> | null
  tags?: string[]
  isPublic: boolean
  createdAt: string
}

/**
 * 上传资源响应
 */
export interface UploadAssetResponse {
  success: boolean
  data?: Asset
  error?: string
}

export interface CreateUrlAssetData {
  name: string
  url: string
  type?: AssetType
  category?: string
  tags?: string[]
  thumbnailUrl?: string
  isPublic?: boolean
}

/**
 * 获取资源列表响应
 */
export interface GetAssetsResponse {
  success: boolean
  data?: Asset[]
  total?: number
  error?: string
}

/**
 * 获取 Token
 */
function getToken(): string | null {
  return localStorage.getItem('token')
}

/**
 * 上传资源文件（支持缩略图）
 * @param file 文件对象
 * @param options 上传选项
 */
export async function uploadAsset(
  file: File,
  options?: {
    name?: string
    category?: string
    thumbnail?: File
    tags?: string[]
    optimize?: boolean
    type?: AssetType
    isPublic?: boolean
  }
): Promise<UploadAssetResponse> {
  const formData = new FormData()
  formData.append('file', file)

  // 上传缩略图
  if (options?.thumbnail) {
    formData.append('thumbnail', options.thumbnail)
  }

  // 构建 URL 参数
  const params = new URLSearchParams()
  if (options?.name) {
    params.append('name', options.name)
  }
  if (options?.category) {
    params.append('category', options.category)
  }
  if (options?.tags && options.tags.length > 0) {
    params.append('tags', options.tags.join(','))
  }
  if (options?.optimize !== undefined) {
    params.append('optimize', String(options.optimize))
  }
  if (options?.type) {
    params.append('type', options.type)
  }
  if (options?.isPublic !== undefined) {
    params.append('isPublic', String(options.isPublic))
  }

  const queryString = params.toString()
  const url = `/assets/upload${queryString ? `?${queryString}` : ''}`

  try {
    const token = getToken()
    const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || '/api'}${url}`, {
      method: 'POST',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: formData,
    })

    const data = await response.json()

    if (!response.ok) {
      return {
        success: false,
        error: data.error || '上传失败',
      }
    }

    return data
  } catch (error) {
    console.error('Upload error:', error)
    return {
      success: false,
      error: '网络错误，上传失败',
    }
  }
}

/**
 * 批量上传资源文件
 * @param files 文件列表
 * @param options 上传选项
 */
export async function uploadAssets(
  files: File[],
  options?: {
    category?: string
    onProgress?: (uploaded: number, total: number) => void
  }
): Promise<{
  success: boolean
  uploaded: Asset[]
  failed: { fileName: string; error: string }[]
}> {
  const uploaded: Asset[] = []
  const failed: { fileName: string; error: string }[] = []
  const total = files.length
  let completed = 0

  for (const file of files) {
    const result = await uploadAsset(file, {
      name: file.name.replace(/\.[^/.]+$/, ''), // 移除扩展名
      category: options?.category,
    })

    if (result.success && result.data) {
      uploaded.push(result.data)
    } else {
      failed.push({
        fileName: file.name,
        error: result.error || '上传失败',
      })
    }

    completed++
    options?.onProgress?.(completed, total)
  }

  return {
    success: failed.length === 0,
    uploaded,
    failed,
  }
}

/**
 * 记录已有资源 URL
 */
export async function createAssetFromUrl(data: CreateUrlAssetData): Promise<UploadAssetResponse> {
  return await post<Asset>('/assets/url', data)
}

/**
 * 获取当前用户的资源列表
 * @param type 资源类型过滤
 */
export async function getAssets(type?: AssetType): Promise<GetAssetsResponse> {
  const params: Record<string, string> = {}
  if (type) {
    params.type = type
  }
  return await get<Asset[]>('/assets', params)
}

/**
 * 获取当前用户的模型列表
 */
export async function getModels(): Promise<GetAssetsResponse> {
  return await getAssets('model')
}

/**
 * 获取当前用户的纹理列表
 */
export async function getTextures(): Promise<GetAssetsResponse> {
  return await getAssets('texture')
}

/**
 * 获取资源详情
 * @param id 资源 ID
 */
export async function getAsset(id: string): Promise<{
  success: boolean
  data?: Asset
  error?: string
}> {
  return await get<Asset>(`/assets/${id}`)
}

/**
 * 更新资源
 * @param id 资源ID
 * @param file (可选) 新的主文件
 * @param options 更新选项
 */
export async function updateAsset(
  id: string,
  file?: File,
  options?: {
    name?: string
    category?: string
    thumbnail?: File
    tags?: string[]
    optimize?: boolean
    isPublic?: boolean
  }
): Promise<UploadAssetResponse> {
  const formData = new FormData()

  if (file) {
    formData.append('file', file)
  }

  if (options?.thumbnail) {
    formData.append('thumbnail', options.thumbnail)
  }

  // 构建 URL 参数
  const params = new URLSearchParams()
  if (options?.name !== undefined) {
    params.append('name', options.name)
  }
  if (options?.category !== undefined) {
    params.append('category', options.category)
  }
  if (options?.tags) {
    params.append('tags', options.tags.join(','))
  }
  if (options?.optimize !== undefined) {
    params.append('optimize', String(options.optimize))
  }
  if (options?.isPublic !== undefined) {
    params.append('isPublic', String(options.isPublic))
  }

  const queryString = params.toString()
  const url = `/assets/${id}${queryString ? `?${queryString}` : ''}`

  try {
    const token = getToken()
    const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || '/api'}${url}`, {
      method: 'PUT',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: formData,
    })

    const data = await response.json()

    if (!response.ok) {
      return {
        success: false,
        error: data.error || '更新失败',
      }
    }

    return data
  } catch (error) {
    console.error('Update error:', error)
    return {
      success: false,
      error: '网络错误，更新失败',
    }
  }
}

/**
 * 删除资源
 * @param id 资源 ID
 */
export async function deleteAsset(id: string): Promise<{
  success: boolean
  message?: string
  error?: string
}> {
  return await del(`/assets/${id}`)
}

/**
 * 上传模型文件（便捷方法）
 * @param file 模型文件
 * @param name 模型名称
 */
export async function uploadModel(file: File, name?: string): Promise<UploadAssetResponse> {
  return await uploadAsset(file, {
    name: name || file.name.replace(/\.[^/.]+$/, ''),
    category: '已上传',
  })
}

/**
 * 上传纹理文件（便捷方法）
 * @param file 纹理文件
 * @param name 纹理名称
 */
export async function uploadTexture(file: File, name?: string): Promise<UploadAssetResponse> {
  return await uploadAsset(file, {
    name: name || file.name.replace(/\.[^/.]+$/, ''),
    category: '已上传',
  })
}
