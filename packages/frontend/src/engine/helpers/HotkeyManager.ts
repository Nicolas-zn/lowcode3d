/**
 * 快捷键管理器
 * 集中管理键盘快捷键
 */

/**
 * 快捷键配置
 */
export interface IHotkeyConfig {
  key: string // 按键名称（小写）
  ctrl?: boolean // 是否需要 Ctrl/Cmd
  shift?: boolean // 是否需要 Shift
  alt?: boolean // 是否需要 Alt
  description: string // 快捷键描述
  category?: string // 分类
  enabled?: boolean // 是否启用
}

/**
 * 快捷键处理函数
 */
export type HotkeyHandler = (event: KeyboardEvent) => void

/**
 * 快捷键注册条目
 */
interface IHotkeyEntry {
  config: IHotkeyConfig
  handler: HotkeyHandler
}

/**
 * 快捷键管理器类
 */
export class HotkeyManager {
  private static _instance: HotkeyManager | null = null

  private _hotkeys: Map<string, IHotkeyEntry> = new Map()
  private _enabled: boolean = true
  private _boundKeyDown: (e: KeyboardEvent) => void

  private constructor() {
    this._boundKeyDown = this._handleKeyDown.bind(this)
    window.addEventListener('keydown', this._boundKeyDown)
  }

  /**
   * 获取单例实例
   */
  static getInstance(): HotkeyManager {
    if (!HotkeyManager._instance) {
      HotkeyManager._instance = new HotkeyManager()
    }
    return HotkeyManager._instance
  }

  /**
   * 重置单例（用于测试）
   */
  static resetInstance(): void {
    if (HotkeyManager._instance) {
      HotkeyManager._instance.dispose()
      HotkeyManager._instance = null
    }
  }

  /**
   * 生成快捷键的唯一标识
   * 可用于快捷键冲突检测或自定义快捷键管理
   */
  generateKeyId(config: IHotkeyConfig): string {
    const parts: string[] = []
    if (config.ctrl) parts.push('ctrl')
    if (config.shift) parts.push('shift')
    if (config.alt) parts.push('alt')
    parts.push(config.key.toLowerCase())
    return parts.join('+')
  }

  /**
   * 注册快捷键
   */
  register(id: string, config: IHotkeyConfig, handler: HotkeyHandler): void {
    const entry: IHotkeyEntry = {
      config: { ...config, enabled: config.enabled ?? true },
      handler,
    }
    this._hotkeys.set(id, entry)
  }

  /**
   * 取消注册快捷键
   */
  unregister(id: string): void {
    this._hotkeys.delete(id)
  }

  /**
   * 启用快捷键
   */
  enable(id: string): void {
    const entry = this._hotkeys.get(id)
    if (entry) {
      entry.config.enabled = true
    }
  }

  /**
   * 禁用快捷键
   */
  disable(id: string): void {
    const entry = this._hotkeys.get(id)
    if (entry) {
      entry.config.enabled = false
    }
  }

  /**
   * 启用所有快捷键
   */
  enableAll(): void {
    this._enabled = true
  }

  /**
   * 禁用所有快捷键
   */
  disableAll(): void {
    this._enabled = false
  }

  /**
   * 获取所有注册的快捷键
   */
  getAll(): Map<string, IHotkeyEntry> {
    return new Map(this._hotkeys)
  }

  /**
   * 获取快捷键配置
   */
  getConfig(id: string): IHotkeyConfig | undefined {
    return this._hotkeys.get(id)?.config
  }

  /**
   * 按分类获取快捷键
   */
  getByCategory(category: string): Map<string, IHotkeyEntry> {
    const result = new Map<string, IHotkeyEntry>()
    this._hotkeys.forEach((entry, id) => {
      if (entry.config.category === category) {
        result.set(id, entry)
      }
    })
    return result
  }

  /**
   * 获取快捷键显示文本
   */
  getDisplayText(config: IHotkeyConfig): string {
    const parts: string[] = []
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0

    if (config.ctrl) parts.push(isMac ? '⌘' : 'Ctrl')
    if (config.shift) parts.push(isMac ? '⇧' : 'Shift')
    if (config.alt) parts.push(isMac ? '⌥' : 'Alt')

    // 特殊按键名称映射
    const keyMap: Record<string, string> = {
      delete: 'Delete',
      backspace: '⌫',
      escape: 'Esc',
      enter: 'Enter',
      space: 'Space',
      arrowup: '↑',
      arrowdown: '↓',
      arrowleft: '←',
      arrowright: '→',
    }

    const displayKey = keyMap[config.key.toLowerCase()] || config.key.toUpperCase()
    parts.push(displayKey)

    return parts.join(isMac ? '' : '+')
  }

