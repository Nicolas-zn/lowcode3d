/**
 * 资源路由
 * 处理资源 CRUD API
 */
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { assetService, AssetError } from '../services/AssetService.js'
import { storageService, StorageService, StorageError } from '../services/StorageService.js'
import { AssetOptimizer } from '../services/AssetOptimizer.js'
import type { AssetType } from '../repositories/AssetRepository.js'

// JSON Schema 验证
const uploadQuerySchema = {
  querystring: {
    type: 'object',
    properties: {
      name: { type: 'string' },
      type: { type: 'string' },
      category: { type: 'string' },
      tags: { type: 'string' },
      isPublic: { type: 'string' },
    },
  },
}

const assetIdParamsSchema = {
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: { type: 'string' },
    },
  },
}

const getAssetsQuerySchema = {
  querystring: {
    type: 'object',
    properties: {
      type: {
        type: 'string',
        enum: ['model', 'texture', 'hdri', 'billboard', 'place_icon', 'other'],
      },
    },
  },
}

const createUrlAssetSchema = {
  body: {
    type: 'object',
    required: ['name', 'url'],
    properties: {
      name: { type: 'string' },
      url: { type: 'string' },
      type: {
        type: 'string',
        enum: ['model', 'texture', 'hdri', 'billboard', 'place_icon', 'other'],
      },
      category: { type: 'string' },
      tags: {
        type: 'array',
        items: { type: 'string' },
      },
      thumbnailUrl: { type: 'string' },
      isPublic: { type: 'boolean' },
    },
  },
}

function isHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

function getFileNameFromUrl(url: string): string {
  try {
    const pathname = new URL(url).pathname
    const fileName = pathname.split('/').filter(Boolean).pop()
    return fileName || 'external-resource'
  } catch {
    return 'external-resource'
  }
}

function getMimeTypeFromFileName(fileName: string, assetType: AssetType): string {
  const lower = fileName.toLowerCase()
  if (lower.endsWith('.glb')) return 'model/gltf-binary'
  if (lower.endsWith('.gltf')) return 'model/gltf+json'
  if (lower.endsWith('.hdr')) return 'image/vnd.radiance'
  if (lower.endsWith('.exr')) return 'image/aces'
  if (lower.endsWith('.png')) return 'image/png'
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg'
  if (lower.endsWith('.webp')) return 'image/webp'
  if (lower.endsWith('.svg')) return 'image/svg+xml'
  return assetType === 'model' ? 'model/gltf-binary' : 'application/octet-stream'
}

