import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

const __dirname = dirname(fileURLToPath(import.meta.url))
const frontendRoot = resolve(__dirname, '../../frontend/src')

function readFrontendSource(path) {
  return readFileSync(resolve(frontendRoot, path), 'utf8')
}

const modelLibrarySource = readFrontendSource('components/sidebar/ModelLibrary.vue')
const lightLibrarySource = readFrontendSource('components/sidebar/LightLibrary.vue')
const annotationLibrarySource = readFrontendSource('components/sidebar/AnnotationLibrary.vue')
const componentLibrarySource = readFrontendSource('components/sidebar/ComponentLibrary.vue')
const canvasPanelSource = readFrontendSource('components/canvas/CanvasPanel.vue')
const serializerSource = readFrontendSource('engine/core/SceneSerializer.ts')
const diagnosticsSource = readFrontendSource('engine/core/ProjectDiagnostics.ts')

assert(
  modelLibrarySource.includes("componentType: 'primitive'") &&
    modelLibrarySource.includes("type: 'primitive'"),
  'model drag data should include primitive component payload',
)
assert(
  lightLibrarySource.includes("componentType: 'light'") && lightLibrarySource.includes('lightType'),
  'light drag data should include light component payload',
)
assert(
  annotationLibrarySource.includes("componentType: 'poi'") &&
    annotationLibrarySource.includes("type: 'poi'"),
  'annotation drag data should include poi component payload',
)
assert(
  componentLibrarySource.includes('editorComponentRegistry') &&
    componentLibrarySource.includes('handleComponentDragStart') &&
    componentLibrarySource.includes("componentType: 'billboard'"),
  'component library should expose registry components and billboard payloads',
)
assert(
  canvasPanelSource.includes('attachComponentInstance') &&
    canvasPanelSource.includes('object.userData.component') &&
    canvasPanelSource.includes("data.component?.type === 'primitive'") &&
    canvasPanelSource.includes("data.component?.type === 'poi'"),
  'canvas drop should attach component instances for component payloads',
)
assert(
  serializerSource.includes('components: ComponentInstance[]') &&
    serializerSource.includes('_serializeComponentInstance') &&
    serializerSource.includes('components,'),
  'SceneSerializer should write component instances into project data',
)
assert(
  diagnosticsSource.includes('analyzeComponents') &&
    diagnosticsSource.includes("code: 'component.unknown'") &&
    diagnosticsSource.includes("code: 'component.asset_missing'"),
  'ProjectDiagnostics should analyze unknown components and missing component assets',
)

console.log('component-protocol.test passed')
