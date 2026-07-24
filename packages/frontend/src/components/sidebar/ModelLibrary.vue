<script setup lang="ts">
/**
 * 模型库组件
 * 显示可用的 3D 模型列表，支持拖拽到画布
 * 支持上传模型到服务器
 */
import { ref, computed, onMounted } from 'vue'
import { Search, Box, Upload, Loading, Refresh, Star, Clock, View } from '@element-plus/icons-vue'
import { useResourceStore, type IModelLibraryItem } from '@/stores/resourceStore'
import { ElMessage } from 'element-plus'
import { assetsApi } from '@/api'
import type { Asset } from '@/api/assets'
import { EDITOR_MODEL_LIBRARY_CATEGORY } from '@/constants/assetTypes'
import { setTransparentDragImage } from '@/utils/dragImage'

// Props
interface Props {
  /** 是否显示分类过滤器 */
  showCategories?: boolean
  /** 网格列数 */
  columns?: number
}

const props = withDefaults(defineProps<Props>(), {
  showCategories: true,
  columns: 2,
})

// Emits
const emit = defineEmits<{
  /** 选择模型 */
  (e: 'select', item: IModelLibraryItem): void
  /** 开始拖拽 */
  (e: 'dragStart', item: IModelLibraryItem): void
}>()

// Store
const resourceStore = useResourceStore()

// 本地状态
const searchInput = ref('')
const loadingItems = ref<Set<string>>(new Set())
const isUploading = ref(false)
const uploadProgress = ref({ current: 0, total: 0 })
const serverAssets = ref<Asset[]>([])
const isLoadingAssets = ref(false)
const quickFilter = ref<'all' | 'recent' | 'favorites'>('all')
const isDetailOpen = ref(false)
const selectedDetailItem = ref<IModelLibraryItem | null>(null)

function toModelShortcut(item: IModelLibraryItem) {
  return {
    id: item.id,
    type: 'model' as const,
    name: item.name,
    thumbnailUrl: item.thumbnailUrl,
  }
}

function assetToModelItem(asset: Asset): IModelLibraryItem {
  return {
    id: `server-${asset.id}`,
    name: asset.name,
    category: EDITOR_MODEL_LIBRARY_CATEGORY,
    url: asset.url,
    thumbnailUrl: asset.thumbnailUrl || '/assets/thumbnails/custom-model.png',
    tags: ['uploaded', 'server'],
  }
}

function getPrimitiveType(item: IModelLibraryItem): string | null {
  if (!item.url.startsWith('__primitive__:')) return null

  const primitiveType = item.url.replace('__primitive__:', '')
  return primitiveType === 'cube' ? 'box' : primitiveType
}

function isPrimitiveItem(item: IModelLibraryItem): boolean {
  return getPrimitiveType(item) !== null
}

function getPrimitiveIconType(item: IModelLibraryItem): string {
  return getPrimitiveType(item) || 'box'
}

function createModelDragData(item: IModelLibraryItem) {
  const primitiveType = getPrimitiveType(item)

  return {
    type: 'model',
    item,
    ...(primitiveType
      ? {
          componentType: 'primitive',
          component: {
            type: 'primitive',
            props: { primitiveType },
          },
        }
      : {}),
  }
}

// 计算属性 - 本地模型（基础形状等）不包含服务器模型
const filteredLocalItems = computed(() => {
  let items = resourceStore.modelLibrary.filter((item) => !item.id.startsWith('server-'))

  // 分类过滤
  if (
    resourceStore.selectedCategory &&
    resourceStore.selectedCategory !== EDITOR_MODEL_LIBRARY_CATEGORY
  ) {
    items = items.filter((item) => item.category === resourceStore.selectedCategory)
  }

  // 关键词搜索
  if (searchInput.value) {
    const keyword = searchInput.value.toLowerCase()
    items = items.filter(
      (item) =>
        item.name.toLowerCase().includes(keyword) ||
        item.tags?.some((tag) => tag.toLowerCase().includes(keyword))
    )
  }

  if (quickFilter.value === 'favorites') {
    items = items.filter((item) => resourceStore.isFavoriteAsset(item.id))
  }

  if (quickFilter.value === 'recent') {
    const recentIds = new Set(
      resourceStore.recentlyUsed.filter((item) => item.type === 'model').map((item) => item.id)
    )
    items = items.filter((item) => recentIds.has(item.id))
  }

  return items
})