export async function assetRoutes(fastify: FastifyInstance) {
  /**
   * 获取资源列表
   * GET /assets
   */
  fastify.get(
    '/',
    {
      preHandler: [fastify.authenticate],
      schema: getAssetsQuerySchema,
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const payload = request.user as { id: string }
        const query = request.query as { type?: AssetType }

        let assets
        if (query.type) {
          assets = await assetService.getAssetsByType(payload.id, query.type)
        } else {
          assets = await assetService.getAssetsByOwner(payload.id)
        }

        return {
          success: true,
          data: assets,
          total: assets.length,
        }
      } catch (error) {
        request.log.error(error)
        return reply.status(500).send({
          success: false,
          error: '获取资源列表失败',
        })
      }
    }
  )

  /**
   * 获取资源详情
   * GET /assets/:id
   */
  fastify.get(
    '/:id',
    {
      preHandler: [fastify.authenticate],
      schema: assetIdParamsSchema,
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const payload = request.user as { id: string }
        const params = request.params as { id: string }

        const asset = await assetService.getAssetById(params.id, payload.id)

        if (!asset) {
          return reply.status(404).send({
            success: false,
            error: '资源不存在或无权访问',
          })
        }

        return {
          success: true,
          data: asset,
        }
      } catch (error) {
        request.log.error(error)
        return reply.status(500).send({
          success: false,
          error: '获取资源详情失败',
        })
      }
    }
  )

  /**
   * 上传资源（支持缩略图）
   * POST /assets/upload
   */
  fastify.post(
    '/upload',
    {
      preHandler: [fastify.authenticate],
      schema: uploadQuerySchema,
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const payload = request.user as { id: string }
        const query = request.query as {
          name?: string
          category?: string
          tags?: string
          optimize?: string
          type?: string
          isPublic?: string
        }

        // 获取所有上传的文件
        const parts = request.parts()

        let mainFileBuffer: Buffer | null = null
        let mainFileName = ''
        let mainMimeType = ''
        let thumbnailBuffer: Buffer | null = null
        let thumbnailFileName = ''
        let thumbnailMimeType = ''

        for await (const part of parts) {
          if (part.type === 'file') {
            const chunks: Buffer[] = []
            for await (const chunk of part.file) {
              chunks.push(chunk)
            }
            const buffer = Buffer.concat(chunks)

            if (part.fieldname === 'file') {
              mainFileBuffer = buffer
              mainFileName = part.filename
              mainMimeType = part.mimetype
            } else if (part.fieldname === 'thumbnail') {
              thumbnailBuffer = buffer
              thumbnailFileName = part.filename
              thumbnailMimeType = part.mimetype
            }
          }
        }

        if (!mainFileBuffer || !mainFileName) {
          return reply.status(400).send({
            success: false,
            error: '请选择要上传的文件',
          })
        }

        // 验证主文件类型
        if (!StorageService.isAllowedMimeType(mainMimeType)) {
          return reply.status(400).send({
            success: false,
            error: `不支持的文件类型: ${mainMimeType}`,
            allowedTypes: StorageService.getAllowedMimeTypes(),
          })
        }

        // 验证文件大小
        const maxSize = StorageService.getMaxFileSize()
        if (mainFileBuffer.length > maxSize) {
          return reply.status(400).send({
            success: false,
            error: `文件大小超过限制，最大允许 ${Math.floor(maxSize / 1024 / 1024)}MB`,
          })
        }

        // 判断资源类型和目标文件夹
        const assetType = (query.type as any) || StorageService.getAssetType(mainFileName)
        const folder = StorageService.getFolderByAssetType(assetType)

        let optimizationStats: Record<string, number> | undefined
        let optimizationRecommendations:
          | ReturnType<typeof AssetOptimizer.buildOptimizationRecommendations>
          | undefined
        const shouldAnalyzeModel =
          assetType === 'model' && mainFileName.toLowerCase().endsWith('.glb')

        if (shouldAnalyzeModel) {
          try {
            if (query.optimize === 'true') {
              const result = await AssetOptimizer.optimize(mainFileBuffer)
              mainFileBuffer = result.optimizedBuffer
              optimizationStats = result.stats
              optimizationRecommendations = result.optimizationRecommendations
              request.log.info(`Optimized ${mainFileName}: ${JSON.stringify(result.stats)}`)
            } else {
              const result = await AssetOptimizer.inspect(mainFileBuffer)
              optimizationStats = result.stats
              optimizationRecommendations = result.optimizationRecommendations
              request.log.info(`Inspected ${mainFileName}: ${JSON.stringify(result.stats)}`)
            }
          } catch (e) {
            request.log.warn(
              `Model analysis failed for ${mainFileName}, using original file. Error: ${e}`
            )
          }
        }

        // 上传主文件
        const uploadResult = await storageService.uploadFile(
          mainFileBuffer,
          mainFileName,
          mainMimeType,
          { folder }
        )

        // 上传缩略图（如果有）
        let thumbnailPath: string | undefined = undefined
        if (thumbnailBuffer && thumbnailFileName) {
          const thumbnailResult = await storageService.uploadFile(
            thumbnailBuffer,
            thumbnailFileName,
            thumbnailMimeType,
            { folder: 'thumbnails' }
          )
          thumbnailPath = thumbnailResult.filePath
        } else if (['place_icon', 'texture'].includes(assetType)) {
          // 如果是图标或纹理，且未上传缩略图，直接使用原图作为缩略图
          thumbnailPath = uploadResult.filePath
        }

        // 解析标签
        const tags = query.tags ? query.tags.split(',').map((t) => t.trim()) : undefined

        // 创建资源记录
        const asset = await assetService.createAsset({
          ownerId: payload.id,
          name: query.name || mainFileName.replace(/\.[^/.]+$/, ''),
          type: assetType,
          category: query.category,
          filePath: uploadResult.filePath,
          fileName: uploadResult.fileName,
          mimeType: mainMimeType,
          fileSize: mainFileBuffer.length,
          thumbnailPath,
          isPublic: query.isPublic === 'true',
          metadata: {
            ...(tags ? { tags } : {}),
            ...(optimizationStats || {}),
            ...(optimizationStats
              ? {
                  optimization: {
                    stats: optimizationStats,
                    recommendations: optimizationRecommendations ?? [],
                  },
                  optimizationRecommendations: optimizationRecommendations ?? [],
                }
              : {}),
          },
        })

        return reply.status(201).send({
          success: true,
          data: asset,
        })
      } catch (error) {
        if (error instanceof StorageError) {
          return reply.status(400).send({
            success: false,
            error: error.message,
          })
        }
        request.log.error(error)
        return reply.status(500).send({
          success: false,
          error: '上传资源失败',
        })
      }
    }
  )

  /**
   * 记录已有资源 URL
   * POST /assets/url
   */
  fastify.post(
    '/url',
    {
      preHandler: [fastify.authenticate],
      schema: createUrlAssetSchema,
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const payload = request.user as { id: string }
        const body = request.body as {
          name: string
          url: string
          type?: AssetType
          category?: string
          tags?: string[]
          thumbnailUrl?: string
          isPublic?: boolean
        }

        const sourceUrl = body.url.trim()
        const thumbnailUrl = body.thumbnailUrl?.trim()

        if (!isHttpUrl(sourceUrl)) {
          return reply.status(400).send({
            success: false,
            error: '请输入有效的 http/https 资源 URL',
          })
        }

        if (thumbnailUrl && !isHttpUrl(thumbnailUrl)) {
          return reply.status(400).send({
            success: false,
            error: '请输入有效的 http/https 缩略图 URL',
          })
        }

        const fileName = getFileNameFromUrl(sourceUrl)
        const assetType = body.type || StorageService.getAssetType(fileName)

        if (assetType === 'model' && !/\.(glb|gltf)(\?.*)?$/i.test(sourceUrl)) {
          return reply.status(400).send({
            success: false,
            error: '模型 URL 仅支持 GLB/GLTF 文件',
          })
        }

        const asset = await assetService.createAsset({
          ownerId: payload.id,
          name: body.name.trim(),
          type: assetType,
          category: body.category,
          filePath: sourceUrl,
          fileName,
          mimeType: getMimeTypeFromFileName(fileName, assetType),
          fileSize: 0,
          thumbnailPath: thumbnailUrl || undefined,
          isPublic: body.isPublic ?? true,
          metadata: {
            source: 'externalUrl',
            externalUrl: sourceUrl,
            ...(body.tags?.length ? { tags: body.tags } : {}),
          },
        })

        return reply.status(201).send({
          success: true,
          data: asset,
        })
      } catch (error) {
        if (error instanceof AssetError) {
          return reply.status(error.statusCode).send({
            success: false,
            error: error.message,
          })
        }
        request.log.error(error)
        return reply.status(500).send({
          success: false,
          error: '记录资源 URL 失败',
        })
      }
    }
  )

  /**
   * 更新资源
   * PUT /assets/:id
   */
  fastify.put(
    '/:id',
    {
      preHandler: [fastify.authenticate],
      schema: {
        params: assetIdParamsSchema.params,
        querystring: uploadQuerySchema.querystring,
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const payload = request.user as { id: string }
        const params = request.params as { id: string }
        const query = request.query as {
          name?: string
          category?: string
          tags?: string
          optimize?: string
          isPublic?: string
        }

        // 检查是否有文件上传
        let mainFileBuffer: Buffer | null = null
        let mainFileName = ''
        let mainMimeType = ''
        let mainFileSize = 0
        let thumbnailBuffer: Buffer | null = null
        let thumbnailFileName = ''
        let thumbnailMimeType = ''

        if (request.isMultipart()) {
          const parts = request.parts()
          for await (const part of parts) {
            if (part.type === 'file') {
              const chunks: Buffer[] = []
              for await (const chunk of part.file) {
                chunks.push(chunk)
              }
              const buffer = Buffer.concat(chunks)

              if (part.fieldname === 'file') {
                mainFileBuffer = buffer
                mainFileName = part.filename
                mainMimeType = part.mimetype
                mainFileSize = buffer.length
              } else if (part.fieldname === 'thumbnail') {
                thumbnailBuffer = buffer
                thumbnailFileName = part.filename
                thumbnailMimeType = part.mimetype
              }
            }
          }
        }

        const updateData: any = {
          ownerId: payload.id,
          name: query.name,
          category: query.category,
          isPublic: query.isPublic !== undefined ? query.isPublic === 'true' : undefined,
        }

        if (query.tags) {
          updateData.metadata = { tags: query.tags.split(',').map((t: string) => t.trim()) }
        }

        // 如果上传了新文件
        if (mainFileBuffer && mainFileName) {
          // 验证文件类型
          if (!StorageService.isAllowedMimeType(mainMimeType)) {
            return reply.status(400).send({
              success: false,
              error: `不支持的文件类型: ${mainMimeType}`,
            })
          }

          // 验证文件大小
          const maxSize = StorageService.getMaxFileSize()
          if (mainFileBuffer.length > maxSize) {
            return reply.status(400).send({
              success: false,
              error: `文件大小超过限制`,
            })
          }

          // 根据文件名判断类型
          const assetType = StorageService.getAssetType(mainFileName)
          const folder = StorageService.getFolderByAssetType(assetType)
          let workingBuffer = mainFileBuffer

          const shouldAnalyzeModel =
            assetType === 'model' && mainFileName.toLowerCase().endsWith('.glb')

          if (shouldAnalyzeModel) {
            try {
              if (query.optimize === 'true') {
                const result = await AssetOptimizer.optimize(workingBuffer)
                workingBuffer = result.optimizedBuffer
                if (!updateData.metadata) updateData.metadata = {}
                Object.assign(updateData.metadata, result.stats, {
                  optimization: {
                    stats: result.stats,
                    recommendations: result.optimizationRecommendations,
                  },
                  optimizationRecommendations: result.optimizationRecommendations,
                })
                request.log.info(`Analyzed ${mainFileName}: ${JSON.stringify(result.stats)}`)
              } else {
                const result = await AssetOptimizer.inspect(workingBuffer)
                if (!updateData.metadata) updateData.metadata = {}
                Object.assign(updateData.metadata, result.stats, {
                  optimization: {
                    stats: result.stats,
                    recommendations: result.optimizationRecommendations,
                  },
                  optimizationRecommendations: result.optimizationRecommendations,
                })
                request.log.info(`Analyzed ${mainFileName}: ${JSON.stringify(result.stats)}`)
              }
            } catch (e) {
              request.log.warn(
                `Model analysis failed for ${mainFileName}, using original file. Error: ${e}`
              )
            }
          }

          // 上传文件
          const uploadResult = await storageService.uploadFile(
            workingBuffer,
            mainFileName,
            mainMimeType,
            { folder }
          )

          updateData.filePath = uploadResult.filePath
          updateData.fileName = uploadResult.fileName
          updateData.mimeType = mainMimeType
          updateData.fileSize = workingBuffer.length || mainFileSize
        }

        // 如果上传了新缩略图
        if (thumbnailBuffer && thumbnailFileName) {
          const thumbnailResult = await storageService.uploadFile(
            thumbnailBuffer,
            thumbnailFileName,
            thumbnailMimeType,
            { folder: 'thumbnails' }
          )
          updateData.thumbnailPath = thumbnailResult.filePath
        }

        const updatedAsset = await assetService.updateAsset(params.id, payload.id, updateData)

        return {
          success: true,
          data: updatedAsset,
        }
      } catch (error) {
        if (error instanceof AssetError) {
          return reply.status(error.statusCode).send({
            success: false,
            error: error.message,
          })
        }
        if (error instanceof StorageError) {
          return reply.status(400).send({
            success: false,
            error: error.message,
          })
        }
        request.log.error(error)
        return reply.status(500).send({
          success: false,
          error: '更新资源失败',
        })
      }
    }
  )

  /**
   * 删除资源
   * DELETE /assets/:id
   */
  fastify.delete(
    '/:id',
    {
      preHandler: [fastify.authenticate],
      schema: assetIdParamsSchema,
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const payload = request.user as { id: string }
        const params = request.params as { id: string }

        await assetService.deleteAsset(params.id, payload.id)

        return {
          success: true,
          message: '资源已删除',
        }
      } catch (error) {
        if (error instanceof AssetError) {
          return reply.status(error.statusCode).send({
            success: false,
            error: error.message,
          })
        }
        request.log.error(error)
        return reply.status(500).send({
          success: false,
          error: '删除资源失败',
        })
      }
    }
  )
}
