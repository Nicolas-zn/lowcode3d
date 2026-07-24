<script setup lang="ts">
/**
 * 材质编辑面板
 * 用于编辑 PBR 材质的各项属性
 */
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { Picture, Delete, Upload } from '@element-plus/icons-vue'
import * as THREE from 'three'
import {
  getMaterialManager,
  isMaterialColorCycleRunning,
  normalizeMaterialColorCycleConfig,
  startMaterialColorCycle,
  stopMaterialColorCycle,
  type IPBRMaterialProps,
  type MaterialColorCycleConfig,
  type TextureSlot,
} from '@/engine/materials'
import { getCommandBus, getEngine, eventBus, type ApplyMaterialPresetPayload } from '@/engine'
import { ElMessage } from 'element-plus'

// Props
interface Props {
  /** 当前选中的 Three.js 对象 */
  object: THREE.Object3D | null
}

const props = defineProps<Props>()

// Emits
const emit = defineEmits<{
  (e: 'change', props: Partial<IPBRMaterialProps>): void
  (e: 'textureChange', slot: TextureSlot, url: string | null): void
}>()

// 材质管理器
const materialManager = getMaterialManager()
const commandBus = getCommandBus()

// 当前材质
const currentMaterial = ref<THREE.MeshStandardMaterial | null>(null)

// 材质属性
const materialProps = ref<IPBRMaterialProps>({
  color: '#409EFF',
  metalness: 0.5,
  roughness: 0.5,
  opacity: 1,
  transparent: false,
  emissive: '#000000',
  emissiveIntensity: 0,
  wireframe: false,
  flatShading: false,
  side: 'front',
})

// 纹理槽位
const textureSlots = ref<Record<TextureSlot, string | null>>({
  map: null,
  normalMap: null,
  roughnessMap: null,
  metalnessMap: null,
  aoMap: null,
  emissiveMap: null,
})

const defaultCycleConfig: MaterialColorCycleConfig = {
  enabled: false,
  mode: 'gradient',
  loop: 'forever',
  duration: 3,
  colors: ['#409eff', '#35c46b', '#f5a524'],
}

const cycleConfig = ref<MaterialColorCycleConfig>({ ...defaultCycleConfig })
const isColorCycleRunning = ref(false)

// 纹理槽位配置
const textureSlotConfig: Array<{ slot: TextureSlot; label: string; description: string }> = [
  { slot: 'map', label: '漫反射贴图', description: '基础颜色纹理' },
  { slot: 'normalMap', label: '法线贴图', description: '表面细节' },
  { slot: 'roughnessMap', label: '粗糙度贴图', description: '粗糙度变化' },
  { slot: 'metalnessMap', label: '金属度贴图', description: '金属区域' },
  { slot: 'aoMap', label: '环境光遮蔽', description: '阴影细节' },
  { slot: 'emissiveMap', label: '自发光贴图', description: '发光区域' },
]

// 面渲染选项
const sideOptions = [
  { value: 'front', label: '正面' },
  { value: 'back', label: '背面' },
  { value: 'double', label: '双面' },
]

// 是否有材质
const hasMaterial = computed(() => currentMaterial.value !== null)
const enableEmissive = ref(false)

// 是否显示自发光
const showEmissive = computed(() => enableEmissive.value)

/**
 * 更新材质属性到 UI
 */
function syncFromMaterial(material: THREE.MeshStandardMaterial): void {
  const props = materialManager.getMaterialProps(material)
  if (props) {
    materialProps.value = { ...props }
    enableEmissive.value = props.emissive !== '#000000' || (props.emissiveIntensity ?? 0) > 0
  }

  // 同步纹理
  textureSlots.value = {
    map: material.map?.userData?.url || null,
    normalMap: material.normalMap?.userData?.url || null,
    roughnessMap: material.roughnessMap?.userData?.url || null,
    metalnessMap: material.metalnessMap?.userData?.url || null,
    aoMap: material.aoMap?.userData?.url || null,
    emissiveMap: material.emissiveMap?.userData?.url || null,
  }
}

