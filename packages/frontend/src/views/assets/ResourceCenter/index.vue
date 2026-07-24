<script setup lang="ts">
import { ref, computed, onBeforeUnmount, onMounted, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  Box,
  Picture,
  Sunny,
  MagicStick,
  Refresh,
  Plus,
  UploadFilled,
  InfoFilled,
  Link,
} from '@element-plus/icons-vue'
import { assetsApi } from '@/api'
import type { Asset, AssetType } from '@/api/assets'
import CreateBillboardDialog from '../components/CreateBillboardDialog.vue'
import ModelsPanel from './components/ModelsPanel.vue'
import HdrPanel from './components/HdrPanel.vue'
import MaterialsPanel from './components/MaterialsPanel.vue'
import TexturesPanel from './components/TexturesPanel.vue'
import BillboardsPanel from './components/BillboardsPanel.vue'
import PlaceIconsPanel from './components/PlaceIconsPanel.vue'
import EditAssetDialog from './components/EditAssetDialog.vue'
import ModelPreviewDialog from './components/ModelPreviewDialog.vue'
import {
  ASSET_TYPE_OPTIONS,
  ASSET_TYPE_LABELS,
  RESOURCE_TAB_TYPE_MAP,
  filterAssetsByResourceTab,
  type ResourceTab,
} from './constants'
import { useUserStore } from '@/stores/userStore'
import { useProjectStore } from '@/stores/projectStore'
import { eventBus } from '@/engine'
import { getEngine } from '@/engine/core/Engine'
import { SceneSerializer } from '@/engine/core/SceneSerializer'
import { ProjectDiagnostics } from '@/engine/core/ProjectDiagnostics'
import type { AssetReference } from '@/engine/core/ProjectDiagnostics'
import type { IAssetManifestItem, IProjectData } from '@lowcode3d/shared'

// 用户状态
const userStore = useUserStore()
const isTempUser = computed(() => userStore.isTempUser)
const projectStore = useProjectStore()

// 资源分类
const activeTab = ref<ResourceTab>('models')

// 状态
const assets = ref<Asset[]>([])
const isLoading = ref(false)
const isUploading = ref(false)
const repairAssetId = ref<string | null>(null)
const repairAsset = ref<IAssetManifestItem | null>(null)

// 上传对话框状态
const showUploadDialog = ref(false)
const showCreateBillboard = ref(false)
const showEditDialog = ref(false)
const editingAsset = ref<Asset | undefined>(undefined)

const uploadForm = ref({
  type: 'model',
  uploadMode: 'local' as 'local' | 'url',
  category: '',
  tags: [] as string[],
  name: '',
  sourceUrl: '',
  sourceThumbnailUrl: '',
  thumbnailFile: null as File | null,
  thumbnailPreview: '',
  file: null as File | null,
  fileSize: 0,
  optimize: false,
  isPublic: false,
})

// 标签选项
const tagOptions = computed(() => {
  const options: Record<string, string[]> = {
    model: ['低模', '高模', '动画', 'PBR', '卡通', '写实'],
    hdri: ['日间', '夜间', '黄昏', '阴天', '室内'],
    texture: ['无缝', '4K', '2K', 'PBR', '手绘'],
    billboard: ['透明', '写实', '卡通', '剪影'],
  }
  return options[uploadForm.value.type] || []
})

// 当前类型的 accept
const currentAccept = computed(() => {
  const option = ASSET_TYPE_OPTIONS.find((o) => o.value === uploadForm.value.type)
  return option?.accept || ''
})

// 当前类型的描述
const currentDescription = computed(() => {
  const option = ASSET_TYPE_OPTIONS.find((o) => o.value === uploadForm.value.type)
  return option?.description || ''
})

const uploadDialogTitle = computed(() => {
  const label = ASSET_TYPE_LABELS[uploadForm.value.type as keyof typeof ASSET_TYPE_LABELS]
  return label ? `上传${label}` : '上传资源'
})