// 服务器模型列表（资源中心的模型）
const filteredServerModels = computed(() => {
  let items = serverAssets.value

  if (
    resourceStore.selectedCategory &&
    resourceStore.selectedCategory !== EDITOR_MODEL_LIBRARY_CATEGORY
  ) {
    return []
  }

  // 关键词搜索
  if (searchInput.value) {
    const keyword = searchInput.value.toLowerCase()
    items = items.filter((item) => item.name.toLowerCase().includes(keyword))
  }

  if (quickFilter.value === 'favorites') {
    items = items.filter((item) => resourceStore.isFavoriteAsset(`server-${item.id}`))
  }

  if (quickFilter.value === 'recent') {
    const recentIds = new Set(
      resourceStore.recentlyUsed.filter((item) => item.type === 'model').map((item) => item.id)
    )
    items = items.filter((item) => recentIds.has(`server-${item.id}`))
  }

  return items
})

// 按分类分组（只包含本地模型）
const groupedItems = computed(() => {
  const groups: Record<string, IModelLibraryItem[]> = {}

  filteredLocalItems.value.forEach((item) => {
    const category = item.category
    if (!groups[category]) {
      groups[category] = []
    }
    groups[category].push(item)
  })

  return groups
})

// 是否显示服务器模型分组
const showServerModels = computed(() => {
  if (
    resourceStore.selectedCategory &&
    resourceStore.selectedCategory !== EDITOR_MODEL_LIBRARY_CATEGORY
  ) {
    return false
  }
  return true
})

// 网格样式
const gridStyle = computed(() => ({
  '--model-library-columns': props.columns,
}))

function createMasonryColumns<T>(items: T[]): T[][] {
  const columnCount = Math.max(1, Math.floor(props.columns))
  const columns = Array.from({ length: columnCount }, () => [] as T[])

  items.forEach((item, index) => {
    columns[index % columnCount].push(item)
  })

  return columns
}

const detailSourceText = computed(() => {
  const item = selectedDetailItem.value
  if (!item) return ''
  if (item.id.startsWith('server-')) return '云端资源'
  if (item.url.startsWith('__primitive__:')) return '内置基础对象'
  return '本地资源'
})

const detailUsageText = computed(() => {
  const item = selectedDetailItem.value
  if (!item) return ''
  if (item.url.startsWith('__primitive__:')) {
    return '适合快速搭建占位结构、空间比例和基础交互原型。'
  }
  if (item.id.startsWith('server-')) {
    return '适合直接拖入 Canvas 或双击添加到场景中心，发布前会进入资源依赖检查。'
  }
  return '适合复用为项目模板资产，可拖拽放置或双击添加。'
})

/**
 * 加载服务器上的模型资源
 */
async function loadServerAssets() {
  isLoadingAssets.value = true
  try {
    const response = await assetsApi.getModels()
    if (response.success && response.data) {
      serverAssets.value = response.data
    }
  } catch (error) {
    console.error('Failed to load server assets:', error)
    ElMessage.error('加载服务器资源失败')
  } finally {
    isLoadingAssets.value = false
  }
}

/**
 * 处理搜索
 */
function handleSearch() {
  resourceStore.setSearchKeyword(searchInput.value)
}

/**
 * 处理分类选择
 */
function handleCategorySelect(category: string | null) {
  resourceStore.setSelectedCategory(category)
}

/**
 * 处理拖拽开始
 */
function handleDragStart(event: DragEvent, item: IModelLibraryItem) {
  if (!event.dataTransfer) return

  // 设置拖拽数据
  event.dataTransfer.effectAllowed = 'copy'
  event.dataTransfer.setData('application/json', JSON.stringify(createModelDragData(item)))
  setTransparentDragImage(event)

  resourceStore.markAssetUsed(toModelShortcut(item))
  emit('dragStart', item)
}

