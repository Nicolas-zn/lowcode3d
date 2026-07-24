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
const docsRoot = resolve(__dirname, '../../../docs')

const viewerSource = readSource(resolve(runtimeRoot, 'LowCode3DViewer.ts'))
const projectRuntimeSource = readSource(resolve(runtimeRoot, 'runtime/ProjectRuntime.ts'))
const runtimeIndexSource = readSource(resolve(runtimeRoot, 'index.ts'))
const docsSource = readSource(resolve(docsRoot, 'api/runtime.md'))
const projectServiceSource = readSource(resolve(backendRoot, 'services/ProjectService.ts'))
const projectRoutesSource = readSource(resolve(backendRoot, 'routes/projects.ts'))
const publishedRepoSource = readSource(resolve(backendRoot, 'repositories/PublishedProjectRepository.ts'))
const frontendProjectsApiSource = readSource(resolve(frontendRoot, 'api/projects.ts'))
const toolbarSource = readSource(resolve(frontendRoot, 'components/layout/Toolbar.vue'))
const screenshotExporterSource = readSource(resolve(frontendRoot, 'engine/exporters/ScreenshotExporter.ts'))
const gltfExporterSource = readSource(resolve(frontendRoot, 'engine/exporters/GLTFSceneExporter.ts'))
const offlineExporterSource = readSource(resolve(frontendRoot, 'engine/exporters/OfflinePackageExporter.ts'))
const exportersIndexSource = readSource(resolve(frontendRoot, 'engine/exporters/index.ts'))

assert(viewerSource.includes('focusObject('), 'LowCode3DViewer should expose focusObject')
assert(viewerSource.includes('takeScreenshot('), 'LowCode3DViewer should expose takeScreenshot')
assert(projectRuntimeSource.includes('focusObject(objectId'), 'ProjectRuntime should focus object by id')
assert(projectRuntimeSource.includes('takeScreenshot('), 'ProjectRuntime should expose screenshots')
assert(runtimeIndexSource.includes('LowCode3DViewer'), 'runtime package should export LowCode3DViewer')
assert(docsSource.includes('focusObject(objectId'), 'runtime docs should document focusObject')
assert(docsSource.includes('setDataSourceData(sourceId'), 'runtime docs should document data injection')

assert(projectServiceSource.includes('PublishProjectOptions'), 'ProjectService should accept publish options')
assert(projectServiceSource.includes('sdkVersion'), 'published runtimeConfig should include sdkVersion')
assert(projectServiceSource.includes('dataMode'), 'published runtimeConfig should include dataMode')
assert(projectServiceSource.includes('embedDefaults'), 'published runtimeConfig should include embed defaults')
assert(projectServiceSource.includes('getPublishedVersions'), 'ProjectService should list published versions')
assert(projectServiceSource.includes('rollbackPublishedVersion'), 'ProjectService should rollback published versions')
assert(publishedRepoSource.includes('setLatestVersion'), 'PublishedProjectRepository should set latest version')
assert(projectRoutesSource.includes('/:id/published/versions'), 'routes should expose published versions')
assert(projectRoutesSource.includes('/:id/published/:version/rollback'), 'routes should expose rollback')
assert(frontendProjectsApiSource.includes('getPublishedVersions'), 'frontend API should list versions')
assert(frontendProjectsApiSource.includes('rollbackPublishedVersion'), 'frontend API should rollback version')
assert(toolbarSource.includes('publishNote'), 'Toolbar should submit publish note')
assert(toolbarSource.includes('runtimeConfig'), 'Toolbar should submit runtime config')

assert(screenshotExporterSource.includes('ScreenshotExporter'), 'ScreenshotExporter should exist')
assert(screenshotExporterSource.includes('transparent'), 'ScreenshotExporter should support transparent background')
assert(gltfExporterSource.includes('GLTFSceneExporter'), 'GLTFSceneExporter should exist')
assert(gltfExporterSource.includes('GLTFExporter'), 'GLTFSceneExporter should use GLTFExporter')
assert(gltfExporterSource.includes('extras'), 'GLTFSceneExporter should write low-code extras')
assert(offlineExporterSource.includes('OfflinePackageExporter'), 'OfflinePackageExporter should exist')
assert(offlineExporterSource.includes('index.html'), 'OfflinePackageExporter should create example HTML')
assert(offlineExporterSource.includes('asset-manifest.json'), 'OfflinePackageExporter should include asset manifest')
assert(exportersIndexSource.includes('ScreenshotExporter'), 'exporters barrel should export ScreenshotExporter')
assert(exportersIndexSource.includes('GLTFSceneExporter'), 'exporters barrel should export GLTFSceneExporter')
assert(exportersIndexSource.includes('OfflinePackageExporter'), 'exporters barrel should export OfflinePackageExporter')
assert(toolbarSource.includes('handleExportScreenshot'), 'Toolbar should expose screenshot export')
assert(toolbarSource.includes('handleExportGLB'), 'Toolbar should expose GLB export')

console.log('runtime-export.test passed')
