<template>
  <div class="timeline-panel">
    <!-- 控制栏 -->
    <div class="timeline-controls">
      <el-button-group>
        <el-button :icon="isPlaying ? VideoPause : VideoPlay" size="small" @click="togglePlay" />
        <el-button icon="RefreshLeft" size="small" @click="stop" />
        <el-button
          :type="autoKeyEnabled ? 'primary' : 'default'"
          size="small"
          @click="toggleAutoKey"
        >
          自动关键帧
        </el-button>
        <el-button size="small" @click="addKeyframe"> 添加关键帧 (K) </el-button>
      </el-button-group>

      <div class="time-display">
        <span>{{ currentFrame }} / {{ totalFrames }}</span>
        <span class="time-seconds">{{ currentTime.toFixed(2) }}s / {{ duration.toFixed(2) }}s</span>
      </div>

      <div class="clip-controls">
        <el-select
          v-model="activeClipId"
          size="small"
          class="clip-select"
          @change="onActiveClipChange"
        >
          <el-option
            v-for="clip in clipOptions"
            :key="clip.value"
            :label="clip.label"
            :value="clip.value"
          />
        </el-select>
        <el-input
          v-model="activeClipName"
          size="small"
          class="clip-name-input"
          @change="onClipNameChange"
        />
        <el-input-number
          v-model="clipDuration"
          :min="0.1"
          :step="0.5"
          :precision="1"
          size="small"
          class="clip-duration-input"
          @change="onClipDurationChange"
        />
        <el-select
          v-model="activeClipLoop"
          size="small"
          class="clip-loop-select"
          @change="onClipLoopChange"
        >
          <el-option label="一次" value="once" />
          <el-option label="循环" value="repeat" />
          <el-option label="往返" value="pingPong" />
        </el-select>
        <el-switch v-model="activeClipAutoplay" size="small" @change="onClipAutoplayChange" />
        <el-button-group>
          <el-button size="small" @click="createClip">新建</el-button>
          <el-button size="small" @click="duplicateClip">复制</el-button>
          <el-button size="small" :disabled="clipOptions.length <= 1" @click="removeClip"
            >删除</el-button
          >
        </el-button-group>
      </div>

      <div class="fps-control">
        <el-input-number
          v-model="fps"
          :min="1"
          :max="120"
          size="small"
          style="width: 100px"
          @change="onFPSChange"
        />
        <span>FPS</span>
      </div>
    </div>

    <!-- 时间轴 -->
    <div ref="timelineTrack" class="timeline-track" @click="onTimelineClick">
      <!-- 时间刻度 -->
      <div class="timeline-ruler">
        <div
          v-for="tick in timeTicks"
          :key="tick.time"
          class="time-tick"
          :style="{ left: `${(tick.time / duration) * 100}%` }"
        >
          <span class="tick-label">{{ tick.label }}</span>
        </div>
      </div>

      <!-- 关键帧标记 -->
      <div class="keyframe-markers">
        <div
          v-for="(keyframe, index) in keyframes"
          :key="`${keyframe.uuid}-${keyframe.propertyName}-${keyframe.time}-${index}`"
          class="keyframe-marker"
          :class="{ selected: isKeyframeSelected(keyframe) }"
          :style="{ left: `${(keyframe.time / duration) * 100}%` }"
          @click.stop="selectKeyframe(keyframe)"
          @contextmenu.prevent="showKeyframeMenu(keyframe)"
        >
          <div
            class="keyframe-diamond"
            :style="{ backgroundColor: getPropertyColor(keyframe.propertyName) }"
          />
        </div>
      </div>

      <!-- 播放头 -->
      <div
        class="playhead"
        :style="{ left: `${(currentTime / duration) * 100}%` }"
        @mousedown="startDragPlayhead"
      >
        <div class="playhead-line" />
        <div class="playhead-handle" />
      </div>

      <!-- 时间轴滑块 -->
      <el-slider
        v-model="sliderValue"
        :min="0"
        :max="1000"
        :show-tooltip="false"
        class="timeline-slider"
        @input="onSliderInput"
      />
    </div>

    <!-- 属性轨道列表 -->
    <div class="property-tracks">
      <div
        v-for="(track, index) in propertyTracks"
        :key="`${track.uuid}-${track.propertyName}-${index}`"
        class="property-track"
      >
        <div class="track-header">
          <el-icon>
            <VideoPlay />
          </el-icon>
          <span>{{ track.objectName }} - {{ track.propertyName }}</span>
          <el-button text size="small" @click="removeTrack(track)">
            <el-icon>
              <Close />
            </el-icon>
          </el-button>
        </div>
        <div class="track-keyframes">
          <div
            v-for="(kf, kfIndex) in track.keyframes"
            :key="`${kf.time}-${kfIndex}`"
            class="track-keyframe"
            :style="{ left: `${(kf.time / duration) * 100}%` }"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { VideoPlay, VideoPause, Close } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import * as THREE from 'three'
