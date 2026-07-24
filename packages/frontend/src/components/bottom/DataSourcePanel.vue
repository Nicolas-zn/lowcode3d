<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Delete, Plus, Refresh, View } from '@element-plus/icons-vue'
import type { DataSourceConfig, DataSourceType } from '@lowcode3d/shared'
import { useDataBindingStore } from '@/stores/dataBindingStore'
import { useSelectionStore } from '@/stores/selectionStore'

defineOptions({ name: 'DataSourcePanel' })

const dataBindingStore = useDataBindingStore()
const selectionStore = useSelectionStore()
const newSourceType = ref<DataSourceType>('staticJson')
const newSourceName = ref('')
const bindingSourceId = ref('')
const bindingPropertyPath = ref('visible')
const bindingDataPath = ref('value')
const bindingFallbackValue = ref('')

const sourceTypeOptions: Array<{ label: string; value: DataSourceType }> = [
  { label: '静态 JSON', value: 'staticJson' },
  { label: 'HTTP', value: 'http' },
  { label: 'WebSocket', value: 'websocket' },
]

const sourceCount = computed(() => dataBindingStore.dataSources.length)
const bindingCount = computed(() => dataBindingStore.bindings.length)
const currentObjectId = computed(() => selectionStore.primarySelectedId)

const bindablePropertyOptions = [
  { label: '可见性', value: 'visible' },
  { label: '位置 X', value: 'position.x' },
  { label: '位置 Y', value: 'position.y' },
  { label: '位置 Z', value: 'position.z' },
  { label: '缩放 X', value: 'scale.x' },
  { label: '缩放 Y', value: 'scale.y' },
  { label: '缩放 Z', value: 'scale.z' },
  { label: '材质颜色', value: 'material.color' },
  { label: '材质透明度', value: 'material.opacity' },
  { label: '标签文本', value: 'userData.label' },
  { label: '组件标签', value: 'component.props.label' },
  { label: '组件状态色', value: 'component.props.statusColor' },
]

onMounted(() => {
  dataBindingStore.hydrateFromScene()
})

function addDataSource(): void {
  const type = newSourceType.value
  dataBindingStore.addDataSource({
    name: newSourceName.value || (type === 'http' ? 'HTTP 数据源' : '静态 JSON'),
    type,
    config:
      type === 'http'
        ? { url: '', method: 'GET' }
        : type === 'staticJson'
          ? { value: { value: 0 } }
          : { url: '' },
    sampleData: type === 'staticJson' ? { value: 0 } : undefined,
  })
  newSourceName.value = ''
}

function updateSourceName(source: DataSourceConfig, name: string): void {
  dataBindingStore.updateDataSource(source.id, { name })
}

function updateSourceEnabled(source: DataSourceConfig, enabled: boolean): void {
  dataBindingStore.updateDataSource(source.id, { enabled })
}

function updateSourceConfig(source: DataSourceConfig, key: string, value: unknown): void {
  dataBindingStore.updateDataSource(source.id, {
    config: {
      ...source.config,
      [key]: value,
    },
  })
}

function updateStaticJson(source: DataSourceConfig, value: string): void {
  updateSourceConfig(source, 'value', value)
}

