<script setup lang="ts">
/**
 * 灯光库组件
 * 展示可用的灯光类型和预设环境，支持拖拽添加到场景
 */
import { ref, computed } from 'vue'
import { Sunny } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import type { LightType } from '@/engine/lights'
import { getLightManager } from '@/engine/lights'
import { getEngine } from '@/engine'
import { setTransparentDragImage } from '@/utils/dragImage'
import {
  presetLightingEnvironments,
  categoryNames,
  type IPresetLightingEnvironment,
} from '@/data/presetLightingEnvironments'

// Emits
const emit = defineEmits<{
  (e: 'select', type: LightType): void
  (e: 'drag-start', type: LightType): void
  (e: 'preset-applied', preset: IPresetLightingEnvironment): void
}>()

// 灯光类型定义
interface ILightItem {
  type: LightType
  name: string
  description: string
  icon: string
}

// 灯光列表
const lightItems = ref<ILightItem[]>([
  {
    type: 'ambient',
    name: '环境光',
    description: '均匀照亮场景中的所有对象',
    icon: '🌍',
  },
  {
    type: 'directional',
    name: '平行光',
    description: '模拟太阳光，光线平行照射',
    icon: '☀️',
  },
  {
    type: 'point',
    name: '点光源',
    description: '从一个点向所有方向发射光线',
    icon: '💡',
  },
  {
    type: 'spot',
    name: '聚光灯',
    description: '锥形光束，可调节角度和范围',
    icon: '🔦',
  },
  {
    type: 'hemisphere',
    name: '半球光',
    description: '模拟天空光，上下颜色不同',
    icon: '🌤️',
  },
])

// 预设环境分类
const presetCategories = ['studio', 'outdoor', 'indoor', 'artistic'] as const
const activeCategory = ref<string>('studio')
const activePresetId = ref<string | null>(null)

// 按分类过滤预设
const filteredPresets = computed(() => {
  return presetLightingEnvironments.filter((p) => p.category === activeCategory.value)
})

/**
 * 处理拖拽开始
 */
function handleDragStart(event: DragEvent, item: ILightItem): void {
  if (!event.dataTransfer) return

  const data = {
    type: 'light',
    lightType: item.type,
    name: item.name,
    componentType: 'light',
    component: {
      type: 'light',
      props: { lightType: item.type },
    },
  }

  event.dataTransfer.setData('application/json', JSON.stringify(data))
  event.dataTransfer.effectAllowed = 'copy'
  setTransparentDragImage(event)

  emit('drag-start', item.type)
}

/**
 * 处理双击添加
 */
function handleDoubleClick(item: ILightItem): void {
  emit('select', item.type)
}

/**
 * 应用预设环境
 */
function applyPreset(preset: IPresetLightingEnvironment): void {
  const lightManager = getLightManager()
  const engine = getEngine()

  // 应用灯光预设
  lightManager.applyPreset(preset)

  // 应用环境设置
  if (preset.environment && engine) {
    if (preset.environment.backgroundColor) {
      engine.sceneManager.setBackgroundColor(preset.environment.backgroundColor)
    }
  }

  activePresetId.value = preset.id
  emit('preset-applied', preset)

  ElMessage.success(`已应用预设: ${preset.name}`)
}
</script>

<template>
  <div class="light-library">
    <!-- 灯光类型 -->
    <div class="library-section">
      <div class="library-header">
        <span class="header-title">灯光类型</span>
      </div>

      <div class="light-grid">
        <div
          v-for="item in lightItems"
          :key="item.type"
          class="light-item"
          draggable="true"
          @dragstart="handleDragStart($event, item)"
          @dblclick="handleDoubleClick(item)"
        >
          <div class="light-icon">
            <span class="emoji">{{ item.icon }}</span>
          </div>
          <div class="light-info">
            <span class="light-name">{{ item.name }}</span>
            <span class="light-desc">{{ item.description }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 预设环境 -->
    <div class="library-section">
      <div class="library-header">
        <span class="header-title">预设环境</span>
      </div>

      <!-- 分类标签 -->
      <div class="category-tabs">
        <button
          v-for="cat in presetCategories"
          :key="cat"
          class="category-tab"
          :class="{ active: activeCategory === cat }"
          @click="activeCategory = cat"
        >
          {{ categoryNames[cat] }}
        </button>
      </div>

      <!-- 预设卡片 -->
      <div class="preset-grid">
        <div
          v-for="preset in filteredPresets"
          :key="preset.id"
          class="preset-card"
          :class="{ active: activePresetId === preset.id }"
          @click="applyPreset(preset)"
        >
          <div class="preset-icon">
            <span class="emoji">{{ preset.icon }}</span>
          </div>
          <div class="preset-info">
            <span class="preset-name">{{ preset.name }}</span>
            <span class="preset-desc">{{ preset.description }}</span>
          </div>
        </div>
      </div>
    </div>

    <div class="library-tip">
      <el-icon><Sunny /></el-icon>
      <span>拖拽或双击添加灯光，点击预设快速布光</span>
    </div>
  </div>
</template>

<style scoped lang="scss">
.light-library {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow-y: auto;
}

.library-section {
  margin-bottom: 16px;
}

.library-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;

  .header-title {
    font-size: 11px;
    color: var(--el-text-color-regular);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
}

.light-grid {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.light-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background-color: var(--el-fill-color-light);
  border-radius: 8px;
  cursor: grab;
  transition: all 0.2s ease;
  border: 1px solid transparent;

  &:hover {
    background-color: var(--el-fill-color);
    border-color: var(--el-color-primary-light-5);
    box-shadow: var(--lc-shadow-floating);
  }

  &:active {
    cursor: grabbing;
    transform: scale(0.98);
  }

  .light-icon {
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: var(--el-fill-color-darker);
    border-radius: 8px;

    .emoji {
      font-size: 20px;
    }
  }

  .light-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;

    .light-name {
      font-size: 13px;
      font-weight: 500;
      color: var(--el-text-color-primary);
    }

    .light-desc {
      font-size: 11px;
      color: var(--el-text-color-secondary);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }
}

// 分类标签
.category-tabs {
  display: flex;
  gap: 6px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}

.category-tab {
  padding: 4px 10px;
  font-size: 11px;
  border: none;
  border-radius: 12px;
  background-color: var(--el-fill-color-light);
  color: var(--el-text-color-regular);
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background-color: var(--el-fill-color);
  }

  &.active {
    background-color: var(--el-color-primary);
    color: #fff;
  }
}

// 预设卡片
.preset-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
}

.preset-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 12px 8px;
  background-color: var(--el-fill-color-light);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  border: 2px solid transparent;

  &:hover {
    background-color: var(--el-fill-color);
    border-color: var(--el-color-primary-light-5);
    transform: translateY(-2px);
  }

  &.active {
    border-color: var(--el-color-primary);
    background-color: var(--el-color-primary-light-9);
  }

  .preset-icon {
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: var(--el-fill-color-darker);
    border-radius: 50%;

    .emoji {
      font-size: 18px;
    }
  }

  .preset-info {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    text-align: center;

    .preset-name {
      font-size: 12px;
      font-weight: 500;
      color: var(--el-text-color-primary);
    }

    .preset-desc {
      font-size: 10px;
      color: var(--el-text-color-secondary);
      line-height: 1.3;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
  }
}

.library-tip {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  margin-top: auto;
  padding: 8px;
  font-size: 11px;
  color: var(--el-text-color-placeholder);
  background-color: var(--el-fill-color-lighter);
  border-radius: 6px;
}
</style>
