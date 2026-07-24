<script setup lang="ts">
/**
 * 视频录制和截图面板
 * 支持录制视频、截图，可选择录制范围（Three.js 画布或全局）
 */
import { ref, computed, onMounted } from 'vue'
import {
  VideoCamera,
  Camera,
  Download,
  Loading,
  Microphone,
  Refresh,
} from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { getEngine } from '@/engine'

// 录制范围类型
type CaptureScope = 'threejs' | 'global'

// 录制状态
const isRecording = ref(false)
const isCapturing = ref(false)

// 截图范围（独立控制）
const screenshotScope = ref<CaptureScope>('threejs')

// 录制范围（独立控制）
const recordingScope = ref<CaptureScope>('threejs')

// 音频捕获选项
const captureAudio = ref(false)

// 麦克风相关状态
const microphoneDevices = ref<MediaDeviceInfo[]>([])
const selectedMicrophone = ref<string>('')
const microphonePermission = ref<'granted' | 'denied' | 'prompt' | 'unknown'>('unknown')
const isCheckingMicrophone = ref(false)

// MediaRecorder 实例
let mediaRecorder: MediaRecorder | null = null
let recordedChunks: Blob[] = []

// 录制范围选项
const scopeOptions = [
  { value: 'threejs', label: 'Three.js 画布' },
  { value: 'global', label: '全局屏幕' },
]

// 是否支持屏幕录制
const supportsScreenCapture = computed(() => {
  return 'mediaDevices' in navigator && 'getDisplayMedia' in navigator.mediaDevices
})

// 是否有可用的麦克风
const hasMicrophone = computed(() => {
  return microphoneDevices.value.length > 0 && microphonePermission.value === 'granted'
})

// 麦克风状态文本
const microphoneStatusText = computed(() => {
  if (isCheckingMicrophone.value) return '检测中...'
  if (microphonePermission.value === 'denied') return '麦克风权限被拒绝'
  if (microphoneDevices.value.length === 0) return '未检测到麦克风设备'
  if (microphonePermission.value === 'granted')
    return `已检测到 ${microphoneDevices.value.length} 个麦克风`
  return '点击检测麦克风'
})

/**
 * 检测麦克风设备和权限
 */
async function checkMicrophoneDevices(): Promise<void> {
  if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
    ElMessage.error('浏览器不支持麦克风检测')
    return
  }

  isCheckingMicrophone.value = true

  try {
    // 首先检查权限状态
    if ('permissions' in navigator) {
      try {
        const permission = await navigator.permissions.query({ name: 'microphone' as any })
        microphonePermission.value = permission.state
      } catch (e) {
        // 某些浏览器可能不支持 permissions API
        console.warn('无法查询麦克风权限状态:', e)
      }
    }

    // 尝试获取麦克风权限（如果还没有的话）
    if (microphonePermission.value !== 'granted') {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        microphonePermission.value = 'granted'
        // 立即停止流，我们只是为了获取权限
        stream.getTracks().forEach((track) => track.stop())
      } catch (error) {
        if (error instanceof Error) {
          if (error.name === 'NotAllowedError') {
            microphonePermission.value = 'denied'
            ElMessage.warning('麦克风权限被拒绝，请在浏览器设置中允许麦克风访问')
          } else if (error.name === 'NotFoundError') {
            microphonePermission.value = 'granted' // 权限OK，但没有设备
            ElMessage.warning('未检测到麦克风设备，请检查设备连接')
          } else {
            ElMessage.error(`麦克风访问失败: ${error.message}`)
          }
        }
        console.error('麦克风权限获取失败:', error)
      }
    }

    // 获取设备列表
    const devices = await navigator.mediaDevices.enumerateDevices()
    const audioInputs = devices.filter((device) => device.kind === 'audioinput')

    microphoneDevices.value = audioInputs

    // 如果有设备但没有选中任何设备，选择第一个
    if (audioInputs.length > 0 && !selectedMicrophone.value) {
      selectedMicrophone.value = audioInputs[0].deviceId
    }

    // 如果没有设备，清空选择
    if (audioInputs.length === 0) {
      selectedMicrophone.value = ''
      captureAudio.value = false
    }
  } catch (error) {
    console.error('检测麦克风设备失败:', error)
    ElMessage.error('检测麦克风设备失败')
  } finally {
    isCheckingMicrophone.value = false
  }
}

/**
 * 获取麦克风设备名称
 */
function getMicrophoneName(device: MediaDeviceInfo): string {
  return device.label || `麦克风 ${device.deviceId.slice(0, 8)}...`
}
function getCanvas(): HTMLCanvasElement | null {
  const engine = getEngine()
  if (!engine?.isInitialized) {
    ElMessage.error('引擎未初始化')
    return null
  }
  return engine.renderManager.renderer.domElement
}

