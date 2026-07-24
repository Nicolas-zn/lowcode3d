/**
 * 历史记录状态管理
 */
import { defineStore } from 'pinia'
import { ref } from 'vue'
import {
  eventBus,
  getHistoryManager,
  type AnimationChangedPayload,
  type HistoryChangedPayload,
} from '@/engine'
import { useEditorStateStore } from './editorStateStore'

export const useHistoryStore = defineStore('history', () => {
  const canUndo = ref(false)
  const canRedo = ref(false)
  const undoName = ref<string | null>(null)
  const redoName = ref<string | null>(null)

  function updateState(payload: HistoryChangedPayload): void {
    canUndo.value = payload.canUndo
    canRedo.value = payload.canRedo
    undoName.value = payload.undoName
    redoName.value = payload.redoName
  }

  function undo(): boolean {
    return getHistoryManager().undo()
  }

  function redo(): boolean {
    return getHistoryManager().redo()
  }

  function clear(): void {
    getHistoryManager().clear()
  }

  function handleHistoryChanged(payload: HistoryChangedPayload): void {
    updateState(payload)

    if (payload.canUndo || payload.canRedo) {
      syncEditorDirtyState()
    }
  }

  function handleAnimationChanged(payload: AnimationChangedPayload): void {
    if (payload.reason === 'loaded') return
    syncEditorDirtyState()
  }

  function syncEditorDirtyState(): void {
    const editorStateStore = useEditorStateStore()
    if (editorStateStore.savedSceneSignature) {
      editorStateStore.syncDirtyState()
    } else {
      editorStateStore.markAsModified()
    }
  }

  function init(): void {
    eventBus.off('history:changed', handleHistoryChanged)
    eventBus.off('animation:changed', handleAnimationChanged)
    eventBus.on('history:changed', handleHistoryChanged)
    eventBus.on('animation:changed', handleAnimationChanged)

    const manager = getHistoryManager()
    updateState({
      canUndo: manager.canUndo,
      canRedo: manager.canRedo,
      undoName: manager.undoName,
      redoName: manager.redoName,
    })
  }

  function dispose(): void {
    eventBus.off('history:changed', handleHistoryChanged)
    eventBus.off('animation:changed', handleAnimationChanged)
  }

  return {
    canUndo,
    canRedo,
    undoName,
    redoName,
    undo,
    redo,
    clear,
    init,
    dispose,
  }
})
