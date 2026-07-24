import type { Asset } from '@/api/assets'

export type EditorAssetType = 'model' | 'hdri' | 'material' | 'texture' | 'billboard' | 'place_icon'

export type ResourceTab = 'models' | 'hdr' | 'materials' | 'textures' | 'billboards' | 'place-icons'

export interface AssetTypeOption {
  value: EditorAssetType
  label: string
  icon: string
  accept: string
  description: string
}

export interface ResourceTabDefinition {
  key: ResourceTab
  type: EditorAssetType
  label: string
}

export const ASSET_TYPE_LABELS: Record<EditorAssetType, string> = {
  model: '模型资源',
  hdri: 'HDR 环境',
  material: '预定义材质',
  texture: '纹理贴图',
  billboard: '广告牌',
  place_icon: '标注图标',
}

export const RESOURCE_TABS: ResourceTabDefinition[] = [
  { key: 'models', type: 'model', label: ASSET_TYPE_LABELS.model },
  { key: 'hdr', type: 'hdri', label: ASSET_TYPE_LABELS.hdri },
  { key: 'materials', type: 'material', label: ASSET_TYPE_LABELS.material },
  { key: 'textures', type: 'texture', label: ASSET_TYPE_LABELS.texture },
  { key: 'billboards', type: 'billboard', label: ASSET_TYPE_LABELS.billboard },
  { key: 'place-icons', type: 'place_icon', label: ASSET_TYPE_LABELS.place_icon },
]

export const RESOURCE_TAB_TYPE_MAP = RESOURCE_TABS.reduce(
  (map, tab) => {
    map[tab.key] = tab.type
    return map
  },
  {} as Record<ResourceTab, EditorAssetType>
)

export const ASSET_TYPE_OPTIONS: AssetTypeOption[] = [
  {
    value: 'model',
    label: '模型',
    icon: '📦',
    accept: '.glb,.gltf,.fbx,.obj',
    description: '支持格式: glb、gltf、fbx、obj',
  },
  {
    value: 'hdri',
    label: 'HDR 环境',
    icon: '🌅',
    accept: '.hdr,.exr',
    description: '支持格式: hdr、exr',
  },
  {
    value: 'texture',
    label: '纹理贴图',
    icon: '🎨',
    accept: '.jpg,.jpeg,.png,.webp',
    description: '支持格式: jpg、png、webp',
  },
  {
    value: 'place_icon',
    label: '标注图标',
    icon: '📍',
    accept: '.svg,.png,.jpg,.jpeg',
    description: '支持格式: svg、png、jpg',
  },
]

export const EDITOR_MODEL_LIBRARY_CATEGORY = ASSET_TYPE_LABELS.model

export function filterAssetsByResourceTab(assets: Asset[], tab: ResourceTab): Asset[] {
  const type = RESOURCE_TAB_TYPE_MAP[tab]

  if (type === 'billboard') {
    return assets.filter(
      (asset) =>
        asset.type === 'billboard' ||
        asset.category === 'billboard' ||
        asset.tags?.includes('billboard')
    )
  }

  return assets.filter((asset) => asset.type === type)
}
