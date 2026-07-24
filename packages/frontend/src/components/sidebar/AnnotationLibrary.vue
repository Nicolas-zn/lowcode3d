<script setup lang="ts">
/**
 * 内置标注库组件
 * 显示内置的标注图标，支持拖拽到画布
 * 支持用户上传自定义标注
 */
import { ref, onMounted, computed } from 'vue'
import { Picture, Plus, Delete } from '@element-plus/icons-vue'
import { PLACE_CATEGORIES, type PlaceIcon } from '@/data/placeIcons'
import { assetsApi } from '@/api'
import type { AssetType } from '@/api/assets'
import { ElMessage, ElMessageBox } from 'element-plus'
import { setTransparentDragImage } from '@/utils/dragImage'

defineEmits<{
  (e: 'drag-start', event: DragEvent, icon: PlaceIcon): void
}>()

// 状态
const icons = ref<PlaceIcon[]>([])
const isLoading = ref(false)
const showAddDialog = ref(false)
const isUploading = ref(false)

// 上传表单
const uploadForm = ref({
  label: '',
  category: '',
  file: null as File | null,
  preview: '',
})

// 分类后的图标
const categoryIcons = computed(() => {
  const result: Record<string, PlaceIcon[]> = {}

  // 初始化所有分类
  PLACE_CATEGORIES.forEach((cat) => {
    result[cat.id] = []
  })

  // 填充数据
  icons.value.forEach((icon) => {
    if (result[icon.category]) {
      result[icon.category].push(icon)
    } else {
      // 处理未知分类
      if (!result['Other']) {
        result['Other'] = []
      }
      result['Other'].push(icon)
    }
  })

  return result
})

// 加载图标
async function loadIcons() {
  isLoading.value = true
  try {
    const response = await assetsApi.getAssets('place_icon' as AssetType)
    if (response.success && response.data) {
      // 转换为 PlaceIcon 格式
      icons.value = response.data.map((asset) => ({
        id: asset.id,
        label: asset.name,
        category: asset.category || 'Other',
        svg: asset.url,
        // 保存原始 asset 信息以便删除
        _asset: asset,
      }))
    }
  } catch (e) {
    console.error('Failed to load icons:', e)
    ElMessage.error('加载标注失败')
  } finally {
    isLoading.value = false
  }
}

// 处理拖拽
function handlePlaceIconDragStart(e: DragEvent, icon: PlaceIcon) {
  if (!e.dataTransfer) return

  // 构造拖拽数据，使其被视为 custom_billboard
  const dragData = {
    type: 'custom_billboard',
    componentType: 'poi',
    component: {
      type: 'poi',
      props: {
        iconUrl: icon.svg,
        label: icon.label,
        size: 1,
        anchor: 'bottom',
        alwaysFaceCamera: true,
      },
    },
    asset: {
      id: icon.id, // 使用资源ID
      name: icon.label,
      type: 'billboard',
      url: icon.svg,
      thumbnailUrl: icon.svg,
      category: 'billboard',
      tags: ['place_icon', icon.category],
      fileSize: 0,
    },
  }

  e.dataTransfer.setData('application/json', JSON.stringify(dragData))
  e.dataTransfer.effectAllowed = 'copy'
  setTransparentDragImage(e)
}

// 处理图片加载错误
function handleImageError(event: Event) {
  const img = event.target as HTMLImageElement
  console.warn('Failed to load SVG image:', img.src)
  // 可以替换为默认图标
}

// 处理文件选择
function handleFileChange(file: File) {
  if (file) {
    uploadForm.value.file = file
    uploadForm.value.preview = URL.createObjectURL(file)
    // 自动填充名称
    if (!uploadForm.value.label) {
      uploadForm.value.label = file.name.replace(/\.[^/.]+$/, '')
    }
  }
}

