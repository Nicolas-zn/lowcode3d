/**
 * 强类型 EventBus
 *
 * 全局事件总线，所有业务通信的唯一通道。
 * 基于 EventBusEventMap 提供完整的类型推导：emit / on / off / once 的参数和回调都有类型检查。
 */
import type { EventBusEventMap } from './EventTypes'

// ─── 内部类型 ────────────────────────────────────────────────────────────────

type EventName = keyof EventBusEventMap
type Payload<E extends EventName> = EventBusEventMap[E]

type Callback<E extends EventName> =
  Payload<E> extends undefined ? () => void : (payload: Payload<E>) => void

interface ListenerEntry<E extends EventName = EventName> {
  callback: Callback<E>
  once: boolean
}

// ─── EventBus 实现 ──────────────────────────────────────────────────────────

class EventBusImpl {
  private _listeners = new Map<EventName, Set<ListenerEntry>>()
  private _debugMode = false

  /**
   * 开启调试模式，在控制台打印所有事件
   */
  setDebug(enabled: boolean): void {
    this._debugMode = enabled
  }

  /**
   * 订阅事件
   */
  on<E extends EventName>(event: E, callback: Callback<E>): void {
    if (!this._listeners.has(event)) {
      this._listeners.set(event, new Set())
    }
    this._listeners.get(event)!.add({
      callback: callback as Callback<EventName>,
      once: false,
    })
  }

  /**
   * 取消订阅
   */
  off<E extends EventName>(event: E, callback: Callback<E>): void {
    const entries = this._listeners.get(event)
    if (!entries) return

    for (const entry of entries) {
      if (entry.callback === callback) {
        entries.delete(entry)
        break
      }
    }

    if (entries.size === 0) {
      this._listeners.delete(event)
    }
  }

  /**
   * 订阅一次（触发后自动取消）
   */
  once<E extends EventName>(event: E, callback: Callback<E>): void {
    if (!this._listeners.has(event)) {
      this._listeners.set(event, new Set())
    }
    this._listeners.get(event)!.add({
      callback: callback as Callback<EventName>,
      once: true,
    })
  }

  /**
   * 触发事件
   */
  emit<E extends EventName>(
    ...args: Payload<E> extends undefined ? [event: E] : [event: E, payload: Payload<E>]
  ): void {
    const [event, payload] = args as [E, Payload<E>]

    if (this._debugMode) {
      console.log(`[EventBus] ${String(event)}`, payload)
    }

    const entries = this._listeners.get(event)
    if (!entries) return

    const toRemove: ListenerEntry[] = []

    for (const entry of entries) {
      try {
        if (payload !== undefined) {
          ;(entry.callback as (p: Payload<E>) => void)(payload)
        } else {
          ;(entry.callback as () => void)()
        }
      } catch (error) {
        console.error(`[EventBus] Error in listener for "${String(event)}":`, error)
      }

      if (entry.once) {
        toRemove.push(entry)
      }
    }

    for (const entry of toRemove) {
      entries.delete(entry)
    }
  }

  /**
   * 移除某个事件的所有监听器，或移除所有事件的所有监听器
   */
  removeAllListeners(event?: EventName): void {
    if (event) {
      this._listeners.delete(event)
    } else {
      this._listeners.clear()
    }
  }

  /**
   * 获取某个事件的监听器数量
   */
  listenerCount(event: EventName): number {
    return this._listeners.get(event)?.size ?? 0
  }

  /**
   * 销毁，清空所有监听器
   */
  dispose(): void {
    this._listeners.clear()
  }
}

// ─── 单例导出 ────────────────────────────────────────────────────────────────

/**
 * 全局唯一 EventBus 实例
 */
export const eventBus = new EventBusImpl()

export type { EventName, Payload, Callback }
