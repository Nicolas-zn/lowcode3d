<script setup lang="ts">
/**
 * 灯光属性编辑面板
 */
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import * as THREE from 'three'
import { getCommandBus, eventBus } from '@/engine'
import { getLightManager, LightManager, type ILightProps, type LightType } from '@/engine/lights'

// Props
interface Props {
  /** 当前选中的 Three.js 对象 */
  object: THREE.Object3D | null
}

const props = defineProps<Props>()

// Emits
const emit = defineEmits<{
  (e: 'change', props: Partial<ILightProps>): void
}>()

// 灯光管理器
const lightManager = getLightManager()
const commandBus = getCommandBus()

// 当前灯光
const currentLight = ref<THREE.Light | null>(null)

// 灯光属性
const lightProps = ref<ILightProps>({
  type: 'point',
  color: '#ffffff',
  intensity: 1,
  castShadow: true,
  distance: 0,
  decay: 2,
  angle: Math.PI / 6,
  penumbra: 0.1,
  position: { x: 0, y: 5, z: 0 },
})

// 灯光类型标签
const lightTypeLabels: Record<LightType, string> = {
  ambient: '环境光',
  directional: '平行光',
  point: '点光源',
  spot: '聚光灯',
  hemisphere: '半球光',
}

// 是否是灯光
const isLight = computed(() => currentLight.value !== null)

// 当前灯光类型
const currentLightType = computed(() => lightProps.value.type)

// 是否显示距离/衰减（Point/Spot）
const showDistanceDecay = computed(() => {
  return currentLightType.value === 'point' || currentLightType.value === 'spot'
})

// 是否显示角度/半影（Spot）
const showSpotOptions = computed(() => currentLightType.value === 'spot')

// 是否显示地面颜色（Hemisphere）
const showGroundColor = computed(() => currentLightType.value === 'hemisphere')

// 是否显示阴影选项
const showShadowOptions = computed(() => {
  return (
    currentLightType.value === 'directional' ||
    currentLightType.value === 'point' ||
    currentLightType.value === 'spot'
  )
})

/**
 * 从灯光同步属性到 UI
 */
function syncFromLight(light: THREE.Light): void {
  const props = lightManager.getLightProps(light)
  if (props) {
    lightProps.value = { ...props }
  }
}

/**
 * 更新颜色
 */
function handleColorChange(color: string | null): void {
  if (!currentLight.value || !color) return
  commandBus.changeLight(currentLight.value, { color })
  emit('change', { color })
}

/**
 * 更新强度
 */
function handleIntensityChange(value: number | number[]): void {
  if (!currentLight.value || typeof value !== 'number') return
  commandBus.changeLight(currentLight.value, { intensity: value })
  emit('change', { intensity: value })
}

/**
 * 更新投射阴影
 */
function handleCastShadowChange(value: string | number | boolean): void {
  if (!currentLight.value || typeof value !== 'boolean') return
  commandBus.changeLight(currentLight.value, { castShadow: value })
  emit('change', { castShadow: value })
}

/**
 * 更新距离
 */
function handleDistanceChange(value: number | number[]): void {
  if (!currentLight.value || typeof value !== 'number') return
  commandBus.changeLight(currentLight.value, { distance: value })
  emit('change', { distance: value })
}

/**
 * 更新衰减
 */
function handleDecayChange(value: number | number[]): void {
  if (!currentLight.value || typeof value !== 'number') return
  commandBus.changeLight(currentLight.value, { decay: value })
  emit('change', { decay: value })
}

/**
 * 更新角度
 */
function handleAngleChange(value: number | number[]): void {
  if (!currentLight.value || typeof value !== 'number') return
  // 将角度转换为弧度
  const radians = THREE.MathUtils.degToRad(value)
  commandBus.changeLight(currentLight.value, { angle: radians })
  emit('change', { angle: radians })
}

/**
 * 更新半影
 */
function handlePenumbraChange(value: number | number[]): void {
  if (!currentLight.value || typeof value !== 'number') return
  commandBus.changeLight(currentLight.value, { penumbra: value })
  emit('change', { penumbra: value })
}

/**
 * 更新地面颜色
 */
function handleGroundColorChange(color: string | null): void {
  if (!currentLight.value || !color) return
  commandBus.changeLight(currentLight.value, { groundColor: color })
  emit('change', { groundColor: color })
}

/**
 * 获取角度（度数）
 */
const angleInDegrees = computed({
  get: () => THREE.MathUtils.radToDeg(lightProps.value.angle || 0),
  set: (val) => {
    lightProps.value.angle = THREE.MathUtils.degToRad(val)
  },
})

/**
 * 监听对象变化
 */
watch(
  () => props.object,
  (newObj) => {
    if (newObj && LightManager.isLight(newObj)) {
      currentLight.value = newObj
      syncFromLight(newObj)
    } else {
      currentLight.value = null
    }
  },
  { immediate: true }
)

