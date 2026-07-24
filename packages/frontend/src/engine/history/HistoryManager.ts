/**
 * 历史记录管理器
 * 实现撤销/重做功能
 */
import type { ICommand } from './Command'
import { eventBus } from '../events'

/**
 * 历史记录变化事件
 */
export interface IHistoryChangeEvent {
  canUndo: boolean
  canRedo: boolean
  undoName: string | null
  redoName: string | null
}

/**
 * 历史记录管理器配置
 */
export interface IHistoryManagerConfig {
  /** 最大历史记录数 */
  maxHistorySize?: number
  /** 历史变化回调 */
  onChange?: (event: IHistoryChangeEvent) => void
}

/**
 * 历史记录管理器
 */
export class HistoryManager {
  private static _instance: HistoryManager | null = null

  private _undoStack: ICommand[] = []
  private _redoStack: ICommand[] = []
  private _maxHistorySize: number
  private _onChange?: (event: IHistoryChangeEvent) => void
  private _isExecuting = false

  private constructor(config: IHistoryManagerConfig = {}) {
    this._maxHistorySize = config.maxHistorySize ?? 100
    this._onChange = config.onChange
  }

  /**
   * 获取单例实例
   */
  static getInstance(config?: IHistoryManagerConfig): HistoryManager {
    if (!HistoryManager._instance) {
      HistoryManager._instance = new HistoryManager(config)
    }
    return HistoryManager._instance
  }

  /**
   * 重置单例
   */
  static resetInstance(): void {
    HistoryManager._instance = null
  }

  /**
   * 设置变化回调
   */
  setOnChange(callback: (event: IHistoryChangeEvent) => void): void {
    this._onChange = callback
  }

  /**
   * 执行命令
   */
  execute(command: ICommand): void {
    if (this._isExecuting) return

    this._isExecuting = true

    try {
      // 执行命令
      command.execute()

      // 检查是否可以与上一个命令合并
      const lastCommand = this._undoStack[this._undoStack.length - 1]
      if (lastCommand && command.canMergeWith?.(lastCommand)) {
        command.mergeWith?.(lastCommand)
        this._undoStack[this._undoStack.length - 1] = command
      } else {
        // 添加到撤销栈
        this._undoStack.push(command)

        // 限制历史记录大小
        if (this._undoStack.length > this._maxHistorySize) {
          this._undoStack.shift()
        }
      }

      // 清空重做栈
      this._redoStack = []

      // 触发变化事件
      this._emitChange()
    } finally {
      this._isExecuting = false
    }
  }

  /**
   * 推入已经应用到场景的命令。
   *
   * 适用于 TransformControls 这类交互：用户拖拽时对象已经被 Three.js 控件修改，
   * 此时不应再次 execute，只需要登记撤销/重做历史。
   */
  pushApplied(command: ICommand): void {
    if (this._isExecuting) return

    this._pushUndoCommand(command)
    this._redoStack = []
    this._emitChange()
  }

  /**
   * 撤销
   */
  undo(): boolean {
    if (!this.canUndo || this._isExecuting) return false

    this._isExecuting = true

    try {
      const command = this._undoStack.pop()!
      command.undo()

      this._redoStack.push(command)
      this._emitChange()

      return true
    } finally {
      this._isExecuting = false
    }
  }

  /**
   * 重做
   */
  redo(): boolean {
    if (!this.canRedo || this._isExecuting) return false

    this._isExecuting = true

    try {
      const command = this._redoStack.pop()!
      command.execute()

      this._undoStack.push(command)
      this._emitChange()

      return true
    } finally {
      this._isExecuting = false
    }
  }

  /**
   * 是否可以撤销
   */
  get canUndo(): boolean {
    return this._undoStack.length > 0
  }

  /**
   * 是否可以重做
   */
  get canRedo(): boolean {
    return this._redoStack.length > 0
  }

  /**
   * 获取撤销命令名称
   */
  get undoName(): string | null {
    const command = this._undoStack[this._undoStack.length - 1]
    return command?.name ?? null
  }

  /**
   * 获取重做命令名称
   */
  get redoName(): string | null {
    const command = this._redoStack[this._redoStack.length - 1]
    return command?.name ?? null
  }

  /**
   * 获取撤销栈大小
   */
  get undoStackSize(): number {
    return this._undoStack.length
  }

  /**
   * 获取重做栈大小
   */
  get redoStackSize(): number {
    return this._redoStack.length
  }

  /**
   * 清空历史记录
   */
  clear(): void {
    this._undoStack = []
    this._redoStack = []
    this._emitChange()
  }

  /**
   * 将命令写入撤销栈，并处理合并和长度限制。
   */
  private _pushUndoCommand(command: ICommand): void {
    const lastCommand = this._undoStack[this._undoStack.length - 1]
    if (lastCommand && command.canMergeWith?.(lastCommand)) {
      command.mergeWith?.(lastCommand)
      this._undoStack[this._undoStack.length - 1] = command
      return
    }

    this._undoStack.push(command)

    if (this._undoStack.length > this._maxHistorySize) {
      this._undoStack.shift()
    }
  }

  /**
   * 触发变化事件
   */
  private _emitChange(): void {
    const payload = {
      canUndo: this.canUndo,
      canRedo: this.canRedo,
      undoName: this.undoName,
      redoName: this.redoName,
    }

    if (this._onChange) {
      this._onChange(payload)
    }

    eventBus.emit('history:changed', payload)
  }

  /**
   * 销毁
   */
  dispose(): void {
    this.clear()
    this._onChange = undefined
    HistoryManager._instance = null
  }
}

/**
 * 获取历史记录管理器实例
 */
export function getHistoryManager(): HistoryManager {
  return HistoryManager.getInstance()
}
