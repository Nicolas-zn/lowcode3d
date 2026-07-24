import type {
  AnimationLoopMode,
  IAnimationClipData,
  IAnimationData,
  IAnimationTrackData,
  IOriginResources,
  IProjectData,
} from '../types/projectData.js'
import { PROJECT_DATA_VERSION } from '../types/projectData.js'
import type { PostProcessingData, PublishConfig, RuntimeConfig } from '../types/runtime.js'

type UnknownRecord = Record<string, unknown>

const DEFAULT_CAMERA = {
  type: 'perspective' as const,
  position: { x: 5, y: 5, z: 5 },
  target: { x: 0, y: 0, z: 0 },
  fov: 60,
  near: 0.1,
  far: 1000,
}

export function createDefaultRuntimeConfig(partial: Partial<RuntimeConfig> = {}): RuntimeConfig {
  return {
    controls: {
      enabled: partial.controls?.enabled ?? true,
    },
    animations: {
      autoplay: partial.animations?.autoplay ?? true,
    },
    events: {
      enabled: partial.events?.enabled ?? true,
    },
    data: {
      enabled: partial.data?.enabled ?? true,
      useSampleDataInEditor: partial.data?.useSampleDataInEditor ?? true,
    },
  }
}

export function createDefaultPostProcessingData(
  partial: Partial<PostProcessingData> = {}
): PostProcessingData {
  return {
    enabled: partial.enabled ?? false,
    bloom: {
      enabled: partial.bloom?.enabled ?? true,
      strength: partial.bloom?.strength ?? 0.5,
      radius: partial.bloom?.radius ?? 0.4,
      threshold: partial.bloom?.threshold ?? 0.85,
    },
    outline: {
      enabled: partial.outline?.enabled ?? true,
      color: partial.outline?.color ?? '#ffffff',
      thickness: partial.outline?.thickness ?? 2,
    },
    smaa: {
      enabled: partial.smaa?.enabled ?? true,
    },
    toneMapping: {
      type: partial.toneMapping?.type ?? 'aces',
      exposure: partial.toneMapping?.exposure ?? 1,
    },
  }
}

export function createDefaultPublishConfig(partial: Partial<PublishConfig> = {}): PublishConfig {
  return {
    embedDefaults: {
      toolbar: partial.embedDefaults?.toolbar ?? false,
      controls: partial.embedDefaults?.controls ?? true,
      transparent: partial.embedDefaults?.transparent ?? false,
      autoplay: partial.embedDefaults?.autoplay ?? true,
    },
    runtimeVersion: partial.runtimeVersion,
  }
}

export function createDefaultProjectData(partial: Partial<IProjectData> = {}): IProjectData {
  const now = new Date().toISOString()
  const origin = normalizeOrigin(partial.origin)

  return {
    version: PROJECT_DATA_VERSION,
    schemaVersion: PROJECT_DATA_VERSION,
    projectName: partial.projectName ?? 'Untitled Project',
    description: partial.description,
    createdAt: partial.createdAt ?? now,
    updatedAt: partial.updatedAt ?? now,
    origin,
    sceneObjects: partial.sceneObjects ?? [],
    components: partial.components ?? [],
    lights: partial.lights ?? [],
    camera: partial.camera ?? DEFAULT_CAMERA,
    cameraBookmarks: partial.cameraBookmarks ?? [],
    environment: partial.environment ?? { backgroundColor: '#1a1a2e' },
    animations: normalizeAnimationData(partial.animations),
    events: partial.events ?? [],
    dataSources: partial.dataSources ?? [],
    bindings: partial.bindings ?? [],
    runtimeConfig: createDefaultRuntimeConfig(partial.runtimeConfig),
    postProcessing: createDefaultPostProcessingData(partial.postProcessing),
    publishConfig: createDefaultPublishConfig(partial.publishConfig),
    assetManifest: partial.assetManifest,
    userOperations: partial.userOperations,
  }
}

