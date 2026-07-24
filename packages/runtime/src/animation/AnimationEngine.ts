import * as THREE from 'three'
import type {
  AnimationLoopMode,
  IAnimationClipData,
  IAnimationData,
  IAnimationKeyframeData,
  IAnimationTrackData,
} from '@lowcode3d/shared'
import { EventEmitter } from './EventEmitter'
import { TrackUtils } from './TrackUtils'
import { eventBus } from '../events'

export type AnimationKeyframeValue =
  | THREE.Vector3
  | THREE.Vector2
  | THREE.Quaternion
  | THREE.Color
  | number
  | number[]

export interface KeyframeData {
  time: number
  value: AnimationKeyframeValue
  propertyName?: string
}

export type SerializedKeyframeData = IAnimationKeyframeData
export type TrackData = IAnimationTrackData
export type AnimationData = IAnimationData

export type AnimationClipData = IAnimationClipData

/**
 * AnimationEngine - 核心动画管理系统
 *
 * 职责：
 * 1. 管理全局 AnimationMixer 和所有 AnimationClip
 * 2. 提供时间轴控制（play/pause/stop/seek）
 * 3. 支持自动关键帧记录（Auto-key）
 * 4. 处理关键帧的增删改查
 * 5. 通过事件系统与 UI 通信
 */
export class AnimationEngine extends EventEmitter {
  private static readonly DEFAULT_CLIP_ID = 'default-clip'

  private mixer: THREE.AnimationMixer
  private scene: THREE.Scene
  private objectClips: Map<string, THREE.AnimationClip> = new Map()
  private clips: Map<string, AnimationClipData> = new Map()
  private activeClipId: string = AnimationEngine.DEFAULT_CLIP_ID
  private actions: Map<string, THREE.AnimationAction> = new Map()

  // 播放状态
  private isPlaying: boolean = false
  private currentTime: number = 0
  private duration: number = 10 // 默认 10 秒
  private fps: number = 30

  // 自动关键帧模式
  private autoKeyEnabled: boolean = false

  // 轨道数据缓存：uuid -> propertyName -> KeyframeTrack
  private trackCache: Map<string, Map<string, THREE.KeyframeTrack>> = new Map()
  private trackClipIds: Map<string, string> = new Map()
  private isHydrating: boolean = false

  constructor(scene: THREE.Scene) {
    super()
    this.scene = scene
    this.mixer = new THREE.AnimationMixer(scene)

    // 监听 mixer 的 finished 事件
    this.mixer.addEventListener('finished', () => {
      this.emit('playbackFinished')
      this.isPlaying = false
    })

    this.ensureDefaultClip()
  }

  /**
   * 播放动画
   */
  play(clipId?: string): void {
    if (this.isPlaying) return

    this.isPlaying = true
    this.emit('playStateChanged', { isPlaying: true, clipId })

    // 激活所有 actions
    this.getActionEntriesForClip(clipId).forEach(([, action]) => {
      action.paused = false
      action.play()
    })
  }

  /**
   * 暂停动画
   */
  pause(clipId?: string): void {
    if (!this.isPlaying) return

    this.isPlaying = false
    this.emit('playStateChanged', { isPlaying: false, clipId })

    this.getActionEntriesForClip(clipId).forEach(([, action]) => {
      action.paused = true
    })
  }

  /**
   * 停止动画并重置到起点
   */
  stop(clipId?: string): void {
    this.isPlaying = false
    this.currentTime = 0

    this.getActionEntriesForClip(clipId).forEach(([, action]) => {
      action.stop()
    })

    this.seek(0)
    this.emit('playStateChanged', { isPlaying: false, clipId })
    this.emit('timeChanged', { time: 0 })
  }

  /**
   * 跳转到指定时间点
   * 这是时间轴拖动的核心方法
   *
   * @param time - 目标时间（秒）
   */
  seek(time: number): void {
    time = Math.max(0, Math.min(time, this.duration))
    this.currentTime = time

    // 强制 mixer 更新到指定时间
    this.mixer.setTime(time)

    this.emit('timeChanged', { time })
  }

  /**
   * 更新动画（每帧调用）
   *
   * @param deltaTime - 距离上一帧的时间差（秒）
   */
  update(deltaTime: number): void {
    if (!this.isPlaying) return

    this.currentTime += deltaTime

    // 循环播放
    if (this.currentTime > this.duration) {
      this.currentTime = 0
      this.mixer.setTime(0)
    }

    this.mixer.update(deltaTime)
    this.emit('timeChanged', { time: this.currentTime })
  }

