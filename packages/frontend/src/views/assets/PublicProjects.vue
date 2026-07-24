<script setup lang="ts">
/**
 * 公共项目组件
 */
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { Edit, View, Timer, InfoFilled } from '@element-plus/icons-vue'
import { useProjectStore } from '@/stores/projectStore'
import { ElMessage } from 'element-plus'
import type { Project } from '@/api/projects'

const router = useRouter()
const projectStore = useProjectStore()

// 状态
const publicProjects = ref<Project[]>([])
const loading = ref(false)
const detailsVisible = ref(false)
const activeProject = ref<Project | null>(null)

// 生命周期
onMounted(async () => {
  loading.value = true
  try {
    publicProjects.value = await projectStore.fetchPublicProjects()
  } catch (e) {
    ElMessage.error('获取公共项目列表失败')
  } finally {
    loading.value = false
  }
})

// 计算属性
const previewUrl = computed(() => {
  if (!activeProject.value) return ''
  const baseUrl = window.location.origin + window.location.pathname
  return `${baseUrl}#/preview/${activeProject.value.id}`
})

// 方法
const handleOpenProject = (project: Project) => {
  router.push(`/editor/${project.id}`)
}

const handleShowDetails = (project: Project) => {
  activeProject.value = project
  detailsVisible.value = true
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
</script>

<template>
  <div class="public-projects">
    <div class="content-header">
      <h2>公共项目</h2>
    </div>

    <div v-if="publicProjects.length === 0" class="empty-state">
      <div class="empty-icon">🌐</div>
      <h3>暂无公共项目</h3>
      <p>您可以将自己的项目设置为公开，与他人分享</p>
    </div>

    <div v-else class="project-grid">
      <div
        v-for="project in publicProjects"
        :key="project.id"
        class="project-card"
        @click="handleOpenProject(project)"
      >
        <div class="project-thumbnail">
          <img v-if="project.thumbnailUrl" :src="project.thumbnailUrl" :alt="project.name" />
          <div v-else class="placeholder-thumbnail">
            <span>🖼️</span>
          </div>
          <div class="project-overlay">
            <el-button circle @click.stop="handleOpenProject(project)">
              <el-icon>
                <View />
              </el-icon>
            </el-button>
            <el-button circle @click.stop="handleShowDetails(project)">
              <el-icon>
                <InfoFilled />
              </el-icon>
            </el-button>
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
            <el-tag type="success" size="small">公开</el-tag>
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

    <!-- 项目详情对话框 -->
    <el-dialog v-model="detailsVisible" title="项目详情" width="500px">
      <div v-if="activeProject" class="project-details">
        <div class="detail-item">
          <label>项目 ID:</label>
          <div class="value code">{{ activeProject.id }}</div>
        </div>
        <div class="detail-item">
          <label>项目名称:</label>
          <div class="value">{{ activeProject.name }}</div>
        </div>
        <div class="detail-item">
          <label>预览地址:</label>
          <div class="value">
            <el-link type="primary" :href="previewUrl" target="_blank">
              {{ previewUrl }}
            </el-link>
          </div>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<style scoped lang="scss">
.public-projects {
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

.empty-state {
  padding: 60px 0;
  text-align: center;

  .empty-icon {
    font-size: 80px;
    margin-bottom: 16px;
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

      .el-button {
        transform: translateY(0);
        opacity: 1;

        &:nth-child(2) {
          transition-delay: 0.05s;
        }
      }
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
      font-size: 48px;
      opacity: 0.3;
    }

    .project-overlay {
      position: absolute;
      inset: 0;
      background: rgba(0, 0, 0, 0.6);
      backdrop-filter: blur(2px);
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      opacity: 0;
      transition: all 0.3s ease;
      z-index: 100;
      pointer-events: none;

      .el-button {
        pointer-events: auto;
        transform: translateY(10px);
        opacity: 0;
        transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
      }
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

.project-details {
  .detail-item {
    margin-bottom: 16px;

    label {
      display: block;
      margin-bottom: 4px;
      color: #909399;
      font-size: 12px;
    }

    .value {
      font-size: 14px;
      color: #303133;
      word-break: break-all;

      &.code {
        font-family: monospace;
        background: #f5f7fa;
        padding: 4px 8px;
        border-radius: 4px;
      }
    }
  }
}
</style>