// 是否拖拽中
const isDragging = ref(false)

// 过滤资源
const filteredAssets = computed(() => {
  return filterAssetsByResourceTab(assets.value, activeTab.value)
})

const handleCreateBillboard = () => {
  editingAsset.value = undefined
  showCreateBillboard.value = true
}

function handleRepairAssetRequest(payload: { repairAssetId: string; asset: IAssetManifestItem }) {
  repairAssetId.value = payload.repairAssetId
  repairAsset.value = payload.asset
  activeTab.value = mapManifestAssetToTab(payload.asset)
  uploadForm.value.type = mapManifestAssetToUploadType(payload.asset)
  uploadForm.value.name = payload.asset.name || ''
  showUploadDialog.value = true
  ElMessage.info(`正在修复资源：${payload.asset.name}`)
}

function mapManifestAssetToTab(asset: IAssetManifestItem): ResourceTab {
  if (asset.type === 'texture' || asset.type === 'billboard' || asset.type === 'video') {
    return 'textures'
  }
  if (asset.type === 'hdri') return 'hdr'
  if (asset.type === 'unknown') return 'materials'
  return 'models'
}

function mapManifestAssetToUploadType(asset: IAssetManifestItem): AssetType {
  if (asset.type === 'texture' || asset.type === 'billboard' || asset.type === 'video') {
    return 'texture'
  }
  if (asset.type === 'hdri') return 'hdri'
  return 'model'
}

const handleEditBillboard = (asset: Asset) => {
  editingAsset.value = asset
  showCreateBillboard.value = true
}

const handleEditAsset = (asset: Asset) => {
  editingAsset.value = asset
  showEditDialog.value = true
}

// 详情对话框
const showInfoDialog = ref(false)
const currentAssetInfo = ref<Asset | null>(null)
const showModelPreview = ref(false)
const previewAsset = ref<Asset | null>(null)

interface OptimizationRecommendation {
  code: string
  label: string
  reason: string
  action: string
}

interface OptimizationStats {
  triangles?: number
  materials?: number
  meshes?: number
  textures?: number
  maxTextureSize?: number
}

interface OptimizationMetadata {
  stats?: OptimizationStats
  recommendations?: OptimizationRecommendation[]
}

const currentAssetOptimization = computed<OptimizationMetadata | null>(() => {
  const metadata = currentAssetInfo.value?.metadata
  const optimization = metadata ? metadata.optimization : undefined
  if (!optimization || typeof optimization !== 'object') return null
  return optimization as OptimizationMetadata
})

const optimizationStats = computed<OptimizationStats | null>(() => {
  if (currentAssetOptimization.value?.stats) {
    return currentAssetOptimization.value.stats
  }

  const metadata = currentAssetInfo.value?.metadata
  if (!metadata) return null

  const stats: OptimizationStats = {
    triangles: typeof metadata.triangles === 'number' ? metadata.triangles : undefined,
    materials: typeof metadata.materials === 'number' ? metadata.materials : undefined,
    meshes: typeof metadata.meshes === 'number' ? metadata.meshes : undefined,
    textures: typeof metadata.textures === 'number' ? metadata.textures : undefined,
    maxTextureSize:
      typeof metadata.maxTextureSize === 'number' ? metadata.maxTextureSize : undefined,
  }

  return Object.values(stats).some((value) => value !== undefined) ? stats : null
})

