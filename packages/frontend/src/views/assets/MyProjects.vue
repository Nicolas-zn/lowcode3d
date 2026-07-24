<script setup lang="ts">
/**
 * 我的项目组件
 */
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  Plus,
  Delete,
  Edit,
  View,
  Timer,
  Folder,
  Picture,
  Upload,
  Close,
} from '@element-plus/icons-vue'
import { useProjectStore } from '@/stores/projectStore'
import type { Project } from '@/api/projects'
import { imageFileToProjectCoverDataUrl } from '@/utils/projectCover'

// Emits
const emit = defineEmits<{
  (e: 'showCreateDialog'): void
}>()

const router = useRouter()
const projectStore = useProjectStore()

// 编辑对话框状态
const showEditDialog = ref(false)
const editCoverInput = ref<HTMLInputElement | null>(null)
const editForm = ref({
  id: '',
  name: '',
  description: '',
  isPublic: false,
  thumbnailUrl: '' as string | null,
})

// 计算属性
const projects = computed(() => projectStore.projects)
const loading = computed(() => projectStore.loading)

// 方法
const handleOpenProject = (project: Project) => {
  router.push(`/editor/${project.id}`)
}

const handleEditProject = (project: Project) => {
  editForm.value = {
    id: project.id,
    name: project.name,
    description: project.description || '',
    isPublic: project.isPublic,
    thumbnailUrl: project.thumbnailUrl || '',
  }
  showEditDialog.value = true
}

const handleEditCoverChange = async (event: Event) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return

  try {
    editForm.value.thumbnailUrl = await imageFileToProjectCoverDataUrl(file)
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '封面图片处理失败')
  }
}

const handleClearEditCover = () => {
  editForm.value.thumbnailUrl = null
}

const handleSaveEdit = async () => {
  if (!editForm.value.name.trim()) {
    ElMessage.warning('请输入项目名称')
    return
  }

  try {
    await projectStore.updateProject(editForm.value.id, {
      name: editForm.value.name,
      description: editForm.value.description,
      isPublic: editForm.value.isPublic,
      thumbnailUrl: editForm.value.thumbnailUrl || null,
    })
    showEditDialog.value = false
    ElMessage.success('项目信息已更新')
  } catch (e) {
    ElMessage.error('更新失败')
  }
}

