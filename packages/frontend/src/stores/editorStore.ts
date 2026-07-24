import { defineStore } from 'pinia'
import { ref } from 'vue'

export type EditorMode = 'browse' | 'select' | 'move' | 'rotate' | 'scale'
export type BottomDockTab =
  | 'console'
  | 'timeline'
  | 'problems'
  | 'performance'
  | 'dataSources'
  | 'publish'
export type WorkspacePreset = 'default' | 'asset' | 'animation' | 'data' | 'publish'
type TransformMode = 'translate' | 'rotate' | 'scale'
type TransformSpace = 'world' | 'local'
type PanelKey = 'leftSidebar' | 'rightSidebar' | 'bottomPanel'
type PanelSizeKey = PanelKey

interface PanelSizes {
  leftSidebar: number
  rightSidebar: number
  bottomPanel: number
}

const EDITOR_LAYOUT_STORAGE_KEY = 'lowcode3d_editor_layout_v1'
const PANEL_SIZE_LIMITS: Record<PanelSizeKey, { min: number; max: number }> = {
  leftSidebar: { min: 240, max: 420 },
  rightSidebar: { min: 280, max: 440 },
  bottomPanel: { min: 160, max: 420 },
}

/**
 * 后处理设置
 */
export interface IPostProcessingState {
  enabled: boolean
  bloom: {
    enabled: boolean
    strength: number
    radius: number
    threshold: number
  }
  outline: {
    enabled: boolean
    color: string
    thickness: number
  }
  smaa: {
    enabled: boolean
  }
  toneMapping: {
    type: 'none' | 'linear' | 'reinhard' | 'cineon' | 'aces'
    exposure: number
  }
}

