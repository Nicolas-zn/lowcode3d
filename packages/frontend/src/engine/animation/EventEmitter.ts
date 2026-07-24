/**
 * EventEmitter - 简单的事件发布订阅系统
 *
 * 用于 AnimationEngine 与 UI 组件之间的通信
 */

type EventCallback = (...args: unknown[]) => void

export class EventEmitter {
  private listeners: Map<string, Set<EventCallback>> = new Map()

  /**
   * 订阅事件
   */
  on(event: string, callback: EventCallback): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event)!.add(callback)
  }

  /**
   * 取消订阅
   */
  off(event: string, callback: EventCallback): void {
    const callbacks = this.listeners.get(event)
    if (callbacks) {
      callbacks.delete(callback)
    }
  }

  /**
   * 订阅一次（触发后自动取消）
   */
  once(event: string, callback: EventCallback): void {
    const wrapper = (...args: unknown[]) => {
      callback(...args)
      this.off(event, wrapper)
    }
    this.on(event, wrapper)
  }

  /**
   * 触发事件
   */
  emit(event: string, data?: unknown): void {
    const callbacks = this.listeners.get(event)
    if (callbacks) {
      callbacks.forEach((callback) => {
        try {
          callback(data)
        } catch (error) {
          console.error(`Error in event listener for "${event}":`, error)
        }
      })
    }
  }

  /**
   * 移除所有监听器
   */
  removeAllListeners(event?: string): void {
    if (event) {
      this.listeners.delete(event)
    } else {
      this.listeners.clear()
    }
  }

  /**
   * 获取事件的监听器数量
   */
  listenerCount(event: string): number {
    return this.listeners.get(event)?.size || 0
  }
}
