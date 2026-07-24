<script setup lang="ts">
import type { Component } from 'vue'

withDefaults(
  defineProps<{
    icon?: Component
    title: string
    description?: string
    primaryAction?: string
    secondaryAction?: string
    compact?: boolean
  }>(),
  {
    icon: undefined,
    description: '',
    primaryAction: '',
    secondaryAction: '',
    compact: false,
  }
)

const emit = defineEmits<{
  (e: 'primary'): void
  (e: 'secondary'): void
}>()
</script>

<template>
  <div class="empty-state" :class="{ 'is-compact': compact }">
    <div v-if="icon" class="empty-icon">
      <el-icon>
        <component :is="icon" />
      </el-icon>
    </div>
    <div class="empty-title">{{ title }}</div>
    <div v-if="description" class="empty-description">{{ description }}</div>
    <div v-if="primaryAction || secondaryAction" class="empty-actions">
      <el-button v-if="secondaryAction" @click="emit('secondary')">
        {{ secondaryAction }}
      </el-button>
      <el-button v-if="primaryAction" type="primary" @click="emit('primary')">
        {{ primaryAction }}
      </el-button>
    </div>
  </div>
</template>

<style scoped lang="scss">
.empty-state {
  min-height: 180px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--lc-space-2);
  padding: var(--lc-space-5);
  color: var(--lc-text-secondary);
  text-align: center;

  &.is-compact {
    min-height: 112px;
    padding: var(--lc-space-4);
  }
}

.empty-icon {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--lc-border-subtle);
  border-radius: var(--lc-radius-lg);
  color: var(--lc-accent);
  background: var(--lc-bg-control);
  font-size: 20px;
}

.empty-title {
  color: var(--lc-text-primary);
  font-size: 13px;
  font-weight: 600;
}

.empty-description {
  max-width: 280px;
  color: var(--lc-text-muted);
  font-size: 12px;
  line-height: 18px;
}

.empty-actions {
  display: flex;
  gap: var(--lc-space-2);
  margin-top: var(--lc-space-2);
}
</style>
