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
const backendRoot = resolve(__dirname, '../../backend/src')
const test3dRoot = resolve(__dirname, '../../../test3d/src')

const diagnosticsSource = readSource(resolve(frontendRoot, 'engine/core/ProjectDiagnostics.ts'))
const bottomPanelSource = readSource(resolve(frontendRoot, 'components/layout/BottomPanel.vue'))
const resourceCenterSource = readSource(
  resolve(frontendRoot, 'views/assets/ResourceCenter/index.vue'),
)
const projectRuntimeSource = readSource(resolve(runtimeRoot, 'runtime/ProjectRuntime.ts'))
const viewerSource = readSource(resolve(runtimeRoot, 'LowCode3DViewer.ts'))
const assetOptimizerSource = readSource(resolve(backendRoot, 'services/AssetOptimizer.ts'))
const uploadRouteSource = readSource(resolve(backendRoot, 'routes/assets.ts'))
const test3dAppSource = readSource(resolve(test3dRoot, 'App.vue'))
const test3dViewerSource = readSource(resolve(test3dRoot, 'components/viewer.vue'))
const test3dFixtureSource = readSource(
  resolve(test3dRoot, 'fixtures/v1.3-device-monitoring.scene.json'),
)

assert(diagnosticsSource.includes('analyzePerformance'), 'ProjectDiagnostics should analyze performance')
assert(
  diagnosticsSource.includes("performance.object_count_high"),
  'diagnostics should flag high object counts',
)
assert(
  diagnosticsSource.includes("performance.draw_calls_high"),
  'diagnostics should flag high draw calls',
)
assert(
  diagnosticsSource.includes("performance.triangles_high"),
  'diagnostics should flag high triangle counts',
)
assert(
  diagnosticsSource.includes("performance.texture_count_high"),
  'diagnostics should flag high texture counts',
)
assert(
  diagnosticsSource.includes("performance.texture_size_high"),
  'diagnostics should flag oversized textures',
)
assert(
  diagnosticsSource.includes("performance.material_count_high"),
  'diagnostics should flag high material counts',
)
assert(
  diagnosticsSource.includes("performance.transparent_object_high"),
  'diagnostics should flag transparent object counts',
)
assert(
  diagnosticsSource.includes("performance.shadow_light_high"),
  'diagnostics should flag shadow lights',
)
assert(diagnosticsSource.includes('suggestion:'), 'diagnostics should expose suggestions')
assert(diagnosticsSource.includes('targets:'), 'diagnostics should expose affected targets')
assert(bottomPanelSource.includes('performanceIssues'), 'BottomPanel should render performance issues')
assert(bottomPanelSource.includes('performance-suggestion'), 'BottomPanel should show suggestions')
assert(bottomPanelSource.includes('performance-targets'), 'BottomPanel should show affected targets')

assert(projectRuntimeSource.includes('preloadProjectResources'), 'ProjectRuntime should preload resources')
assert(projectRuntimeSource.includes('loadState'), 'ProjectRuntime should track load state')
assert(projectRuntimeSource.includes('loadErrors'), 'ProjectRuntime should collect load errors')
assert(projectRuntimeSource.includes('loadWarnings'), 'ProjectRuntime should collect load warnings')
assert(projectRuntimeSource.includes('getLoadState'), 'ProjectRuntime should expose load state getter')
assert(projectRuntimeSource.includes('preloadOriginModels'), 'ProjectRuntime should preload model origins')
assert(projectRuntimeSource.includes('preloadOriginTextures'), 'ProjectRuntime should preload texture origins')
assert(projectRuntimeSource.includes('preloadOriginHdris'), 'ProjectRuntime should preload HDRI origins')
assert(viewerSource.includes('onProgress?'), 'LowCode3DViewer should forward progress callbacks')
assert(viewerSource.includes('onWarning?'), 'LowCode3DViewer should forward warning callbacks')
assert(viewerSource.includes('onError?'), 'LowCode3DViewer should forward error callbacks')

assert(
  assetOptimizerSource.includes('buildOptimizationRecommendations'),
  'AssetOptimizer should build optimization recommendations',
)
assert(assetOptimizerSource.includes('inspect('), 'AssetOptimizer should support inspection')
assert(assetOptimizerSource.includes('draco_recommended'), 'AssetOptimizer should recommend Draco')
assert(
  assetOptimizerSource.includes('texture_downsample_recommended'),
  'AssetOptimizer should recommend texture downsampling',
)
assert(
  assetOptimizerSource.includes('material_merge_recommended'),
  'AssetOptimizer should recommend material merging',
)
assert(
  assetOptimizerSource.includes('instance_reuse_recommended'),
  'AssetOptimizer should recommend instancing',
)
assert(
  uploadRouteSource.includes('optimizationRecommendations'),
  'asset upload route should persist optimization recommendations',
)
assert(uploadRouteSource.includes('AssetOptimizer.inspect'), 'asset upload route should inspect models')

assert(
  resourceCenterSource.includes('optimizationRecommendations'),
  'ResourceCenter should surface optimization recommendations',
)
assert(resourceCenterSource.includes('optimization-section'), 'ResourceCenter should render optimization section')
assert(
  resourceCenterSource.includes('metadata.optimization'),
  'ResourceCenter should read optimization metadata',
)

assert(test3dAppSource.includes('v1.3-device-monitoring.scene.json'), 'test3d app should load v1.3 fixture')
assert(test3dViewerSource.includes('loadingMessage'), 'test3d viewer should render loading feedback')
assert(test3dViewerSource.includes('loadingProgress'), 'test3d viewer should render loading progress')
assert(test3dViewerSource.includes('loadProject('), 'test3d viewer should use project loading')

assert(test3dFixtureSource.includes('device_monitoring'), 'fixture should describe device monitoring scenario')
assert(test3dFixtureSource.includes('dataSources'), 'fixture should include data sources')
assert(test3dFixtureSource.includes('bindings'), 'fixture should include data bindings')
assert(test3dFixtureSource.includes('events'), 'fixture should include runtime events')
assert(test3dFixtureSource.includes('postProcessing'), 'fixture should include post processing')

console.log('runtime-stage8.test passed')
