<script setup lang="ts">
import { onMounted } from 'vue'
import { RouterView } from 'vue-router'
import { useThemeStore } from '@/stores'

// 初始化主题
const themeStore = useThemeStore()

onMounted(() => {
  themeStore.applyTheme()
})
</script>

<template>
  <RouterView />
</template>

<style>
/* 全局重置由 main.scss 处理 */
</style>
