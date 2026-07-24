import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const frontendRoot = resolve(__dirname, '..')
const modelLibrarySource = readFileSync(
  resolve(frontendRoot, 'src/components/sidebar/ModelLibrary.vue'),
  'utf8'
)
const resourceStoreSource = readFileSync(resolve(frontendRoot, 'src/stores/resourceStore.ts'), 'utf8')
const projectDataSource = readFileSync(
  resolve(frontendRoot, '../shared/src/types/projectData.ts'),
  'utf8'
)
const objectFactorySource = readFileSync(
  resolve(frontendRoot, 'src/engine/objects/ObjectFactory.ts'),
  'utf8'
)
const sceneSerializerSource = readFileSync(
  resolve(frontendRoot, 'src/engine/core/SceneSerializer.ts'),
  'utf8'
)
const previewRuntimeSource = readFileSync(
  resolve(frontendRoot, 'src/engine/runtime/PreviewSceneRuntime.ts'),
  'utf8'
)

const primitiveTypes = [
  'box',
  'sphere',
  'cylinder',
  'cone',
  'torus',
  'plane',
  'circle',
  'ring',
  'tetrahedron',
  'octahedron',
  'icosahedron',
  'dodecahedron',
]

assert.match(
  modelLibrarySource,
  /columns:\s*2,/,
  'ModelLibrary should default to two columns in the editor sidebar'
)

assert.match(
  modelLibrarySource,
  /createMasonryColumns/,
  'ModelLibrary should split resources across visual masonry columns'
)

assert.match(
  modelLibrarySource,
  /grid-template-columns:\s*repeat\(var\(--model-library-columns\),\s*minmax\(0,\s*1fr\)\)/,
  'ModelLibrary should render two side-by-side masonry columns'
)

assert.match(
  modelLibrarySource,
  /class="model-column"/,
  'ModelLibrary should render item columns so two resources do not stack in one CSS column'
)

assert.match(
  modelLibrarySource,
  /isPrimitiveItem\(item\)/,
  'ModelLibrary should identify primitive items for compact shape cards'
)

assert.match(
  modelLibrarySource,
  /class="primitive-shape-icon"/,
  'Primitive model cards should render shape-specific icons'
)

assert.match(
  modelLibrarySource,
  /\.primitive-grid[\s\S]*?grid-template-columns:\s*repeat\(3,\s*1fr\)/,
  'Primitive shape cards should match the material basic color card grid density'
)

assert.match(
  modelLibrarySource,
  /\.primitive-item[\s\S]*?padding:\s*8px/,
  'Primitive shape cards should use the same compact padding as material cards'
)

for (const primitiveType of primitiveTypes) {
  assert.match(
    resourceStoreSource,
    new RegExp(`__primitive__:${primitiveType}`),
    `Resource store should expose ${primitiveType} in the model library`
  )
  assert.match(
    projectDataSource,
    new RegExp(`'${primitiveType}'`),
    `Shared PrimitiveType should include ${primitiveType}`
  )
  assert.match(
    objectFactorySource,
    new RegExp(`create${primitiveType[0].toUpperCase()}${primitiveType.slice(1)}`),
    `ObjectFactory should create ${primitiveType}`
  )
  assert.match(
    sceneSerializerSource,
    new RegExp(`case '${primitiveType}'`),
    `SceneSerializer should restore ${primitiveType}`
  )
  assert.match(
    previewRuntimeSource,
    new RegExp(`case '${primitiveType}'`),
    `PreviewSceneRuntime should restore ${primitiveType}`
  )
}
