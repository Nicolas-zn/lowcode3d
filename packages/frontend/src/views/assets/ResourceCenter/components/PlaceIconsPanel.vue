<script setup lang="ts">
import { computed } from 'vue'
import { Picture, Delete, Edit } from '@element-plus/icons-vue'
import type { Asset } from '@/api/assets'
import { PLACE_CATEGORIES } from '@/data/placeIcons'
import AddAssetCard from './AddAssetCard.vue'

const props = defineProps<{
  assets: Asset[]
  isLoading: boolean
  canAdd?: boolean
}>()

const emit = defineEmits<{
  (e: 'add'): void
  (e: 'delete', asset: Asset): void
  (e: 'edit', asset: Asset): void
  (e: 'drag-start', event: DragEvent, asset: Asset): void
}>()

// 分组后的标注图标
const groupedPlaceIcons = computed(() => {
  const result: Record<string, Asset[]> = {}

  // 初始化所有分类
  PLACE_CATEGORIES.forEach((cat) => {
    result[cat.id] = []
  })
  result['Other'] = []

  // 填充数据
  props.assets.forEach((asset) => {
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

// 处理图片加载错误
function handleImageError(event: Event) {
  const img = event.target as HTMLImageElement
  console.warn('Failed to load SVG image:', img.src)
}
</script>

<template>
  <div v-if="isLoading" class="loading-state">
    <el-skeleton :rows="2" animated />
  </div>
  <div v-else-if="assets.length === 0 && !canAdd" class="empty-state">
    <div class="empty-icon">📍</div>
    <p>暂无标注图标</p>
  </div>
  <div v-else class="annotataion-groups">
    <div v-if="canAdd" class="icon-category-group">
      <div class="asset-grid small-grid">
        <AddAssetCard title="上传图标" variant="icon" @click="emit('add')" />
      </div>
    </div>

    <div v-for="category in PLACE_CATEGORIES" :key="category.id" class="icon-category-group">
      <!-- 仅当该分类有图标时显示 -->
      <template v-if="groupedPlaceIcons[category.id] && groupedPlaceIcons[category.id].length > 0">
        <div class="group-sub-title">{{ category.label }}</div>
        <div class="asset-grid small-grid">
          <div
            v-for="asset in groupedPlaceIcons[category.id]"
            :key="asset.id"
            class="asset-card icon-card"
            draggable="true"
            @dragstart="emit('drag-start', $event, asset)"
          >
            <div class="asset-preview icon-preview">
              <img v-if="asset.url" :src="asset.url" :alt="asset.name" @error="handleImageError" />
              <el-icon v-else :size="24">
                <Picture />
              </el-icon>
            </div>
            <div class="asset-info minimalist">
              <div class="asset-name center">{{ asset.name }}</div>
            </div>
            <div class="asset-actions icon-actions">
              <el-button :icon="Edit" size="small" circle @click="emit('edit', asset)" />
              <el-button
                :icon="Delete"
                size="small"
                circle
                type="danger"
                @click="emit('delete', asset)"
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
          @dragstart="emit('drag-start', $event, asset)"
        >
          <div class="asset-preview icon-preview">
            <img v-if="asset.url" :src="asset.url" :alt="asset.name" @error="handleImageError" />
            <el-icon v-else :size="24">
              <Picture />
            </el-icon>
          </div>
          <div class="asset-info minimalist">
            <div class="asset-name center">{{ asset.name }}</div>
          </div>
          <div class="asset-actions icon-actions">
            <el-button :icon="Edit" size="small" circle @click="emit('edit', asset)" />
            <el-button
              :icon="Delete"
              size="small"
              circle
              type="danger"
              @click="emit('delete', asset)"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
@import '../styles.scss';

// 特定样式覆盖，使图标卡片更紧凑
.icon-card {
  position: relative;

  .asset-info.minimalist {
    padding: 6px 4px 4px !important;
  }

  .icon-preview {
    padding: 6px;
  }

  // 动作按钮改为绝对定位悬浮，节省垂直空间
  .icon-actions {
    position: absolute;
    top: 4px;
    right: 4px;
    padding: 0;
    gap: 4px;
    display: none; // 默认隐藏

    .el-button {
      width: 24px;
      height: 24px;
      font-size: 12px;

      :deep(.el-icon) {
        font-size: 12px;
      }
    }
  }

  &:hover {
    .icon-actions {
      display: flex; // 悬浮显示
      opacity: 1;
    }
  }
}
</style>
