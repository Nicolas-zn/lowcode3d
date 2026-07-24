<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import {
  Box,
  Files,
  Grid,
  MagicStick,
  Monitor,
  Operation,
  Picture,
  Search,
  Setting,
  Sunny,
  VideoPlay,
} from '@element-plus/icons-vue'
import type { Component } from 'vue'
import type * as THREE from 'three'
import {
  eventBus,
  getEditorModeController,
  getEngine,
  getHelperManager,
  getSnappingManager,
} from '@/engine'
import { ElMessage } from 'element-plus'
import {
  useEditorStore,
  type BottomDockTab,
  type EditorMode,
  type WorkspacePreset,
} from '@/stores/editorStore'
import type { LeftSidebarTab } from '@/engine/events/EventTypes'

type PaletteItemType = 'command' | 'object'

interface PaletteItem {
  id: string
  type: PaletteItemType
  title: string
  subtitle: string
  icon: Component
  keywords: string[]
  action: () => void
}

const editorStore = useEditorStore()
const modeController = getEditorModeController()
const isOpen = ref(false)
const query = ref('')
const activeIndex = ref(0)
const inputRef = ref<HTMLInputElement | null>(null)
const sceneObjects = ref<THREE.Object3D[]>([])

const modeText: Record<EditorMode, string> = {
  browse: '浏览模式',
  select: '选择模式',
  move: '移动',
  rotate: '旋转',
  scale: '缩放',
}

const bottomTabText: Record<BottomDockTab, string> = {
  console: 'Console',
  timeline: 'Timeline',
  problems: 'Problems',
  performance: 'Performance',
  dataSources: 'Data',
  publish: 'Publish Check',
}

const workspaceText: Record<WorkspacePreset, string> = {
  default: '默认工作区',
  asset: '资源搭建工作区',
  animation: '动画工作区',
  data: '数据绑定工作区',
  publish: '发布检查工作区',
}

const workspaceSubtitle: Record<WorkspacePreset, string> = {
  default: '均衡显示资源、视口与 Inspector',
  asset: '放大资源库，适合快速搭建场景',
  animation: '打开 Timeline，适合编辑动画',
  data: '打开数据源与属性区，适合配置数据',
  publish: '聚焦 Publish Check，适合发布前检查',
}

const leftTabText: Record<LeftSidebarTab, string> = {
  scene: '场景树',
  models: '模型库',
  materials: '材质库',
  components: '组件库',
  annotations: '标注库',
  lights: '灯光库',
}

function openPalette(): void {
  refreshSceneObjects()
  isOpen.value = true
  query.value = ''
  activeIndex.value = 0
  nextTick(() => inputRef.value?.focus())
}

function closePalette(): void {
  isOpen.value = false
}

function togglePalette(): void {
  if (isOpen.value) {
    closePalette()
  } else {
    openPalette()
  }
}

function refreshSceneObjects(): void {
  const engine = getEngine()
  if (!engine?.isInitialized) {
    sceneObjects.value = []
    return
  }

  sceneObjects.value = engine.objectManager
    .getAll()
    .map((entry) => entry.object)
    .filter((object) => object.userData.selectable !== false)
}

function setMode(mode: EditorMode): void {
  modeController.setMode(mode)
}

function openBottomTab(tab: BottomDockTab): void {
  editorStore.setBottomTab(tab, { openPanel: true })
}

function openLeftTab(tab: LeftSidebarTab): void {
  editorStore.setPanelVisible('leftSidebar', true)
  eventBus.emit('editor:open-left-tab', { tab })
}

function selectObject(object: THREE.Object3D): void {
  const engine = getEngine()
  if (!engine?.isInitialized) return

  engine.selectionManager.select(object)
  engine.cameraManager.focusOnObject(object)
}

function focusSelectedObject(): void {
  const engine = getEngine()
  const selected = engine?.selectionManager.getPrimarySelected()
  if (!engine || !selected) {
    ElMessage.warning('请先选中一个对象')
    return
  }
  engine.cameraManager.focusOnObject(selected)
}