const optimizationRecommendations = computed<OptimizationRecommendation[]>(() => {
  const fromMetadata = currentAssetOptimization.value?.recommendations
  if (fromMetadata?.length) return fromMetadata

  const stats = optimizationStats.value
  if (!stats) return []

  const recommendations: OptimizationRecommendation[] = []

  if ((stats.triangles ?? 0) >= 200_000) {
    recommendations.push({
      code: 'draco_recommended',
      label: '启用 Draco',
      reason: `三角面数较高（${stats.triangles?.toLocaleString() ?? 0}）`,
      action: '建议开启 Draco 压缩并拆分 LOD。',
    })
  }

  if ((stats.textures ?? 0) >= 4 || (stats.maxTextureSize ?? 0) >= 2048) {
    recommendations.push({
      code: 'texture_downsample_recommended',
      label: '贴图降采样',
      reason: `纹理数量或尺寸偏高（${stats.textures ?? 0} 张 / ${stats.maxTextureSize ?? 0}px）`,
      action: '优先将大贴图降到 2K 或以下。',
    })
  }

  if ((stats.materials ?? 0) >= 8) {
    recommendations.push({
      code: 'material_merge_recommended',
      label: '合并材质',
      reason: `材质数量较多（${stats.materials ?? 0}）`,
      action: '将重复材质抽成共享预设，减少渲染切换。',
    })
  }

  if ((stats.meshes ?? 0) >= 20) {
    recommendations.push({
      code: 'instance_reuse_recommended',
      label: '复用实例',
      reason: `网格数量较多（${stats.meshes ?? 0}）`,
      action: '对重复模型改用实例化或共享组件。',
    })
  }

  return recommendations
})

const handleShowAssetInfo = (asset: Asset) => {
  currentAssetInfo.value = asset
  showInfoDialog.value = true
}

const handlePreviewAsset = (asset: Asset) => {
  previewAsset.value = asset
  showModelPreview.value = true
}

function handleModelCoverUpdated(updatedAsset: Asset) {
  const index = assets.value.findIndex((asset) => asset.id === updatedAsset.id)
  if (index !== -1) {
    assets.value.splice(index, 1, updatedAsset)
  }
  previewAsset.value = updatedAsset
}

// 监听类型变化，重置分类
watch(
  () => uploadForm.value.type,
  () => {
    if (uploadForm.value.type !== 'model') {
      uploadForm.value.uploadMode = 'local'
    }
    uploadForm.value.category = ''
    uploadForm.value.tags = []
  }
)

// 生命周期
onMounted(() => {
  loadAssets()
  eventBus.on('resource:repair-requested', handleRepairAssetRequest)
})

onBeforeUnmount(() => {
  eventBus.off('resource:repair-requested', handleRepairAssetRequest)
})

// 加载资源
async function loadAssets() {
  isLoading.value = true
  try {
    const response = await assetsApi.getAssets()
    if (response.success && response.data) {
      assets.value = response.data
    }
  } catch (e) {
    console.error('加载资源失败', e)
  } finally {
    isLoading.value = false
  }
}

// 打开上传对话框
function openUploadDialog(type: AssetType = RESOURCE_TAB_TYPE_MAP[activeTab.value] || 'model') {
  uploadForm.value = {
    type,
    uploadMode: 'local',
    category: '',
    tags: [],
    name: '',
    sourceUrl: '',
    sourceThumbnailUrl: '',
    thumbnailFile: null,
    thumbnailPreview: '',
    file: null,
    fileSize: 0,
    optimize: false,
    isPublic: false,
  }
  showUploadDialog.value = true
}

// 选择缩略图
function handleThumbnailSelect() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'image/*'
  input.onchange = (e) => {
    const file = (e.target as HTMLInputElement).files?.[0]
    if (file) {
      uploadForm.value.thumbnailFile = file
      uploadForm.value.thumbnailPreview = URL.createObjectURL(file)
    }
  }
  input.click()
}

// 选择文件
function handleFileSelect() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = currentAccept.value
  input.onchange = (e) => {
    const file = (e.target as HTMLInputElement).files?.[0]
    if (file) {
      setUploadFile(file)
    }
  }
  input.click()
}

// 设置上传文件
function setUploadFile(file: File) {
  uploadForm.value.file = file
  uploadForm.value.fileSize = file.size
  // 自动填充名称（如果为空）
  if (!uploadForm.value.name) {
    uploadForm.value.name = file.name.replace(/\.[^/.]+$/, '')
  }
}