// 提交上传
async function handleSubmitUpload() {
  if (!uploadForm.value.file) {
    ElMessage.warning('请选择文件')
    return
  }
  if (!uploadForm.value.label) {
    ElMessage.warning('请输入名称')
    return
  }
  if (!uploadForm.value.category) {
    ElMessage.warning('请选择分类')
    return
  }

  isUploading.value = true
  try {
    const result = await assetsApi.uploadAsset(uploadForm.value.file, {
      name: uploadForm.value.label,
      category: uploadForm.value.category,
      tags: ['place_icon'],
      type: 'place_icon' as AssetType,
    })

    if (result.success) {
      ElMessage.success('添加成功')
      showAddDialog.value = false
      loadIcons()
    } else {
      ElMessage.error(result.error || '上传失败')
    }
  } catch (e) {
    ElMessage.error('上传失败')
  } finally {
    isUploading.value = false
  }
}

// 删除图标
async function handleDelete(icon: PlaceIcon) {
  try {
    await ElMessageBox.confirm(`确定要删除标注 "${icon.label}" 吗？`, '删除确认', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消',
    })

    const assetId = icon.id // id 就是 asset.id
    const result = await assetsApi.deleteAsset(assetId)

    if (result.success) {
      ElMessage.success('删除成功')
      // 本地移除
      icons.value = icons.value.filter((i) => i.id !== assetId)
    } else {
      ElMessage.error(result.error || '删除失败')
    }
  } catch (e) {
    // Cancelled or error
  }
}

// 生命周期
onMounted(() => {
  loadIcons()
})
</script>

<template>
  <div class="annotation-library">
    <div v-if="isLoading" class="loading-state">加载中...</div>

    <div v-else class="library-content">
      <div v-for="category in PLACE_CATEGORIES" :key="category.id" class="category-group">
        <!-- 仅当该分类有图标时显示 -->
        <template v-if="categoryIcons[category.id] && categoryIcons[category.id].length > 0">
          <div class="category-title">{{ category.label }}</div>
          <div class="icon-grid">
            <div
              v-for="icon in categoryIcons[category.id]"
              :key="icon.id"
              class="icon-item"
              draggable="true"
              :title="icon.label"
              @dragstart="handlePlaceIconDragStart($event, icon)"
            >
              <div class="icon-preview">
                <img v-if="icon.svg" :src="icon.svg" :alt="icon.label" @error="handleImageError" />
                <el-icon v-else :size="24">
                  <Picture />
                </el-icon>

                <div class="icon-actions" @click.stop>
                  <el-icon class="delete-icon" @click="handleDelete(icon)">
                    <Delete />
                  </el-icon>
                </div>
              </div>
              <div class="icon-name">{{ icon.label }}</div>
            </div>
          </div>
        </template>
      </div>

      <!-- 其他分类 -->
      <div
        v-if="categoryIcons['Other'] && categoryIcons['Other'].length > 0"
        class="category-group"
      >
        <div class="category-title">其他</div>
        <div class="icon-grid">
          <div
            v-for="icon in categoryIcons['Other']"
            :key="icon.id"
            class="icon-item"
            draggable="true"
            :title="icon.label"
            @dragstart="handlePlaceIconDragStart($event, icon)"
          >
            <div class="icon-preview">
              <img v-if="icon.svg" :src="icon.svg" :alt="icon.label" @error="handleImageError" />
              <el-icon v-else :size="24">
                <Picture />
              </el-icon>

              <div class="icon-actions" @click.stop>
                <el-icon class="delete-icon" @click="handleDelete(icon)">
                  <Delete />
                </el-icon>
              </div>
            </div>
            <div class="icon-name">{{ icon.label }}</div>
          </div>
        </div>
      </div>

      <div v-if="icons.length === 0" class="empty-state">暂无标注，请点击上方按钮添加</div>
    </div>

    <!-- 添加对话框 -->
    <el-dialog v-model="showAddDialog" title="添加标注" width="400px" append-to-body>
      <el-form :model="uploadForm" label-width="60px">
        <el-form-item label="名称" required>
          <el-input v-model="uploadForm.label" placeholder="请输入标注名称" />
        </el-form-item>

        <el-form-item label="分类" required>
          <el-select v-model="uploadForm.category" placeholder="请选择分类" style="width: 100%">
            <el-option
              v-for="cat in PLACE_CATEGORIES"
              :key="cat.id"
              :label="cat.label"
              :value="cat.id"
            />
          </el-select>
        </el-form-item>

        <el-form-item label="图标" required>
          <el-upload
            class="avatar-uploader"
            :show-file-list="false"
            :auto-upload="false"
            accept=".svg,.png,.jpg,.jpeg"
            :on-change="(file) => handleFileChange(file.raw!)"
          >
            <img v-if="uploadForm.preview" :src="uploadForm.preview" class="avatar" />
            <el-icon v-else class="avatar-uploader-icon">
              <Plus />
            </el-icon>
          </el-upload>
          <div class="upload-tip">支持 SVG, PNG, JPG</div>
        </el-form-item>
      </el-form>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="showAddDialog = false">取消</el-button>
          <el-button type="primary" :loading="isUploading" @click="handleSubmitUpload">
            确定
          </el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped lang="scss">
