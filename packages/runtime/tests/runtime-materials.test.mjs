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
const sharedRoot = resolve(__dirname, '../../shared/src')

const projectDataSource = readSource(resolve(sharedRoot, 'types/projectData.ts'))
const runtimeTypesSource = readSource(resolve(sharedRoot, 'types/runtime.ts'))
const migrationSource = readSource(resolve(sharedRoot, 'project/migrations.ts'))
const serializerSource = readSource(resolve(frontendRoot, 'engine/core/SceneSerializer.ts'))
const postProcessingManagerSource = readSource(
  resolve(runtimeRoot, 'core/PostProcessingManager.ts'),
)
const renderManagerSource = readSource(resolve(runtimeRoot, 'core/RenderManager.ts'))
const projectRuntimeSource = readSource(resolve(runtimeRoot, 'runtime/ProjectRuntime.ts'))
const postProcessingPanelSource = readSource(
  resolve(frontendRoot, 'components/properties/PostProcessingPanel.vue'),
)
const editorStoreSource = readSource(resolve(frontendRoot, 'stores/editorStore.ts'))
const diagnosticsSource = readSource(resolve(frontendRoot, 'engine/core/ProjectDiagnostics.ts'))

assert(projectDataSource.includes('MaterialTextureSlot'), 'material protocol should define texture slots')
assert(projectDataSource.includes('IMaterialTextureData'), 'material protocol should define texture metadata')
assert(projectDataSource.includes('textures?: Partial<Record<MaterialTextureSlot, IMaterialTextureData>>'), 'material overrides should store texture metadata by slot')
assert(projectDataSource.includes('repeat: [number, number]'), 'texture metadata should store repeat')
assert(projectDataSource.includes('offset: [number, number]'), 'texture metadata should store offset')
assert(projectDataSource.includes('rotation: number'), 'texture metadata should store rotation')
assert(projectDataSource.includes('colorSpace'), 'texture metadata should store colorSpace')
assert(projectDataSource.includes('presetId?: string'), 'material overrides should store presetId')
assert(projectDataSource.includes('hash?: string'), 'asset manifest should store hash')
assert(projectDataSource.includes('fileSize?: number'), 'asset manifest should store fileSize')
assert(projectDataSource.includes('mimeType?: string'), 'asset manifest should store mimeType')
assert(projectDataSource.includes('usage:'), 'asset manifest should store usage')
assert(projectDataSource.includes('referencedBy:'), 'asset manifest should store referencedBy')
assert(projectDataSource.includes('publicAccess'), 'asset manifest should track public access')
assert(projectDataSource.includes('corsStatus'), 'asset manifest should track CORS status')

assert(runtimeTypesSource.includes('ToneMappingType'), 'post processing protocol should define tone mapping type')
assert(runtimeTypesSource.includes('toneMapping:'), 'post processing protocol should include toneMapping')
assert(runtimeTypesSource.includes('exposure:'), 'post processing protocol should include exposure')
assert(migrationSource.includes('toneMapping'), 'migration should normalize tone mapping defaults')

assert(serializerSource.includes('_serializeMaterialTexture'), 'SceneSerializer should serialize texture metadata')
assert(serializerSource.includes('_applyMaterialTexture'), 'SceneSerializer should restore texture metadata')
assert(serializerSource.includes('_serializePostProcessing'), 'SceneSerializer should serialize post processing')
assert(serializerSource.includes('_deserializePostProcessing'), 'SceneSerializer should restore post processing')
assert(serializerSource.includes('postProcessing: this._serializePostProcessing'), 'serialized project should include post processing')
assert(serializerSource.includes('publicAccess: this.getPublicAccess'), 'SceneSerializer should classify public asset access')
assert(serializerSource.includes('corsStatus: this.getCorsStatus'), 'SceneSerializer should classify CORS status')

assert(postProcessingManagerSource.includes('applyProjectSettings'), 'PostProcessingManager should apply project protocol')
assert(postProcessingManagerSource.includes('toProjectData'), 'PostProcessingManager should export project protocol')
assert(renderManagerSource.includes('applyProjectPostProcessing'), 'RenderManager should expose project post processing API')
assert(projectRuntimeSource.includes('applyPostProcessing'), 'ProjectRuntime should apply post processing after loading project')
assert(postProcessingPanelSource.includes('toneMappingExposure'), 'PostProcessingPanel should edit tone mapping exposure')
assert(editorStoreSource.includes('toneMapping'), 'editor store should persist tone mapping')

const materialLibrarySource = readSource(resolve(frontendRoot, 'components/sidebar/MaterialLibrary.vue'))
const bottomPanelSource = readSource(resolve(frontendRoot, 'components/layout/BottomPanel.vue'))
const resourceCenterSource = readSource(resolve(frontendRoot, 'views/assets/ResourceCenter/index.vue'))

assert(materialLibrarySource.includes('materialPresetId'), 'MaterialLibrary should stamp preset id on object')
assert(serializerSource.includes('presetId: this._serializeMaterialPresetId'), 'SceneSerializer should save material preset id')
assert(bottomPanelSource.includes('locateAssetObject'), 'Publish Check should locate asset objects')
assert(bottomPanelSource.includes('openResourceRepair'), 'Publish Check should expose resource repair entry')
assert(resourceCenterSource.includes('repairAssetId'), 'ResourceCenter should accept repair context')

assert(diagnosticsSource.includes('analyzeAssetAccess'), 'ProjectDiagnostics should analyze asset access')
assert(diagnosticsSource.includes("code: 'asset.cors_blocked'"), 'diagnostics should catch blocked CORS')
assert(diagnosticsSource.includes("code: 'asset.public_access_missing'"), 'diagnostics should catch private assets')

console.log('runtime-materials.test passed')