/**
 * 截图
 */
async function handleScreenshot(): Promise<void> {
  if (isCapturing.value) return

  isCapturing.value = true

  try {
    let dataUrl: string

    if (screenshotScope.value === 'threejs') {
      // 截取 Three.js 画布
      const canvas = getCanvas()
      if (!canvas) {
        isCapturing.value = false
        return
      }

      // 确保渲染最新帧
      const engine = getEngine()
      if (engine) {
        engine.renderManager.render(engine.sceneManager.scene, engine.cameraManager.camera)
      }

      dataUrl = canvas.toDataURL('image/png')
    } else {
      // 全局截图（使用屏幕捕获 API）
      if (!supportsScreenCapture.value) {
        ElMessage.error('浏览器不支持屏幕捕获')
        isCapturing.value = false
        return
      }

      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
      })

      // 创建视频元素捕获一帧
      const video = document.createElement('video')
      video.srcObject = stream
      video.play()

      await new Promise((resolve) => {
        video.onloadedmetadata = resolve
      })

      // 等待一帧
      await new Promise((resolve) => setTimeout(resolve, 100))

      // 创建 canvas 捕获当前帧
      const canvas = document.createElement('canvas')
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      const ctx = canvas.getContext('2d')
      ctx?.drawImage(video, 0, 0)

      dataUrl = canvas.toDataURL('image/png')

      // 停止流
      stream.getTracks().forEach((track) => track.stop())
    }

    // 下载图片
    downloadFile(dataUrl, `screenshot-${Date.now()}.png`)
    ElMessage.success('截图成功')
  } catch (error) {
    console.error('Screenshot error:', error)
    if (error instanceof Error && error.name === 'NotAllowedError') {
      ElMessage.warning('用户取消了屏幕捕获')
    } else {
      ElMessage.error('截图失败')
    }
  } finally {
    isCapturing.value = false
  }
}

/**
 * 开始录制
 */
async function handleStartRecording(): Promise<void> {
  if (isRecording.value) return

  try {
    let stream: MediaStream

    if (recordingScope.value === 'threejs') {
      // 录制 Three.js 画布
      const canvas = getCanvas()
      if (!canvas) return

      // 从 canvas 创建流
      stream = canvas.captureStream(30) // 30 FPS
    } else {
      // 全局录制（使用屏幕捕获 API）
      if (!supportsScreenCapture.value) {
        ElMessage.error('浏览器不支持屏幕捕获')
        return
      }

      stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio:
          captureAudio.value && hasMicrophone.value
            ? {
                deviceId: selectedMicrophone.value
                  ? { exact: selectedMicrophone.value }
                  : undefined,
              }
            : false,
      })
    }

    // 创建 MediaRecorder
    recordedChunks = []
    const options = { mimeType: 'video/webm;codecs=vp9' }

    // 尝试不同的编码格式
    if (!MediaRecorder.isTypeSupported(options.mimeType)) {
      options.mimeType = 'video/webm;codecs=vp8'
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        options.mimeType = 'video/webm'
      }
    }

    mediaRecorder = new MediaRecorder(stream, options)

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        recordedChunks.push(event.data)
      }
    }

    mediaRecorder.onstop = () => {
      const blob = new Blob(recordedChunks, { type: 'video/webm' })
      const url = URL.createObjectURL(blob)
      const filename = `recording-${Date.now()}.webm`
      downloadFile(url, filename)

      const audioStatus =
        recordingScope.value === 'global' && captureAudio.value ? '（含音频）' : '（无音频）'
      ElMessage.success(`录制完成 ${audioStatus}`)

      // 清理
      stream.getTracks().forEach((track) => track.stop())
      recordedChunks = []
    }

    mediaRecorder.start()
    isRecording.value = true
    ElMessage.success('开始录制')
  } catch (error) {
    console.error('Recording error:', error)
    if (error instanceof Error && error.name === 'NotAllowedError') {
      ElMessage.warning('用户取消了屏幕捕获')
    } else {
      ElMessage.error('开始录制失败')
    }
  }
}

/**
 * 停止录制
 */
function handleStopRecording(): void {
  if (!isRecording.value || !mediaRecorder) return

  mediaRecorder.stop()
  isRecording.value = false
  mediaRecorder = null
}

/**
 * 下载文件
 */
function downloadFile(url: string, filename: string): void {
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)

  // 清理 URL
  if (url.startsWith('blob:')) {
    setTimeout(() => URL.revokeObjectURL(url), 100)
  }
}

