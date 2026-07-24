export interface RuntimeConfig {
  controls: {
    enabled: boolean
  }
  animations: {
    autoplay: boolean
  }
  events: {
    enabled: boolean
  }
  data: {
    enabled: boolean
    useSampleDataInEditor: boolean
  }
}

export type ToneMappingType = 'none' | 'linear' | 'reinhard' | 'cineon' | 'aces'

export interface PostProcessingData {
  enabled: boolean
  bloom: {
    enabled: boolean
    strength: number
    radius: number
    threshold: number
  }
  outline: {
    enabled: boolean
    color: string
    thickness: number
  }
  smaa: {
    enabled: boolean
  }
  toneMapping: {
    type: ToneMappingType
    exposure: number
  }
}

export interface PublishConfig {
  embedDefaults: {
    toolbar: boolean
    controls: boolean
    transparent: boolean
    autoplay: boolean
  }
  runtimeVersion?: string
}
