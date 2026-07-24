<script setup lang="ts">
import type { Component } from 'vue'

withDefaults(
  defineProps<{
    label: string
    tone?: 'neutral' | 'info' | 'success' | 'warning' | 'error' | 'local'
    icon?: Component
    compact?: boolean
  }>(),
  {
    tone: 'neutral',
    icon: undefined,
    compact: false,
  }
)
</script>

<template>
  <span class="status-badge" :class="[`is-${tone}`, { 'is-compact': compact }]">
    <el-icon v-if="icon">
      <component :is="icon" />
    </el-icon>
    {{ label }}
  </span>
</template>

<style scoped lang="scss">
.status-badge {
  min-width: 0;
  height: 22px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 0 7px;
  color: var(--lc-text-secondary);
  background: var(--lc-bg-control);
  border: 1px solid var(--lc-border-subtle);
  border-radius: var(--lc-radius-sm);
  font-size: 11px;
  line-height: 1;
  white-space: nowrap;

  &.is-compact {
    height: 18px;
    padding: 0 6px;
  }

  &.is-info {
    color: var(--lc-info);
    border-color: rgba(79, 140, 255, 0.36);
  }

  &.is-success {
    color: var(--lc-success);
    border-color: rgba(53, 196, 107, 0.36);
  }

  &.is-warning {
    color: var(--lc-warning);
    border-color: rgba(245, 165, 36, 0.36);
  }

  &.is-error {
    color: var(--lc-error);
    border-color: rgba(255, 92, 92, 0.36);
  }

  &.is-local {
    color: var(--lc-local);
    border-color: rgba(183, 124, 255, 0.36);
  }
}
</style>
