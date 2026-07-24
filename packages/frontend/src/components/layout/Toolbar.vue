<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import {
  Folder,
  FolderOpened,
  Camera,
  Setting,
  User,
  VideoPlay,
  Download,
  Upload,
  Grid,
  Back,
  Right,
  Sunny,
  Moon,
  Monitor,
  ArrowLeft,
  Operation,
  QuestionFilled,
  MagicStick,
  CopyDocument,
  Link,
} from '@element-plus/icons-vue'
import { useThemeStore, type ThemeMode } from '@/stores/themeStore'
import { useHistoryStore } from '@/stores/historyStore'
import { useProjectStore } from '@/stores/projectStore'
import { useUserStore } from '@/stores/userStore'
import { useEditorStateStore } from '@/stores/editorStateStore'
import { useEditorStore, type WorkspacePreset } from '@/stores/editorStore'
import { ElMessage, ElMessageBox } from 'element-plus'

import type { SnappingPreset } from '@/engine/helpers'
import ShortcutHelpDialog from './ShortcutHelpDialog.vue'
import {
  getEngine,
  getModelLoader,
  SceneSerializer,
  ProjectDiagnostics,
  eventBus,
  getCommandBus,
  getEditorModeController,
  type SnappingChangedPayload,
} from '@/engine'
import { GLTFSceneExporter, ScreenshotExporter } from '@/engine/exporters'
import { markModelRootForSelection } from '@/engine/utils/modelSelection'
import { dataUrlToProjectCoverDataUrl } from '@/utils/projectCover'
import logoIcon from '@/assets/icons/icons.svg'

defineOptions({
  inheritAttrs: false,
})

// 路由
const router = useRouter()

// 项目 Store
const projectStore = useProjectStore()
const userStore = useUserStore()
const editorStateStore = useEditorStateStore()
const editorStore = useEditorStore()
const editorModeController = getEditorModeController()
const commandBus = getCommandBus()

// 当前项目名称
const projectName = computed(() => {
  const name = projectStore.currentProject?.name || '未命名项目'
  return editorStateStore.hasUnsavedChanges ? `${name} *` : name
})

// 是否有权限保存
const canSave = computed(() => {
  const project = projectStore.currentProject
  const userId = userStore.userId
  if (!project || !userId) return false
  return project.ownerId === userId
})

const emit = defineEmits<{
  (e: 'toggle-left'): void
  (e: 'toggle-right'): void
  (e: 'toggle-bottom'): void
}>()

// 主题 Store
const themeStore = useThemeStore()

// 历史记录 Store
const historyStore = useHistoryStore()

// 吸附设置
const snapEnabled = ref(false)
const snapPreset = ref<SnappingPreset>('normal')
const publishDialogVisible = ref(false)
const shortcutDialogVisible = ref(false)
const publishNote = ref('')
const isSettingCover = ref(false)
const publishResult = ref({
  previewUrl: '',
  embedUrl: '',
  iframeCode: '',
})

// 主题选项
const themeOptions: Array<{ value: ThemeMode; label: string; icon: typeof Sunny }> = [
  { value: 'auto', label: '跟随系统', icon: Monitor },
  { value: 'light', label: '浅色', icon: Sunny },
  { value: 'dark', label: '深色', icon: Moon },
]

const workspaceOptions: Array<{
  value: WorkspacePreset
  label: string
  description: string
}> = [
  { value: 'default', label: '默认', description: '均衡编辑布局' },
  { value: 'asset', label: '资源搭建', description: '放大资源库与场景树' },
  { value: 'animation', label: '动画', description: '打开时间线工作区' },
  { value: 'data', label: '数据绑定', description: '打开诊断与属性编辑' },
  { value: 'publish', label: '发布检查', description: '聚焦发布前检查' },
]

const currentWorkspaceLabel = computed(() => {
  return (
    workspaceOptions.find((option) => option.value === editorStore.workspacePreset)?.label || '默认'
  )
})

