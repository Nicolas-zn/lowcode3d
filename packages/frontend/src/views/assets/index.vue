<script setup lang="ts">
/**
 * 资源中心主页面
 * 包含我的项目、公共项目、资源中心三个 Tab
 */
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Folder, Share, Box, Plus, Upload, Close } from '@element-plus/icons-vue'
import { useUserStore } from '@/stores/userStore'
import { useProjectStore } from '@/stores/projectStore'
import logoIcon from '@/assets/icons/icons.svg'
import {
  PROJECT_TEMPLATES,
  createProjectDataFromTemplate,
  type ProjectTemplateId,
} from '@/data/projectTemplates'
import { imageFileToProjectCoverDataUrl } from '@/utils/projectCover'

// 子组件
import MyProjects from './MyProjects.vue'
import PublicProjects from './PublicProjects.vue'
import ResourceCenter from './ResourceCenter/index.vue'

const router = useRouter()
const userStore = useUserStore()
const projectStore = useProjectStore()

// 左侧菜单
type MenuKey = 'my-projects' | 'public-projects' | 'resources'
// tempuser 默认显示公共项目，其他用户显示我的项目
const activeMenu = ref<MenuKey>(userStore.isTempUser ? 'public-projects' : 'my-projects')

// 状态
const showCreateDialog = ref(false)
const createCoverInput = ref<HTMLInputElement | null>(null)
const createForm = ref({
  name: '',
  description: '',
  isPublic: false,
  templateId: 'blank' as ProjectTemplateId,
  thumbnailUrl: '' as string | null,
})

const templateMeta: Record<
  ProjectTemplateId,
  { accent: string; complexity: string; preview: string; defaultName: string }
> = {
  blank: {
    accent: '#4f8cff',
    complexity: '入门',
    preview: 'Empty',
    defaultName: '空白 3D 场景',
  },
  'product-showcase': {
    accent: '#2ee6a6',
    complexity: '入门',
    preview: 'Product',
    defaultName: '产品展示场景',
  },
  'digital-twin': {
    accent: '#7dd3fc',
    complexity: '进阶',
    preview: 'Twin',
    defaultName: '数字孪生园区',
  },
  'gis-annotation': {
    accent: '#f97316',
    complexity: '进阶',
    preview: 'GIS',
    defaultName: 'GIS 标注场景',
  },
}

const resetCreateForm = () => {
  createForm.value = {
    name: '',
    description: '',
    isPublic: false,
    templateId: 'blank',
    thumbnailUrl: '',
  }
}

// 计算属性
const userName = userStore.nickname

// 生命周期
onMounted(async () => {
  try {
    await projectStore.fetchProjects()
  } catch (e) {
    ElMessage.error('获取项目列表失败')
  }
})

// 方法
const handleCreateProject = async () => {
  if (!createForm.value.name.trim()) {
    ElMessage.warning('请输入项目名称')
    return
  }

  try {
    const sceneData = createProjectDataFromTemplate(
      createForm.value.templateId,
      createForm.value.name,
      createForm.value.description
    )
    const project = await projectStore.createProject({
      name: createForm.value.name,
      description: createForm.value.description,
      isPublic: createForm.value.isPublic,
      sceneData,
      thumbnailUrl: createForm.value.thumbnailUrl || null,
    })
    showCreateDialog.value = false
    resetCreateForm()
    ElMessage.success('项目创建成功')
    router.push(`/editor/${project.id}`)
  } catch (e) {
    ElMessage.error('创建项目失败')
  }
}

const openCreateDialog = (templateId: ProjectTemplateId = 'blank') => {
  createForm.value.templateId = templateId
  if (!createForm.value.name.trim()) {
    createForm.value.name = templateMeta[templateId].defaultName
  }
  showCreateDialog.value = true
}

const handleCreateCoverChange = async (event: Event) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return

  try {
    createForm.value.thumbnailUrl = await imageFileToProjectCoverDataUrl(file)
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '封面图片处理失败')
  }
}

const handleClearCreateCover = () => {
  createForm.value.thumbnailUrl = null
}

const handleLogout = () => {
  userStore.logout()
  router.push('/login')
}
</script>