import type {
  AnimationClipData,
  AnimationEngine,
  AnimationKeyframeValue,
  KeyframeData,
} from '@/engine/animation'
import type { AnimationLoopMode } from '@lowcode3d/shared'
import { getCommandBus } from '@/engine/editor'

interface Keyframe {
  time: number
  value: AnimationKeyframeValue
  propertyName: string
  uuid: string
  objectName: string
}

interface Track {
  uuid: string
  objectName: string
  propertyName: string
  keyframes: Keyframe[]
}

// Props
interface Props {
  engine: AnimationEngine | null
  selectedObject?: THREE.Object3D
  active?: boolean
}

const props = defineProps<Props>()
const isActive = computed(() => props.active !== false)

// 状态
const isPlaying = ref(false)
const currentTime = ref(0)
const duration = ref(10)
const fps = ref(30)
const autoKeyEnabled = ref(false)
const sliderValue = ref(0)
const activeClipId = ref('default-clip')
const activeClipName = ref('默认动画片段')
const activeClipLoop = ref<AnimationLoopMode>('repeat')
const activeClipAutoplay = ref(false)
const clipDuration = ref(10)
const clips = ref<AnimationClipData[]>([])

// 关键帧数据
const keyframes = ref<Keyframe[]>([])
const selectedKeyframe = ref<Keyframe | null>(null)
const propertyTracks = ref<Track[]>([])

// 计算属性
const currentFrame = computed(() => {
  return Math.round(currentTime.value * fps.value)
})

const totalFrames = computed(() => {
  return Math.round(duration.value * fps.value)
})

const timeTicks = computed(() => {
  const ticks = []
  const step = duration.value > 10 ? 1 : 0.5
  for (let t = 0; t <= duration.value; t += step) {
    ticks.push({
      time: t,
      label: t.toFixed(1) + 's',
    })
  }
  return ticks
})

const clipOptions = computed(() =>
  clips.value.map((clip) => ({
    label: clip.name,
    value: clip.id,
  }))
)

// 方法
const togglePlay = () => {
  if (!props.engine) return

  if (isPlaying.value) {
    props.engine.pause(activeClipId.value)
  } else {
    props.engine.play(activeClipId.value)
  }
}

const stop = () => {
  if (!props.engine) return
  props.engine.stop(activeClipId.value)
}

const toggleAutoKey = () => {
  if (!props.engine) return
  autoKeyEnabled.value = !autoKeyEnabled.value
  props.engine.setAutoKey(autoKeyEnabled.value)
}

const addKeyframe = () => {
  if (!props.engine || !props.selectedObject) {
    ElMessage.warning('请先选择一个对象')
    return
  }

  const obj = props.selectedObject

  // 记录当前变换
  executeAnimationCommand('添加关键帧', () => {
    props.engine!.addKeyframe(obj.uuid, 'position', currentTime.value, obj.position.clone())
    props.engine!.addKeyframe(obj.uuid, 'rotation', currentTime.value, obj.quaternion.clone())
    props.engine!.addKeyframe(obj.uuid, 'scale', currentTime.value, obj.scale.clone())
  })

  ElMessage.success('关键帧已添加')
}

const onSliderInput = (value: number | number[]) => {
  if (!props.engine) return
  const nextValue = Array.isArray(value) ? value[0] : value
  const time = (nextValue / 1000) * duration.value
  props.engine.seek(time)
}

const onTimelineClick = (event: MouseEvent) => {
  if (!props.engine) return

  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
  const x = event.clientX - rect.left
  const percent = x / rect.width
  const time = percent * duration.value

  props.engine.seek(time)
}