/**
 * 处理项目点击（双击添加到场景中心）
 */
function handleItemClick(item: IModelLibraryItem) {
  resourceStore.markAssetUsed(toModelShortcut(item))
  emit('select', item)
}

function openModelDetail(item: IModelLibraryItem, event?: Event): void {
  event?.stopPropagation()
  selectedDetailItem.value = item
  isDetailOpen.value = true
}

function handleUseDetailModel(): void {
  if (!selectedDetailItem.value) return
  handleItemClick(selectedDetailItem.value)
  isDetailOpen.value = false
}

function handleToggleDetailFavorite(event: Event): void {
  if (!selectedDetailItem.value) return
  handleToggleFavorite(selectedDetailItem.value, event)
}

function handleToggleFavorite(item: IModelLibraryItem, event: Event) {
  event.stopPropagation()
  const active = resourceStore.toggleFavoriteAsset(item.id)
  ElMessage.success(active ? '已收藏资源' : '已取消收藏')
}

/**
 * 处理上传按钮点击
 */
async function handleUpload() {
  // 创建文件选择器
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.gltf,.glb'
  input.multiple = true

  input.onchange = async (e) => {
    const files = (e.target as HTMLInputElement).files
    if (!files || files.length === 0) return

    isUploading.value = true
    uploadProgress.value = { current: 0, total: files.length }

    try {
      const result = await assetsApi.uploadAssets(Array.from(files), {
        category: '已上传',
        onProgress: (current, total) => {
          uploadProgress.value = { current, total }
        },
      })

      // 显示结果
      if (result.uploaded.length > 0) {
        ElMessage.success(`成功上传 ${result.uploaded.length} 个模型`)
        // 刷新服务器资源列表
        await loadServerAssets()
      }
      if (result.failed.length > 0) {
        ElMessage.warning(`${result.failed.length} 个模型上传失败`)
      }
    } catch (error) {
      console.error('Upload error:', error)
      ElMessage.error('上传失败，请重试')
    } finally {
      isUploading.value = false
      uploadProgress.value = { current: 0, total: 0 }
    }
  }

  input.click()
}

/**
 * 刷新服务器资源
 */
async function handleRefresh() {
  await loadServerAssets()
  ElMessage.success('刷新成功')
}

/**
 * 删除服务器上的模型
 */
// async function handleDeleteServerAsset(asset: Asset) {
//   try {
//     await ElMessageBox.confirm('确定要删除这个模型吗？此操作不可恢复。', '删除确认', {
//       confirmButtonText: '删除',
//       cancelButtonText: '取消',
//       type: 'warning',
//     })

//     const response = await assetsApi.deleteAsset(asset.id)

//     if (response.success) {
//       // 从服务器资源列表移除
//       serverAssets.value = serverAssets.value.filter((a: Asset) => a.id !== asset.id)
//       ElMessage.success('删除成功')
//     } else {
//       ElMessage.error(response.error || '删除失败')
//     }
//   } catch (error) {
//     // 用户取消操作
//     if (error !== 'cancel') {
//       console.error('Delete error:', error)
//       ElMessage.error('删除失败')
//     }
//   }
// }

/**
 * 处理服务器模型拖拽开始
 */
function handleServerModelDragStart(event: DragEvent, asset: Asset) {
  if (!event.dataTransfer) return

  // 转换为模型库项格式
  const item = assetToModelItem(asset)

  // 设置拖拽数据
  event.dataTransfer.effectAllowed = 'copy'
  event.dataTransfer.setData('application/json', JSON.stringify(createModelDragData(item)))
  setTransparentDragImage(event)

  resourceStore.markAssetUsed(toModelShortcut(item))
  emit('dragStart', item)
}

/**
 * 处理服务器模型点击（双击添加到场景）
 */
function handleServerModelClick(asset: Asset) {
  // 转换为模型库项格式
  const item = assetToModelItem(asset)

  resourceStore.markAssetUsed(toModelShortcut(item))
  emit('select', item)
}