// 拖拽事件
function handleDragOver(e: DragEvent) {
  e.preventDefault()
  isDragging.value = true
}

function handleDragLeave() {
  isDragging.value = false
}

function handleDrop(e: DragEvent) {
  e.preventDefault()
  isDragging.value = false
  const file = e.dataTransfer?.files?.[0]
  if (file) {
    // 验证文件类型
    const ext = '.' + file.name.split('.').pop()?.toLowerCase()
    if (currentAccept.value.includes(ext)) {
      setUploadFile(file)
    } else {
      ElMessage.warning('不支持该文件格式')
    }
  }
}

// 处理资源拖拽开始
function handleAssetDragStart(e: DragEvent, asset: Asset) {
  if (!e.dataTransfer) return

  let dragData: any = { type: 'unknown' }

  if (asset.type === 'model') {
    dragData = {
      type: 'model',
      item: {
        id: asset.id,
        name: asset.name,
        url: asset.url,
        thumbnail: asset.thumbnailUrl,
      },
    }
  } else if (asset.type === 'billboard') {
    dragData = {
      type: 'custom_billboard',
      asset: asset,
    }
  } else {
    // 其他类型不做处理或通用处理
    dragData = {
      type: 'asset',
      asset: asset,
    }
  }

  e.dataTransfer.setData('application/json', JSON.stringify(dragData))
  e.dataTransfer.effectAllowed = 'copy'
}

// 提交上传
async function handleSubmitUpload() {
  if (uploadForm.value.type === 'model' && uploadForm.value.uploadMode === 'url') {
    await handleSubmitUrlAsset()
    return
  }

  // 验证
  if (
    uploadForm.value.type !== 'model' &&
    !uploadForm.value.thumbnailFile &&
    !['place_icon', 'texture'].includes(uploadForm.value.type)
  ) {
    ElMessage.warning('请上传缩略图')
    return
  }
  if (!uploadForm.value.file) {
    ElMessage.warning('请选择要上传的文件')
    return
  }
  if (!uploadForm.value.name.trim()) {
    ElMessage.warning('请输入资源名称')
    return
  }
  isUploading.value = true
  try {
    const result = await assetsApi.uploadAsset(uploadForm.value.file, {
      name: uploadForm.value.name,
      category: undefined,
      thumbnail: uploadForm.value.thumbnailFile || undefined,
      tags: uploadForm.value.tags,
      optimize: uploadForm.value.type === 'model' ? uploadForm.value.optimize : undefined,
      type: uploadForm.value.type as AssetType,
      isPublic: uploadForm.value.isPublic,
    })

    if (result.success) {
      ElMessage.success('上传成功')
      showUploadDialog.value = false
      await loadAssets()
    } else {
      ElMessage.error(result.error || '上传失败')
    }
  } catch (e) {
    ElMessage.error('上传失败')
  } finally {
    isUploading.value = false
  }
}

async function handleSubmitUrlAsset() {
  const sourceUrl = uploadForm.value.sourceUrl.trim()
  const thumbnailUrl = uploadForm.value.sourceThumbnailUrl.trim()

  if (!uploadForm.value.name.trim()) {
    ElMessage.warning('请输入资源名称')
    return
  }
  if (!sourceUrl) {
    ElMessage.warning('请输入模型资源 URL')
    return
  }
  if (!/^https?:\/\//i.test(sourceUrl)) {
    ElMessage.warning('请输入 http/https 模型资源 URL')
    return
  }
  if (!/\.(glb|gltf)(\?.*)?$/i.test(sourceUrl)) {
    ElMessage.warning('模型 URL 仅支持 GLB/GLTF')
    return
  }
  if (thumbnailUrl && !/^https?:\/\//i.test(thumbnailUrl)) {
    ElMessage.warning('请输入 http/https 缩略图 URL')
    return
  }

  isUploading.value = true
  try {
    const result = await assetsApi.createAssetFromUrl({
      name: uploadForm.value.name,
      type: 'model',
      url: sourceUrl,
      category: undefined,
      tags: uploadForm.value.tags,
      thumbnailUrl: thumbnailUrl || undefined,
      isPublic: uploadForm.value.isPublic,
    })

    if (result.success) {
      ElMessage.success('模型资源已记录')
      showUploadDialog.value = false
      await loadAssets()
    } else {
      ElMessage.error(result.error || '记录资源 URL 失败')
    }
  } catch (e) {
    ElMessage.error('记录资源 URL 失败')
  } finally {
    isUploading.value = false
  }
}

