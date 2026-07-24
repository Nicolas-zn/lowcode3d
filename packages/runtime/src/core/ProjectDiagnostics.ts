import type {
  AssetManifestType,
  ComponentInstance,
  IAssetManifestItem,
  IProjectData,
  ISceneObjectData,
  RuntimeActionConfig,
  DataBindingConfig,
  DataSourceConfig,
} from '@lowcode3d/shared'
import { componentDefinitionRegistry } from '../components'

export type DiagnosticLevel = 'error' | 'warning' | 'info'

export interface ProjectDiagnosticIssue {
  code: string
  level: DiagnosticLevel
  message: string
  count?: number
  suggestion?: string
  targets?: string[]
  details?: Record<string, unknown>
}

export interface PerformanceDiagnosticsStats {
  objectCount?: number
  drawCalls?: number
  triangles?: number
  textureCount?: number
  maxTextureSize?: number
  materialCount?: number
  transparentObjects?: number
  shadowLights?: number
  targets?: Partial<
    Record<
      | 'objectCount'
      | 'drawCalls'
      | 'triangles'
      | 'textureCount'
      | 'maxTextureSize'
      | 'materialCount'
      | 'transparentObjects'
      | 'shadowLights',
      string[]
    >
  >
}

export interface AssetReferenceTarget {
  id?: string
  url?: string
  name?: string
  type?: string
}

export interface AssetReference {
  id: string
  type: AssetManifestType
  name: string
  url?: string
  objectUuid?: string
  source: IAssetManifestItem['source']
  status: IAssetManifestItem['status']
  matchedBy: 'id' | 'url' | 'libraryId' | 'name'
}

/**
 * 项目诊断器
 * 将发布前检查规则从 UI 中剥离，后续可被 Problems、Publish Check 和导出流程复用。
 */
export class ProjectDiagnostics {
  static analyze(projectData: IProjectData): ProjectDiagnosticIssue[] {
    const issues: ProjectDiagnosticIssue[] = []

    issues.push(...this.analyzeAssetManifest(projectData))
    issues.push(...this.analyzeAssetAccess(projectData))
    issues.push(...this.analyzePerformance(projectData))
    issues.push(...this.analyzeAnimations(projectData))
    issues.push(...this.analyzeAnimationClips(projectData))
    issues.push(...this.analyzeComponents(projectData))
    issues.push(...this.analyzeEvents(projectData))
    issues.push(...this.analyzeDataBindings(projectData))

    return issues
  }

  static findAssetReferences(
    projectData: IProjectData,
    target: AssetReferenceTarget
  ): AssetReference[] {
    const candidates = this.createAssetReferenceCandidates(target)
    if (candidates.ids.size === 0 && candidates.urls.size === 0 && candidates.names.size === 0) {
      return []
    }

    const items = projectData.assetManifest?.items ?? this.createFallbackManifestItems(projectData)
    const originMatches = this.findOriginReferenceMatches(projectData, candidates)
    const references: AssetReference[] = []
    const seen = new Set<string>()

    items.forEach((item) => {
      const itemUrl = this.normalizeUrl(item.url)
      let matchedBy: AssetReference['matchedBy'] | null = null

      if (candidates.ids.has(item.id)) {
        matchedBy = 'id'
      } else if (itemUrl && candidates.urls.has(itemUrl)) {
        matchedBy = 'url'
      } else if (originMatches.ids.has(item.id) || (itemUrl && originMatches.urls.has(itemUrl))) {
        matchedBy = 'libraryId'
      } else if (target.url === undefined && candidates.names.has(this.normalizeName(item.name))) {
        matchedBy = 'name'
      }

      if (!matchedBy) return

      const key = `${item.id}:${item.url ?? ''}:${item.objectUuid ?? ''}:${item.source}`
      if (seen.has(key)) return
      seen.add(key)

      references.push({
        id: item.id,
        type: item.type,
        name: item.name,
        url: item.url,
        objectUuid: item.objectUuid,
        source: item.source,
        status: item.status,
        matchedBy,
      })
    })

    return references
  }

  private static analyzeAssetManifest(projectData: IProjectData): ProjectDiagnosticIssue[] {
    const items = projectData.assetManifest?.items ?? []
    const localOnlyAssets = items.filter((item) => item.status === 'localOnly')
    const missingAssets = items.filter((item) => item.status === 'missing')

    const issues: ProjectDiagnosticIssue[] = []

    if (localOnlyAssets.length > 0) {
      issues.push({
        code: 'asset.local_only',
        level: 'warning',
        count: localOnlyAssets.length,
        message: `存在 ${localOnlyAssets.length} 个仅本地可用资源，发布前需要上传或替换`,
      })
    }

    if (missingAssets.length > 0) {
      issues.push({
        code: 'asset.missing',
        level: 'error',
        count: missingAssets.length,
        message: `存在 ${missingAssets.length} 个缺失资源`,
      })
    }

    return issues
  }

