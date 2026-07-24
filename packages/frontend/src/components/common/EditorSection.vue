<script setup lang="ts">
import { Icon } from '@iconify/vue'

withDefaults(
  defineProps<{
    title: string
    icon?: string
    open?: boolean
  }>(),
  {
    icon: undefined,
    open: true,
  }
)

defineEmits<{
  (e: 'toggle'): void
}>()
</script>

<template>
  <section class="editor-section">
    <button class="editor-section__header" type="button" @click="$emit('toggle')">
      <span class="editor-section__title">
        <el-icon v-if="icon" class="editor-section__icon">
          <Icon :icon="icon" />
        </el-icon>
        {{ title }}
      </span>
      <span class="editor-section__arrow" :class="{ 'is-open': open }">▾</span>
    </button>
    <div v-show="open" class="editor-section__body">
      <slot />
    </div>
  </section>
</template>

<style scoped lang="scss">
.editor-section {
  border-bottom: 1px solid var(--lc-border-subtle);
  background: var(--lc-bg-panel);

  &__header {
    width: 100%;
    min-height: 40px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 0 12px;
    color: var(--lc-text-primary);
    background: var(--lc-panel-section-bg);
    border: 0;
    cursor: pointer;

    &:hover {
      background: var(--lc-bg-control-hover);
    }
  }

  &__title {
    min-width: 0;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 14px;
    font-weight: 600;
  }

  &__icon {
    color: var(--lc-accent);
  }

  &__arrow {
    flex-shrink: 0;
    color: var(--lc-text-muted);
    font-size: 13px;
    transition: transform 0.15s ease;

    &.is-open {
      transform: rotate(180deg);
    }
  }

  &__body {
    padding: 0;
  }
}
</style>
