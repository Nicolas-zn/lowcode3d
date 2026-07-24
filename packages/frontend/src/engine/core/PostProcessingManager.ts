import * as THREE from 'three'
import {
  EffectComposer,
  EffectPass,
  RenderPass,
  BloomEffect,
  SMAAEffect,
  SMAAPreset,
  OutlineEffect,
  BlendFunction,
} from 'postprocessing'
import type { PostProcessingData, ToneMappingType } from '@lowcode3d/shared'

/**
 * Bloom 配置接口
 */
export interface IBloomSettings {
  enabled: boolean
  intensity: number
  luminanceThreshold: number
  luminanceSmoothing: number
  radius: number
}

/**
 * Outline 配置接口
 */
export interface IOutlineSettings {
  enabled: boolean
  color: string | number
  edgeStrength: number
  pulseSpeed: number
  visibleEdgeColor: number
  hiddenEdgeColor: number
}

/**
 * 后处理配置接口
 */
export interface IPostProcessingSettings {
  enabled: boolean
  bloom: IBloomSettings
  outline: IOutlineSettings
  smaaEnabled: boolean
}

/**
 * 后处理管理器
 * 使用 pmndrs/postprocessing 库
 */
export class PostProcessingManager {
  private _renderer: THREE.WebGLRenderer
  private _composer: EffectComposer
  private _renderPass: RenderPass
  private _bloomEffect: BloomEffect
  private _smaaEffect: SMAAEffect
  private _outlineEffect: OutlineEffect
  private _effectPass: EffectPass
  private _outlinePass: EffectPass

  private _enabled = false // 默认禁用后处理，使用 Three.js 原生渲染器
  private _scene: THREE.Scene
  private _camera: THREE.Camera

  // 当前配置
  private _bloomSettings: IBloomSettings = {
    enabled: false, // 默认禁用辉光效果
    intensity: 1.0,
    luminanceThreshold: 0.9,
    luminanceSmoothing: 0.025,
    radius: 0.85,
  }

  private _outlineSettings: IOutlineSettings = {
    enabled: true, // 轮廓效果保持启用（用于选中高亮）
    color: '#ffffff',
    edgeStrength: 2.5,
    pulseSpeed: 0,
    visibleEdgeColor: 0xffffff,
    hiddenEdgeColor: 0x444444,
  }

  private _smaaEnabled = false // 默认禁用 SMAA 抗锯齿

  constructor(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera) {
    this._renderer = renderer
    this._scene = scene
    this._camera = camera

    // 创建 EffectComposer（pmndrs 版本）
    this._composer = new EffectComposer(renderer)

    // 1. RenderPass - 基础场景渲染
    this._renderPass = new RenderPass(scene, camera)
    this._composer.addPass(this._renderPass)

    // 2. OutlineEffect - 选中物体轮廓
    this._outlineEffect = new OutlineEffect(scene, camera, {
      blendFunction: BlendFunction.SCREEN,
      edgeStrength: this._outlineSettings.edgeStrength,
      pulseSpeed: this._outlineSettings.pulseSpeed,
      visibleEdgeColor: this._outlineSettings.visibleEdgeColor,
      hiddenEdgeColor: this._outlineSettings.hiddenEdgeColor,
      blur: false,
      xRay: true,
    })

    // 3. BloomEffect - 辉光效果
    this._bloomEffect = new BloomEffect({
      blendFunction: BlendFunction.ADD,
      intensity: this._bloomSettings.intensity,
      luminanceThreshold: this._bloomSettings.luminanceThreshold,
      luminanceSmoothing: this._bloomSettings.luminanceSmoothing,
      radius: this._bloomSettings.radius,
    })

    // 4. SMAAEffect - 抗锯齿
    this._smaaEffect = new SMAAEffect({
      preset: SMAAPreset.HIGH,
    })

    // OutlinePass 单独添加，便于控制
    this._outlinePass = new EffectPass(camera, this._outlineEffect)
    this._outlinePass.enabled = this._outlineSettings.enabled
    this._composer.addPass(this._outlinePass)

    // 合并其他效果到一个 EffectPass
    this._effectPass = new EffectPass(camera, this._bloomEffect, this._smaaEffect)
    this._composer.addPass(this._effectPass)

    // 应用初始启用状态
    this._bloomEffect.blendMode.opacity.value = this._bloomSettings.enabled ? 1 : 0
  }