// 组件挂载时检测麦克风
onMounted(() => {
  checkMicrophoneDevices()
})
</script>

<template>
  <div class="video-panel">
    <!-- 截图功能 -->
    <div class="property-section">
      <div class="section-title">
        <el-icon>
          <Camera />
        </el-icon>
        截图
      </div>

      <!-- 截图范围选择 -->
      <div class="property-row">
        <span class="property-label">范围</span>
        <el-radio-group v-model="screenshotScope" size="small">
          <el-radio-button
            v-for="opt in scopeOptions"
            :key="opt.value"
            :value="opt.value"
            :label="opt.value"
          >
            {{ opt.label }}
          </el-radio-button>
        </el-radio-group>
      </div>

      <!-- 截图按钮 -->
      <el-button
        type="primary"
        :icon="isCapturing ? Loading : Camera"
        :loading="isCapturing"
        :disabled="screenshotScope === 'global' && !supportsScreenCapture"
        class="action-button"
        @click="handleScreenshot"
      >
        {{ isCapturing ? '截图中...' : '截图' }}
      </el-button>

      <!-- 截图提示 -->
      <div v-if="screenshotScope === 'global' && !supportsScreenCapture" class="warning-tip">
        <el-alert type="warning" :closable="false" show-icon>
          当前浏览器不支持屏幕捕获功能
        </el-alert>
      </div>
    </div>

    <!-- 视频录制功能 -->
    <div class="property-section">
      <div class="section-title">
        <el-icon>
          <VideoCamera />
        </el-icon>
        视频录制
      </div>

      <!-- 录制范围选择 -->
      <div class="property-row">
        <span class="property-label">范围</span>
        <el-radio-group v-model="recordingScope" size="small" :disabled="isRecording">
          <el-radio-button
            v-for="opt in scopeOptions"
            :key="opt.value"
            :value="opt.value"
            :label="opt.value"
          >
            {{ opt.label }}
          </el-radio-button>
        </el-radio-group>
      </div>

      <!-- 音频捕获选项（仅全局模式显示） -->
      <div v-if="recordingScope === 'global'" class="property-row">
        <div class="audio-section">
          <div class="audio-header">
            <el-checkbox v-model="captureAudio" :disabled="isRecording || !hasMicrophone">
              捕获音频
            </el-checkbox>
            <el-button
              :icon="isCheckingMicrophone ? Loading : Refresh"
              size="small"
              text
              :loading="isCheckingMicrophone"
              @click="checkMicrophoneDevices"
            >
              检测
            </el-button>
          </div>

          <!-- 麦克风状态 -->
          <div class="microphone-status">
            <el-icon>
              <Microphone />
            </el-icon>
            <span
              :class="{
                'status-success': hasMicrophone,
                'status-warning':
                  microphonePermission === 'denied' || microphoneDevices.length === 0,
                'status-info': isCheckingMicrophone,
              }"
            >
              {{ microphoneStatusText }}
            </span>
          </div>

          <!-- 麦克风选择 -->
          <div v-if="hasMicrophone && microphoneDevices.length > 1" class="microphone-select">
            <span class="select-label">选择麦克风:</span>
            <el-select
              v-model="selectedMicrophone"
              size="small"
              :disabled="isRecording"
              placeholder="选择麦克风"
            >
              <el-option
                v-for="device in microphoneDevices"
                :key="device.deviceId"
                :value="device.deviceId"
                :label="getMicrophoneName(device)"
              />
            </el-select>
          </div>

          <!-- 权限提示 -->
          <div v-if="microphonePermission === 'denied'" class="permission-tip">
            <el-alert type="warning" :closable="false" show-icon>
              <template #title> 麦克风权限被拒绝 </template>
              请在浏览器设置中允许麦克风访问，然后点击"检测"重试
            </el-alert>
          </div>

          <div
            v-else-if="!hasMicrophone && microphonePermission === 'granted'"
            class="permission-tip"
          >
            <el-alert type="info" :closable="false" show-icon>
              <template #title> 未检测到麦克风设备 </template>
              请检查麦克风连接，然后点击"检测"重试
            </el-alert>
          </div>
        </div>
      </div>

      <!-- 录制按钮 -->
      <div class="recording-controls">
        <el-button
          v-if="!isRecording"
          type="success"
          :icon="VideoCamera"
          :disabled="recordingScope === 'global' && !supportsScreenCapture"
          class="action-button"
          @click="handleStartRecording"
        >
          开始录制
        </el-button>

        <el-button
          v-else
          type="danger"
          :icon="Download"
          class="action-button recording-button"
          @click="handleStopRecording"
        >
          <span class="recording-indicator"></span>
          停止录制
        </el-button>
      </div>

      <!-- 录制提示 -->
      <div v-if="recordingScope === 'global' && !supportsScreenCapture" class="warning-tip">
        <el-alert type="warning" :closable="false" show-icon>
          当前浏览器不支持屏幕捕获功能
        </el-alert>
      </div>

      <div v-if="isRecording" class="recording-tip">
        <el-alert type="success" :closable="false" show-icon>
          正在录制中，点击"停止录制"完成
        </el-alert>
      </div>
    </div>

    <!-- 使用说明 -->
    <div class="property-section help-section">
      <div class="section-title">使用说明</div>
      <div class="help-content">
        <p><strong>Three.js 画布：</strong></p>
        <ul>
          <li>仅录制/截取 3D 场景画布</li>
          <li>不包含 UI 界面</li>
          <li>性能更好，文件更小</li>
        </ul>
        <p><strong>全局屏幕：</strong></p>
        <ul>
          <li>可选择录制整个屏幕或窗口</li>
          <li>包含所有 UI 元素</li>
          <li>可选择是否捕获系统音频</li>
          <li>需要浏览器权限</li>
        </ul>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.video-panel {
  padding: 0;
}

