<script setup lang="ts">
import { Icon } from '@iconify/vue'

defineOptions({
  inheritAttrs: false,
})

withDefaults(
  defineProps<{
    icon: string
    tooltip?: string
    active?: boolean
    danger?: boolean
    disabled?: boolean
  }>(),
  {
    tooltip: '',
    active: false,
    danger: false,
    disabled: false,
  }
)

defineEmits<{
  (e: 'click', event: MouseEvent): void
}>()
</script>

<template>
  <span class="editor-icon-button__trigger">
    <el-tooltip v-if="tooltip" :content="tooltip" placement="bottom">
      <button
        v-bind="$attrs"
        class="editor-icon-button"
        :class="{ 'is-active': active, 'is-danger': danger }"
        :disabled="disabled"
        type="button"
        @click="$emit('click', $event)"
      >
        <Icon :icon="icon" />
      </button>
    </el-tooltip>
    <button
      v-else
      v-bind="$attrs"
      class="editor-icon-button"
      :class="{ 'is-active': active, 'is-danger': danger }"
      :disabled="disabled"
      type="button"
      @click="$emit('click', $event)"
    >
      <Icon :icon="icon" />
    </button>
  </span>
</template>

<style scoped lang="scss">
.editor-icon-button__trigger {
  display: inline-flex;
}

.editor-icon-button {
  width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  color: var(--lc-text-secondary);
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--lc-radius-sm);
  cursor: pointer;
  transition:
    color 0.15s ease,
    background-color 0.15s ease,
    border-color 0.15s ease;

  &:hover:not(:disabled) {
    color: var(--lc-text-primary);
    background: var(--lc-bg-control-hover);
  }

  &.is-active {
    color: var(--lc-accent);
    background: var(--lc-panel-nav-active-bg);
    border-color: rgba(79, 140, 255, 0.28);
  }

  &.is-danger {
    color: var(--lc-error);
  }

  &:disabled {
    color: var(--lc-text-disabled);
    cursor: not-allowed;
  }
}
</style>