// 当前主题图标
const currentThemeIcon = computed(() => {
  const opt = themeOptions.find((o) => o.value === themeStore.mode)
  return opt?.icon || Monitor
})

// 返回项目列表
const handleBack = async () => {
  const canLeave = await editorStateStore.checkBeforeLeave()
  if (canLeave) {
    router.push('/assets')
  }
}

// 保存项目
const handleSave = async () => {
  try {
    const data = await projectStore.saveProject()
    if (data) {
      console.log('保存的项目数据:', data)
      editorStateStore.markAsSaved() // 标记为已保存
      ElMessage.success('项目已保存')
    }
  } catch (e) {
    console.error('保存失败:', e)
    const errorMessage = e instanceof Error ? e.message : '保存项目失败'

    // 检查是否是热重载导致的错误
    if (
      errorMessage.includes('ObjectManager not initialized') ||
      errorMessage.includes('hot reload')
    ) {
      ElMessageBox.confirm(
        '检测到引擎状态异常，这可能是由热重载引起的。是否刷新页面？',
        '需要刷新页面',
        {
          confirmButtonText: '刷新页面',
          cancelButtonText: '取消',
          type: 'warning',
        }
      )
        .then(() => {
          window.location.reload()
        })
        .catch(() => {
          ElMessage.info('已取消刷新，请手动刷新页面后重试')
        })
    } else {
      ElMessage.error(errorMessage)
    }
  }
}

// 预览项目
const handlePreview = () => {
  const engine = getEngine()
  if (!engine?.isInitialized) {
    ElMessage.error('引擎未初始化')
    return
  }

  try {
    // 序列化当前场景
    const projectData = SceneSerializer.serialize(
      projectStore.currentProject?.name || 'Preview Project'
    )
    const diagnostics = ProjectDiagnostics.analyze(projectData)
    const errors = diagnostics.filter((issue) => issue.level === 'error')
    const warnings = diagnostics.filter((issue) => issue.level === 'warning')
    if (errors.length > 0 || warnings.length > 0) {
      editorStore.setBottomTab('publish', { openPanel: true })
      if (errors.length > 0) {
        ElMessage.error(`发布检查发现 ${errors.length} 个阻断项，本地预览仍将继续`)
      } else {
        ElMessage.warning(`预览前发现 ${warnings.length} 个发布检查警告`)
      }
    }

    // 存储到 localStorage
    localStorage.setItem('lowcode3d_preview_data', JSON.stringify(projectData))

    // 打开预览页面 (使用 local 作为 ID)
    const previewUrl = '/#/preview/local'
    window.open(previewUrl, '_blank')
  } catch (e) {
    console.error('Preview error:', e)
    const errorMessage = e instanceof Error ? e.message : '预览失败'

    // 检查是否是热重载导致的错误
    if (
      errorMessage.includes('ObjectManager not initialized') ||
      errorMessage.includes('hot reload')
    ) {
      ElMessageBox.confirm(
        '检测到引擎状态异常，这可能是由热重载引起的。是否刷新页面？',
        '需要刷新页面',
        {
          confirmButtonText: '刷新页面',
          cancelButtonText: '取消',
          type: 'warning',
        }
      )
        .then(() => {
          window.location.reload()
        })
        .catch(() => {
          ElMessage.info('已取消刷新，请手动刷新页面后重试')
        })
    } else {
      ElMessage.error(errorMessage)
    }
  }
}

const handleSetCover = async () => {
  const engine = getEngine()
  const currentProject = projectStore.currentProject

  if (!engine?.isInitialized) {
    ElMessage.error('引擎未初始化')
    return
  }
  if (!currentProject) {
    ElMessage.error('请先打开项目')
    return
  }

  isSettingCover.value = true
  try {
    const screenshot = new ScreenshotExporter(engine).export({
      mimeType: 'image/jpeg',
      quality: 0.86,
    })
    const thumbnailUrl = await dataUrlToProjectCoverDataUrl(screenshot)
    await projectStore.updateProject(currentProject.id, { thumbnailUrl })
    ElMessage.success('已设为封面')
  } catch (e) {
    console.error('Set cover error:', e)
    ElMessage.error(e instanceof Error ? e.message : '设为封面失败')
  } finally {
    isSettingCover.value = false
  }
}