/**
 * 检查是否正在加载
 */
function isItemLoading(id: string): boolean {
  return loadingItems.value.has(id)
}

// 组件挂载时加载服务器资源
onMounted(() => {
  resourceStore.loadAssetPreferences()
  loadServerAssets()
})
</script>

<template>
  <div class="model-library">
    <!-- 搜索栏 -->
    <div class="library-header">
      <el-input
        v-model="searchInput"
        placeholder="搜索模型..."
        :prefix-icon="Search"
        size="small"
        clearable
        @input="handleSearch"
        @clear="handleSearch"
      />
      <el-tooltip content="刷新" placement="top">
        <el-button :icon="Refresh" size="small" :loading="isLoadingAssets" @click="handleRefresh" />
      </el-tooltip>
      <el-tooltip content="上传到服务器" placement="top">
        <el-button
          :icon="Upload"
          size="small"
          type="primary"
          :loading="isUploading"
          @click="handleUpload"
        />
      </el-tooltip>
    </div>

    <!-- 上传进度 -->
    <div v-if="isUploading" class="upload-progress">
      <el-progress
        :percentage="Math.round((uploadProgress.current / uploadProgress.total) * 100)"
        :format="() => `${uploadProgress.current}/${uploadProgress.total}`"
        size="small"
      />
    </div>

    <div class="quick-filters">
      <el-button
        size="small"
        :type="quickFilter === 'all' ? 'primary' : 'default'"
        @click="quickFilter = 'all'"
      >
        全部
      </el-button>
      <el-button
        size="small"
        :icon="Clock"
        :type="quickFilter === 'recent' ? 'primary' : 'default'"
        @click="quickFilter = 'recent'"
      >
        最近
      </el-button>
      <el-button
        size="small"
        :icon="Star"
        :type="quickFilter === 'favorites' ? 'primary' : 'default'"
        @click="quickFilter = 'favorites'"
      >
        收藏
      </el-button>
    </div>

    <!-- 分类标签 -->
    <div v-if="showCategories && resourceStore.categories.length > 1" class="category-tabs">
      <el-tag
        :type="resourceStore.selectedCategory === null ? 'primary' : 'info'"
        effect="plain"
        class="category-tag"
        @click="handleCategorySelect(null)"
      >
        全部
      </el-tag>
      <el-tag
        v-for="category in resourceStore.categories"
        :key="category"
        :type="resourceStore.selectedCategory === category ? 'primary' : 'info'"
        effect="plain"
        class="category-tag"
        @click="handleCategorySelect(category)"
      >
        {{ category }}
      </el-tag>
    </div>

    <!-- 模型网格 -->
    <div class="library-content">
      <!-- 本地模型分组（基础形状等） -->
      <template v-if="Object.keys(groupedItems).length > 0">
        <div v-for="(items, category) in groupedItems" :key="category" class="category-group">
          <div class="category-header">{{ category }}</div>
          <div v-if="items.every(isPrimitiveItem)" class="primitive-grid">
            <div
              v-for="item in items"
              :key="item.id"
              class="model-item primitive-item"
              draggable="true"
              :title="item.description || item.name"
              @dragstart="handleDragStart($event, item)"
              @dblclick="handleItemClick(item)"
            >
              <div class="primitive-preview">
                <span
                  class="primitive-shape-icon"
                  :class="`primitive-shape-icon--${getPrimitiveIconType(item)}`"
                />
              </div>
              <span class="model-name primitive-name">{{ item.name }}</span>
            </div>
          </div>
          <div
            v-if="items.some((item) => !isPrimitiveItem(item))"
            class="model-grid"
            :style="gridStyle"
          >
            <div
              v-for="(column, columnIndex) in createMasonryColumns(
                items.filter((item) => !isPrimitiveItem(item))
              )"
              :key="`${category}-${columnIndex}`"
              class="model-column"
            >
              <div
                v-for="item in column"
                :key="item.id"
                class="model-item"
                draggable="true"
                :title="item.description || item.name"
                @dragstart="handleDragStart($event, item)"
                @dblclick="handleItemClick(item)"
              >
                <button
                  class="favorite-action"
                  :class="{ 'is-active': resourceStore.isFavoriteAsset(item.id) }"
                  title="收藏"
                  @click="handleToggleFavorite(item, $event)"
                >
                  <el-icon>
                    <Star />
                  </el-icon>
                </button>
                <button
                  class="detail-action"
                  title="查看详情"
                  @click="openModelDetail(item, $event)"
                >
                  <el-icon>
                    <View />
                  </el-icon>
                </button>
                <div class="model-preview">
                  <!-- 显示图标 -->
                  <el-icon :size="36" class="model-icon">
                    <Loading v-if="isItemLoading(item.id)" class="is-loading" />
                    <Box v-else />
                  </el-icon>
                </div>
                <span class="model-name">{{ item.name }}</span>
              </div>
            </div>
          </div>
        </div>
      </template>

      <!-- 服务器模型分组 -->
      <div v-if="showServerModels" class="category-group">
        <div class="category-header">
          {{ EDITOR_MODEL_LIBRARY_CATEGORY }} <br />（双击直接添加，拖动仍生效）
        </div>
        <div v-if="isLoadingAssets" class="loading-hint">
          <el-icon class="is-loading">
            <Loading />
          </el-icon>
          <span>加载中...</span>
        </div>
        <div v-else-if="filteredServerModels.length === 0" class="empty-hint">
          <span>暂无模型，请在资源中心上传</span>
        </div>
        <div v-else class="model-grid" :style="gridStyle">
          <div
            v-for="(column, columnIndex) in createMasonryColumns(filteredServerModels)"
            :key="`server-${columnIndex}`"
            class="model-column"
          >
            <div
              v-for="asset in column"
              :key="asset.id"
              class="model-item server-model"
              draggable="true"
              :title="asset.name"
              @dragstart="handleServerModelDragStart($event, asset)"
              @dblclick="handleServerModelClick(asset)"
            >
              <button
                class="favorite-action"
                :class="{ 'is-active': resourceStore.isFavoriteAsset(`server-${asset.id}`) }"
                title="收藏"
                @click="handleToggleFavorite(assetToModelItem(asset), $event)"
              >
                <el-icon>
                  <Star />
                </el-icon>
              </button>
              <button
                class="detail-action"
                title="查看详情"
                @click="openModelDetail(assetToModelItem(asset), $event)"
              >
                <el-icon>
                  <View />
                </el-icon>
              </button>
              <div class="model-preview">
                <!-- 如果有缩略图则显示 -->
                <img
                  v-if="asset.thumbnailUrl"
                  :src="asset.thumbnailUrl"
                  :alt="asset.name"
                  class="model-thumbnail"
                />
                <!-- 否则显示图标 -->
                <el-icon v-else :size="36" class="model-icon">
                  <Box />
                </el-icon>
              </div>
              <span class="model-name">{{ asset.name }}</span>
              <span class="model-badge">云端</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 空状态 -->
      <div
        v-if="
          Object.keys(groupedItems).length === 0 &&
          filteredServerModels.length === 0 &&
          !isLoadingAssets
        "
        class="empty-state"
      >
        <el-icon :size="48">
          <Box />
        </el-icon>
        <p>没有找到匹配的模型</p>
        <el-button type="primary" size="small" :icon="Upload" @click="handleUpload">
          上传模型
        </el-button>
      </div>
    </div>

    <!-- 加载状态 -->
    <div v-if="resourceStore.isLoading || isLoadingAssets" class="loading-overlay">
      <el-icon :size="24" class="is-loading">
        <Loading />
      </el-icon>
      <span>加载中...</span>
    </div>

    <el-drawer
      v-model="isDetailOpen"
      title="模型详情"
      direction="rtl"
      size="340px"
      append-to-body
      class="asset-detail-drawer"
    >
      <div v-if="selectedDetailItem" class="asset-detail">
        <div class="detail-preview">
          <img
            v-if="selectedDetailItem.thumbnailUrl && selectedDetailItem.id.startsWith('server-')"
            :src="selectedDetailItem.thumbnailUrl"
            :alt="selectedDetailItem.name"
          />
          <el-icon v-else>
            <Box />
          </el-icon>
        </div>

        <div class="detail-title">
          <h3>{{ selectedDetailItem.name }}</h3>
          <el-tag size="small" effect="plain">{{ selectedDetailItem.category }}</el-tag>
        </div>

        <dl class="detail-meta">
          <div>
            <dt>来源</dt>
            <dd>{{ detailSourceText }}</dd>
          </div>
          <div>
            <dt>资源 ID</dt>
            <dd>{{ selectedDetailItem.id }}</dd>
          </div>
          <div>
            <dt>加载状态</dt>
            <dd>
              {{ resourceStore.isModelCached(selectedDetailItem.url) ? '已缓存' : '按需加载' }}
            </dd>
          </div>
        </dl>

        <div class="detail-section">
          <span class="detail-section__title">标签</span>
          <div class="detail-tags">
            <el-tag
              v-for="tag in selectedDetailItem.tags || []"
              :key="tag"
              size="small"
              effect="plain"
            >
              {{ tag }}
            </el-tag>
            <span v-if="!selectedDetailItem.tags?.length" class="detail-muted">暂无标签</span>
          </div>
        </div>

        <div class="detail-section">
          <span class="detail-section__title">使用建议</span>
          <p>{{ detailUsageText }}</p>
        </div>

        <div class="detail-actions">
          <el-button :icon="Star" @click="handleToggleDetailFavorite">
            {{ resourceStore.isFavoriteAsset(selectedDetailItem.id) ? '取消收藏' : '收藏' }}
          </el-button>
          <el-button type="primary" :icon="Upload" @click="handleUseDetailModel">
            添加到场景
          </el-button>
        </div>
      </div>
    </el-drawer>
  </div>