  private static analyzeAssetAccess(projectData: IProjectData): ProjectDiagnosticIssue[] {
    const items = projectData.assetManifest?.items ?? this.createFallbackManifestItems(projectData)
    const corsBlockedAssets = items.filter((item) => item.corsStatus === 'blocked')
    const privateAssets = items.filter(
      (item) => item.requiredForPublish && item.publicAccess === 'private'
    )
    const issues: ProjectDiagnosticIssue[] = []

    if (corsBlockedAssets.length > 0) {
      issues.push({
        code: 'asset.cors_blocked',
        level: 'error',
        count: corsBlockedAssets.length,
        message: `存在 ${corsBlockedAssets.length} 个资源可能被跨域策略阻止`,
      })
    }

    if (privateAssets.length > 0) {
      issues.push({
        code: 'asset.public_access_missing',
        level: 'error',
        count: privateAssets.length,
        message: `存在 ${privateAssets.length} 个发布必需资源不可公开访问`,
      })
    }

    return issues
  }

  static analyzePerformance(
    projectData: IProjectData,
    stats: PerformanceDiagnosticsStats = {}
  ): ProjectDiagnosticIssue[] {
    const fallback = this.createPerformanceSnapshot(projectData)
    const snapshot = {
      objectCount: stats.objectCount ?? fallback.objectCount ?? 0,
      drawCalls: stats.drawCalls ?? fallback.drawCalls ?? 0,
      triangles: stats.triangles ?? fallback.triangles ?? 0,
      textureCount: stats.textureCount ?? fallback.textureCount ?? 0,
      maxTextureSize: stats.maxTextureSize ?? fallback.maxTextureSize ?? 0,
      materialCount: stats.materialCount ?? fallback.materialCount ?? 0,
      transparentObjects: stats.transparentObjects ?? fallback.transparentObjects ?? 0,
      shadowLights: stats.shadowLights ?? fallback.shadowLights ?? 0,
      targets: {
        objectCount: stats.targets?.objectCount ?? fallback.targets?.objectCount ?? [],
        drawCalls: stats.targets?.drawCalls ?? fallback.targets?.drawCalls ?? [],
        triangles: stats.targets?.triangles ?? fallback.targets?.triangles ?? [],
        textureCount: stats.targets?.textureCount ?? fallback.targets?.textureCount ?? [],
        maxTextureSize: stats.targets?.maxTextureSize ?? fallback.targets?.maxTextureSize ?? [],
        materialCount: stats.targets?.materialCount ?? fallback.targets?.materialCount ?? [],
        transparentObjects:
          stats.targets?.transparentObjects ?? fallback.targets?.transparentObjects ?? [],
        shadowLights: stats.targets?.shadowLights ?? fallback.targets?.shadowLights ?? [],
      },
    }

    const issues: ProjectDiagnosticIssue[] = []

    const issueConfigs = [
      {
        code: 'performance.object_count_high',
        count: snapshot.objectCount,
        threshold: 200,
        hardThreshold: 500,
        level: snapshot.objectCount >= 500 ? 'error' : 'warning',
        message: `对象数量较高：${snapshot.objectCount}`,
        suggestion: '合并静态对象或拆分大型场景，减少层级和遍历开销。',
        targets: snapshot.targets.objectCount,
      },
      {
        code: 'performance.draw_calls_high',
        count: snapshot.drawCalls,
        threshold: 200,
        hardThreshold: 400,
        level: snapshot.drawCalls >= 400 ? 'error' : 'warning',
        message: `Draw Calls 较高：${snapshot.drawCalls}`,
        suggestion: '合并材质相近的网格，减少动态材质切换。',
        targets: snapshot.targets.drawCalls,
      },
      {
        code: 'performance.triangles_high',
        count: snapshot.triangles,
        threshold: 800_000,
        hardThreshold: 2_000_000,
        level: snapshot.triangles >= 2_000_000 ? 'error' : 'warning',
        message: `三角面数量较高：${snapshot.triangles.toLocaleString()}`,
        suggestion: '优先做 LOD、简化网格或启用 Draco 压缩。',
        targets: snapshot.targets.triangles,
      },
      {
        code: 'performance.texture_count_high',
        count: snapshot.textureCount,
        threshold: 40,
        hardThreshold: 100,
        level: snapshot.textureCount >= 100 ? 'error' : 'warning',
        message: `纹理数量较高：${snapshot.textureCount}`,
        suggestion: '合并重复贴图，减少同屏贴图切换。',
        targets: snapshot.targets.textureCount,
      },
      {
        code: 'performance.texture_size_high',
        count: snapshot.maxTextureSize,
        threshold: 2048,
        hardThreshold: 4096,
        level: snapshot.maxTextureSize >= 4096 ? 'error' : 'warning',
        message: `最大纹理尺寸较高：${snapshot.maxTextureSize}px`,
        suggestion: '对大贴图做下采样，控制在 2K 或更低。',
        targets: snapshot.targets.maxTextureSize,
      },
      {
        code: 'performance.material_count_high',
        count: snapshot.materialCount,
        threshold: 40,
        hardThreshold: 100,
        level: snapshot.materialCount >= 100 ? 'error' : 'warning',
        message: `材质数量较高：${snapshot.materialCount}`,
        suggestion: '抽取公共材质或合并相近材质，减少变体数量。',
        targets: snapshot.targets.materialCount,
      },
      {
        code: 'performance.transparent_object_high',
        count: snapshot.transparentObjects,
        threshold: 12,
        hardThreshold: 30,
        level: snapshot.transparentObjects >= 30 ? 'error' : 'warning',
        message: `透明物体较多：${snapshot.transparentObjects}`,
        suggestion: '尽量减少大面积透明物体，优先使用不透明贴图或分层方案。',
        targets: snapshot.targets.transparentObjects,
      },
      {
        code: 'performance.shadow_light_high',
        count: snapshot.shadowLights,
        threshold: 2,
        hardThreshold: 6,
        level: snapshot.shadowLights >= 6 ? 'error' : 'warning',
        message: `投射阴影的灯光较多：${snapshot.shadowLights}`,
        suggestion: '仅保留关键灯光开启阴影，其余灯光关闭 castShadow。',
        targets: snapshot.targets.shadowLights,
      },
    ] as const

    issueConfigs.forEach((config) => {
      if (config.count === undefined || config.count <= config.threshold) return

      issues.push({
        code: config.code,
        level: config.level,
        count: config.count,
        message: config.message,
        suggestion: config.suggestion,
        targets: config.targets,
        details: {
          threshold: config.threshold,
          hardThreshold: config.hardThreshold,
          metric: config.code,
        },
      })
    })

    return issues
  }

