<script setup lang="ts">
import { computed, markRaw, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue'
import {
  Bell,
  Clock,
  DataAnalysis,
  Connection,
  Document,
  Warning,
  CircleCheck,
  Upload,
} from '@element-plus/icons-vue'
import * as THREE from 'three'
import type { IAssetManifestItem } from '@lowcode3d/shared'
import TimelinePanel from '@/components/bottom/TimelinePanel.vue'
import DataSourcePanel from '@/components/bottom/DataSourcePanel.vue'
import StatusBadge from '@/components/common/StatusBadge.vue'
import {
  eventBus,
  getEngine,
  type HistoryChangedPayload,
  type SelectionChangedPayload,
} from '@/engine'
import { SceneSerializer } from '@/engine/core/SceneSerializer'
import { ProjectDiagnostics } from '@/engine/core/ProjectDiagnostics'
import type { ProjectDiagnosticIssue } from '@/engine/core/ProjectDiagnostics'
import type { AnimationEngine } from '@/engine/animation'
import { useEditorStore, type BottomDockTab } from '@/stores/editorStore'

type LogLevel = 'info' | 'success' | 'warning'

interface ConsoleLog {
  id: number
  level: LogLevel
  time: string
  message: string
}

interface PerformanceStats {
  fps: number
  calls: number
  triangles: number
  vertices: number
  geometries: number
  textures: number
  objects: number
  materials: number
  maxTextureSize: number
  transparentObjects: number
  shadowLights: number
  targets: {
    objectCount: string[]
    drawCalls: string[]
    triangles: string[]
    textureCount: string[]
    maxTextureSize: string[]
    materialCount: string[]
    transparentObjects: string[]
    shadowLights: string[]
  }
}

interface ProblemItem {
  level: 'error' | 'warning' | 'info'
  message: string
  code?: string
  suggestion?: string
  targets?: string[]
}

const editorStore = useEditorStore()
const activeTab = computed({
  get: () => editorStore.activeBottomTab,
  set: (tab: BottomDockTab) => editorStore.setBottomTab(tab),
})
const animationEngine = shallowRef<AnimationEngine | null>(null)
const selectedObject = shallowRef<THREE.Object3D | undefined>()
const logs = ref<ConsoleLog[]>([])
const diagnosticProblems = ref<ProblemItem[]>([])
const publishIssues = ref<ProjectDiagnosticIssue[]>([])
const publishAssets = ref<IAssetManifestItem[]>([])
const diagnosticsUpdatedAt = ref('')
const stats = ref<PerformanceStats>({
  fps: 0,
  calls: 0,
  triangles: 0,
  vertices: 0,
  geometries: 0,
  textures: 0,
  objects: 0,
  materials: 0,
  maxTextureSize: 0,
  transparentObjects: 0,
  shadowLights: 0,
  targets: {
    objectCount: [],
    drawCalls: [],
    triangles: [],
    textureCount: [],
    maxTextureSize: [],
    materialCount: [],
    transparentObjects: [],
    shadowLights: [],
  },
})

let logId = 0
let frameId = 0
let statsInterval: ReturnType<typeof setInterval> | null = null
let diagnosticsInterval: ReturnType<typeof setInterval> | null = null
let lastTime = performance.now()
let frames = 0

const problems = computed(() => {
  const engine = getEngine()
  const items: ProblemItem[] = [...diagnosticProblems.value]

  if (!engine?.isInitialized) {
    items.push({ level: 'warning', message: '引擎未初始化' })
    return items
  }

  const objectCount = engine.objectManager.count
  if (objectCount === 0) {
    items.push({ level: 'info', message: '场景中暂无业务对象' })
  }

  return items
})

const performanceIssues = computed<ProblemItem[]>(() => {
  const engine = getEngine()
  if (!engine?.isInitialized) return []

  try {
    const snapshot = SceneSerializer.serialize('Performance Diagnostics')
    const issues = ProjectDiagnostics.analyzePerformance(snapshot, {
      objectCount: stats.value.objects,
      drawCalls: stats.value.calls,
      triangles: stats.value.triangles,
      textureCount: stats.value.textures,
      maxTextureSize: stats.value.maxTextureSize,
      materialCount: stats.value.materials,
      transparentObjects: stats.value.transparentObjects,
      shadowLights: stats.value.shadowLights,
      targets: stats.value.targets,
    })

    return issues.map((issue) => ({
      level: issue.level,
      message: issue.message,
      code: issue.code,
      suggestion: issue.suggestion,
      targets: issue.targets,
    }))
  } catch {
    return []
  }
})

const performanceRows = computed(() => [
  { label: 'FPS', value: stats.value.fps },
  { label: 'Draw Calls', value: stats.value.calls },
  { label: 'Triangles', value: stats.value.triangles.toLocaleString() },
  { label: 'Vertices', value: stats.value.vertices.toLocaleString() },
  { label: 'Objects', value: stats.value.objects },
  { label: 'Materials', value: stats.value.materials },
  { label: 'Geometries', value: stats.value.geometries },
  { label: 'Textures', value: stats.value.textures },
  { label: 'Max Texture', value: `${stats.value.maxTextureSize}px` },
  { label: 'Transparent', value: stats.value.transparentObjects },
  { label: 'Shadow Lights', value: stats.value.shadowLights },
])

const publishSummary = computed(() => {
  const missing = publishAssets.value.filter((asset) => asset.status === 'missing').length
  const localOnly = publishAssets.value.filter((asset) => asset.status === 'localOnly').length
  const ready = publishAssets.value.filter(
    (asset) => asset.status === 'ready' || asset.status === 'embedded'
  ).length
  const errors = publishIssues.value.filter((issue) => issue.level === 'error').length
  const warnings = publishIssues.value.filter((issue) => issue.level === 'warning').length

  return {
    ready,
    localOnly,
    missing,
    errors,
    warnings,
    canPublish: errors === 0,
  }
})

const assetStatusText: Record<IAssetManifestItem['status'], string> = {
  ready: '就绪',
  localOnly: '仅本地',
  embedded: '内嵌',
  missing: '缺失',
}

const assetTypeText: Record<IAssetManifestItem['type'], string> = {
  model: '模型',
  texture: '纹理',
  hdri: 'HDRI',
  billboard: '广告牌',
  video: '视频',
  localModel: '本地模型',
  unknown: '内置',
}

function pushLog(level: LogLevel, message: string): void {
  logs.value.unshift({
    id: ++logId,
    level,
    time: new Date().toLocaleTimeString(),
    message,
  })
  logs.value = logs.value.slice(0, 80)
}

function updatePerformanceStats(): void {
  const engine = getEngine()
  if (!engine?.isInitialized) return

  const rendererInfo = engine.renderManager.renderer.info
  let triangles = 0
  let vertices = 0
  const materials = new Set<string>()
  let objects = 0
  let maxTextureSize = 0
  let transparentObjects = 0
  let shadowLights = 0
  const targets = {
    objectCount: new Set<string>(),
    drawCalls: new Set<string>(),
    triangles: new Set<string>(),
    textureCount: new Set<string>(),
    maxTextureSize: new Set<string>(),
    materialCount: new Set<string>(),
    transparentObjects: new Set<string>(),
    shadowLights: new Set<string>(),
  }

  engine.sceneManager.scene.traverse((object) => {
    if (object.visible === false) return
    objects++
    const objectName = object.name || object.type
    targets.objectCount.add(objectName)

    if (object instanceof THREE.Mesh) {
      const geometry = object.geometry
      if (geometry.index) {
        triangles += geometry.index.count / 3
      } else if (geometry.attributes.position) {
        triangles += geometry.attributes.position.count / 3
      }
      if (geometry.attributes.position) {
        vertices += geometry.attributes.position.count
      }

      const meshMaterials = Array.isArray(object.material) ? object.material : [object.material]
      meshMaterials.forEach((material) => {
        if (material) materials.add(material.uuid)
        if (material instanceof THREE.MeshStandardMaterial) {
          if (material.transparent || material.opacity < 1) {
            transparentObjects++
            targets.transparentObjects.add(objectName)
          }

          const textureSlots = [
            material.map,
            material.normalMap,
            material.roughnessMap,
            material.metalnessMap,
            material.aoMap,
            material.emissiveMap,
            material.alphaMap,
          ]

          textureSlots.forEach((texture) => {
            if (!texture) return
            const textureName = texture.name || texture.uuid
            targets.textureCount.add(textureName)
            const image = texture.image as { width?: number; height?: number } | undefined
            const textureSize = Math.max(image?.width ?? 0, image?.height ?? 0)
            if (textureSize > maxTextureSize) {
              maxTextureSize = textureSize
              targets.maxTextureSize.clear()
              targets.maxTextureSize.add(textureName)
            }
          })
        }
      })

      targets.triangles.add(objectName)
      targets.drawCalls.add(objectName)
      targets.materialCount.add(objectName)
    }

    if (object instanceof THREE.Light && object.castShadow) {
      shadowLights++
      targets.shadowLights.add(objectName)
    }
  })

  stats.value.calls = rendererInfo.render.calls || 0
  stats.value.geometries = rendererInfo.memory.geometries || 0
  stats.value.textures = rendererInfo.memory.textures || 0
  stats.value.triangles = Math.round(triangles)
  stats.value.vertices = vertices
  stats.value.objects = objects
  stats.value.materials = materials.size
  stats.value.maxTextureSize = maxTextureSize
  stats.value.transparentObjects = transparentObjects
  stats.value.shadowLights = shadowLights
  stats.value.targets = {
    objectCount: Array.from(targets.objectCount),
    drawCalls: Array.from(targets.drawCalls),
    triangles: Array.from(targets.triangles),
    textureCount: Array.from(targets.textureCount),
    maxTextureSize: Array.from(targets.maxTextureSize),
    materialCount: Array.from(targets.materialCount),
    transparentObjects: Array.from(targets.transparentObjects),
    shadowLights: Array.from(targets.shadowLights),
  }
}

function updateFPS(): void {
  const now = performance.now()
  frames++

  if (now >= lastTime + 1000) {
    stats.value.fps = Math.round((frames * 1000) / (now - lastTime))
    lastTime = now
    frames = 0
  }

  frameId = requestAnimationFrame(updateFPS)
}

function clearConsole(): void {
  logs.value = []
}

function updateDiagnostics(): void {
  try {
    const snapshot = SceneSerializer.serialize('Diagnostics')
    const issues = ProjectDiagnostics.analyze(snapshot)
    publishIssues.value = issues
    publishAssets.value = snapshot.assetManifest?.items ?? []
    diagnosticsUpdatedAt.value = new Date().toLocaleTimeString()
    diagnosticProblems.value = issues.map((issue) => ({
      level: issue.level,
      message: issue.message,
      code: issue.code,
      suggestion: issue.suggestion,
      targets: issue.targets,
    }))
  } catch (error) {
    publishIssues.value = [
      {
        code: 'diagnostics.failed',
        level: 'error',
        message: '项目诊断快照生成失败',
      },
    ]
    publishAssets.value = []
    diagnosticsUpdatedAt.value = new Date().toLocaleTimeString()
    diagnosticProblems.value = [{ level: 'error', message: '项目诊断快照生成失败' }]
  }
}

function severityText(level: 'error' | 'warning' | 'info'): string {
  if (level === 'error') return '错误'
  if (level === 'warning') return '警告'
  return '信息'
}

function severityIcon(level: 'error' | 'warning' | 'info') {
  return level === 'info' ? Bell : Warning
}

function severityTone(level: 'error' | 'warning' | 'info'): 'error' | 'warning' | 'info' {
  return level
}

function assetStatusTone(
  status: IAssetManifestItem['status']
): 'success' | 'warning' | 'error' | 'local' {
  if (status === 'ready' || status === 'embedded') return 'success'
  if (status === 'localOnly') return 'warning'
  if (status === 'missing') return 'error'
  return 'local'
}

function openPublishCheck(): void {
  editorStore.setBottomTab('publish', { openPanel: true })
}

function locateAssetObject(asset: IAssetManifestItem): void {
  const objectUuid = asset.objectUuid || asset.referencedBy?.[0]
  if (!objectUuid) return

  const engine = getEngine()
  const object =
    engine?.objectManager?.getObject(objectUuid) ||
    engine?.sceneManager?.scene.getObjectByProperty('uuid', objectUuid)
  if (!object || !engine?.selectionManager) return

  engine.selectionManager.select(object)
  pushLog('info', `已定位资源引用对象：${object.name || object.uuid.slice(0, 8)}`)
}

function openResourceRepair(asset: IAssetManifestItem): void {
  eventBus.emit('resource:repair-requested', {
    repairAssetId: asset.id,
    asset,
  })
  editorStore.applyWorkspacePreset('asset')
  pushLog('info', `已打开资源修复入口：${asset.name}`)
}

function syncEngineState(): void {
  const engine = getEngine()
  if (!engine?.isInitialized) {
    animationEngine.value = null
    selectedObject.value = undefined
    return
  }

  animationEngine.value = markRaw(engine.animationEngine)
  selectedObject.value = engine.selectionManager.getPrimarySelected() ?? undefined
}

const onObjectAdded = (payload: { object: THREE.Object3D }) => {
  pushLog('success', `已添加对象：${payload.object.name || payload.object.type}`)
  updateDiagnostics()
}

const onObjectRemoved = (payload: { id: string }) => {
  pushLog('warning', `已删除对象：${payload.id.slice(0, 8)}`)
  updateDiagnostics()
}

const onHistoryChanged = (payload: HistoryChangedPayload) => {
  const nextAction = payload.undoName || payload.redoName
  if (nextAction) {
    pushLog('info', `历史状态更新：${nextAction}`)
  }
}

const onPropertyChanged = (payload: { property: string }) => {
  pushLog('info', `属性已更新：${payload.property}`)
  updateDiagnostics()
}

const onSelectionChanged = (payload: SelectionChangedPayload) => {
  selectedObject.value = payload.selected[payload.selected.length - 1]
  if (selectedObject.value) {
    pushLog('info', `已选择对象：${selectedObject.value.name || selectedObject.value.type}`)
  }
}

const onEngineInitialized = () => {
  syncEngineState()
  updateDiagnostics()
  pushLog('success', '动画时间线已连接场景引擎')
}

const onEngineDisposed = () => {
  animationEngine.value = null
  selectedObject.value = undefined
  diagnosticProblems.value = []
}

onMounted(() => {
  pushLog('info', '底部 Dock 已就绪')
  syncEngineState()
  updatePerformanceStats()
  updateDiagnostics()
  updateFPS()
  statsInterval = setInterval(updatePerformanceStats, 1000)
  diagnosticsInterval = setInterval(updateDiagnostics, 2500)

  eventBus.on('scene:object-added', onObjectAdded)
  eventBus.on('scene:object-removed', onObjectRemoved)
  eventBus.on('history:changed', onHistoryChanged)
  eventBus.on('scene:property-changed', onPropertyChanged)
  eventBus.on('scene:selection-changed', onSelectionChanged)
  eventBus.on('engine:initialized', onEngineInitialized)
  eventBus.on('engine:disposed', onEngineDisposed)
})

onBeforeUnmount(() => {
  cancelAnimationFrame(frameId)
  if (statsInterval) clearInterval(statsInterval)
  if (diagnosticsInterval) clearInterval(diagnosticsInterval)

  eventBus.off('scene:object-added', onObjectAdded)
  eventBus.off('scene:object-removed', onObjectRemoved)
  eventBus.off('history:changed', onHistoryChanged)
  eventBus.off('scene:property-changed', onPropertyChanged)
  eventBus.off('scene:selection-changed', onSelectionChanged)
  eventBus.off('engine:initialized', onEngineInitialized)
  eventBus.off('engine:disposed', onEngineDisposed)
})
</script>

<template>
  <div class="bottom-panel">
    <el-tabs v-model="activeTab" class="dock-tabs">
      <el-tab-pane name="console">
        <template #label>
          <span class="tab-label">
            <el-icon><Document /></el-icon>
            Console
          </span>
        </template>

        <div class="dock-toolbar">
          <span>{{ logs.length }} 条记录</span>
          <el-button size="small" text @click="clearConsole">清空</el-button>
        </div>
        <div class="console-list">
          <div v-for="log in logs" :key="log.id" class="console-row" :class="`is-${log.level}`">
            <span class="log-time">{{ log.time }}</span>
            <span class="log-message">{{ log.message }}</span>
          </div>
          <div v-if="logs.length === 0" class="empty-state">暂无记录</div>
        </div>
      </el-tab-pane>

      <el-tab-pane name="timeline">
        <template #label>
          <span class="tab-label">
            <el-icon><Clock /></el-icon>
            Timeline
          </span>
        </template>

        <TimelinePanel
          :engine="animationEngine"
          :selected-object="selectedObject"
          :active="editorStore.panels.bottomPanel && activeTab === 'timeline'"
        />
      </el-tab-pane>

      <el-tab-pane name="problems">
        <template #label>
          <span class="tab-label">
            <el-icon><Warning /></el-icon>
            Problems
            <span v-if="problems.length" class="tab-count">{{ problems.length }}</span>
          </span>
        </template>

        <div class="dock-toolbar">
          <span>{{ problems.length }} 个诊断项</span>
          <el-button size="small" text @click="updateDiagnostics">刷新</el-button>
        </div>
        <div class="problem-list">
          <div v-if="problems.length === 0" class="ok-state">
            <el-icon><CircleCheck /></el-icon>
            <span>未发现问题</span>
          </div>
          <div
            v-for="(problem, index) in problems"
            :key="`${problem.code || problem.message}-${index}`"
            class="problem-row"
            :class="`is-${problem.level}`"
          >
            <StatusBadge
              :label="severityText(problem.level)"
              :tone="severityTone(problem.level)"
              :icon="severityIcon(problem.level)"
            />
            <div class="problem-body">
              <span class="problem-message">{{ problem.message }}</span>
              <div v-if="problem.suggestion" class="problem-suggestion">
                {{ problem.suggestion }}
              </div>
              <div v-if="problem.targets?.length" class="problem-targets">
                {{ problem.targets.slice(0, 4).join('、') }}
              </div>
            </div>
            <el-button size="small" text @click="openPublishCheck">查看检查</el-button>
          </div>
        </div>
      </el-tab-pane>

      <el-tab-pane name="performance">
        <template #label>
          <span class="tab-label">
            <el-icon><DataAnalysis /></el-icon>
            Performance
          </span>
        </template>

        <div class="performance-grid">
          <div v-for="row in performanceRows" :key="row.label" class="metric">
            <span class="metric-label">{{ row.label }}</span>
            <span class="metric-value">{{ row.value }}</span>
          </div>
        </div>
        <div class="publish-section performance-section">
          <div class="publish-section-title">性能提示</div>
          <div v-if="performanceIssues.length === 0" class="ok-state compact">
            <el-icon><CircleCheck /></el-icon>
            <span>当前性能指标正常</span>
          </div>
          <div v-else class="problem-list performance-issues">
            <div
              v-for="issue in performanceIssues"
              :key="issue.code"
              class="problem-row"
              :class="`is-${issue.level}`"
            >
              <StatusBadge
                :label="severityText(issue.level)"
                :tone="severityTone(issue.level)"
                :icon="severityIcon(issue.level)"
              />
              <div class="problem-body">
                <span class="problem-message">{{ issue.message }}</span>
                <div v-if="issue.suggestion" class="performance-suggestion">
                  {{ issue.suggestion }}
                </div>
                <div v-if="issue.targets?.length" class="performance-targets">
                  {{ issue.targets.slice(0, 4).join('、') }}
                </div>
              </div>
              <span class="issue-code">{{ issue.code }}</span>
            </div>
          </div>
        </div>
      </el-tab-pane>

      <el-tab-pane name="dataSources">
        <template #label>
          <span class="tab-label">
            <el-icon><Connection /></el-icon>
            Data
          </span>
        </template>

        <DataSourcePanel />
      </el-tab-pane>

      <el-tab-pane name="publish">
        <template #label>
          <span class="tab-label">
            <el-icon><Upload /></el-icon>
            Publish Check
            <span v-if="publishSummary.errors || publishSummary.warnings" class="tab-count">{{
              publishSummary.errors || publishSummary.warnings
            }}</span>
          </span>
        </template>

        <div class="dock-toolbar">
          <span>{{ diagnosticsUpdatedAt ? `最近检查：${diagnosticsUpdatedAt}` : '尚未检查' }}</span>
          <el-button size="small" text @click="updateDiagnostics">重新检查</el-button>
        </div>
        <div class="publish-check">
          <div class="publish-summary">
            <div class="publish-card" :class="{ 'is-ok': publishSummary.canPublish }">
              <span class="publish-label">状态</span>
              <span class="publish-value">{{ publishSummary.canPublish ? '可发布' : '阻断' }}</span>
            </div>
            <div class="publish-card" :class="{ 'is-error': publishSummary.errors > 0 }">
              <span class="publish-label">错误</span>
              <span class="publish-value">{{ publishSummary.errors }}</span>
            </div>
            <div class="publish-card">
              <span class="publish-label">可用资源</span>
              <span class="publish-value">{{ publishSummary.ready }}</span>
            </div>
            <div class="publish-card" :class="{ 'is-warning': publishSummary.localOnly > 0 }">
              <span class="publish-label">仅本地</span>
              <span class="publish-value">{{ publishSummary.localOnly }}</span>
            </div>
            <div class="publish-card" :class="{ 'is-warning': publishSummary.missing > 0 }">
              <span class="publish-label">缺失</span>
              <span class="publish-value">{{ publishSummary.missing }}</span>
            </div>
          </div>

          <div class="publish-section">
            <div class="publish-section-title">诊断</div>
            <div v-if="publishIssues.length === 0" class="ok-state compact">
              <el-icon><CircleCheck /></el-icon>
              <span>发布检查通过</span>
            </div>
            <div
              v-for="issue in publishIssues"
              :key="issue.code"
              class="problem-row"
              :class="`is-${issue.level}`"
            >
              <StatusBadge
                :label="severityText(issue.level)"
                :tone="severityTone(issue.level)"
                :icon="severityIcon(issue.level)"
              />
              <div class="problem-body">
                <span class="problem-message">{{ issue.message }}</span>
                <div v-if="issue.suggestion" class="problem-suggestion">
                  {{ issue.suggestion }}
                </div>
                <div v-if="issue.targets?.length" class="problem-targets">
                  {{ issue.targets.slice(0, 4).join('、') }}
                </div>
              </div>
              <span class="issue-code">{{ issue.code }}</span>
            </div>
          </div>

          <div class="publish-section">
            <div class="publish-section-title">资源依赖</div>
            <div v-if="publishAssets.length === 0" class="empty-state compact">
              暂无外部资源依赖
            </div>
            <div v-else class="asset-manifest">
              <div class="asset-row asset-header">
                <span>资源</span>
                <span>类型</span>
                <span>状态</span>
                <span>来源</span>
                <span>操作</span>
              </div>
              <div
                v-for="asset in publishAssets"
                :key="asset.id"
                class="asset-row"
                :class="`is-${asset.status}`"
              >
                <span class="asset-name" :title="asset.url || asset.name">{{ asset.name }}</span>
                <span>{{ assetTypeText[asset.type] }}</span>
                <StatusBadge
                  :label="assetStatusText[asset.status]"
                  :tone="assetStatusTone(asset.status)"
                />
                <span>{{ asset.source }}</span>
                <span class="asset-actions">
                  <el-button
                    size="small"
                    text
                    :disabled="!asset.objectUuid"
                    @click="locateAssetObject(asset)"
                  >
                    定位
                  </el-button>
                  <el-button size="small" text @click="openResourceRepair(asset)">修复</el-button>
                </span>
              </div>
            </div>
          </div>
        </div>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<style scoped lang="scss">
.bottom-panel {
  display: flex;
  flex-direction: column;
  min-height: 0;
  background-color: $--bg-color-dark;
  border-top: 1px solid $--border-color;
}

.dock-tabs {
  flex: 1;
  min-height: 0;

  :deep(.el-tabs__header) {
    margin: 0;
    padding: 0 8px;
    background-color: $--bg-color-darker;
    border-bottom: 1px solid $--border-color-light;
  }

  :deep(.el-tabs__content) {
    height: calc(100% - 40px);
  }

  :deep(.el-tab-pane) {
    height: 100%;
  }
}

.tab-label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
}