  /**
   * 处理键盘事件
   */
  private _handleKeyDown(event: KeyboardEvent): void {
    // 如果全局禁用，不处理
    if (!this._enabled) return

    // 如果正在输入文本，不处理（除非是特定的全局快捷键）
    const target = event.target as HTMLElement
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
      // 只处理 Escape 键
      if (event.key.toLowerCase() !== 'escape') {
        return
      }
    }

    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0
    const ctrl = isMac ? event.metaKey : event.ctrlKey
    const shift = event.shiftKey
    const alt = event.altKey
    const key = event.key.toLowerCase()

    // 查找匹配的快捷键
    for (const [, entry] of this._hotkeys) {
      const config = entry.config

      // 检查是否启用
      if (!config.enabled) continue

      // 检查修饰键
      const ctrlMatch = (config.ctrl ?? false) === ctrl
      const shiftMatch = (config.shift ?? false) === shift
      const altMatch = (config.alt ?? false) === alt
      const keyMatch = config.key.toLowerCase() === key

      if (ctrlMatch && shiftMatch && altMatch && keyMatch) {
        event.preventDefault()
        event.stopPropagation()
        entry.handler(event)
        return
      }
    }
  }

  /**
   * 手动触发快捷键
   */
  trigger(id: string): void {
    const entry = this._hotkeys.get(id)
    if (entry && entry.config.enabled) {
      entry.handler(new KeyboardEvent('keydown'))
    }
  }

  /**
   * 销毁管理器
   */
  dispose(): void {
    window.removeEventListener('keydown', this._boundKeyDown)
    this._hotkeys.clear()
    HotkeyManager._instance = null
  }
}

/**
 * 获取 HotkeyManager 单例
 */
export function getHotkeyManager(): HotkeyManager {
  return HotkeyManager.getInstance()
}

/**
 * 默认快捷键配置
 */
export const DEFAULT_HOTKEYS: Record<string, IHotkeyConfig> = {
  // 变换模式
  'transform.translate': {
    key: 't',
    description: '平移模式',
    category: 'transform',
  },
  'transform.rotate': {
    key: 'r',
    description: '旋转模式',
    category: 'transform',
  },
  'transform.scale': {
    key: 's',
    description: '缩放模式',
    category: 'transform',
  },
  'transform.space': {
    key: 'q',
    description: '切换本地/世界坐标',
    category: 'transform',
  },

  // 编辑操作
  'edit.delete': {
    key: 'delete',
    description: '删除选中对象',
    category: 'edit',
  },
  'edit.delete.backspace': {
    key: 'backspace',
    description: '删除选中对象',
    category: 'edit',
  },
  'edit.undo': {
    key: 'z',
    ctrl: true,
    description: '撤销',
    category: 'edit',
  },
  'edit.redo': {
    key: 'z',
    ctrl: true,
    shift: true,
    description: '重做',
    category: 'edit',
  },
  'edit.redo.y': {
    key: 'y',
    ctrl: true,
    description: '重做',
    category: 'edit',
  },
  'edit.group': {
    key: 'g',
    ctrl: true,
    description: '成组',
    category: 'edit',
  },
  'edit.ungroup': {
    key: 'g',
    ctrl: true,
    shift: true,
    description: '解组',
    category: 'edit',
  },
  'edit.duplicate': {
    key: 'd',
    ctrl: true,
    description: '复制选中对象',
    category: 'edit',
  },

  // 视图操作
  'view.focus': {
    key: 'f',
    description: '聚焦到选中对象',
    category: 'view',
  },
  'view.reset': {
    key: 'home',
    description: '重置相机视角',
    category: 'view',
  },
  'view.front': {
    key: '1',
    description: '前视图',
    category: 'view',
  },
  'view.right': {
    key: '3',
    description: '右视图',
    category: 'view',
  },
  'view.top': {
    key: '7',
    description: '顶视图',
    category: 'view',
  },

  // 工具
  'tool.grid': {
    key: 'g',
    shift: true,
    description: '切换网格',
    category: 'tool',
  },
  'tool.snap': {
    key: 's',
    shift: true,
    description: '切换吸附',
    category: 'tool',
  },

  // 通用
  'general.escape': {
    key: 'escape',
    description: '取消/清除选择',
    category: 'general',
  },
  'general.save': {
    key: 's',
    ctrl: true,
    description: '保存项目',
    category: 'general',
  },
}