// 发布项目
const handlePublish = async () => {
  const engine = getEngine()
  const currentProject = projectStore.currentProject

  if (!engine?.isInitialized) {
    ElMessage.error('引擎未初始化')
    return
  }
  if (!currentProject) {
    ElMessage.error('请先打开项目')
    return
  }
  if (!canSave.value) {
    ElMessage.warning('当前账号没有发布该项目的权限')
    return
  }

  try {
    const projectData = SceneSerializer.serialize(currentProject.name, currentProject.description)
    const diagnostics = ProjectDiagnostics.analyze(projectData)
    const errors = diagnostics.filter((issue) => issue.level === 'error')
    const warnings = diagnostics.filter((issue) => issue.level === 'warning')

    if (errors.length > 0) {
      editorStore.setBottomTab('publish', { openPanel: true })
      ElMessage.error(`发布检查发现 ${errors.length} 个阻断项，请修复后再发布`)
      return
    }

    if (warnings.length > 0) {
      editorStore.setBottomTab('publish', { openPanel: true })
      await ElMessageBox.confirm(
        `发布检查存在 ${warnings.length} 个警告，可能影响线上体验。仍然发布吗？`,
        '发布确认',
        {
          confirmButtonText: '继续发布',
          cancelButtonText: '取消',
          type: 'warning',
        }
      )
    }

    const runtimeConfig = {
      sdkVersion: '1.3.0',
      dataMode: 'snapshot',
      embedDefaults: {
        toolbar: false,
        controls: true,
        transparent: false,
        autoplay: true,
      },
    }
    const publishedProject = await projectStore.publishProject(projectData, {
      publishNote: publishNote.value,
      sdkVersion: '1.3.0',
      dataMode: 'snapshot',
      embedDefaults: runtimeConfig.embedDefaults,
      runtimeConfig,
    })
    editorStateStore.markAsSaved()

    const previewUrl = createPreviewUrl(publishedProject.id)
    const embedUrl = createPreviewUrl(publishedProject.id, {
      embed: '1',
      toolbar: '0',
      controls: '1',
      autoplay: '1',
    })
    const iframeCode = `<iframe src="${embedUrl}" width="100%" height="600" frameborder="0" allowfullscreen></iframe>`

    publishResult.value = {
      previewUrl,
      embedUrl,
      iframeCode,
    }
    publishDialogVisible.value = true
    ElMessage.success('项目已发布')
  } catch (e) {
    if (e === 'cancel') return
    console.error('Publish error:', e)
    ElMessage.error(e instanceof Error ? e.message : '发布失败')
  }
}

const handleExportScreenshot = (transparent = false) => {
  const engine = getEngine()
  if (!engine?.isInitialized) {
    ElMessage.error('引擎未初始化')
    return
  }

  const exporter = new ScreenshotExporter(engine)
  exporter.download(transparent ? 'lowcode3d-transparent.png' : 'lowcode3d-screenshot.png', {
    transparent,
    mimeType: 'image/png',
    quality: 1,
  })
  ElMessage.success('截图已导出')
}

const handleExportGLB = async () => {
  const engine = getEngine()
  if (!engine?.isInitialized) {
    ElMessage.error('引擎未初始化')
    return
  }

  try {
    const exporter = new GLTFSceneExporter(engine)
    await exporter.download(`${projectStore.currentProject?.name || 'lowcode3d-scene'}.glb`, {
      binary: true,
      projectName: projectStore.currentProject?.name,
      description: projectStore.currentProject?.description,
    })
    ElMessage.success('GLB 已导出')
  } catch (error) {
    console.error('GLB export failed:', error)
    ElMessage.error('GLB 导出失败')
  }
}

