<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import { LowCode3DViewer } from '@lowcode3d/runtime'
import type { ViewerOptions } from '@lowcode3d/runtime'

const props = defineProps<{
  config: any
  models?: Array<{ name: string; url: string }>
  options?: ViewerOptions
}>()

const container = ref<HTMLDivElement | null>(null)
let viewer: LowCode3DViewer | null = null

onMounted(async () => {
  if (!container.value) return
  viewer = new LowCode3DViewer(container.value)
  await viewer.init(props.options)

  if (props.config) {
    await viewer.loadScene(props.config, props.models)
  }
})

// 监听配置变化自动重载
watch(
  () => props.config,
  async (newVal) => {
    if (viewer && newVal) {
      await viewer.loadScene(newVal, props.models)
    }
  },
  { deep: true }
)

onBeforeUnmount(() => {
  viewer?.dispose()
})
</script>

<template>
  <div ref="container" style="width: 100%; height: 100%; overflow: hidden"></div>
</template>
