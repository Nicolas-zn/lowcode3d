<script setup lang="ts">
/**
 * 资源中心组件
 */
import { ref, computed, onMounted, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  Box,
  Picture,
  Sunny,
  MagicStick,
  Upload,
  Refresh,
  Download,
  Delete,
  Plus,
  UploadFilled,
  Edit,
  InfoFilled,
} from '@element-plus/icons-vue'
import { assetsApi } from '@/api'
import type { Asset, AssetType } from '@/api/assets'
import { getGroupedMaterials, type IPresetMaterial } from '@/data/presetMaterials'
import CreateBillboardDialog from './components/CreateBillboardDialog.vue'

// 资源类型定义
interface AssetTypeOption {
  value: string
  label: string
  icon: string
  accept: string
  description: string
}

// 资源类型选项
const assetTypeOptions: AssetTypeOption[] = [
  {
    value: 'model',
    label: '模型',
    icon: '📦',
    accept: '.glb,.gltf,.fbx,.obj',
    description: '支持格式: glb、gltf、fbx、obj',
  },
  {
    value: 'hdri',
    label: 'HDR 环境',
    icon: '🌅',
    accept: '.hdr,.exr',
    description: '支持格式: hdr、exr',
  },
  {
    value: 'texture',
    label: '纹理贴图',
    icon: '🎨',
    accept: '.jpg,.jpeg,.png,.webp',
    description: '支持格式: jpg、png、webp',
  },
  {
    value: 'place_icon',
    label: '标注图标',
    icon: '📍',
    accept: '.svg,.png,.jpg,.jpeg',
    description: '支持格式: svg、png、jpg',
  },
]

// 资源分类
type ResourceTab = 'models' | 'hdr' | 'materials' | 'textures' | 'billboards' | 'place-icons'
const activeTab = ref<ResourceTab>('models')

// 状态
const assets = ref<Asset[]>([])
const isLoading = ref(false)
const isUploading = ref(false)

// 上传对话框状态
const showUploadDialog = ref(false)
const showCreateBillboard = ref(false)
const editingAsset = ref<Asset | undefined>(undefined)
const uploadForm = ref({
  type: 'model',
  category: '',
  tags: [] as string[],
  name: '',
  thumbnailFile: null as File | null,
  thumbnailPreview: '',
  file: null as File | null,
  fileSize: 0,
  optimize: false,
})

// removed stray closing brace

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
  const option = assetTypeOptions.find((o) => o.value === uploadForm.value.type)
  return option?.accept || ''
})

// 当前类型的描述
const currentDescription = computed(() => {
  const option = assetTypeOptions.find((o) => o.value === uploadForm.value.type)
  return option?.description || ''
})

// 是否拖拽中
const isDragging = ref(false)

// 过滤资源
const filteredAssets = computed(() => {
  if (activeTab.value === 'billboards') {
    return assets.value.filter(
      (a) =>
        a.type === 'billboard' ||
        a.category === 'billboard' ||
        (a.tags && a.tags.includes('billboard'))
    )
  }
  const typeMap: Record<ResourceTab, string> = {
    models: 'model',
    hdr: 'hdri',
    materials: 'material',
    textures: 'texture',
    billboards: 'billboard',
    'place-icons': 'place_icon',
  }
  const type = typeMap[activeTab.value]
  if (!type) return []
  return assets.value.filter((a) => a.type === type)
})

// 使用共享的预设材质
const groupedMaterials = computed(() => getGroupedMaterials())

// 分组后的标注图标
const groupedPlaceIcons = computed(() => {
  const result: Record<string, Asset[]> = {}

  if (activeTab.value !== 'place-icons') return result

  // 初始化所有分类
  PLACE_CATEGORIES.forEach((cat) => {
    result[cat.id] = []
  })
  result['Other'] = []

  // 填充数据
  filteredAssets.value.forEach((asset) => {
    // 检查 asset.category 是否匹配预定义分类的 ID
    const isKnownCategory = PLACE_CATEGORIES.some((c) => c.id === asset.category)
    if (asset.category && isKnownCategory) {
      if (!result[asset.category]) result[asset.category] = []
      result[asset.category].push(asset)
    } else {
      result['Other'].push(asset)
    }
  })

  return result
})

