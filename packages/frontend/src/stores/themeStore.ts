/**
 * 主题管理 Store
 * 控制应用的主题模式
 */
import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'

export type ThemeMode = 'auto' | 'light' | 'dark'

export const useThemeStore = defineStore('theme', () => {
  // 用户选择的主题模式
  const mode = ref<ThemeMode>((localStorage.getItem('theme-mode') as ThemeMode) || 'dark')

  // 系统偏好
  const systemPrefersDark = ref(window.matchMedia('(prefers-color-scheme: dark)').matches)

  // 实际应用的主题
  const actualTheme = computed(() => {
    if (mode.value === 'auto') {
      return systemPrefersDark.value ? 'dark' : 'light'
    }
    return mode.value
  })

  // 是否是暗色主题
  const isDark = computed(() => actualTheme.value === 'dark')

  /**
   * 设置主题模式
   */
  function setMode(newMode: ThemeMode): void {
    mode.value = newMode
    localStorage.setItem('theme-mode', newMode)
  }

  /**
   * 切换主题
   */
  function toggleTheme(): void {
    if (mode.value === 'dark') {
      setMode('light')
    } else if (mode.value === 'light') {
      setMode('auto')
    } else {
      setMode('dark')
    }
  }

  /**
   * 应用主题到 DOM
   */
  function applyTheme(): void {
    const html = document.documentElement
    const body = document.body

    if (isDark.value) {
      html.classList.add('dark')
      html.classList.remove('light')
      body.classList.add('dark')
      body.classList.remove('light')
    } else {
      html.classList.add('light')
      html.classList.remove('dark')
      body.classList.add('light')
      body.classList.remove('dark')
    }
  }

  // 监听系统主题变化
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
  mediaQuery.addEventListener('change', (e) => {
    systemPrefersDark.value = e.matches
    applyTheme()
  })

  // 监听主题变化并应用
  watch(
    actualTheme,
    () => {
      applyTheme()
    },
    { immediate: true }
  )

  return {
    mode,
    actualTheme,
    isDark,
    setMode,
    toggleTheme,
    applyTheme,
  }
})
