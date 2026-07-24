<script setup lang="ts">
/**
 * 组件库面板
 * 展示注册组件和用户创建的广告牌资源
 */
import { computed, ref, onMounted } from 'vue'
import { Picture, Refresh, Search } from '@element-plus/icons-vue'
import * as assetsApi from '@/api/assets'
import type { Asset } from '@/api/assets'
import EmptyState from '@/components/common/EmptyState.vue'
import { setTransparentDragImage } from '@/utils/dragImage'
// import { editorComponentRegistry } from '@/engine/components'

const billboards = ref<Asset[]>([])
const isLoading = ref(false)
const searchInput = ref('')

// const registeredComponents = computed(() =>
//   editorComponentRegistry
//     .list()
//     .filter((component) => ['basic', 'light', 'media', 'annotation'].includes(component.category))
// )

const filteredBillboards = computed(() => {
  const keyword = searchInput.value.trim().toLowerCase()
  if (!keyword) return billboards.value

  return billboards.value.filter(
    (asset) =>
      asset.name.toLowerCase().includes(keyword) ||
      asset.category?.toLowerCase().includes(keyword) ||
      asset.tags?.some((tag) => tag.toLowerCase().includes(keyword))
  )
})

// const filteredComponents = computed(() => {
//   const keyword = searchInput.value.trim().toLowerCase()
//   if (!keyword) return registeredComponents.value

//   return registeredComponents.value.filter(
//     (component) =>
//       component.title.toLowerCase().includes(keyword) ||
//       component.category.toLowerCase().includes(keyword) ||
//       component.type.toLowerCase().includes(keyword)
//   )
// })

const totalCount = computed(() => filteredBillboards.value.length)

// 加载广告牌资源
async function loadBillboards() {
  isLoading.value = true
  try {
    const res = await assetsApi.getAssets()
    if (res.success && res.data) {
      billboards.value = res.data.filter(
        (a) =>
          a.type === 'billboard' ||
          a.category === 'billboard' ||
          (a.tags && a.tags.includes('billboard'))
      )
    }
  } catch (e) {
    console.error('Failed to load billboards:', e)
  } finally {
    isLoading.value = false
  }
}

// 处理拖拽开始
const handleDragStart = (event: DragEvent, asset: Asset) => {
  if (event.dataTransfer) {
    const data = {
      type: 'custom_billboard',
      componentType: 'billboard',
      component: {
        type: 'billboard',
        props: {
          assetUrl: asset.url,
          width: 2,
          height: 1,
          alwaysFaceCamera: true,
        },
      },
      asset: asset,
    }
    event.dataTransfer.setData('application/json', JSON.stringify(data))
    event.dataTransfer.effectAllowed = 'copy'
    setTransparentDragImage(event)
  }
}

// const handleComponentDragStart = (event: DragEvent, component: EditorComponentDefinition) => {
//   if (!event.dataTransfer) return

//   event.dataTransfer.setData(
//     'application/json',
//     JSON.stringify({
//       ...component.dragPayload,
//       componentType: component.type,
//       component: {
//         type: component.type,
//         props: component.defaultProps,
//       },
//     })
//   )
//   event.dataTransfer.effectAllowed = 'copy'
// }

onMounted(() => {
  loadBillboards()
})
</script>

<template>
  <div class="component-library">
    <div class="library-header">
      <div>
        <span>组件</span>
        <small>{{ totalCount }} 个可用组件</small>
      </div>
      <el-tooltip content="刷新组件库" placement="top">
        <el-button
          :icon="Refresh"
          circle
          size="small"
          :loading="isLoading"
          @click="loadBillboards"
        />
      </el-tooltip>
    </div>

    <el-input
      v-model="searchInput"
      :prefix-icon="Search"
      size="small"
      clearable
      class="component-search"
      placeholder="搜索组件..."
    />

    <!-- 列表 -->
    <div v-loading="isLoading" class="component-grid">
      <EmptyState
        v-if="totalCount === 0 && !isLoading"
        compact
        :icon="Picture"
        title="没有可用组件"
        description="请在资源中心创建广告牌资源，或更换关键词后重试。"
      />

      <!-- <div
        v-for="component in filteredComponents"
        :key="component.type"
        class="component-item"
        draggable="true"
        @dragstart="handleComponentDragStart($event, component)"
      >
        <div class="component-preview">
          <el-icon :size="24">
            <Location v-if="component.type === 'poi'" />
            <Picture v-else-if="component.type === 'billboard'" />
            <Box v-else />
          </el-icon>
        </div>
        <div class="component-info">
          <span class="component-name" :title="component.title">{{ component.title }}</span>
        </div>
      </div> -->

      <div
        v-for="asset in filteredBillboards"
        :key="asset.id"
        class="component-item"
        draggable="true"
        @dragstart="handleDragStart($event, asset)"
      >
        <div class="component-preview">
          <!-- 优先显示缩略图，否则显示资源URL（如果是图片），否则显示图标 -->
          <img
            v-if="asset.thumbnailUrl || asset.url"
            :src="asset.thumbnailUrl || asset.url"
            :alt="asset.name"
            class="preview-image"
          />
          <el-icon v-else :size="24">
            <Picture />
          </el-icon>
        </div>
        <div class="component-info">
          <span class="component-name" :title="asset.name">{{ asset.name }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.component-library {
  height: 100%;
  padding: 12px;
  display: flex;
  flex-direction: column;
}

.library-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  font-size: 14px;
  color: var(--lc-text-primary);
  font-weight: 500;

  div {
    display: grid;
    gap: 2px;
  }

  small {
    color: var(--lc-text-muted);
    font-size: 11px;
    font-weight: 400;
  }
}

.component-search {
  margin-bottom: 12px;
}

.component-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  margin: -4px;
  padding: 4px;
  overflow-y: auto;

  :deep(.empty-state) {
    grid-column: 1 / -1;
  }
}

.component-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 8px;
  background-color: var(--lc-bg-control);
  border: 1px solid var(--lc-border-subtle);
  border-radius: var(--lc-radius-md);
  cursor: grab;
  transition: all 0.2s ease;
  user-select: none;

  &:hover {
    background-color: var(--lc-bg-control-hover);
    border-color: var(--lc-border-focus);
    transform: translateY(-2px);
    box-shadow: var(--lc-shadow-floating);
  }

  &:active {
    cursor: grabbing;
    transform: translateY(0);
  }

  .component-preview {
    width: 100%;
    aspect-ratio: 1;
    margin-bottom: 8px;
    background: var(--lc-bg-canvas);
    border: 1px solid var(--lc-border-subtle);
    border-radius: var(--lc-radius-sm);
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;

    .preview-image {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
  }

  .component-info {
    width: 100%;
    text-align: center;
  }

  .component-name {
    font-size: 12px;
    color: var(--lc-text-primary);
    display: block;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
}
</style>