function resetCameraView(): void {
  const engine = getEngine()
  if (!engine?.isInitialized) return
  engine.cameraManager.resetView()
}

function toggleGrid(): void {
  const visible = getHelperManager().toggleGrid()
  ElMessage.info(visible ? '网格已显示' : '网格已隐藏')
}

function toggleSnap(): void {
  getSnappingManager().toggle()
}

const commandItems = computed<PaletteItem[]>(() => [
  {
    id: 'save-project',
    type: 'command',
    title: '保存项目',
    subtitle: '保存当前编辑进度',
    icon: Files,
    keywords: ['save', '保存', '项目', 'cmd+s'],
    action: () => eventBus.emit('editor:save-project'),
  },
  {
    id: 'open-onboarding',
    type: 'command',
    title: '打开新手引导',
    subtitle: '重新查看 3 步编辑器入门流程',
    icon: MagicStick,
    keywords: ['guide', 'help', 'onboarding', '引导', '帮助', '新手'],
    action: () => eventBus.emit('editor:open-onboarding'),
  },
  {
    id: 'focus-selected-object',
    type: 'command',
    title: '聚焦选中对象',
    subtitle: '将相机对准当前选中对象',
    icon: Monitor,
    keywords: ['focus', 'camera', 'view', '聚焦', '相机', '视图', 'f'],
    action: focusSelectedObject,
  },
  {
    id: 'reset-camera-view',
    type: 'command',
    title: '重置相机视角',
    subtitle: '恢复默认观察视角',
    icon: Monitor,
    keywords: ['reset', 'camera', 'home', '重置', '相机', '视角'],
    action: resetCameraView,
  },
  {
    id: 'toggle-grid',
    type: 'command',
    title: '显示/隐藏网格',
    subtitle: '切换 Canvas 网格辅助线',
    icon: Grid,
    keywords: ['grid', 'helper', '网格', '辅助线', 'shift+g'],
    action: toggleGrid,
  },
  {
    id: 'toggle-snap',
    type: 'command',
    title: '开启/关闭吸附',
    subtitle: '切换移动、旋转、缩放吸附',
    icon: Operation,
    keywords: ['snap', 'magnet', '吸附', 'shift+s'],
    action: toggleSnap,
  },
  ...(['browse', 'select', 'move', 'rotate', 'scale'] as EditorMode[]).map((mode) => ({
    id: `mode-${mode}`,
    type: 'command' as const,
    title: `切换到${modeText[mode]}`,
    subtitle: 'Canvas 工具模式',
    icon: Operation,
    keywords: ['tool', 'mode', '工具', '模式', mode, modeText[mode]],
    action: () => setMode(mode),
  })),
  ...(['default', 'asset', 'animation', 'data', 'publish'] as WorkspacePreset[]).map((preset) => ({
    id: `workspace-${preset}`,
    type: 'command' as const,
    title: `切换到${workspaceText[preset]}`,
    subtitle: workspaceSubtitle[preset],
    icon: Operation,
    keywords: ['workspace', 'layout', '工作区', '布局', preset, workspaceText[preset]],
    action: () => editorStore.applyWorkspacePreset(preset),
  })),
  ...(
    ['scene', 'models', 'materials', 'components', 'annotations', 'lights'] as LeftSidebarTab[]
  ).map((tab) => ({
    id: `left-tab-${tab}`,
    type: 'command' as const,
    title: `打开${leftTabText[tab]}`,
    subtitle: '左侧资源与场景面板',
    icon: tab === 'models' ? Box : tab === 'materials' ? Picture : tab === 'lights' ? Sunny : Files,
    keywords: ['left', 'asset', 'resource', 'tab', '左侧', '资源', tab, leftTabText[tab]],
    action: () => openLeftTab(tab),
  })),
  {
    id: 'toggle-left',
    type: 'command',
    title: editorStore.panels.leftSidebar ? '隐藏左侧面板' : '显示左侧面板',
    subtitle: 'Hierarchy / 资源库',
    icon: Files,
    keywords: ['left', 'sidebar', 'hierarchy', 'asset', '左侧', '资源', '场景树'],
    action: () => editorStore.togglePanel('leftSidebar'),
  },
  {
    id: 'toggle-right',
    type: 'command',
    title: editorStore.panels.rightSidebar ? '隐藏 Inspector' : '显示 Inspector',
    subtitle: '右侧属性面板',
    icon: Setting,
    keywords: ['right', 'inspector', '属性', '右侧'],
    action: () => editorStore.togglePanel('rightSidebar'),
  },
  {
    id: 'toggle-bottom',
    type: 'command',
    title: editorStore.panels.bottomPanel ? '隐藏底部 Dock' : '显示底部 Dock',
    subtitle: 'Console / Timeline / Problems',
    icon: Grid,
    keywords: ['bottom', 'dock', '底部', '面板'],
    action: () => editorStore.togglePanel('bottomPanel'),
  },
  ...(
    ['console', 'timeline', 'problems', 'performance', 'dataSources', 'publish'] as BottomDockTab[]
  ).map((tab) => ({
    id: `bottom-${tab}`,
    type: 'command' as const,
    title: `打开 ${bottomTabText[tab]}`,
    subtitle: '底部 Dock',
    icon: tab === 'performance' ? Monitor : tab === 'publish' ? VideoPlay : Grid,
    keywords: ['bottom', 'dock', 'tab', tab, bottomTabText[tab]],
    action: () => openBottomTab(tab),
  })),
])

