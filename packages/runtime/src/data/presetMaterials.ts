/**
 * 预设材质数据
 * 共享于编辑器和资源中心
 */

/**
 * 预设材质项
 */
export interface IPresetMaterial {
  id: string
  name: string
  category: string
  color: string
  metalness: number
  roughness: number
  emissive?: string
  emissiveIntensity?: number
  opacity?: number
  transparent?: boolean
}

/**
 * 预设材质列表
 */
export const presetMaterials: IPresetMaterial[] = [
  // 基础颜色
  {
    id: 'basic-red',
    name: '红色',
    category: '基础颜色',
    color: '#e74c3c',
    metalness: 0,
    roughness: 0.5,
  },
  {
    id: 'basic-green',
    name: '绿色',
    category: '基础颜色',
    color: '#2ecc71',
    metalness: 0,
    roughness: 0.5,
  },
  {
    id: 'basic-blue',
    name: '蓝色',
    category: '基础颜色',
    color: '#3498db',
    metalness: 0,
    roughness: 0.5,
  },
  {
    id: 'basic-yellow',
    name: '黄色',
    category: '基础颜色',
    color: '#f1c40f',
    metalness: 0,
    roughness: 0.5,
  },
  {
    id: 'basic-purple',
    name: '紫色',
    category: '基础颜色',
    color: '#9b59b6',
    metalness: 0,
    roughness: 0.5,
  },
  {
    id: 'basic-orange',
    name: '橙色',
    category: '基础颜色',
    color: '#e67e22',
    metalness: 0,
    roughness: 0.5,
  },

  // 金属材质
  {
    id: 'metal-gold',
    name: '黄金',
    category: '金属',
    color: '#FFD700',
    metalness: 1,
    roughness: 0.2,
  },
  {
    id: 'metal-silver',
    name: '白银',
    category: '金属',
    color: '#C0C0C0',
    metalness: 1,
    roughness: 0.2,
  },
  {
    id: 'metal-copper',
    name: '铜',
    category: '金属',
    color: '#B87333',
    metalness: 1,
    roughness: 0.3,
  },
  {
    id: 'metal-iron',
    name: '铁',
    category: '金属',
    color: '#434343',
    metalness: 1,
    roughness: 0.4,
  },
  {
    id: 'metal-chrome',
    name: '铬',
    category: '金属',
    color: '#E8E8E8',
    metalness: 1,
    roughness: 0.1,
  },
  {
    id: 'metal-bronze',
    name: '青铜',
    category: '金属',
    color: '#CD7F32',
    metalness: 0.9,
    roughness: 0.35,
  },

  // 非金属材质
  {
    id: 'non-plastic',
    name: '塑料',
    category: '非金属',
    color: '#FFFFFF',
    metalness: 0,
    roughness: 0.3,
  },
  {
    id: 'non-rubber',
    name: '橡胶',
    category: '非金属',
    color: '#1a1a1a',
    metalness: 0,
    roughness: 0.9,
  },
  {
    id: 'non-wood',
    name: '木材',
    category: '非金属',
    color: '#8B4513',
    metalness: 0,
    roughness: 0.7,
  },
  {
    id: 'non-concrete',
    name: '混凝土',
    category: '非金属',
    color: '#808080',
    metalness: 0,
    roughness: 0.95,
  },
  {
    id: 'non-fabric',
    name: '织物',
    category: '非金属',
    color: '#DEB887',
    metalness: 0,
    roughness: 0.85,
  },
  {
    id: 'non-ceramic',
    name: '陶瓷',
    category: '非金属',
    color: '#FFFAF0',
    metalness: 0,
    roughness: 0.2,
  },

  // 发光材质
  {
    id: 'glow-red',
    name: '红色发光',
    category: '发光',
    color: '#330000',
    metalness: 0,
    roughness: 0.5,
    emissive: '#ff0000',
    emissiveIntensity: 1,
  },
  {
    id: 'glow-green',
    name: '绿色发光',
    category: '发光',
    color: '#003300',
    metalness: 0,
    roughness: 0.5,
    emissive: '#00ff00',
    emissiveIntensity: 1,
  },
  {
    id: 'glow-blue',
    name: '蓝色发光',
    category: '发光',
    color: '#000033',
    metalness: 0,
    roughness: 0.5,
    emissive: '#0088ff',
    emissiveIntensity: 1,
  },
  {
    id: 'glow-white',
    name: '白色发光',
    category: '发光',
    color: '#333333',
    metalness: 0,
    roughness: 0.5,
    emissive: '#ffffff',
    emissiveIntensity: 1,
  },

  // 透明材质
  {
    id: 'trans-glass',
    name: '玻璃',
    category: '透明',
    color: '#88ccff',
    metalness: 0,
    roughness: 0.1,
    opacity: 0.3,
    transparent: true,
  },
  {
    id: 'trans-ice',
    name: '冰',
    category: '透明',
    color: '#e0ffff',
    metalness: 0,
    roughness: 0.2,
    opacity: 0.5,
    transparent: true,
  },
  {
    id: 'trans-water',
    name: '水',
    category: '透明',
    color: '#4169e1',
    metalness: 0,
    roughness: 0.05,
    opacity: 0.4,
    transparent: true,
  },
]

/**
 * 获取所有材质分类
 */
export function getMaterialCategories(): string[] {
  const cats = new Set<string>()
  presetMaterials.forEach((mat) => cats.add(mat.category))
  return Array.from(cats)
}

/**
 * 按分类获取材质
 */
export function getMaterialsByCategory(category: string): IPresetMaterial[] {
  return presetMaterials.filter((mat) => mat.category === category)
}

/**
 * 按分类分组
 */
export function getGroupedMaterials(): Record<string, IPresetMaterial[]> {
  const groups: Record<string, IPresetMaterial[]> = {}
  presetMaterials.forEach((mat) => {
    if (!groups[mat.category]) {
      groups[mat.category] = []
    }
    groups[mat.category].push(mat)
  })
  return groups
}
