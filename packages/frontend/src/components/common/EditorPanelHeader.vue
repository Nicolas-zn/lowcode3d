<script setup lang="ts">
import { Icon } from '@iconify/vue'

withDefaults(
  defineProps<{
    icon?: string
    title: string
    subtitle?: string
  }>(),
  {
    icon: undefined,
    subtitle: '',
  }
)
</script>

<template>
  <div class="editor-panel-header">
    <div class="editor-panel-header__main">
      <div v-if="icon" class="editor-panel-header__icon">
        <Icon :icon="icon" />
      </div>
      <div class="editor-panel-header__text">
        <div class="editor-panel-header__title">
          <slot name="title">
            {{ title }}
          </slot>
        </div>
        <div v-if="subtitle" class="editor-panel-header__subtitle">{{ subtitle }}</div>
      </div>
    </div>
    <div v-if="$slots.actions" class="editor-panel-header__actions">
      <slot name="actions" />
    </div>
  </div>
</template>

<style scoped lang="scss">
.editor-panel-header {
  min-height: 48px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 12px;
  background: linear-gradient(180deg, var(--lc-bg-panel-raised), var(--lc-bg-panel));
  border-bottom: 1px solid var(--lc-border-subtle);

  &__main {
    min-width: 0;
    flex: 1;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  &__icon {
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--lc-accent);
    background: var(--lc-bg-control);
    border: 1px solid var(--lc-border-subtle);
    border-radius: var(--lc-radius-sm);
  }

  &__text {
    min-width: 0;
    flex: 1;
  }

  &__title {
    min-width: 0;
    color: var(--lc-text-primary);
    font-size: 14px;
    font-weight: 600;
    line-height: 1.25;
  }

  &__subtitle {
    margin-top: 2px;
    color: var(--lc-text-muted);
    font-size: 12px;
    line-height: 1.2;
  }

  &__actions {
    display: flex;
    align-items: center;
    gap: 4px;
    flex-shrink: 0;
  }
}
</style>