const createPreviewUrl = (projectId: string, query?: Record<string, string>): string => {
  const pathname = window.location.pathname
  const basePath = pathname.endsWith('/') ? pathname : pathname.replace(/\/[^/]*$/, '/')
  const queryString = query ? `?${new URLSearchParams(query).toString()}` : ''
  return `${window.location.origin}${basePath}#/preview/${projectId}${queryString}`
}

// 导出项目为 JSON 文件
const handleExport = () => {
  try {
    projectStore.downloadProjectJSON()
    ElMessage.success('项目已导出')
  } catch (e) {
    console.error('导出失败:', e)
    const errorMessage = e instanceof Error ? e.message : '导出项目失败'

    // 检查是否是热重载导致的错误
    if (
      errorMessage.includes('ObjectManager not initialized') ||
      errorMessage.includes('hot reload')
    ) {
      ElMessageBox.confirm(
        '检测到引擎状态异常，这可能是由热重载引起的。是否刷新页面？',
        '需要刷新页面',
        {
          confirmButtonText: '刷新页面',
          cancelButtonText: '取消',
          type: 'warning',
        }
      )
        .then(() => {
          window.location.reload()
        })
        .catch(() => {
          ElMessage.info('已取消刷新，请手动刷新页面后重试')
        })
    } else {
      ElMessage.error(errorMessage)
    }
  }
}

// 导入项目 JSON 文件
const handleImport = () => {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.json'
  input.onchange = async (e) => {
    const file = (e.target as HTMLInputElement).files?.[0]
    if (!file) return

    try {
      const text = await file.text()
      const data = await projectStore.importProjectJSON(text)
      ElMessage.success(`已导入项目: ${data.projectName}`)
    } catch (err) {
      console.error('导入失败:', err)
      ElMessage.error('导入项目失败，请检查文件格式')
    }
  }
  input.click()
}

// 导入本地模型（不上传服务器）
const handleImportLocal = async () => {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.gltf,.glb,.fbx'
  input.multiple = false

  input.onchange = async (e) => {
    const file = (e.target as HTMLInputElement).files?.[0]
    if (!file) return

    const engine = getEngine()
    if (!engine?.isInitialized) {
      ElMessage.error('引擎未初始化')
      return
    }

    try {
      // 创建临时 URL
      const objectUrl = URL.createObjectURL(file)

      // 加载模型
      const modelLoader = getModelLoader()
      const result = await modelLoader.loadModel(objectUrl)

      // 设置模型名称为文件名（去掉扩展名）
      const modelName = file.name.replace(/\.(glb|gltf|fbx)$/i, '')
      result.model.name = modelName

      // 标记为用户导入的模型根，点击子 Mesh 时默认选择整体模型
      markModelRootForSelection(result.model, {
        name: modelName,
        isUserImported: true,
        importedFileName: file.name,
      })
      // result.model.userData.localObjectUrl = objectUrl // 暂不保存 URL，避免序列化问题

      // 遍历所有子对象，设置可选择和阴影
      result.model.traverse((child) => {
        if (child.type === 'Mesh') {
          child.castShadow = true
          child.receiveShadow = true
        }
      })

      // 添加到场景
      commandBus.addObject(result.model, {
        name: modelName,
        type: 'model',
      })

      // 聚焦到导入的模型，让相机能看到整个模型，并设为默认视角
      engine.cameraManager.focusOnObject(result.model, 1.5, true)

      ElMessage.success(`已导入模型: ${modelName}`)
    } catch (error) {
      console.error('Import local model error:', error)
      ElMessage.error('导入模型失败')
    }
  }

  input.click()
}

// 设置主题
const handleThemeChange = (mode: ThemeMode) => {
  themeStore.setMode(mode)
}

const handleWorkspaceChange = (preset: WorkspacePreset) => {
  editorStore.applyWorkspacePreset(preset)
  ElMessage.success(`已切换到${currentWorkspaceLabel.value}工作区`)
}

