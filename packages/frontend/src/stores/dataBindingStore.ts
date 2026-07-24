import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type { DataBindingConfig, DataSourceConfig, DataSourceType } from '@lowcode3d/shared'
import { getEngine } from '@/engine'
import { useEditorStateStore } from './editorStateStore'

export interface DataSourceTestResult {
  sourceId: string
  status: 'idle' | 'loading' | 'success' | 'error'
  message: string
  data?: unknown
  testedAt?: string
}

export interface CreateDataSourceInput {
  name: string
  type: DataSourceType
  config?: Record<string, unknown>
  sampleData?: unknown
  enabled?: boolean
}

export interface CreateDataBindingInput {
  objectUuid: string
  propertyPath: string
  sourceId: string
  dataPath: string
  componentId?: string
  fallbackValue?: unknown
  enabled?: boolean
}

function cloneDataSources(dataSources: DataSourceConfig[]): DataSourceConfig[] {
  return dataSources.map((source) => structuredClone(source))
}

function cloneBindings(bindings: DataBindingConfig[]): DataBindingConfig[] {
  return bindings.map((binding) => structuredClone(binding))
}

function createId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`
}

export const useDataBindingStore = defineStore('dataBindings', () => {
  const dataSources = ref<DataSourceConfig[]>([])
  const bindings = ref<DataBindingConfig[]>([])
  const testResults = ref<Record<string, DataSourceTestResult>>({})

  const enabledDataSources = computed(() => dataSources.value.filter((source) => source.enabled))
  const enabledBindings = computed(() => bindings.value.filter((binding) => binding.enabled))

  function syncSceneUserData(): void {
    const engine = getEngine()
    if (!engine?.isInitialized) return
    engine.sceneManager.scene.userData.dataSources = cloneDataSources(dataSources.value)
    engine.sceneManager.scene.userData.dataBindings = cloneBindings(bindings.value)
  }

  function markModified(): void {
    syncSceneUserData()
    useEditorStateStore().markAsModified()
  }

  function replaceDataSources(nextSources: DataSourceConfig[], markDirty = false): void {
    dataSources.value = cloneDataSources(nextSources)
    syncSceneUserData()
    if (markDirty) {
      useEditorStateStore().markAsModified()
    }
  }

  function replaceBindings(nextBindings: DataBindingConfig[], markDirty = false): void {
    bindings.value = cloneBindings(nextBindings)
    syncSceneUserData()
    if (markDirty) {
      useEditorStateStore().markAsModified()
    }
  }

  function hydrateFromScene(): void {
    const engine = getEngine()
    const sceneDataSources = engine?.sceneManager.scene.userData.dataSources
    const sceneBindings = engine?.sceneManager.scene.userData.dataBindings
    if (Array.isArray(sceneDataSources)) {
      replaceDataSources(sceneDataSources as DataSourceConfig[])
    }
    if (Array.isArray(sceneBindings)) {
      replaceBindings(sceneBindings as DataBindingConfig[])
    }
  }

  function addDataSource(input: CreateDataSourceInput): DataSourceConfig {
    const dataSource: DataSourceConfig = {
      id: createId('source'),
      name: input.name.trim() || '未命名数据源',
      type: input.type,
      config: input.config ?? {},
      sampleData: input.sampleData,
      enabled: input.enabled ?? true,
      authMode: 'none',
    }

    dataSources.value.push(dataSource)
    markModified()
    return dataSource
  }

  function updateDataSource(id: string, patch: Partial<DataSourceConfig>): DataSourceConfig | null {
    const index = dataSources.value.findIndex((source) => source.id === id)
    if (index < 0) return null

    dataSources.value[index] = {
      ...dataSources.value[index],
      ...patch,
      config: patch.config ?? dataSources.value[index].config,
    }
    markModified()
    return dataSources.value[index]
  }

  function removeDataSource(id: string): boolean {
    const nextSources = dataSources.value.filter((source) => source.id !== id)
    if (nextSources.length === dataSources.value.length) return false

    dataSources.value = nextSources
    bindings.value = bindings.value.filter((binding) => binding.sourceId !== id)
    delete testResults.value[id]
    markModified()
    return true
  }

  function addBinding(input: CreateDataBindingInput): DataBindingConfig {
    const binding: DataBindingConfig = {
      id: createId('binding'),
      objectUuid: input.objectUuid,
      propertyPath: input.propertyPath,
      sourceId: input.sourceId,
      dataPath: input.dataPath,
      componentId: input.componentId,
      fallbackValue: input.fallbackValue,
      transform: { type: 'identity' },
      enabled: input.enabled ?? true,
    }

    bindings.value.push(binding)
    markModified()
    return binding
  }

  function updateBinding(id: string, patch: Partial<DataBindingConfig>): DataBindingConfig | null {
    const index = bindings.value.findIndex((binding) => binding.id === id)
    if (index < 0) return null

    bindings.value[index] = {
      ...bindings.value[index],
      ...patch,
      transform: patch.transform ?? bindings.value[index].transform,
    }
    markModified()
    return bindings.value[index]
  }

  function removeBinding(id: string): boolean {
    const nextBindings = bindings.value.filter((binding) => binding.id !== id)
    if (nextBindings.length === bindings.value.length) return false

    bindings.value = nextBindings
    markModified()
    return true
  }

  function getBindingsForObject(objectUuid: string): DataBindingConfig[] {
    return bindings.value.filter((binding) => binding.objectUuid === objectUuid)
  }

  async function testDataSource(sourceId: string): Promise<DataSourceTestResult> {
    const source = dataSources.value.find((item) => item.id === sourceId)
    if (!source) {
      return setTestResult(sourceId, 'error', '数据源不存在')
    }

    setTestResult(sourceId, 'loading', '正在测试数据源')

    try {
      const data = await loadDataSourceSample(source)
      source.sampleData = data
      markModified()
      return setTestResult(sourceId, 'success', '测试成功', data)
    } catch (error) {
      return setTestResult(sourceId, 'error', error instanceof Error ? error.message : '测试失败')
    }
  }

  async function loadDataSourceSample(source: DataSourceConfig): Promise<unknown> {
    if (source.type === 'staticJson') {
      const value = source.config.value ?? source.sampleData ?? {}
      if (typeof value === 'string') {
        return JSON.parse(value)
      }
      return value
    }

    if (source.type === 'http') {
      const url = source.config.url
      if (typeof url !== 'string' || !url.trim()) {
        throw new Error('HTTP 数据源缺少 URL')
      }
      const response = await fetch(url)
      if (!response.ok) {
        throw new Error(`HTTP 请求失败：${response.status}`)
      }
      return response.json()
    }

    throw new Error('WebSocket 数据源将在后续版本支持实时连接')
  }

  function setTestResult(
    sourceId: string,
    status: DataSourceTestResult['status'],
    message: string,
    data?: unknown
  ): DataSourceTestResult {
    const result: DataSourceTestResult = {
      sourceId,
      status,
      message,
      data,
      testedAt: new Date().toISOString(),
    }
    testResults.value[sourceId] = result
    return result
  }

  function reset(): void {
    dataSources.value = []
    bindings.value = []
    testResults.value = {}
    syncSceneUserData()
  }

  return {
    dataSources,
    bindings,
    testResults,
    enabledDataSources,
    enabledBindings,
    replaceDataSources,
    replaceBindings,
    hydrateFromScene,
    addDataSource,
    updateDataSource,
    removeDataSource,
    addBinding,
    updateBinding,
    removeBinding,
    getBindingsForObject,
    testDataSource,
    reset,
  }
})
