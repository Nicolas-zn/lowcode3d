<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import BillboardPreview from './BillboardPreview.vue'
import { assetsApi } from '@/api'
import type { Asset } from '@/api/assets'
import { BillboardMode } from '@/engine/objects/BillboardComponent'
import type { BillboardAnimationType } from '@/engine/objects/BillboardComponent'

const props = defineProps<{
  modelValue: boolean
  editAsset?: Asset
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'success'): void
}>()

const loading = ref(false)
const isLoadingData = ref(false)
const originalConfig = ref<any>(null)

const isEditMode = computed(() => !!props.editAsset)

const form = reactive({
  name: '',
  width: 2,
  height: 2,
  frontFile: null as File | null,
  frontPreview: '',
  backFile: null as File | null,
  backPreview: '',
  useDoubleSided: false,
  mode: BillboardMode.Y_LOCK,
  animation: 'NONE' as BillboardAnimationType,
  repeatX: 1,
  repeatY: 1,
  isVideo: false,
  isPublic: true,
})

const visible = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val),
})

watch(
  () => props.modelValue,
  async (val) => {
    if (val) {
      if (props.editAsset) {
        isLoadingData.value = true
        try {
          const res = await fetch(props.editAsset.url)
          const config = await res.json()
          originalConfig.value = config
          form.name = props.editAsset.name
          form.width = config.width || 2
          form.height = config.height || 2
          form.frontPreview = config.frontUrl
          form.backPreview = config.backUrl
          form.useDoubleSided = config.useDoubleSided || false
          form.mode = config.mode || BillboardMode.Y_LOCK
          form.animation = config.animation || 'NONE'
          const repeat = config.repeat || [1, 1]
          form.repeatX = repeat[0]
          form.repeatY = repeat[1]
          form.isVideo = config.isVideo || false
          form.isPublic = props.editAsset.isPublic ?? true
          form.frontFile = null
          form.backFile = null
        } catch (e) {
          console.error('Failed to load billboard data', e)
          ElMessage.error('加载详情失败')
        } finally {
          isLoadingData.value = false
        }
      } else {
        // 重置表单
        form.name = ''
        form.frontFile = null
        form.frontPreview = ''
        form.backFile = null
        form.backPreview = ''
        form.width = 2
        form.height = 2
        form.useDoubleSided = false
        form.mode = BillboardMode.Y_LOCK
        form.animation = 'NONE'
        form.repeatX = 1
        form.repeatY = 1
        form.isVideo = false
        form.isPublic = true
        originalConfig.value = null
      }
    }
  }
)

function handleFileSelect(side: 'front' | 'back') {
  if (side === 'back' && form.useDoubleSided) return

  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'image/png,image/jpeg,image/webp,video/mp4,video/webm'
  input.onchange = (e) => {
    const file = (e.target as HTMLInputElement).files?.[0]
    if (file) {
      const isVideo = file.type.startsWith('video/')

      // 检查类型一致性
      if (side === 'back' && form.frontPreview) {
        if (form.isVideo !== isVideo) {
          ElMessage.warning('正面和背面必须同为图片或视频')
          return
        }
      }

      if (side === 'front') {
        form.frontFile = file
        form.frontPreview = URL.createObjectURL(file)
        form.isVideo = isVideo

        // 如果切换了类型，且有背面图，可能需要清除背面或者警告？
        // 简单处理：如果上传正面时类型改变，且有背面，且背面类型不符，清除背面
        // 但这里我们假设用户按顺序操作，或者再次校验

        // 自动设置名称 (仅在创建模式且名字为空时)
        if (!isEditMode.value && !form.name) {
          form.name = file.name.replace(/\.[^/.]+$/, '')
        }
      } else {
        form.backFile = file
        form.backPreview = URL.createObjectURL(file)
      }
    }
  }
  input.click()
}