const handleOpenOnboarding = () => {
  eventBus.emit('editor:open-onboarding')
}

const handleOpenShortcuts = () => {
  shortcutDialogVisible.value = true
}

const handleOpenPublishedPreview = () => {
  if (!publishResult.value.previewUrl) return
  window.open(publishResult.value.previewUrl, '_blank')
}

const handleCopyPublishedValue = async (value: string, label: string) => {
  try {
    await navigator.clipboard.writeText(value)
    ElMessage.success(`已复制${label}`)
  } catch (error) {
    console.error('Copy failed:', error)
    ElMessage.error('复制失败，请手动复制')
  }
}

// 撤销
const handleUndo = () => {
  if (historyStore.undo()) {
    ElMessage.info(`撤销: ${historyStore.redoName || '操作'}`)
  }
}

// 重做
const handleRedo = () => {
  if (historyStore.redo()) {
    ElMessage.info(`重做: ${historyStore.undoName || '操作'}`)
  }
}

// 监听吸附变更事件
const handleSnappingChanged = (payload: SnappingChangedPayload) => {
  snapEnabled.value = payload.enabled
  if (payload.preset) {
    snapPreset.value = payload.preset
  }
}

// 监听保存事件（从快捷键触发）
const handleSaveFromHotkey = () => {
  handleSave()
}

// 初始化历史记录监听
onMounted(() => {
  historyStore.init()
  eventBus.on('editor:snapping-changed', handleSnappingChanged)
  eventBus.on('editor:save-project', handleSaveFromHotkey)

  editorStateStore.installBeforeUnloadListener()

  setTimeout(() => {
    editorModeController.setMode('browse')
  }, 100)
})

onUnmounted(() => {
  historyStore.dispose()
  eventBus.off('editor:snapping-changed', handleSnappingChanged)
  eventBus.off('editor:save-project', handleSaveFromHotkey)

  editorStateStore.uninstallBeforeUnloadListener()
})

defineExpose({})
</script>

