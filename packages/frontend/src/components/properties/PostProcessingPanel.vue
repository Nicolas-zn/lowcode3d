<script setup lang="ts">
/**
 * 后处理设置面板
 * 控制 Bloom、Outline、SMAA 等后处理效果
 */
import { computed, watch } from 'vue'
import { Sunny, CopyDocument, MagicStick } from '@element-plus/icons-vue'
import { getEngine } from '@/engine'
import { useEditorStore, type IPostProcessingState } from '@/stores/editorStore'

const editorStore = useEditorStore()

// 从 store 获取后处理状态
const postProcessing = computed(() => editorStore.postProcessing)

// 深度部分类型
type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P]
}

// 本地状态绑定（用于 UI 双向绑定）
const enabled = computed({
  get: () => postProcessing.value.enabled,
  set: (val) => syncToEngine({ enabled: val }),
})

const bloomEnabled = computed({
  get: () => postProcessing.value.bloom.enabled,
  set: (val) => syncToEngine({ bloom: { enabled: val } }),
})

const bloomIntensity = computed({
  get: () => postProcessing.value.bloom.strength,
  set: (val) => syncToEngine({ bloom: { strength: val } }),
})

const bloomThreshold = computed({
  get: () => postProcessing.value.bloom.threshold,
  set: (val) => syncToEngine({ bloom: { threshold: val } }),
})

const bloomRadius = computed({
  get: () => postProcessing.value.bloom.radius,
  set: (val) => syncToEngine({ bloom: { radius: val } }),
})

const outlineEnabled = computed({
  get: () => postProcessing.value.outline.enabled,
  set: (val) => syncToEngine({ outline: { enabled: val } }),
})

const outlineColor = computed({
  get: () => postProcessing.value.outline.color,
  set: (val) => syncToEngine({ outline: { color: val || '#ffffff' } }),
})

const outlineThickness = computed({
  get: () => postProcessing.value.outline.thickness,
  set: (val) => syncToEngine({ outline: { thickness: val } }),
})

const smaaEnabled = computed({
  get: () => postProcessing.value.smaa.enabled,
  set: (val) => syncToEngine({ smaa: { enabled: val } }),
})

const toneMappingExposure = computed({
  get: () => postProcessing.value.toneMapping.exposure,
  set: (val) => syncToEngine({ toneMapping: { exposure: val } }),
})

/**
 * 同步设置到 Engine
 */
function syncToEngine(settings: DeepPartial<IPostProcessingState>) {
  // 更新 store
  editorStore.updatePostProcessing(settings as Partial<IPostProcessingState>)

  // 同步到 Engine
  const engine = getEngine()
  const manager = engine.renderManager.postProcessingManager
  if (!manager) return

  if (settings.enabled !== undefined) {
    manager.setEnabled(settings.enabled)
  }

  if (settings.bloom) {
    manager.setBloomSettings({
      enabled: settings.bloom.enabled,
      intensity: settings.bloom.strength,
      luminanceThreshold: settings.bloom.threshold,
      radius: settings.bloom.radius,
    })
  }

  if (settings.outline) {
    manager.setOutlineSettings({
      enabled: settings.outline.enabled,
      color: settings.outline.color,
      edgeStrength: settings.outline.thickness,
    })
  }

  if (settings.smaa) {
    manager.setSMAAEnabled(settings.smaa.enabled ?? true)
  }

  if (settings.toneMapping) {
    engine.renderManager.applyProjectPostProcessing(postProcessing.value)
  }
}

// 初始同步
watch(
  () => postProcessing.value,
  () => {
    const engine = getEngine()
    if (engine.isInitialized && engine.renderManager.postProcessingManager) {
      syncToEngine(postProcessing.value)
    }
  },
  { immediate: true, deep: true }
)
</script>