  /**
   * 是否启用后处理
   */
  get enabled(): boolean {
    return this._enabled
  }

  /**
   * 设置后处理启用状态
   */
  setEnabled(enabled: boolean): void {
    this._enabled = enabled
  }

  /**
   * 更新相机（相机变化时调用）
   */
  setCamera(camera: THREE.Camera): void {
    this._camera = camera
    this._renderPass.mainCamera = camera
    this._outlineEffect.mainCamera = camera
    this._effectPass.mainCamera = camera
    this._outlinePass.mainCamera = camera
  }

  /**
   * 设置 Bloom 配置
   */
  setBloomSettings(settings: Partial<IBloomSettings>): void {
    if (settings.enabled !== undefined) {
      this._bloomSettings.enabled = settings.enabled
      this._bloomEffect.blendMode.opacity.value = settings.enabled ? 1 : 0
    }
    if (settings.intensity !== undefined) {
      this._bloomSettings.intensity = settings.intensity
      this._bloomEffect.intensity = settings.intensity
    }
    if (settings.luminanceThreshold !== undefined) {
      this._bloomSettings.luminanceThreshold = settings.luminanceThreshold
      this._bloomEffect.luminanceMaterial.threshold = settings.luminanceThreshold
    }
    if (settings.luminanceSmoothing !== undefined) {
      this._bloomSettings.luminanceSmoothing = settings.luminanceSmoothing
      this._bloomEffect.luminanceMaterial.smoothing = settings.luminanceSmoothing
    }
    if (settings.radius !== undefined) {
      this._bloomSettings.radius = settings.radius
      // pmndrs BloomEffect uses mipmapBlur by default, radius affects blur kernel
    }
  }

  /**
   * 获取当前 Bloom 配置
   */
  getBloomSettings(): IBloomSettings {
    return { ...this._bloomSettings }
  }

  /**
   * 设置 Outline 配置
   */
  setOutlineSettings(settings: Partial<IOutlineSettings>): void {
    if (settings.enabled !== undefined) {
      this._outlineSettings.enabled = settings.enabled
      this._outlinePass.enabled = settings.enabled
    }
    if (settings.color !== undefined) {
      this._outlineSettings.color = settings.color
      const colorValue =
        typeof settings.color === 'string'
          ? parseInt(settings.color.replace('#', ''), 16)
          : settings.color
      this._outlineSettings.visibleEdgeColor = colorValue
      this._outlineEffect.visibleEdgeColor = new THREE.Color(colorValue)
    }
    if (settings.edgeStrength !== undefined) {
      this._outlineSettings.edgeStrength = settings.edgeStrength
      this._outlineEffect.edgeStrength = settings.edgeStrength
    }
    if (settings.pulseSpeed !== undefined) {
      this._outlineSettings.pulseSpeed = settings.pulseSpeed
      this._outlineEffect.pulseSpeed = settings.pulseSpeed
    }
  }

  /**
   * 获取当前 Outline 配置
   */
  getOutlineSettings(): IOutlineSettings {
    return { ...this._outlineSettings }
  }

