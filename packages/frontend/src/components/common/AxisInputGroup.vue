<script setup lang="ts">
defineProps<{
  x: number | null
  y: number | null
  z: number | null
  step?: number
  min?: number
  placeholder?: string
}>()

const emit = defineEmits<{
  (e: 'update:x', value: number | null): void
  (e: 'update:y', value: number | null): void
  (e: 'update:z', value: number | null): void
  (e: 'change'): void
}>()
</script>

<template>
  <div class="axis-input-group">
    <el-input-number
      :model-value="x"
      :controls="false"
      :step="step ?? 0.1"
      :min="min"
      :placeholder="placeholder ?? 'X'"
      size="small"
      @update:model-value="(value) => emit('update:x', value ?? null)"
      @change="emit('change')"
    />
    <el-input-number
      :model-value="y"
      :controls="false"
      :step="step ?? 0.1"
      :min="min"
      :placeholder="placeholder ?? 'Y'"
      size="small"
      @update:model-value="(value) => emit('update:y', value ?? null)"
      @change="emit('change')"
    />
    <el-input-number
      :model-value="z"
      :controls="false"
      :step="step ?? 0.1"
      :min="min"
      :placeholder="placeholder ?? 'Z'"
      size="small"
      @update:model-value="(value) => emit('update:z', value ?? null)"
      @change="emit('change')"
    />
  </div>
</template>

<style scoped lang="scss">
.axis-input-group {
  width: 100%;
  min-width: 0;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px;

  :deep(.el-input-number) {
    width: 100%;
    min-width: 0;
  }

  :deep(.el-input__inner) {
    text-align: center;
    font-size: 13px;
    font-weight: 500;
  }

  :deep(.el-input__wrapper) {
    min-height: 30px;
    padding: 0 6px;
    background: var(--lc-bg-control);
    box-shadow: 0 0 0 1px var(--lc-border-subtle) inset;
  }

  :deep(.el-input__wrapper:hover) {
    box-shadow: 0 0 0 1px var(--lc-border-strong) inset;
  }

  :deep(.el-input__wrapper.is-focus) {
    box-shadow: 0 0 0 1px var(--lc-border-focus) inset;
  }
}
</style>
