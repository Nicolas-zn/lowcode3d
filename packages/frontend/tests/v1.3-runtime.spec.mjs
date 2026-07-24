import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { migrateProjectData } from '../../shared/dist/project/migrations.js'

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

function readSource(path) {
  assert(existsSync(path), `${path} should exist`)
  return readFileSync(path, 'utf8')
}

function readJson(path) {
  return JSON.parse(readSource(path))
}

function assertIncludes(source, snippet, message) {
  assert(source.includes(snippet), message)
}

const __dirname = dirname(fileURLToPath(import.meta.url))
const frontendRoot = resolve(__dirname, '../src')
const runtimeRoot = resolve(__dirname, '../../runtime/src')
const backendRoot = resolve(__dirname, '../../backend/src')
const test3dRoot = resolve(__dirname, '../../../test3d/src')

const fixturePath = resolve(test3dRoot, 'fixtures/v1.3-device-monitoring.scene.json')
const fixture = readJson(fixturePath)
const migratedFixture = migrateProjectData(fixture)

assert(migratedFixture.version === '1.3.0', 'fixture should migrate to v1.3.0')
assert(migratedFixture.schemaVersion === '1.3.0', 'fixture should keep v1.3 schemaVersion')
assert(migratedFixture.projectName.includes('device_monitoring'), 'fixture should be the device monitoring project')
assert(migratedFixture.origin.models.length >= 1, 'fixture should include a GLB model origin')
assert(migratedFixture.origin.hdris.length >= 1, 'fixture should include an HDRI origin')
assert(migratedFixture.sceneObjects.length >= 4, 'fixture should include device and POI objects')
assert(migratedFixture.components.length >= 3, 'fixture should include component instances')
assert(migratedFixture.lights.some((light) => light.castShadow), 'fixture should include a shadow light')
assert(migratedFixture.cameraBookmarks.length >= 2, 'fixture should include camera bookmarks')
assert(migratedFixture.dataSources.some((source) => source.type === 'staticJson'), 'fixture should include static JSON data')
assert(migratedFixture.bindings.some((binding) => binding.propertyPath === 'material.color'), 'fixture should bind device status to material color')
assert(migratedFixture.bindings.some((binding) => binding.propertyPath === 'userData.label'), 'fixture should bind temperature to a POI label')
assert(migratedFixture.bindings.some((binding) => binding.propertyPath === 'component.props.label'), 'fixture should bind status to component props')
assert(migratedFixture.events.some((event) => event.trigger === 'click'), 'fixture should include a click event')
assert(
  migratedFixture.events.some((event) =>
    event.actions.some((action) => action.type === 'switchCamera' && action.payload?.bookmarkId)
  ),
  'fixture click event should switch to a camera bookmark',
)
assert(
  migratedFixture.events.some((event) =>
    event.actions.some((action) => action.type === 'playAnimation' && action.payload?.clipId)
  ),
  'fixture click event should play an animation clip',
)
assert(migratedFixture.animations.clips.some((clip) => clip.id === 'device-pulse'), 'fixture should include the device pulse animation clip')
assert(migratedFixture.postProcessing.enabled === true, 'fixture should enable post processing')
assert(migratedFixture.postProcessing.bloom?.enabled === true, 'fixture should enable bloom')
assert(migratedFixture.postProcessing.smaa?.enabled === true, 'fixture should enable SMAA')
assert(migratedFixture.publishConfig.embedDefaults.controls === true, 'fixture should define publish embed defaults')
assert(migratedFixture.assetManifest?.items?.length >= 2, 'fixture should include an asset manifest')