function cloneCycleConfig(): MaterialColorCycleConfig {
  return {
    ...cycleConfig.value,
    colors: [...cycleConfig.value.colors],
  }
}

function syncCycleConfigFromObject(object: THREE.Object3D | null): void {
  cycleConfig.value = normalizeMaterialColorCycleConfig(object?.userData.materialColorCycle)
}

function restoreSavedColorCycle(): void {
  if (cycleConfig.value.enabled) {
    startColorCycle()
    return
  }
  isColorCycleRunning.value = isMaterialColorCycleRunning(props.object)
}

function persistCycleConfig(): void {
  if (!props.object) return
  commandBus.changeProperty(props.object, 'userData.materialColorCycle', cloneCycleConfig())
}

function addCycleColor(): void {
  if (cycleConfig.value.colors.length >= 8) return
  const fallback = cycleConfig.value.colors.at(-1) ?? materialProps.value.color
  cycleConfig.value.colors.push(fallback)
  persistCycleConfig()
}

function removeCycleColor(index: number): void {
  if (cycleConfig.value.colors.length <= 2) return
  cycleConfig.value.colors.splice(index, 1)
  persistCycleConfig()
}

function handleCycleConfigChange(): void {
  cycleConfig.value.duration = Math.min(60, Math.max(0.2, cycleConfig.value.duration))
  cycleConfig.value.colors = cycleConfig.value.colors.map((color) => color || '#ffffff')
  persistCycleConfig()

  if (isColorCycleRunning.value) {
    startColorCycle()
  }
}

function stopColorCycle(shouldPersist = true): void {
  if (props.object) {
    stopMaterialColorCycle(props.object)
  }
  isColorCycleRunning.value = false
  if (shouldPersist) {
    cycleConfig.value.enabled = false
    persistCycleConfig()
  }
}

function startColorCycle(): void {
  if (!currentMaterial.value || !props.object) return
  const object = props.object
  if (cycleConfig.value.colors.length < 2) {
    ElMessage.warning('颜色循环至少需要 2 个颜色')
    return
  }

  stopColorCycle(false)
  ensureMaterialCloned()
  getEngine()?.selectionManager.updateOriginalMaterial(object)
  object.userData.materialModified = true
  cycleConfig.value.enabled = true
  persistCycleConfig()

  startMaterialColorCycle(object, currentMaterial.value, cycleConfig.value, {
    onColorUpdate: (color) => {
      materialProps.value.color = color
    },
    onComplete: () => {
      isColorCycleRunning.value = isMaterialColorCycleRunning(props.object)
    },
  })
  isColorCycleRunning.value = true
}

/**
 * 更新颜色
 */
function handleColorChange(color: string | null): void {
  if (!currentMaterial.value || !props.object || !color) return

  applyMaterialPatch({ color })
  emit('change', { color })
}

// 标记材质是否已克隆（避免重复克隆）
let materialCloned = false

/**
 * 确保材质已克隆（避免修改共享材质影响其他 mesh）
 */
function ensureMaterialCloned(): void {
  if (materialCloned || !currentMaterial.value || !props.object) return
  const object = props.object
  if (!(object instanceof THREE.Mesh)) return

  // 克隆材质
  const clonedMaterial = currentMaterial.value.clone() as THREE.MeshStandardMaterial

  object.material = clonedMaterial
  currentMaterial.value = clonedMaterial
  materialCloned = true
  object.userData.materialModified = true
}

/**
 * 更新材质并同步到 SelectionManager
 */
function updateMaterialAndSync(patch: Partial<IPBRMaterialProps>): void {
  if (!currentMaterial.value || !props.object) return

  // 确保材质已克隆
  ensureMaterialCloned()
  commandBus.changeMaterial(props.object, currentMaterial.value, patch)
  syncFromMaterial(currentMaterial.value)
}

function applyMaterialPatch(patch: Partial<IPBRMaterialProps>): void {
  updateMaterialAndSync(patch)
}

/**
 * 更新金属度
 */
