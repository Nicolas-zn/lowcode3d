<script setup lang="ts">
/**
 * 环境设置面板
 * 控制场景背景、环境贴图和雾效
 * HDR列表与资源中心保持同步
 */
import { ref, onMounted, computed, onBeforeUnmount } from 'vue'
import { Delete, Sunny, Refresh } from '@element-plus/icons-vue'
import * as THREE from 'three'
import { getEngine, eventBus } from '@/engine'
import { ElMessage } from 'element-plus'
import { assetsApi } from '@/api'
import type { Asset } from '@/api/assets'

// 背景类型
type BackgroundType = 'color' | 'hdri'

// 雾效类型
type FogType = 'none' | 'linear' | 'exponential'

// 状态
const backgroundType = ref<BackgroundType>('color')
const backgroundColor = ref('#1a1a2e')
const hdriUrl = ref<string | null>(null)
const selectedHdriId = ref<string | null>(null)
const useHdriAsBackground = ref(false)

// HDR 资源列表
const hdriAssets = ref<Asset[]>([])
const isLoadingAssets = ref(false)

// 雾效
const fogType = ref<FogType>('none')
const fogColor = ref('#1a1a2e')
const fogNear = ref(10)
const fogFar = ref(100)
const fogDensity = ref(0.01)

// 加载状态
const isLoading = ref(false)

// 计算是否有HDR资源
const hasHdriAssets = computed(() => hdriAssets.value.length > 0)

/**
 * 加载 HDR 资源列表
 */
async function loadHdriAssets(): Promise<void> {
  isLoadingAssets.value = true
  try {
    const response = await assetsApi.getAssets('hdri')
    if (response.success && response.data) {
      hdriAssets.value = response.data

      // 资源加载完成后，重新同步当前场景的 HDR 状态
      const engine = getEngine()
      if (engine?.sceneManager.scene.userData.environmentUrl) {
        syncSelectedHdriFromUrl(engine.sceneManager.scene.userData.environmentUrl)
      }
    }
  } catch (e) {
    console.error('加载 HDR 资源失败', e)
  } finally {
    isLoadingAssets.value = false
  }
}

/**
 * 更新背景颜色
 */
function handleBackgroundColorChange(color: string | null): void {
  if (!color) return
  const engine = getEngine()
  if (!engine) return

  engine.sceneManager.setBackgroundColor(color)
  backgroundType.value = 'color'
}

/**
 * 选择 HDR 文件（本地上传）
 */
// function selectHdriFromLocal(): void {
//   const input = document.createElement('input')
//   input.type = 'file'
//   input.accept = '.hdr,.exr'

//   input.onchange = async (e) => {
//     const file = (e.target as HTMLInputElement).files?.[0]
//     if (!file) return

//     const url = URL.createObjectURL(file)
//     await loadHdri(url)
//     selectedHdriId.value = null // 本地上传的没有资源 ID
//   }

//   input.click()
// }

/**
 * 选择资源中心的 HDR
 */
async function selectHdriFromAsset(asset: Asset): Promise<void> {
  await loadHdri(asset.url)
  selectedHdriId.value = asset.id
}

/**
 * 加载 HDR 环境
 */
async function loadHdri(url: string): Promise<void> {
  const engine = getEngine()
  if (!engine) return

  isLoading.value = true

  try {
    await engine.sceneManager.setEnvironmentMap(url)
    hdriUrl.value = url
    backgroundType.value = 'hdri'

    if (useHdriAsBackground.value) {
      engine.sceneManager.setBackgroundAsEnvironment()
    }

    ElMessage.success('环境贴图加载成功')
  } catch (error) {
    console.error('Failed to load HDRI:', error)
    ElMessage.error('环境贴图加载失败')
  } finally {
    isLoading.value = false
  }
}

/**
 * 移除 HDR 环境
 */
