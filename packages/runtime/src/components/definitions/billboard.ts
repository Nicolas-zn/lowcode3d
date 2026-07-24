import type { ComponentDefinition } from '@lowcode3d/shared'

export const billboardComponentDefinition: ComponentDefinition = {
  type: 'billboard',
  title: '广告牌',
  category: 'media',
  version: '1.0.0',
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
    {
      key: 'assetUrl',
      label: '图片资源',
      type: 'asset',
      group: '资源',
      required: true,
    },
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
      step: 0.01,
      bindable: true,
    },
    {
      key: 'alwaysFaceCamera',
      label: '朝向相机',
      type: 'boolean',
      group: '行为',
      defaultValue: true,
    },
    {
      key: 'anchor',
      label: '锚点',
      type: 'select',
      group: '布局',
      defaultValue: 'center',
      options: [
        { label: '居中', value: 'center' },
        { label: '底部', value: 'bottom' },
        { label: '顶部', value: 'top' },
      ],
    },
  ],
}
