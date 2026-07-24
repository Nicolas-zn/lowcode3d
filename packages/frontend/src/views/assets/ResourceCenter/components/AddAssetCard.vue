<script setup lang="ts">
import { Icon } from '@iconify/vue'

withDefaults(
  defineProps<{
    title: string
    description?: string
    variant?: 'regular' | 'icon'
  }>(),
  {
    description: '',
    variant: 'regular',
  }
)

defineEmits<{
  (e: 'click'): void
}>()
</script>

<template>
  <button
    class="asset-card add-asset-card"
    :class="{ 'icon-card': variant === 'icon', 'add-asset-card--icon': variant === 'icon' }"
    type="button"
    @click="$emit('click')"
  >
    <div class="asset-preview add-asset-preview" :class="{ 'icon-preview': variant === 'icon' }">
      <span class="add-asset-icon">
        <Icon icon="lucide:plus" />
      </span>
    </div>
    <div class="asset-info" :class="{ minimalist: variant === 'icon' }">
      <div class="asset-name" :class="{ center: variant === 'icon' }">{{ title }}</div>
      <div v-if="description && variant !== 'icon'" class="asset-meta">{{ description }}</div>
    </div>
    <div v-if="variant !== 'icon'" class="asset-actions add-asset-spacer" />
  </button>
</template>

<style scoped lang="scss">
.add-asset-card {
  width: 100%;
  padding: 0;
  appearance: none;
  font: inherit;
  color: inherit;
  text-align: left;
  background: rgba(30, 30, 50, 0.8);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  overflow: hidden;
  cursor: pointer;
  transition:
    border-color 0.2s ease,
    box-shadow 0.2s ease,
    transform 0.2s ease;

  &:hover {
    border-color: rgba(102, 126, 234, 0.5);
    box-shadow: 0 0 0 1px rgba(102, 126, 234, 0.18);

    .add-asset-icon {
      color: #ffffff;
      background: rgba(102, 126, 234, 0.22);
      border-color: rgba(102, 126, 234, 0.58);
      transform: scale(1.04);
    }
  }
}

.add-asset-preview {
  width: 100%;
  aspect-ratio: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
  border: 1px dashed rgba(102, 126, 234, 0.38);
  background:
    linear-gradient(135deg, rgba(102, 126, 234, 0.16), rgba(118, 75, 162, 0.1)),
    rgba(30, 30, 50, 0.72) !important;
}

.add-asset-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 52px;
  height: 52px;
  color: #a6adc8;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 50%;
  transition:
    color 0.18s ease,
    background-color 0.18s ease,
    border-color 0.18s ease,
    transform 0.18s ease;

  svg {
    width: 28px;
    height: 28px;
  }
}

.asset-info {
  padding: 12px;
}

.asset-name {
  margin-bottom: 4px;
  color: #ffffff;
  font-size: 14px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.asset-meta {
  color: #6c7086;
  font-size: 12px;
}

.add-asset-spacer {
  min-height: 44px;
  opacity: 0;
}

.add-asset-card--icon {
  padding: 8px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.03);

  .add-asset-preview {
    border-radius: 4px;
  }

  .add-asset-icon {
    width: 36px;
    height: 36px;

    svg {
      width: 22px;
      height: 22px;
    }
  }

  .asset-info {
    width: 100%;
    padding: 6px 4px 4px;
  }

  .asset-name {
    width: 100%;
    margin-bottom: 0;
    color: #cdd6f4;
    font-size: 11px;
    text-align: center;
  }
}
</style>
