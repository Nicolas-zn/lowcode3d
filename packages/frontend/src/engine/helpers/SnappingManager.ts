/**
 * 吸附管理器
 * 管理网格吸附和角度吸附
 */
import type { TransformManager } from '../interaction/TransformManager'
import { eventBus } from '../events'

/**
 * 吸附配置
 */
export interface ISnappingConfig {
  translateSnap: number | null // 平移吸附单位（null 表示禁用）
  rotateSnap: number | null // 旋转吸附角度（弧度，null 表示禁用）
  scaleSnap: number | null // 缩放吸附单位（null 表示禁用）
}

/**
 * 预设吸附配置
 */
export const SNAPPING_PRESETS = {
  none: {
    translateSnap: null,
    rotateSnap: null,
    scaleSnap: null,
  },
  fine: {
    translateSnap: 0.1,
    rotateSnap: Math.PI / 36, // 5 degrees
    scaleSnap: 0.1,
  },
  normal: {
    translateSnap: 0.5,
    rotateSnap: Math.PI / 12, // 15 degrees
    scaleSnap: 0.25,
  },
  coarse: {
    translateSnap: 1,
    rotateSnap: Math.PI / 4, // 45 degrees
    scaleSnap: 0.5,
  },
  grid: {
    translateSnap: 1,
    rotateSnap: Math.PI / 12, // 15 degrees
    scaleSnap: 0.5,
  },
} as const

export type SnappingPreset = keyof typeof SNAPPING_PRESETS

/**
 * 吸附管理器类
 */
export class SnappingManager {
  private static _instance: SnappingManager | null = null

  private _transformManager: TransformManager | null = null
  private _enabled: boolean = false
  private _config: ISnappingConfig = { ...SNAPPING_PRESETS.normal }
  private _currentPreset: SnappingPreset = 'normal'

  private constructor() {}

  /**
   * 获取单例实例
   */
  static getInstance(): SnappingManager {
    if (!SnappingManager._instance) {
      SnappingManager._instance = new SnappingManager()
    }
    return SnappingManager._instance
  }

  /**
   * 重置单例（用于测试）
   */
  static resetInstance(): void {
    SnappingManager._instance = null
  }

  /**
   * 绑定 TransformManager
   */
  bindTransformManager(transformManager: TransformManager): void {
    this._transformManager = transformManager
    this._applyConfig()
  }

  /**
   * 启用吸附
   */
  enable(): void {
    this._enabled = true
    this._applyConfig()
    this._emitChange()
  }

  /**
   * 禁用吸附
   */
  disable(): void {
    this._enabled = false
    this._applyConfig()
    this._emitChange()
  }

  /**
   * 切换吸附
   */
  toggle(): boolean {
    if (this._enabled) {
      this.disable()
    } else {
      this.enable()
    }
    return this._enabled
  }

  /**
   * 是否启用吸附
   */
  isEnabled(): boolean {
    return this._enabled
  }

  /**
   * 设置预设
   */
  setPreset(preset: SnappingPreset): void {
    this._currentPreset = preset
    this._config = { ...SNAPPING_PRESETS[preset] }
    this._applyConfig()
    this._emitChange()
  }

  /**
   * 获取当前预设
   */
  getPreset(): SnappingPreset {
    return this._currentPreset
  }

  /**
   * 设置平移吸附
   */
  setTranslateSnap(value: number | null): void {
    this._config.translateSnap = value
    this._currentPreset = 'none' // 自定义配置
    this._applyConfig()
    this._emitChange()
  }

  /**
   * 获取平移吸附值
   */
  getTranslateSnap(): number | null {
    return this._enabled ? this._config.translateSnap : null
  }

  /**
   * 设置旋转吸附
   */
  setRotateSnap(value: number | null): void {
    this._config.rotateSnap = value
    this._currentPreset = 'none' // 自定义配置
    this._applyConfig()
    this._emitChange()
  }

  /**
   * 获取旋转吸附值
   */
  getRotateSnap(): number | null {
    return this._enabled ? this._config.rotateSnap : null
  }

  /**
   * 设置缩放吸附
   */
  setScaleSnap(value: number | null): void {
    this._config.scaleSnap = value
    this._currentPreset = 'none' // 自定义配置
    this._applyConfig()
    this._emitChange()
  }

  /**
   * 获取缩放吸附值
   */
  getScaleSnap(): number | null {
    return this._enabled ? this._config.scaleSnap : null
  }

  /**
   * 获取当前配置
   */
  getConfig(): ISnappingConfig {
    return { ...this._config }
  }

  /**
   * 设置配置
   */
  setConfig(config: Partial<ISnappingConfig>): void {
    this._config = { ...this._config, ...config }
    this._currentPreset = 'none' // 自定义配置
    this._applyConfig()
    this._emitChange()
  }

  /**
   * 应用配置到 TransformManager
   */
  private _applyConfig(): void {
    if (!this._transformManager) return

    if (this._enabled) {
      this._transformManager.setTranslationSnap(this._config.translateSnap)
      this._transformManager.setRotationSnap(this._config.rotateSnap)
      this._transformManager.setScaleSnap(this._config.scaleSnap)
    } else {
      this._transformManager.setTranslationSnap(null)
      this._transformManager.setRotationSnap(null)
      this._transformManager.setScaleSnap(null)
    }
  }

  /**
   * 发送变更事件
   */
  private _emitChange(): void {
    eventBus.emit('editor:snapping-changed', {
      enabled: this._enabled,
      preset: this._currentPreset,
      config: this._config,
    })
  }

  /**
   * 吸附位置值
   */
  snapPosition(value: number): number {
    if (!this._enabled || this._config.translateSnap === null) {
      return value
    }
    return Math.round(value / this._config.translateSnap) * this._config.translateSnap
  }

  /**
   * 吸附旋转值
   */
  snapRotation(value: number): number {
    if (!this._enabled || this._config.rotateSnap === null) {
      return value
    }
    return Math.round(value / this._config.rotateSnap) * this._config.rotateSnap
  }

  /**
   * 吸附缩放值
   */
  snapScale(value: number): number {
    if (!this._enabled || this._config.scaleSnap === null) {
      return value
    }
    return Math.round(value / this._config.scaleSnap) * this._config.scaleSnap
  }

  /**
   * 获取角度吸附的度数显示
   */
  getRotateSnapDegrees(): number | null {
    if (this._config.rotateSnap === null) return null
    return Math.round((this._config.rotateSnap * 180) / Math.PI)
  }

  /**
   * 设置角度吸附（以度数为单位）
   */
  setRotateSnapDegrees(degrees: number | null): void {
    if (degrees === null) {
      this.setRotateSnap(null)
    } else {
      this.setRotateSnap((degrees * Math.PI) / 180)
    }
  }
}

/**
 * 获取 SnappingManager 单例
 */
export function getSnappingManager(): SnappingManager {
  return SnappingManager.getInstance()
}
