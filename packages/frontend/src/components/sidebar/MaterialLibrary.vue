<script setup lang="ts">
/**
 * 材质库组件
 * 显示预设材质列表，支持拖拽应用到对象
 */
import { ref, computed } from 'vue'
import { Search, Plus, Star, Clock, View } from '@element-plus/icons-vue'
import * as THREE from 'three'
import { getCommandBus, getEngine, eventBus } from '@/engine'
import { getMaterialManager } from '@/engine/materials'
import { useSelectionStore } from '@/stores/selectionStore'
import { useResourceStore } from '@/stores/resourceStore'
import { ElMessage } from 'element-plus'
import EmptyState from '@/components/common/EmptyState.vue'
import { setTransparentDragImage } from '@/utils/dragImage'
import {
  presetMaterials as sharedPresetMaterials,
  getMaterialCategories,
  type IPresetMaterial,
} from '@/data/presetMaterials'

// Store
const selectionStore = useSelectionStore()
const resourceStore = useResourceStore()
const materialManager = getMaterialManager()
const commandBus = getCommandBus()

// 搜索关键词
const searchInput = ref('')

// 选中的分类
const selectedCategory = ref<string | null>(null)
const quickFilter = ref<'all' | 'recent' | 'favorites'>('all')
const isDetailOpen = ref(false)
const selectedDetailMaterial = ref<IPresetMaterial | null>(null)

// 使用共享的预设材质
const presetMaterials = ref<IPresetMaterial[]>(sharedPresetMaterials)

// 获取所有分类
const categories = computed(() => getMaterialCategories())

// 过滤后的材质列表
const filteredMaterials = computed(() => {
  let materials = presetMaterials.value

  // 分类过滤
  if (selectedCategory.value) {
    materials = materials.filter((mat) => mat.category === selectedCategory.value)
  }

  // 关键词搜索
  if (searchInput.value) {
    const keyword = searchInput.value.toLowerCase()
    materials = materials.filter((mat) => mat.name.toLowerCase().includes(keyword))
  }

  if (quickFilter.value === 'favorites') {
    materials = materials.filter((mat) => resourceStore.isFavoriteAsset(`material-${mat.id}`))
  }

  if (quickFilter.value === 'recent') {
    const recentIds = new Set(
      resourceStore.recentlyUsed.filter((item) => item.type === 'material').map((item) => item.id)
    )
    materials = materials.filter((mat) => recentIds.has(`material-${mat.id}`))
  }

  return materials
})

// 按分类分组
const groupedMaterials = computed(() => {
  const groups: Record<string, IPresetMaterial[]> = {}

  filteredMaterials.value.forEach((mat) => {
    if (!groups[mat.category]) {
      groups[mat.category] = []
    }
    groups[mat.category].push(mat)
  })

  return groups
})

const detailMaterialType = computed(() => {
  const material = selectedDetailMaterial.value
  if (!material) return ''
  if (material.emissive && material.emissive !== '#000000') return '发光材质'
  if ((material.opacity ?? 1) < 1) return '透明材质'
  if (material.metalness > 0.5) return '金属材质'
  return '标准材质'
})

const detailUsageText = computed(() => {
  const material = selectedDetailMaterial.value
  if (!material) return ''
  if (material.emissive && material.emissive !== '#000000') {
    return '适合告警灯、状态点、发光管线和数据可视化高亮对象。'
  }
  if ((material.opacity ?? 1) < 1) {
    return '适合玻璃、罩壳、透明边界和需要保留内部结构可见性的对象。'
  }
  if (material.metalness > 0.5) {
    return '适合设备外壳、金属零件、工业构件和产品展示材质。'
  }
  return '适合基础模型配色、占位对象和低代码场景快速搭建。'
})

/**
 * 处理分类选择
 */
function handleCategorySelect(category: string | null): void {
  selectedCategory.value = category
}

/**
 * 应用材质到选中对象
 * 直接应用材质属性，同时发送事件让 MaterialPanel UI 同步
 */