// 下载资源
function handleDownload(asset: Asset) {
  if (!asset.url) {
    ElMessage.warning('资源地址无效')
    return
  }

  const link = document.createElement('a')
  link.href = asset.url
  link.download = asset.name
  link.target = '_blank'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

// 删除资源
async function handleDelete(asset: Asset) {
  try {
    const references = findCurrentProjectReferences(asset)

    if (references.length > 0) {
      await confirmReferencedAssetDelete(asset, references)
    } else {
      await ElMessageBox.confirm(`确定要删除 "${asset.name}" 吗？`, '删除确认', {
        confirmButtonText: '删除',
        cancelButtonText: '取消',
        type: 'warning',
      })
    }

    const response = await assetsApi.deleteAsset(asset.id)
    if (response.success) {
      assets.value = assets.value.filter((a) => a.id !== asset.id)
      ElMessage.success('删除成功')
    } else {
      ElMessage.error(response.error || '删除失败')
    }
  } catch (e) {
    // 用户取消
  }
}

function findCurrentProjectReferences(asset: Asset): AssetReference[] {
  const projectData = getReferenceCheckProjectData()
  if (!projectData) return []

  return ProjectDiagnostics.findAssetReferences(projectData, {
    id: asset.id,
    url: asset.url,
    name: asset.name,
    type: asset.type,
  })
}

function getReferenceCheckProjectData(): IProjectData | null {
  const engine = getEngine()

  if (engine?.isInitialized) {
    try {
      return SceneSerializer.serialize(projectStore.currentProject?.name || '当前项目')
    } catch (error) {
      console.warn('无法从当前编辑器生成资源引用快照', error)
    }
  }

  const sceneData = projectStore.currentProject?.sceneData
  if (isProjectData(sceneData)) {
    return sceneData
  }

  return null
}

function isProjectData(value: unknown): value is IProjectData {
  return typeof value === 'object' && value !== null && 'sceneObjects' in value && 'origin' in value
}

async function confirmReferencedAssetDelete(asset: Asset, references: AssetReference[]) {
  const preview = references
    .slice(0, 5)
    .map((reference) => `- ${reference.name}（${reference.source}）`)
    .join('\n')
  const suffix = references.length > 5 ? `\n等 ${references.length} 处引用` : ''

  await ElMessageBox.confirm(
    `资源 "${asset.name}" 正在被当前项目引用，删除后可能导致预览或发布缺失。\n\n${preview}${suffix}\n\n仍然删除吗？`,
    '资源引用风险',
    {
      confirmButtonText: '仍然删除',
      cancelButtonText: '取消',
      type: 'warning',
    }
  )
}

// 格式化文件大小
const formatFileSize = (bytes: number) => {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / 1024 / 1024).toFixed(1) + ' MB'
}
</script>