function prettySample(source: DataSourceConfig): string {
  const value = source.sampleData ?? source.config.value
  if (value === undefined) return ''
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

function addBinding(): void {
  if (!currentObjectId.value || !bindingSourceId.value) return

  dataBindingStore.addBinding({
    objectUuid: currentObjectId.value,
    sourceId: bindingSourceId.value,
    propertyPath: bindingPropertyPath.value,
    dataPath: bindingDataPath.value,
    fallbackValue: bindingFallbackValue.value || undefined,
  })
}
</script>

<template>
  <div class="data-source-panel">
    <div class="dock-toolbar local-toolbar">
      <span>{{ sourceCount }} 个数据源</span>
      <div class="toolbar-actions">
        <el-input
          v-model="newSourceName"
          size="small"
          placeholder="数据源名称"
          class="source-name-input"
        />
        <el-select v-model="newSourceType" size="small" class="source-type-select">
          <el-option
            v-for="option in sourceTypeOptions"
            :key="option.value"
            :label="option.label"
            :value="option.value"
          />
        </el-select>
        <el-button size="small" type="primary" :icon="Plus" @click="addDataSource">
          添加
        </el-button>
      </div>
    </div>

    <div class="source-list">
      <div v-if="dataBindingStore.dataSources.length === 0" class="empty-state">暂无数据源</div>

      <div v-for="source in dataBindingStore.dataSources" :key="source.id" class="source-row">
        <div class="source-header">
          <el-input
            :model-value="source.name"
            size="small"
            class="source-title"
            @change="(value: string) => updateSourceName(source, value)"
          />
          <span class="source-type">{{ source.type }}</span>
          <el-switch
            :model-value="source.enabled"
            size="small"
            @change="
              (value: string | number | boolean) => updateSourceEnabled(source, Boolean(value))
            "
          />
          <el-button
            size="small"
            text
            :icon="Refresh"
            @click="dataBindingStore.testDataSource(source.id)"
          />
          <el-button
            size="small"
            text
            :icon="Delete"
            @click="dataBindingStore.removeDataSource(source.id)"
          />
        </div>

        <div v-if="source.type === 'http'" class="source-config">
          <el-input
            :model-value="String(source.config.url ?? '')"
            size="small"
            placeholder="https://api.example.com/data.json"
            @change="(value: string) => updateSourceConfig(source, 'url', value)"
          />
        </div>

        <div v-else-if="source.type === 'staticJson'" class="source-config">
          <el-input
            :model-value="String(source.config.value ?? prettySample(source))"
            type="textarea"
            :rows="3"
            size="small"
            placeholder='{"value": 0}'
            @change="(value: string) => updateStaticJson(source, value)"
          />
        </div>

        <div v-else class="source-config">
          <el-input
            :model-value="String(source.config.url ?? '')"
            size="small"
            placeholder="wss://example.com/stream"
            @change="(value: string) => updateSourceConfig(source, 'url', value)"
          />
        </div>

        <div class="source-footer">
          <span>
            {{ dataBindingStore.testResults[source.id]?.message || '未测试' }}
          </span>
          <el-tooltip
            v-if="source.sampleData !== undefined"
            placement="top"
            :content="prettySample(source)"
          >
            <el-icon><View /></el-icon>
          </el-tooltip>
        </div>
      </div>
    </div>

    <div class="binding-section">
      <div class="section-title">
        <span>{{ bindingCount }} 个绑定</span>
        <span v-if="currentObjectId" class="muted"
          >当前对象：{{ currentObjectId.slice(0, 8) }}</span
        >
        <span v-else class="muted">请选择对象后添加绑定</span>
      </div>

      <div class="binding-form">
        <el-select
          v-model="bindingSourceId"
          size="small"
          placeholder="数据源"
          :disabled="!currentObjectId"
        >
          <el-option
            v-for="source in dataBindingStore.dataSources"
            :key="source.id"
            :label="source.name"
            :value="source.id"
          />
        </el-select>
        <el-select
          v-model="bindingPropertyPath"
          size="small"
          placeholder="属性"
          :disabled="!currentObjectId"
        >
          <el-option
            v-for="option in bindablePropertyOptions"
            :key="option.value"
            :label="option.label"
            :value="option.value"
          />
        </el-select>
        <el-input
          v-model="bindingDataPath"
          size="small"
          placeholder="数据路径，如 metrics.value"
          :disabled="!currentObjectId"
        />
        <el-input
          v-model="bindingFallbackValue"
          size="small"
          placeholder="fallback"
          :disabled="!currentObjectId"
        />
        <el-button
          size="small"
          type="primary"
          plain
          :disabled="!currentObjectId || !bindingSourceId"
          @click="addBinding"
        >
          添加绑定
        </el-button>
      </div>

      <div class="binding-list">
        <div v-if="dataBindingStore.bindings.length === 0" class="empty-state compact">
          暂无绑定
        </div>
        <div v-for="binding in dataBindingStore.bindings" :key="binding.id" class="binding-row">
          <span>{{ binding.objectUuid.slice(0, 8) }}</span>
          <span>{{ binding.propertyPath }}</span>
          <span>{{ binding.dataPath }}</span>
          <el-switch
            :model-value="binding.enabled"
            size="small"
            @change="
              (value: string | number | boolean) =>
                dataBindingStore.updateBinding(binding.id, { enabled: Boolean(value) })
            "
          />
          <el-button
            size="small"
            text
            :icon="Delete"
            @click="dataBindingStore.removeBinding(binding.id)"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.data-source-panel {
  display: grid;
  gap: 10px;
  height: 100%;
}

.local-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.toolbar-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.source-name-input {
  width: 160px;
}

.source-type-select {
  width: 120px;
}

.source-list {
  display: grid;
  gap: 10px;
  overflow: auto;
}

.source-row {
  display: grid;
  gap: 8px;
  padding: 10px;
  border: 1px solid var(--lc-border-subtle);
  border-radius: var(--lc-radius-sm);
  background: var(--lc-bg-control);
}

.source-header,
.source-footer {
  display: flex;
  align-items: center;
  gap: 8px;
}

.source-title {
  max-width: 220px;
}

.source-type {
  color: var(--lc-text-muted);
  font-size: 12px;
  min-width: 72px;
}

.source-config {
  display: grid;
  gap: 8px;
}

.source-footer {
  color: var(--lc-text-muted);
  font-size: 12px;
}

.binding-section {
  display: grid;
  gap: 8px;
  padding-top: 8px;
  border-top: 1px solid var(--lc-border-subtle);
}

.section-title,
.binding-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.section-title {
  justify-content: space-between;
  color: var(--lc-text-secondary);
  font-size: 12px;
}

.muted {
  color: var(--lc-text-muted);
}

.binding-form {
  display: grid;
  grid-template-columns: 150px 140px minmax(160px, 1fr) 120px auto;
  gap: 8px;
}

.binding-list {
  display: grid;
  gap: 6px;
}

.binding-row {
  padding: 6px 8px;
  border-radius: var(--lc-radius-sm);
  background: var(--lc-bg-elevated);
  color: var(--lc-text-secondary);
  font-size: 12px;
}
</style>
