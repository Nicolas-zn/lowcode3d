import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type { RuntimeActionConfig, RuntimeEventConfig, RuntimeTriggerType } from '@lowcode3d/shared'
import { getEngine } from '@/engine'
import { useEditorStateStore } from './editorStateStore'

export interface CreateRuntimeEventInput {
  objectUuid: string
  trigger?: RuntimeTriggerType
  actions?: RuntimeActionConfig[]
  enabled?: boolean
}

function cloneEvents(events: RuntimeEventConfig[]): RuntimeEventConfig[] {
  return events.map((event) => ({
    ...event,
    actions: event.actions.map((action) => ({
      ...action,
      payload: { ...action.payload },
    })),
  }))
}

function createId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`
}

export const useEventStore = defineStore('runtimeEvents', () => {
  const events = ref<RuntimeEventConfig[]>([])
  const enabledEvents = computed(() => events.value.filter((event) => event.enabled))

  function syncSceneUserData(): void {
    const engine = getEngine()
    if (!engine?.isInitialized) return
    engine.sceneManager.scene.userData.runtimeEvents = cloneEvents(events.value)
  }

  function markModified(): void {
    syncSceneUserData()
    useEditorStateStore().markAsModified()
  }

  function replaceEvents(nextEvents: RuntimeEventConfig[], markDirty = false): void {
    events.value = cloneEvents(nextEvents)
    syncSceneUserData()
    if (markDirty) {
      useEditorStateStore().markAsModified()
    }
  }

  function hydrateFromScene(): void {
    const engine = getEngine()
    const sceneEvents = engine?.sceneManager.scene.userData.runtimeEvents
    if (Array.isArray(sceneEvents)) {
      replaceEvents(sceneEvents as RuntimeEventConfig[])
    }
  }

  function addEvent(input: CreateRuntimeEventInput): RuntimeEventConfig {
    const event: RuntimeEventConfig = {
      id: createId('event'),
      objectUuid: input.objectUuid,
      trigger: input.trigger ?? 'click',
      actions: input.actions ?? [],
      enabled: input.enabled ?? true,
    }

    events.value.push(event)
    markModified()
    return event
  }

  function updateEvent(id: string, patch: Partial<RuntimeEventConfig>): RuntimeEventConfig | null {
    const index = events.value.findIndex((event) => event.id === id)
    if (index < 0) return null

    events.value[index] = {
      ...events.value[index],
      ...patch,
      actions: patch.actions ?? events.value[index].actions,
    }
    markModified()
    return events.value[index]
  }

  function removeEvent(id: string): boolean {
    const nextEvents = events.value.filter((event) => event.id !== id)
    if (nextEvents.length === events.value.length) return false

    events.value = nextEvents
    markModified()
    return true
  }

  function addAction(
    eventId: string,
    action: Omit<RuntimeActionConfig, 'id'>
  ): RuntimeActionConfig | null {
    const event = events.value.find((item) => item.id === eventId)
    if (!event) return null

    const nextAction: RuntimeActionConfig = {
      ...action,
      id: createId('action'),
    }
    event.actions.push(nextAction)
    markModified()
    return nextAction
  }

  function updateAction(
    eventId: string,
    actionId: string,
    patch: Partial<RuntimeActionConfig>
  ): RuntimeActionConfig | null {
    const event = events.value.find((item) => item.id === eventId)
    const action = event?.actions.find((item) => item.id === actionId)
    if (!action) return null

    Object.assign(action, patch, {
      payload: patch.payload ?? action.payload,
    })
    markModified()
    return action
  }

  function removeAction(eventId: string, actionId: string): boolean {
    const event = events.value.find((item) => item.id === eventId)
    if (!event) return false

    const nextActions = event.actions.filter((action) => action.id !== actionId)
    if (nextActions.length === event.actions.length) return false

    event.actions = nextActions
    markModified()
    return true
  }

  function getEventsForObject(objectUuid: string): RuntimeEventConfig[] {
    return events.value.filter((event) => event.objectUuid === objectUuid)
  }

  function reset(): void {
    events.value = []
    syncSceneUserData()
  }

  return {
    events,
    enabledEvents,
    replaceEvents,
    hydrateFromScene,
    addEvent,
    updateEvent,
    removeEvent,
    addAction,
    updateAction,
    removeAction,
    getEventsForObject,
    reset,
  }
})
