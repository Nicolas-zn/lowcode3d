<script setup lang="ts">
import { computed } from 'vue'
import { getGroupedMaterials, type IPresetMaterial } from '@/data/presetMaterials'

// 使用共享的预设材质
const groupedMaterials = computed(() => getGroupedMaterials())

// 获取材质预览样式
function getMaterialStyle(mat: IPresetMaterial): Record<string, string> {
  const style: Record<string, string> = {
    backgroundColor: mat.color,
  }

  // 金属材质添加光泽效果
  if (mat.metalness > 0.5) {
    style.background = `linear-gradient(135deg, ${mat.color} 0%, ${lightenColor(mat.color, 40)} 50%, ${mat.color} 100%)`
  }

  // 发光材质添加发光效果
  if (mat.emissive && mat.emissive !== '#000000') {
    style.boxShadow = `0 0 12px ${mat.emissive}, inset 0 0 8px ${mat.emissive}`
  }

  // 透明材质
  if (mat.opacity && mat.opacity < 1) {
    style.opacity = String(0.5 + mat.opacity * 0.5)
  }

  return style
}

// 颜色变亮
function lightenColor(color: string, percent: number): string {
  const num = parseInt(color.replace('#', ''), 16)
  const amt = Math.round(2.55 * percent)
  const R = Math.min(255, (num >> 16) + amt)
  const G = Math.min(255, ((num >> 8) & 0x00ff) + amt)
  const B = Math.min(255, (num & 0x0000ff) + amt)
  return `#${((1 << 24) + (R << 16) + (G << 8) + B).toString(16).slice(1)}`
}
</script>

<template>
  <div v-for="(materials, category) in groupedMaterials" :key="category" class="material-group">
    <div class="material-group-header">{{ category }}</div>
    <div class="material-grid">
      <div
        v-for="mat in materials"
        :key="mat.id"
        class="material-card"
        :title="`${mat.name}\n金属度: ${mat.metalness}\n粗糙度: ${mat.roughness}`"
      >
        <div class="material-preview" :style="getMaterialStyle(mat)">
          <div class="material-sphere"></div>
        </div>
        <div class="material-name">{{ mat.name }}</div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
@import '../styles.scss';
</style>