function applyMaterial(preset: IPresetMaterial): void {
  resourceStore.markAssetUsed({
    id: `material-${preset.id}`,
    type: 'material',
    name: preset.name,
  })

  const primaryId = selectionStore.primarySelectedId
  if (!primaryId) {
    ElMessage.warning('请先选择一个对象')
    return
  }

  const engine = getEngine()
  if (!engine || !engine.isInitialized || !engine.objectManager || !engine.sceneManager) {
    return
  }

  // 优先从 objectManager 获取对象，如果获取不到（如 GLB 子对象），则从场景中直接查找
  let object = engine.objectManager.getObject(primaryId)
  if (!object) {
    // GLB 模型的子对象没有注册到 ObjectManager，需要从场景中查找
    object = engine.sceneManager.getObjectByUUID(primaryId)
  }

  if (!object) {
    ElMessage.warning('未找到选中对象')
    return
  }

  // 确保是 Mesh 对象
  if (!(object instanceof THREE.Mesh)) {
    ElMessage.warning('选中对象不是 Mesh')
    return
  }

  // 获取主材质
  const sourceMaterial = materialManager.getPrimaryMaterial(object)
  if (!sourceMaterial || !(sourceMaterial instanceof THREE.MeshStandardMaterial)) {
    ElMessage.warning('选中对象没有可编辑的材质')
    return
  }

  // 克隆材质，避免修改共享材质影响其他 mesh
  const clonedMaterial = sourceMaterial.clone() as THREE.MeshStandardMaterial
  object.material = clonedMaterial
  const material = clonedMaterial

  object.userData.materialPresetId = preset.id
  object.userData.materialPresetName = preset.name
  material.userData.materialPresetId = preset.id
  material.userData.materialPresetName = preset.name

  // 直接应用材质属性
  const presetData = {
    color: preset.color,
    metalness: preset.metalness,
    roughness: preset.roughness,
    emissive: preset.emissive || '#000000',
    emissiveIntensity: preset.emissive ? 1 : 0,
    opacity: preset.opacity ?? 1,
    transparent: (preset.opacity ?? 1) < 1,
  }

  commandBus.changeMaterial(object, material, presetData)

  eventBus.emit('material:apply-preset', {
    presetId: preset.id,
    targetId: primaryId,
    preset: presetData,
  })

  ElMessage.success(`已应用材质: ${preset.name}`)
}

function handleToggleFavorite(preset: IPresetMaterial, event: Event): void {
  event.stopPropagation()
  const active = resourceStore.toggleFavoriteAsset(`material-${preset.id}`)
  ElMessage.success(active ? '已收藏材质' : '已取消收藏')
}

function openMaterialDetail(preset: IPresetMaterial, event?: Event): void {
  event?.stopPropagation()
  selectedDetailMaterial.value = preset
  isDetailOpen.value = true
}

function handleApplyDetailMaterial(): void {
  if (!selectedDetailMaterial.value) return
  applyMaterial(selectedDetailMaterial.value)
  isDetailOpen.value = false
}

function handleToggleDetailFavorite(event: Event): void {
  if (!selectedDetailMaterial.value) return
  handleToggleFavorite(selectedDetailMaterial.value, event)
}

/**
 * 处理拖拽开始
 */
function handleDragStart(event: DragEvent, preset: IPresetMaterial): void {
  if (!event.dataTransfer) return

  event.dataTransfer.effectAllowed = 'copy'
  event.dataTransfer.setData(
    'application/json',
    JSON.stringify({
      type: 'material',
      preset,
    })
  )
  setTransparentDragImage(event)
}

/**
 * 获取材质预览样式
 */
function getPreviewStyle(preset: IPresetMaterial): Record<string, string> {
  const style: Record<string, string> = {
    backgroundColor: preset.color,
  }

  // 金属材质添加光泽效果
  if (preset.metalness > 0.5) {
    style.background = `linear-gradient(135deg, ${preset.color} 0%, ${lightenColor(preset.color, 40)} 50%, ${preset.color} 100%)`
  }

  // 发光材质添加发光效果
  if (preset.emissive && preset.emissive !== '#000000') {
    style.boxShadow = `0 0 12px ${preset.emissive}, inset 0 0 8px ${preset.emissive}`
  }

  // 透明材质
  if (preset.opacity && preset.opacity < 1) {
    style.opacity = String(0.5 + preset.opacity * 0.5)
  }

  return style
}

/**
 * 颜色变亮
 */
function lightenColor(color: string, percent: number): string {
  const num = parseInt(color.replace('#', ''), 16)
  const amt = Math.round(2.55 * percent)
  const R = Math.min(255, (num >> 16) + amt)
  const G = Math.min(255, ((num >> 8) & 0x00ff) + amt)
  const B = Math.min(255, (num & 0x0000ff) + amt)
  return `#${((1 << 24) + (R << 16) + (G << 8) + B).toString(16).slice(1)}`
}
</script>