  private static analyzeAnimations(projectData: IProjectData): ProjectDiagnosticIssue[] {
    const animatedObjectIds = new Set(
      projectData.animations?.tracks.map((track) => track.uuid) ?? []
    )
    const sceneObjectIds = new Set<string>()

    this.collectSceneObjectIds(projectData.sceneObjects, sceneObjectIds)

    const orphanTracks = Array.from(animatedObjectIds).filter((id) => !sceneObjectIds.has(id))
    if (orphanTracks.length === 0) return []

    return [
      {
        code: 'animation.orphan_track',
        level: 'warning',
        count: orphanTracks.length,
        message: `存在 ${orphanTracks.length} 个动画轨道未绑定到场景对象`,
      },
    ]
  }

  private static analyzeAnimationClips(projectData: IProjectData): ProjectDiagnosticIssue[] {
    const animations = projectData.animations
    if (!animations) return []

    const issues: ProjectDiagnosticIssue[] = []
    const clips = animations.clips ?? []
    const tracks = animations.tracks ?? []
    const objectIds = this.createProjectObjectIdSet(projectData)
    const seenClipIds = new Set<string>()
    const duplicateClipIds = new Set<string>()

    clips.forEach((clip) => {
      if (seenClipIds.has(clip.id)) {
        duplicateClipIds.add(clip.id)
      }
      seenClipIds.add(clip.id)
    })

    const emptyClips = clips.filter((clip) => clip.trackIds.length === 0)
    const missingTargetTracks = tracks.filter((track) => {
      const targetId = track.targetRef?.objectUuid ?? track.uuid
      return !objectIds.has(targetId)
    })
    const unsupportedPropertyTracks = tracks.filter(
      (track) => !this.isSupportedAnimationProperty(track.propertyName)
    )

    if (emptyClips.length > 0) {
      issues.push({
        code: 'animation.clip_empty',
        level: 'warning',
        count: emptyClips.length,
        message: `存在 ${emptyClips.length} 个空动画片段`,
      })
    }

    if (duplicateClipIds.size > 0) {
      issues.push({
        code: 'animation.clip_duplicate',
        level: 'error',
        count: duplicateClipIds.size,
        message: `存在 ${duplicateClipIds.size} 个重复动画片段 ID`,
      })
    }

    if (missingTargetTracks.length > 0) {
      issues.push({
        code: 'animation.target_missing',
        level: 'error',
        count: missingTargetTracks.length,
        message: `存在 ${missingTargetTracks.length} 个动画轨道目标对象不存在`,
      })
    }

    if (unsupportedPropertyTracks.length > 0) {
      issues.push({
        code: 'animation.property_unsupported',
        level: 'warning',
        count: unsupportedPropertyTracks.length,
        message: `存在 ${unsupportedPropertyTracks.length} 个动画属性路径不受支持`,
      })
    }

    return issues
  }