  createClip(name = `动画片段 ${this.clips.size + 1}`): AnimationClipData {
    const clip: AnimationClipData = {
      id: this.createClipId(),
      name,
      duration: this.duration,
      loop: 'repeat',
      autoplay: false,
      enabled: true,
      trackIds: [],
    }

    this.clips.set(clip.id, clip)
    this.activeClipId = clip.id
    this.emitClipsChanged()
    return { ...clip, trackIds: [...clip.trackIds] }
  }

  duplicateClip(clipId = this.activeClipId): AnimationClipData | null {
    const source = this.clips.get(clipId)
    if (!source) return null

    const clip: AnimationClipData = {
      ...source,
      id: this.createClipId(),
      name: `${source.name} 副本`,
      trackIds: [...source.trackIds],
    }

    this.clips.set(clip.id, clip)
    this.activeClipId = clip.id
    this.emitClipsChanged()
    return { ...clip, trackIds: [...clip.trackIds] }
  }

  removeClip(clipId = this.activeClipId): boolean {
    if (this.clips.size <= 1 || !this.clips.has(clipId)) return false

    this.clips.delete(clipId)
    const nextClip = this.clips.keys().next().value
    if (this.activeClipId === clipId && nextClip) {
      this.activeClipId = nextClip
    }
    this.emitClipsChanged()
    return true
  }

  setActiveClip(clipId: string): boolean {
    if (!this.clips.has(clipId)) return false

    this.activeClipId = clipId
    this.syncDurationFromActiveClip()
    this.emit('activeClipChanged', { clipId })
    return true
  }

  getClips(): AnimationClipData[] {
    this.ensureDefaultClip()
    return Array.from(this.clips.values()).map((clip) => ({
      ...clip,
      trackIds: [...clip.trackIds],
    }))
  }

  getActiveClipId(): string {
    this.ensureDefaultClip()
    return this.activeClipId
  }

  updateClip(
    clipId: string,
    patch: Partial<Pick<AnimationClipData, 'name' | 'duration' | 'loop' | 'autoplay' | 'enabled'>>
  ): void {
    const clip = this.clips.get(clipId)
    if (!clip) return

    const nextClip: AnimationClipData = {
      ...clip,
      ...patch,
      duration:
        typeof patch.duration === 'number' && Number.isFinite(patch.duration)
          ? Math.max(0.1, patch.duration)
          : clip.duration,
      loop: this.normalizeLoopMode(patch.loop ?? clip.loop),
      autoplay: patch.autoplay ?? clip.autoplay,
      enabled: patch.enabled ?? clip.enabled,
    }

    this.clips.set(clipId, nextClip)
    if (clipId === this.activeClipId) {
      this.duration = nextClip.duration
      this.emit('durationChanged', { duration: this.duration })
    }
    this.emitClipsChanged()
    eventBus.emit('animation:changed', { reason: 'clip-settings', clipId })
  }

  /**
   * 添加或更新关键帧
   *
   * @param uuid - 对象的唯一标识
   * @param propertyName - 属性名（如 'position', 'rotation', 'scale'）
   * @param time - 时间点（秒）
   * @param value - 属性值（Vector3, Quaternion, Number 等）
   * @param interpolation - 插值类型
   */
  addKeyframe(
    uuid: string,
    propertyName: string,
    time: number,
    value: AnimationKeyframeValue,
    interpolation: THREE.InterpolationModes = THREE.InterpolateLinear
  ): void {
    const object = this.scene.getObjectByProperty('uuid', uuid)
    if (!object) {
      console.warn(`Object with uuid ${uuid} not found`)
      return
    }

    this.ensureDefaultClip()

    // 获取或创建轨道缓存
    if (!this.trackCache.has(uuid)) {
      this.trackCache.set(uuid, new Map())
    }
    const objectTracks = this.trackCache.get(uuid)!

    // 获取现有轨道或创建新轨道
    let track = objectTracks.get(propertyName)

    if (!track) {
      // 创建新轨道
      track = this.createTrack(object, propertyName, [time], [value], interpolation)
      objectTracks.set(propertyName, track)
    } else {
      // 更新现有轨道
      track = TrackUtils.addOrUpdateKeyframe(track, time, value)
      objectTracks.set(propertyName, track)
    }

    const trackId = this.getTrackId(uuid, propertyName)
    this.trackClipIds.set(trackId, this.activeClipId)
    this.addTrackToClip(this.activeClipId, trackId)

    // 重建 AnimationClip
    this.rebuildClip(uuid)

    this.emit('keyframeAdded', { uuid, propertyName, time, value })
    if (!this.isHydrating) {
      eventBus.emit('animation:changed', {
        reason: 'keyframe-added',
        objectId: uuid,
        propertyName,
        clipId: this.activeClipId,
      })
    }
  }