function handleMetalnessChange(value: number | number[]): void {
  const val = Array.isArray(value) ? value[0] : value
  applyMaterialPatch({ metalness: val })
  emit('change', { metalness: val })
}

/**
 * 更新粗糙度
 */
function handleRoughnessChange(value: number | number[]): void {
  const val = Array.isArray(value) ? value[0] : value
  applyMaterialPatch({ roughness: val })
  emit('change', { roughness: val })
}

/**
 * 更新不透明度
 */
function handleOpacityChange(value: number | number[]): void {
  const val = Array.isArray(value) ? value[0] : value
  applyMaterialPatch({ opacity: val, transparent: val < 1 })
  materialProps.value.transparent = val < 1
  emit('change', { opacity: val, transparent: val < 1 })
}

/**
 * 更新自发光颜色
 */
function handleEmissiveChange(color: string | null): void {
  if (!color) return
  applyMaterialPatch({ emissive: color })
  emit('change', { emissive: color })
}

function handleEmissiveEnabledChange(value: string | number | boolean): void {
  const enabled = Boolean(value)
  enableEmissive.value = enabled

  if (!enabled) {
    materialProps.value.emissive = '#000000'
    materialProps.value.emissiveIntensity = 0
    applyMaterialPatch({ emissive: '#000000', emissiveIntensity: 0 })
    emit('change', { emissive: '#000000', emissiveIntensity: 0 })
    return
  }

  const emissive =
    materialProps.value.emissive === '#000000' ? '#ffffff' : materialProps.value.emissive
  const emissiveIntensity =
    (materialProps.value.emissiveIntensity ?? 0) > 0 ? materialProps.value.emissiveIntensity : 1
  materialProps.value.emissive = emissive
  materialProps.value.emissiveIntensity = emissiveIntensity
  applyMaterialPatch({ emissive, emissiveIntensity })
  emit('change', { emissive, emissiveIntensity })
}

/**
 * 更新自发光强度
 */
function handleEmissiveIntensityChange(value: number | number[]): void {
  const val = Array.isArray(value) ? value[0] : value
  applyMaterialPatch({ emissiveIntensity: val })
  emit('change', { emissiveIntensity: val })
}

/**
 * 更新线框模式
 */
function handleWireframeChange(value: boolean | string | number): void {
  const val = Boolean(value)
  applyMaterialPatch({ wireframe: val })
  emit('change', { wireframe: val })
}

/**
 * 更新面渲染方向
 */
function handleSideChange(value: 'front' | 'back' | 'double'): void {
  applyMaterialPatch({ side: value })
  emit('change', { side: value })
}

/**
 * 选择纹理文件
 */
function selectTexture(slot: TextureSlot): void {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'image/*'

  input.onchange = async (e) => {
    const file = (e.target as HTMLInputElement).files?.[0]
    if (!file || !currentMaterial.value || !props.object) return

    const url = URL.createObjectURL(file)

    try {
      await materialManager.setTexture(currentMaterial.value, slot, url)
      textureSlots.value[slot] = url
      // 更新 SelectionManager 中的原始材质引用
      const engine = getEngine()
      if (engine) {
        engine.selectionManager.updateOriginalMaterial(props.object)
      }
      emit('textureChange', slot, url)
      ElMessage.success(`已设置${getSlotLabel(slot)}`)
    } catch {
      ElMessage.error(`加载纹理失败`)
    }
  }

  input.click()
}

/**
 * 移除纹理
 */
function removeTexture(slot: TextureSlot): void {
  if (!currentMaterial.value || !props.object) return

  materialManager.removeTexture(currentMaterial.value, slot)
  textureSlots.value[slot] = null
  // 更新 SelectionManager 中的原始材质引用
  const engine = getEngine()
  if (engine) {
    engine.selectionManager.updateOriginalMaterial(props.object)
  }
  emit('textureChange', slot, null)
  ElMessage.success(`已移除${getSlotLabel(slot)}`)
}

/**
 * 获取槽位标签
 */
function getSlotLabel(slot: TextureSlot): string {
  return textureSlotConfig.find((c) => c.slot === slot)?.label || slot
}

