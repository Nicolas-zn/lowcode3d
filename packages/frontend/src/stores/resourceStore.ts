/**
 * 资源管理 Store
 * 管理模型、纹理等资源的加载和缓存
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import * as THREE from 'three'
import { getModelLoader, type IModelLoadResult } from '@/engine/loaders'

/**
 * 资源类型
 */
export type ResourceType = 'model' | 'texture' | 'material' | 'hdri'

/**
 * 资源状态
 */
export type ResourceStatus = 'idle' | 'loading' | 'loaded' | 'error'

/**
 * 资源项
 */
export interface IResourceItem {
  id: string
  name: string
  type: ResourceType
  url: string
  thumbnailUrl?: string
  status: ResourceStatus
  progress: number
  error?: string
  metadata?: Record<string, unknown>
}

/**
 * 模型库项（预定义模型）
 */
export interface IModelLibraryItem {
  id: string
  name: string
  category: string
  url: string
  thumbnailUrl: string
  description?: string
  tags?: string[]
}

/**
 * 缓存的模型数据
 */
interface CachedModel {
  result: IModelLoadResult
  loadedAt: number
}

export type AssetShortcutType = 'model' | 'material' | 'annotation' | 'component'

export interface IAssetShortcut {
  id: string
  type: AssetShortcutType
  name: string
  thumbnailUrl?: string
  usedAt: number
}

const RECENT_ASSETS_STORAGE_KEY = 'lowcode3d_recent_assets_v1'
const FAVORITE_ASSETS_STORAGE_KEY = 'lowcode3d_favorite_assets_v1'
const MAX_RECENT_ASSETS = 12

