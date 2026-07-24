export type RuntimeTriggerType =
  | 'click'
  | 'doubleClick'
  | 'hoverEnter'
  | 'hoverLeave'
  | 'visibleEnter'

export type RuntimeActionType =
  | 'openUrl'
  | 'playAnimation'
  | 'pauseAnimation'
  | 'switchCamera'
  | 'setObjectVisible'
  | 'setObjectMaterial'
  | 'showPopup'
  | 'emitMessage'

export interface RuntimeActionConfig {
  id: string
  type: RuntimeActionType
  payload: Record<string, unknown>
  enabled: boolean
  unsupported?: boolean
}

export interface RuntimeEventConfig {
  id: string
  objectUuid: string
  trigger: RuntimeTriggerType
  actions: RuntimeActionConfig[]
  enabled: boolean
  unsupported?: boolean
}
