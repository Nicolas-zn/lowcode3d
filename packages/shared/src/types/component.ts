export type ComponentCapability =
  | 'renderable'
  | 'bindable'
  | 'animatable'
  | 'interactive'
  | 'publishable'
  | 'assetDependent'

export type PropertyControlType =
  | 'text'
  | 'number'
  | 'boolean'
  | 'color'
  | 'vector3'
  | 'select'
  | 'asset'
  | 'textarea'
  | 'json'

export interface PropertyOption {
  label: string
  value: string | number | boolean
}

export interface PropertySchema {
  key: string
  label: string
  type: PropertyControlType
  group?: string
  description?: string
  defaultValue?: unknown
  bindable?: boolean
  required?: boolean
  min?: number
  max?: number
  step?: number
  options?: PropertyOption[]
}

export interface ComponentDefinition {
  type: string
  title: string
  category: string
  version: string
  capabilities: ComponentCapability[]
  defaultProps: Record<string, unknown>
  properties: PropertySchema[]
}

export interface ComponentInstance {
  id: string
  type: string
  version?: string
  objectUuid?: string
  props: Record<string, unknown>
  enabled: boolean
  unsupported?: boolean
}