function removeHdri(): void {
  const engine = getEngine()
  if (!engine) return

  // 重置为颜色背景
  engine.sceneManager.setBackgroundColor(backgroundColor.value)
  engine.sceneManager.scene.environment = null
  hdriUrl.value = null
  selectedHdriId.value = null
  backgroundType.value = 'color'
}

/**
 * 切换使用 HDRI 作为背景
 */
function handleUseHdriAsBackgroundChange(value: string | number | boolean): void {
  if (typeof value !== 'boolean') return
  const engine = getEngine()
  if (!engine) return

  if (value && hdriUrl.value) {
    engine.sceneManager.setBackgroundAsEnvironment()
  } else {
    engine.sceneManager.setBackgroundColor(backgroundColor.value)
  }
}

/**
 * 更新雾效类型
 */
function handleFogTypeChange(type: FogType): void {
  const engine = getEngine()
  if (!engine) return

  if (type === 'none') {
    engine.sceneManager.clearFog()
  } else if (type === 'linear') {
    engine.sceneManager.setFog('linear', fogColor.value, fogNear.value, fogFar.value)
  } else {
    engine.sceneManager.setFog('exponential', fogColor.value, fogDensity.value)
  }
}

/**
 * 更新雾效颜色
 */
function handleFogColorChange(_color: string | null): void {
  if (fogType.value === 'none') return
  handleFogTypeChange(fogType.value)
}

/**
 * 更新线性雾参数
 */
function handleLinearFogChange(): void {
  if (fogType.value !== 'linear') return
  const engine = getEngine()
  if (!engine) return

  engine.sceneManager.setFog('linear', fogColor.value, fogNear.value, fogFar.value)
}

/**
 * 更新指数雾参数
 */
function handleExponentialFogChange(): void {
  if (fogType.value !== 'exponential') return
  const engine = getEngine()
  if (!engine) return

  engine.sceneManager.setFog('exponential', fogColor.value, fogDensity.value)
}

// 雾效类型选项
const fogTypeOptions = [
  { value: 'none', label: '无' },
  { value: 'linear', label: '线性' },
  { value: 'exponential', label: '指数' },
]

/**
 * 从场景同步当前状态到 UI
 */
function syncStateFromScene(): void {
  const engine = getEngine()
  if (!engine) return

  const scene = engine.sceneManager.scene

  // 同步背景色
  if (scene.background instanceof THREE.Color) {
    backgroundColor.value = '#' + scene.background.getHexString()
    backgroundType.value = 'color'
  }

  // 同步环境贴图状态
  if (scene.userData.environmentUrl) {
    hdriUrl.value = scene.userData.environmentUrl
    backgroundType.value = 'hdri'

    // 检查是否使用环境贴图作为背景
    useHdriAsBackground.value = scene.userData.backgroundType === 'environment'

    // 尝试匹配当前加载的 HDR 资源
    syncSelectedHdriFromUrl(scene.userData.environmentUrl)
  } else {
    hdriUrl.value = null
    selectedHdriId.value = null
    useHdriAsBackground.value = false
  }

  // 同步雾效状态
  if (scene.fog) {
    if (scene.fog instanceof THREE.Fog) {
      fogType.value = 'linear'
      fogColor.value = '#' + scene.fog.color.getHexString()
      fogNear.value = scene.fog.near
      fogFar.value = scene.fog.far
    } else if (scene.fog instanceof THREE.FogExp2) {
      fogType.value = 'exponential'
      fogColor.value = '#' + scene.fog.color.getHexString()
      fogDensity.value = scene.fog.density
    }
  } else {
    fogType.value = 'none'
  }
}

/**
 * 根据 URL 匹配并选中对应的 HDR 资源
 */
