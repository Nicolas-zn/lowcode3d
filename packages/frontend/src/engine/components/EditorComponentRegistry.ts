import type { ComponentDefinition, ComponentInstance } from '@lowcode3d/shared'

export type EditorComponentCategory = 'basic' | 'model' | 'light' | 'media' | 'annotation' | 'data'

export interface EditorDragPayload {
  type: string
  component: {
    type: string
    props?: Record<string, unknown>
  }
  legacyType?: string
}

export interface EditorComponentDefinition extends ComponentDefinition {
  icon: string
  order: number
  category: EditorComponentCategory
  dragPayload: EditorDragPayload
  inspector: {
    title: string
    groups: string[]
  }
}

export interface CreateEditorComponentInstanceOptions {
  id?: string
  objectUuid?: string
  props?: Record<string, unknown>
  enabled?: boolean
}

const primitiveDefinition: EditorComponentDefinition = {
  type: 'primitive',
  title: '基础几何体',
  category: 'basic',
  version: '1.0.0',
  icon: 'Box',
  order: 10,
  capabilities: ['renderable', 'bindable', 'animatable', 'interactive', 'publishable'],
  defaultProps: {
    primitiveType: 'box',
    width: 1,
    height: 1,
    depth: 1,
    radius: 0.5,
    color: '#409eff',
  },
  properties: [
    {
      key: 'primitiveType',
      label: '几何体类型',
      type: 'select',
      group: '基础',
      defaultValue: 'box',
      required: true,
      options: [
        { label: '立方体', value: 'box' },
        { label: '球体', value: 'sphere' },
        { label: '圆柱体', value: 'cylinder' },
        { label: '圆锥体', value: 'cone' },
        { label: '圆环', value: 'torus' },
        { label: '平面', value: 'plane' },
        { label: '圆片', value: 'circle' },
        { label: '圆环片', value: 'ring' },
        { label: '四面体', value: 'tetrahedron' },
        { label: '八面体', value: 'octahedron' },
        { label: '二十面体', value: 'icosahedron' },
        { label: '十二面体', value: 'dodecahedron' },
      ],
    },
    { key: 'width', label: '宽度', type: 'number', group: '尺寸', defaultValue: 1, min: 0.01 },
    { key: 'height', label: '高度', type: 'number', group: '尺寸', defaultValue: 1, min: 0.01 },
    { key: 'depth', label: '深度', type: 'number', group: '尺寸', defaultValue: 1, min: 0.01 },
    { key: 'radius', label: '半径', type: 'number', group: '尺寸', defaultValue: 0.5, min: 0.01 },
    {
      key: 'color',
      label: '颜色',
      type: 'color',
      group: '材质',
      defaultValue: '#409eff',
      bindable: true,
    },
  ],
  dragPayload: {
    type: 'component',
    legacyType: 'model',
    component: { type: 'primitive', props: { primitiveType: 'box' } },
  },
  inspector: {
    title: '几何体属性',
    groups: ['基础', '尺寸', '材质'],
  },
}

const lightDefinition: EditorComponentDefinition = {
  type: 'light',
  title: '灯光',
  category: 'light',
  version: '1.0.0',
  icon: 'Sun',
  order: 20,
  capabilities: ['bindable', 'animatable', 'publishable'],
  defaultProps: {
    lightType: 'directional',
    color: '#ffffff',
    intensity: 1,
    distance: 10,
    angle: Math.PI / 6,
    penumbra: 0.1,
    castShadow: true,
  },
  properties: [
    {
      key: 'lightType',
      label: '灯光类型',
      type: 'select',
      group: '基础',
      defaultValue: 'directional',
      required: true,
      options: [
        { label: '环境光', value: 'ambient' },
        { label: '平行光', value: 'directional' },
        { label: '点光源', value: 'point' },
        { label: '聚光灯', value: 'spot' },
        { label: '半球光', value: 'hemisphere' },
      ],
    },
    { key: 'color', label: '颜色', type: 'color', group: '基础', defaultValue: '#ffffff' },
    { key: 'intensity', label: '强度', type: 'number', group: '基础', defaultValue: 1, min: 0 },
  ],
  dragPayload: {
    type: 'component',
    legacyType: 'light',
    component: { type: 'light', props: { lightType: 'directional' } },
  },
  inspector: {
    title: '灯光属性',
    groups: ['基础', '范围', '阴影'],
  },
}