.property-section {
  padding: 12px;
  border-bottom: 1px solid var(--el-border-color-lighter);

  &:last-child {
    border-bottom: none;
  }

  &.help-section {
    background-color: var(--el-fill-color-light);
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
  margin-bottom: 12px;

  &:last-child {
    margin-bottom: 0;
  }

  .property-label {
    display: block;
    font-size: 11px;
    color: var(--el-text-color-secondary);
    margin-bottom: 6px;
    font-weight: 500;
  }

  .el-radio-group {
    width: 100%;

    .el-radio-button {
      flex: 1;
    }
  }

  .el-checkbox {
    margin-right: 8px;
  }

  .audio-hint {
    font-size: 11px;
    color: var(--el-text-color-placeholder);
    margin-left: 8px;
  }
}

.audio-section {
  width: 100%;

  .audio-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;
  }

  .microphone-status {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    margin-bottom: 8px;
    padding: 6px 8px;
    background-color: var(--el-fill-color-light);
    border-radius: 4px;

    .el-icon {
      font-size: 14px;
    }

    .status-success {
      color: var(--el-color-success);
    }

    .status-warning {
      color: var(--el-color-warning);
    }

    .status-info {
      color: var(--el-color-info);
    }
  }

  .microphone-select {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;

    .select-label {
      font-size: 11px;
      color: var(--el-text-color-secondary);
      white-space: nowrap;
    }

    .el-select {
      flex: 1;
    }
  }

  .permission-tip {
    margin-top: 8px;

    :deep(.el-alert) {
      padding: 8px 12px;

      .el-alert__content {
        font-size: 11px;
      }

      .el-alert__title {
        font-size: 12px;
        font-weight: 500;
      }
    }
  }
}

.action-button {
  width: 100%;
  height: 40px;
  font-size: 14px;
  font-weight: 500;
}

.recording-button {
  position: relative;
  animation: pulse 2s ease-in-out infinite;

  .recording-indicator {
    display: inline-block;
    width: 8px;
    height: 8px;
    background-color: #fff;
    border-radius: 50%;
    margin-right: 8px;
    animation: blink 1s ease-in-out infinite;
  }
}

@keyframes pulse {
  0%,
  100% {
    box-shadow: 0 0 0 0 rgba(245, 108, 108, 0.7);
  }

  50% {
    box-shadow: 0 0 0 8px rgba(245, 108, 108, 0);
  }
}

@keyframes blink {
  0%,
  100% {
    opacity: 1;
  }

  50% {
    opacity: 0.3;
  }
}

.recording-controls {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.warning-tip,
.info-tip,
.recording-tip {
  margin-top: 12px;

  :deep(.el-alert) {
    padding: 8px 12px;

    .el-alert__content {
      font-size: 12px;
    }
  }
}

.help-content {
  font-size: 12px;
  color: var(--el-text-color-regular);
  line-height: 1.6;

  p {
    margin: 0 0 8px 0;

    strong {
      color: var(--el-text-color-primary);
    }
  }

  ul {
    margin: 0 0 12px 0;
    padding-left: 20px;

    &:last-child {
      margin-bottom: 0;
    }

    li {
      margin-bottom: 4px;
      color: var(--el-text-color-secondary);

      &:last-child {
        margin-bottom: 0;
      }
    }
  }
}
</style>
