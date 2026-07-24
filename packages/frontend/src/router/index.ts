import { createRouter, createWebHashHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'
import { useEditorStateStore } from '@/stores/editorStateStore'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    redirect: '/assets',
  },
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/Login.vue'),
    meta: { title: '登录', requiresAuth: false },
  },
  {
    path: '/assets',
    name: 'Assets',
    component: () => import('@/views/assets/index.vue'),
    meta: { title: '资源中心', requiresAuth: true },
  },
  {
    path: '/editor/:id',
    name: 'Editor',
    component: () => import('@/views/Editor.vue'),
    meta: { title: '3D 编辑器', requiresAuth: true },
  },
  {
    path: '/preview/:id',
    name: 'Preview',
    component: () => import('@/views/Preview.vue'),
    meta: { title: '场景预览', requiresAuth: false },
  },
  {
    path: '/401',
    name: 'Unauthorized',
    component: () => import('@/views/error/401.vue'),
    meta: { title: '未授权', requiresAuth: false },
  },
  {
    path: '/404',
    name: 'NotFound',
    component: () => import('@/views/error/404.vue'),
    meta: { title: '页面未找到', requiresAuth: false },
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'CatchAll',
    component: () => import('@/views/error/404.vue'),
    meta: { title: '页面未找到', requiresAuth: false },
  },
]

const router = createRouter({
  history: createWebHashHistory(),
  routes,
})

// 路由守卫 - 认证检查和动态设置标题
router.beforeEach(async (to, from, next) => {
  // 动态设置标题
  document.title = `editor3D | ${to.meta.title || 'editor3D'} `

  // 检查是否从编辑器页面离开
  // 使用 path 匹配更可靠，因为 name 在某些情况下可能为 undefined
  const isLeavingEditor =
    (from.name === 'Editor' || from.path?.startsWith('/editor/')) &&
    to.name !== 'Editor' &&
    !to.path?.startsWith('/editor/')

  if (isLeavingEditor) {
    const editorStateStore = useEditorStateStore()
    console.log('[Router Guard] Leaving Editor page, checking before leave...', {
      from: { name: from.name, path: from.path },
      to: { name: to.name, path: to.path },
      hasUnsavedChanges: editorStateStore.hasUnsavedChanges,
      isShowingDialog: editorStateStore.isShowingDialog,
    })

    // 先阻止路由跳转，等待用户确认
    // 如果是浏览器后退等操作，重置确认标志，确保提示能正常显示
    // 只有在按钮点击等主动操作时，才使用 hasConfirmedLeave 标志
    try {
      const canLeave = await editorStateStore.checkBeforeLeave(true) // 标记为路由守卫调用
      console.log('[Router Guard] Can leave:', canLeave)
      if (!canLeave) {
        // 用户取消离开，阻止路由跳转
        next(false)
        return
      }
    } catch (error) {
      // 如果对话框显示失败，也阻止路由跳转
      console.error('[Router Guard] Error showing dialog:', error)
      next(false)
      return
    }
  }

  // 检查是否需要认证
  const requiresAuth = to.meta.requiresAuth !== false
  const token = localStorage.getItem('token')

  if (requiresAuth && !token) {
    // 需要认证但没有 token
    if (to.name === 'Editor' && to.params.id) {
      // 如果是访问编辑器且有 ID，跳转到预览页
      next({ name: 'Preview', params: { id: to.params.id } })
    } else {
      // 其他情况跳转登录页
      next({ name: 'Login', query: { redirect: to.fullPath } })
    }
  } else if (to.name === 'Login' && token) {
    // 已登录用户访问登录页，跳转项目管理
    next({ name: 'Assets' })
  } else {
    next()
  }
})

export default router
