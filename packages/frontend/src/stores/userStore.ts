/**
 * 用户状态管理
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { authApi } from '@/api'
import { clearToken } from '@/api/http'
import type { User } from '@/api/auth'

export const useUserStore = defineStore(
  'user',
  () => {
    // 状态
    const user = ref<User | null>(null)
    const loading = ref(false)
    const error = ref<string | null>(null)

    // 计算属性
    const isLoggedIn = computed(() => !!user.value)
    const userId = computed(() => user.value?.id || '')
    const nickname = computed(() => user.value?.nickname || user.value?.email || '')
    const userRole = computed(() => user.value?.role || 'user')
    const isTempUser = computed(() => user.value?.role === 'tempuser')

    // 登录
    async function login(email: string, password: string) {
      loading.value = true
      error.value = null
      try {
        const result = await authApi.login({ email, password })

        user.value = result.user
        console.log(result.user)

        return result
      } catch (e) {
        error.value = e instanceof Error ? e.message : '登录失败'
        throw e
      } finally {
        loading.value = false
      }
    }

    // 注册
    async function register(email: string, password: string, nickname?: string) {
      loading.value = true
      error.value = null
      try {
        const result = await authApi.register({ email, password, nickname })
        user.value = result.user
        return result
      } catch (e) {
        error.value = e instanceof Error ? e.message : '注册失败'
        throw e
      } finally {
        loading.value = false
      }
    }

    // 获取当前用户信息
    async function fetchUser() {
      const token = localStorage.getItem('token')
      if (!token) return null

      loading.value = true
      error.value = null
      try {
        const userData = await authApi.getCurrentUser()
        user.value = userData
        return userData
      } catch (e) {
        user.value = null
        error.value = e instanceof Error ? e.message : '获取用户信息失败'
        return null
      } finally {
        loading.value = false
      }
    }

    // 登出
    function logout() {
      user.value = null
      clearToken()
    }

    return {
      // 状态
      user,
      loading,
      error,
      // 计算属性
      isLoggedIn,
      userId,
      nickname,
      userRole,
      isTempUser,
      // 方法
      login,
      register,
      fetchUser,
      logout,
    }
  },
  {
    persist: {
      // 只持久化 user 字段
      pick: ['user'],
    },
  }
)