.annotation-library {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.library-header {
  padding: 0 0 12px;
  border-bottom: 1px solid var(--el-border-color-lighter);
  margin-bottom: 12px;

  .add-btn {
    width: 100%;
  }
}

.library-content {
  flex: 1;
  overflow-y: auto;
  padding-right: 4px;
}

.loading-state,
.empty-state {
  padding: 20px;
  text-align: center;
  color: var(--el-text-color-secondary);
  font-size: 13px;
}

.category-group {
  margin-bottom: 16px;
}

.category-title {
  font-size: 11px;
  color: var(--el-text-color-regular);
  margin-bottom: 8px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  padding-bottom: 6px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.icon-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

.icon-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 8px;
  background-color: var(--el-fill-color-light);
  border: 1px solid transparent;
  border-radius: 8px;
  cursor: grab;
  transition: all 0.2s ease;
  user-select: none;
  position: relative;

  &:hover {
    background-color: var(--el-fill-color);
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);

    .icon-actions {
      opacity: 1;
    }
  }

  &:active {
    cursor: grabbing;
    transform: scale(0.95);
  }
}

.icon-preview {
  width: 100%;
  aspect-ratio: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8px;
  border-radius: 6px;
  background-color: var(--el-fill-color-darker);
  box-sizing: border-box;
  margin-bottom: 6px;
  position: relative;

  img {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }

  .el-icon {
    color: var(--el-text-color-secondary);
  }
}

.icon-actions {
  position: absolute;
  top: 0;
  right: 0;
  padding: 4px;
  opacity: 0;
  transition: opacity 0.2s;

  .delete-icon {
    font-size: 14px;
    color: var(--el-color-danger);
    cursor: pointer;
    background: rgba(255, 255, 255, 0.8);
    border-radius: 50%;
    padding: 2px;

    &:hover {
      background: #fff;
    }
  }
}

.icon-name {
  font-size: 11px;
  color: var(--el-text-color-primary);
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  width: 100%;
}

.avatar-uploader {
  border: 1px dashed var(--el-border-color);
  border-radius: 6px;
  cursor: pointer;
  position: relative;
  overflow: hidden;
  transition: var(--el-transition-duration-fast);
  width: 100px;
  height: 100px;
  display: flex;
  align-items: center;
  justify-content: center;

  &:hover {
    border-color: var(--el-color-primary);
  }
}

.avatar-uploader-icon {
  font-size: 28px;
  color: #8c939d;
  width: 100px;
  height: 100px;
  text-align: center;
}

.avatar {
  width: 100px;
  height: 100px;
  display: block;
  object-fit: contain;
  padding: 8px;
}

.upload-tip {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-top: 8px;
}
</style>