  /**
   * 设置 Outline 选中物体
   */
  setOutlineObjects(objects: THREE.Object3D[]): void {
    // 清除当前选择
    this._outlineEffect.selection.clear()

    // 添加新的选择对象
    objects.forEach((obj) => {
      // 遍历对象及其子对象，添加所有 Mesh
      obj.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          this._outlineEffect.selection.add(child)
        }
      })
    })
  }

  /**
   * 获取当前 Outline 选中物体数量
   */
  getOutlineObjectsCount(): number {
    return this._outlineEffect.selection.size
  }

  /**
   * 设置 SMAA 启用状态
   */
  setSMAAEnabled(enabled: boolean): void {
    this._smaaEnabled = enabled
    this._smaaEffect.blendMode.opacity.value = enabled ? 1 : 0
  }

  /**
   * 获取 SMAA 启用状态
   */
  getSMAAEnabled(): boolean {
    return this._smaaEnabled
  }

  /**
   * 调整尺寸
   */
  resize(width: number, height: number): void {
    this._composer.setSize(width, height)
  }

  /**
   * 渲染（使用 Composer）
   */
  render(deltaTime?: number): void {
    if (this._enabled) {
      this._composer.render(deltaTime)
    } else {
      // 禁用后处理时，直接使用 renderer
      this._renderer.render(this._scene, this._camera)
    }
  }

  /**
   * 获取所有设置
   */
  getAllSettings(): IPostProcessingSettings {
    return {
      enabled: this._enabled,
      bloom: this.getBloomSettings(),
      outline: this.getOutlineSettings(),
      smaaEnabled: this._smaaEnabled,
    }
  }

  /**
   * 应用所有设置
   */
  applyAllSettings(settings: Partial<IPostProcessingSettings>): void {
    if (settings.enabled !== undefined) {
      this.setEnabled(settings.enabled)
    }
    if (settings.bloom) {
      this.setBloomSettings(settings.bloom)
    }
    if (settings.outline) {
      this.setOutlineSettings(settings.outline)
    }
    if (settings.smaaEnabled !== undefined) {
      this.setSMAAEnabled(settings.smaaEnabled)
    }
  }

  applyProjectSettings(settings: PostProcessingData): void {
    this.setEnabled(settings.enabled)
    this.setBloomSettings({
      enabled: settings.bloom.enabled,
      intensity: settings.bloom.strength,
      luminanceThreshold: settings.bloom.threshold,
      radius: settings.bloom.radius,
    })
    this.setOutlineSettings({
      enabled: settings.outline.enabled,
      color: settings.outline.color,
      edgeStrength: settings.outline.thickness,
    })
    this.setSMAAEnabled(settings.smaa.enabled)
    this._renderer.toneMapping = this.toThreeToneMapping(settings.toneMapping.type)
    this._renderer.toneMappingExposure = settings.toneMapping.exposure
  }

  toProjectData(): PostProcessingData {
    return {
      enabled: this._enabled,
      bloom: {
        enabled: this._bloomSettings.enabled,
        strength: this._bloomSettings.intensity,
        radius: this._bloomSettings.radius,
        threshold: this._bloomSettings.luminanceThreshold,
      },
      outline: {
        enabled: this._outlineSettings.enabled,
        color: String(this._outlineSettings.color),
        thickness: this._outlineSettings.edgeStrength,
      },
      smaa: {
        enabled: this._smaaEnabled,
      },
      toneMapping: {
        type: this.fromThreeToneMapping(this._renderer.toneMapping),
        exposure: this._renderer.toneMappingExposure,
      },
    }
  }

  private toThreeToneMapping(type: ToneMappingType): THREE.ToneMapping {
    switch (type) {
      case 'none':
        return THREE.NoToneMapping
      case 'linear':
        return THREE.LinearToneMapping
      case 'reinhard':
        return THREE.ReinhardToneMapping
      case 'cineon':
        return THREE.CineonToneMapping
      case 'aces':
      default:
        return THREE.ACESFilmicToneMapping
    }
  }

  private fromThreeToneMapping(mapping: THREE.ToneMapping): ToneMappingType {
    if (mapping === THREE.NoToneMapping) return 'none'
    if (mapping === THREE.LinearToneMapping) return 'linear'
    if (mapping === THREE.ReinhardToneMapping) return 'reinhard'
    if (mapping === THREE.CineonToneMapping) return 'cineon'
    return 'aces'
  }

  /**
   * 释放资源
   */
  dispose(): void {
    this._composer.dispose()
  }
}
