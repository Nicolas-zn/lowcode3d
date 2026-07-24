<script setup lang="ts">
import { computed } from 'vue'
import { DEFAULT_HOTKEYS, type IHotkeyConfig } from '@/engine'

const props = defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
}>()

const categoryText: Record<string, string> = {
  transform: '变换',
  edit: '编辑',
  view: '视图',
  tool: '工具',
  general: '通用',
}

const visible = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value),
})

const groupedHotkeys = computed(() => {
  const groups: Record<string, Array<IHotkeyConfig & { id: string; keys: string[] }>> = {}

  Object.entries(DEFAULT_HOTKEYS).forEach(([id, config]) => {
    const category = config.category || 'general'
    if (!groups[category]) {
      groups[category] = []
    }
    groups[category].push({
      ...config,
      id,
      keys: formatHotkey(config),
    })
  })

  return Object.entries(groups)
})

function formatHotkey(config: IHotkeyConfig): string[] {
  const keys: string[] = []
  if (config.ctrl) keys.push('Ctrl / Cmd')
  if (config.shift) keys.push('Shift')
  if (config.alt) keys.push('Alt')
  keys.push(config.key.length === 1 ? config.key.toUpperCase() : config.key)
  return keys
}
</script>

<template>
  <el-dialog v-model="visible" title="快捷键" width="640px" append-to-body class="shortcut-dialog">
    <div class="shortcut-grid">
      <section v-for="[category, items] in groupedHotkeys" :key="category" class="shortcut-group">
        <h3>{{ categoryText[category] || category }}</h3>
        <div class="shortcut-list">
          <div v-for="item in items" :key="item.id" class="shortcut-row">
            <span class="shortcut-desc">{{ item.description }}</span>
            <span class="shortcut-keys">
              <kbd v-for="key in item.keys" :key="key">{{ key }}</kbd>
            </span>
          </div>
        </div>
      </section>
    </div>
  </el-dialog>
</template>

<style scoped lang="scss">
.shortcut-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.shortcut-group {
  min-width: 0;
  padding: 12px;
  background: var(--lc-bg-control);
  border: 1px solid var(--lc-border-subtle);
  border-radius: var(--lc-radius-md);

  h3 {
    margin: 0 0 10px;
    color: var(--lc-text-primary);
    font-size: 13px;
  }
}

.shortcut-list {
  display: grid;
  gap: 7px;
}

.shortcut-row {
  min-width: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
}

.shortcut-desc {
  min-width: 0;
  overflow: hidden;
  color: var(--lc-text-secondary);
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.shortcut-keys {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

kbd {
  min-width: 22px;
  height: 22px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0 6px;
  color: var(--lc-text-primary);
  background: var(--lc-bg-panel-raised);
  border: 1px solid var(--lc-border-strong);
  border-bottom-color: rgba(255, 255, 255, 0.22);
  border-radius: var(--lc-radius-sm);
  font-family: var(--lc-font-mono);
  font-size: 11px;
  box-shadow: inset 0 -1px 0 rgba(255, 255, 255, 0.08);
}

@media (max-width: 680px) {
  .shortcut-grid {
    grid-template-columns: 1fr;
  }
}
</style>