const startDragPlayhead = (event: MouseEvent) => {
  const timelineTrack = (event.currentTarget as HTMLElement | null)?.parentElement
  if (!timelineTrack || !props.engine) return

  const onMouseMove = (e: MouseEvent) => {
    if (!props.engine) return

    const rect = timelineTrack.getBoundingClientRect()
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width))
    const percent = x / rect.width
    const time = percent * duration.value

    props.engine.seek(time)
  }

  const onMouseUp = () => {
    document.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('mouseup', onMouseUp)
  }

  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', onMouseUp)
}

const selectKeyframe = (keyframe: Keyframe) => {
  selectedKeyframe.value = keyframe
}

const isKeyframeSelected = (keyframe: Keyframe) => {
  return selectedKeyframe.value === keyframe
}

const showKeyframeMenu = (keyframe: Keyframe) => {
  console.log('右键菜单', keyframe)
}

const getPropertyColor = (propertyName: string) => {
  const colors: Record<string, string> = {
    position: '#ff6b6b',
    rotation: '#4ecdc4',
    scale: '#ffe66d',
    'material.opacity': '#a8dadc',
  }
  return colors[propertyName] || '#95a5a6'
}

const removeTrack = (track: Track) => {
  if (!props.engine) return

  executeAnimationCommand('删除动画轨道', () => {
    track.keyframes.forEach((kf: Keyframe) => {
      props.engine!.removeKeyframe(track.uuid, track.propertyName, kf.time)
    })
  })
}

const onFPSChange = (value: number | undefined) => {
  if (!props.engine || !value) return
  props.engine.setFPS(value)
}

const createClip = () => {
  if (!props.engine) return
  executeAnimationCommand('新建动画片段', () => {
    props.engine!.createClip()
  })
}

const duplicateClip = () => {
  if (!props.engine) return
  executeAnimationCommand('复制动画片段', () => {
    props.engine!.duplicateClip(activeClipId.value)
  })
}

const removeClip = () => {
  if (!props.engine) return
  executeAnimationCommand('删除动画片段', () => {
    props.engine!.removeClip(activeClipId.value)
  })
}

const onActiveClipChange = (clipId: string | number | boolean | undefined) => {
  if (!props.engine || typeof clipId !== 'string') return
  props.engine.setActiveClip(clipId)
  syncActiveClip()
}

const onClipNameChange = () => {
  updateActiveClip({
    name: activeClipName.value.trim() || '未命名动画片段',
  })
}

const onClipDurationChange = (value: number | undefined) => {
  if (!props.engine || typeof value !== 'number') return
  props.engine.updateClip(activeClipId.value, { duration: value })
}

const onClipLoopChange = (value: string | number | boolean | undefined) => {
  if (value !== 'once' && value !== 'repeat' && value !== 'pingPong') return
  updateActiveClip({ loop: value })
}

const onClipAutoplayChange = (value: string | number | boolean) => {
  updateActiveClip({ autoplay: Boolean(value) })
}

const updateActiveClip = (
  patch: Partial<Pick<AnimationClipData, 'name' | 'duration' | 'loop' | 'autoplay' | 'enabled'>>
) => {
  if (!props.engine) return
  executeAnimationCommand('修改动画片段', () => {
    props.engine!.updateClip(activeClipId.value, patch)
  })
}

const executeAnimationCommand = (name: string, mutator: () => void) => {
  if (!props.engine) return

  getCommandBus().executeAnimationCommand(name, props.engine, mutator)
  refreshClips()
  updateKeyframes()
}

const refreshClips = () => {
  if (!props.engine) {
    clips.value = []
    return
  }

  clips.value = props.engine.getClips()
  activeClipId.value = props.engine.getActiveClipId()
  syncActiveClip()
}

const syncActiveClip = () => {
  const activeClip = clips.value.find((clip) => clip.id === activeClipId.value)
  if (!activeClip) return

  activeClipName.value = activeClip.name
  activeClipLoop.value = activeClip.loop
  activeClipAutoplay.value = activeClip.autoplay
  clipDuration.value = activeClip.duration
  duration.value = activeClip.duration
}