  /**
   * 删除关键帧
   */
  removeKeyframe(uuid: string, propertyName: string, time: number): void {
    const objectTracks = this.trackCache.get(uuid)
    if (!objectTracks) return

    const track = objectTracks.get(propertyName)
    if (!track) return

    const newTrack = TrackUtils.removeKeyframe(track, time)

    if (newTrack.times.length === 0) {
      // 如果轨道为空，删除整个轨道
      objectTracks.delete(propertyName)
      this.removeTrackFromClips(this.getTrackId(uuid, propertyName))
    } else {
      objectTracks.set(propertyName, newTrack)
    }

    this.rebuildClip(uuid)
    this.emit('keyframeRemoved', { uuid, propertyName, time })
    if (!this.isHydrating) {
      eventBus.emit('animation:changed', {
        reason: 'keyframe-removed',
        objectId: uuid,
        propertyName,
      })
    }
  }

  /**
   * 获取指定对象的所有关键帧
   */
  getKeyframes(uuid: string, propertyName?: string): KeyframeData[] {
    const objectTracks = this.trackCache.get(uuid)
    if (!objectTracks) return []

    if (propertyName) {
      const track = objectTracks.get(propertyName)
      return track ? TrackUtils.extractKeyframes(track) : []
    }

    // 返回所有属性的关键帧
    const allKeyframes: KeyframeData[] = []
    objectTracks.forEach((track, prop) => {
      const keyframes = TrackUtils.extractKeyframes(track)
      keyframes.forEach((kf) => {
        allKeyframes.push({ ...kf, propertyName: prop })
      })
    })

    return allKeyframes.sort((a, b) => a.time - b.time)
  }

  /**
   * 创建 KeyframeTrack
   *
   * PropertyMixer 工作原理：
   * - Three.js 的 AnimationMixer 会为每个轨道创建一个 PropertyMixer
   * - PropertyMixer 负责在两个关键帧之间进行插值计算
   * - 当多个轨道影响同一个对象时，mixer 会按顺序应用所有轨道的结果
   * - 例如：position.x, position.y, position.z 可以是三个独立的轨道
   */
  private createTrack(
    object: THREE.Object3D,
    propertyName: string,
    times: number[],
    values: AnimationKeyframeValue[],
    interpolation: THREE.InterpolationModes
  ): THREE.KeyframeTrack {
    const targetProperty = propertyName === 'rotation' ? 'quaternion' : propertyName
    const trackName = `${object.uuid}.${targetProperty}`

    // 将值转换为 flat array
    const flatValues = TrackUtils.flattenValues(values, propertyName)

    // 根据属性类型选择合适的 Track 类型
    let track: THREE.KeyframeTrack

    if (propertyName === 'position' || propertyName === 'scale') {
      track = new THREE.VectorKeyframeTrack(trackName, times, flatValues, interpolation)
    } else if (propertyName === 'rotation') {
      // 注意：rotation 使用 Quaternion 进行插值
      track = new THREE.QuaternionKeyframeTrack(trackName, times, flatValues, interpolation)
    } else if (propertyName.startsWith('material.')) {
      // 材质属性（如 material.opacity, material.color）
      track = new THREE.NumberKeyframeTrack(trackName, times, flatValues, interpolation)
    } else {
      // 默认使用 NumberKeyframeTrack
      track = new THREE.NumberKeyframeTrack(trackName, times, flatValues, interpolation)
    }

    return track
  }

  /**
   * 重建指定对象的 AnimationClip
   */
  private rebuildClip(uuid: string): void {
    const object = this.scene.getObjectByProperty('uuid', uuid)
    if (!object) return

    const objectTracks = this.trackCache.get(uuid)
    if (!objectTracks || objectTracks.size === 0) {
      // 删除 clip
      this.objectClips.delete(uuid)
      this.actions.delete(uuid)
      return
    }

    // 收集所有轨道
    const tracks = Array.from(objectTracks.values())

    // 创建新的 AnimationClip
    const clipName = `${object.name}_animation`
    const clip = new THREE.AnimationClip(clipName, -1, tracks)

    this.objectClips.set(uuid, clip)

    // 创建或更新 AnimationAction
    const existingAction = this.actions.get(uuid)
    if (existingAction) {
      this.mixer.uncacheAction(existingAction.getClip(), object)
    }

    const action = this.mixer.clipAction(clip, object)
    action.clampWhenFinished = true
    action.loop = THREE.LoopRepeat
    this.actions.set(uuid, action)

    // 如果正在播放，立即激活
    if (this.isPlaying) {
      action.play()
    }
  }