onMounted(() => {
  if (props.object && LightManager.isLight(props.object)) {
    currentLight.value = props.object
    syncFromLight(props.object)
  }
  eventBus.on('scene:property-changed', handlePropertyChanged)
})

function handlePropertyChanged(payload: { target: object }): void {
  if (currentLight.value && payload.target === currentLight.value) {
    syncFromLight(currentLight.value)
  }
}

onBeforeUnmount(() => {
  eventBus.off('scene:property-changed', handlePropertyChanged)
})
</script>

<template>
  <div class="light-panel">
    <template v-if="isLight">
      <!-- 灯光类型 -->
      <div class="light-type-badge">
        <el-tag type="warning" effect="dark">
          {{ lightTypeLabels[currentLightType] }}
        </el-tag>
      </div>

      <!-- 基础属性 -->
      <div class="property-section">
        <div class="section-title">基础属性</div>

        <!-- 颜色 -->
        <div class="property-row">
          <span class="property-label">颜色</span>
          <el-color-picker v-model="lightProps.color" size="small" @change="handleColorChange" />
        </div>

        <!-- 强度 -->
        <div class="property-row">
          <span class="property-label">强度</span>
          <el-slider
            v-model="lightProps.intensity"
            :min="0"
            :max="10"
            :step="0.1"
            :show-tooltip="true"
            @change="handleIntensityChange"
          />
          <span class="property-value">{{ lightProps.intensity.toFixed(1) }}</span>
        </div>

        <!-- 地面颜色（半球光） -->
        <div v-if="showGroundColor" class="property-row">
          <span class="property-label">地面色</span>
          <el-color-picker
            v-model="lightProps.groundColor"
            size="small"
            @change="handleGroundColorChange"
          />
        </div>
      </div>

      <!-- 距离和衰减（Point/Spot） -->
      <div v-if="showDistanceDecay" class="property-section">
        <div class="section-title">衰减设置</div>

        <div class="property-row">
          <span class="property-label">距离</span>
          <el-slider
            v-model="lightProps.distance"
            :min="0"
            :max="100"
            :step="1"
            :show-tooltip="true"
            @change="handleDistanceChange"
          />
          <span class="property-value">{{ lightProps.distance }}</span>
        </div>

        <div class="property-row">
          <span class="property-label">衰减</span>
          <el-slider
            v-model="lightProps.decay"
            :min="0"
            :max="5"
            :step="0.1"
            :show-tooltip="true"
            @change="handleDecayChange"
          />
          <span class="property-value">{{ lightProps.decay?.toFixed(1) }}</span>
        </div>
      </div>

      <!-- 聚光灯选项 -->
      <div v-if="showSpotOptions" class="property-section">
        <div class="section-title">聚光灯设置</div>

        <div class="property-row">
          <span class="property-label">角度</span>
          <el-slider
            v-model="angleInDegrees"
            :min="1"
            :max="90"
            :step="1"
            :show-tooltip="true"
            @change="handleAngleChange"
          />
          <span class="property-value">{{ angleInDegrees.toFixed(0) }}°</span>
        </div>

        <div class="property-row">
          <span class="property-label">半影</span>
          <el-slider
            v-model="lightProps.penumbra"
            :min="0"
            :max="1"
            :step="0.01"
            :show-tooltip="true"
            @change="handlePenumbraChange"
          />
          <span class="property-value">{{ lightProps.penumbra?.toFixed(2) }}</span>
        </div>
      </div>

      <!-- 阴影设置 -->
      <div v-if="showShadowOptions" class="property-section">
        <div class="section-title">阴影</div>

        <div class="property-row checkbox-row">
          <el-checkbox v-model="lightProps.castShadow" @change="handleCastShadowChange">
            投射阴影
          </el-checkbox>
        </div>
      </div>
    </template>

    <!-- 非灯光对象 -->
    <template v-else>
      <div class="no-light">
        <p>当前对象不是灯光</p>
      </div>
    </template>
  </div>
</template>

<style scoped lang="scss">
.light-panel {
  padding: 0;
}

.light-type-badge {
  padding: 12px;
  text-align: center;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.property-section {
  padding: 12px;
  border-bottom: 1px solid var(--el-border-color-lighter);

  &:last-child {
    border-bottom: none;
  }
}

.section-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--el-text-color-secondary);
  margin-bottom: 12px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.property-row {
  display: flex;
  align-items: center;
  margin-bottom: 12px;
  gap: 8px;

  &:last-child {
    margin-bottom: 0;
  }

  &.checkbox-row {
    margin-top: 8px;
  }

  .property-label {
    width: 60px;
    flex-shrink: 0;
    font-size: 12px;
    color: var(--el-text-color-regular);
  }

  .property-value {
    width: 45px;
    text-align: right;
    font-size: 11px;
    color: var(--el-text-color-secondary);
    font-family: monospace;
  }

  .el-slider {
    flex: 1;
  }

  .el-color-picker {
    margin-left: auto;
  }
}

.no-light {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  color: var(--el-text-color-placeholder);
  font-size: 13px;
}
</style>