<template>
  <div class="assets-page">
    <header class="page-header">
      <div class="header-left">
        <h1 class="logo">
          <img :src="logoIcon" alt="logo" class="logo-icon" />
          editor3D
        </h1>
        <span v-if="userStore.isTempUser" class="restricted-mode">
          受限模式 · 仅可访问公共项目和公共资源
        </span>
      </div>
      <div class="header-right">
        <span class="user-info">
          <el-avatar :size="32" class="user-avatar">{{
            userName.charAt(0).toUpperCase()
          }}</el-avatar>
          <span class="user-name">{{ userName }}</span>
        </span>
        <el-button type="danger" @click="handleLogout">退出登录</el-button>
      </div>
    </header>

    <div class="page-main">
      <aside class="sidebar">
        <div class="menu-list">
          <div
            v-if="!userStore.isTempUser"
            class="menu-item"
            :class="{ active: activeMenu === 'my-projects' }"
            @click="activeMenu = 'my-projects'"
          >
            <el-icon>
              <Folder />
            </el-icon>
            <span>我的项目</span>
          </div>
          <div
            class="menu-item"
            :class="{ active: activeMenu === 'public-projects' }"
            @click="activeMenu = 'public-projects'"
          >
            <el-icon>
              <Share />
            </el-icon>
            <span>公共项目</span>
          </div>
          <div
            class="menu-item"
            :class="{ active: activeMenu === 'resources' }"
            @click="activeMenu = 'resources'"
          >
            <el-icon>
              <Box />
            </el-icon>
            <span>资源中心</span>
          </div>
        </div>
      </aside>

      <main class="content-area">
        <section v-if="activeMenu === 'my-projects' && !userStore.isTempUser" class="welcome-panel">
          <div class="welcome-copy">
            <span class="welcome-eyebrow">快速开始</span>
            <h2>创建一个可编辑、可预览、可发布的 3D 场景</h2>
            <p>选择模板进入编辑器，再替换模型、调整属性、检查发布状态。</p>
            <div class="welcome-actions">
              <el-button type="primary" :icon="Plus" @click="openCreateDialog('blank')">
                新建项目
              </el-button>
            </div>
          </div>
          <div class="quick-template-grid">
            <button
              v-for="template in PROJECT_TEMPLATES"
              :key="template.id"
              class="quick-template"
              :style="{ '--template-accent': templateMeta[template.id].accent }"
              @click="openCreateDialog(template.id)"
            >
              <span class="quick-preview">{{ templateMeta[template.id].preview }}</span>
              <span class="quick-name">{{ template.name }}</span>
              <span class="quick-meta"
                >{{ template.industry }} · {{ templateMeta[template.id].complexity }}</span
              >
            </button>
          </div>
        </section>
        <MyProjects v-if="activeMenu === 'my-projects'" @show-create-dialog="openCreateDialog()" />
        <PublicProjects v-else-if="activeMenu === 'public-projects'" />
        <ResourceCenter v-else-if="activeMenu === 'resources'" />
      </main>
    </div>

    <el-dialog
      v-model="showCreateDialog"
      title="新建项目"
      width="680px"
      class="create-dialog"
      @closed="resetCreateForm"
    >
      <el-form :model="createForm" label-width="80px">
        <el-form-item label="项目名称" required>
          <el-input
            v-model="createForm.name"
            placeholder="请输入项目名称"
            maxlength="50"
            show-word-limit
          />
        </el-form-item>
        <el-form-item label="项目描述">
          <el-input
            v-model="createForm.description"
            type="textarea"
            :rows="3"
            placeholder="请输入项目描述（可选）"
            maxlength="200"
            show-word-limit
          />
        </el-form-item>
        <el-form-item label="设为公开">
          <el-switch v-model="createForm.isPublic" active-text="公开" inactive-text="私有" />
        </el-form-item>
        <el-form-item label="项目模板">
          <div class="template-grid">
            <button
              v-for="template in PROJECT_TEMPLATES"
              :key="template.id"
              type="button"
              class="template-card"
              :class="{ active: createForm.templateId === template.id }"
              :style="{ '--template-accent': templateMeta[template.id].accent }"
              @click="createForm.templateId = template.id"
            >
              <span class="template-visual">
                <span>{{ templateMeta[template.id].preview }}</span>
              </span>
              <span class="template-heading">
                <span class="template-name">{{ template.name }}</span>
                <span class="template-industry">{{ template.industry }}</span>
              </span>
              <span class="template-desc">{{ template.description }}</span>
              <span class="template-complexity">{{ templateMeta[template.id].complexity }}</span>
            </button>
          </div>
        </el-form-item>
        <el-form-item label="项目封面">
          <div class="project-cover-field">
            <input
              ref="createCoverInput"
              class="cover-file-input"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              @change="handleCreateCoverChange"
            />
            <button type="button" class="project-cover-picker" @click="createCoverInput?.click()">
              <img
                v-if="createForm.thumbnailUrl"
                :src="createForm.thumbnailUrl"
                alt="项目封面预览"
              />
              <span v-else class="project-cover-empty">
                <el-icon><Upload /></el-icon>
                <span>上传封面图（可选）</span>
              </span>
            </button>
            <el-button
              v-if="createForm.thumbnailUrl"
              size="small"
              :icon="Close"
              @click="handleClearCreateCover"
            >
              清空封面
            </el-button>
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCreateDialog = false">取消</el-button>
        <el-button type="primary" :loading="projectStore.loading" @click="handleCreateProject">
          创建项目
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped lang="scss">
.assets-page {
  height: 100vh;
  overflow: hidden; // 防止整页滚动，让内容区域内部滚动
  background: linear-gradient(180deg, #1a1a2e 0%, #16213e 100%);
  display: flex;
  flex-direction: column;
}

.page-header {
  height: 64px;
  padding: 0 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: rgba(26, 26, 46, 0.95);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(8px);
  flex-shrink: 0;

  .header-left {
    display: flex;
    align-items: center;
    gap: 16px;

    .logo {
      font-size: 24px;
      font-weight: 700;
      color: #fff;
      display: flex;
      align-items: center;
      gap: 8px;

      .logo-icon {
        width: 28px;
        height: 28px;
        display: block;
        filter: brightness(0) saturate(100%) invert(48%) sepia(79%) saturate(2476%)
          hue-rotate(222deg) brightness(97%) contrast(97%);
      }
    }

    .restricted-mode {
      font-size: 12px;
      color: #f5a623;
      background: rgba(245, 166, 35, 0.15);
      padding: 4px 12px;
      border-radius: 12px;
      border: 1px solid rgba(245, 166, 35, 0.3);
    }
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 16px;

    .user-info {
      display: flex;
      align-items: center;
      gap: 8px;

      .user-avatar {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      }

      .user-name {
        color: #a6adc8;
        font-size: 14px;
      }
    }
  }
}

.page-main {
  display: flex;
  flex: 1;
  min-height: 0; // 重要：确保 flex 子元素可以正确滚动
  overflow: hidden;
}

.sidebar {
  width: 220px;
  background: rgba(26, 26, 46, 0.6);
  border-right: 1px solid rgba(255, 255, 255, 0.1);
  padding: 16px 0;
  flex-shrink: 0;

  .menu-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 0 12px;
  }

  .menu-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    border-radius: 8px;
    color: #a6adc8;
    cursor: pointer;
    transition: all 0.2s;

    &:hover {
      background: rgba(255, 255, 255, 0.05);
      color: #fff;
    }

    &.active {
      background: rgba(102, 126, 234, 0.2);
      color: #667eea;

      .el-icon {
        color: #667eea;
      }
    }

    .el-icon {
      font-size: 18px;
    }

    span {
      font-size: 14px;
      font-weight: 500;
    }
  }
}

