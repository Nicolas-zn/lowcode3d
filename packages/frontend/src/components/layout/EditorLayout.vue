<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { ArrowLeft, ArrowRight, ArrowUp } from '@element-plus/icons-vue'
import Toolbar from './Toolbar.vue'
import FloatingToolbar from './FloatingToolbar.vue'
import LeftSidebar from './LeftSidebar.vue'
import RightSidebar from './RightSidebar.vue'
import CanvasPanel from '../canvas/CanvasPanel.vue'
import BottomPanel from './BottomPanel.vue'
import SceneStats from './SceneStats.vue'
import CommandPalette from './CommandPalette.vue'
import OnboardingGuide from './OnboardingGuide.vue'
import { useEditorStore } from '@/stores/editorStore'
import { getEngine } from '@/engine'

const editorStore = useEditorStore()
const activeResizePanel = ref<'leftSidebar' | 'rightSidebar' | 'bottomPanel' | null>(null)

let resizeStartX = 0
let resizeStartY = 0
let resizeStartSize = 0
let resizeFrame: number | null = null
let resizeTimer: ReturnType<typeof setTimeout> | null = null

function resizeViewport(): void {
  const engine = getEngine()
  if (!engine?.isInitialized) return
  engine.resize()
}

function scheduleViewportResize(options: { afterTransition?: boolean } = {}): void {
  void nextTick(() => {
    if (resizeFrame !== null) {
      cancelAnimationFrame(resizeFrame)
    }

    resizeFrame = requestAnimationFrame(() => {
      resizeFrame = null
      resizeViewport()
    })

    if (options.afterTransition) {
      if (resizeTimer) {
        clearTimeout(resizeTimer)
      }
      resizeTimer = setTimeout(() => {
        resizeTimer = null
        resizeViewport()
      }, 240)
    }
  })
}

function handlePanelTransitionDone(): void {
  scheduleViewportResize()
}

// 切换面板显示
const toggleLeftSidebar = () => {
  editorStore.togglePanel('leftSidebar')
  scheduleViewportResize({ afterTransition: true })
}

const toggleRightSidebar = () => {
  editorStore.togglePanel('rightSidebar')
  scheduleViewportResize({ afterTransition: true })
}

const toggleBottomPanel = () => {
  editorStore.togglePanel('bottomPanel')
  scheduleViewportResize({ afterTransition: true })
}

function startResize(
  panel: 'leftSidebar' | 'rightSidebar' | 'bottomPanel',
  event: MouseEvent
): void {
  event.preventDefault()
  activeResizePanel.value = panel
  resizeStartX = event.clientX
  resizeStartY = event.clientY
  resizeStartSize = editorStore.panelSizes[panel]
  document.body.classList.add(
    panel === 'bottomPanel' ? 'is-resizing-editor-panel-row' : 'is-resizing-editor-panel-col'
  )
  window.addEventListener('mousemove', handleResizeMove)
  window.addEventListener('mouseup', stopResize)
}

function handleResizeMove(event: MouseEvent): void {
  const panel = activeResizePanel.value
  if (!panel) return

  if (panel === 'leftSidebar') {
    editorStore.setPanelSize(panel, resizeStartSize + event.clientX - resizeStartX)
    scheduleViewportResize()
    return
  }

  if (panel === 'rightSidebar') {
    editorStore.setPanelSize(panel, resizeStartSize - (event.clientX - resizeStartX))
    scheduleViewportResize()
    return
  }

  editorStore.setPanelSize(panel, resizeStartSize - (event.clientY - resizeStartY))
  scheduleViewportResize()
}

function stopResize(): void {
  if (!activeResizePanel.value) return

  activeResizePanel.value = null
  document.body.classList.remove('is-resizing-editor-panel-col')
  document.body.classList.remove('is-resizing-editor-panel-row')
  window.removeEventListener('mousemove', handleResizeMove)
  window.removeEventListener('mouseup', stopResize)
  editorStore.commitPanelSizes()
  scheduleViewportResize()
}

onMounted(() => {
  editorStore.loadLayoutPreferences()
  scheduleViewportResize({ afterTransition: true })
})

onBeforeUnmount(() => {
  stopResize()
  if (resizeFrame !== null) {
    cancelAnimationFrame(resizeFrame)
  }
  if (resizeTimer) {
    clearTimeout(resizeTimer)
  }
})
</script>