<template>
  <header v-bind="$attrs" class="toolbar">
    <!-- 左侧 Logo 与项目信息 -->
    <div class="toolbar-left">
      <el-tooltip content="返回项目列表" placement="bottom">
        <el-button :icon="ArrowLeft" text @click="handleBack"> 返回 </el-button>
      </el-tooltip>
      <el-divider direction="vertical" />
      <div class="logo">
        <img :src="logoIcon" alt="logo" class="logo-icon" />
        <span class="logo-text">editor3D</span>
      </div>
      <el-divider direction="vertical" />
      <el-dropdown trigger="click">
        <span
          class="project-name"
          :class="{ 'has-unsaved-changes': editorStateStore.hasUnsavedChanges }"
        >
          <el-icon>
            <Folder />
          </el-icon>
          {{ projectName }}
          <el-icon class="el-icon--right">
            <Right />
          </el-icon>
        </span>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item @click="handleBack">
              <el-icon>
                <FolderOpened />
              </el-icon>
              打开项目
            </el-dropdown-item>
            <el-dropdown-item @click="handleImportLocal">
              <el-icon>
                <FolderOpened />
              </el-icon>
              导入本地模型
            </el-dropdown-item>
            <el-dropdown-item divided @click="handleImport">
              <el-icon>
                <Upload />
              </el-icon>
              导入项目JSON
            </el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
    </div>

    <!-- 中间工具按钮 -->
    <div class="toolbar-center">
      <!-- 撤销/重做按钮 -->
      <el-button-group>
        <el-tooltip
          :content="`撤销${historyStore.undoName ? ': ' + historyStore.undoName : ''} (Ctrl+Z)`"
          placement="bottom"
        >
          <el-button :icon="Back" :disabled="!historyStore.canUndo" @click="handleUndo" />
        </el-tooltip>
        <el-tooltip
          :content="`重做${historyStore.redoName ? ': ' + historyStore.redoName : ''} (Ctrl+Shift+Z)`"
          placement="bottom"
        >
          <el-button :icon="Right" :disabled="!historyStore.canRedo" @click="handleRedo" />
        </el-tooltip>
      </el-button-group>

      <el-divider direction="vertical" />

      <!-- 面板控制 -->
      <el-button-group>
        <el-tooltip content="显示/隐藏左侧面板" placement="bottom">
          <el-button
            :type="editorStore.panels.leftSidebar ? 'primary' : 'default'"
            @click="emit('toggle-left')"
          >
            <el-icon>
              <FolderOpened />
            </el-icon>
          </el-button>
        </el-tooltip>
        <el-tooltip content="显示/隐藏底部面板" placement="bottom">
          <el-button
            :type="editorStore.panels.bottomPanel ? 'primary' : 'default'"
            @click="emit('toggle-bottom')"
          >
            <el-icon>
              <Grid />
            </el-icon>
          </el-button>
        </el-tooltip>
        <el-tooltip content="显示/隐藏右侧面板" placement="bottom">
          <el-button
            :type="editorStore.panels.rightSidebar ? 'primary' : 'default'"
            @click="emit('toggle-right')"
          >
            <el-icon>
              <Setting />
            </el-icon>
          </el-button>
        </el-tooltip>
      </el-button-group>

      <el-divider direction="vertical" />

      <el-dropdown trigger="click" @command="handleWorkspaceChange">
        <el-button class="workspace-trigger">
          <el-icon>
            <Operation />
          </el-icon>
          <span>{{ currentWorkspaceLabel }}</span>
          <el-icon class="el-icon--right">
            <Right />
          </el-icon>
        </el-button>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item
              v-for="option in workspaceOptions"
              :key="option.value"
              :command="option.value"
              :class="{ 'is-active': editorStore.workspacePreset === option.value }"
            >
              <div class="workspace-option">
                <span class="workspace-option__label">{{ option.label }}</span>
                <span class="workspace-option__description">{{ option.description }}</span>
              </div>
            </el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>

      <el-divider direction="vertical" />

      <div class="save-state" :class="{ 'is-dirty': editorStateStore.hasUnsavedChanges }">
        <span class="save-dot"></span>
        {{ editorStateStore.hasUnsavedChanges ? '未保存' : '已保存' }}
      </div>

      <el-tooltip
        content="模型默认选中整体；按住 Alt / Option 点击模型可选择子级"
        placement="bottom"
      >
        <div class="selection-hint" aria-label="模型选择提示">
          <el-icon>
            <Operation />
          </el-icon>
          <span>Alt 选子级</span>
        </div>
      </el-tooltip>
    </div>

    <!-- 右侧操作区 -->
    <div class="toolbar-right">
      <el-button :icon="Camera" :loading="isSettingCover" @click="handleSetCover">
        设为封面
      </el-button>
      <el-button type="primary" :icon="VideoPlay" @click="handlePreview"> 预览 </el-button>
      <el-button v-if="canSave" type="success" :icon="Upload" @click="handlePublish">
        发布
      </el-button>
      <el-button v-if="canSave" @click="handleSave">保存</el-button>
      <el-dropdown v-if="!userStore.isTempUser" trigger="click">
        <el-button :icon="Download">
          导出
          <el-icon class="el-icon--right">
            <Right />
          </el-icon>
        </el-button>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item @click="handleExport">项目 JSON</el-dropdown-item>
            <el-dropdown-item @click="handleExportScreenshot(false)">当前视角 PNG</el-dropdown-item>
            <el-dropdown-item @click="handleExportScreenshot(true)">透明背景 PNG</el-dropdown-item>
            <el-dropdown-item @click="handleExportGLB">场景 GLB</el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
      <el-divider direction="vertical" />

      <!-- 主题切换 -->
      <el-dropdown trigger="click" @command="handleThemeChange">
        <el-button circle>
          <el-icon>
            <component :is="currentThemeIcon" />
          </el-icon>
        </el-button>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item
              v-for="opt in themeOptions"
              :key="opt.value"
              :command="opt.value"
              :class="{ 'is-active': themeStore.mode === opt.value }"
            >
              <el-icon>
                <component :is="opt.icon" />
              </el-icon>
              {{ opt.label }}
            </el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>

      <el-dropdown trigger="click">
        <el-button circle>
          <el-icon>
            <QuestionFilled />
          </el-icon>
        </el-button>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item @click="handleOpenOnboarding">
              <el-icon>
                <MagicStick />
              </el-icon>
              打开新手引导
            </el-dropdown-item>
            <el-dropdown-item @click="handleOpenShortcuts">
              <el-icon>
                <Operation />
              </el-icon>
              查看快捷键
            </el-dropdown-item>
            <el-dropdown-item disabled>命令面板：Ctrl / Cmd + K</el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
      <el-dropdown v-if="false" trigger="click">
        <el-avatar :size="32" :icon="User" class="user-avatar" />
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item disabled>{{ userStore.nickname }}</el-dropdown-item>
            <el-dropdown-item
              divided
              @click="
                () => {
                  userStore.logout()
                  router.push('/login')
                }
              "
            >
              退出登录
            </el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
    </div>
  </header>

  <el-dialog
    v-model="publishDialogVisible"
    title="发布成功"
    width="560px"
    append-to-body
    class="publish-success-dialog"
  >
    <div class="publish-success">
      <div class="publish-success__summary">
        <el-icon>
          <Link />
        </el-icon>
        <div>
          <strong>项目已生成线上访问地址</strong>
          <span>可直接打开预览，也可以复制嵌入代码放入业务系统。</span>
        </div>
      </div>

      <div class="publish-field">
        <label>预览地址</label>
        <div class="publish-field__row">
          <el-input :model-value="publishResult.previewUrl" readonly />
          <el-button
            :icon="CopyDocument"
            @click="handleCopyPublishedValue(publishResult.previewUrl, '预览地址')"
          >
            复制
          </el-button>
        </div>
      </div>

      <div class="publish-field">
        <label>嵌入地址</label>
        <div class="publish-field__row">
          <el-input :model-value="publishResult.embedUrl" readonly />
          <el-button
            :icon="CopyDocument"
            @click="handleCopyPublishedValue(publishResult.embedUrl, '嵌入地址')"
          >
            复制
          </el-button>
        </div>
      </div>

      <div class="publish-field">
        <label>iframe 代码</label>
        <el-input :model-value="publishResult.iframeCode" type="textarea" :rows="3" readonly />
      </div>
    </div>

    <template #footer>
      <el-button @click="publishDialogVisible = false">关闭</el-button>
      <el-button
        :icon="CopyDocument"
        @click="handleCopyPublishedValue(publishResult.iframeCode, 'iframe 代码')"
      >
        复制代码
      </el-button>
      <el-button type="primary" :icon="VideoPlay" @click="handleOpenPublishedPreview">
        打开预览
      </el-button>
    </template>
  </el-dialog>

  <ShortcutHelpDialog v-model="shortcutDialogVisible" />