export function migrateProjectData(input: unknown): IProjectData {
  const record = isRecord(input) ? input : {}
  const partial = record as Partial<IProjectData>

  return createDefaultProjectData({
    ...partial,
    version: PROJECT_DATA_VERSION,
    schemaVersion: PROJECT_DATA_VERSION,
    projectName: typeof record.projectName === 'string' ? record.projectName : undefined,
    origin: normalizeOrigin(partial.origin),
    sceneObjects: Array.isArray(record.sceneObjects) ? partial.sceneObjects : [],
    components: Array.isArray(record.components) ? partial.components : [],
    lights: Array.isArray(record.lights) ? partial.lights : [],
    cameraBookmarks: Array.isArray(record.cameraBookmarks) ? partial.cameraBookmarks : [],
    events: Array.isArray(record.events) ? partial.events : [],
    dataSources: Array.isArray(record.dataSources) ? partial.dataSources : [],
    bindings: Array.isArray(record.bindings) ? partial.bindings : [],
    animations: normalizeAnimationData(partial.animations),
    runtimeConfig: isRecord(record.runtimeConfig) ? partial.runtimeConfig : undefined,
    postProcessing: isRecord(record.postProcessing) ? partial.postProcessing : undefined,
    publishConfig: isRecord(record.publishConfig) ? partial.publishConfig : undefined,
  })
}

export function normalizeAnimationData(data?: IAnimationData): IAnimationData | undefined {
  if (!data) return undefined

  const duration = Number.isFinite(data.duration) && data.duration > 0 ? data.duration : 10
  const fps = Number.isFinite(data.fps) && data.fps > 0 ? data.fps : 30
  const sourceTracks = Array.isArray(data.tracks) ? data.tracks : []
  const sourceClips = Array.isArray(data.clips) ? data.clips : []
  const hasClips = sourceClips.length > 0
  const defaultClipId = 'default-clip'
  const normalizedTracks = sourceTracks.map((track, index) =>
    normalizeAnimationTrack(track, index, hasClips ? track.clipId : (track.clipId ?? defaultClipId))
  )
  const tracksById = new Map(normalizedTracks.map((track) => [track.id!, track]))

  let clips: IAnimationClipData[] = sourceClips.map((clip, index) =>
    normalizeAnimationClip(clip, index, duration, tracksById)
  )

  if (clips.length === 0 && normalizedTracks.length > 0) {
    clips = [
      {
        id: defaultClipId,
        name: '默认动画片段',
        duration,
        loop: 'repeat',
        autoplay: false,
        enabled: true,
        trackIds: normalizedTracks.map((track) => track.id!),
      },
    ]
  }

  return {
    duration,
    fps,
    clips,
    tracks: normalizedTracks.map((track) => {
      if (track.clipId) return track
      return {
        ...track,
        clipId: clips[0]?.id,
      }
    }),
  }
}

function normalizeAnimationTrack(
  track: IAnimationTrackData,
  index: number,
  clipId?: string
): IAnimationTrackData {
  const propertyName = track.propertyName || 'position'
  const objectUuid = track.targetRef?.objectUuid || track.uuid
  const id = track.id || `${objectUuid}:${propertyName}:${index}`

  return {
    ...track,
    id,
    clipId,
    targetRef: track.targetRef ?? { objectUuid },
    easing: track.easing ?? 'linear',
    keyframes: Array.isArray(track.keyframes) ? track.keyframes : [],
  }
}

function normalizeAnimationClip(
  clip: IAnimationClipData,
  index: number,
  fallbackDuration: number,
  tracksById: Map<string, IAnimationTrackData>
): IAnimationClipData {
  const id = clip.id || `clip-${index + 1}`
  const trackIds = Array.isArray(clip.trackIds)
    ? clip.trackIds.filter((trackId) => tracksById.has(trackId))
    : []

  return {
    id,
    name: clip.name || `动画片段 ${index + 1}`,
    duration:
      Number.isFinite(clip.duration) && clip.duration > 0 ? clip.duration : fallbackDuration,
    loop: normalizeLoopMode(clip.loop),
    autoplay: Boolean(clip.autoplay),
    enabled: clip.enabled !== false,
    trackIds,
  }
}

function normalizeLoopMode(loop: AnimationLoopMode | undefined): AnimationLoopMode {
  if (loop === 'once' || loop === 'repeat' || loop === 'pingPong') return loop
  return 'repeat'
}

function normalizeOrigin(origin: unknown): IOriginResources {
  if (!isRecord(origin)) {
    return { models: [], textures: [], hdris: [] }
  }

  return {
    models: Array.isArray(origin.models) ? origin.models : [],
    textures: Array.isArray(origin.textures) ? origin.textures : [],
    hdris: Array.isArray(origin.hdris) ? origin.hdris : [],
  } as IOriginResources
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