</template>

<style scoped lang="scss">
.model-library {
  display: flex;
  flex-direction: column;
  height: 100%;
  position: relative;
}

.library-header {
  display: flex;
  gap: 8px;
  padding-bottom: 12px;

  .el-input {
    flex: 1;
  }
}

.upload-progress {
  padding-bottom: 12px;
}

.quick-filters {
  display: flex;
  gap: 6px;
  padding-bottom: 12px;

  .el-button {
    flex: 1;
  }
}

.category-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--el-border-color-lighter);
  margin-bottom: 12px;
}

.category-tag {
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    opacity: 0.8;
  }
}

.library-content {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
}

.category-group {
  margin-bottom: 16px;
}

.category-header {
  font-size: 11px;
  color: var(--el-text-color-regular);
  margin-bottom: 8px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  padding-bottom: 6px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.model-grid {
  display: grid;
  grid-template-columns: repeat(var(--model-library-columns), minmax(0, 1fr));
  gap: 8px;
}

.model-column {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.primitive-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

.model-item {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 8px 6px 7px;
  background-color: var(--el-fill-color-light);
  border-radius: 8px;
  cursor: grab;
  transition: all 0.2s ease;
  user-select: none;
  position: relative;

  &:hover {
    background-color: var(--el-fill-color);
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);

    .model-actions {
      opacity: 1;
    }
  }

  &:active {
    cursor: grabbing;
    transform: scale(0.95);
  }
}

.primitive-item {
  padding: 8px;
  cursor: grab;
}

.primitive-preview {
  width: 100%;
  aspect-ratio: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 6px;
  border-radius: 6px;
  background:
    radial-gradient(circle at 30% 22%, rgba(255, 255, 255, 0.16), transparent 28%),
    var(--el-fill-color-darker);
  overflow: hidden;
}

.primitive-shape-icon {
  --shape-color: var(--lc-accent);
  --shape-shadow: rgba(0, 0, 0, 0.28);
  position: relative;
  width: 52%;
  height: 52%;
  display: block;
  color: var(--shape-color);
}

.primitive-shape-icon--box {
  width: 46%;
  height: 46%;
  border: 2px solid currentColor;
  border-radius: 4px;
  background: rgba(79, 140, 255, 0.12);
  box-shadow:
    8px -8px 0 rgba(79, 140, 255, 0.18),
    8px -8px 0 2px currentColor;
}

.primitive-shape-icon--sphere {
  border-radius: 50%;
  background:
    radial-gradient(circle at 30% 25%, rgba(255, 255, 255, 0.7), transparent 18%),
    radial-gradient(circle at 62% 68%, rgba(0, 0, 0, 0.2), transparent 45%), currentColor;
  box-shadow: 0 8px 14px var(--shape-shadow);
}

.primitive-shape-icon--cylinder {
  width: 44%;
  height: 58%;
  border: 2px solid currentColor;
  border-radius: 50% / 12%;
  background: linear-gradient(90deg, rgba(79, 140, 255, 0.1), rgba(79, 140, 255, 0.34));
}

.primitive-shape-icon--cylinder::before,
.primitive-shape-icon--cylinder::after {
  content: '';
  position: absolute;
  left: -2px;
  right: -2px;
  height: 28%;
  border: 2px solid currentColor;
  border-radius: 50%;
  background: rgba(79, 140, 255, 0.2);
}

.primitive-shape-icon--cylinder::before {
  top: -2px;
}

.primitive-shape-icon--cylinder::after {
  bottom: -2px;
  border-top-color: rgba(79, 140, 255, 0.45);
}

.primitive-shape-icon--cone {
  width: 0;
  height: 0;
  border-right: 20px solid transparent;
  border-bottom: 44px solid currentColor;
  border-left: 20px solid transparent;
  filter: drop-shadow(0 8px 10px var(--shape-shadow));
}

.primitive-shape-icon--torus,
.primitive-shape-icon--ring {
  border: 9px solid currentColor;
  border-radius: 50%;
  box-shadow:
    inset 0 4px 10px rgba(0, 0, 0, 0.3),
    0 8px 14px var(--shape-shadow);
}

.primitive-shape-icon--plane {
  width: 58%;
  height: 38%;
  border: 2px solid currentColor;
  border-radius: 4px;
  background:
    linear-gradient(135deg, transparent 48%, rgba(79, 140, 255, 0.45) 50%, transparent 52%),
    rgba(79, 140, 255, 0.14);
  transform: perspective(80px) rotateX(58deg);
}

.primitive-shape-icon--circle {
  border: 2px solid currentColor;
  border-radius: 50%;
  background: rgba(79, 140, 255, 0.22);
}

.primitive-shape-icon--tetrahedron,
.primitive-shape-icon--octahedron,
.primitive-shape-icon--icosahedron,
.primitive-shape-icon--dodecahedron {
  width: 0;
  height: 0;
  filter: drop-shadow(0 8px 10px var(--shape-shadow));
}

.primitive-shape-icon--tetrahedron {
  border-right: 22px solid transparent;
  border-bottom: 42px solid currentColor;
  border-left: 22px solid transparent;
}

.primitive-shape-icon--octahedron {
  width: 44px;
  height: 44px;
  border: 2px solid currentColor;
  background:
    linear-gradient(135deg, transparent 49%, rgba(255, 255, 255, 0.28) 50%, transparent 51%),
    rgba(79, 140, 255, 0.2);
  clip-path: polygon(50% 0, 100% 50%, 50% 100%, 0 50%);
}

.primitive-shape-icon--icosahedron {
  width: 46px;
  height: 46px;
  background: currentColor;
  clip-path: polygon(50% 0, 94% 25%, 85% 78%, 50% 100%, 15% 78%, 6% 25%);
}

.primitive-shape-icon--dodecahedron {
  width: 46px;
  height: 46px;
  background: currentColor;
  clip-path: polygon(50% 0, 90% 20%, 100% 62%, 72% 100%, 28% 100%, 0 62%, 10% 20%);
}

.primitive-name {
  min-height: auto;
  display: block;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.favorite-action {
  position: absolute;
  top: 5px;
  right: 5px;
  z-index: 2;
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--lc-text-muted);
  background: rgba(15, 17, 21, 0.64);
  border: 1px solid var(--lc-border-subtle);
  border-radius: var(--lc-radius-sm);
  opacity: 0;
  cursor: pointer;
  transition:
    opacity 0.15s ease,
    color 0.15s ease,
    background-color 0.15s ease;

  &.is-active {
    opacity: 1;
    color: var(--lc-warning);
  }

  &:hover {
    opacity: 1;
    color: var(--lc-warning);
    background: var(--lc-bg-control-hover);
  }
}

.model-item:hover .favorite-action {
  opacity: 1;
}

.detail-action {
  position: absolute;
  top: 5px;
  left: 5px;
  z-index: 2;
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--lc-text-muted);
  background: rgba(15, 17, 21, 0.64);
  border: 1px solid var(--lc-border-subtle);
  border-radius: var(--lc-radius-sm);
  opacity: 0;
  cursor: pointer;
  transition:
    opacity 0.15s ease,
    color 0.15s ease,
    background-color 0.15s ease;

  &:hover {
    opacity: 1;
    color: var(--lc-accent);
    background: var(--lc-bg-control-hover);
  }
}