const billboardDefinition: EditorComponentDefinition = {
  type: 'billboard',
  title: '广告牌',
  category: 'media',
  version: '1.0.0',
  icon: 'Image',
  order: 30,
  capabilities: ['renderable', 'assetDependent', 'bindable', 'interactive', 'publishable'],
  defaultProps: {
    assetUrl: '',
    width: 2,
    height: 1,
    opacity: 1,
    alwaysFaceCamera: true,
    anchor: 'center',
  },
  properties: [
    { key: 'assetUrl', label: '图片资源', type: 'asset', group: '资源', required: true },
    { key: 'width', label: '宽度', type: 'number', group: '尺寸', defaultValue: 2, min: 0.01 },
    { key: 'height', label: '高度', type: 'number', group: '尺寸', defaultValue: 1, min: 0.01 },
    {
      key: 'opacity',
      label: '透明度',
      type: 'number',
      group: '样式',
      defaultValue: 1,
      min: 0,
      max: 1,
    },
  ],
  dragPayload: {
    type: 'component',
    legacyType: 'custom_billboard',
    component: { type: 'billboard', props: {} },
  },
  inspector: {
    title: '广告牌属性',
    groups: ['资源', '尺寸', '样式', '行为'],
  },
}

const poiDefinition: EditorComponentDefinition = {
  type: 'poi',
  title: 'POI 标注',
  category: 'annotation',
  version: '1.0.0',
  icon: 'MapPin',
  order: 40,
  capabilities: ['renderable', 'assetDependent', 'bindable', 'interactive', 'publishable'],
  defaultProps: {
    iconUrl: '',
    label: '标注点',
    size: 1,
    anchor: 'bottom',
    alwaysFaceCamera: true,
    statusColor: '#409eff',
  },
  properties: [
    { key: 'iconUrl', label: '图标资源', type: 'asset', group: '资源' },
    { key: 'label', label: '标签文本', type: 'text', group: '内容', defaultValue: '标注点' },
    { key: 'size', label: '尺寸', type: 'number', group: '尺寸', defaultValue: 1, min: 0.1 },
    { key: 'statusColor', label: '状态色', type: 'color', group: '状态', defaultValue: '#409eff' },
  ],
  dragPayload: {
    type: 'component',
    legacyType: 'custom_billboard',
    component: { type: 'poi', props: {} },
  },
  inspector: {
    title: 'POI 属性',
    groups: ['资源', '内容', '尺寸', '布局', '状态'],
  },
}

export const editorComponentDefinitions: EditorComponentDefinition[] = [
  primitiveDefinition,
  lightDefinition,
  billboardDefinition,
  poiDefinition,
]

export class EditorComponentRegistry {
  private readonly definitions = new Map<string, EditorComponentDefinition>()

  constructor(definitions: EditorComponentDefinition[] = editorComponentDefinitions) {
    definitions.forEach((definition) => this.register(definition))
  }

  register(definition: EditorComponentDefinition): void {
    this.definitions.set(definition.type, definition)
  }

  get(type: string): EditorComponentDefinition | undefined {
    return this.definitions.get(type)
  }

  list(category?: EditorComponentCategory): EditorComponentDefinition[] {
    const definitions = Array.from(this.definitions.values()).sort((a, b) => a.order - b.order)
    return category
      ? definitions.filter((definition) => definition.category === category)
      : definitions
  }

  createInstance(
    type: string,
    options: CreateEditorComponentInstanceOptions = {}
  ): ComponentInstance {
    const definition = this.get(type)
    if (!definition) {
      throw new Error(`Unknown editor component type: ${type}`)
    }

    return {
      id: options.id ?? `${type}-${crypto.randomUUID()}`,
      type,
      version: definition.version,
      objectUuid: options.objectUuid,
      props: {
        ...definition.defaultProps,
        ...(options.props ?? {}),
      },
      enabled: options.enabled ?? true,
    }
  }
}

export const editorComponentRegistry = new EditorComponentRegistry()