<template>
  <div class="post-processing-panel">
    <!-- 全局开关 -->
    <div class="property-section">
      <div class="section-title">
        <el-icon>
          <MagicStick />
        </el-icon>
        后处理特效
      </div>
      <div class="property-row switch-row">
        <span class="property-label">启用后处理</span>
        <el-switch v-model="enabled" size="small" />
      </div>
    </div>

    <!-- Bloom 设置 -->
    <div class="property-section" :class="{ disabled: !enabled }">
      <div class="section-title">
        <el-icon>
          <Sunny />
        </el-icon>
        辉光效果 (Bloom)
      </div>

      <div class="property-row switch-row">
        <span class="property-label">启用</span>
        <el-switch v-model="bloomEnabled" size="small" :disabled="!enabled" />
      </div>

      <div class="property-row">
        <span class="property-label">强度</span>
        <el-slider
          v-model="bloomIntensity"
          :min="0"
          :max="3"
          :step="0.1"
          :disabled="!enabled || !bloomEnabled"
          size="small"
        />
        <span class="value-display">{{ bloomIntensity.toFixed(1) }}</span>
      </div>

      <div class="property-row">
        <span class="property-label">阈值</span>
        <el-slider
          v-model="bloomThreshold"
          :min="0"
          :max="1"
          :step="0.05"
          :disabled="!enabled || !bloomEnabled"
          size="small"
        />
        <span class="value-display">{{ bloomThreshold.toFixed(2) }}</span>
      </div>

      <div class="property-row">
        <span class="property-label">半径</span>
        <el-slider
          v-model="bloomRadius"
          :min="0"
          :max="1"
          :step="0.05"
          :disabled="!enabled || !bloomEnabled"
          size="small"
        />
        <span class="value-display">{{ bloomRadius.toFixed(2) }}</span>
      </div>
    </div>

    <!-- Outline 设置 -->
    <div class="property-section" :class="{ disabled: !enabled }">
      <div class="section-title">
        <el-icon>
          <CopyDocument />
        </el-icon>
        轮廓描边 (Outline)
      </div>

      <div class="property-row switch-row">
        <span class="property-label">启用</span>
        <el-switch v-model="outlineEnabled" size="small" :disabled="!enabled" />
      </div>

      <div class="property-row">
        <span class="property-label">颜色</span>
        <el-color-picker
          v-model="outlineColor"
          size="small"
          :disabled="!enabled || !outlineEnabled"
        />
      </div>

      <div class="property-row">
        <span class="property-label">粗细</span>
        <el-slider
          v-model="outlineThickness"
          :min="0.5"
          :max="10"
          :step="0.5"
          :disabled="!enabled || !outlineEnabled"
          size="small"
        />
        <span class="value-display">{{ outlineThickness.toFixed(1) }}</span>
      </div>
    </div>

    <!-- 抗锯齿 -->
    <div class="property-section" :class="{ disabled: !enabled }">
      <div class="section-title">抗锯齿 (SMAA)</div>
      <div class="property-row switch-row">
        <span class="property-label">启用 SMAA</span>
        <el-switch v-model="smaaEnabled" size="small" :disabled="!enabled" />
      </div>
    </div>

    <div class="property-section" :class="{ disabled: !enabled }">
      <div class="section-title">色调映射</div>
      <div class="property-row">
        <span class="property-label">曝光</span>
        <el-slider
          v-model="toneMappingExposure"
          :min="0.1"
          :max="3"
          :step="0.05"
          :disabled="!enabled"
          size="small"
        />
        <span class="value-display">{{ toneMappingExposure.toFixed(2) }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.post-processing-panel {
  padding: 8px;
}

.property-section {
  background: var(--el-bg-color);
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 12px;

  &.disabled {
    opacity: 0.6;
    pointer-events: none;
  }
}

.section-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 500;
  color: var(--el-text-color-primary);
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--el-border-color-lighter);

  .el-icon {
    font-size: 16px;
    color: var(--el-color-primary);
  }
}

.property-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;

  &:last-child {
    margin-bottom: 0;
  }

  &.switch-row {
    justify-content: space-between;
  }
}

.property-label {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  min-width: 48px;
  flex-shrink: 0;
}

.value-display {
  font-size: 11px;
  color: var(--el-text-color-regular);
  min-width: 36px;
  text-align: right;
}

:deep(.el-slider) {
  flex: 1;
  min-width: 80px;
}

:deep(.el-color-picker) {
  .el-color-picker__trigger {
    width: 28px;
    height: 28px;
  }
}
</style>
