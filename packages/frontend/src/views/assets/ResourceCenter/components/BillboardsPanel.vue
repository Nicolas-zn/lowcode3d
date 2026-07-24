<script setup lang="ts">
import { ref } from 'vue'
import { Edit, InfoFilled, Delete } from '@element-plus/icons-vue'
import type { Asset } from '@/api/assets'
import AddAssetCard from './AddAssetCard.vue'

withDefaults(
  defineProps<{
    assets: Asset[]
    isLoading: boolean
    canAdd?: boolean
  }>(),
  {
    canAdd: false,
  }
)

const emit = defineEmits<{
  (e: 'add'): void
  (e: 'delete', asset: Asset): void
  (e: 'edit', asset: Asset): void
  (e: 'show-info', asset: Asset): void
  (e: 'drag-start', event: DragEvent, asset: Asset): void
}>()

const formatFileSize = (bytes: number) => {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / 1024 / 1024).toFixed(1) + ' MB'
}

// 预定义广告牌 (目前隐藏)
const presetBillboards = ref([
  { id: 'bb-tree', name: '树木', icon: '🌲' },
  { id: 'bb-person', name: '人物', icon: '🧑' },
  { id: 'bb-grass', name: '草地', icon: '🌿' },
  { id: 'bb-flower', name: '花朵', icon: '🌸' },
  { id: 'bb-cloud', name: '云朵', icon: '☁️' },
  { id: 'bb-star', name: '星星', icon: '⭐' },
])
</script>

<template>
  <div v-if="false" class="preset-grid">
    <div v-for="bb in presetBillboards" :key="bb.id" class="preset-card">
      <div class="preset-preview billboard">
        <span>{{ bb.icon }}</span>
      </div>
      <div class="preset-name">{{ bb.name }}</div>
    </div>
  </div>

  <!-- 用户制作的广告牌 -->
  <div v-if="canAdd || assets.length > 0" class="section-title">已制作</div>
  <div v-if="canAdd || assets.length > 0" class="asset-grid">
    <AddAssetCard
      v-if="canAdd"
      title="创建广告牌"
      description="图片 / 视频贴片"
      @click="emit('add')"
    />
    <div
      v-for="asset in assets"
      :key="asset.id"
      class="asset-card"
      draggable="true"
      @dragstart="emit('drag-start', $event, asset)"
    >
      <div class="asset-preview texture">
        <img :src="asset.thumbnailUrl || asset.url" :alt="asset.name" />
      </div>
      <div class="asset-info">
        <div class="asset-name">{{ asset.name }}</div>
        <div class="asset-meta">{{ formatFileSize(asset.fileSize) }}</div>
      </div>
      <div class="asset-actions">
        <el-button :icon="Edit" size="small" circle @click="emit('edit', asset)" />
        <el-button :icon="InfoFilled" size="small" circle @click="emit('show-info', asset)" />
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
  <div v-else-if="assets.length === 0 && isLoading === false" class="empty-state">
    <p>暂无广告牌</p>
  </div>
</template>

<style scoped lang="scss">
@import '../styles.scss';
</style>
