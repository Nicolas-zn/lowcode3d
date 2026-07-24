/**
 * 文件上传路由
 * 处理文件上传
 */
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { storageService, StorageService, StorageError } from '../services/StorageService.js'

// Schema 验证
const uploadQuerySchema = {
  querystring: {
    type: 'object',
    properties: {
      folder: { type: 'string' },
    },
  },
}

export async function uploadRoutes(fastify: FastifyInstance) {
  /**
   * 上传文件
   * POST /upload/file
   */
  fastify.post(
    '/file',
    {
      preHandler: [fastify.authenticate],
      schema: uploadQuerySchema,
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const query = request.query as { folder?: string }
        const data = await request.file()

        if (!data) {
          return reply.status(400).send({
            success: false,
            error: '请选择要上传的文件',
          })
        }

        // 验证文件类型
        const mimeType = data.mimetype
        if (!StorageService.isAllowedMimeType(mimeType)) {
          return reply.status(400).send({
            success: false,
            error: `不支持的文件类型: ${mimeType}`,
            allowedTypes: StorageService.getAllowedMimeTypes(),
          })
        }

        // 读取文件内容
        const chunks: Buffer[] = []
        for await (const chunk of data.file) {
          chunks.push(chunk)
        }
        const buffer = Buffer.concat(chunks)

        // 验证文件大小
        const maxSize = StorageService.getMaxFileSize()
        if (buffer.length > maxSize) {
          return reply.status(400).send({
            success: false,
            error: `文件大小超过限制，最大允许 ${Math.floor(maxSize / 1024 / 1024)}MB`,
          })
        }

        // 获取文件夹参数
        const folder = query.folder || 'uploads'

        // 上传文件
        const result = await storageService.uploadFile(buffer, data.filename, mimeType, { folder })

        return {
          success: true,
          data: {
            url: result.url,
            filename: data.filename,
            mimeType,
            size: buffer.length,
          },
        }
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
          error: '文件上传失败',
        })
      }
    }
  )

  /**
   * 上传多个文件
   * POST /upload/files
   */
  fastify.post(
    '/files',
    {
      preHandler: [fastify.authenticate],
      schema: uploadQuerySchema,
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const query = request.query as { folder?: string }
        const parts = request.files()
        const folder = query.folder || 'uploads'
        const results: Array<{
          url: string
          filename: string
          mimeType: string
          size: number
        }> = []
        const errors: Array<{ filename: string; error: string }> = []
        const maxSize = StorageService.getMaxFileSize()

        for await (const data of parts) {
          // 验证文件类型
          if (!StorageService.isAllowedMimeType(data.mimetype)) {
            errors.push({
              filename: data.filename,
              error: `不支持的文件类型: ${data.mimetype}`,
            })
            continue
          }

          // 读取文件内容
          const chunks: Buffer[] = []
          for await (const chunk of data.file) {
            chunks.push(chunk)
          }
          const buffer = Buffer.concat(chunks)

          // 验证文件大小
          if (buffer.length > maxSize) {
            errors.push({
              filename: data.filename,
              error: '文件大小超过限制',
            })
            continue
          }

          // 上传文件
          try {
            const result = await storageService.uploadFile(buffer, data.filename, data.mimetype, {
              folder,
            })
            results.push({
              url: result.url,
              filename: data.filename,
              mimeType: data.mimetype,
              size: buffer.length,
            })
          } catch {
            errors.push({
              filename: data.filename,
              error: '上传失败',
            })
          }
        }

        return {
          success: true,
          data: {
            uploaded: results,
            errors: errors.length > 0 ? errors : undefined,
          },
        }
      } catch (error) {
        request.log.error(error)
        return reply.status(500).send({
          success: false,
          error: '文件上传失败',
        })
      }
    }
  )

  /**
   * 上传图片（用于缩略图等）
   * POST /upload/image
   */
  fastify.post(
    '/image',
    {
      preHandler: [fastify.authenticate],
      schema: uploadQuerySchema,
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const query = request.query as { folder?: string }
        const data = await request.file()

        if (!data) {
          return reply.status(400).send({
            success: false,
            error: '请选择要上传的图片',
          })
        }

        // 验证是否为图片
        const allowedImageTypes = [
          'image/jpeg',
          'image/png',
          'image/gif',
          'image/webp',
          'image/svg+xml',
        ]
        if (!allowedImageTypes.includes(data.mimetype)) {
          return reply.status(400).send({
            success: false,
            error: '只允许上传图片文件',
            allowedTypes: allowedImageTypes,
          })
        }

        // 读取文件内容
        const chunks: Buffer[] = []
        for await (const chunk of data.file) {
          chunks.push(chunk)
        }
        const buffer = Buffer.concat(chunks)

        // 验证文件大小（图片限制 10MB）
        const maxImageSize = 10 * 1024 * 1024
        if (buffer.length > maxImageSize) {
          return reply.status(400).send({
            success: false,
            error: '图片大小超过限制，最大允许 10MB',
          })
        }

        // 上传到 images 文件夹
        const folder = query.folder || 'images'
        const result = await storageService.uploadFile(buffer, data.filename, data.mimetype, {
          folder,
        })

        return {
          success: true,
          data: {
            url: result.url,
            filename: data.filename,
            mimeType: data.mimetype,
            size: buffer.length,
          },
        }
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
          error: '图片上传失败',
        })
      }
    }
  )

  /**
   * 上传 3D 模型
   * POST /upload/model
   */
  fastify.post(
    '/model',
    { preHandler: [fastify.authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const data = await request.file()

        if (!data) {
          return reply.status(400).send({
            success: false,
            error: '请选择要上传的模型文件',
          })
        }

        // 验证是否为 3D 模型
        const allowedModelTypes = [
          'model/gltf-binary',
          'model/gltf+json',
          'application/octet-stream', // .glb 文件
        ]

        // 也检查文件扩展名
        const allowedExtensions = ['.glb', '.gltf']
        const ext = data.filename.toLowerCase().substring(data.filename.lastIndexOf('.'))

        if (!allowedModelTypes.includes(data.mimetype) && !allowedExtensions.includes(ext)) {
          return reply.status(400).send({
            success: false,
            error: '只允许上传 GLTF/GLB 格式的 3D 模型',
          })
        }

        // 读取文件内容
        const chunks: Buffer[] = []
        for await (const chunk of data.file) {
          chunks.push(chunk)
        }
        const buffer = Buffer.concat(chunks)

        // 验证文件大小（模型限制 50MB）
        const maxModelSize = 50 * 1024 * 1024
        if (buffer.length > maxModelSize) {
          return reply.status(400).send({
            success: false,
            error: '模型文件大小超过限制，最大允许 50MB',
          })
        }

        // 上传到 models 文件夹
        const result = await storageService.uploadFile(buffer, data.filename, data.mimetype, {
          folder: 'models',
        })

        return {
          success: true,
          data: {
            url: result.url,
            filename: data.filename,
            mimeType: data.mimetype,
            size: buffer.length,
          },
        }
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
          error: '模型上传失败',
        })
      }
    }
  )
}