.model-item:hover .detail-action {
  opacity: 1;
}

.asset-detail {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.detail-preview {
  height: 180px;
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

  .el-icon {
    font-size: 56px;
  }
}

.detail-title {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;

  h3 {
    margin: 0;
    color: var(--lc-text-primary);
    font-size: 16px;
    line-height: 1.35;
  }
}

.detail-meta {
  display: grid;
  gap: 8px;
  margin: 0;

  div {
    display: grid;
    grid-template-columns: 72px minmax(0, 1fr);
    gap: 10px;
    padding: 8px 0;
    border-bottom: 1px solid var(--lc-border-subtle);
  }

  dt {
    color: var(--lc-text-muted);
    font-size: 12px;
  }

  dd {
    min-width: 0;
    margin: 0;
    overflow: hidden;
    color: var(--lc-text-secondary);
    font-size: 12px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.detail-section {
  display: grid;
  gap: 8px;

  &__title {
    color: var(--lc-text-muted);
    font-size: 12px;
    font-weight: 600;
  }

  p {
    margin: 0;
    color: var(--lc-text-secondary);
    font-size: 13px;
    line-height: 1.65;
  }
}

.detail-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.detail-muted {
  color: var(--lc-text-muted);
  font-size: 12px;
}

.detail-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-top: 4px;
}

.model-preview {
  width: 100%;
  aspect-ratio: 4 / 3;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 6px;
  border-radius: 6px;
  background-color: var(--el-fill-color-darker);
  overflow: hidden;
  position: relative;
}

.model-thumbnail {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.model-icon {
  color: var(--el-text-color-secondary);
  font-size: 28px;
}

.model-actions {
  position: absolute;
  top: 4px;
  right: 4px;
  opacity: 0;
  transition: opacity 0.2s;

  .el-button {
    width: 24px;
    height: 24px;
    min-height: 24px;
    padding: 0;
  }
}

.model-name {
  display: -webkit-box;
  min-height: 30px;
  font-size: 11px;
  line-height: 15px;
  color: var(--el-text-color-primary);
  text-align: center;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  max-width: 100%;
}

.model-badge {
  position: absolute;
  top: 5px;
  left: 31px;
  font-size: 10px;
  line-height: 16px;
  padding: 0 5px;
  background-color: var(--el-color-primary);
  color: #fff;
  border-radius: 4px;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  color: var(--el-text-color-placeholder);

  p {
    margin-top: 12px;
    margin-bottom: 16px;
    font-size: 14px;
  }
}

.loading-hint,
.empty-hint {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 20px 12px;
  color: var(--el-text-color-placeholder);
  font-size: 12px;
}

.loading-hint {
  .el-icon {
    font-size: 16px;
  }
}

.loading-overlay {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px;
  background-color: var(--el-fill-color-light);
  border-top: 1px solid var(--el-border-color-lighter);
  font-size: 14px;
  color: var(--el-text-color-regular);
}

.is-loading {
  animation: rotate 1s linear infinite;
}

@keyframes rotate {
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(360deg);
  }
}
</style>
