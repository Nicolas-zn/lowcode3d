<script setup lang="ts">
import { Box, InfoFilled, Download, Delete, Edit } from '@element-plus/icons-vue'
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
  (e: 'download', asset: Asset): void
  (e: 'show-info', asset: Asset): void
  (e: 'preview', asset: Asset): void
  (e: 'edit', asset: Asset): void
  (e: 'drag-start', event: DragEvent, asset: Asset): void
}>()

const formatFileSize = (bytes: number) => {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / 1024 / 1024).toFixed(1) + ' MB'
}
</script>

<template>
  <div v-if="isLoading" class="loading-state">
    <el-skeleton :rows="2" animated />
  </div>
  <div v-else-if="assets.length === 0 && !canAdd" class="empty-state">
    <div class="empty-icon">📦</div>
    <p>暂无模型资源</p>
  </div>
  <div v-else class="asset-grid">
    <AddAssetCard
      v-if="canAdd"
      title="上传模型"
      description="GLB / GLTF / FBX / OBJ"
      @click="emit('add')"
    />
    <div
      v-for="asset in assets"
      :key="asset.id"
      class="asset-card"
      draggable="true"
      @click="emit('preview', asset)"
      @dragstart="emit('drag-start', $event, asset)"
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
        <el-button :icon="InfoFilled" size="small" circle @click.stop="emit('show-info', asset)" />
        <el-button :icon="Edit" size="small" circle @click.stop="emit('edit', asset)" />
        <el-button :icon="Download" size="small" circle @click.stop="emit('download', asset)" />
        <el-button
          :icon="Delete"
          size="small"
          circle
          type="danger"
          @click.stop="emit('delete', asset)"
        />
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
@import '../styles.scss';
</style>