const toTimelineKeyframe = (
  keyframe: KeyframeData,
  object: THREE.Object3D,
  propertyName?: string
): Keyframe | null => {
  const propName = keyframe.propertyName ?? propertyName
  if (!propName) return null

  return {
    time: keyframe.time,
    value: keyframe.value,
    propertyName: propName,
    uuid: object.uuid,
    objectName: object.name || 'Unnamed',
  }
}

const updateKeyframes = () => {
  if (!props.engine) return

  const allKeyframes: Keyframe[] = []
  const tracks: Track[] = []

  // 遍历场景中的所有对象
  const collectKeyframes = (object: THREE.Object3D) => {
    const objectKeyframes = props.engine!.getKeyframes(object.uuid)

    objectKeyframes.forEach((kf) => {
      const keyframe = toTimelineKeyframe(kf, object)
      if (keyframe) {
        allKeyframes.push(keyframe)
      }
    })

    // 按属性分组
    const groupedByProperty = new Map<string, Keyframe[]>()
    objectKeyframes.forEach((kf) => {
      const keyframe = toTimelineKeyframe(kf, object)
      if (!keyframe) return

      if (!groupedByProperty.has(keyframe.propertyName)) {
        groupedByProperty.set(keyframe.propertyName, [])
      }
      groupedByProperty.get(keyframe.propertyName)!.push(keyframe)
    })

    groupedByProperty.forEach((keyframes, propertyName) => {
      tracks.push({
        uuid: object.uuid,
        objectName: object.name || 'Unnamed',
        propertyName,
        keyframes,
      })
    })
  }

  props.engine.traverseScene(collectKeyframes)

  keyframes.value = allKeyframes
  propertyTracks.value = tracks
}

const handleTimeChanged = (data: unknown) => {
  const payload = data as { time?: number }
  if (typeof payload.time !== 'number') return

  currentTime.value = payload.time
  sliderValue.value = (payload.time / duration.value) * 1000
}

const handlePlayStateChanged = (data: unknown) => {
  const payload = data as { isPlaying?: boolean }
  if (typeof payload.isPlaying === 'boolean') {
    isPlaying.value = payload.isPlaying
  }
}

const handleDurationChanged = (data: unknown) => {
  const payload = data as { duration?: number }
  if (typeof payload.duration === 'number') {
    duration.value = payload.duration
    clipDuration.value = payload.duration
  }
}

const handleFPSChanged = (data: unknown) => {
  const payload = data as { fps?: number }
  if (typeof payload.fps === 'number') {
    fps.value = payload.fps
  }
}

const handleClipsChanged = () => {
  refreshClips()
}

const handleActiveClipChanged = (data: unknown) => {
  const payload = data as { clipId?: string }
  if (typeof payload.clipId !== 'string') return
  activeClipId.value = payload.clipId
  refreshClips()
}

// 监听动画引擎事件
const setupEventListeners = () => {
  if (!props.engine) return

  props.engine.on('timeChanged', handleTimeChanged)
  props.engine.on('playStateChanged', handlePlayStateChanged)
  props.engine.on('keyframeAdded', updateKeyframes)
  props.engine.on('keyframeRemoved', updateKeyframes)
  props.engine.on('durationChanged', handleDurationChanged)
  props.engine.on('fpsChanged', handleFPSChanged)
  props.engine.on('clipsChanged', handleClipsChanged)
  props.engine.on('activeClipChanged', handleActiveClipChanged)
  props.engine.on('animationLoaded', updateKeyframes)
}

const cleanupEventListeners = (engine: AnimationEngine | null) => {
  if (!engine) return

  engine.off('timeChanged', handleTimeChanged)
  engine.off('playStateChanged', handlePlayStateChanged)
  engine.off('keyframeAdded', updateKeyframes)
  engine.off('keyframeRemoved', updateKeyframes)
  engine.off('durationChanged', handleDurationChanged)
  engine.off('fpsChanged', handleFPSChanged)
  engine.off('clipsChanged', handleClipsChanged)
  engine.off('activeClipChanged', handleActiveClipChanged)
  engine.off('animationLoaded', updateKeyframes)
}

const handleKeyDown = (e: KeyboardEvent) => {
  if (!isActive.value) return
  const target = e.target as HTMLElement | null
  if (target && ['INPUT', 'TEXTAREA'].includes(target.tagName)) return

  if (e.key === 'k' || e.key === 'K') {
    addKeyframe()
  } else if (e.key === ' ') {
    e.preventDefault()
    togglePlay()
  }
}