  private static isSupportedAnimationProperty(propertyName: string): boolean {
    return new Set([
      'position',
      'rotation',
      'scale',
      'visible',
      'material.opacity',
      'material.color',
    ]).has(propertyName)
  }

  private static analyzeComponents(projectData: IProjectData): ProjectDiagnosticIssue[] {
    const components = projectData.components ?? []
    if (components.length === 0) return []

    const issues: ProjectDiagnosticIssue[] = []
    const unknownComponents = components.filter(
      (component) => !componentDefinitionRegistry.get(component.type)
    )
    const missingAssetComponents = components.filter((component) =>
      this.hasMissingComponentAsset(component)
    )

    if (unknownComponents.length > 0) {
      issues.push({
        code: 'component.unknown',
        level: 'warning',
        count: unknownComponents.length,
        message: `存在 ${unknownComponents.length} 个未知组件定义`,
      })
    }

    if (missingAssetComponents.length > 0) {
      issues.push({
        code: 'component.asset_missing',
        level: 'warning',
        count: missingAssetComponents.length,
        message: `存在 ${missingAssetComponents.length} 个组件缺少必要资源`,
      })
    }

    return issues
  }

  private static hasMissingComponentAsset(component: ComponentInstance): boolean {
    const definition = componentDefinitionRegistry.get(component.type)
    if (!definition?.capabilities.includes('assetDependent')) {
      return false
    }

    const props = component.props ?? {}
    const assetKeys = definition.properties
      .filter((property) => property.type === 'asset' && property.required)
      .map((property) => property.key)

    return assetKeys.some((key) => {
      const value = props[key]
      return typeof value !== 'string' || value.trim() === ''
    })
  }

  private static analyzeEvents(projectData: IProjectData): ProjectDiagnosticIssue[] {
    const events = projectData.events ?? []
    if (events.length === 0) return []

    const issues: ProjectDiagnosticIssue[] = []
    const objectIds = this.createProjectObjectIdSet(projectData)
    const missingTargets = events.filter((event) => !objectIds.has(event.objectUuid))
    const invalidActions = events.flatMap((event) =>
      event.actions.filter((action) => this.isInvalidEventAction(action, objectIds))
    )
    const missingCameraBookmarks = events.flatMap((event) =>
      event.actions.filter((action) => this.isMissingCameraBookmarkAction(action, projectData))
    )

    if (missingTargets.length > 0) {
      issues.push({
        code: 'event.target_missing',
        level: 'error',
        count: missingTargets.length,
        message: `存在 ${missingTargets.length} 个事件绑定的对象不存在`,
      })
    }

    if (invalidActions.length > 0) {
      issues.push({
        code: 'event.action_invalid',
        level: 'error',
        count: invalidActions.length,
        message: `存在 ${invalidActions.length} 个事件动作参数无效`,
      })
    }

    if (missingCameraBookmarks.length > 0) {
      issues.push({
        code: 'event.camera_bookmark_missing',
        level: 'error',
        count: missingCameraBookmarks.length,
        message: `存在 ${missingCameraBookmarks.length} 个切换相机动作引用了不存在的书签`,
      })
    }

    return issues
  }

  private static isInvalidEventAction(
    action: RuntimeActionConfig,
    objectIds: Set<string>
  ): boolean {
    if (!action.enabled) return false

    switch (action.type) {
      case 'openUrl':
        return !this.isValidUrl(action.payload.url)
      case 'playAnimation':
      case 'pauseAnimation':
        return false
      case 'switchCamera':
        return false
      case 'setObjectVisible':
      case 'setObjectMaterial': {
        const targetId = String(action.payload.objectUuid ?? action.payload.objectId ?? '')
        return !targetId || !objectIds.has(targetId)
      }
      case 'showPopup':
        return typeof action.payload.content !== 'string' || action.payload.content.trim() === ''
      case 'emitMessage':
        return typeof action.payload.name !== 'string' || action.payload.name.trim() === ''
      default:
        return true
    }
  }