.tab-count {
  min-width: 18px;
  height: 18px;
  line-height: 18px;
  border-radius: 9px;
  text-align: center;
  font-size: 11px;
  color: #fff;
  background-color: var(--el-color-warning);
}

.dock-toolbar {
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 12px;
  border-bottom: 1px solid $--border-color-light;
  font-size: 12px;
  color: $--text-color-secondary;
}

.console-list,
.problem-list {
  height: calc(100% - 32px);
  overflow: auto;
  font-size: 12px;
}

.console-row {
  display: grid;
  grid-template-columns: 88px 1fr;
  min-height: 28px;
  align-items: center;
  padding: 0 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);

  &.is-success .log-message {
    color: var(--el-color-success);
  }

  &.is-warning .log-message {
    color: var(--el-color-warning);
  }
}

.log-time {
  color: $--text-color-placeholder;
  font-family: monospace;
}

.log-message {
  min-width: 0;
  color: $--text-color-secondary;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.empty-state,
.ok-state {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: $--text-color-placeholder;
  font-size: 13px;
}

.problem-row {
  min-height: 32px;
  display: grid;
  grid-template-columns: 78px minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
  color: $--text-color-secondary;

  &.is-error {
    background: rgba(255, 92, 92, 0.06);
  }

  &.is-warning {
    background: rgba(245, 165, 36, 0.06);
  }
}

.problem-body {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.problem-severity {
  height: 22px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 0 7px;
  border-radius: var(--lc-radius-sm);
  color: var(--lc-text-secondary);
  background: var(--lc-bg-control);
  border: 1px solid var(--lc-border-subtle);
  font-size: 11px;
}

.is-error .problem-severity {
  color: var(--lc-error);
  border-color: rgba(255, 92, 92, 0.36);
}

.is-warning .problem-severity {
  color: var(--lc-warning);
  border-color: rgba(245, 165, 36, 0.36);
}

.problem-message {
  min-width: 0;
  overflow: hidden;
  color: var(--lc-text-secondary);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.problem-suggestion,
.problem-targets,
.performance-suggestion,
.performance-targets {
  min-width: 0;
  color: var(--lc-text-muted);
  font-size: 11px;
  line-height: 1.35;
}

.issue-code {
  color: var(--lc-text-muted);
  font-family: var(--lc-font-mono);
  font-size: 11px;
}

.publish-check {
  height: calc(100% - 32px);
  overflow: auto;
  padding: 12px;
}

.publish-summary {
  display: grid;
  grid-template-columns: repeat(4, minmax(120px, 1fr));
  gap: 8px;
  margin-bottom: 12px;
}

.publish-card {
  min-height: 58px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 10px;
  border: 1px solid $--border-color-light;
  border-radius: 4px;
  background-color: $--bg-color-dark;

  &.is-ok .publish-value {
    color: var(--el-color-success);
  }

  &.is-error .publish-value {
    color: var(--el-color-danger);
  }

  &.is-warning .publish-value {
    color: var(--el-color-warning);
  }
}

.publish-label {
  font-size: 11px;
  color: $--text-color-secondary;
}

.publish-value {
  margin-top: 6px;
  font-size: 16px;
  color: $--text-color-primary;
  font-family: monospace;
}

.publish-section {
  border: 1px solid $--border-color-light;
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 12px;
}

.publish-section-title {
  height: 30px;
  display: flex;
  align-items: center;
  padding: 0 10px;
  background-color: $--bg-color-darker;
  border-bottom: 1px solid $--border-color-light;
  font-size: 12px;
  color: $--text-color-secondary;
}

.compact {
  min-height: 44px;
  height: 44px;
}

.asset-manifest {
  font-size: 12px;
}

.asset-row {
  display: grid;
  grid-template-columns: minmax(180px, 1fr) 90px 86px 110px;
  min-height: 32px;
  align-items: center;
  gap: 8px;
  padding: 0 10px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
  color: $--text-color-secondary;

  &:last-child {
    border-bottom: 0;
  }

  &.asset-header {
    color: $--text-color-placeholder;
    background-color: rgba(255, 255, 255, 0.03);
  }

  &.is-localOnly,
  &.is-missing {
    color: $--text-color-secondary;
  }

  &.is-missing {
    color: $--text-color-secondary;
  }
}

.asset-status-badge {
  height: 22px;
  display: inline-flex;
  align-items: center;
  padding: 0 7px;
  border-radius: var(--lc-radius-sm);
  color: var(--lc-text-secondary);
  background: var(--lc-bg-control);
  border: 1px solid var(--lc-border-subtle);
  font-size: 11px;

  &.is-ready,
  &.is-embedded {
    color: var(--lc-success);
    border-color: rgba(53, 196, 107, 0.36);
  }

  &.is-localOnly {
    color: var(--lc-warning);
    border-color: rgba(245, 165, 36, 0.36);
  }

  &.is-missing {
    color: var(--lc-error);
    border-color: rgba(255, 92, 92, 0.36);
  }
}

.asset-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.performance-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(120px, 1fr));
  gap: 1px;
  height: 100%;
  background-color: $--border-color-light;
  overflow: auto;
}

.performance-section {
  margin-top: 12px;
}

.performance-issues {
  max-height: 220px;
  overflow: auto;
}

.metric {
  min-height: 72px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 12px;
  background-color: $--bg-color-dark;
}

.metric-label {
  font-size: 11px;
  color: $--text-color-secondary;
}

.metric-value {
  margin-top: 6px;
  font-size: 20px;
  font-family: monospace;
  color: $--text-color-primary;
}
</style>