async function handleSubmit() {
  if (!form.name) {
    ElMessage.warning('请输入名称')
    return
  }

  // 仅在创建模式或这编辑模式下清空了预览时检查
  if (!form.frontPreview && !form.frontFile) {
    ElMessage.warning('请至少上传正面图片')
    return
  }

  loading.value = true
  try {
    // 1. 准备正面图片数据
    let frontRes = {
      id: originalConfig.value?.frontAssetId,
      url: originalConfig.value?.frontUrl,
    }

    if (form.frontFile) {
      const res = await assetsApi.uploadAsset(form.frontFile, {
        name: `${form.name}_front`,
        category: 'billboard_texture',
        tags: ['billboard', 'front'],
      })
      if (!res.success || !res.data) throw new Error(res.error || '正面图片上传失败')
      frontRes = res.data
    }

    // 2. 准备背面图片数据
    let backRes = {
      id: originalConfig.value?.backAssetId,
      url: originalConfig.value?.backUrl,
    }

    if (form.useDoubleSided) {
      // 双面渲染：使用正面图片
      backRes = { ...frontRes }
    } else if (form.backFile) {
      // 如果上传了新背面图片
      const res = await assetsApi.uploadAsset(form.backFile, {
        name: `${form.name}_back`,
        category: 'billboard_texture',
        tags: ['billboard', 'back'],
      })
      if (!res.success || !res.data) throw new Error(res.error || '背面图片上传失败')
      backRes = res.data
    } else if (originalConfig.value && !originalConfig.value.useDoubleSided) {
      // 如果原来不是双面，为了保留原来的背面，不做操作。
      // 但如果原来是双面，现在切回单面，backRes默认就是undefined（如果没有上传新图）。
      // 这里的逻辑：backRes 初始化为 originalConfig 的背面。
      // 如果现在是双面，覆盖为 frontRes。
      // 如果现在是单面，且上传了新图，覆盖为新图。
      // 否则保持原样。
    }

    // 3. 创建/更新广告牌描述文件
    const billboardConfig = {
      type: 'billboard',
      width: form.width,
      height: form.height,
      frontAssetId: frontRes?.id,
      frontUrl: frontRes?.url,
      backAssetId: backRes?.id,
      backUrl: backRes?.url,
      useDoubleSided: form.useDoubleSided,
      mode: form.mode,
      animation: form.animation,
      repeat: [form.repeatX, form.repeatY],
      isVideo: form.isVideo,
    }

    const jsonContent = JSON.stringify(billboardConfig, null, 2)
    const blob = new Blob([jsonContent], { type: 'application/json' })
    const file = new File([blob], `${form.name}.billboard`, { type: 'application/json' })

    if (isEditMode.value && props.editAsset) {
      // 更新
      const res = await assetsApi.updateAsset(props.editAsset.id, file, {
        name: form.name,
        thumbnail: form.frontFile || undefined, // 只有当上传了新封面时才更新缩略图
        isPublic: form.isPublic,
      })

      if (res.success) {
        ElMessage.success('更新成功')
        visible.value = false
        emit('success')
      } else {
        throw new Error(res.error || '更新失败')
      }
    } else {
      // 创建
      const thumb = form.frontFile
      const res = await assetsApi.uploadAsset(file, {
        name: form.name,
        category: 'billboard',
        thumbnail: thumb || undefined,
        tags: ['billboard', 'preset'],
        isPublic: form.isPublic,
      })

      if (res.success) {
        ElMessage.success('创建成功')
        visible.value = false
        emit('success')
        // 重置会在 watch false 时触发吗？ 或者这里手动重置
      } else {
        throw new Error(res.error || '创建失败')
      }
    }
  } catch (e: any) {
    ElMessage.error(e.message || '操作失败')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <el-dialog
    v-model="visible"
    :title="isEditMode ? '编辑广告牌' : '创建广告牌'"
    width="800px"
    :close-on-click-modal="false"
    append-to-body
  >
    <div v-loading="isLoadingData" class="create-billboard-container">
      <!-- 左侧表单 -->
      <div class="form-section">
        <el-form :model="form" label-width="80px" label-position="top">
          <el-form-item label="名称" required>
            <el-input v-model="form.name" placeholder="请输入广告牌名称" />
          </el-form-item>

          <div class="size-row">
            <el-form-item label="宽度 (m)" required>
              <el-input-number
                v-model="form.width"
                :min="0.1"
                :step="0.1"
                controls-position="right"
              />
            </el-form-item>
            <el-form-item label="高度 (m)" required>
              <el-input-number
                v-model="form.height"
                :min="0.1"
                :step="0.1"
                controls-position="right"
              />
            </el-form-item>
          </div>

          <el-form-item label="面向模式">
            <el-select v-model="form.mode">
              <el-option label="固定" :value="BillboardMode.NONE" />
              <el-option label="全向跟随" :value="BillboardMode.FULL" />
              <el-option label="锁定Y轴" :value="BillboardMode.Y_LOCK" />
            </el-select>
          </el-form-item>

          <el-form-item label="双面渲染">
            <el-switch v-model="form.useDoubleSided" />
            <span class="hint-text">启用后背面将显示与正面相同的图片</span>
          </el-form-item>

          <el-form-item label="公开资源">
            <el-switch v-model="form.isPublic" />
            <span class="hint-text">开启后其他用户可以查看此资源</span>
          </el-form-item>

          <el-form-item label="自带动画">
            <el-select v-model="form.animation">
              <el-option label="无" value="NONE" />
              <el-option label="上下浮动 (Float)" value="FLOAT" />
              <el-option label="缩放脉冲 (Scale)" value="SCALE" />
            </el-select>
          </el-form-item>

          <div class="size-row">
            <el-form-item label="纹理重复 X">
              <el-input-number
                v-model="form.repeatX"
                :min="1"
                :step="1"
                controls-position="right"
              />
            </el-form-item>
            <el-form-item label="纹理重复 Y">
              <el-input-number
                v-model="form.repeatY"
                :min="1"
                :step="1"
                controls-position="right"
              />
            </el-form-item>
          </div>

          <div class="images-row">
            <el-form-item label="正面图片" required class="image-item">
              <div class="image-uploader" @click="handleFileSelect('front')">
                <video
                  v-if="form.frontPreview && form.isVideo"
                  :src="form.frontPreview"
                  class="preview-img"
                  muted
                  loop
                  autoplay
                ></video>
                <img v-else-if="form.frontPreview" :src="form.frontPreview" class="preview-img" />
                <div v-else class="upload-placeholder">
                  <el-icon :size="24">
                    <Plus />
                  </el-icon>
                  <span>选择图片/视频</span>
                </div>
              </div>
            </el-form-item>

            <el-form-item label="背面图片 (可选)" class="image-item">
              <div
                class="image-uploader"
                :class="{ disabled: form.useDoubleSided }"
                @click="handleFileSelect('back')"
              >
                <video
                  v-if="form.backPreview && form.isVideo && !form.useDoubleSided"
                  :src="form.backPreview"
                  class="preview-img"
                  muted
                  loop
                  autoplay
                ></video>
                <img
                  v-else-if="form.backPreview && !form.useDoubleSided"
                  :src="form.backPreview"
                  class="preview-img"
                />
                <!-- 遮罩或提示 -->
                <div v-if="form.useDoubleSided" class="disabled-overlay">
                  <span>已启用双面渲染</span>
                </div>
                <div v-else-if="!form.backPreview" class="upload-placeholder">
                  <el-icon :size="24">
                    <Plus />
                  </el-icon>
                  <span>选择图片/视频</span>
                </div>
              </div>
            </el-form-item>
          </div>
        </el-form>
      </div>

      <!-- 右侧预览 -->
      <div class="preview-section">
        <div class="section-title">预览</div>
        <BillboardPreview
          :front-url="form.frontPreview"
          :back-url="form.useDoubleSided ? form.frontPreview : form.backPreview"
          :width="form.width"
          :height="form.height"
          :mode="form.mode"
          :animation="form.animation"
          :repeat="[form.repeatX, form.repeatY]"
          :is-video="form.isVideo"
        />
        <div class="preview-hint">可以使用鼠标旋转查看正反面效果</div>
      </div>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <el-button @click="visible = false">取消</el-button>
        <el-button type="primary" :loading="loading" @click="handleSubmit">
          {{ isEditMode ? '保存' : '创建' }}
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<style scoped lang="scss">
.create-billboard-container {
  display: flex;
  gap: 24px;
}

.form-section {
  flex: 1;
  min-width: 320px;
}

.hint-text {
  margin-left: 10px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.preview-section {
  flex: 1;
  background: #1e1e1e;
  padding: 16px;
  border-radius: 8px;
  display: flex;
  flex-direction: column;

  .section-title {
    color: #fff;
    margin-bottom: 12px;
    font-size: 14px;
    font-weight: 500;
  }

  .preview-hint {
    margin-top: 12px;
    color: #666;
    font-size: 12px;
    text-align: center;
  }
}

.size-row {
  display: flex;
  gap: 16px;

  .el-form-item {
    flex: 1;
  }

  :deep(.el-input-number) {
    width: 100%;
  }
}

.images-row {
  display: flex;
  gap: 16px;

  .image-item {
    flex: 1;
  }
}

.image-uploader {
  width: 100%;
  aspect-ratio: 1;
  border: 1px dashed var(--el-border-color);
  border-radius: 6px;
  cursor: pointer;
  position: relative;
  overflow: hidden;
  transition: var(--el-transition-duration);
  background: var(--el-fill-color-light);
  display: flex;
  justify-content: center;
  align-items: center;

  &:hover {
    border-color: var(--el-color-primary);
  }

  &.disabled {
    cursor: not-allowed;
    border-color: var(--el-border-color-lighter);
    background: var(--el-fill-color-extra-light);

    &:hover {
      border-color: var(--el-border-color-lighter);
    }
  }

  .disabled-overlay {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(255, 255, 255, 0.7);
    display: flex;
    justify-content: center;
    align-items: center;
    color: var(--el-text-color-secondary);
    font-size: 12px;
  }

  .preview-img {
    width: 100%;
    height: 100%;
    object-fit: contain;
    background-image:
      linear-gradient(45deg, #ccc 25%, transparent 25%),
      linear-gradient(-45deg, #ccc 25%, transparent 25%),
      linear-gradient(45deg, transparent 75%, #ccc 75%),
      linear-gradient(-45deg, transparent 75%, #ccc 75%);
    background-size: 20px 20px;
    background-position:
      0 0,
      0 10px,
      10px -10px,
      -10px 0px;
  }

  .upload-placeholder {
    display: flex;
    flex-direction: column;
    align-items: center;
    color: var(--el-text-color-secondary);
    font-size: 12px;
    gap: 8px;
  }
}
</style>
