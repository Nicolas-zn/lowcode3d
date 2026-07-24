/**
 * 项目路由
 * 处理项目 CRUD API
 */
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { projectService, ProjectError } from '../services/ProjectService.js'
import type { ISceneData, IProjectSettings } from '@lowcode3d/shared'

interface CreateProjectBody {
  name: string
  description?: string
  sceneData?: ISceneData | null
  thumbnailUrl?: string | null
  isPublic?: boolean
}

interface UpdateProjectBody {
  name?: string
  description?: string
  sceneData?: ISceneData | null
  thumbnailUrl?: string | null
  isPublic?: boolean
  status?: 'draft' | 'published' | 'archived'
  settings?: Partial<IProjectSettings>
}

interface PublishProjectBody {
  sceneData: ISceneData
  publishNote?: string
  sdkVersion?: string
  dataMode?: 'snapshot' | 'live' | 'external'
  embedDefaults?: {
    toolbar?: boolean
    controls?: boolean
    transparent?: boolean
    autoplay?: boolean
  }
  runtimeConfig?: Record<string, unknown>
}

interface ProjectParams {
  id: string
}

interface PublishedVersionParams extends ProjectParams {
  version: string
}

// JSON Schema 验证
const createProjectSchema = {
  body: {
    type: 'object',
    required: ['name'],
    properties: {
      name: { type: 'string', minLength: 1, maxLength: 255 },
      description: { type: 'string', maxLength: 1000 },
      sceneData: { type: ['object', 'null'] },
      thumbnailUrl: { type: ['string', 'null'], maxLength: 2000000 },
      isPublic: { type: 'boolean' },
    },
  },
}

const updateProjectSchema = {
  body: {
    type: 'object',
    properties: {
      name: { type: 'string', minLength: 1, maxLength: 255 },
      description: { type: 'string', maxLength: 1000 },
      sceneData: { type: ['object', 'null'] },
      thumbnailUrl: { type: ['string', 'null'], maxLength: 2000000 },
      isPublic: { type: 'boolean' },
      status: { type: 'string', enum: ['draft', 'published', 'archived'] },
      settings: { type: 'object' },
    },
  },
}

const publishProjectSchema = {
  body: {
    type: 'object',
    required: ['sceneData'],
    properties: {
      sceneData: { type: 'object' },
      publishNote: { type: 'string', maxLength: 1000 },
      sdkVersion: { type: 'string', maxLength: 50 },
      dataMode: { type: 'string', enum: ['snapshot', 'live', 'external'] },
      embedDefaults: { type: 'object' },
      runtimeConfig: { type: 'object' },
    },
  },
}

