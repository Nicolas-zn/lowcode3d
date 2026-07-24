import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

function readSource(path) {
  assert(existsSync(path), `${path} should exist`)
  return readFileSync(path, 'utf8')
}

const __dirname = dirname(fileURLToPath(import.meta.url))
const runtimeRoot = resolve(__dirname, '../src')
const frontendRoot = resolve(__dirname, '../../frontend/src')

const registrySource = readSource(resolve(runtimeRoot, 'components/ComponentRegistry.ts'))
const runtimeDefinitionsSource = readSource(resolve(runtimeRoot, 'components/definitions/index.ts'))
const runtimeIndexSource = readSource(resolve(runtimeRoot, 'components/index.ts'))
const packageIndexSource = readSource(resolve(runtimeRoot, 'index.ts'))
const editorRegistrySource = readSource(
  resolve(frontendRoot, 'engine/components/EditorComponentRegistry.ts'),
)
const editorIndexSource = readSource(resolve(frontendRoot, 'engine/components/index.ts'))
const primitiveSource = readSource(resolve(runtimeRoot, 'components/definitions/primitive.ts'))
const lightSource = readSource(resolve(runtimeRoot, 'components/definitions/light.ts'))
const billboardSource = readSource(resolve(runtimeRoot, 'components/definitions/billboard.ts'))
const poiSource = readSource(resolve(runtimeRoot, 'components/definitions/poi.ts'))

assert(registrySource.includes('class ComponentRegistry'), 'ComponentRegistry class should exist')
assert(registrySource.includes('register('), 'ComponentRegistry.register should exist')
assert(registrySource.includes('get('), 'ComponentRegistry.get should exist')
assert(registrySource.includes('list('), 'ComponentRegistry.list should exist')
assert(registrySource.includes('createInstance('), 'ComponentRegistry.createInstance should exist')
assert(registrySource.includes('createDefaultComponentRegistry'), 'default runtime registry factory should exist')

assert(primitiveSource.includes("type: 'primitive'"), 'primitive component definition should exist')
assert(primitiveSource.includes('primitiveType'), 'primitive definition should expose primitiveType')
assert(lightSource.includes("type: 'light'"), 'light component definition should exist')
assert(lightSource.includes('lightType'), 'light definition should expose lightType')
assert(billboardSource.includes("type: 'billboard'"), 'billboard component definition should exist')
assert(poiSource.includes("type: 'poi'"), 'poi component definition should exist')
assert(poiSource.includes('label'), 'poi definition should expose label text')

assert(
  runtimeDefinitionsSource.includes('runtimeComponentDefinitions'),
  'runtime definitions list should be exported',
)
assert(runtimeIndexSource.includes('ComponentRegistry'), 'runtime components barrel should export registry')
assert(packageIndexSource.includes("export * from './components"), 'runtime package should export components')

assert(
  editorRegistrySource.includes('class EditorComponentRegistry'),
  'EditorComponentRegistry class should exist',
)
assert(editorRegistrySource.includes('editorComponentDefinitions'), 'editor definitions should be exported')
assert(editorRegistrySource.includes('dragPayload'), 'editor definitions should expose drag payload metadata')
assert(editorRegistrySource.includes('inspector'), 'editor definitions should expose inspector metadata')
assert(editorIndexSource.includes('EditorComponentRegistry'), 'frontend engine components barrel should export registry')

console.log('component-registry.test passed')