// 预定义广告牌
const presetBillboards = ref([
  { id: 'bb-tree', name: '树木', icon: '🌲' },
  { id: 'bb-person', name: '人物', icon: '🧑' },
  { id: 'bb-grass', name: '草地', icon: '🌿' },
  { id: 'bb-flower', name: '花朵', icon: '🌸' },
  { id: 'bb-cloud', name: '云朵', icon: '☁️' },
  { id: 'bb-star', name: '星星', icon: '⭐' },
])

const handleCreateBillboard = () => {
  editingAsset.value = undefined
  showCreateBillboard.value = true
}

const handleEditBillboard = (asset: Asset) => {
  editingAsset.value = asset
  showCreateBillboard.value = true
}

// 详情对话框
const showInfoDialog = ref(false)
const currentAssetInfo = ref<Asset | null>(null)

const handleShowAssetInfo = (asset: Asset) => {
  currentAssetInfo.value = asset
  showInfoDialog.value = true
}

// 监听类型变化，重置分类
watch(
  () => uploadForm.value.type,
  () => {
    uploadForm.value.category = ''
    uploadForm.value.tags = []
  }
)

// 生命周期
onMounted(() => {
  loadAssets()
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

// 导入类别数据
import { PLACE_CATEGORIES } from '@/data/placeIcons'

// 打开上传对话框
function openUploadDialog() {
  // 根据当前 tab 预设类型
  const tabToType: Record<ResourceTab, string> = {
    models: 'model',
    hdr: 'hdri',
    materials: 'material',
    textures: 'texture',
    billboards: 'billboard',
    'place-icons': 'place_icon',
  }
  uploadForm.value = {
    type: tabToType[activeTab.value] || 'model',
    category: '',
    tags: [],
    name: '',
    thumbnailFile: null,
    thumbnailPreview: '',
    file: null,
    fileSize: 0,
    optimize: false,
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
  // 验证
  if (
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
  if (!uploadForm.value.category) {
    ElMessage.warning('请选择分类')
    return
  }

  isUploading.value = true
  try {
    const result = await assetsApi.uploadAsset(uploadForm.value.file, {
      name: uploadForm.value.name,
      category: uploadForm.value.category,
      thumbnail: uploadForm.value.thumbnailFile || undefined,
      tags: uploadForm.value.tags,
      optimize: uploadForm.value.type === 'model' ? uploadForm.value.optimize : undefined,
      type: uploadForm.value.type as AssetType,
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

// 下载资源
function handleDownload(asset: Asset) {
  if (!asset.url) {
    ElMessage.warning('资源地址无效')
    return
  }

  const link = document.createElement('a')
  link.href = asset.url
  // 尝试设置下载文件名
  // 注意：跨域资源可能忽略 download 属性，取决于服务器配置
  link.download = asset.name
  link.target = '_blank'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

// 删除资源
async function handleDelete(asset: Asset) {
  try {
    await ElMessageBox.confirm(`确定要删除 "${asset.name}" 吗？`, '删除确认', {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning',
    })

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
// ... (其他代码保持不变) ...

// 在模板中绑定事件（这里只能示意，实际需要工具操作）
// 我将分两次操作：一次添加函数，一次修改模板

// 格式化文件大小
const formatFileSize = (bytes: number) => {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / 1024 / 1024).toFixed(1) + ' MB'
}

// 获取材质预览样式
function getMaterialStyle(mat: IPresetMaterial): Record<string, string> {
  const style: Record<string, string> = {
    backgroundColor: mat.color,
  }

  // 金属材质添加光泽效果
  if (mat.metalness > 0.5) {
    style.background = `linear-gradient(135deg, ${mat.color} 0%, ${lightenColor(mat.color, 40)} 50%, ${mat.color} 100%)`
  }

  // 发光材质添加发光效果
  if (mat.emissive && mat.emissive !== '#000000') {
    style.boxShadow = `0 0 12px ${mat.emissive}, inset 0 0 8px ${mat.emissive}`
  }

  // 透明材质
  if (mat.opacity && mat.opacity < 1) {
    style.opacity = String(0.5 + mat.opacity * 0.5)
  }

  return style
}

// 颜色变亮
function lightenColor(color: string, percent: number): string {
  const num = parseInt(color.replace('#', ''), 16)
  const amt = Math.round(2.55 * percent)
  const R = Math.min(255, (num >> 16) + amt)
  const G = Math.min(255, ((num >> 8) & 0x00ff) + amt)
  const B = Math.min(255, (num & 0x0000ff) + amt)
  return `#${((1 << 24) + (R << 16) + (G << 8) + B).toString(16).slice(1)}`
}

// 处理图片加载错误
function handleImageError(event: Event) {
  const img = event.target as HTMLImageElement
  console.warn('Failed to load SVG image:', img.src)
  // 可以在这里设置一个默认的占位符图片
  // img.src = '/path/to/placeholder.svg'
}
</script>

<template>
  <div class="resource-center">
    <div class="content-header">
      <h2>资源中心</h2>
      <div class="header-actions">
        <el-button :icon="Refresh" :loading="isLoading" @click="loadAssets"> 刷新 </el-button>
        <el-button
          v-if="activeTab === 'billboards'"
          type="success"
          :icon="Plus"
          @click="handleCreateBillboard"
        >
          创建广告牌
        </el-button>
        <el-button
          v-if="activeTab !== 'billboards'"
          type="primary"
          :icon="Upload"
          @click="openUploadDialog"
        >
          上传资源
        </el-button>
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
      <!-- 模型资源 -->
      <template v-if="activeTab === 'models'">
        <div v-if="isLoading" class="loading-state">
          <el-skeleton :rows="2" animated />
        </div>
        <div v-else-if="filteredAssets.length === 0" class="empty-state">
          <div class="empty-icon">📦</div>
          <p>暂无模型资源，点击上传添加</p>
        </div>
        <div v-else class="asset-grid">
          <div
            v-for="asset in filteredAssets"
            :key="asset.id"
            class="asset-card"
            draggable="true"
            @dragstart="handleAssetDragStart($event, asset)"
          >
            <div class="asset-preview">
              <img v-if="asset.thumbnailUrl" :src="asset.thumbnailUrl" :alt="asset.name" />
              <el-icon v-else :size="40">
                <Box />
              </el-icon>
            </div>
            <div class="asset-info">
              <div class="asset-name">{{ asset.name }}</div>
              <div class="asset-meta">{{ formatFileSize(asset.fileSize) }}</div>
            </div>
            <div class="asset-actions">
              <el-button
                :icon="InfoFilled"
                size="small"
                circle
                @click="handleShowAssetInfo(asset)"
              />
              <el-button :icon="Download" size="small" circle @click="handleDownload(asset)" />
              <el-button
                :icon="Delete"
                size="small"
                circle
                type="danger"
                @click="handleDelete(asset)"
              />
            </div>
          </div>
        </div>
      </template>

      <!-- HDR 环境 -->
      <template v-else-if="activeTab === 'hdr'">
        <div v-if="isLoading" class="loading-state">
          <el-skeleton :rows="2" animated />
        </div>
        <div v-else-if="filteredAssets.length === 0" class="empty-state">
          <div class="empty-icon">🌅</div>
          <p>暂无 HDR 环境，点击上传添加</p>
        </div>
        <div v-else class="asset-grid">
          <div v-for="asset in filteredAssets" :key="asset.id" class="asset-card">
            <div class="asset-preview hdr">
              <img v-if="asset.thumbnailUrl" :src="asset.thumbnailUrl" :alt="asset.name" />
              <el-icon v-else :size="40">
                <Sunny />
              </el-icon>
            </div>
            <div class="asset-info">
              <div class="asset-name">{{ asset.name }}</div>
              <div class="asset-meta">{{ formatFileSize(asset.fileSize) }}</div>
            </div>
            <div class="asset-actions">
              <el-button :icon="Download" size="small" circle @click="handleDownload(asset)" />
              <el-button
                :icon="Delete"
                size="small"
                circle
                type="danger"
                @click="handleDelete(asset)"
              />
            </div>
          </div>
        </div>
      </template>

      <!-- 预定义材质 -->
      <template v-else-if="activeTab === 'materials'">
        <div
          v-for="(materials, category) in groupedMaterials"
          :key="category"
          class="material-group"
        >
          <div class="material-group-header">{{ category }}</div>
          <div class="material-grid">
            <div
              v-for="mat in materials"
              :key="mat.id"
              class="material-card"
              :title="`${mat.name}\n金属度: ${mat.metalness}\n粗糙度: ${mat.roughness}`"
            >
              <div class="material-preview" :style="getMaterialStyle(mat)">
                <div class="material-sphere"></div>
              </div>
              <div class="material-name">{{ mat.name }}</div>
            </div>
          </div>
        </div>
      </template>

      <!-- 纹理贴图 -->
      <template v-else-if="activeTab === 'textures'">
        <div v-if="isLoading" class="loading-state">
          <el-skeleton :rows="2" animated />
        </div>
        <div v-else-if="filteredAssets.length === 0" class="empty-state">
          <div class="empty-icon">🎨</div>
          <p>暂无纹理贴图，点击上传添加</p>
        </div>
        <div v-else class="asset-grid">
          <div v-for="asset in filteredAssets" :key="asset.id" class="asset-card">
            <div class="asset-preview texture">
              <img :src="asset.url" :alt="asset.name" />
            </div>
            <div class="asset-info">
              <div class="asset-name">{{ asset.name }}</div>
              <div class="asset-meta">{{ formatFileSize(asset.fileSize) }}</div>
            </div>
            <div class="asset-actions">
              <el-button :icon="Download" size="small" circle @click="handleDownload(asset)" />
              <el-button
                :icon="Delete"
                size="small"
                circle
                type="danger"
                @click="handleDelete(asset)"
              />
            </div>
          </div>
        </div>
      </template>

      <!-- 广告牌 -->
      <template v-else-if="activeTab === 'billboards'">
        <div v-if="false" class="preset-grid">
          <div v-for="bb in presetBillboards" :key="bb.id" class="preset-card">
            <div class="preset-preview billboard">
              <span>{{ bb.icon }}</span>
            </div>
            <div class="preset-name">{{ bb.name }}</div>
          </div>
        </div>

        <!-- 用户制作的广告牌 -->
        <div v-if="filteredAssets.length > 0" class="section-title">已制作</div>
        <div v-if="filteredAssets.length > 0" class="asset-grid">
          <div
            v-for="asset in filteredAssets"
            :key="asset.id"
            class="asset-card"
            draggable="true"
            @dragstart="handleAssetDragStart($event, asset)"
          >
            <div class="asset-preview texture">
              <img :src="asset.thumbnailUrl || asset.url" :alt="asset.name" />
            </div>
            <div class="asset-info">
              <div class="asset-name">{{ asset.name }}</div>
              <div class="asset-meta">{{ formatFileSize(asset.fileSize) }}</div>
            </div>
            <div class="asset-actions">
              <el-button :icon="Edit" size="small" circle @click="handleEditBillboard(asset)" />
              <el-button
                :icon="InfoFilled"
                size="small"
                circle
                @click="handleShowAssetInfo(asset)"
              />
              <el-button
                :icon="Delete"
                size="small"
                circle
                type="danger"
                @click="handleDelete(asset)"
              />
            </div>
          </div>
        </div>
      </template>

      <!-- 内置标注 -->
      <!-- 内置标注 -->
      <template v-else-if="activeTab === 'place-icons'">
        <div v-if="isLoading" class="loading-state">
          <el-skeleton :rows="2" animated />
        </div>
        <div v-else-if="filteredAssets.length === 0" class="empty-state">
          <div class="empty-icon">📍</div>
          <p>暂无标注，点击上传添加</p>
        </div>
        <div v-else class="annotataion-groups">
          <div v-for="category in PLACE_CATEGORIES" :key="category.id" class="icon-category-group">
            <!-- 仅当该分类有图标时显示 -->
            <template
              v-if="groupedPlaceIcons[category.id] && groupedPlaceIcons[category.id].length > 0"
            >
              <div class="group-sub-title">{{ category.label }}</div>
              <div class="asset-grid small-grid">
                <div
                  v-for="asset in groupedPlaceIcons[category.id]"
                  :key="asset.id"
                  class="asset-card icon-card"
                  draggable="true"
                  @dragstart="handleAssetDragStart($event, asset)"
                >
                  <div class="asset-preview icon-preview">
                    <img
                      v-if="asset.url"
                      :src="asset.url"
                      :alt="asset.name"
                      @error="handleImageError"
                    />
                    <el-icon v-else :size="24">
                      <Picture />
                    </el-icon>
                  </div>
                  <div class="asset-info minimalist">
                    <div class="asset-name center">{{ asset.name }}</div>
                  </div>
                  <div class="asset-actions">
                    <el-button
                      :icon="Delete"
                      size="small"
                      circle
                      type="danger"
                      @click="handleDelete(asset)"
                    />
                  </div>
                </div>
              </div>
            </template>
          </div>

          <!-- 其他分类 -->
          <div
            v-if="groupedPlaceIcons['Other'] && groupedPlaceIcons['Other'].length > 0"
            class="icon-category-group"
          >
            <div class="group-sub-title">其他</div>
            <div class="asset-grid small-grid">
              <div
                v-for="asset in groupedPlaceIcons['Other']"
                :key="asset.id"
                class="asset-card icon-card"
                draggable="true"
                @dragstart="handleAssetDragStart($event, asset)"
              >
                <div class="asset-preview icon-preview">
                  <img
                    v-if="asset.url"
                    :src="asset.url"
                    :alt="asset.name"
                    @error="handleImageError"
                  />
                  <el-icon v-else :size="24">
                    <Picture />
                  </el-icon>
                </div>
                <div class="asset-info minimalist">
                  <div class="asset-name center">{{ asset.name }}</div>
                </div>
                <div class="asset-actions">
                  <el-button
                    :icon="Delete"
                    size="small"
                    circle
                    type="danger"
                    @click="handleDelete(asset)"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </template>
    </div>

    <!-- 上传资源对话框 -->
    <el-dialog
      v-model="showUploadDialog"
      title="上传资源"
      width="520px"
      class="upload-dialog"
      :close-on-click-modal="false"
    >
      <el-form :model="uploadForm" label-width="80px" label-position="left">
        <!-- 类型选择 -->
        <el-form-item label="类型" required>
          <el-select v-model="uploadForm.type" placeholder="请选择类型" style="width: 100%">
            <el-option
              v-for="option in assetTypeOptions"
              :key="option.value"
              :value="option.value"
              :label="option.label"
            >
              <span>{{ option.icon }} {{ option.label }}</span>
            </el-option>
          </el-select>
        </el-form-item>

        <!-- 分类选择 -->
        <el-form-item label="分类">
          <el-select
            v-if="uploadForm.type === 'place_icon'"
            v-model="uploadForm.category"
            placeholder="请选择分类"
            style="width: 100%"
          >
            <el-option
              v-for="cat in PLACE_CATEGORIES"
              :key="cat.id"
              :label="cat.label"
              :value="cat.id"
            />
          </el-select>
          <el-input v-else v-model="uploadForm.category" placeholder="请输入分类（可选）" />
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
        <el-form-item v-if="uploadForm.type === 'model'" label="优化设置">
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
        <el-form-item v-if="!['place_icon', 'texture'].includes(uploadForm.type)" label="缩略图">
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
            </div>
          </div>
        </el-form-item>

        <!-- 文件上传区域 -->
        <el-form-item label="文件" required>
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

        <!-- 大小 -->
        <el-form-item v-if="uploadForm.fileSize > 0" label="大小">
          <span class="file-size-display">{{ formatFileSize(uploadForm.fileSize) }}</span>
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="showUploadDialog = false">取消</el-button>
        <el-button type="primary" :loading="isUploading" @click="handleSubmitUpload">
          上传
        </el-button>
      </template>
    </el-dialog>

    <CreateBillboardDialog
      v-model="showCreateBillboard"
      :edit-asset="editingAsset"
      @success="loadAssets"
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
    </el-dialog>
  </div>
</template>

<style scoped lang="scss">
.resource-center {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.content-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  flex-shrink: 0;

  h2 {
    font-size: 24px;
    font-weight: 600;
    color: #fff;
  }

  .header-actions {
    display: flex;
    gap: 12px;
  }
}

.resource-tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  flex-wrap: wrap;
  flex-shrink: 0;
}

.resource-tab {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.05);
  color: #a6adc8;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: rgba(255, 255, 255, 0.1);
    color: #fff;
  }

  &.active {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: #fff;
  }

  .el-icon {
    font-size: 16px;
  }

  span {
    font-size: 14px;
    font-weight: 500;
  }
}

.resource-content {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding-right: 8px; // 给滚动条留空间
}

.loading-state,
.empty-state {
  padding: 40px 0;
  text-align: center;
}

.empty-state {
  .empty-icon {
    font-size: 48px;
    margin-bottom: 16px;
  }

  p {
    color: #a6adc8;
  }
}

.asset-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 16px;
}

.asset-card {
  background: rgba(30, 30, 50, 0.8);
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.05);
  transition: all 0.2s;

  &:hover {
    border-color: rgba(102, 126, 234, 0.5);
    transform: translateY(-2px);

    .asset-actions {
      opacity: 1;
    }
  }

  .asset-preview {
    width: 100%;
    aspect-ratio: 1;
    background: linear-gradient(135deg, #2a2a4a 0%, #1e1e2e 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    overflow: hidden;

    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .el-icon {
      color: #6c7086;
    }

    &.hdr {
      background: linear-gradient(135deg, #f39c12 0%, #e74c3c 100%);
    }

    &.texture {
      img {
        object-fit: contain;
        background: repeating-conic-gradient(#2a2a4a 0% 25%, #1e1e2e 25% 50%) 50% / 20px 20px;
      }
    }
  }

  .asset-info {
    padding: 12px;

    .asset-name {
      font-size: 14px;
      color: #fff;
      margin-bottom: 4px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .asset-meta {
      font-size: 12px;
      color: #6c7086;
    }
  }

  .asset-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    padding: 0 12px 12px;
    opacity: 0;
    transition: opacity 0.2s;
  }
}

.preset-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 16px;
  margin-bottom: 24px;
}

.preset-card {
  background: rgba(30, 30, 50, 0.8);
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.05);
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    border-color: rgba(102, 126, 234, 0.5);
    transform: translateY(-2px);
  }

  .preset-preview {
    height: 100px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 40px;

    &.billboard {
      background: linear-gradient(135deg, #2ecc71 0%, #27ae60 100%);
    }
  }

  .preset-name {
    padding: 12px;
    text-align: center;
    font-size: 14px;
    color: #fff;
  }
}

.section-title {
  font-size: 14px;
  color: #a6adc8;
  margin: 24px 0 16px;
  padding-bottom: 8px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

// 上传对话框样式
.upload-dialog {
  :deep(.el-dialog) {
    background: #1e1e2e;
    border-radius: 12px;

    .el-dialog__header {
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      padding: 16px 20px;

      .el-dialog__title {
        color: #fff;
        font-size: 16px;
      }
    }

    .el-dialog__body {
      padding: 20px;
    }

    .el-dialog__footer {
      border-top: 1px solid rgba(255, 255, 255, 0.1);
      padding: 12px 20px;
    }
  }
}

.thumbnail-upload {
  width: 100px;
  height: 100px;
  border: 2px dashed rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  transition: all 0.2s;

  &:hover {
    border-color: #667eea;
  }

  .thumbnail-preview {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .thumbnail-placeholder {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    color: #6c7086;

    span {
      font-size: 12px;
    }
  }
}

.file-upload-area {
  width: 100%;
  min-height: 140px;
  border: 2px dashed rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 20px;
  transition: all 0.2s;
  color: #6c7086;

  &:hover,
  &.dragging {
    border-color: #667eea;
    background: rgba(102, 126, 234, 0.1);
  }

  &.has-file {
    border-color: #667eea;
    background: rgba(102, 126, 234, 0.05);
  }

  .upload-text {
    font-size: 14px;
  }

  .upload-hint {
    font-size: 12px;
    color: #a6adc8;
  }

  .file-name {
    font-size: 14px;
    color: #fff;
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .file-size {
    font-size: 12px;
    color: #a6adc8;
  }
}

.file-size-display {
  color: #a6adc8;
  font-size: 14px;
}

// 材质库样式
.material-group {
  margin-bottom: 24px;
}

.material-group-header {
  font-size: 14px;
  font-weight: 600;
  color: #a6adc8;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.material-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
  gap: 12px;
}

.material-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 8px;
  background: rgba(30, 30, 50, 0.8);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  border: 1px solid rgba(255, 255, 255, 0.05);

  &:hover {
    background: rgba(40, 40, 60, 0.9);
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    border-color: rgba(102, 126, 234, 0.5);
  }

  &:active {
    transform: scale(0.95);
  }
}

.material-preview {
  width: 100%;
  aspect-ratio: 1;
  border-radius: 6px;
  margin-bottom: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;

  .material-sphere {
    width: 70%;
    height: 70%;
    border-radius: 50%;
    background: inherit;
    box-shadow:
      inset -6px -6px 12px rgba(0, 0, 0, 0.3),
      inset 3px 3px 6px rgba(255, 255, 255, 0.2),
      2px 2px 6px rgba(0, 0, 0, 0.3);
  }
}

.material-name {
  font-size: 11px;
  color: #fff;
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}

.optimize-option {
  display: flex;
  align-items: center;

  .optimize-help-icon {
    margin-left: 8px;
    color: var(--el-text-color-secondary);
    cursor: help;
    font-size: 16px;

    &:hover {
      color: var(--el-color-primary);
    }
  }
}

// 内置图标样式
.group-sub-title {
  font-size: 13px;
  color: #a6adc8;
  margin: 16px 0 8px;
  padding-left: 4px;
  font-weight: 500;
}

.icon-category-group {
  margin-bottom: 16px;
}

.small-grid {
  grid-template-columns: repeat(auto-fill, minmax(90px, 1fr)) !important;
  gap: 8px !important;
}

.icon-card {
  padding: 8px !important;
  background: rgba(255, 255, 255, 0.03) !important;
  border: 1px solid rgba(255, 255, 255, 0.05) !important;

  &:hover {
    background: rgba(255, 255, 255, 0.08) !important;
    border-color: rgba(255, 255, 255, 0.1) !important;
  }
}

.icon-preview {
  width: 100%;
  aspect-ratio: 1;
  background: rgba(255, 255, 255, 0.9) !important;
  border-radius: 4px;
  padding: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  box-sizing: border-box;

  img {
    width: 100%;
    height: 100%;
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
    display: block;
  }

  .el-icon {
    color: #6c7086;
    flex-shrink: 0;
  }
}

.minimalist {
  padding-top: 6px !important;
  width: 100%;

  .center {
    text-align: center;
    width: 100%;
    font-size: 11px;
    color: #cdd6f4;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}
</style>
