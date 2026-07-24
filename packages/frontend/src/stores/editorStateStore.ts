/**
 * 编辑器状态管理
 * 跟踪场景修改状态，处理未保存提示
 */
import { defineStore } from 'pinia'
import { ref, computed, nextTick } from 'vue'
import { ElMessageBox } from 'element-plus'
import { SceneSerializer } from '@/engine/core/SceneSerializer'
import { useProjectStore } from './projectStore'

export const useEditorStateStore = defineStore('editorState', () => {
  // 状态
  const hasUnsavedChanges = ref(false)
  const lastSaveTime = ref<Date | null>(null)
  const lastModifyTime = ref<Date | null>(null)
  const savedSceneSignature = ref<string | null>(null)
  const isShowingDialog = ref(false) // 防止重复弹窗
  const isRouterGuardHandling = ref(false) // 路由守卫正在处理中
  const hasConfirmedLeave = ref(false) // 用户已确认离开（用于避免路由守卫重复提示）
  let pendingDialogPromise: Promise<boolean> | null = null // 共享的对话框 Promise

  // 计算属性
  const isDirty = computed(() => hasUnsavedChanges.value)
  const canLeave = computed(() => !hasUnsavedChanges.value)

  /**
   * 标记场景已修改
   */
  function markAsModified(): void {
    hasUnsavedChanges.value = true
    lastModifyTime.value = new Date()
    console.log('Scene marked as modified')
  }

  /**
   * 标记场景已保存
   */
  function markAsSaved(signature?: string | null): void {
    hasUnsavedChanges.value = false
    lastSaveTime.value = new Date()
    savedSceneSignature.value = signature ?? captureSceneSignature()
    console.log('Scene marked as saved')
  }

  function captureSceneSignature(): string | null {
    try {
      const projectStore = useProjectStore()
      const project = projectStore.currentProject
      const sceneData = SceneSerializer.serialize(project?.name || 'Untitled', project?.description)
      const signature = sanitizeSignatureData(sceneData) as Record<string, unknown>
      if (signature) {
        delete signature.createdAt
        delete signature.updatedAt
        if (
          typeof signature.assetManifest === 'object' &&
          signature.assetManifest !== null &&
          'generatedAt' in signature.assetManifest
        ) {
          delete (signature.assetManifest as Record<string, unknown>).generatedAt
        }
      }
      return JSON.stringify(signature)
    } catch (error) {
      console.warn('Failed to capture scene signature:', error)
      return null
    }
  }

  function sanitizeSignatureData(value: unknown, seen = new WeakSet<object>()): unknown {
    if (value === null) return null

    const valueType = typeof value
    if (valueType === 'string' || valueType === 'number' || valueType === 'boolean') {
      return value
    }
    if (valueType === 'undefined' || valueType === 'function' || valueType === 'symbol') {
      return undefined
    }
    if (typeof Window !== 'undefined' && value instanceof Window) {
      return undefined
    }
    if (value instanceof Date) {
      return value.toISOString()
    }
    if (Array.isArray(value)) {
      return value.map((item) => sanitizeSignatureData(item, seen))
    }
    if (typeof value === 'object') {
      if (seen.has(value)) return undefined
      seen.add(value)

      const result: Record<string, unknown> = {}
      for (const [key, item] of Object.entries(value)) {
        const nextValue = sanitizeSignatureData(item, seen)
        if (nextValue !== undefined) {
          result[key] = nextValue
        }
      }
      seen.delete(value)
      return result
    }

    return undefined
  }

  function syncDirtyState(): void {
    const currentSignature = captureSceneSignature()
    if (!currentSignature || !savedSceneSignature.value) {
      return
    }
    hasUnsavedChanges.value = currentSignature !== savedSceneSignature.value
    if (hasUnsavedChanges.value) {
      lastModifyTime.value = new Date()
    }
  }

  /**
   * 重置状态
   */
  function reset(): void {
    hasUnsavedChanges.value = false
    lastSaveTime.value = null
    lastModifyTime.value = null
    savedSceneSignature.value = null
    isShowingDialog.value = false
    isRouterGuardHandling.value = false
    hasConfirmedLeave.value = false
    pendingDialogPromise = null
  }

  /**
   * 检查是否可以离开页面（用于路由跳转）
   * 如果有未保存的更改，显示确认对话框
   * @param isRouterGuard 是否为路由守卫调用（用于区分不同的调用来源）
   */
  async function checkBeforeLeave(isRouterGuard = false): Promise<boolean> {
    console.log('[checkBeforeLeave] Called', {
      isRouterGuard,
      hasUnsavedChanges: hasUnsavedChanges.value,
      hasConfirmedLeave: hasConfirmedLeave.value,
      isShowingDialog: isShowingDialog.value,
      pendingDialogPromise: !!pendingDialogPromise,
    })

    if (!hasUnsavedChanges.value) {
      console.log('[checkBeforeLeave] No unsaved changes, allowing leave')
      return true
    }

    // 如果是路由守卫调用，先检查是否有待处理的确认标志
    // 这个标志只在按钮点击等主动操作时设置，用于避免重复提示
    if (isRouterGuard) {
      if (hasConfirmedLeave.value) {
        // 用户已经通过按钮等主动操作确认离开，直接允许
        console.log('[checkBeforeLeave] Router guard: hasConfirmedLeave is true, allowing leave')
        hasConfirmedLeave.value = false // 重置标志，确保只使用一次
        return true
      }
      // 如果是路由守卫调用（如浏览器后退），总是显示提示，不使用 hasConfirmedLeave
      console.log('[checkBeforeLeave] Router guard: will show dialog')
    }

    // 如果已经有对话框在显示，返回共享的 Promise 结果
    if (pendingDialogPromise) {
      console.log('[checkBeforeLeave] Dialog already showing, returning existing promise')
      return pendingDialogPromise
    }

    // 标记路由守卫正在处理，防止 beforeunload 同时触发
    console.log('[checkBeforeLeave] Creating new dialog')
    isRouterGuardHandling.value = true
    isShowingDialog.value = true
    pendingDialogPromise = (async () => {
      try {
        // 等待 DOM 更新和下一个事件循环，确保对话框能正确显示
        await nextTick()
        // 使用 setTimeout 确保在下一个事件循环中显示对话框
        // 这对于路由守卫中的对话框显示很重要
        await new Promise((resolve) => setTimeout(resolve, 10))
        console.log('[checkBeforeLeave] Showing dialog...', {
          ElMessageBox: typeof ElMessageBox,
          confirm: typeof ElMessageBox?.confirm,
        })

        if (!ElMessageBox || typeof ElMessageBox.confirm !== 'function') {
          console.error('[checkBeforeLeave] ElMessageBox.confirm is not available')
          // 如果 ElMessageBox 不可用，使用原生 confirm
          const confirmed = window.confirm('当前项目有未保存的更改，离开页面将丢失这些更改。')
          if (confirmed) {
            if (!isRouterGuard) {
              hasConfirmedLeave.value = true
            }
            return true
          }
          return false
        }

        const result = await ElMessageBox.confirm(
          '当前项目有未保存的更改，离开页面将丢失这些更改。',
          '有未保存的项目',
          {
            confirmButtonText: '离开页面',
            cancelButtonText: '继续编辑',
            type: 'warning',
            dangerouslyUseHTMLString: false,
          }
        )
        console.log('[checkBeforeLeave] User confirmed leave', result)
        // 用户确认离开，设置标志以避免路由守卫重复提示
        // 但只在非路由守卫调用时设置（即按钮点击等主动操作）
        if (!isRouterGuard) {
          hasConfirmedLeave.value = true
        }
        return true
      } catch (error) {
        // 用户取消离开或对话框显示失败
        console.log('[checkBeforeLeave] User cancelled leave or error:', error)
        return false
      } finally {
        isShowingDialog.value = false
        isRouterGuardHandling.value = false
        pendingDialogPromise = null
        console.log('[checkBeforeLeave] Dialog closed, state reset')
      }
    })()

    return pendingDialogPromise
  }

  /**
   * 浏览器原生的 beforeunload 事件处理（仅用于浏览器刷新/关闭）
   * 注意：如果路由守卫正在处理，则不显示 beforeunload 提示，避免重复提示
   */
  function handleBeforeUnload(event: BeforeUnloadEvent): string | undefined {
    // 如果路由守卫正在处理或已经有对话框在显示，则不显示 beforeunload 提示
    if (isRouterGuardHandling.value || isShowingDialog.value) {
      return undefined
    }

    // 只在没有显示对话框时才处理 beforeunload
    if (hasUnsavedChanges.value) {
      const message = '当前项目有未保存的更改，确定要离开吗？'
      event.preventDefault()
      event.returnValue = message
      return message
    }
  }

  /**
   * 安装浏览器离开页面监听
   */
  function installBeforeUnloadListener(): void {
    window.addEventListener('beforeunload', handleBeforeUnload)
  }

  /**
   * 卸载浏览器离开页面监听
   */
  function uninstallBeforeUnloadListener(): void {
    window.removeEventListener('beforeunload', handleBeforeUnload)
  }

  return {
    // 状态
    hasUnsavedChanges,
    lastSaveTime,
    lastModifyTime,
    savedSceneSignature,
    isShowingDialog,
    // 计算属性
    isDirty,
    canLeave,
    // 方法
    markAsModified,
    markAsSaved,
    captureSceneSignature,
    syncDirtyState,
    reset,
    checkBeforeLeave,
    installBeforeUnloadListener,
    uninstallBeforeUnloadListener,
  }
})
