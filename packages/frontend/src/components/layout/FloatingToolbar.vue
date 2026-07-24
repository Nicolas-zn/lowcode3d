<script setup lang="ts">
import { computed } from 'vue'
import {
  Aim,
  Coordinate,
  Grid,
  Magnet,
  Mouse,
  Position,
  RefreshRight,
  ScaleToOriginal,
  View,
} from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { getEditorModeController, getEngine, getHelperManager, getSnappingManager } from '@/engine'
import { useThemeStore } from '@/stores/themeStore'
import { useEditorStore, type EditorMode } from '@/stores/editorStore'

const themeStore = useThemeStore()
const editorStore = useEditorStore()
const editorModeController = getEditorModeController()
const isDark = computed(() => themeStore.isDark)

const activeTool = computed(() => editorStore.editorMode)
const transformSpace = computed(() => editorStore.transformSpace)

const toolItems: Array<{
  mode: EditorMode
  label: string
  shortcut: string
  icon: typeof View
}> = [
  { mode: 'browse', label: '浏览', shortcut: 'V', icon: View },
  { mode: 'select', label: '选择', shortcut: 'C', icon: Mouse },
  { mode: 'move', label: '移动', shortcut: 'M', icon: Position },
  { mode: 'rotate', label: '旋转', shortcut: 'R', icon: RefreshRight },
  { mode: 'scale', label: '缩放', shortcut: 'S', icon: ScaleToOriginal },
]

function setTool(tool: EditorMode) {
  editorModeController.setMode(tool)
}

function toggleSpace() {
  editorModeController.toggleSpace()
}

function toggleSnap() {
  getSnappingManager().toggle()
}

function toggleGrid() {
  const visible = getHelperManager().toggleGrid()
  ElMessage.info(visible ? '网格已显示' : '网格已隐藏')
}

function focusSelection() {
  const engine = getEngine()
  const selected = engine?.selectionManager.getPrimarySelected()
  if (!engine || !selected) {
    ElMessage.warning('请先选中一个对象')
    return
  }
  engine.cameraManager.focusOnObject(selected)
}
</script>

<template>
  <div class="floating-toolbar" :class="{ 'is-dark': isDark }">
    <div class="toolbar-section">
      <el-tooltip
        v-for="tool in toolItems"
        :key="tool.mode"
        :content="`${tool.label} ${tool.shortcut}`"
        placement="bottom"
      >
        <el-button
          class="tool-button"
          :class="{ 'is-active': activeTool === tool.mode }"
          text
          @click="setTool(tool.mode)"
        >
          <el-icon>
            <component :is="tool.icon" />
          </el-icon>
        </el-button>
      </el-tooltip>
    </div>

    <el-divider direction="vertical" />

    <div class="toolbar-section">
      <el-tooltip
        :content="`切换到${transformSpace === 'world' ? '局部' : '世界'}坐标 X`"
        placement="bottom"
      >
        <el-button class="mode-chip" text @click="toggleSpace">
          <el-icon>
            <Coordinate />
          </el-icon>
          {{ transformSpace === 'world' ? '世界' : '局部' }}
        </el-button>
      </el-tooltip>

      <el-tooltip content="吸附 Shift+S" placement="bottom">
        <el-button class="tool-button" text @click="toggleSnap">
          <el-icon>
            <Magnet />
          </el-icon>
        </el-button>
      </el-tooltip>

      <el-tooltip content="网格 Shift+G" placement="bottom">
        <el-button class="tool-button" text @click="toggleGrid">
          <el-icon>
            <Grid />
          </el-icon>
        </el-button>
      </el-tooltip>

      <el-tooltip content="聚焦选中 F" placement="bottom">
        <el-button class="tool-button" text @click="focusSelection">
          <el-icon>
            <Aim />
          </el-icon>
        </el-button>
      </el-tooltip>
    </div>
  </div>
</template>

<style scoped lang="scss">
.floating-toolbar {
  position: absolute;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 1000;

  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px;

  color: var(--lc-text-primary);
  background-color: var(--lc-bg-panel-raised);
  border: 1px solid var(--lc-border-subtle);
  border-radius: var(--lc-radius-lg);
  box-shadow: var(--lc-shadow-floating);
  backdrop-filter: blur(10px);
  transition:
    border-color 0.2s ease,
    box-shadow 0.2s ease;

  &:hover {
    border-color: var(--lc-border-strong);
  }

  &.is-dark {
    background-color: rgba(34, 40, 50, 0.94);
  }
}

.toolbar-section {
  display: flex;
  align-items: center;
  gap: 2px;
}

.tool-button {
  width: 32px;
  height: 32px;
  padding: 0;
  color: var(--lc-text-secondary);
  border-radius: var(--lc-radius-md);

  &:hover {
    color: var(--lc-text-primary);
    background: var(--lc-bg-control-hover);
  }

  &.is-active {
    color: var(--lc-text-primary);
    background: var(--lc-selection-bg);
    outline: 1px solid var(--lc-selection-border);
  }
}

.mode-chip {
  height: 32px;
  padding: 0 10px;
  color: var(--lc-text-secondary);
  border-radius: var(--lc-radius-md);

  &:hover {
    color: var(--lc-text-primary);
    background: var(--lc-bg-control-hover);
  }
}

.el-divider--vertical {
  height: 20px;
  margin: 0 2px;
  border-color: var(--lc-border-subtle);
}
</style>
