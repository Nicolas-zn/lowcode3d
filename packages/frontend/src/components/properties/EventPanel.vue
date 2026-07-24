<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { Delete, Plus } from '@element-plus/icons-vue'
import type * as THREE from 'three'
import type { RuntimeActionConfig, RuntimeActionType, RuntimeTriggerType } from '@lowcode3d/shared'
import { useEventStore } from '@/stores/eventStore'
import { useCameraBookmarkStore } from '@/stores/cameraBookmarkStore'

defineOptions({ name: 'EventPanel' })

const props = defineProps<{
  object: THREE.Object3D | null
}>()

const eventStore = useEventStore()
const cameraBookmarkStore = useCameraBookmarkStore()

const triggerOptions: Array<{ label: string; value: RuntimeTriggerType }> = [
  { label: '点击', value: 'click' },
  { label: '双击', value: 'doubleClick' },
  { label: 'Hover 进入', value: 'hoverEnter' },
  { label: 'Hover 离开', value: 'hoverLeave' },
]

const actionOptions: Array<{ label: string; value: RuntimeActionType }> = [
  { label: '打开链接', value: 'openUrl' },
  { label: '播放动画', value: 'playAnimation' },
  { label: '暂停动画', value: 'pauseAnimation' },
  { label: '切换相机', value: 'switchCamera' },
  { label: '显示/隐藏对象', value: 'setObjectVisible' },
  { label: '设置材质', value: 'setObjectMaterial' },
  { label: '显示弹窗', value: 'showPopup' },
  { label: '发送消息', value: 'emitMessage' },
]

const objectEvents = computed(() => {
  if (!props.object) return []
  return eventStore.getEventsForObject(props.object.uuid)
})

const bookmarkOptions = computed(() => cameraBookmarkStore.bookmarkOptions)

onMounted(() => {
  eventStore.hydrateFromScene()
  cameraBookmarkStore.hydrateFromScene()
})

function addEvent(): void {
  if (!props.object) return
  eventStore.addEvent({
    objectUuid: props.object.uuid,
    trigger: 'click',
    actions: [createDefaultActionConfig('setObjectVisible')],
  })
}

function addAction(eventId: string): void {
  eventStore.addAction(eventId, createDefaultAction('openUrl'))
}

function createDefaultAction(type: RuntimeActionType): Omit<RuntimeActionConfig, 'id'> {
  return {
    type,
    enabled: true,
    payload: createDefaultPayload(type),
  }
}

function createDefaultActionConfig(type: RuntimeActionType): RuntimeActionConfig {
  return {
    id: `action-${crypto.randomUUID()}`,
    ...createDefaultAction(type),
  }
}

function createDefaultPayload(type: RuntimeActionType): Record<string, unknown> {
  switch (type) {
    case 'openUrl':
      return { url: '', target: '_blank' }
    case 'playAnimation':
    case 'pauseAnimation':
      return { clipId: '' }
    case 'switchCamera':
      return { bookmarkId: '' }
    case 'setObjectVisible':
      return { objectUuid: props.object?.uuid ?? '', visible: true }
    case 'setObjectMaterial':
      return { objectUuid: props.object?.uuid ?? '', color: '#409eff' }
    case 'showPopup':
      return { title: '', content: '' }
    case 'emitMessage':
      return { name: '', data: {} }
    default:
      return {}
  }
}

function updateEventTrigger(eventId: string, trigger: RuntimeTriggerType): void {
  eventStore.updateEvent(eventId, { trigger })
}

function updateEventEnabled(eventId: string, enabled: boolean): void {
  eventStore.updateEvent(eventId, { enabled })
}

function updateActionType(
  eventId: string,
  action: RuntimeActionConfig,
  type: RuntimeActionType
): void {
  eventStore.updateAction(eventId, action.id, {
    type,
    payload: createDefaultPayload(type),
  })
}

function updateActionEnabled(eventId: string, action: RuntimeActionConfig, enabled: boolean): void {
  eventStore.updateAction(eventId, action.id, { enabled })
}

function updatePayload(
  eventId: string,
  action: RuntimeActionConfig,
  key: string,
  value: unknown
): void {
  eventStore.updateAction(eventId, action.id, {
    payload: {
      ...action.payload,
      [key]: value,
    },
  })
}

function captureCurrentCamera(eventId: string, action: RuntimeActionConfig): void {
  const bookmark = cameraBookmarkStore.captureCurrentCamera()
  if (!bookmark) return
  updatePayload(eventId, action, 'bookmarkId', bookmark.id)
}
</script>

