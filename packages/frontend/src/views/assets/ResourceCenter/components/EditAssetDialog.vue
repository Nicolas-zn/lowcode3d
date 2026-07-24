<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { Plus, Box, Sunny, Picture } from '@element-plus/icons-vue'
import type { Asset } from '@/api/assets'
import { assetsApi } from '@/api'
import { PLACE_CATEGORIES } from '@/data/placeIcons'

const props = defineProps<{
  modelValue: boolean
  asset: Asset | undefined
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'success'): void
}>()

const dialogVisible = ref(false)
const isSubmitting = ref(false)
const form = ref({
  name: '',
  category: '',
  thumbnailFile: undefined as File | undefined,
  thumbnailPreview: '',
  isPublic: true,
})

// 是否显示缩略图上传（模型和HDR显示）
const showThumbnailUpload = computed(() => {
  return props.asset?.type === 'model' || props.asset?.type === 'hdri'
})

// 是否显示图片预览（纹理和标注图标显示原图）
const showImagePreview = computed(() => {
  return props.asset?.type === 'texture' || props.asset?.type === 'place_icon'
})

// 获取当前资源类型对应的图标
const assetTypeIcon = computed(() => {
  switch (props.asset?.type) {
    case 'model':
      return Box
    case 'hdri':
      return Sunny
    default:
      return Picture
  }
})

// 获取对话框标题
const dialogTitle = computed(() => {
  switch (props.asset?.type) {
    case 'model':
      return '编辑模型'
    case 'hdri':
      return '编辑 HDR 环境'
    case 'texture':
      return '编辑纹理'
    case 'place_icon':
      return '编辑标注图标'
    default:
      return '编辑资源'
  }
})

watch(
  () => props.modelValue,
  (val) => {
    dialogVisible.value = val
    if (val && props.asset) {
      form.value.name = props.asset.name
      form.value.category = props.asset.category || ''
      form.value.thumbnailFile = undefined
      form.value.thumbnailPreview = props.asset.thumbnailUrl || props.asset.url || ''
      form.value.isPublic = props.asset.isPublic ?? true
    }
  }
)

watch(dialogVisible, (val) => {
  emit('update:modelValue', val)
})

const handleThumbnailChange = (file: File) => {
  if (file) {
    const isImage = file.type.startsWith('image/')
    if (!isImage) {
      ElMessage.warning('请选择图片文件')
      return
    }

    form.value.thumbnailFile = file
    form.value.thumbnailPreview = URL.createObjectURL(file)
  }
}

const triggerThumbnailSelect = () => {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'image/*'
  input.onchange = (e) => {
    const file = (e.target as HTMLInputElement).files?.[0]
    if (file) handleThumbnailChange(file)
  }
  input.click()
}

const handleSubmit = async () => {
  if (!props.asset) return
  if (!form.value.name.trim()) {
    ElMessage.warning('请输入名称')
    return
  }

  isSubmitting.value = true
  try {
    const result = await assetsApi.updateAsset(
      props.asset.id,
      undefined, // 不替换主文件
      {
        name: form.value.name,
        category: form.value.category,
        isPublic: form.value.isPublic,
        thumbnail: form.value.thumbnailFile,
      }
    )

    if (result.success) {
      ElMessage.success('更新成功')
      dialogVisible.value = false
      emit('success')
    } else {
      ElMessage.error(result.error || '更新失败')
    }
  } catch (e) {
    ElMessage.error('更新失败')
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <el-dialog
    v-model="dialogVisible"
    :title="dialogTitle"
    width="400px"
    class="edit-dialog"
    :close-on-click-modal="false"
  >
    <el-form :model="form" label-width="70px">
      <!-- 缩略图预览/替换（模型和HDR） -->
      <el-form-item v-if="showThumbnailUpload" label="缩略图">
        <div class="image-uploader" @click="triggerThumbnailSelect">
          <img v-if="form.thumbnailPreview" :src="form.thumbnailPreview" class="image-preview" />
          <div v-else class="image-placeholder">
            <el-icon :size="32">
              <component :is="assetTypeIcon" />
            </el-icon>
            <span>无缩略图</span>
          </div>
          <div class="hover-mask">
            <el-icon>
              <Plus />
            </el-icon>
            <span>点击替换缩略图</span>
          </div>
        </div>
      </el-form-item>

      <!-- 图片预览（纹理和标注图标显示原图，不可替换） -->
      <el-form-item v-else-if="showImagePreview" label="预览">
        <div class="image-preview-only">
          <img v-if="form.thumbnailPreview" :src="form.thumbnailPreview" class="preview-image" />
          <div v-else class="image-placeholder">
            <el-icon :size="32">
              <Picture />
            </el-icon>
          </div>
        </div>
      </el-form-item>

      <el-form-item label="名称" required>
        <el-input v-model="form.name" placeholder="请输入名称" maxlength="50" show-word-limit />
      </el-form-item>

      <el-form-item v-if="asset?.type === 'place_icon'" label="分类">
        <el-select v-model="form.category" placeholder="请选择分类" style="width: 100%">
          <el-option
            v-for="cat in PLACE_CATEGORIES"
            :key="cat.id"
            :label="cat.label"
            :value="cat.id"
          />
        </el-select>
      </el-form-item>
      <el-form-item v-else label="分类">
        <el-input v-model="form.category" placeholder="请输入分类（可选）" />
      </el-form-item>

      <el-form-item label="公开资源">
        <el-switch v-model="form.isPublic" />
        <span style="margin-left: 8px; color: #909399; font-size: 12px">
          开启后其他用户可以查看此资源
        </span>
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="dialogVisible = false">取消</el-button>
      <el-button type="primary" :loading="isSubmitting" @click="handleSubmit"> 保存 </el-button>
    </template>
  </el-dialog>
</template>

<style scoped lang="scss">
.edit-dialog {
  :deep(.el-dialog) {
    background: #1e1e2e;
    border-radius: 12px;

    .el-dialog__header {
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);

      .el-dialog__title {
        color: #fff;
      }
    }

    .el-dialog__body {
      padding: 24px;
    }

    .el-dialog__footer {
      border-top: 1px solid rgba(255, 255, 255, 0.1);
    }
  }
}

.image-uploader {
  width: 100px;
  height: 100px;
  border: 1px dashed rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  cursor: pointer;
  position: relative;
  overflow: hidden;
  background: rgba(0, 0, 0, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;

  .image-preview {
    width: 100%;
    height: 100%;
    object-fit: contain;
    padding: 4px;
  }

  .image-placeholder {
    display: flex;
    flex-direction: column;
    align-items: center;
    color: #909399;
    font-size: 12px;
    gap: 4px;
  }

  .hover-mask {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: #fff;
    opacity: 0;
    transition: opacity 0.2s;

    .el-icon {
      font-size: 20px;
      margin-bottom: 4px;
    }

    span {
      font-size: 12px;
    }
  }

  &:hover .hover-mask {
    opacity: 1;
  }
}

.image-preview-only {
  width: 100px;
  height: 100px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  overflow: hidden;
  background: rgba(0, 0, 0, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;

  .preview-image {
    width: 100%;
    height: 100%;
    object-fit: contain;
    padding: 4px;
  }

  .image-placeholder {
    display: flex;
    flex-direction: column;
    align-items: center;
    color: #909399;
    font-size: 12px;
    gap: 4px;
  }
}
</style>