function syncSelectedHdriFromUrl(url: string): void {
  // 在已加载的 HDR 资源中查找匹配的 URL
  const matchedAsset = hdriAssets.value.find((asset) => asset.url === url)
  if (matchedAsset) {
    selectedHdriId.value = matchedAsset.id
    console.log('✅ Synced HDR selection:', matchedAsset.name, matchedAsset.id)
  } else {
    // 如果没有找到匹配的资源，清空选择但保留 URL
    selectedHdriId.value = null
    console.log('⚠️ HDR URL found but no matching asset:', url)
  }
}

/**
 * 监听场景加载事件
 */
function handleSceneLoaded(): void {
  console.log('🎬 Scene loaded, syncing environment state...')
  syncStateFromScene()
}

onMounted(() => {
  // 加载 HDR 资源列表
  loadHdriAssets()
  // 同步场景状态到 UI
  syncStateFromScene()

  eventBus.on('scene:loaded', handleSceneLoaded as () => void)
})

onBeforeUnmount(() => {
  eventBus.off('scene:loaded', handleSceneLoaded as () => void)
})
</script>

<template>
  <div class="environment-panel">
    <!-- 背景设置 -->
    <div class="property-section">
      <div class="section-title">
        <el-icon>
          <Sunny />
        </el-icon>
        背景设置
      </div>

      <!-- 背景颜色 -->
      <div class="property-row">
        <span class="property-label">背景色</span>
        <el-color-picker
          v-model="backgroundColor"
          size="small"
          @change="handleBackgroundColorChange"
        />
      </div>
    </div>

    <!-- 环境贴图 -->
    <div class="property-section">
      <div class="section-header">
        <div class="section-title">环境贴图 (HDR)</div>
        <el-button
          :icon="Refresh"
          size="small"
          text
          :loading="isLoadingAssets"
          title="刷新列表"
          @click="loadHdriAssets"
        />
      </div>

      <!-- 已加载的 HDR 状态 -->
      <div v-if="hdriUrl" class="hdri-status">
        <div class="hdri-info">
          <span class="hdri-label">✓ 已加载 HDR</span>
          <el-button :icon="Delete" size="small" type="danger" text @click="removeHdri">
            移除
          </el-button>
        </div>
        <div class="property-row checkbox-row">
          <el-checkbox v-model="useHdriAsBackground" @change="handleUseHdriAsBackgroundChange">
            使用为背景
          </el-checkbox>
        </div>
      </div>

      <!-- HDR 资源网格 -->
      <div class="hdri-section">
        <div v-if="isLoadingAssets" class="loading-state">
          <el-skeleton :rows="1" animated />
        </div>
        <div v-else-if="!hasHdriAssets" class="empty-state">
          <div class="empty-icon">🌅</div>
          <p>暂无 HDR 资源</p>
          <p class="empty-hint">请在资源中心上传 HDR 文件</p>
        </div>
        <div v-else class="hdri-grid">
          <div
            v-for="asset in hdriAssets"
            :key="asset.id"
            class="hdri-card"
            :class="{ active: selectedHdriId === asset.id, loading: isLoading }"
            @click="!isLoading && selectHdriFromAsset(asset)"
          >
            <div class="hdri-preview">
              <img v-if="asset.thumbnailUrl" :src="asset.thumbnailUrl" :alt="asset.name" />
              <el-icon v-else :size="24">
                <Sunny />
              </el-icon>
            </div>
            <div class="hdri-name">{{ asset.name }}</div>
          </div>
        </div>
      </div>

      <!-- 本地上传按钮 -->
      <!-- <div class="upload-action">
        <el-button
          :icon="Upload"
          size="small"
          :loading="isLoading"
          @click="selectHdriFromLocal"
        >
          {{ isLoading ? '加载中...' : '上传本地 HDR' }}
        </el-button>
      </div> -->
    </div>

    <!-- 雾效设置 -->
    <div class="property-section">
      <div class="section-title">雾效</div>

      <div class="property-row">
        <span class="property-label">类型</span>
        <el-select v-model="fogType" size="small" @change="handleFogTypeChange">
          <el-option
            v-for="opt in fogTypeOptions"
            :key="opt.value"
            :value="opt.value"
            :label="opt.label"
          />
        </el-select>
      </div>

      <template v-if="fogType !== 'none'">
        <div class="property-row">
          <span class="property-label">颜色</span>
          <el-color-picker v-model="fogColor" size="small" @change="handleFogColorChange" />
        </div>

        <!-- 线性雾参数 -->
        <template v-if="fogType === 'linear'">
          <div class="property-row">
            <span class="property-label">近距离</span>
            <el-slider
              v-model="fogNear"
              :min="0"
              :max="100"
              :step="1"
              @change="handleLinearFogChange"
            />
            <span class="property-value">{{ fogNear }}</span>
          </div>
          <div class="property-row">
            <span class="property-label">远距离</span>
            <el-slider
              v-model="fogFar"
              :min="10"
              :max="500"
              :step="5"
              @change="handleLinearFogChange"
            />
            <span class="property-value">{{ fogFar }}</span>
          </div>
        </template>

        <!-- 指数雾参数 -->
        <template v-if="fogType === 'exponential'">
          <div class="property-row">
            <span class="property-label">密度</span>
            <el-slider
              v-model="fogDensity"
              :min="0.001"
              :max="0.1"
              :step="0.001"
              @change="handleExponentialFogChange"
            />
            <span class="property-value">{{ fogDensity.toFixed(3) }}</span>
          </div>
        </template>
      </template>
    </div>
  </div>