.content-area {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 24px 32px;
}

.welcome-panel {
  display: grid;
  grid-template-columns: minmax(280px, 0.9fr) minmax(420px, 1.4fr);
  gap: 20px;
  align-items: stretch;
  margin-bottom: 24px;
  padding: 20px;
  background: rgba(27, 31, 38, 0.78);
  border: 1px solid var(--lc-border-subtle);
  border-radius: var(--lc-radius-lg);
}

.welcome-copy {
  display: flex;
  flex-direction: column;
  justify-content: center;

  .welcome-eyebrow {
    color: var(--lc-accent);
    font-size: 12px;
    font-weight: 600;
  }

  h2 {
    margin-top: 8px;
    color: var(--lc-text-primary);
    font-size: 20px;
    line-height: 28px;
  }

  p {
    margin-top: 8px;
    color: var(--lc-text-secondary);
    font-size: 13px;
    line-height: 20px;
  }
}

.welcome-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 18px;
}

.quick-template-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
}

.quick-template {
  min-height: 116px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: space-between;
  padding: 12px;
  color: var(--lc-text-secondary);
  background: var(--lc-bg-control);
  border: 1px solid var(--lc-border-subtle);
  border-radius: var(--lc-radius-lg);
  text-align: left;
  cursor: pointer;
  transition:
    border-color 0.16s ease,
    background 0.16s ease,
    transform 0.16s ease;

  &:hover {
    border-color: var(--template-accent);
    background: rgba(79, 140, 255, 0.12);
    transform: translateY(-2px);
  }
}