  private static isMissingCameraBookmarkAction(
    action: RuntimeActionConfig,
    projectData: IProjectData
  ): boolean {
    if (!action.enabled || action.type !== 'switchCamera') return false

    const bookmarkId = String(action.payload.bookmarkId ?? '')
    if (!bookmarkId) return true
    return !projectData.cameraBookmarks.some((bookmark) => bookmark.id === bookmarkId)
  }

  private static isValidUrl(value: unknown): boolean {
    if (typeof value !== 'string' || value.trim() === '') return false

    try {
      const url = new URL(value)
      return url.protocol === 'http:' || url.protocol === 'https:'
    } catch {
      return false
    }
  }

  private static analyzeDataBindings(projectData: IProjectData): ProjectDiagnosticIssue[] {
    const issues: ProjectDiagnosticIssue[] = []
    const dataSources = projectData.dataSources ?? []
    const bindings = projectData.bindings ?? []
    const sourceIds = new Set(dataSources.map((source) => source.id))
    const objectIds = this.createProjectObjectIdSet(projectData)

    const missingSourceBindings = bindings.filter((binding) => !sourceIds.has(binding.sourceId))
    const missingTargetBindings = bindings.filter((binding) => !objectIds.has(binding.objectUuid))
    const invalidPropertyBindings = bindings.filter((binding) => !this.isBindableProperty(binding))
    const invalidTransformBindings = bindings.filter((binding) => !this.isValidTransform(binding))
    const invalidHttpSources = dataSources.filter((source) => this.isInvalidHttpDataSource(source))

    if (missingSourceBindings.length > 0) {
      issues.push({
        code: 'data_source.missing',
        level: 'error',
        count: missingSourceBindings.length,
        message: `存在 ${missingSourceBindings.length} 个绑定引用了不存在的数据源`,
      })
    }

    if (missingTargetBindings.length > 0) {
      issues.push({
        code: 'binding.target_missing',
        level: 'error',
        count: missingTargetBindings.length,
        message: `存在 ${missingTargetBindings.length} 个绑定目标对象不存在`,
      })
    }

    if (invalidPropertyBindings.length > 0) {
      issues.push({
        code: 'binding.property_not_bindable',
        level: 'warning',
        count: invalidPropertyBindings.length,
        message: `存在 ${invalidPropertyBindings.length} 个绑定属性不在白名单内`,
      })
    }

    if (invalidTransformBindings.length > 0) {
      issues.push({
        code: 'binding.transform_invalid',
        level: 'warning',
        count: invalidTransformBindings.length,
        message: `存在 ${invalidTransformBindings.length} 个绑定转换配置无效`,
      })
    }

    if (invalidHttpSources.length > 0) {
      issues.push({
        code: 'data_source.http_url_invalid',
        level: 'error',
        count: invalidHttpSources.length,
        message: `存在 ${invalidHttpSources.length} 个 HTTP 数据源 URL 无效`,
      })
    }

    return issues
  }

  private static isInvalidHttpDataSource(source: DataSourceConfig): boolean {
    if (!source.enabled || source.type !== 'http') return false
    return !this.isValidUrl(source.config.url)
  }

  private static isBindableProperty(binding: DataBindingConfig): boolean {
    return new Set([
      'visible',
      'position.x',
      'position.y',
      'position.z',
      'scale.x',
      'scale.y',
      'scale.z',
      'material.color',
      'material.opacity',
      'userData.label',
      'component.props.label',
      'component.props.statusColor',
    ]).has(binding.propertyPath)
  }

  private static isValidTransform(binding: DataBindingConfig): boolean {
    const transform = binding.transform
    if (!transform || transform.type === 'identity') return true

    if (transform.type === 'numberRange') {
      const min = Number(transform.options?.min ?? 0)
      const max = Number(transform.options?.max ?? 1)
      return Number.isFinite(min) && Number.isFinite(max) && min <= max
    }

    if (transform.type === 'formatText') {
      return (
        transform.options?.template === undefined || typeof transform.options.template === 'string'
      )
    }

    if (transform.type === 'mapValue') {
      return (
        transform.options?.map === undefined ||
        (typeof transform.options.map === 'object' && transform.options.map !== null)
      )
    }

    return true
  }