<template>
  <div class="editor-layout">
    <!-- 顶部工具栏 -->
    <Toolbar
      class="editor-toolbar"
      @toggle-left="toggleLeftSidebar"
      @toggle-right="toggleRightSidebar"
      @toggle-bottom="toggleBottomPanel"
    />

    <!-- 主内容区 -->
    <div class="editor-main">
      <!-- 左侧资源栏 -->
      <Transition
        name="slide-left"
        @after-enter="handlePanelTransitionDone"
        @after-leave="handlePanelTransitionDone"
      >
        <LeftSidebar
          v-show="editorStore.panels.leftSidebar"
          class="editor-left-sidebar"
          :style="{ width: `${editorStore.panelSizes.leftSidebar}px` }"
        />
      </Transition>
      <div
        v-if="editorStore.panels.leftSidebar"
        class="panel-resizer resizer-left"
        title="调整左侧面板宽度"
        @mousedown="startResize('leftSidebar', $event)"
      ></div>

      <!-- 中间画布区 -->
      <div class="editor-canvas-wrapper">
        <CanvasPanel class="editor-canvas" />

        <!-- 浮动工具栏 -->
        <FloatingToolbar />

        <el-tooltip v-if="!editorStore.panels.leftSidebar" content="显示左侧面板" placement="right">
          <button class="panel-restore restore-left" @click="toggleLeftSidebar">
            <el-icon>
              <ArrowRight />
            </el-icon>
          </button>
        </el-tooltip>

        <el-tooltip v-if="!editorStore.panels.rightSidebar" content="显示右侧属性" placement="left">
          <button class="panel-restore restore-right" @click="toggleRightSidebar">
            <el-icon>
              <ArrowLeft />
            </el-icon>
          </button>
        </el-tooltip>

        <el-tooltip v-if="!editorStore.panels.bottomPanel" content="显示底部面板" placement="top">
          <button class="panel-restore restore-bottom" @click="toggleBottomPanel">
            <el-icon>
              <ArrowUp />
            </el-icon>
          </button>
        </el-tooltip>

        <!-- 底部时间线面板 -->
        <Transition
          name="slide-up"
          @after-enter="handlePanelTransitionDone"
          @after-leave="handlePanelTransitionDone"
        >
          <div
            v-show="editorStore.panels.bottomPanel"
            class="bottom-panel-shell"
            :style="{ height: `${editorStore.panelSizes.bottomPanel}px` }"
          >
            <div
              class="panel-resizer resizer-bottom"
              title="调整底部面板高度"
              @mousedown="startResize('bottomPanel', $event)"
            ></div>
            <BottomPanel class="editor-bottom-panel" />
          </div>
        </Transition>

        <SceneStats />
      </div>

      <!-- 右侧属性栏 -->
      <div
        v-if="editorStore.panels.rightSidebar"
        class="panel-resizer resizer-right"
        title="调整右侧面板宽度"
        @mousedown="startResize('rightSidebar', $event)"
      ></div>
      <Transition
        name="slide-right"
        @after-enter="handlePanelTransitionDone"
        @after-leave="handlePanelTransitionDone"
      >
        <RightSidebar
          v-show="editorStore.panels.rightSidebar"
          class="editor-right-sidebar"
          :style="{ width: `${editorStore.panelSizes.rightSidebar}px` }"
        />
      </Transition>
    </div>

    <CommandPalette />
    <OnboardingGuide />
  </div>
</template>

<style scoped lang="scss">
.editor-layout {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.editor-toolbar {
  flex-shrink: 0;
  height: $--header-height;
  z-index: $--zindex-toolbar;
}

.editor-main {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.editor-left-sidebar {
  flex-shrink: 0;
  z-index: $--zindex-sidebar;
}

.editor-canvas-wrapper {
  flex: 1;
  display: flex;
  flex-direction: column;
  position: relative;
  overflow: hidden;
}

.editor-canvas {
  flex: 1;
}

.bottom-panel-shell {
  position: relative;
  flex-shrink: 0;
}

.editor-bottom-panel {
  width: 100%;
  height: 100%;
}

.editor-right-sidebar {
  flex-shrink: 0;
  z-index: $--zindex-sidebar;
}

.panel-resizer {
  flex-shrink: 0;
  background: transparent;
  z-index: 950;
  transition: background-color 0.15s ease;

  &:hover {
    background: var(--lc-selection-bg);
  }
}

.resizer-left,
.resizer-right {
  width: 5px;
  cursor: col-resize;
}

.resizer-bottom {
  position: absolute;
  top: -3px;
  left: 0;
  right: 0;
  height: 6px;
  cursor: row-resize;
}

.panel-restore {
  position: absolute;
  z-index: 980;
  width: 28px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--lc-text-secondary);
  background: var(--lc-bg-panel-raised);
  border: 1px solid var(--lc-border-subtle);
  box-shadow: var(--lc-shadow-floating);
  cursor: pointer;
  transition:
    color 0.15s ease,
    background-color 0.15s ease,
    border-color 0.15s ease;

  &:hover {
    color: var(--lc-text-primary);
    background: var(--lc-bg-control-hover);
    border-color: var(--lc-border-strong);
  }
}

.restore-left {
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  border-left: none;
  border-radius: 0 var(--lc-radius-md) var(--lc-radius-md) 0;
}

.restore-right {
  right: 0;
  top: 50%;
  transform: translateY(-50%);
  border-right: none;
  border-radius: var(--lc-radius-md) 0 0 var(--lc-radius-md);
}

.restore-bottom {
  left: 50%;
  bottom: 28px;
  width: 40px;
  height: 28px;
  transform: translateX(-50%);
  border-bottom: none;
  border-radius: var(--lc-radius-md) var(--lc-radius-md) 0 0;
}

// 过渡动画
.slide-left-enter-active,
.slide-left-leave-active {
  transition:
    transform 0.2s ease,
    opacity 0.2s ease;
}

.slide-left-enter-from,
.slide-left-leave-to {
  transform: translateX(-100%);
  opacity: 0;
}

.slide-right-enter-active,
.slide-right-leave-active {
  transition:
    transform 0.2s ease,
    opacity 0.2s ease;
}

.slide-right-enter-from,
.slide-right-leave-to {
  transform: translateX(100%);
  opacity: 0;
}

.slide-up-enter-active,
.slide-up-leave-active {
  transition:
    transform 0.2s ease,
    opacity 0.2s ease;
}

.slide-up-enter-from,
.slide-up-leave-to {
  transform: translateY(100%);
  opacity: 0;
}
</style>