const projectStoreSource = readSource(resolve(frontendRoot, 'stores/projectStore.ts'))
const projectsApiSource = readSource(resolve(frontendRoot, 'api/projects.ts'))
const toolbarSource = readSource(resolve(frontendRoot, 'components/layout/Toolbar.vue'))
const test3dAppSource = readSource(resolve(test3dRoot, 'App.vue'))
const test3dViewerSource = readSource(resolve(test3dRoot, 'components/viewer.vue'))
const runtimeViewerSource = readSource(resolve(runtimeRoot, 'LowCode3DViewer.ts'))
const projectRuntimeSource = readSource(resolve(runtimeRoot, 'runtime/ProjectRuntime.ts'))
const projectServiceSource = readSource(resolve(backendRoot, 'services/ProjectService.ts'))
const projectRoutesSource = readSource(resolve(backendRoot, 'routes/projects.ts'))
const assetRoutesSource = readSource(resolve(backendRoot, 'routes/assets.ts'))
const assetServiceSource = readSource(resolve(backendRoot, 'services/AssetService.ts'))
const storageServiceSource = readSource(resolve(backendRoot, 'services/StorageService.ts'))
const frontendAssetsApiSource = readSource(resolve(frontendRoot, 'api/assets.ts'))
const resourceCenterSource = readSource(resolve(frontendRoot, 'views/assets/ResourceCenter/index.vue'))
const modelsPanelSource = readSource(
  resolve(frontendRoot, 'views/assets/ResourceCenter/components/ModelsPanel.vue'),
)
const modelPreviewDialogSource = readSource(
  resolve(frontendRoot, 'views/assets/ResourceCenter/components/ModelPreviewDialog.vue'),
)
const selectionManagerSource = readSource(
  resolve(frontendRoot, 'engine/interaction/SelectionManager.ts'),
)
const modelSelectionSource = readSource(resolve(frontendRoot, 'engine/utils/modelSelection.ts'))
const modelLoaderSource = readSource(resolve(frontendRoot, 'engine/loaders/ModelLoader.ts'))
const sceneSerializerSource = readSource(resolve(frontendRoot, 'engine/core/SceneSerializer.ts'))
const canvasPanelSource = readSource(resolve(frontendRoot, 'components/canvas/CanvasPanel.vue'))
const leftSidebarSource = readSource(resolve(frontendRoot, 'components/layout/LeftSidebar.vue'))

assertIncludes(projectStoreSource, 'SceneSerializer.serialize', 'frontend save flow should serialize scene data')
assertIncludes(projectStoreSource, 'publishProject(', 'frontend store should expose publish flow')
assertIncludes(projectStoreSource, 'getPublishedVersions', 'frontend store should expose published versions')
assertIncludes(projectStoreSource, 'rollbackPublishedVersion', 'frontend store should expose rollback flow')
assertIncludes(projectsApiSource, 'publishProject', 'frontend API should publish snapshots')
assertIncludes(projectsApiSource, 'getPublishedVersions', 'frontend API should list published snapshots')
assertIncludes(projectsApiSource, 'rollbackPublishedVersion', 'frontend API should rollback published snapshots')
assertIncludes(toolbarSource, 'runtimeConfig', 'Toolbar publish flow should submit runtime config')
assertIncludes(toolbarSource, 'publishNote', 'Toolbar publish flow should submit publish note')

assertIncludes(test3dAppSource, 'v1.3-device-monitoring.scene.json', 'test3d should load the v1.3 acceptance fixture by default')
assertIncludes(test3dViewerSource, 'loadProject(', 'test3d viewer should use the unified project loading API')
assertIncludes(test3dViewerSource, 'onProgress', 'test3d viewer should render runtime progress')
assertIncludes(test3dViewerSource, 'onWarning', 'test3d viewer should render runtime warnings')
assertIncludes(test3dViewerSource, 'onError', 'test3d viewer should render runtime errors')

assertIncludes(runtimeViewerSource, 'setDataSourceData(', 'SDK should support data injection')
assertIncludes(runtimeViewerSource, 'playAnimation(', 'SDK should support animation playback')
assertIncludes(runtimeViewerSource, 'setObjectVisible(', 'SDK should support object visibility control')
assertIncludes(runtimeViewerSource, 'getLoadState(', 'SDK should expose runtime load state')
assertIncludes(projectRuntimeSource, 'refreshDataSource(', 'ProjectRuntime should refresh configured data sources')
assertIncludes(projectRuntimeSource, 'getLoadState(', 'ProjectRuntime should expose loading state')

