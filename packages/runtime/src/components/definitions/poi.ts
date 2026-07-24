import type { ComponentDefinition } from '@lowcode3d/shared'

export const poiComponentDefinition: ComponentDefinition = {
  type: 'poi',
  title: 'POI 标注',
  category: 'annotation',
  version: '1.0.0',
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
    {
      key: 'label',
      label: '标签文本',
      type: 'text',
      group: '内容',
      defaultValue: '标注点',
      bindable: true,
    },
    { key: 'size', label: '尺寸', type: 'number', group: '尺寸', defaultValue: 1, min: 0.1 },
    {
      key: 'anchor',
      label: '锚点',
      type: 'select',
      group: '布局',
      defaultValue: 'bottom',
      options: [
        { label: '底部', value: 'bottom' },
        { label: '居中', value: 'center' },
        { label: '顶部', value: 'top' },
      ],
    },
    {
      key: 'alwaysFaceCamera',
      label: '朝向相机',
      type: 'boolean',
      group: '行为',
      defaultValue: true,
    },
    {
      key: 'statusColor',
      label: '状态色',
      type: 'color',
      group: '状态',
      defaultValue: '#409eff',
      bindable: true,
    },
  ],
}
