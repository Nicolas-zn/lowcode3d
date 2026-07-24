/**
 * 项目列表状态管理
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { projectsApi } from '@/api'
import type {
  Project,
  CreateProjectData,
  PublishedProject,
  PublishProjectData,
  UpdateProjectData,
} from '@/api/projects'
import type { IProjectData } from '@lowcode3d/shared'
import { SceneSerializer } from '@/engine/core/SceneSerializer'

export const useProjectStore = defineStore('project', () => {
  // 状态
  const projects = ref<Project[]>([])
  const currentProject = ref<Project | null>(null)
  const publishedVersions = ref<PublishedProject[]>([])
  const loading = ref(false)
  const saving = ref(false)
  const error = ref<string | null>(null)

  // 计算属性
  const projectCount = computed(() => projects.value.length)
  const hasProjects = computed(() => projects.value.length > 0)

  // 获取项目列表
  async function fetchProjects() {
    loading.value = true
    error.value = null
    try {
      projects.value = await projectsApi.getProjects()
      return projects.value
    } catch (e) {
      error.value = e instanceof Error ? e.message : '获取项目列表失败'
      throw e
    } finally {
      loading.value = false
    }
  }

  // 获取公开项目列表
  async function fetchPublicProjects() {
    loading.value = true
    error.value = null
    try {
      const projects = await projectsApi.getPublicProjects()
      return projects
    } catch (e) {
      error.value = e instanceof Error ? e.message : '获取公开项目列表失败'
      throw e
    } finally {
      loading.value = false
    }
  }

  // 获取项目详情
  async function fetchProject(id: string) {
    loading.value = true
    error.value = null
    try {
      currentProject.value = await projectsApi.getProject(id)
      return currentProject.value
    } catch (e) {
      error.value = e instanceof Error ? e.message : '获取项目详情失败'
      throw e
    } finally {
      loading.value = false
    }
  }

  // 创建项目
  async function createProject(data: CreateProjectData) {
    loading.value = true
    error.value = null
    try {
      const project = await projectsApi.createProject(data)
      projects.value.unshift(project)
      return project
    } catch (e) {
      error.value = e instanceof Error ? e.message : '创建项目失败'
      throw e
    } finally {
      loading.value = false
    }
  }

  // 更新项目
  async function updateProject(id: string, data: UpdateProjectData) {
    loading.value = true
    error.value = null
    try {
      const project = await projectsApi.updateProject(id, data)
      const index = projects.value.findIndex((p) => p.id === id)
      if (index !== -1) {
        projects.value[index] = project
      }
      if (currentProject.value?.id === id) {
        currentProject.value = project
      }
      return project
    } catch (e) {
      error.value = e instanceof Error ? e.message : '更新项目失败'
      throw e
    } finally {
      loading.value = false
    }
  }

  // 删除项目
  async function deleteProject(id: string) {
    loading.value = true
    error.value = null
    try {
      await projectsApi.deleteProject(id)
      projects.value = projects.value.filter((p) => p.id !== id)
      if (currentProject.value?.id === id) {
        currentProject.value = null
      }
    } catch (e) {
      error.value = e instanceof Error ? e.message : '删除项目失败'
      throw e
    } finally {
      loading.value = false
    }
  }

  // 设置当前项目
  function setCurrentProject(project: Project | null) {
    currentProject.value = project
  }

  // 清空状态
  function clearState() {
    projects.value = []
    currentProject.value = null
    error.value = null
  }

  /**
   * 保存当前项目场景
   */
  async function saveProject(): Promise<IProjectData | null> {
    if (!currentProject.value) {
      error.value = '没有打开的项目'
      return null
    }

    saving.value = true
    error.value = null

    try {
      // 序列化场景，使用最新时间戳
      const projectData = SceneSerializer.serialize(
        currentProject.value.name,
        currentProject.value.description
      )

      // 确保 updatedAt 是当前时间
      projectData.updatedAt = new Date().toISOString()

      // 更新到后端
      const updatedProject = await projectsApi.updateProject(currentProject.value.id, {
        sceneData: projectData,
      })

      // 更新本地 currentProject 状态
      currentProject.value = updatedProject

      // 同步更新 projects 列表中的项目
      const index = projects.value.findIndex((p) => p.id === updatedProject.id)
      if (index !== -1) {
        projects.value[index] = updatedProject
      }

      console.log('Project saved:', projectData)
      return projectData
    } catch (e) {
      error.value = e instanceof Error ? e.message : '保存项目失败'
      throw e
    } finally {
      saving.value = false
    }
  }

  /**
   * 发布当前项目快照
   */
  async function publishProject(
    projectData: IProjectData,
    options: Omit<PublishProjectData, 'sceneData'> = {}
  ): Promise<PublishedProject> {
    if (!currentProject.value) {
      error.value = '没有打开的项目'
      throw new Error(error.value)
    }

    saving.value = true
    error.value = null

    try {
      projectData.updatedAt = new Date().toISOString()

      const publishedProject = await projectsApi.publishProject(currentProject.value.id, {
        sceneData: projectData,
        ...options,
      })
      const updatedProject = await projectsApi.getProject(currentProject.value.id)

      currentProject.value = updatedProject
      publishedVersions.value = await projectsApi.getPublishedVersions(currentProject.value.id)

      const index = projects.value.findIndex((p) => p.id === updatedProject.id)
      if (index !== -1) {
        projects.value[index] = updatedProject
      }

      return publishedProject
    } catch (e) {
      error.value = e instanceof Error ? e.message : '发布项目失败'
      throw e
    } finally {
      saving.value = false
    }
  }

  /**
   * 获取当前项目的发布版本列表
   */
  async function fetchPublishedVersions(
    projectId = currentProject.value?.id
  ): Promise<PublishedProject[]> {
    if (!projectId) {
      error.value = '没有打开的项目'
      return []
    }

    loading.value = true
    error.value = null

    try {
      publishedVersions.value = await projectsApi.getPublishedVersions(projectId)
      return publishedVersions.value
    } catch (e) {
      error.value = e instanceof Error ? e.message : '获取发布版本失败'
      throw e
    } finally {
      loading.value = false
    }
  }

  /**
   * 回滚当前项目到指定发布版本
   */
  async function rollbackPublishedVersion(
    version: number,
    projectId = currentProject.value?.id
  ): Promise<PublishedProject> {
    if (!projectId) {
      error.value = '没有打开的项目'
      throw new Error(error.value)
    }

    saving.value = true
    error.value = null

    try {
      const snapshot = await projectsApi.rollbackPublishedVersion(projectId, version)
      publishedVersions.value = await projectsApi.getPublishedVersions(projectId)

      const updatedProject = await projectsApi.getProject(projectId)
      if (currentProject.value?.id === projectId) {
        currentProject.value = updatedProject
      }

      const index = projects.value.findIndex((p) => p.id === projectId)
      if (index !== -1) {
        projects.value[index] = updatedProject
      }

      return snapshot
    } catch (e) {
      error.value = e instanceof Error ? e.message : '回滚发布版本失败'
      throw e
    } finally {
      saving.value = false
    }
  }

  /**
   * 加载项目场景
   */
  async function loadProjectScene(projectData: IProjectData): Promise<void> {
    loading.value = true
    error.value = null

    try {
      await SceneSerializer.deserialize(projectData)
    } catch (e) {
      error.value = e instanceof Error ? e.message : '加载场景失败'
      throw e
    } finally {
      loading.value = false
    }
  }

  /**
   * 导出项目为 JSON 字符串
   */
  function exportProjectJSON(): string {
    const projectName = currentProject.value?.name || '未命名项目'
    const description = currentProject.value?.description
    return SceneSerializer.exportToJSON(projectName, description)
  }

  /**
   * 从 JSON 字符串导入项目
   */
  async function importProjectJSON(json: string): Promise<IProjectData> {
    loading.value = true
    error.value = null

    try {
      const projectData = await SceneSerializer.importFromJSON(json)
      return projectData
    } catch (e) {
      error.value = e instanceof Error ? e.message : '导入项目失败'
      throw e
    } finally {
      loading.value = false
    }
  }

  /**
   * 下载项目 JSON 文件
   */
  function downloadProjectJSON(): void {
    const json = exportProjectJSON()
    const projectName = currentProject.value?.name || 'project'
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${projectName}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return {
    // 状态
    projects,
    currentProject,
    publishedVersions,
    loading,
    saving,
    error,
    // 计算属性
    projectCount,
    hasProjects,
    // 方法
    fetchProjects,
    fetchPublicProjects,
    fetchProject,
    createProject,
    updateProject,
    deleteProject,
    setCurrentProject,
    clearState,
    // 新增：保存/加载方法
    saveProject,
    publishProject,
    fetchPublishedVersions,
    rollbackPublishedVersion,
    loadProjectScene,
    exportProjectJSON,
    importProjectJSON,
    downloadProjectJSON,
  }
})