export async function projectRoutes(fastify: FastifyInstance) {
  /**
   * 获取项目列表
   * GET /projects
   */
  fastify.get(
    '/',
    { preHandler: [fastify.authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const payload = request.user as { id: string }
        const projects = await projectService.getProjectsByOwner(payload.id)

        return {
          success: true,
          data: projects,
          total: projects.length,
        }
      } catch (error) {
        request.log.error(error)
        return reply.status(500).send({
          success: false,
          error: '获取项目列表失败',
        })
      }
    }
  )

  /**
   * 获取所有公开项目
   * GET /projects/public
   */
  fastify.get(
    '/public',
    { preHandler: [fastify.authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const projects = await projectService.getPublicProjects()

        return {
          success: true,
          data: projects,
          total: projects.length,
        }
      } catch (error) {
        request.log.error(error)
        return reply.status(500).send({
          success: false,
          error: '获取公开项目列表失败',
        })
      }
    }
  )

  /**
   * 创建项目
   * POST /projects
   */
  fastify.post<{ Body: CreateProjectBody }>(
    '/',
    { preHandler: [fastify.authenticate], schema: createProjectSchema },
    async (request, reply) => {
      try {
        const payload = request.user as { id: string }
        const { name, description, sceneData, thumbnailUrl, isPublic } = request.body

        const project = await projectService.createProject({
          name,
          description,
          sceneData,
          thumbnailUrl,
          isPublic,
          ownerId: payload.id,
        })

        return reply.status(201).send({
          success: true,
          data: project,
        })
      } catch (error) {
        request.log.error(error)
        return reply.status(500).send({
          success: false,
          error: '创建项目失败',
        })
      }
    }
  )

  /**
   * 获取项目详情
   * GET /projects/:id
   */
  fastify.get<{ Params: ProjectParams }>(
    '/:id',
    { preHandler: [fastify.authenticateOptional] },
    async (request, reply) => {
      try {
        const payload = request.user as { id: string } | undefined
        const { id } = request.params

        const project = await projectService.getProjectById(id, payload?.id)

        if (!project) {
          return reply.status(404).send({
            success: false,
            error: '项目不存在或无权访问',
          })
        }

        return {
          success: true,
          data: project,
        }
      } catch (error) {
        request.log.error(error)
        return reply.status(500).send({
          success: false,
          error: '获取项目详情失败',
        })
      }
    }
  )

  /**
   * 更新项目
   * PUT /projects/:id
   */
  fastify.put<{ Params: ProjectParams; Body: UpdateProjectBody }>(
    '/:id',
    { preHandler: [fastify.authenticate], schema: updateProjectSchema },
    async (request, reply) => {
      try {
        const payload = request.user as { id: string }
        const { id } = request.params

        const project = await projectService.updateProject(id, payload.id, request.body)

        return {
          success: true,
          data: project,
        }
      } catch (error) {
        if (error instanceof ProjectError) {
          return reply.status(error.statusCode).send({
            success: false,
            error: error.message,
          })
        }
        request.log.error(error)
        return reply.status(500).send({
          success: false,
          error: '更新项目失败',
        })
      }
    }
  )

  /**
   * 发布项目快照
   * POST /projects/:id/publish
   */
  fastify.post<{ Params: ProjectParams; Body: PublishProjectBody }>(
    '/:id/publish',
    { preHandler: [fastify.authenticate], schema: publishProjectSchema },
    async (request, reply) => {
      try {
        const payload = request.user as { id: string }
        const { id } = request.params

        const snapshot = await projectService.publishProject(
          id,
          payload.id,
          request.body.sceneData,
          {
            publishNote: request.body.publishNote,
            sdkVersion: request.body.sdkVersion,
            dataMode: request.body.dataMode,
            embedDefaults: request.body.embedDefaults,
            runtimeConfig: request.body.runtimeConfig,
          }
        )

        return {
          success: true,
          data: snapshot,
        }
      } catch (error) {
        if (error instanceof ProjectError) {
          return reply.status(error.statusCode).send({
            success: false,
            error: error.message,
          })
        }
        request.log.error(error)
        return reply.status(500).send({
          success: false,
          error: '发布项目失败',
        })
      }
    }
  )

  /**
   * 获取最新发布快照
   * GET /projects/:id/published
   */
  fastify.get<{ Params: ProjectParams }>('/:id/published', async (request, reply) => {
    try {
      const { id } = request.params
      const snapshot = await projectService.getLatestPublishedProject(id)

      if (!snapshot) {
        return reply.status(404).send({
          success: false,
          error: '发布快照不存在',
        })
      }

      return {
        success: true,
        data: snapshot,
      }
    } catch (error) {
      request.log.error(error)
      return reply.status(500).send({
        success: false,
        error: '获取发布快照失败',
      })
    }
  })

  /**
   * 获取发布版本列表
   * GET /projects/:id/published/versions
   */
  fastify.get<{ Params: ProjectParams }>(
    '/:id/published/versions',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      try {
        const payload = request.user as { id: string }
        const { id } = request.params
        const versions = await projectService.getPublishedVersions(id, payload.id)

        return {
          success: true,
          data: versions,
          total: versions.length,
        }
      } catch (error) {
        request.log.error(error)
        return reply.status(500).send({
          success: false,
          error: '获取发布版本失败',
        })
      }
    }
  )

  /**
   * 回滚发布版本
   * POST /projects/:id/published/:version/rollback
   */
  fastify.post<{ Params: PublishedVersionParams }>(
    '/:id/published/:version/rollback',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      try {
        const payload = request.user as { id: string }
        const { id, version } = request.params
        const snapshot = await projectService.rollbackPublishedVersion(
          id,
          payload.id,
          Number(version)
        )

        return {
          success: true,
          data: snapshot,
        }
      } catch (error) {
        if (error instanceof ProjectError) {
          return reply.status(error.statusCode).send({
            success: false,
            error: error.message,
          })
        }
        request.log.error(error)
        return reply.status(500).send({
          success: false,
          error: '回滚发布版本失败',
        })
      }
    }
  )

  /**
   * 删除项目
   * DELETE /projects/:id
   */
  fastify.delete<{ Params: ProjectParams }>(
    '/:id',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      try {
        const payload = request.user as { id: string }
        const { id } = request.params

        await projectService.deleteProject(id, payload.id)

        return {
          success: true,
          message: '项目已删除',
        }
      } catch (error) {
        if (error instanceof ProjectError) {
          return reply.status(error.statusCode).send({
            success: false,
            error: error.message,
          })
        }
        request.log.error(error)
        return reply.status(500).send({
          success: false,
          error: '删除项目失败',
        })
      }
    }
  )
}