</template>

<style scoped lang="scss">
.environment-panel {
  padding: 0;
}

.property-section {
  padding: 12px;
  border-bottom: 1px solid var(--el-border-color-lighter);

  &:last-child {
    border-bottom: none;
  }
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;

  .section-title {
    margin-bottom: 0;
  }
}

.section-title {
  display: flex;
  align-items: center;
  gap: 6px;
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

  .el-select {
    flex: 1;
  }

  .el-color-picker {
    margin-left: auto;
  }
}

// HDR 状态
.hdri-status {
  padding: 10px 12px;
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%);
  border: 1px solid rgba(102, 126, 234, 0.3);
  border-radius: 8px;
  margin-bottom: 12px;
}

.hdri-info {
  display: flex;
  align-items: center;
  justify-content: space-between;

  .hdri-label {
    font-size: 13px;
    color: var(--el-color-success);
    font-weight: 500;
  }
}

// HDR 网格
.hdri-section {
  margin-bottom: 12px;
}

.loading-state {
  padding: 12px 0;
}

.empty-state {
  padding: 20px 0;
  text-align: center;

  .empty-icon {
    font-size: 32px;
    margin-bottom: 8px;
  }

  p {
    font-size: 12px;
    color: var(--el-text-color-secondary);
    margin: 0;
  }

  .empty-hint {
    font-size: 11px;
    color: var(--el-text-color-placeholder);
    margin-top: 4px;
  }
}

.hdri-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

.hdri-card {
  cursor: pointer;
  border-radius: 6px;
  overflow: hidden;
  background: var(--el-fill-color-light);
  border: 2px solid transparent;
  transition: all 0.2s;

  &:hover {
    border-color: var(--el-color-primary-light-5);
    transform: translateY(-2px);
  }

  &.active {
    border-color: var(--el-color-primary);
    box-shadow: 0 0 8px rgba(102, 126, 234, 0.4);
  }

  &.loading {
    opacity: 0.6;
    cursor: wait;
  }
}

.hdri-preview {
  width: 100%;
  aspect-ratio: 16/9;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--el-fill-color-darker);
  overflow: hidden;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .el-icon {
    color: var(--el-text-color-placeholder);
  }
}

.hdri-name {
  padding: 4px 6px;
  font-size: 10px;
  color: var(--el-text-color-regular);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-align: center;
}

// 上传按钮
.upload-action {
  padding-top: 8px;
  border-top: 1px dashed var(--el-border-color-lighter);
}
</style>
