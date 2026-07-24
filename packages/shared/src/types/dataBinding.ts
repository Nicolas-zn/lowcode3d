export type DataSourceType = 'staticJson' | 'http' | 'websocket'

export type DataSourceAuthMode = 'none' | 'bearer' | 'basic' | 'customHeader'

export interface DataSourceConfig {
  id: string
  name: string
  type: DataSourceType
  config: Record<string, unknown>
  refreshInterval?: number
  sampleData?: unknown
  authMode?: DataSourceAuthMode
  enabled: boolean
  unsupported?: boolean
}

export type BindingTransformType =
  | 'identity'
  | 'mapValue'
  | 'formatText'
  | 'numberRange'
  | 'boolean'

export interface BindingTransformConfig {
  type: BindingTransformType
  options?: Record<string, unknown>
}

export interface DataBindingConfig {
  id: string
  objectUuid: string
  propertyPath: string
  sourceId: string
  dataPath: string
  componentId?: string
  transform?: BindingTransformConfig
  fallbackValue?: unknown
  enabled: boolean
  unsupported?: boolean
}