export const useEditorStore = defineStore('editor', () => {
  // 当前编辑器工具模式
  const editorMode = ref<EditorMode>('browse')

  // 当前变换工具
  const transformMode = ref<TransformMode>('translate')

  // 变换空间
  const transformSpace = ref<TransformSpace>('world')

  // 是否显示网格
  const showGrid = ref(true)

  // 是否显示坐标轴
  const showAxes = ref(true)

  // 是否显示辅助线
  const showHelpers = ref(true)

  // 是否启用吸附
  const snapEnabled = ref(false)

  // 吸附步长
  const snapStep = ref({
    translate: 1,
    rotate: 15, // 度
    scale: 0.1,
  })

  // 面板状态
  const panels = ref<Record<PanelKey, boolean>>({
    leftSidebar: true,
    rightSidebar: true,
    bottomPanel: false,
  })

  const panelSizes = ref<PanelSizes>({
    leftSidebar: 280,
    rightSidebar: 320,
    bottomPanel: 240,
  })

  const activeBottomTab = ref<BottomDockTab>('console')
  const workspacePreset = ref<WorkspacePreset>('default')

  // 后处理设置
  const postProcessing = ref<IPostProcessingState>({
    enabled: false,
    bloom: {
      enabled: true,
      strength: 0.5,
      radius: 0.4,
      threshold: 0.85,
    },
    outline: {
      enabled: true,
      color: '#ffffff',
      thickness: 2.0,
    },
    smaa: {
      enabled: true,
    },
    toneMapping: {
      type: 'aces',
      exposure: 1,
    },
  })

  // 设置编辑器工具模式
  function setEditorMode(mode: EditorMode) {
    editorMode.value = mode

    if (mode === 'move') {
      transformMode.value = 'translate'
    } else if (mode === 'rotate' || mode === 'scale') {
      transformMode.value = mode
    }
  }

  // 设置变换模式
  function setTransformMode(mode: TransformMode) {
    transformMode.value = mode
  }

  // 设置变换空间
  function setTransformSpace(space: TransformSpace) {
    transformSpace.value = space
  }

  // 切换变换空间
  function toggleTransformSpace() {
    transformSpace.value = transformSpace.value === 'world' ? 'local' : 'world'
  }

  // 切换面板显示
  function togglePanel(panel: PanelKey) {
    panels.value[panel] = !panels.value[panel]
    saveLayoutPreferences()
  }

  function setPanelVisible(panel: PanelKey, visible: boolean) {
    panels.value[panel] = visible
    saveLayoutPreferences()
  }

  function setBottomTab(tab: BottomDockTab, options: { openPanel?: boolean } = {}) {
    activeBottomTab.value = tab
    if (options.openPanel) {
      panels.value.bottomPanel = true
    }
    saveLayoutPreferences()
  }

  function setPanelSize(panel: PanelSizeKey, size: number, options: { save?: boolean } = {}) {
    const limit = PANEL_SIZE_LIMITS[panel]
    panelSizes.value[panel] = Math.round(Math.min(limit.max, Math.max(limit.min, size)))
    if (options.save) {
      saveLayoutPreferences()
    }
  }

  function commitPanelSizes() {
    saveLayoutPreferences()
  }

  function applyWorkspacePreset(preset: WorkspacePreset) {
    workspacePreset.value = preset

    if (preset === 'default') {
      panels.value = {
        leftSidebar: true,
        rightSidebar: true,
        bottomPanel: false,
      }
      activeBottomTab.value = 'console'
    } else if (preset === 'asset') {
      panels.value = {
        leftSidebar: true,
        rightSidebar: true,
        bottomPanel: false,
      }
      activeBottomTab.value = 'console'
      setPanelSize('leftSidebar', 340)
    } else if (preset === 'animation') {
      panels.value = {
        leftSidebar: true,
        rightSidebar: true,
        bottomPanel: true,
      }
      activeBottomTab.value = 'timeline'
      setPanelSize('bottomPanel', 300)
    } else if (preset === 'data') {
      panels.value = {
        leftSidebar: true,
        rightSidebar: true,
        bottomPanel: true,
      }
      activeBottomTab.value = 'dataSources'
      setPanelSize('leftSidebar', 300)
      setPanelSize('rightSidebar', 360)
      setPanelSize('bottomPanel', 260)
    } else if (preset === 'publish') {
      panels.value = {
        leftSidebar: false,
        rightSidebar: true,
        bottomPanel: true,
      }
      activeBottomTab.value = 'publish'
      setPanelSize('bottomPanel', 280)
    }

    saveLayoutPreferences()
  }

  function loadLayoutPreferences() {
    try {
      const raw = localStorage.getItem(EDITOR_LAYOUT_STORAGE_KEY)
      if (!raw) return

      const saved = JSON.parse(raw) as Partial<Record<PanelKey, boolean>> & {
        activeBottomTab?: BottomDockTab
        panelSizes?: Partial<PanelSizes>
        workspacePreset?: WorkspacePreset
      }
      panels.value = {
        ...panels.value,
        ...Object.fromEntries(
          Object.entries(saved).filter(([, value]) => typeof value === 'boolean')
        ),
      } as Record<PanelKey, boolean>
      if (
        saved.activeBottomTab === 'console' ||
        saved.activeBottomTab === 'timeline' ||
        saved.activeBottomTab === 'problems' ||
        saved.activeBottomTab === 'performance' ||
        saved.activeBottomTab === 'publish'
      ) {
        activeBottomTab.value = saved.activeBottomTab
      }
      if (saved.panelSizes && typeof saved.panelSizes === 'object') {
        ;(['leftSidebar', 'rightSidebar', 'bottomPanel'] as PanelSizeKey[]).forEach((panel) => {
          const size = saved.panelSizes?.[panel]
          if (typeof size === 'number' && Number.isFinite(size)) {
            setPanelSize(panel, size)
          }
        })
      }
      if (
        saved.workspacePreset === 'default' ||
        saved.workspacePreset === 'asset' ||
        saved.workspacePreset === 'animation' ||
        saved.workspacePreset === 'data' ||
        saved.workspacePreset === 'publish'
      ) {
        workspacePreset.value = saved.workspacePreset
      }
    } catch (error) {
      console.warn('Failed to load editor layout preferences:', error)
    }
  }

  function saveLayoutPreferences() {
    try {
      localStorage.setItem(
        EDITOR_LAYOUT_STORAGE_KEY,
        JSON.stringify({
          ...panels.value,
          panelSizes: panelSizes.value,
          activeBottomTab: activeBottomTab.value,
          workspacePreset: workspacePreset.value,
        })
      )
    } catch (error) {
      console.warn('Failed to save editor layout preferences:', error)
    }
  }

  // 更新后处理设置
  function updatePostProcessing(settings: Partial<IPostProcessingState>) {
    if (settings.enabled !== undefined) {
      postProcessing.value.enabled = settings.enabled
    }
    if (settings.bloom) {
      Object.assign(postProcessing.value.bloom, settings.bloom)
    }
    if (settings.outline) {
      Object.assign(postProcessing.value.outline, settings.outline)
    }
    if (settings.smaa) {
      Object.assign(postProcessing.value.smaa, settings.smaa)
    }
    if (settings.toneMapping) {
      Object.assign(postProcessing.value.toneMapping, settings.toneMapping)
    }
  }

  return {
    transformMode,
    editorMode,
    transformSpace,
    showGrid,
    showAxes,
    showHelpers,
    snapEnabled,
    snapStep,
    panels,
    panelSizes,
    activeBottomTab,
    workspacePreset,
    postProcessing,
    setEditorMode,
    setTransformMode,
    setTransformSpace,
    toggleTransformSpace,
    togglePanel,
    setPanelVisible,
    setBottomTab,
    setPanelSize,
    commitPanelSizes,
    applyWorkspacePreset,
    loadLayoutPreferences,
    saveLayoutPreferences,
    updatePostProcessing,
  }
})