  private static createProjectObjectIdSet(projectData: IProjectData): Set<string> {
    const objectIds = new Set<string>()
    this.collectSceneObjectIds(projectData.sceneObjects, objectIds)
    projectData.lights.forEach((light) => objectIds.add(light.uuid))
    return objectIds
  }

  private static createPerformanceSnapshot(projectData: IProjectData): PerformanceDiagnosticsStats {
    const objectNames = this.collectRenderableNames(projectData.sceneObjects)
    const transparentObjects = this.collectTransparentObjectNames(projectData.sceneObjects)
    const shadowLights = projectData.lights
      .filter((light) => light.castShadow)
      .map((light) => light.name)
    const textureNames = [
      ...projectData.origin.textures.map((texture) => texture.name),
      ...projectData.origin.hdris.map((hdri) => hdri.name),
      ...this.collectBillboardNames(projectData.sceneObjects),
    ]
    const maxTextureSize = this.getLargestTextureSize(projectData)

    return {
      objectCount: this.countSceneObjects(projectData.sceneObjects) + projectData.lights.length,
      drawCalls: Math.max(objectNames.length * 2, objectNames.length + shadowLights.length),
      triangles: this.estimateTriangleCount(projectData.sceneObjects),
      textureCount: textureNames.length,
      maxTextureSize,
      materialCount: this.countMaterialVariants(projectData.sceneObjects),
      transparentObjects: transparentObjects.length,
      shadowLights: shadowLights.length,
      targets: {
        objectCount: objectNames,
        drawCalls: objectNames,
        triangles: this.collectTriangleTargets(projectData.sceneObjects),
        textureCount: textureNames,
        maxTextureSize: this.collectTextureTargets(projectData),
        materialCount: this.collectMaterialTargets(projectData.sceneObjects),
        transparentObjects,
        shadowLights,
      },
    }
  }

  private static countSceneObjects(objects: ISceneObjectData[]): number {
    let count = 0

    objects.forEach((object) => {
      count += 1
      if (object.children?.length) {
        count += this.countSceneObjects(object.children)
      }
    })

    return count
  }

  private static collectRenderableNames(objects: ISceneObjectData[]): string[] {
    const names: string[] = []

    objects.forEach((object) => {
      if (object.visible !== false) {
        names.push(object.name)
      }

      if (object.children?.length) {
        names.push(...this.collectRenderableNames(object.children))
      }
    })

    return names.filter(Boolean).slice(0, 12)
  }

  private static collectBillboardNames(objects: ISceneObjectData[]): string[] {
    const names: string[] = []

    objects.forEach((object) => {
      if (object.type === 'billboard') {
        names.push(object.name)
      }

      if (object.children?.length) {
        names.push(...this.collectBillboardNames(object.children))
      }
    })

    return names.filter(Boolean).slice(0, 12)
  }

  private static collectTransparentObjectNames(objects: ISceneObjectData[]): string[] {
    const names: string[] = []

    objects.forEach((object) => {
      const overrides = object.materialOverrides
      if (
        overrides &&
        (overrides.transparent || (overrides.opacity !== undefined && overrides.opacity < 1))
      ) {
        names.push(object.name)
      }

      if (object.children?.length) {
        names.push(...this.collectTransparentObjectNames(object.children))
      }
    })

    return names.filter(Boolean).slice(0, 12)
  }

  private static collectMaterialTargets(objects: ISceneObjectData[]): string[] {
    const names: string[] = []

    objects.forEach((object) => {
      if (object.materialOverrides) {
        names.push(object.name)
      }

      if (object.children?.length) {
        names.push(...this.collectMaterialTargets(object.children))
      }
    })

    return names.filter(Boolean).slice(0, 12)
  }

  private static collectTriangleTargets(objects: ISceneObjectData[]): string[] {
    const names: string[] = []

    objects.forEach((object) => {
      if (object.type === 'model' || object.type === 'primitive' || object.type === 'mesh') {
        names.push(object.name)
      }

      if (object.children?.length) {
        names.push(...this.collectTriangleTargets(object.children))
      }
    })

    return names.filter(Boolean).slice(0, 12)
  }

  private static collectTextureTargets(projectData: IProjectData): string[] {
    const names = [
      ...projectData.origin.textures.map((texture) => texture.name),
      ...projectData.origin.hdris.map((hdri) => hdri.name),
    ]

    return Array.from(new Set(names.filter(Boolean))).slice(0, 12)
  }