// 记录当前对象的 UUID，避免重复同步
let currentObjectUuid: string | null = null

/**
 * 监听对象变化
 */
watch(
  () => props.object,
  (newObj, oldObj) => {
    // 如果是同一个对象，不需要重新同步
    if (newObj && oldObj && newObj.uuid === oldObj.uuid) {
      return
    }

    // 重置材质克隆标记
    materialCloned = false
    syncCycleConfigFromObject(newObj)
    isColorCycleRunning.value = isMaterialColorCycleRunning(newObj)

    if (newObj) {
      const material = materialManager.getPrimaryMaterial(newObj)
      if (material instanceof THREE.MeshStandardMaterial) {
        // 只有当对象真正改变时才更新
        if (currentObjectUuid !== newObj.uuid) {
          currentObjectUuid = newObj.uuid
          currentMaterial.value = material
          syncFromMaterial(material)
          restoreSavedColorCycle()
        }
      } else {
        currentMaterial.value = null
        currentObjectUuid = null
      }
    } else {
      currentMaterial.value = null
      currentObjectUuid = null
    }
  },
  { immediate: true }
)

onMounted(() => {
  if (props.object) {
    syncCycleConfigFromObject(props.object)
    const material = materialManager.getPrimaryMaterial(props.object)
    if (material instanceof THREE.MeshStandardMaterial) {
      currentMaterial.value = material
      syncFromMaterial(material)
      restoreSavedColorCycle()
    }
  }

  eventBus.on('material:apply-preset', handleApplyPreset)
  eventBus.on('scene:property-changed', handleMaterialPropertyChanged)
})

/**
 * MaterialLibrary 已经应用了材质，这里只负责同步 UI 状态
 */
function handleApplyPreset(payload: ApplyMaterialPresetPayload): void {
  if (!currentMaterial.value || !payload.preset) return

  const preset = payload.preset
  materialProps.value = {
    ...materialProps.value,
    color: preset.color as string,
    metalness: preset.metalness as number,
    roughness: preset.roughness as number,
    emissive: preset.emissive as string,
    emissiveIntensity: preset.emissiveIntensity as number,
    opacity: preset.opacity as number,
    transparent: preset.transparent as boolean,
  }
  enableEmissive.value =
    materialProps.value.emissive !== '#000000' || (materialProps.value.emissiveIntensity ?? 0) > 0
}

onBeforeUnmount(() => {
  eventBus.off('material:apply-preset', handleApplyPreset)
  eventBus.off('scene:property-changed', handleMaterialPropertyChanged)
})

function handleMaterialPropertyChanged(payload: { target: object }): void {
  if (currentMaterial.value && payload.target === currentMaterial.value) {
    syncFromMaterial(currentMaterial.value)
  }
}
</script>

