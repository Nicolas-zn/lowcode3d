<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import { LowCode3DViewer } from '@lowcode3d/runtime'

const props = defineProps<{
  config: any
  models: Array<{ name: string; url: string }>
}>()

const container = ref<HTMLDivElement>()
let viewer: LowCode3DViewer | null = null
const isLoading = ref(false)
const loadingMessage = ref('等待加载')
const loadingProgress = ref(0)
const loadingError = ref('')
const loadWarnings = ref<string[]>([])

async function loadProject(config: any) {
  if (!viewer || !config) return

  isLoading.value = true
  loadingError.value = ''
  loadingMessage.value = '准备加载项目'
  loadingProgress.value = 0

  try {
    await viewer.loadProject(config)
  } catch (error) {
    loadingError.value = error instanceof Error ? error.message : '项目加载失败'
  } finally {
    isLoading.value = false
  }
}

onMounted(async () => {
  if (!container.value) return
  viewer = new LowCode3DViewer(container.value, {
    onProgress: (event) => {
      loadingMessage.value = event.message
      loadingProgress.value = event.progress
    },
    onWarning: (message) => {
      loadWarnings.value = [message, ...loadWarnings.value].slice(0, 4)
    },
    onError: (error) => {
      loadingError.value = error instanceof Error ? error.message : '项目加载失败'
    },
  })
  console.log(viewer)

  await viewer.init()

  if (props.config) {
    await loadProject(props.config)
  }
})

// 监听配置变化自动重载
watch(
  () => props.config,
  async (newVal) => {
    if (viewer && newVal) {
      await loadProject(newVal)
    }
  }
)

onBeforeUnmount(() => {
  viewer?.dispose()
})
</script>

<template>
  <div class="viewer-shell">
    <div ref="container" class="viewer-canvas"></div>
    <div v-if="isLoading" class="loading-overlay">
      <div class="loading-title">{{ loadingMessage }}</div>
      <div class="loading-bar">
        <span :style="{ width: `${loadingProgress}%` }"></span>
      </div>
      <div class="loading-percent">{{ Math.round(loadingProgress) }}%</div>
    </div>
    <div v-else-if="loadingError" class="error-overlay">
      <div class="error-title">加载失败</div>
      <div class="error-message">{{ loadingError }}</div>
    </div>
    <div v-if="loadWarnings.length" class="warning-stack">
      <div v-for="warning in loadWarnings" :key="warning" class="warning-row">{{ warning }}</div>
    </div>
  </div>
</template>

<style scoped>
.viewer-shell,
.viewer-canvas {
  width: 100%;
  height: 100%;
}

.viewer-shell {
  position: relative;
  overflow: hidden;
}

.loading-overlay,
.error-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  background: rgba(10, 16, 28, 0.72);
  color: #f8fafc;
}

.loading-title,
.error-title {
  font-size: 14px;
  font-weight: 600;
}

.loading-bar {
  width: min(280px, 60%);
  height: 6px;
  border-radius: 3px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.16);
}

.loading-bar span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: #38bdf8;
  transition: width 0.2s ease;
}

.loading-percent,
.error-message {
  max-width: 360px;
  color: #cbd5e1;
  font-size: 12px;
  text-align: center;
}

.warning-stack {
  position: absolute;
  left: 12px;
  bottom: 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-width: min(420px, calc(100% - 24px));
}

.warning-row {
  padding: 6px 8px;
  border-radius: 4px;
  color: #fde68a;
  background: rgba(120, 53, 15, 0.76);
  font-size: 12px;
}
</style>