const handleDeleteProject = async (project: Project) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除项目 "${project.name}" 吗？此操作不可恢复。`,
      '删除确认',
      {
        confirmButtonText: '删除',
        cancelButtonText: '取消',
        type: 'warning',
      }
    )

    await projectStore.deleteProject(project.id)
    ElMessage.success('项目已删除')
  } catch (e) {
    if (e !== 'cancel') {
      ElMessage.error('删除失败')
    }
  }
}

const formatDate = (dateStr: string) => {
  const date = new Date(dateStr)
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const getStatusTag = (status: string) => {
  const map: Record<string, { type: 'success' | 'warning' | 'info'; label: string }> = {
    draft: { type: 'info', label: '草稿' },
    published: { type: 'success', label: '已发布' },
    archived: { type: 'warning', label: '已归档' },
  }
  return map[status] || { type: 'info', label: status }
}
</script>

<template>
  <div class="my-projects">
    <div class="content-header">
      <h2>我的项目</h2>
      <el-button type="primary" :icon="Plus" @click="emit('showCreateDialog')">
        新建项目
      </el-button>
    </div>

    <div v-if="loading" class="loading-state">
      <el-skeleton :rows="3" animated />
    </div>

    <div v-else-if="projects.length === 0" class="empty-state">
      <div class="empty-icon">
        <el-icon>
          <Folder />
        </el-icon>
      </div>
      <h3>还没有项目</h3>
      <p>点击上方的"新建项目"按钮开始创作你的第一个 3D 场景</p>
      <el-button type="primary" :icon="Plus" @click="emit('showCreateDialog')">
        创建第一个项目
      </el-button>
    </div>

    <div v-else class="project-grid">
      <div
        v-for="project in projects"
        :key="project.id"
        class="project-card"
        @click="handleOpenProject(project)"
      >
        <div class="project-thumbnail">
          <img v-if="project.thumbnailUrl" :src="project.thumbnailUrl" :alt="project.name" />
          <div v-else class="placeholder-thumbnail">
            <el-icon>
              <Picture />
            </el-icon>
          </div>
          <div class="project-overlay">
            <el-button :icon="View" circle @click.stop="handleOpenProject(project)" />
            <el-button :icon="Edit" circle @click.stop="handleEditProject(project)" />
            <el-button
              :icon="Delete"
              circle
              type="danger"
              @click.stop="handleDeleteProject(project)"
            />
          </div>
        </div>
        <div class="project-info">
          <div class="project-title">
            <el-icon>
              <Edit />
            </el-icon>
            <span>{{ project.name }}</span>
          </div>
          <p v-if="project.description" class="project-desc">{{ project.description }}</p>
          <div class="project-meta">
            <el-tag :type="getStatusTag(project.status).type" size="small">
              {{ getStatusTag(project.status).label }}
            </el-tag>
            <span class="project-time">
              <el-icon>
                <Timer />
              </el-icon>
              {{ formatDate(project.updatedAt) }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- 编辑项目对话框 -->
    <el-dialog v-model="showEditDialog" title="编辑项目" width="560px" class="edit-dialog">
      <el-form :model="editForm" label-width="80px">
        <el-form-item label="项目名称" required>
          <el-input
            v-model="editForm.name"
            placeholder="请输入项目名称"
            maxlength="50"
            show-word-limit
          />
        </el-form-item>
        <el-form-item label="项目描述">
          <el-input
            v-model="editForm.description"
            type="textarea"
            :rows="3"
            placeholder="请输入项目描述（可选）"
            maxlength="200"
            show-word-limit
          />
        </el-form-item>
        <el-form-item label="项目封面">
          <div class="project-cover-field">
            <input
              ref="editCoverInput"
              class="cover-file-input"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              @change="handleEditCoverChange"
            />
            <button type="button" class="project-cover-picker" @click="editCoverInput?.click()">
              <img v-if="editForm.thumbnailUrl" :src="editForm.thumbnailUrl" alt="项目封面预览" />
              <span v-else class="project-cover-empty">
                <el-icon><Upload /></el-icon>
                <span>上传封面图</span>
              </span>
            </button>
            <el-button
              v-if="editForm.thumbnailUrl"
              size="small"
              :icon="Close"
              @click="handleClearEditCover"
            >
              清空封面
            </el-button>
          </div>
        </el-form-item>
        <el-form-item label="设为公开">
          <el-switch v-model="editForm.isPublic" active-text="公开" inactive-text="私有" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showEditDialog = false">取消</el-button>
        <el-button type="primary" :loading="projectStore.loading" @click="handleSaveEdit">
          保存
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped lang="scss">
.my-projects {
  height: 100%;
}

.content-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;

  h2 {
    font-size: 24px;
    font-weight: 600;
    color: #fff;
  }
}

.loading-state,
.empty-state {
  padding: 60px 0;
  text-align: center;
}

.empty-state {
  .empty-icon {
    width: 64px;
    height: 64px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 16px;
    color: var(--lc-accent);
    background: var(--lc-bg-control);
    border: 1px solid var(--lc-border-subtle);
    border-radius: var(--lc-radius-lg);
    font-size: 30px;
  }

  h3 {
    font-size: 20px;
    color: #fff;
    margin-bottom: 8px;
  }

  p {
    color: #a6adc8;
    margin-bottom: 24px;
  }
}

.project-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 24px;
}

.project-card {
  background: rgba(30, 30, 50, 0.8);
  border-radius: 16px;
  overflow: hidden;
  transition: all 0.3s ease;
  cursor: pointer;
  border: 1px solid rgba(255, 255, 255, 0.05);

  &:hover {
    transform: translateY(-4px);
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.3);
    border-color: rgba(102, 126, 234, 0.5);

    .project-thumbnail .project-overlay {
      opacity: 1;
    }
  }

  .project-thumbnail {
    position: relative;
    height: 160px;
    background: linear-gradient(135deg, #2a2a4a 0%, #1e1e2e 100%);

    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .placeholder-thumbnail {
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--lc-text-muted);
      font-size: 36px;
    }

    .project-overlay {
      position: absolute;
      inset: 0;
      background: rgba(0, 0, 0, 0.6);
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      opacity: 0;
      transition: opacity 0.3s ease;
    }
  }

  .project-info {
    padding: 16px;

    .project-title {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 16px;
      font-weight: 600;
      color: #fff;
      margin-bottom: 8px;

      .el-icon {
        color: #667eea;
      }
    }

    .project-desc {
      font-size: 13px;
      color: #a6adc8;
      margin-bottom: 12px;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    .project-meta {
      display: flex;
      align-items: center;
      justify-content: space-between;

      .project-time {
        display: flex;
        align-items: center;
        gap: 4px;
        font-size: 12px;
        color: #6c7086;
      }
    }
  }
}

.edit-dialog {
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
</style>