<template>
  <div class="resource-center">
    <div class="content-header">
      <h2>资源中心</h2>
      <div class="header-actions">
        <el-button :icon="Refresh" :loading="isLoading" @click="loadAssets"> 刷新 </el-button>
      </div>
    </div>

    <!-- 资源分类 Tab -->
    <div class="resource-tabs">
      <div
        class="resource-tab"
        :class="{ active: activeTab === 'models' }"
        @click="activeTab = 'models'"
      >
        <el-icon>
          <Box />
        </el-icon>
        <span>模型资源</span>
      </div>
      <div class="resource-tab" :class="{ active: activeTab === 'hdr' }" @click="activeTab = 'hdr'">
        <el-icon>
          <Sunny />
        </el-icon>
        <span>HDR 环境</span>
      </div>
      <div
        class="resource-tab"
        :class="{ active: activeTab === 'materials' }"
        @click="activeTab = 'materials'"
      >
        <el-icon>
          <MagicStick />
        </el-icon>
        <span>预定义材质</span>
      </div>
      <div
        class="resource-tab"
        :class="{ active: activeTab === 'textures' }"
        @click="activeTab = 'textures'"
      >
        <el-icon>
          <Picture />
        </el-icon>
        <span>纹理贴图</span>
      </div>
      <div
        class="resource-tab"
        :class="{ active: activeTab === 'billboards' }"
        @click="activeTab = 'billboards'"
      >
        <el-icon>
          <Picture />
        </el-icon>
        <span>广告牌</span>
      </div>
      <div
        class="resource-tab"
        :class="{ active: activeTab === 'place-icons' }"
        @click="activeTab = 'place-icons'"
      >
        <el-icon>
          <Picture />
        </el-icon>
        <span>标注图标</span>
      </div>
    </div>

    <!-- 资源内容 -->
    <div class="resource-content">
      <ModelsPanel
        v-if="activeTab === 'models'"
        :assets="filteredAssets"
        :is-loading="isLoading"
        :can-add="!isTempUser"
        @add="openUploadDialog('model')"
        @delete="handleDelete"
        @download="handleDownload"
        @show-info="handleShowAssetInfo"
        @preview="handlePreviewAsset"
        @edit="handleEditAsset"
        @drag-start="handleAssetDragStart"
      />

      <HdrPanel
        v-else-if="activeTab === 'hdr'"
        :assets="filteredAssets"
        :is-loading="isLoading"
        :can-add="!isTempUser"
        @add="openUploadDialog('hdri')"
        @delete="handleDelete"
        @download="handleDownload"
        @edit="handleEditAsset"
      />

      <MaterialsPanel v-else-if="activeTab === 'materials'" />

      <TexturesPanel
        v-else-if="activeTab === 'textures'"
        :assets="filteredAssets"
        :is-loading="isLoading"
        :can-add="!isTempUser"
        @add="openUploadDialog('texture')"
        @delete="handleDelete"
        @download="handleDownload"
        @edit="handleEditAsset"
      />

      <BillboardsPanel
        v-else-if="activeTab === 'billboards'"
        :assets="filteredAssets"
        :is-loading="isLoading"
        :can-add="!isTempUser"
        @add="handleCreateBillboard"
        @delete="handleDelete"
        @edit="handleEditBillboard"
        @show-info="handleShowAssetInfo"
        @drag-start="handleAssetDragStart"
      />

      <PlaceIconsPanel
        v-else-if="activeTab === 'place-icons'"
        :assets="filteredAssets"
        :is-loading="isLoading"
        :can-add="!isTempUser"
        @add="openUploadDialog('place_icon')"
        @delete="handleDelete"
        @edit="handleEditAsset"
        @drag-start="handleAssetDragStart"
      />
    </div>

    <!-- 上传资源对话框 -->
    <el-dialog
      v-model="showUploadDialog"
      :title="uploadDialogTitle"
      width="520px"
      class="upload-dialog"
      :close-on-click-modal="false"
    >
      <el-form :model="uploadForm" label-width="80px" label-position="left">
        <el-form-item v-if="uploadForm.type === 'model'" label="添加方式">
          <el-radio-group v-model="uploadForm.uploadMode">
            <el-radio-button label="local">本地上传</el-radio-button>
            <el-radio-button label="url">记录 URL</el-radio-button>
          </el-radio-group>
        </el-form-item>

        <!-- 标签选择 -->
        <el-form-item v-if="uploadForm.type !== 'place_icon'" label="标签">
          <el-select
            v-model="uploadForm.tags"
            multiple
            placeholder="请选择"
            style="width: 100%"
            collapse-tags
          >
            <el-option v-for="tag in tagOptions" :key="tag" :value="tag" :label="tag" />
          </el-select>
        </el-form-item>

        <!-- 优化模型 -->
        <el-form-item
          v-if="uploadForm.type === 'model' && uploadForm.uploadMode === 'local'"
          label="优化设置"
        >
          <div class="optimize-option">
            <el-radio-group v-model="uploadForm.optimize">
              <el-radio :label="false">不优化</el-radio>
              <el-radio :label="true">自动优化</el-radio>
            </el-radio-group>
            <el-tooltip
              content="开启后会对模型进行 Draco 压缩，可能会大幅减少体积，但可能改变模型单位或精度。注意：如果不优化，模型将保持原始状态上传。"
              placement="top"
            >
              <el-icon class="optimize-help-icon">
                <InfoFilled />
              </el-icon>
            </el-tooltip>
          </div>
        </el-form-item>

        <!-- 缩略图 -->
        <el-form-item
          v-if="
            !['place_icon', 'texture'].includes(uploadForm.type) &&
            uploadForm.uploadMode === 'local'
          "
          label="缩略图"
        >
          <div class="thumbnail-upload" @click="handleThumbnailSelect">
            <img
              v-if="uploadForm.thumbnailPreview"
              :src="uploadForm.thumbnailPreview"
              class="thumbnail-preview"
            />
            <div v-else class="thumbnail-placeholder">
              <el-icon :size="24">
                <Plus />
              </el-icon>
              <span>点击上传</span>
              <small v-if="uploadForm.type === 'model'">可选</small>
            </div>
          </div>
        </el-form-item>

        <!-- 文件上传区域 -->
        <template v-if="uploadForm.type === 'model' && uploadForm.uploadMode === 'url'">
          <el-form-item label="资源 URL" required>
            <el-input
              v-model="uploadForm.sourceUrl"
              :prefix-icon="Link"
              placeholder="https://example.com/model.glb"
            />
          </el-form-item>
          <el-form-item label="缩略图 URL">
            <el-input
              v-model="uploadForm.sourceThumbnailUrl"
              :prefix-icon="Link"
              placeholder="https://example.com/thumbnail.png"
            />
          </el-form-item>
        </template>

        <el-form-item v-else label="文件" required>
          <div
            class="file-upload-area"
            :class="{ dragging: isDragging, 'has-file': uploadForm.file }"
            @click="handleFileSelect"
            @dragover="handleDragOver"
            @dragleave="handleDragLeave"
            @drop="handleDrop"
          >
            <template v-if="uploadForm.file">
              <el-icon :size="32" color="#667eea">
                <UploadFilled />
              </el-icon>
              <div class="file-name">{{ uploadForm.file.name }}</div>
              <div class="file-size">{{ formatFileSize(uploadForm.fileSize) }}</div>
            </template>
            <template v-else>
              <el-icon :size="32">
                <UploadFilled />
              </el-icon>
              <div class="upload-text">点击或者拖动文件到该区域</div>
              <div class="upload-hint">{{ currentDescription }}</div>
            </template>
          </div>
        </el-form-item>

        <!-- 名称 -->
        <el-form-item label="名称" required>
          <el-input v-model="uploadForm.name" placeholder="请输入" maxlength="50" show-word-limit />
        </el-form-item>

        <!-- 公开资源 -->
        <el-form-item label="公开">
          <el-switch v-model="uploadForm.isPublic" />
          <span style="margin-left: 8px; color: #909399; font-size: 12px">
            开启后其他用户可以查看此资源
          </span>
        </el-form-item>

        <!-- 大小 -->
        <el-form-item v-if="uploadForm.fileSize > 0" label="大小">
          <span class="file-size-display">{{ formatFileSize(uploadForm.fileSize) }}</span>
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="showUploadDialog = false">取消</el-button>
        <el-button type="primary" :loading="isUploading" @click="handleSubmitUpload">
          {{ uploadForm.type === 'model' && uploadForm.uploadMode === 'url' ? '记录' : '上传' }}
        </el-button>
      </template>
    </el-dialog>

    <CreateBillboardDialog
      v-model="showCreateBillboard"
      :edit-asset="editingAsset"
      @success="loadAssets"
    />

    <EditAssetDialog v-model="showEditDialog" :asset="editingAsset" @success="loadAssets" />

    <ModelPreviewDialog
      v-model="showModelPreview"
      :asset="previewAsset"
      @cover-updated="handleModelCoverUpdated"
    />

    <!-- 详情对话框 -->
    <el-dialog v-model="showInfoDialog" title="资源详情" width="400px" append-to-body>
      <el-descriptions v-if="currentAssetInfo" :column="1" border>
        <el-descriptions-item label="名称">{{ currentAssetInfo.name }}</el-descriptions-item>
        <el-descriptions-item label="类型">{{ currentAssetInfo.type }}</el-descriptions-item>
        <el-descriptions-item label="文件大小">{{
          formatFileSize(currentAssetInfo.fileSize)
        }}</el-descriptions-item>
        <template v-if="currentAssetInfo.metadata">
          <el-descriptions-item
            v-if="currentAssetInfo.metadata.triangles !== undefined"
            label="三角面数"
          >
            {{ currentAssetInfo.metadata.triangles }}
          </el-descriptions-item>
          <el-descriptions-item
            v-if="currentAssetInfo.metadata.materials !== undefined"
            label="材质数"
          >
            {{ currentAssetInfo.metadata.materials }}
          </el-descriptions-item>
          <el-descriptions-item
            v-if="currentAssetInfo.metadata.animations !== undefined"
            label="动画数"
          >
            {{ currentAssetInfo.metadata.animations }}
          </el-descriptions-item>
          <el-descriptions-item
            v-if="currentAssetInfo.metadata.meshes !== undefined"
            label="网格数"
          >
            {{ currentAssetInfo.metadata.meshes }}
          </el-descriptions-item>
          <el-descriptions-item
            v-if="currentAssetInfo.metadata.textures !== undefined"
            label="贴图数"
          >
            {{ currentAssetInfo.metadata.textures }}
          </el-descriptions-item>
        </template>
      </el-descriptions>
      <div
        v-if="optimizationStats || optimizationRecommendations.length"
        class="optimization-section"
      >
        <div class="optimization-title">优化建议</div>
        <div v-if="optimizationStats" class="optimization-summary">
          <span v-if="optimizationStats.triangles !== undefined"
            >三角面 {{ optimizationStats.triangles }}</span
          >
          <span v-if="optimizationStats.materials !== undefined"
            >材质 {{ optimizationStats.materials }}</span
          >
          <span v-if="optimizationStats.textures !== undefined"
            >贴图 {{ optimizationStats.textures }}</span
          >
          <span v-if="optimizationStats.maxTextureSize !== undefined">
            最大贴图 {{ optimizationStats.maxTextureSize }}px
          </span>
        </div>
        <div v-if="optimizationRecommendations.length" class="optimization-list">
          <div
            v-for="item in optimizationRecommendations"
            :key="item.code"
            class="optimization-row"
          >
            <div class="optimization-label">{{ item.label }}</div>
            <div class="optimization-reason">{{ item.reason }}</div>
            <div class="optimization-action">{{ item.action }}</div>
          </div>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<style scoped lang="scss">
@import './styles.scss';
</style>