  private static estimateTriangleCount(objects: ISceneObjectData[]): number {
    return objects.reduce((total, object) => {
      let next = total
      switch (object.type) {
        case 'primitive':
          next += this.getPrimitiveTriangleEstimate(object.primitiveType)
          break
        case 'model':
        case 'userModel':
          next += object.children?.length ? object.children.length * 24 : 2000
          break
        case 'billboard':
          next += 2
          break
        case 'mesh':
          next += 12
          break
      }

      if (object.children?.length) {
        next += this.estimateTriangleCount(object.children)
      }

      return next
    }, 0)
  }

  private static getPrimitiveTriangleEstimate(
    primitiveType: ISceneObjectData['primitiveType'] | 'cube'
  ): number {
    switch (primitiveType) {
      case 'box':
      case 'cube':
        return 12
      case 'sphere':
        return 48
      case 'cylinder':
      case 'cone':
        return 32
      case 'torus':
        return 96
      case 'plane':
      case 'circle':
      case 'ring':
        return 2
      case 'tetrahedron':
        return 4
      case 'octahedron':
        return 8
      case 'icosahedron':
        return 20
      case 'dodecahedron':
        return 36
      default:
        return 12
    }
  }

  private static countMaterialVariants(objects: ISceneObjectData[]): number {
    const materialKeys = new Set<string>()

    const walk = (items: ISceneObjectData[]): void => {
      items.forEach((object) => {
        if (object.materialOverrides) {
          materialKeys.add(
            [
              object.materialOverrides.presetId ?? '',
              object.materialOverrides.color ?? '',
              object.materialOverrides.metalness ?? '',
              object.materialOverrides.roughness ?? '',
              object.materialOverrides.opacity ?? '',
              object.materialOverrides.transparent ?? '',
              object.materialOverrides.emissive ?? '',
              object.materialOverrides.emissiveIntensity ?? '',
            ].join('|')
          )
        }

        if (object.children?.length) {
          walk(object.children)
        }
      })
    }

    walk(objects)
    return materialKeys.size
  }

  private static getLargestTextureSize(projectData: IProjectData): number {
    const sizes = [
      ...projectData.origin.textures.map((texture) => this.getTextureSizeFromUrl(texture.url)),
      ...projectData.origin.hdris.map((hdri) => this.getTextureSizeFromUrl(hdri.url)),
    ]

    return sizes.reduce((max, size) => Math.max(max, size), 0) || (sizes.length > 0 ? 2048 : 0)
  }

  private static getTextureSizeFromUrl(url: string): number {
    if (!url) return 0
    if (/4096|4k/i.test(url)) return 4096
    if (/2048|2k/i.test(url)) return 2048
    if (/1024|1k/i.test(url)) return 1024
    return 2048
  }

  private static collectSceneObjectIds(objects: ISceneObjectData[], output: Set<string>): void {
    objects.forEach((object) => {
      output.add(object.uuid)
      if (object.children?.length) {
        this.collectSceneObjectIds(object.children, output)
      }
    })
  }

  private static createAssetReferenceCandidates(target: AssetReferenceTarget) {
    const ids = new Set<string>()
    const urls = new Set<string>()
    const names = new Set<string>()

    if (target.id) {
      ids.add(target.id)
      ids.add(`server-${target.id}`)
    }

    const normalizedUrl = this.normalizeUrl(target.url)
    if (normalizedUrl) {
      urls.add(normalizedUrl)
    }

    const normalizedName = this.normalizeName(target.name)
    if (normalizedName) {
      names.add(normalizedName)
    }

    return { ids, urls, names }
  }

  private static findOriginReferenceMatches(
    projectData: IProjectData,
    candidates: ReturnType<typeof ProjectDiagnostics.createAssetReferenceCandidates>
  ) {
    const ids = new Set<string>()
    const urls = new Set<string>()

    projectData.origin.models.forEach((model) => {
      const modelUrl = this.normalizeUrl(model.url)
      const libraryId = model.libraryId

      if (
        candidates.ids.has(model.id) ||
        (libraryId !== undefined && candidates.ids.has(libraryId)) ||
        (modelUrl && candidates.urls.has(modelUrl))
      ) {
        ids.add(model.id)
        if (modelUrl) urls.add(modelUrl)
      }
    })

    projectData.origin.hdris.forEach((hdri) => {
      const hdriUrl = this.normalizeUrl(hdri.url)
      if (candidates.ids.has(hdri.id) || (hdriUrl && candidates.urls.has(hdriUrl))) {
        ids.add(hdri.id)
        if (hdriUrl) urls.add(hdriUrl)
      }
    })

    return { ids, urls }
  }