export const useResourceStore = defineStore('resource', () => {
  // ==================== State ====================

  /** 资源列表 */
  const resources = ref<Map<string, IResourceItem>>(new Map())

  /** 模型缓存 */
  const modelCache = ref<Map<string, CachedModel>>(new Map())

  /** 模型库（预定义模型列表） */
  const modelLibrary = ref<IModelLibraryItem[]>([
    // 基础几何体
    {
      id: 'primitive-box',
      name: '立方体',
      category: '基础形状',
      url: '__primitive__:box',
      thumbnailUrl: '/assets/thumbnails/cube.png',
      tags: ['primitive', 'basic'],
    },
    {
      id: 'primitive-sphere',
      name: '球体',
      category: '基础形状',
      url: '__primitive__:sphere',
      thumbnailUrl: '/assets/thumbnails/sphere.png',
      tags: ['primitive', 'basic'],
    },
    {
      id: 'primitive-cylinder',
      name: '圆柱体',
      category: '基础形状',
      url: '__primitive__:cylinder',
      thumbnailUrl: '/assets/thumbnails/cylinder.png',
      tags: ['primitive', 'basic'],
    },
    {
      id: 'primitive-cone',
      name: '圆锥体',
      category: '基础形状',
      url: '__primitive__:cone',
      thumbnailUrl: '/assets/thumbnails/cone.png',
      tags: ['primitive', 'basic'],
    },
    {
      id: 'primitive-torus',
      name: '圆环',
      category: '基础形状',
      url: '__primitive__:torus',
      thumbnailUrl: '/assets/thumbnails/torus.png',
      tags: ['primitive', 'basic'],
    },
    {
      id: 'primitive-plane',
      name: '平面',
      category: '基础形状',
      url: '__primitive__:plane',
      thumbnailUrl: '/assets/thumbnails/plane.png',
      tags: ['primitive', 'basic'],
    },
    {
      id: 'primitive-circle',
      name: '圆片',
      category: '基础形状',
      url: '__primitive__:circle',
      thumbnailUrl: '/assets/thumbnails/circle.png',
      tags: ['primitive', 'basic'],
    },
    {
      id: 'primitive-ring',
      name: '圆环片',
      category: '基础形状',
      url: '__primitive__:ring',
      thumbnailUrl: '/assets/thumbnails/ring.png',
      tags: ['primitive', 'basic'],
    },
    {
      id: 'primitive-tetrahedron',
      name: '四面体',
      category: '基础形状',
      url: '__primitive__:tetrahedron',
      thumbnailUrl: '/assets/thumbnails/tetrahedron.png',
      tags: ['primitive', 'basic'],
    },
    {
      id: 'primitive-octahedron',
      name: '八面体',
      category: '基础形状',
      url: '__primitive__:octahedron',
      thumbnailUrl: '/assets/thumbnails/octahedron.png',
      tags: ['primitive', 'basic'],
    },
    {
      id: 'primitive-icosahedron',
      name: '二十面体',
      category: '基础形状',
      url: '__primitive__:icosahedron',
      thumbnailUrl: '/assets/thumbnails/icosahedron.png',
      tags: ['primitive', 'basic'],
    },
    {
      id: 'primitive-dodecahedron',
      name: '十二面体',
      category: '基础形状',
      url: '__primitive__:dodecahedron',
      thumbnailUrl: '/assets/thumbnails/dodecahedron.png',
      tags: ['primitive', 'basic'],
    },
  ])

  /** 当前加载中的数量 */
  const loadingCount = ref(0)

  /** 搜索关键词 */
  const searchKeyword = ref('')

  /** 当前选中的分类 */
  const selectedCategory = ref<string | null>(null)

  /** 最近使用资源 */
  const recentlyUsed = ref<IAssetShortcut[]>([])

  /** 收藏资源 ID */
  const favoriteIds = ref<string[]>([])

  // ==================== Getters ====================

  /** 所有分类 */
  const categories = computed(() => {
    const cats = new Set<string>()
    modelLibrary.value.forEach((item) => cats.add(item.category))
    return Array.from(cats)
  })

  /** 过滤后的模型库 */
  const filteredModelLibrary = computed(() => {
    let items = modelLibrary.value

    // 分类过滤
    if (selectedCategory.value) {
      items = items.filter((item) => item.category === selectedCategory.value)
    }

    // 关键词搜索
    if (searchKeyword.value) {
      const keyword = searchKeyword.value.toLowerCase()
      items = items.filter(
        (item) =>
          item.name.toLowerCase().includes(keyword) ||
          item.tags?.some((tag) => tag.toLowerCase().includes(keyword))
      )
    }

    return items
  })

  /** 是否有正在加载的资源 */
  const isLoading = computed(() => loadingCount.value > 0)

  /** 缓存的模型数量 */
  const cachedModelCount = computed(() => modelCache.value.size)

  /** 收藏资源集合 */
  const favoriteIdSet = computed(() => new Set(favoriteIds.value))

  // ==================== Actions ====================

  /**
   * 加载模型
   */
  async function loadModel(
    url: string,
    onProgress?: (progress: number) => void
  ): Promise<IModelLoadResult> {
    // 检查缓存
    const cached = modelCache.value.get(url)
    if (cached) {
      return cached.result
    }

    // 更新状态
    loadingCount.value++

    try {
      const loader = getModelLoader()
      const result = await loader.loadModel(url, {
        onProgress,
        center: true,
        autoScale: false,
      })

      // 缓存结果
      modelCache.value.set(url, {
        result,
        loadedAt: Date.now(),
      })

      return result
    } finally {
      loadingCount.value--
    }
  }

  /**
   * 从缓存获取模型并克隆
   */
  function getClonedModel(url: string): THREE.Group | null {
    const cached = modelCache.value.get(url)
    if (!cached) return null

    const loader = getModelLoader()
    return loader.cloneModel(cached.result.model)
  }

  /**
   * 检查模型是否已缓存
   */
  function isModelCached(url: string): boolean {
    return modelCache.value.has(url)
  }

  /**
   * 预加载模型
   */
  async function preloadModels(urls: string[]): Promise<void> {
    const uncachedUrls = urls.filter((url) => !modelCache.value.has(url))
    await Promise.all(uncachedUrls.map((url) => loadModel(url)))
  }

  /**
   * 添加自定义模型到库
   */
  function addToLibrary(item: IModelLibraryItem): void {
    // 检查是否已存在
    const existing = modelLibrary.value.find((m) => m.id === item.id)
    if (!existing) {
      modelLibrary.value.push(item)
    }
  }

  /**
   * 从库中移除模型
   */
  function removeFromLibrary(id: string): boolean {
    const index = modelLibrary.value.findIndex((m) => m.id === id)
    if (index !== -1) {
      modelLibrary.value.splice(index, 1)
      return true
    }
    return false
  }

  /**
   * 清除模型缓存
   */
  function clearModelCache(url?: string): void {
    if (url) {
      modelCache.value.delete(url)
    } else {
      modelCache.value.clear()
    }
  }

  /**
   * 设置搜索关键词
   */
  function setSearchKeyword(keyword: string): void {
    searchKeyword.value = keyword
  }

  /**
   * 设置选中分类
   */
  function setSelectedCategory(category: string | null): void {
    selectedCategory.value = category
  }

  /**
   * 重置过滤器
   */
  function resetFilters(): void {
    searchKeyword.value = ''
    selectedCategory.value = null
  }

  function loadAssetPreferences(): void {
    try {
      const recentRaw = localStorage.getItem(RECENT_ASSETS_STORAGE_KEY)
      if (recentRaw) {
        const parsed = JSON.parse(recentRaw)
        if (Array.isArray(parsed)) {
          recentlyUsed.value = parsed.filter((item) => item && typeof item.id === 'string')
        }
      }

      const favoriteRaw = localStorage.getItem(FAVORITE_ASSETS_STORAGE_KEY)
      if (favoriteRaw) {
        const parsed = JSON.parse(favoriteRaw)
        if (Array.isArray(parsed)) {
          favoriteIds.value = parsed.filter((id) => typeof id === 'string')
        }
      }
    } catch (error) {
      console.warn('Failed to load asset preferences:', error)
    }
  }

  function saveAssetPreferences(): void {
    try {
      localStorage.setItem(RECENT_ASSETS_STORAGE_KEY, JSON.stringify(recentlyUsed.value))
      localStorage.setItem(FAVORITE_ASSETS_STORAGE_KEY, JSON.stringify(favoriteIds.value))
    } catch (error) {
      console.warn('Failed to save asset preferences:', error)
    }
  }

  function markAssetUsed(asset: Omit<IAssetShortcut, 'usedAt'>): void {
    recentlyUsed.value = [
      {
        ...asset,
        usedAt: Date.now(),
      },
      ...recentlyUsed.value.filter((item) => item.id !== asset.id),
    ].slice(0, MAX_RECENT_ASSETS)
    saveAssetPreferences()
  }

  function toggleFavoriteAsset(assetId: string): boolean {
    if (favoriteIds.value.includes(assetId)) {
      favoriteIds.value = favoriteIds.value.filter((id) => id !== assetId)
      saveAssetPreferences()
      return false
    }

    favoriteIds.value = [assetId, ...favoriteIds.value]
    saveAssetPreferences()
    return true
  }

  function isFavoriteAsset(assetId: string): boolean {
    return favoriteIdSet.value.has(assetId)
  }

  return {
    // State
    resources,
    modelLibrary,
    loadingCount,
    searchKeyword,
    selectedCategory,
    recentlyUsed,
    favoriteIds,

    // Getters
    categories,
    filteredModelLibrary,
    isLoading,
    cachedModelCount,
    favoriteIdSet,

    // Actions
    loadModel,
    getClonedModel,
    isModelCached,
    preloadModels,
    addToLibrary,
    removeFromLibrary,
    clearModelCache,
    setSearchKeyword,
    setSelectedCategory,
    resetFilters,
    loadAssetPreferences,
    markAssetUsed,
    toggleFavoriteAsset,
    isFavoriteAsset,
  }
})