assertIncludes(projectServiceSource, 'runtimeConfig', 'backend publish service should persist runtime config')
assertIncludes(projectServiceSource, 'rollbackPublishedVersion', 'backend publish service should support rollback')
assertIncludes(projectRoutesSource, '/:id/published/versions', 'backend routes should expose published version listing')
assertIncludes(projectRoutesSource, '/:id/published/:version/rollback', 'backend routes should expose published rollback')

assertIncludes(assetRoutesSource, '/url', 'backend assets route should create URL-backed assets')
assertIncludes(assetRoutesSource, 'externalUrl', 'backend URL-backed assets should persist source URL metadata')
assertIncludes(assetServiceSource, 'isExternalUrlAsset', 'asset service should detect URL-backed assets')
assertIncludes(storageServiceSource, 'isExternalUrl', 'storage service should preserve external URLs')
assertIncludes(frontendAssetsApiSource, 'createAssetFromUrl', 'frontend assets API should create URL-backed assets')
assertIncludes(resourceCenterSource, 'uploadMode', 'ResourceCenter should separate local upload and URL record modes')
assertIncludes(resourceCenterSource, 'handleSubmitUrlAsset', 'ResourceCenter should submit URL-backed model assets')
assertIncludes(resourceCenterSource, 'ModelPreviewDialog', 'ResourceCenter should mount the model preview dialog')
assertIncludes(modelsPanelSource, "emit('preview'", 'model cards should open the model preview on click')
assertIncludes(modelPreviewDialogSource, 'GLTFLoader', 'model preview dialog should load GLB/GLTF resources')
assertIncludes(modelPreviewDialogSource, 'OrbitControls', 'model preview dialog should support orbit inspection')
assertIncludes(modelSelectionSource, 'markModelRootForSelection', 'model selection helper should mark model roots')
assertIncludes(modelSelectionSource, 'name?: string', 'model selection helper should accept display names')
assertIncludes(modelSelectionSource, 'model.name = options.name', 'model selection helper should apply display names to roots')
assertIncludes(modelSelectionSource, 'isModelRoot', 'model selection helper should tag the root object')
assertIncludes(modelSelectionSource, 'modelRootUuid', 'model selection helper should tag child meshes')
assertIncludes(selectionManagerSource, '_resolveSelectableTarget', 'selection manager should normalize hit meshes to selection targets')
assertIncludes(selectionManagerSource, 'event.altKey', 'selection manager should allow child selection with Alt/Option click')
assertIncludes(modelLoaderSource, 'markModelRootForSelection', 'model loader should mark loaded models for root selection')
assertIncludes(canvasPanelSource, 'markModelRootForSelection', 'canvas model drops should preserve model root selection')
assertIncludes(canvasPanelSource, 'name: item.name', 'canvas model drops should name model roots from resource names')
assertIncludes(leftSidebarSource, 'markModelRootForSelection', 'left sidebar model insertion should mark model roots')
assertIncludes(leftSidebarSource, 'name: item.name', 'left sidebar model insertion should name model roots from resource names')
assertIncludes(toolbarSource, 'markModelRootForSelection', 'toolbar local imports should mark model roots')
assertIncludes(toolbarSource, 'name: modelName', 'toolbar local imports should name model roots from file names')
assertIncludes(toolbarSource, 'selection-hint', 'toolbar should expose a lightweight model selection hint')
assertIncludes(toolbarSource, 'Alt / Option', 'model selection hint should explain child selection modifier')
assertIncludes(sceneSerializerSource, '_deserializeLights', 'SceneSerializer should restore saved lights')
assertIncludes(sceneSerializerSource, 'projectData.lights', 'SceneSerializer should read saved light data')
assertIncludes(sceneSerializerSource, 'engine.objectManager.add(light', 'restored lights should be registered for selection and later saves')

console.log('v1.3-runtime.spec passed')
