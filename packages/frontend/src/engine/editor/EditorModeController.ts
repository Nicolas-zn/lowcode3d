import type { EditorMode } from '@/stores/editorStore'
import { useEditorStore } from '@/stores/editorStore'
import { getEngine } from '../core/Engine'
import { eventBus } from '../events'

/**
 * 编辑器工具模式控制器
 * 统一管理 Toolbar、FloatingToolbar、快捷键与 Canvas 的模式切换。
 */
export class EditorModeController {
  private static _instance: EditorModeController | null = null
  private _isApplyingExternalMode = false

  static getInstance(): EditorModeController {
    if (!EditorModeController._instance) {
      EditorModeController._instance = new EditorModeController()
    }
    return EditorModeController._instance
  }

  static resetInstance(): void {
    EditorModeController._instance = null
  }

  get mode(): EditorMode {
    return useEditorStore().editorMode
  }

  get transformSpace(): 'world' | 'local' {
    return useEditorStore().transformSpace
  }

  setMode(mode: EditorMode, options: { emit?: boolean } = {}): void {
    const editorStore = useEditorStore()
    editorStore.setEditorMode(mode)
    this._applyModeToEngine(mode)

    if (options.emit !== false) {
      this._isApplyingExternalMode = true
      try {
        eventBus.emit('editor:mode-changed', { mode })
      } finally {
        this._isApplyingExternalMode = false
      }
    }
  }

  toggleSpace(options: { emit?: boolean } = {}): void {
    const editorStore = useEditorStore()
    const nextSpace = editorStore.transformSpace === 'world' ? 'local' : 'world'
    this.setSpace(nextSpace, options)
  }

  setSpace(space: 'world' | 'local', options: { emit?: boolean } = {}): void {
    const editorStore = useEditorStore()
    editorStore.setTransformSpace(space)

    const engine = getEngine()
    if (engine?.isInitialized) {
      engine.transformManager.setSpace(space)
    }

    if (options.emit !== false) {
      eventBus.emit('editor:toggle-space', { space })
    }
  }

  handleExternalModeChange(mode: EditorMode): void {
    if (this._isApplyingExternalMode) return
    this.setMode(mode, { emit: false })
  }

  handleExternalSpaceChange(space?: 'world' | 'local'): void {
    if (!space) return
    this.setSpace(space, { emit: false })
  }

  private _applyModeToEngine(mode: EditorMode): void {
    const engine = getEngine()
    if (!engine?.isInitialized) return

    if (mode === 'browse') {
      engine.selectionManager.clearSelection()
      engine.transformManager.setSelectMode(true)
      engine.transformManager.detach()
      engine.selectionManager.setEnabled(false)
      return
    }

    engine.selectionManager.setEnabled(true)

    if (mode === 'select') {
      engine.transformManager.setSelectMode(true)
      engine.transformManager.detach()
      return
    }

    engine.transformManager.setSelectMode(false)
    const modeMap: Record<
      Exclude<EditorMode, 'browse' | 'select'>,
      'translate' | 'rotate' | 'scale'
    > = {
      move: 'translate',
      rotate: 'rotate',
      scale: 'scale',
    }
    engine.transformManager.setMode(modeMap[mode])
  }
}

export function getEditorModeController(): EditorModeController {
  return EditorModeController.getInstance()
}
