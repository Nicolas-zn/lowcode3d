<script setup lang="ts">
import { Icon } from '@iconify/vue'

interface EditorSidebarNavItem {
  id: string
  label: string
  icon: string
  tooltip: string
  badge?: string
  disabled?: boolean
}

defineProps<{
  items: EditorSidebarNavItem[]
  modelValue: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
}>()
</script>

<template>
  <nav class="editor-sidebar-nav">
    <button
      v-for="item in items"
      :key="item.id"
      class="editor-sidebar-nav__item"
      :class="{ 'is-active': modelValue === item.id }"
      type="button"
      :disabled="item.disabled"
      :title="item.tooltip"
      @click="emit('update:modelValue', item.id)"
    >
      <Icon :icon="item.icon" />
      <span v-if="item.badge" class="editor-sidebar-nav__badge">{{ item.badge }}</span>
    </button>
  </nav>
</template>

<style scoped lang="scss">
.editor-sidebar-nav {
  width: var(--lc-left-nav-width);
  display: flex;
  flex-direction: column;
  padding: 8px 0;
  background: var(--lc-bg-panel-raised);
  border-right: 1px solid var(--lc-border-subtle);

  &__item {
    position: relative;
    width: 48px;
    height: 48px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--lc-text-secondary);
    background: transparent;
    border: 0;
    cursor: pointer;
    transition:
      color 0.15s ease,
      background-color 0.15s ease;

    &:hover:not(:disabled) {
      color: var(--lc-text-primary);
      background: var(--lc-panel-nav-hover-bg);
    }

    &.is-active {
      color: var(--lc-accent);
      background: var(--lc-panel-nav-active-bg);

      &::before {
        content: '';
        position: absolute;
        left: 0;
        top: 50%;
        width: 3px;
        height: 24px;
        transform: translateY(-50%);
        border-radius: 0 3px 3px 0;
        background: var(--lc-accent);
      }
    }

    &:disabled {
      color: var(--lc-text-disabled);
      cursor: not-allowed;
    }
  }

  &__badge {
    position: absolute;
    top: 8px;
    right: 8px;
    min-width: 16px;
    height: 16px;
    padding: 0 4px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 999px;
    background: var(--lc-error);
    color: var(--lc-text-inverse);
    font-size: 10px;
    line-height: 1;
  }
}
</style>