</template>

<style scoped lang="scss">
.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: var(--lc-toolbar-height);
  padding: 0 18px;
  background-color: $--bg-color-dark;
  color: var(--lc-text-primary);
  border-bottom: 1px solid $--border-color;
  min-width: 0; // 允许 flex 子项收缩
  overflow: hidden;

  .el-divider--vertical {
    height: 20px;
    margin: 0 12px;
    border-color: $--border-color;
    flex-shrink: 0;
  }
}

.save-state {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 28px;
  padding: 0 10px;
  color: var(--lc-text-secondary);
  background: var(--lc-bg-control);
  border: 1px solid var(--lc-border-subtle);
  border-radius: var(--lc-radius-md);
  font-size: 12px;
  white-space: nowrap;

  .save-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--lc-success);
  }

  &.is-dirty {
    color: var(--lc-warning);

    .save-dot {
      background: var(--lc-warning);
    }
  }
}

.workspace-trigger {
  flex-shrink: 0;

  span {
    max-width: 76px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.workspace-option {
  min-width: 148px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  line-height: 1.25;

  &__label {
    color: var(--lc-text-primary);
    font-size: 13px;
    font-weight: 600;
  }

  &__description {
    color: var(--lc-text-muted);
    font-size: 11px;
  }
}

.selection-hint {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 28px;
  padding: 0 9px;
  color: var(--lc-text-muted);
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid var(--lc-border-subtle);
  border-radius: var(--lc-radius-sm);
  font-size: 12px;
  line-height: 1;
  white-space: nowrap;
  flex-shrink: 0;

  .el-icon {
    font-size: 13px;
  }
}

.toolbar-left {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0; // 左侧不收缩

  .logo {
    display: flex;
    align-items: center;
    gap: 8px;
    color: $--color-primary;
    font-weight: 600;

    .logo-icon {
      width: 20px;
      height: 20px;
      display: block;
      filter: brightness(0) saturate(100%) invert(48%) sepia(79%) saturate(2476%) hue-rotate(222deg)
        brightness(97%) contrast(97%);
    }

    .logo-text {
      font-size: 16px;
    }
  }

  .project-name {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    cursor: pointer;
    border-radius: $--border-radius-base;
    transition: $--transition-fast;

    &:hover {
      background-color: $--bg-color-hover;
    }

    // 未保存状态样式
    &.has-unsaved-changes {
      color: $--color-warning;
      font-weight: 600;
    }
  }
}

.toolbar-center {
  display: flex;
  align-items: center;
  flex: 1;
  justify-content: center;
  min-width: 0;
  overflow-x: auto;
  overflow-y: hidden;

  // 隐藏滚动条但保持可滚动
  scrollbar-width: none;
  -ms-overflow-style: none;

  &::-webkit-scrollbar {
    display: none;
  }

  .transform-tools {
    flex-shrink: 0;

    .el-button {
      min-width: 48px;
    }
  }

  .el-button-group {
    flex-shrink: 0;
  }
}

.toolbar-right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0; // 右侧不收缩
}

// 激活的主题选项
:deep(.el-dropdown-menu__item.is-active) {
  color: var(--el-color-primary);
  background-color: var(--el-color-primary-light-9);
}

:deep(.publish-success-dialog) {
  .el-dialog {
    background: var(--lc-bg-panel-raised);
    border: 1px solid var(--lc-border-subtle);
  }
}

.publish-success {
  display: grid;
  gap: 16px;
}

.publish-success__summary {
  display: flex;
  gap: 12px;
  padding: 12px;
  color: var(--lc-text-primary);
  background: rgba(34, 197, 94, 0.1);
  border: 1px solid rgba(34, 197, 94, 0.24);
  border-radius: var(--lc-radius-md);

  .el-icon {
    flex-shrink: 0;
    margin-top: 2px;
    color: var(--lc-success);
    font-size: 18px;
  }

  div {
    min-width: 0;
    display: grid;
    gap: 4px;
  }

  strong {
    font-size: 14px;
  }

  span {
    color: var(--lc-text-secondary);
    font-size: 12px;
    line-height: 1.6;
  }
}

.publish-field {
  display: grid;
  gap: 8px;

  label {
    color: var(--lc-text-muted);
    font-size: 12px;
    font-weight: 600;
  }
}

.publish-field__row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 8px;
}

// 小屏幕隐藏部分元素
@media (max-width: 900px) {
  .toolbar-left .logo-text {
    display: none;
  }
}

@media (max-width: 768px) {
  .toolbar {
    padding: 0 8px;

    .el-divider--vertical {
      margin: 0 6px;
    }
  }

  .toolbar-left,
  .toolbar-right {
    gap: 4px;
  }
}
</style>