<template>
  <div class="event-panel">
    <div class="event-toolbar">
      <span>{{ objectEvents.length }} 个事件</span>
      <el-button size="small" type="primary" plain :icon="Plus" @click="addEvent">
        添加事件
      </el-button>
    </div>

    <div v-if="objectEvents.length === 0" class="event-empty">尚未配置交互事件</div>

    <div v-for="event in objectEvents" :key="event.id" class="event-block">
      <div class="event-row">
        <el-select
          :model-value="event.trigger"
          size="small"
          @change="(value: RuntimeTriggerType) => updateEventTrigger(event.id, value)"
        >
          <el-option
            v-for="option in triggerOptions"
            :key="option.value"
            :label="option.label"
            :value="option.value"
          />
        </el-select>
        <el-switch
          :model-value="event.enabled"
          size="small"
          @change="
            (value: string | number | boolean) => updateEventEnabled(event.id, Boolean(value))
          "
        />
        <el-button text size="small" :icon="Delete" @click="eventStore.removeEvent(event.id)" />
      </div>

      <div v-for="action in event.actions" :key="action.id" class="action-block">
        <div class="event-row">
          <el-select
            :model-value="action.type"
            size="small"
            @change="(value: RuntimeActionType) => updateActionType(event.id, action, value)"
          >
            <el-option
              v-for="option in actionOptions"
              :key="option.value"
              :label="option.label"
              :value="option.value"
            />
          </el-select>
          <el-switch
            :model-value="action.enabled"
            size="small"
            @change="
              (value: string | number | boolean) =>
                updateActionEnabled(event.id, action, Boolean(value))
            "
          />
          <el-button
            text
            size="small"
            :icon="Delete"
            @click="eventStore.removeAction(event.id, action.id)"
          />
        </div>

        <el-input
          v-if="action.type === 'openUrl'"
          :model-value="String(action.payload.url ?? '')"
          size="small"
          placeholder="https://example.com"
          @change="(value: string) => updatePayload(event.id, action, 'url', value)"
        />
        <el-input
          v-else-if="action.type === 'playAnimation' || action.type === 'pauseAnimation'"
          :model-value="String(action.payload.clipId ?? '')"
          size="small"
          placeholder="动画片段 ID"
          @change="(value: string) => updatePayload(event.id, action, 'clipId', value)"
        />
        <div v-else-if="action.type === 'switchCamera'" class="bookmark-picker">
          <el-select
            :model-value="String(action.payload.bookmarkId ?? '')"
            size="small"
            placeholder="选择相机书签"
            clearable
            @change="(value: string) => updatePayload(event.id, action, 'bookmarkId', value)"
          >
            <el-option
              v-for="option in bookmarkOptions"
              :key="option.value"
              :label="option.label"
              :value="option.value"
            />
          </el-select>
          <el-button size="small" plain @click="captureCurrentCamera(event.id, action)">
            保存当前相机
          </el-button>
        </div>
        <div
          v-else-if="action.type === 'setObjectVisible' || action.type === 'setObjectMaterial'"
          class="payload-grid"
        >
          <el-input
            :model-value="String(action.payload.objectUuid ?? '')"
            size="small"
            placeholder="对象 UUID"
            @change="(value: string) => updatePayload(event.id, action, 'objectUuid', value)"
          />
          <el-switch
            v-if="action.type === 'setObjectVisible'"
            :model-value="Boolean(action.payload.visible)"
            size="small"
            active-text="显示"
            inactive-text="隐藏"
            @change="
              (value: string | number | boolean) =>
                updatePayload(event.id, action, 'visible', Boolean(value))
            "
          />
          <el-color-picker
            v-else
            :model-value="String(action.payload.color ?? '#409eff')"
            size="small"
            @change="(value: string | null) => updatePayload(event.id, action, 'color', value)"
          />
        </div>
        <el-input
          v-else-if="action.type === 'showPopup'"
          :model-value="String(action.payload.content ?? '')"
          type="textarea"
          :rows="2"
          size="small"
          placeholder="弹窗内容"
          @change="(value: string) => updatePayload(event.id, action, 'content', value)"
        />
        <el-input
          v-else-if="action.type === 'emitMessage'"
          :model-value="String(action.payload.name ?? '')"
          size="small"
          placeholder="消息名称"
          @change="(value: string) => updatePayload(event.id, action, 'name', value)"
        />
      </div>

      <el-button size="small" plain class="full-width" @click="addAction(event.id)">
        添加动作
      </el-button>
    </div>
  </div>
</template>

<style scoped lang="scss">
.event-panel {
  display: grid;
  gap: 10px;
}

.event-toolbar,
.event-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.event-toolbar {
  justify-content: space-between;
  color: var(--lc-text-secondary);
  font-size: 12px;
}

.event-empty {
  color: var(--lc-text-muted);
  font-size: 12px;
  padding: 8px 0;
}

.event-block,
.action-block {
  display: grid;
  gap: 8px;
  padding: 8px;
  border: 1px solid var(--lc-border-subtle);
  border-radius: var(--lc-radius-sm);
  background: var(--lc-bg-control);
}

.action-block {
  background: var(--lc-bg-elevated);
}

.payload-grid {
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  gap: 8px;
}

.bookmark-picker {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 8px;
}

.full-width {
  width: 100%;
}
</style>
