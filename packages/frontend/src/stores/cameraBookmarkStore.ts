import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import * as THREE from 'three'
import type { CameraBookmarkData } from '@lowcode3d/shared'
import { getEngine } from '@/engine'
import { useEditorStateStore } from './editorStateStore'

function cloneBookmarks(bookmarks: CameraBookmarkData[]): CameraBookmarkData[] {
  return bookmarks.map((bookmark) => structuredClone(bookmark))
}

export const useCameraBookmarkStore = defineStore('cameraBookmarks', () => {
  const bookmarks = ref<CameraBookmarkData[]>([])

  const bookmarkOptions = computed(() =>
    bookmarks.value.map((bookmark) => ({
      label: bookmark.name,
      value: bookmark.id,
    }))
  )

  function syncSceneUserData(): void {
    const engine = getEngine()
    if (!engine?.isInitialized) return
    engine.sceneManager.scene.userData.cameraBookmarks = cloneBookmarks(bookmarks.value)
  }

  function markModified(): void {
    syncSceneUserData()
    useEditorStateStore().markAsModified()
  }

  function replaceBookmarks(nextBookmarks: CameraBookmarkData[], markDirty = false): void {
    bookmarks.value = cloneBookmarks(nextBookmarks)
    syncSceneUserData()
    if (markDirty) {
      useEditorStateStore().markAsModified()
    }
  }

  function hydrateFromScene(): void {
    const engine = getEngine()
    const sceneBookmarks = engine?.sceneManager.scene.userData.cameraBookmarks
    if (Array.isArray(sceneBookmarks)) {
      replaceBookmarks(sceneBookmarks as CameraBookmarkData[])
    }
  }

  function captureCurrentCamera(name?: string): CameraBookmarkData | null {
    const engine = getEngine()
    if (!engine?.isInitialized) return null

    const camera = engine.cameraManager.camera
    const target = engine.cameraManager.controls.target
    const now = new Date().toISOString()
    const bookmark: CameraBookmarkData = {
      id: `camera-${crypto.randomUUID()}`,
      name: name?.trim() || `相机书签 ${bookmarks.value.length + 1}`,
      type: camera instanceof THREE.PerspectiveCamera ? 'perspective' : 'orthographic',
      position: { x: camera.position.x, y: camera.position.y, z: camera.position.z },
      target: { x: target.x, y: target.y, z: target.z },
      near: camera.near,
      far: camera.far,
      fov: camera instanceof THREE.PerspectiveCamera ? camera.fov : undefined,
      zoom: camera instanceof THREE.OrthographicCamera ? camera.zoom : undefined,
      createdAt: now,
      updatedAt: now,
    }

    bookmarks.value.push(bookmark)
    markModified()
    return bookmark
  }

  function updateBookmark(
    id: string,
    patch: Partial<CameraBookmarkData>
  ): CameraBookmarkData | null {
    const index = bookmarks.value.findIndex((bookmark) => bookmark.id === id)
    if (index < 0) return null

    bookmarks.value[index] = {
      ...bookmarks.value[index],
      ...patch,
      updatedAt: new Date().toISOString(),
    }
    markModified()
    return bookmarks.value[index]
  }

  function removeBookmark(id: string): boolean {
    const nextBookmarks = bookmarks.value.filter((bookmark) => bookmark.id !== id)
    if (nextBookmarks.length === bookmarks.value.length) return false

    bookmarks.value = nextBookmarks
    markModified()
    return true
  }

  function getBookmark(id: string): CameraBookmarkData | undefined {
    return bookmarks.value.find((bookmark) => bookmark.id === id)
  }

  function reset(): void {
    bookmarks.value = []
    syncSceneUserData()
  }

  return {
    bookmarks,
    bookmarkOptions,
    replaceBookmarks,
    hydrateFromScene,
    captureCurrentCamera,
    updateBookmark,
    removeBookmark,
    getBookmark,
    reset,
  }
})