// 生命周期
onMounted(() => {
  setupEventListeners()
  refreshClips()
  updateKeyframes()

  window.addEventListener('keydown', handleKeyDown)
})

onUnmounted(() => {
  cleanupEventListeners(props.engine)
  window.removeEventListener('keydown', handleKeyDown)
})

// 监听 engine 变化
watch(
  () => props.engine,
  (engine, oldEngine) => {
    cleanupEventListeners(oldEngine)
    if (!engine) return

    setupEventListeners()
    refreshClips()
    updateKeyframes()
  }
)

// 监听选中对象变化
watch(
  () => props.selectedObject,
  () => {
    updateKeyframes()
  }
)

watch(
  () => isActive.value,
  (active) => {
    if (active) {
      updateKeyframes()
    }
  }
)
</script>

<style scoped lang="scss">
.timeline-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--el-bg-color);
  border-top: 1px solid var(--el-border-color);
}

.timeline-controls {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border-bottom: 1px solid var(--el-border-color);
  flex-wrap: wrap;

  .time-display {
    display: flex;
    flex-direction: column;
    font-size: 12px;

    .time-seconds {
      color: var(--el-text-color-secondary);
      font-size: 11px;
    }
  }

  .fps-control {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
  }
}

.clip-controls {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;

  .clip-select {
    width: 140px;
  }

  .clip-name-input {
    width: 150px;
  }

  .clip-duration-input {
    width: 96px;
  }

  .clip-loop-select {
    width: 92px;
  }
}

.timeline-track {
  position: relative;
  height: 80px;
  background: var(--el-fill-color-light);
  border-bottom: 1px solid var(--el-border-color);
  overflow: hidden;
}

.timeline-ruler {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 24px;
  border-bottom: 1px solid var(--el-border-color-light);

  .time-tick {
    position: absolute;
    height: 100%;
    border-left: 1px solid var(--el-border-color);

    .tick-label {
      position: absolute;
      top: 4px;
      left: 4px;
      font-size: 10px;
      color: var(--el-text-color-secondary);
    }
  }
}

.keyframe-markers {
  position: absolute;
  top: 24px;
  left: 0;
  right: 0;
  height: 32px;
}

.keyframe-marker {
  position: absolute;
  top: 50%;
  transform: translate(-50%, -50%);
  cursor: pointer;
  z-index: 2;

  &.selected .keyframe-diamond {
    transform: rotate(45deg) scale(1.3);
    box-shadow: 0 0 8px rgba(64, 158, 255, 0.8);
  }

  .keyframe-diamond {
    width: 10px;
    height: 10px;
    transform: rotate(45deg);
    transition: all 0.2s;
    border: 1px solid rgba(0, 0, 0, 0.2);

    &:hover {
      transform: rotate(45deg) scale(1.2);
    }
  }
}

.playhead {
  position: absolute;
  top: 0;
  bottom: 0;
  z-index: 3;
  pointer-events: none;

  .playhead-line {
    width: 2px;
    height: 100%;
    background: #409eff;
    margin-left: -1px;
  }

  .playhead-handle {
    position: absolute;
    top: 0;
    left: 50%;
    transform: translateX(-50%);
    width: 12px;
    height: 12px;
    background: #409eff;
    border-radius: 2px;
    cursor: ew-resize;
    pointer-events: all;
  }
}

.timeline-slider {
  position: absolute;
  bottom: 8px;
  left: 12px;
  right: 12px;
  opacity: 0;
}

.property-tracks {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.property-track {
  margin-bottom: 8px;
  border: 1px solid var(--el-border-color);
  border-radius: 4px;
  overflow: hidden;

  .track-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    background: var(--el-fill-color);
    font-size: 12px;

    span {
      flex: 1;
    }
  }

  .track-keyframes {
    position: relative;
    height: 32px;
    background: var(--el-fill-color-light);
  }

  .track-keyframe {
    position: absolute;
    top: 50%;
    width: 8px;
    height: 8px;
    background: #409eff;
    border-radius: 50%;
    transform: translate(-50%, -50%);
    cursor: pointer;

    &:hover {
      transform: translate(-50%, -50%) scale(1.3);
    }
  }
}
</style>