<template>
  <div class="material-panel">
    <template v-if="hasMaterial">
      <!-- 基础属性 -->
      <div class="property-section">
        <div class="section-title">基础属性</div>

        <!-- 颜色 -->
        <div class="property-row">
          <span class="property-label">颜色</span>
          <el-color-picker
            v-model="materialProps.color"
            size="small"
            show-alpha
            @change="handleColorChange"
          />
        </div>

        <!-- 金属度 -->
        <div class="property-row">
          <span class="property-label">金属度</span>
          <el-slider
            v-model="materialProps.metalness"
            :min="0"
            :max="1"
            :step="0.01"
            :show-tooltip="true"
            @change="handleMetalnessChange"
          />
          <span class="property-value">{{ materialProps.metalness.toFixed(2) }}</span>
        </div>

        <!-- 粗糙度 -->
        <div class="property-row">
          <span class="property-label">粗糙度</span>
          <el-slider
            v-model="materialProps.roughness"
            :min="0"
            :max="1"
            :step="0.01"
            :show-tooltip="true"
            @change="handleRoughnessChange"
          />
          <span class="property-value">{{ materialProps.roughness.toFixed(2) }}</span>
        </div>

        <!-- 不透明度 -->
        <div class="property-row">
          <span class="property-label">不透明度</span>
          <el-slider
            v-model="materialProps.opacity"
            :min="0"
            :max="1"
            :step="0.01"
            :show-tooltip="true"
            @change="handleOpacityChange"
          />
          <span class="property-value">{{ materialProps.opacity.toFixed(2) }}</span>
        </div>
      </div>

      <!-- 颜色循环 -->
      <div class="property-section color-cycle-section">
        <div class="section-title">颜色循环</div>

        <div class="cycle-toolbar">
          <el-radio-group v-model="cycleConfig.mode" size="small" @change="handleCycleConfigChange">
            <el-radio-button label="gradient">渐变</el-radio-button>
            <el-radio-button label="jump">突变</el-radio-button>
          </el-radio-group>
          <el-radio-group v-model="cycleConfig.loop" size="small" @change="handleCycleConfigChange">
            <el-radio-button label="once">一次</el-radio-button>
            <el-radio-button label="forever">永久</el-radio-button>
          </el-radio-group>
        </div>

        <div class="property-row">
          <span class="property-label">一轮时间</span>
          <el-input-number
            v-model="cycleConfig.duration"
            size="small"
            :min="0.2"
            :max="60"
            :step="0.5"
            :controls="false"
            @change="handleCycleConfigChange"
          />
          <span class="property-unit">秒</span>
        </div>

        <div class="cycle-color-list">
          <div
            v-for="(color, index) in cycleConfig.colors"
            :key="`${index}-${color}`"
            class="cycle-color-row"
          >
            <span class="cycle-color-index">{{ index + 1 }}</span>
            <el-color-picker
              v-model="cycleConfig.colors[index]"
              size="small"
              @change="handleCycleConfigChange"
            />
            <el-button
              size="small"
              text
              :disabled="cycleConfig.colors.length <= 2"
              @click="removeCycleColor(index)"
            >
              删除
            </el-button>
          </div>
        </div>

        <div class="cycle-actions">
          <el-button size="small" :disabled="cycleConfig.colors.length >= 8" @click="addCycleColor">
            添加颜色
          </el-button>
          <el-button
            v-if="isColorCycleRunning"
            size="small"
            type="warning"
            @click="() => stopColorCycle()"
          >
            停止
          </el-button>
          <el-button v-else size="small" type="primary" @click="startColorCycle">播放</el-button>
        </div>
      </div>

      <!-- 自发光 -->
      <div class="property-section">
        <div class="section-title-row">
          <div class="section-title">自发光</div>
          <el-switch v-model="enableEmissive" size="small" @change="handleEmissiveEnabledChange" />
        </div>

        <template v-if="showEmissive">
          <div class="property-row">
            <span class="property-label">颜色</span>
            <el-color-picker
              v-model="materialProps.emissive"
              size="small"
              @change="handleEmissiveChange"
            />
          </div>

          <div class="property-row">
            <span class="property-label">强度</span>
            <el-slider
              v-model="materialProps.emissiveIntensity"
              :min="0"
              :max="5"
              :step="0.1"
              :show-tooltip="true"
              @change="handleEmissiveIntensityChange"
            />
            <span class="property-value">{{
              (materialProps.emissiveIntensity ?? 0).toFixed(1)
            }}</span>
          </div>
        </template>
      </div>

      <!-- 渲染选项 -->
      <div class="property-section">
        <div class="section-title">渲染选项</div>

        <div class="property-row">
          <span class="property-label">面方向</span>
          <el-select v-model="materialProps.side" size="small" @change="handleSideChange">
            <el-option
              v-for="opt in sideOptions"
              :key="opt.value"
              :value="opt.value"
              :label="opt.label"
            />
          </el-select>
        </div>

        <div class="property-row checkbox-row">
          <el-checkbox v-model="materialProps.wireframe" @change="handleWireframeChange">
            线框模式
          </el-checkbox>
        </div>
      </div>

      <!-- 纹理贴图 -->
      <div class="property-section">
        <div class="section-title">纹理贴图</div>

        <div v-for="config in textureSlotConfig" :key="config.slot" class="texture-slot">
          <div class="texture-info">
            <span class="texture-label">{{ config.label }}</span>
            <span class="texture-desc">{{ config.description }}</span>
          </div>
          <div class="texture-actions">
            <template v-if="textureSlots[config.slot]">
              <div class="texture-preview">
                <img :src="textureSlots[config.slot]!" :alt="config.label" />
              </div>
              <el-button
                :icon="Delete"
                size="small"
                type="danger"
                text
                @click="removeTexture(config.slot)"
              />
            </template>
            <template v-else>
              <el-button :icon="Upload" size="small" @click="selectTexture(config.slot)">
                选择
              </el-button>
            </template>
          </div>
        </div>
      </div>
    </template>

    <!-- 无材质状态 -->
    <template v-else>
      <div class="no-material">
        <el-icon :size="36">
          <Picture />
        </el-icon>
        <p>当前对象没有可编辑的材质</p>
      </div>
    </template>
  </div>