const objectItems = computed<PaletteItem[]>(() =>
  sceneObjects.value.map((object) => ({
    id: `object-${object.uuid}`,
    type: 'object',
    title: object.name || `Unnamed ${object.type}`,
    subtitle: `${object.type} · ${object.uuid.slice(-6)}`,
    icon: Box,
    keywords: ['object', '对象', object.name, object.type, object.uuid.slice(-6)],
    action: () => selectObject(object),
  }))
)

const filteredItems = computed(() => {
  const keyword = query.value.trim().toLowerCase()
  const items = [...commandItems.value, ...objectItems.value]
  if (!keyword) return items

  return items.filter((item) => {
    const haystack = [item.title, item.subtitle, ...item.keywords].join(' ').toLowerCase()
    return haystack.includes(keyword)
  })
})

function executeItem(item: PaletteItem): void {
  item.action()
  closePalette()
}

function executeActive(): void {
  const item = filteredItems.value[activeIndex.value]
  if (item) executeItem(item)
}

function moveActive(delta: number): void {
  if (filteredItems.value.length === 0) return
  activeIndex.value =
    (activeIndex.value + delta + filteredItems.value.length) % filteredItems.value.length
}

function handleDocumentKeydown(event: KeyboardEvent): void {
  const isCommandK = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k'
  if (isCommandK) {
    event.preventDefault()
    togglePalette()
    return
  }

  if (!isOpen.value) return

  if (event.key === 'Escape') {
    event.preventDefault()
    closePalette()
  } else if (event.key === 'ArrowDown') {
    event.preventDefault()
    moveActive(1)
  } else if (event.key === 'ArrowUp') {
    event.preventDefault()
    moveActive(-1)
  } else if (event.key === 'Enter') {
    event.preventDefault()
    executeActive()
  }
}

function handleSceneChanged(): void {
  if (isOpen.value) {
    refreshSceneObjects()
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleDocumentKeydown)
  eventBus.on('scene:object-added', handleSceneChanged)
  eventBus.on('scene:object-removed', handleSceneChanged)
  eventBus.on('scene:property-changed', handleSceneChanged)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleDocumentKeydown)
  eventBus.off('scene:object-added', handleSceneChanged)
  eventBus.off('scene:object-removed', handleSceneChanged)
  eventBus.off('scene:property-changed', handleSceneChanged)
})
</script>

