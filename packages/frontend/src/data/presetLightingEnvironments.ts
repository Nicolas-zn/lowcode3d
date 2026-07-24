/**
 * 预设灯光环境数据
 * 提供多种预设灯光/环境配置供用户快速应用
 *
 * 注：灯光位置已针对大场景优化，适用于 100-500 单位范围的场景
 */

import type { LightType, ILightOptions } from '@/engine/lights'

/**
 * 预设灯光配置
 */
export interface IPresetLight {
  type: LightType
  options: ILightOptions
}

/**
 * 预设环境配置
 */
export interface IPresetEnvironment {
  hdrUrl?: string
  backgroundColor?: string
  useAsBackground?: boolean
}

/**
 * 预设灯光环境
 */
export interface IPresetLightingEnvironment {
  id: string
  name: string
  description: string
  icon: string
  category: 'studio' | 'outdoor' | 'indoor' | 'artistic'
  lights: IPresetLight[]
  environment?: IPresetEnvironment
}

/**
 * 预设灯光环境列表
 * 灯光位置已调整为适合大场景（约 100-500 单位范围）
 */
export const presetLightingEnvironments: IPresetLightingEnvironment[] = [
  // ============ 摄影棚类 ============
  {
    id: 'studio-three-point',
    name: '三点布光',
    description: '经典摄影棚三点布光：主光、补光、轮廓光',
    icon: '🎬',
    category: 'studio',
    lights: [
      {
        type: 'directional',
        options: {
          name: '主光 (Key Light)',
          color: 0xffffff,
          intensity: 1.5,
          position: { x: 100, y: 200, z: 100 },
          castShadow: true,
        },
      },
      {
        type: 'directional',
        options: {
          name: '补光 (Fill Light)',
          color: 0xaaccff,
          intensity: 0.8,
          position: { x: -100, y: 150, z: 80 },
          castShadow: false,
        },
      },
      {
        type: 'spot',
        options: {
          name: '轮廓光 (Rim Light)',
          color: 0xffffee,
          intensity: 1.0,
          position: { x: 0, y: 150, z: -100 },
          angle: Math.PI / 6,
          penumbra: 0.3,
          distance: 500,
          castShadow: false,
        },
      },
      {
        type: 'ambient',
        options: {
          name: '环境补光',
          color: 0x404050,
          intensity: 0.4,
        },
      },
    ],
  },
  {
    id: 'studio-product',
    name: '产品展示',
    description: '适合产品渲染的柔和均匀光照',
    icon: '📦',
    category: 'studio',
    lights: [
      {
        type: 'hemisphere',
        options: {
          name: '天空光',
          color: 0xffffff,
          groundColor: 0x444444,
          intensity: 1.0,
          position: { x: 0, y: 200, z: 0 },
        },
      },
      {
        type: 'directional',
        options: {
          name: '主光',
          color: 0xffffff,
          intensity: 1.0,
          position: { x: 80, y: 250, z: 120 },
          castShadow: true,
        },
      },
      {
        type: 'directional',
        options: {
          name: '侧光',
          color: 0xeeeeff,
          intensity: 0.5,
          position: { x: -120, y: 150, z: 0 },
          castShadow: false,
        },
      },
    ],
    environment: {
      backgroundColor: '#2a2a3a',
    },
  },
  {
    id: 'studio-soft-box',
    name: '柔光箱',
    description: '模拟摄影柔光箱效果',
    icon: '💡',
    category: 'studio',
    lights: [
      {
        type: 'point',
        options: {
          name: '顶部柔光',
          color: 0xfff5e6,
          intensity: 2.0,
          position: { x: 0, y: 200, z: 0 },
          distance: 500,
          decay: 1.5,
          castShadow: true,
        },
      },
      {
        type: 'point',
        options: {
          name: '左侧柔光',
          color: 0xfff5e6,
          intensity: 1.2,
          position: { x: -150, y: 100, z: 50 },
          distance: 400,
          decay: 1.5,
          castShadow: false,
        },
      },
      {
        type: 'point',
        options: {
          name: '右侧柔光',
          color: 0xfff5e6,
          intensity: 1.2,
          position: { x: 150, y: 100, z: 50 },
          distance: 400,
          decay: 1.5,
          castShadow: false,
        },
      },
      {
        type: 'ambient',
        options: {
          name: '环境光',
          color: 0x303040,
          intensity: 0.5,
        },
      },
    ],
  },

  // ============ 户外类 ============
  {
    id: 'outdoor-sunny',
    name: '户外阳光',
    description: '明亮的正午阳光效果',
    icon: '☀️',
    category: 'outdoor',
    lights: [
      {
        type: 'directional',
        options: {
          name: '太阳光',
          color: 0xfffbe8,
          intensity: 2.0,
          position: { x: 200, y: 400, z: 200 },
          castShadow: true,
        },
      },
      {
        type: 'hemisphere',
        options: {
          name: '天空光',
          color: 0x87ceeb,
          groundColor: 0x3d5c3d,
          intensity: 0.8,
          position: { x: 0, y: 200, z: 0 },
        },
      },
    ],
    environment: {
      backgroundColor: '#87ceeb',
    },
  },
  {
    id: 'outdoor-sunset',
    name: '傍晚暖光',
    description: '温暖的夕阳光照效果',
    icon: '🌅',
    category: 'outdoor',
    lights: [
      {
        type: 'directional',
        options: {
          name: '夕阳',
          color: 0xff7e47,
          intensity: 1.5,
          position: { x: -300, y: 100, z: 200 },
          castShadow: true,
        },
      },
      {
        type: 'hemisphere',
        options: {
          name: '天空光',
          color: 0xffb366,
          groundColor: 0x553322,
          intensity: 0.6,
          position: { x: 0, y: 200, z: 0 },
        },
      },
      {
        type: 'ambient',
        options: {
          name: '环境补光',
          color: 0x442211,
          intensity: 0.3,
        },
      },
    ],
    environment: {
      backgroundColor: '#ff6b35',
    },
  },
  {
    id: 'outdoor-forest',
    name: '森林环境',
    description: '树荫下的斑驳光影，类似 Blender 森林 HDR',
    icon: '🌲',
    category: 'outdoor',
    lights: [
      {
        type: 'directional',
        options: {
          name: '透过树叶的阳光',
          color: 0xfff8dc,
          intensity: 1.2,
          position: { x: 100, y: 300, z: 100 },
          castShadow: true,
        },
      },
      {
        type: 'hemisphere',
        options: {
          name: '森林环境光',
          color: 0x8fbc8f,
          groundColor: 0x2f4f2f,
          intensity: 0.9,
          position: { x: 0, y: 200, z: 0 },
        },
      },
      {
        type: 'ambient',
        options: {
          name: '阴影区补光',
          color: 0x1a3319,
          intensity: 0.4,
        },
      },
    ],
    environment: {
      backgroundColor: '#2d4a2d',
    },
  },
  {
    id: 'outdoor-overcast',
    name: '阴天',
    description: '柔和的阴天漫射光',
    icon: '☁️',
    category: 'outdoor',
    lights: [
      {
        type: 'hemisphere',
        options: {
          name: '阴天天空光',
          color: 0xb0b0b8,
          groundColor: 0x505050,
          intensity: 1.2,
          position: { x: 0, y: 200, z: 0 },
        },
      },
      {
        type: 'directional',
        options: {
          name: '漫射光',
          color: 0xc0c0c8,
          intensity: 0.7,
          position: { x: 0, y: 250, z: 100 },
          castShadow: true,
        },
      },
    ],
    environment: {
      backgroundColor: '#9ca3af',
    },
  },

  // ============ 室内类 ============
  {
    id: 'indoor-warm',
    name: '室内暖光',
    description: '温馨的室内灯光氛围',
    icon: '🏠',
    category: 'indoor',
    lights: [
      {
        type: 'point',
        options: {
          name: '主灯',
          color: 0xffd9a0,
          intensity: 2.0,
          position: { x: 0, y: 150, z: 0 },
          distance: 400,
          decay: 1.5,
          castShadow: true,
        },
      },
      {
        type: 'point',
        options: {
          name: '台灯',
          color: 0xffe4b5,
          intensity: 1.0,
          position: { x: -80, y: 60, z: 50 },
          distance: 200,
          decay: 1.5,
          castShadow: false,
        },
      },
      {
        type: 'ambient',
        options: {
          name: '环境光',
          color: 0x3d3020,
          intensity: 0.4,
        },
      },
    ],
    environment: {
      backgroundColor: '#1a1a2e',
    },
  },
  {
    id: 'indoor-office',
    name: '办公室',
    description: '明亮的办公室日光灯效果',
    icon: '🏢',
    category: 'indoor',
    lights: [
      {
        type: 'directional',
        options: {
          name: '日光灯',
          color: 0xf5f5ff,
          intensity: 1.5,
          position: { x: 0, y: 200, z: 0 },
          castShadow: true,
        },
      },
      {
        type: 'ambient',
        options: {
          name: '环境光',
          color: 0xd0d0e0,
          intensity: 0.6,
        },
      },
    ],
    environment: {
      backgroundColor: '#e5e7eb',
    },
  },

  // ============ 艺术类 ============
  {
    id: 'artistic-neon',
    name: '霓虹灯',
    description: '赛博朋克风格城市霓虹灯效果',
    icon: '🌃',
    category: 'artistic',
    lights: [
      {
        type: 'point',
        options: {
          name: '粉色霓虹',
          color: 0xff00ff,
          intensity: 2.5,
          position: { x: -120, y: 80, z: 80 },
          distance: 350,
          decay: 1.5,
          castShadow: false,
        },
      },
      {
        type: 'point',
        options: {
          name: '青色霓虹',
          color: 0x00ffff,
          intensity: 2.5,
          position: { x: 120, y: 80, z: 80 },
          distance: 350,
          decay: 1.5,
          castShadow: false,
        },
      },
      {
        type: 'spot',
        options: {
          name: '聚光灯',
          color: 0xffffff,
          intensity: 1.5,
          position: { x: 0, y: 250, z: 120 },
          angle: Math.PI / 8,
          penumbra: 0.5,
          distance: 500,
          castShadow: true,
        },
      },
      {
        type: 'ambient',
        options: {
          name: '暗环境',
          color: 0x101010,
          intensity: 0.3,
        },
      },
    ],
    environment: {
      backgroundColor: '#0a0a1a',
    },
  },
  {
    id: 'artistic-dramatic',
    name: '戏剧光',
    description: '强对比度的戏剧性光照',
    icon: '🎭',
    category: 'artistic',
    lights: [
      {
        type: 'spot',
        options: {
          name: '主聚光',
          color: 0xffffff,
          intensity: 3.0,
          position: { x: 80, y: 200, z: 120 },
          angle: Math.PI / 6,
          penumbra: 0.2,
          distance: 500,
          castShadow: true,
        },
      },
      {
        type: 'ambient',
        options: {
          name: '暗环境',
          color: 0x050510,
          intensity: 0.15,
        },
      },
    ],
    environment: {
      backgroundColor: '#000000',
    },
  },
  {
    id: 'artistic-moonlight',
    name: '月光',
    description: '静谧的月光夜景效果',
    icon: '🌙',
    category: 'artistic',
    lights: [
      {
        type: 'directional',
        options: {
          name: '月光',
          color: 0xaabbff,
          intensity: 0.8,
          position: { x: -200, y: 300, z: 100 },
          castShadow: true,
        },
      },
      {
        type: 'hemisphere',
        options: {
          name: '夜空光',
          color: 0x1a1a3a,
          groundColor: 0x0a0a15,
          intensity: 0.4,
          position: { x: 0, y: 200, z: 0 },
        },
      },
    ],
    environment: {
      backgroundColor: '#0a0a1a',
    },
  },
]

/**
 * 获取所有分类
 */
export function getLightingCategories(): string[] {
  const cats = new Set<string>()
  presetLightingEnvironments.forEach((env) => cats.add(env.category))
  return Array.from(cats)
}

/**
 * 按分类获取预设环境
 */
export function getLightingEnvironmentsByCategory(category: string): IPresetLightingEnvironment[] {
  return presetLightingEnvironments.filter((env) => env.category === category)
}

/**
 * 按分类分组
 */
export function getGroupedLightingEnvironments(): Record<string, IPresetLightingEnvironment[]> {
  const groups: Record<string, IPresetLightingEnvironment[]> = {}
  presetLightingEnvironments.forEach((env) => {
    if (!groups[env.category]) {
      groups[env.category] = []
    }
    groups[env.category].push(env)
  })
  return groups
}

/**
 * 分类中文名映射
 */
export const categoryNames: Record<string, string> = {
  studio: '摄影棚',
  outdoor: '户外',
  indoor: '室内',
  artistic: '艺术',
}
