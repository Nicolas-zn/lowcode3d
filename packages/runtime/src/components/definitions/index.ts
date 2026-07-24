import type { ComponentDefinition } from '@lowcode3d/shared'
import { primitiveComponentDefinition } from './primitive'
import { lightComponentDefinition } from './light'
import { billboardComponentDefinition } from './billboard'
import { poiComponentDefinition } from './poi'

export { primitiveComponentDefinition } from './primitive'
export { lightComponentDefinition } from './light'
export { billboardComponentDefinition } from './billboard'
export { poiComponentDefinition } from './poi'

export const runtimeComponentDefinitions: ComponentDefinition[] = [
  primitiveComponentDefinition,
  lightComponentDefinition,
  billboardComponentDefinition,
  poiComponentDefinition,
]