<template>
  <Teleport to="body">
    <Transition name="palette-fade">
      <div v-if="isOpen" class="command-palette-overlay" @mousedown.self="closePalette">
        <div class="command-palette" role="dialog" aria-label="命令面板">
          <div class="palette-search">
            <el-icon>
              <Search />
            </el-icon>
            <input
              ref="inputRef"
              v-model="query"
              placeholder="搜索命令、面板或场景对象"
              @keydown.stop
            />
            <span class="palette-shortcut">Esc</span>
          </div>

          <div class="palette-list">
            <template v-if="filteredItems.length > 0">
              <button
                v-for="(item, index) in filteredItems"
                :key="item.id"
                class="palette-item"
                :class="{ 'is-active': index === activeIndex }"
                @mousemove="activeIndex = index"
                @click="executeItem(item)"
              >
                <span class="item-icon">
                  <el-icon>
                    <component :is="item.icon" />
                  </el-icon>
                </span>
                <span class="item-main">
                  <span class="item-title">{{ item.title }}</span>
                  <span class="item-subtitle">{{ item.subtitle }}</span>
                </span>
                <span class="item-type">{{ item.type === 'object' ? '对象' : '命令' }}</span>
              </button>
            </template>
            <div v-else class="palette-empty">
              <el-icon>
                <MagicStick />
              </el-icon>
              <span>没有匹配结果</span>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped lang="scss">
.command-palette-overlay {
  position: fixed;
  inset: 0;
  z-index: 3000;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 88px;
  background: rgba(0, 0, 0, 0.26);
}

.command-palette {
  width: min(640px, calc(100vw - 32px));
  overflow: hidden;
  color: var(--lc-text-primary);
  background: var(--lc-bg-panel-raised);
  border: 1px solid var(--lc-border-subtle);
  border-radius: var(--lc-radius-lg);
  box-shadow: var(--lc-shadow-dialog);
}

.palette-search {
  height: 48px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 14px;
  border-bottom: 1px solid var(--lc-border-subtle);

  .el-icon {
    color: var(--lc-text-muted);
  }

  input {
    flex: 1;
    min-width: 0;
    color: var(--lc-text-primary);
    background: transparent;
    border: none;
    font-size: 14px;

    &::placeholder {
      color: var(--lc-text-muted);
    }
  }
}

.palette-shortcut {
  height: 22px;
  padding: 0 7px;
  display: flex;
  align-items: center;
  color: var(--lc-text-muted);
  background: var(--lc-bg-control);
  border: 1px solid var(--lc-border-subtle);
  border-radius: var(--lc-radius-sm);
  font-size: 11px;
}

.palette-list {
  max-height: 420px;
  overflow-y: auto;
  padding: 8px;
}

.palette-item {
  width: 100%;
  min-height: 48px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 8px;
  color: var(--lc-text-secondary);
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--lc-radius-md);
  text-align: left;
  cursor: pointer;

  &:hover,
  &.is-active {
    color: var(--lc-text-primary);
    background: var(--lc-selection-bg);
    border-color: var(--lc-selection-border);
  }
}

.item-icon {
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  color: var(--lc-accent);
  background: var(--lc-bg-control);
  border-radius: var(--lc-radius-md);
}

.item-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.item-title {
  overflow: hidden;
  color: var(--lc-text-primary);
  font-size: 13px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.item-subtitle,
.item-type {
  color: var(--lc-text-muted);
  font-size: 11px;
}

.item-type {
  flex-shrink: 0;
}

.palette-empty {
  height: 120px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: var(--lc-text-muted);
  font-size: 13px;
}

.palette-fade-enter-active,
.palette-fade-leave-active {
  transition: opacity 0.14s ease;
}

.palette-fade-enter-from,
.palette-fade-leave-to {
  opacity: 0;
}
</style>