<template>
  <div class="material-library">
    <!-- 搜索栏 -->
    <div class="library-header">
      <el-input
        v-model="searchInput"
        placeholder="搜索材质..."
        :prefix-icon="Search"
        size="small"
        clearable
      />
      <el-button :icon="Plus" size="small" title="新建材质" disabled />
    </div>

    <!-- 分类标签 -->
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
    <div class="category-tabs">
      <el-tag
        :type="selectedCategory === null ? 'primary' : 'info'"
        effect="plain"
        class="category-tag"
        @click="handleCategorySelect(null)"
      >
        全部
      </el-tag>
      <el-tag
        v-for="category in categories"
        :key="category"
        :type="selectedCategory === category ? 'primary' : 'info'"
        effect="plain"
        class="category-tag"
        @click="handleCategorySelect(category)"
      >
        {{ category }}
      </el-tag>
    </div>

    <!-- 材质网格 -->
    <div class="library-content">
      <template v-if="filteredMaterials.length > 0">
        <div
          v-for="(materials, category) in groupedMaterials"
          :key="category"
          class="category-group"
        >
          <div class="category-header">{{ category }}</div>
          <div class="material-grid">
            <div
              v-for="preset in materials"
              :key="preset.id"
              class="material-item"
              draggable="true"
              :title="`${preset.name}\n金属度: ${preset.metalness}\n粗糙度: ${preset.roughness}`"
              @click="applyMaterial(preset)"
              @dragstart="handleDragStart($event, preset)"
            >
              <button
                class="favorite-action"
                :class="{ 'is-active': resourceStore.isFavoriteAsset(`material-${preset.id}`) }"
                title="收藏"
                @click="handleToggleFavorite(preset, $event)"
              >
                <el-icon>
                  <Star />
                </el-icon>
              </button>
              <button
                class="detail-action"
                title="查看详情"
                @click="openMaterialDetail(preset, $event)"
              >
                <el-icon>
                  <View />
                </el-icon>
              </button>
              <div class="material-preview" :style="getPreviewStyle(preset)">
                <div class="material-sphere"></div>
              </div>
              <span class="material-name">{{ preset.name }}</span>
            </div>
          </div>
        </div>
      </template>

      <!-- 空状态 -->
      <EmptyState
        v-else
        compact
        :icon="Search"
        title="没有找到匹配的材质"
        description="尝试更换关键词、清除筛选，或切回全部材质。"
      />
    </div>

    <!-- 提示信息 -->
    <div class="library-footer">
      <span>点击应用材质到选中对象</span>
    </div>

    <el-drawer
      v-model="isDetailOpen"
      title="材质详情"
      direction="rtl"
      size="340px"
      append-to-body
      class="asset-detail-drawer"
    >
      <div v-if="selectedDetailMaterial" class="asset-detail">
        <div
          class="detail-preview material-detail-preview"
          :style="getPreviewStyle(selectedDetailMaterial)"
        >
          <div class="material-sphere"></div>
        </div>

        <div class="detail-title">
          <h3>{{ selectedDetailMaterial.name }}</h3>
          <el-tag size="small" effect="plain">{{ detailMaterialType }}</el-tag>
        </div>

        <dl class="detail-meta">
          <div>
            <dt>分类</dt>
            <dd>{{ selectedDetailMaterial.category }}</dd>
          </div>
          <div>
            <dt>颜色</dt>
            <dd>{{ selectedDetailMaterial.color }}</dd>
          </div>
          <div>
            <dt>金属度</dt>
            <dd>{{ selectedDetailMaterial.metalness }}</dd>
          </div>
          <div>
            <dt>粗糙度</dt>
            <dd>{{ selectedDetailMaterial.roughness }}</dd>
          </div>
          <div>
            <dt>透明度</dt>
            <dd>{{ selectedDetailMaterial.opacity ?? 1 }}</dd>
          </div>
        </dl>

        <div class="detail-section">
          <span class="detail-section__title">使用建议</span>
          <p>{{ detailUsageText }}</p>
        </div>

        <div class="detail-actions">
          <el-button :icon="Star" @click="handleToggleDetailFavorite">
            {{
              resourceStore.isFavoriteAsset(`material-${selectedDetailMaterial.id}`)
                ? '取消收藏'
                : '收藏'
            }}
          </el-button>
          <el-button type="primary" :icon="Plus" @click="handleApplyDetailMaterial">
            应用材质
          </el-button>
        </div>
      </div>
    </el-drawer>
  </div>
</template>

<style scoped lang="scss">
.material-library {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.library-header {
  display: flex;
  gap: 8px;
  padding-bottom: 12px;

  .el-input {
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

.quick-filters {
  display: flex;
  gap: 6px;
  padding-bottom: 12px;

  .el-button {
    flex: 1;
  }
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
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-bottom: 8px;
  font-weight: 500;
}

.material-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

.material-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 8px;
  background-color: var(--el-fill-color-light);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  user-select: none;
  position: relative;

  &:hover {
    background-color: var(--el-fill-color);
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }

  &:active {
    transform: scale(0.95);
  }
}

.favorite-action {
  position: absolute;
  top: 6px;
  right: 6px;
  z-index: 2;
  width: 24px;
  height: 24px;
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

.material-item:hover .favorite-action {
  opacity: 1;
}

.detail-action {
  position: absolute;
  top: 6px;
  left: 6px;
  z-index: 2;
  width: 24px;
  height: 24px;
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

.material-item:hover .detail-action {
  opacity: 1;
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
      inset -8px -8px 16px rgba(0, 0, 0, 0.3),
      inset 4px 4px 8px rgba(255, 255, 255, 0.2),
      2px 2px 8px rgba(0, 0, 0, 0.3);
  }
}

.material-name {
  font-size: 11px;
  color: var(--el-text-color-primary);
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}

.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  color: var(--el-text-color-placeholder);
  font-size: 14px;
}

.library-footer {
  padding: 8px 0;
  border-top: 1px solid var(--el-border-color-lighter);
  text-align: center;
  font-size: 11px;
  color: var(--el-text-color-secondary);
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
  border: 1px solid var(--lc-border-subtle);
  border-radius: var(--lc-radius-md);
}

.material-detail-preview {
  .material-sphere {
    width: 108px;
    height: 108px;
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
    margin: 0;
    color: var(--lc-text-secondary);
    font-size: 12px;
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

.detail-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-top: 4px;
}
</style>