</template>

<style scoped lang="scss">
.material-panel {
  padding: 0;
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

.section-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 12px;

  .section-title {
    margin-bottom: 0;
  }
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
    width: 70px;
    flex-shrink: 0;
    font-size: 12px;
    color: var(--el-text-color-regular);
  }

  .property-value {
    width: 40px;
    text-align: right;
    font-size: 11px;
    color: var(--el-text-color-secondary);
    font-family: monospace;
  }

  .property-unit {
    flex-shrink: 0;
    color: var(--lc-text-muted);
    font-size: 12px;
  }

  .el-slider {
    flex: 1;
  }

  .el-select {
    flex: 1;
  }

  .el-color-picker {
    margin-left: auto;
  }
}

.color-cycle-section {
  background: var(--lc-bg-panel);
}

.cycle-toolbar {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  margin-bottom: 12px;

  :deep(.el-radio-group) {
    width: 100%;
    min-width: 0;
  }

  :deep(.el-radio-button) {
    flex: 1;
    min-width: 0;
  }

  :deep(.el-radio-button__inner) {
    width: 100%;
    padding: 7px 8px;
    font-size: 12px;
    color: var(--lc-text-secondary);
    background: var(--lc-bg-control);
    border-color: var(--lc-border-subtle);
  }

  :deep(.el-radio-button__original-radio:checked + .el-radio-button__inner) {
    color: var(--lc-text-inverse);
    background: var(--lc-accent);
    border-color: var(--lc-accent);
    box-shadow: none;
  }
}

.cycle-color-list {
  display: flex;
  flex-direction: row;
  gap: 6px;
  min-width: 0;
  overflow-x: auto;
  padding-bottom: 2px;
}

.cycle-color-row {
  min-width: 86px;
  display: grid;
  grid-template-columns: 18px 28px 32px;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  background: var(--lc-bg-control);
  border: 1px solid var(--lc-border-subtle);
  border-radius: var(--lc-radius-sm);

  :deep(.el-color-picker) {
    justify-self: start;
  }
}

.cycle-color-index {
  color: var(--lc-text-muted);
  font-size: 12px;
  font-family: var(--lc-font-mono);
}

.cycle-actions {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 72px;
  gap: 8px;
  margin-top: 10px;

  .el-button {
    margin-left: 0;
  }
}

.texture-slot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px;
  margin-bottom: 8px;
  background-color: var(--el-fill-color-light);
  border-radius: 6px;

  &:last-child {
    margin-bottom: 0;
  }
}

.texture-info {
  display: flex;
  flex-direction: column;
  gap: 2px;

  .texture-label {
    font-size: 12px;
    color: var(--el-text-color-primary);
  }

  .texture-desc {
    font-size: 10px;
    color: var(--el-text-color-secondary);
  }
}

.texture-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.texture-preview {
  width: 32px;
  height: 32px;
  border-radius: 4px;
  overflow: hidden;
  background-color: var(--el-fill-color-darker);

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
}

.no-material {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  color: var(--el-text-color-placeholder);

  p {
    margin-top: 12px;
    font-size: 13px;
  }
}
</style>
