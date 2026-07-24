<script setup lang="ts">
import { Sunny, Download, Delete, Edit } from '@element-plus/icons-vue'
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
  (e: 'edit', asset: Asset): void
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
    <div class="empty-icon">🌅</div>
    <p>暂无 HDR 环境</p>
  </div>
  <div v-else class="asset-grid">
    <AddAssetCard v-if="canAdd" title="上传 HDR" description="HDR / EXR" @click="emit('add')" />
    <div v-for="asset in assets" :key="asset.id" class="asset-card">
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
        <el-button :icon="Edit" size="small" circle @click="emit('edit', asset)" />
        <el-button :icon="Download" size="small" circle @click="emit('download', asset)" />
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

<style scoped lang="scss">
@import '../styles.scss';
</style>