  /**
   * 启用/禁用自动关键帧模式
   */
  setAutoKey(enabled: boolean): void {
    this.autoKeyEnabled = enabled
    this.emit('autoKeyChanged', { enabled })
  }

  /**
   * 当对象属性改变时调用（用于自动关键帧）
   */
  onObjectPropertyChanged(uuid: string, propertyName: string, value: AnimationKeyframeValue): void {
    if (!this.autoKeyEnabled) return

    this.addKeyframe(uuid, propertyName, this.currentTime, value)
  }

  /**
   * 设置时间轴总时长
   */
  setDuration(duration: number): void {
    this.duration = Math.max(0.1, duration)
    const clip = this.clips.get(this.activeClipId)
    if (clip) {
      this.clips.set(this.activeClipId, {
        ...clip,
        duration: this.duration,
      })
      this.emitClipsChanged()
    }
    this.emit('durationChanged', { duration: this.duration })
    eventBus.emit('animation:changed', { reason: 'timeline-settings' })
  }

  /**
   * 设置帧率
   */
  setFPS(fps: number): void {
    this.fps = Math.max(1, fps)
    this.emit('fpsChanged', { fps: this.fps })
    eventBus.emit('animation:changed', { reason: 'timeline-settings' })
  }

  /**
   * 时间转帧数
   */
  timeToFrame(time: number): number {
    return Math.round(time * this.fps)
  }

  /**
   * 帧数转时间
   */
  frameToTime(frame: number): number {
    return frame / this.fps
  }

  /**
   * 遍历动画引擎绑定的场景对象，供时间线 UI 收集轨道数据。
   */
  traverseScene(callback: (object: THREE.Object3D) => void): void {
    this.scene.traverse(callback)
  }

  /**
   * 序列化为 JSON
   */
  toJSON(): AnimationData {
    this.ensureDefaultClip()
    const data: AnimationData = {
      duration: this.duration,
      fps: this.fps,
      clips: this.getClips(),
      tracks: [],
    }

    this.trackCache.forEach((objectTracks, uuid) => {
      const object = this.scene.getObjectByProperty('uuid', uuid)
      if (!object) return

      objectTracks.forEach((track, propertyName) => {
        const keyframes = TrackUtils.extractKeyframes(track)
        const trackId = this.getTrackId(uuid, propertyName)
        const clipId = this.trackClipIds.get(trackId) ?? this.activeClipId
        data.tracks.push({
          id: trackId,
          clipId,
          uuid,
          objectName: object.name,
          propertyName,
          targetRef: { objectUuid: uuid },
          keyframes: keyframes.map((keyframe) => ({
            time: keyframe.time,
            value: this.toSerializableValue(keyframe.value),
            propertyName,
          })),
          interpolation: track.getInterpolation(),
          easing: 'linear',
        })
      })
    })

    const trackIds = new Set(data.tracks.map((track) => track.id).filter(Boolean) as string[])
    data.clips = data.clips.map((clip) => ({
      ...clip,
      trackIds: clip.trackIds.filter((trackId) => trackIds.has(trackId)),
    }))

    return data
  }

  /**
   * 从 JSON 加载
   */
  fromJSON(data: AnimationData): void {
    this.clear()

    this.duration = data.duration || 10
    this.fps = data.fps || 30
    this.clips.clear()

    const clips = Array.isArray(data.clips) ? data.clips : []
    clips.forEach((clip) => {
      this.clips.set(clip.id, {
        ...clip,
        duration: clip.duration || this.duration,
        loop: this.normalizeLoopMode(clip.loop),
        autoplay: Boolean(clip.autoplay),
        enabled: clip.enabled !== false,
        trackIds: Array.isArray(clip.trackIds) ? [...clip.trackIds] : [],
      })
    })
    this.ensureDefaultClip()
    this.activeClipId = this.clips.keys().next().value ?? AnimationEngine.DEFAULT_CLIP_ID
    this.syncDurationFromActiveClip()

    this.isHydrating = true
    try {
      if (data.tracks) {
        data.tracks.forEach((trackData: TrackData) => {
          const { uuid, propertyName, keyframes, interpolation } = trackData
          const trackId = trackData.id ?? this.getTrackId(uuid, propertyName)
          const clipId = trackData.clipId ?? this.findClipIdByTrack(trackId)
          const previousActiveClipId = this.activeClipId

          if (clipId && this.clips.has(clipId)) {
            this.activeClipId = clipId
          }

          keyframes.forEach((kf: SerializedKeyframeData) => {
            this.addKeyframe(
              uuid,
              propertyName,
              kf.time,
              kf.value,
              interpolation as THREE.InterpolationModes
            )
          })

          if (clipId) {
            this.trackClipIds.set(trackId, clipId)
            this.addTrackToClip(clipId, trackId)
          }
          this.activeClipId = previousActiveClipId
        })
      }
    } finally {
      this.isHydrating = false
    }

    this.emit('durationChanged', { duration: this.duration })
    this.emit('fpsChanged', { fps: this.fps })
    this.emitClipsChanged()
    this.emit('animationLoaded')
  }