.quick-preview {
  height: 28px;
  padding: 0 8px;
  display: inline-flex;
  align-items: center;
  color: var(--template-accent);
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid color-mix(in srgb, var(--template-accent) 42%, transparent);
  border-radius: var(--lc-radius-md);
  font-family: var(--lc-font-mono);
  font-size: 11px;
  font-weight: 700;
}

.quick-name {
  margin-top: 12px;
  color: var(--lc-text-primary);
  font-size: 13px;
  font-weight: 600;
}

.quick-meta {
  margin-top: 4px;
  color: var(--lc-text-muted);
  font-size: 11px;
}

.workspace-section {
  margin-bottom: 20px;
  padding: 16px;
  background: rgba(27, 31, 38, 0.64);
  border: 1px solid var(--lc-border-subtle);
  border-radius: var(--lc-radius-lg);
}

.section-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;

  span {
    color: var(--lc-text-muted);
    font-size: 12px;
    font-weight: 600;
  }

  h3 {
    margin: 2px 0 0;
    color: var(--lc-text-primary);
    font-size: 16px;
    line-height: 22px;
  }
}

.recent-project-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

.recent-project {
  min-width: 0;
  display: grid;
  grid-template-columns: 52px minmax(0, 1fr);
  grid-template-rows: auto auto;
  gap: 8px 10px;
  padding: 10px;
  color: var(--lc-text-secondary);
  background: var(--lc-bg-control);
  border: 1px solid var(--lc-border-subtle);
  border-radius: var(--lc-radius-md);
  text-align: left;
  cursor: pointer;
  transition:
    border-color 0.16s ease,
    background 0.16s ease,
    transform 0.16s ease;

  &:hover {
    background: var(--lc-bg-control-hover);
    border-color: var(--lc-border-focus);
    transform: translateY(-1px);
  }
}

.recent-project__thumb {
  grid-row: 1 / span 2;
  width: 52px;
  height: 52px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  color: var(--lc-accent);
  background: var(--lc-bg-canvas);
  border: 1px solid var(--lc-border-subtle);
  border-radius: var(--lc-radius-md);

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
}

.recent-project__main {
  min-width: 0;
  display: grid;
  gap: 3px;

  strong,
  span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  strong {
    color: var(--lc-text-primary);
    font-size: 13px;
  }

  span {
    color: var(--lc-text-muted);
    font-size: 12px;
  }
}

.recent-project__time {
  display: flex;
  align-items: center;
  gap: 4px;
  color: var(--lc-text-muted);
  font-size: 11px;
}

.recent-empty {
  min-height: 72px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px;
  color: var(--lc-text-muted);
  background: var(--lc-bg-control);
  border: 1px dashed var(--lc-border-strong);
  border-radius: var(--lc-radius-md);
}

.example-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

.example-card {
  min-width: 0;
  min-height: 126px;
  display: grid;
  grid-template-columns: 64px minmax(0, 1fr);
  gap: 10px;
  padding: 12px;
  color: var(--lc-text-secondary);
  background: var(--lc-bg-control);
  border: 1px solid var(--lc-border-subtle);
  border-radius: var(--lc-radius-md);
  text-align: left;
  cursor: pointer;
  transition:
    border-color 0.16s ease,
    background 0.16s ease,
    transform 0.16s ease;

  &:hover {
    background: color-mix(in srgb, var(--template-accent) 12%, var(--lc-bg-control));
    border-color: var(--template-accent);
    transform: translateY(-1px);
  }
}

