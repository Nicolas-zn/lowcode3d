import type { ComponentDefinition, ComponentInstance } from '@lowcode3d/shared'
import { runtimeComponentDefinitions } from './definitions'

export interface CreateComponentInstanceOptions {
  id?: string
  objectUuid?: string
  props?: Record<string, unknown>
  enabled?: boolean
}

export class ComponentRegistry {
  private readonly definitions = new Map<string, ComponentDefinition>()

  constructor(definitions: ComponentDefinition[] = []) {
    definitions.forEach((definition) => this.register(definition))
  }

  register(definition: ComponentDefinition): void {
    if (!definition.type) {
      throw new Error('Component definition type is required')
    }

    this.definitions.set(definition.type, definition)
  }

  get(type: string): ComponentDefinition | undefined {
    return this.definitions.get(type)
  }

  list(): ComponentDefinition[] {
    return Array.from(this.definitions.values())
  }

  createInstance(type: string, options: CreateComponentInstanceOptions = {}): ComponentInstance {
    const definition = this.get(type)
    if (!definition) {
      throw new Error(`Unknown component type: ${type}`)
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

export function createDefaultComponentRegistry(): ComponentRegistry {
  return new ComponentRegistry(runtimeComponentDefinitions)
}

export const defaultComponentRegistry = createDefaultComponentRegistry()