  /**
   * 清空所有动画数据
   */
  clear(): void {
    this.stop()
    this.trackCache.clear()
    this.objectClips.clear()
    this.clips.clear()
    this.trackClipIds.clear()
    this.actions.clear()
    this.mixer.stopAllAction()
    this.mixer.uncacheRoot(this.scene)
    this.activeClipId = AnimationEngine.DEFAULT_CLIP_ID
    this.ensureDefaultClip()
  }

  /**
   * 获取当前状态
   */
  getState() {
    return {
      isPlaying: this.isPlaying,
      currentTime: this.currentTime,
      duration: this.duration,
      fps: this.fps,
      autoKeyEnabled: this.autoKeyEnabled,
      trackCount: this.trackCache.size,
      activeClipId: this.activeClipId,
      clipCount: this.clips.size,
    }
  }

  private ensureDefaultClip(): void {
    if (this.clips.size > 0) return

    this.clips.set(AnimationEngine.DEFAULT_CLIP_ID, {
      id: AnimationEngine.DEFAULT_CLIP_ID,
      name: '默认动画片段',
      duration: this.duration,
      loop: 'repeat',
      autoplay: false,
      enabled: true,
      trackIds: [],
    })
    this.activeClipId = AnimationEngine.DEFAULT_CLIP_ID
  }

  private createClipId(): string {
    return `clip-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
  }

  private getTrackId(uuid: string, propertyName: string): string {
    return `${uuid}:${propertyName}`
  }

  private addTrackToClip(clipId: string, trackId: string): void {
    const clip = this.clips.get(clipId)
    if (!clip || clip.trackIds.includes(trackId)) return

    this.clips.set(clipId, {
      ...clip,
      trackIds: [...clip.trackIds, trackId],
    })
    this.emitClipsChanged()
  }

  private removeTrackFromClips(trackId: string): void {
    this.trackClipIds.delete(trackId)
    let changed = false

    this.clips.forEach((clip, clipId) => {
      if (!clip.trackIds.includes(trackId)) return

      this.clips.set(clipId, {
        ...clip,
        trackIds: clip.trackIds.filter((item) => item !== trackId),
      })
      changed = true
    })

    if (changed) {
      this.emitClipsChanged()
    }
  }

  private findClipIdByTrack(trackId: string): string | undefined {
    for (const clip of this.clips.values()) {
      if (clip.trackIds.includes(trackId)) return clip.id
    }
    return this.activeClipId
  }

  private getActionEntriesForClip(clipId?: string): Array<[string, THREE.AnimationAction]> {
    if (!clipId) return Array.from(this.actions.entries())

    const clip = this.clips.get(clipId)
    if (!clip || !clip.enabled) return []

    const objectIds = new Set(clip.trackIds.map((trackId) => trackId.split(':')[0]).filter(Boolean))
    return Array.from(this.actions.entries()).filter(([uuid]) => objectIds.has(uuid))
  }

  private syncDurationFromActiveClip(): void {
    const clip = this.clips.get(this.activeClipId)
    if (clip) {
      this.duration = clip.duration
    }
  }

  private emitClipsChanged(): void {
    this.emit('clipsChanged', { clips: this.getClips(), activeClipId: this.activeClipId })
  }

  private normalizeLoopMode(loop: AnimationLoopMode | undefined): AnimationLoopMode {
    if (loop === 'once' || loop === 'repeat' || loop === 'pingPong') return loop
    return 'repeat'
  }

  private toSerializableValue(value: AnimationKeyframeValue): number | number[] {
    if (typeof value === 'number') return value
    if (Array.isArray(value)) return value
    if (value instanceof THREE.Vector3) return [value.x, value.y, value.z]
    if (value instanceof THREE.Vector2) return [value.x, value.y]
    if (value instanceof THREE.Quaternion) return [value.x, value.y, value.z, value.w]
    if (value instanceof THREE.Color) return [value.r, value.g, value.b]
    return []
  }

  /**
   * 销毁
   */
  dispose(): void {
    this.clear()
    this.removeAllListeners()
  }
}