  private static createFallbackManifestItems(projectData: IProjectData): IAssetManifestItem[] {
    const items: IAssetManifestItem[] = []

    projectData.origin.models.forEach((model) => {
      items.push({
        id: model.id,
        type: model.url.startsWith('__primitive__:') ? 'unknown' : 'model',
        name: model.name,
        url: model.url,
        source: 'origin',
        usage: ['scene'],
        referencedBy: [],
        requiredForPublish: !model.url.startsWith('__primitive__:'),
        status: model.url.startsWith('__primitive__:')
          ? 'embedded'
          : this.getAssetStatus(model.url),
        publicAccess: this.getPublicAccess(model.url),
        corsStatus: this.getCorsStatus(model.url),
      })
    })

    projectData.origin.hdris.forEach((hdri) => {
      items.push({
        id: hdri.id,
        type: 'hdri',
        name: hdri.name,
        url: hdri.url,
        source: 'origin',
        usage: ['environment'],
        referencedBy: [],
        requiredForPublish: true,
        status: this.getAssetStatus(hdri.url),
        publicAccess: this.getPublicAccess(hdri.url),
        corsStatus: this.getCorsStatus(hdri.url),
      })
    })

    this.collectSceneAssetItems(projectData.sceneObjects, items)

    return items
  }

  private static collectSceneAssetItems(
    objects: ISceneObjectData[],
    output: IAssetManifestItem[]
  ): void {
    objects.forEach((object) => {
      if (object.type === 'userModel' && object.importedFileName) {
        output.push({
          id: object.uuid || object.importedFileName,
          type: 'localModel',
          name: object.name,
          source: 'sceneObject',
          usage: ['sceneObject'],
          referencedBy: [object.uuid],
          requiredForPublish: false,
          status: 'localOnly',
          objectUuid: object.uuid,
          publicAccess: 'private',
          corsStatus: 'unknown',
        })
      }

      if (object.type === 'billboard' && object.billboardData) {
        output.push({
          id: `${object.uuid}:billboard:texture`,
          type: object.billboardData.isVideo ? 'video' : 'billboard',
          name: object.name,
          url: object.billboardData.texture,
          source: 'sceneObject',
          usage: ['billboard.texture'],
          referencedBy: [object.uuid],
          requiredForPublish: true,
          status: this.getAssetStatus(object.billboardData.texture),
          objectUuid: object.uuid,
          publicAccess: this.getPublicAccess(object.billboardData.texture),
          corsStatus: this.getCorsStatus(object.billboardData.texture),
        })

        if (object.billboardData.backTexture) {
          output.push({
            id: `${object.uuid}:billboard:backTexture`,
            type: 'texture',
            name: `${object.name} 背面纹理`,
            url: object.billboardData.backTexture,
            source: 'sceneObject',
            usage: ['billboard.backTexture'],
            referencedBy: [object.uuid],
            requiredForPublish: true,
            status: this.getAssetStatus(object.billboardData.backTexture),
            objectUuid: object.uuid,
            publicAccess: this.getPublicAccess(object.billboardData.backTexture),
            corsStatus: this.getCorsStatus(object.billboardData.backTexture),
          })
        }
      }

      if (object.children?.length) {
        this.collectSceneAssetItems(object.children, output)
      }
    })
  }

  private static getAssetStatus(url?: string): IAssetManifestItem['status'] {
    if (!url) return 'missing'
    if (
      url.startsWith('blob:') ||
      url.startsWith('data:') ||
      url.includes('localhost') ||
      url.includes('127.0.0.1')
    ) {
      return url.startsWith('data:') ? 'embedded' : 'localOnly'
    }
    return 'ready'
  }

  private static getPublicAccess(url?: string): NonNullable<IAssetManifestItem['publicAccess']> {
    if (!url) return 'unknown'
    if (url.startsWith('blob:') || url.includes('localhost') || url.includes('127.0.0.1')) {
      return 'private'
    }
    if (url.startsWith('data:') || url.startsWith('http://') || url.startsWith('https://')) {
      return 'public'
    }
    return 'unknown'
  }

  private static getCorsStatus(url?: string): NonNullable<IAssetManifestItem['corsStatus']> {
    if (!url) return 'unknown'
    if (url.includes('localhost') || url.includes('127.0.0.1')) return 'blocked'
    return url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')
      ? 'ok'
      : 'unknown'
  }

  private static normalizeUrl(url?: string): string {
    return (url ?? '').trim()
  }

  private static normalizeName(name?: string): string {
    return (name ?? '').trim().toLowerCase()
  }
}
