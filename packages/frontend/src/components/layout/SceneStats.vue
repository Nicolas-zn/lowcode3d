<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { Engine } from '@/engine/core/Engine'
import * as THREE from 'three'
import { useThemeStore } from '@/stores/themeStore'
import { useEditorStore } from '@/stores/editorStore'

const themeStore = useThemeStore()
const editorStore = useEditorStore()
const isDark = computed(() => themeStore.isDark)

// 当前编辑器模式
const currentMode = computed(() => editorStore.editorMode)

// 模式显示文本映射
const modeTextMap: Record<typeof currentMode.value, string> = {
  browse: '浏览模式',
  select: '选择模式',
  move: '移动模式',
  rotate: '旋转模式',
  scale: '缩放模式',
}

const stats = ref({
  fps: 0,
  calls: 0,
  triangles: 0,
  vertices: 0,
  geometries: 0,
  textures: 0,
})

let frameId: number
let intervalId: ReturnType<typeof setInterval>
let lastTime = performance.now()
let frames = 0

// Scene traversal stats (slower update)
const sceneStats = ref({
  triangles: 0,
  vertices: 0,
})

const updateSceneStats = () => {
  const engine = Engine.getInstance()
  if (!engine || !engine.sceneManager) return

  let tris = 0
  let verts = 0

  engine.sceneManager.scene.traverse((obj) => {
    if (obj.visible === false) return

    if (obj instanceof THREE.Mesh) {
      const geom = obj.geometry
      if (geom) {
        if (geom.index) {
          tris += geom.index.count / 3
        } else if (geom.attributes.position) {
          tris += geom.attributes.position.count / 3
        }
        if (geom.attributes.position) {
          verts += geom.attributes.position.count
        }
      }
    } else if (obj instanceof THREE.Points) {
      const geom = obj.geometry
      if (geom && geom.attributes.position) {
        verts += geom.attributes.position.count
      }
    }
  })

  sceneStats.value.triangles = Math.round(tris)
  sceneStats.value.vertices = verts
}

const updateRenderStats = () => {
  const engine = Engine.getInstance()
  if (!engine || !engine.renderManager) {
    frameId = requestAnimationFrame(updateRenderStats)
    return
  }

  const renderer = engine.renderManager.renderer
  const info = renderer.info

  // FPS
  const time = performance.now()
  frames++
  if (time >= lastTime + 1000) {
    stats.value.fps = Math.round((frames * 1000) / (time - lastTime))
    lastTime = time
    frames = 0
  }

  stats.value.calls = info.render.calls || 0
  stats.value.geometries = info.memory.geometries || 0
  stats.value.textures = info.memory.textures || 0

  // Use Scene Stats
  stats.value.triangles = sceneStats.value.triangles
  stats.value.vertices = sceneStats.value.vertices

  frameId = requestAnimationFrame(updateRenderStats)
}

const openPerformancePanel = () => {
  editorStore.setBottomTab('performance', { openPanel: true })
}

onMounted(() => {
  updateRenderStats()
  updateSceneStats()
  intervalId = setInterval(updateSceneStats, 1000)
})

onUnmounted(() => {
  cancelAnimationFrame(frameId)
  clearInterval(intervalId)
})
</script>

<template>
  <div class="scene-stats" :class="{ 'is-dark': isDark }">
    <div class="stat-group mode-indicator">
      <span class="label">模式:</span>
      <span class="value mode-value">{{ modeTextMap[currentMode] }}</span>
    </div>
    <div class="stat-divider"></div>
    <div class="stat-group is-clickable" @click="openPerformancePanel">
      <span class="label">FPS:</span>
      <span class="value">{{ stats.fps }}</span>
    </div>
    <div class="stat-divider"></div>
    <div class="stat-group is-clickable" @click="openPerformancePanel">
      <span class="label">Draw Calls:</span>
      <span class="value">{{ stats.calls }}</span>
    </div>
    <div class="stat-divider"></div>
    <div class="stat-group is-clickable" @click="openPerformancePanel">
      <span class="label">Triangles:</span>
      <span class="value">{{ stats.triangles.toLocaleString() }}</span>
    </div>
    <div class="stat-divider"></div>
    <div class="stat-group is-clickable" @click="openPerformancePanel">
      <span class="label">Vertices:</span>
      <span class="value">{{ stats.vertices.toLocaleString() }}</span>
    </div>
    <div class="stat-divider"></div>
    <div class="stat-group is-clickable" @click="openPerformancePanel">
      <span class="label">Geometries:</span>
      <span class="value">{{ stats.geometries }}</span>
    </div>
    <div class="stat-divider"></div>
    <div class="stat-group is-clickable" @click="openPerformancePanel">
      <span class="label">Textures:</span>
      <span class="value">{{ stats.textures }}</span>
    </div>
  </div>
</template>

<style scoped lang="scss">
.scene-stats {
  width: 100%;
  height: 24px;

  // 浅色主题默认样式
  background-color: var(--lc-bg-panel);
  border-top: 1px solid var(--lc-border-subtle);
  color: var(--lc-text-secondary);

  display: flex;
  align-items: center;
  justify-content: flex-start;
  padding: 0 16px;
  font-size: 11px;
  z-index: 900;
  user-select: none;
  flex-shrink: 0;
  transition:
    background-color 0.3s,
    border-color 0.3s,
    color 0.3s;

  // 深色主题样式 (通过 class 切换，优先级更高且稳定)
  &.is-dark {
    background-color: var(--lc-bg-panel);
    border-top: 1px solid var(--lc-border-subtle);
    color: var(--lc-text-secondary);
  }
}

.stat-group {
  display: flex;
  align-items: center;
  gap: 6px;

  &.is-clickable {
    cursor: pointer;
    border-radius: 3px;
    padding: 0 4px;

    &:hover {
      background-color: var(--lc-selection-bg);
    }
  }

  .label {
    color: var(--lc-text-muted);
  }

  .value {
    color: var(--lc-accent);
    font-family: var(--lc-font-mono);
  }

  // 模式指示器特殊样式
  &.mode-indicator {
    .mode-value {
      font-weight: 600;
      color: #67c23a;
    }
  }
}

//而在深色模式下，需要改变内部子元素的颜色
//使用 .scene-stats.is-dark .stat-group .label 这样的选择器
.scene-stats.is-dark {
  .stat-group {
    .label {
      color: #7f849c;
    }

    .value {
      color: #cba6f7;
    }

    // 深色模式下的模式指示器
    &.mode-indicator {
      .mode-value {
        color: #a6e3a1;
      }
    }
  }

  .stat-divider {
    background-color: rgba(255, 255, 255, 0.1);
  }
}

.stat-divider {
  width: 1px;
  height: 12px;
  background-color: #dcdfe6; // 浅色默认
  margin: 0 12px;
}
</style>