.example-card__visual {
  width: 64px;
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--template-accent);
  background:
    linear-gradient(
      135deg,
      color-mix(in srgb, var(--template-accent) 24%, transparent),
      transparent
    ),
    var(--lc-bg-canvas);
  border: 1px solid color-mix(in srgb, var(--template-accent) 38%, transparent);
  border-radius: var(--lc-radius-md);
  font-family: var(--lc-font-mono);
  font-size: 11px;
  font-weight: 700;
}

.example-card__content {
  min-width: 0;
  display: grid;
  gap: 6px;

  strong {
    color: var(--lc-text-primary);
    font-size: 13px;
  }

  span {
    display: -webkit-box;
    overflow: hidden;
    color: var(--lc-text-secondary);
    font-size: 12px;
    line-height: 18px;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    line-clamp: 2;
  }
}

.example-card__action {
  grid-column: 1 / -1;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: var(--lc-accent);
  font-size: 12px;
  font-weight: 600;
}

.project-cover-field {
  width: 100%;
  display: grid;
  gap: 10px;
}

.cover-file-input {
  display: none;
}

.project-cover-picker {
  width: 100%;
  aspect-ratio: 16 / 9;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  color: var(--lc-text-secondary);
  background: var(--lc-bg-control);
  border: 1px dashed var(--lc-border-strong);
  border-radius: var(--lc-radius-md);
  cursor: pointer;
  transition:
    border-color 0.16s ease,
    background 0.16s ease;

  &:hover {
    background: var(--lc-bg-control-hover);
    border-color: var(--lc-border-focus);
  }

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
}

.project-cover-empty {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}

.create-dialog {
  :deep(.el-dialog) {
    background: #1e1e2e;
    border-radius: 12px;

    .el-dialog__header {
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      padding: 20px 24px;
    }

    .el-dialog__body {
      padding: 24px;
    }

    .el-dialog__footer {
      border-top: 1px solid rgba(255, 255, 255, 0.1);
      padding: 16px 24px;
    }
  }
}

.template-grid {
  width: 100%;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.template-card {
  position: relative;
  min-height: 148px;
  padding: 12px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.04);
  color: #d8deff;
  text-align: left;
  cursor: pointer;
  transition:
    border-color 0.16s ease,
    background 0.16s ease,
    transform 0.16s ease;

  &:hover {
    border-color: rgba(102, 126, 234, 0.7);
    background: rgba(102, 126, 234, 0.12);
  }

  &.active {
    border-color: var(--template-accent);
    background: color-mix(in srgb, var(--template-accent) 18%, transparent);
  }

  .template-name,
  .template-industry,
  .template-desc,
  .template-complexity {
    display: block;
  }

  .template-visual {
    height: 42px;
    display: flex;
    align-items: center;
    padding: 0 10px;
    margin-bottom: 10px;
    color: var(--template-accent);
    background:
      linear-gradient(
        135deg,
        color-mix(in srgb, var(--template-accent) 28%, transparent),
        transparent
      ),
      rgba(255, 255, 255, 0.04);
    border: 1px solid color-mix(in srgb, var(--template-accent) 38%, transparent);
    border-radius: var(--lc-radius-md);
    font-family: var(--lc-font-mono);
    font-size: 12px;
    font-weight: 700;
  }

  .template-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .template-name {
    font-size: 14px;
    font-weight: 600;
    color: #ffffff;
    line-height: 20px;
  }

  .template-industry {
    flex-shrink: 0;
    width: fit-content;
    margin-top: 0;
    padding: 2px 6px;
    border-radius: 4px;
    background: rgba(46, 230, 166, 0.14);
    color: #75f0c7;
    font-size: 11px;
    line-height: 16px;
  }

  .template-desc {
    margin-top: 8px;
    color: #a6adc8;
    font-size: 12px;
    line-height: 18px;
  }

  .template-complexity {
    position: absolute;
    right: 12px;
    bottom: 10px;
    color: var(--lc-text-muted);
    font-size: 11px;
  }
}

@media (max-width: 720px) {
  .welcome-panel {
    grid-template-columns: 1fr;
  }

  .quick-template-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .recent-project-grid,
  .example-grid {
    grid-template-columns: 1fr;
  }

  .template-grid {
    grid-template-columns: 1fr;
  }
}
</style>
