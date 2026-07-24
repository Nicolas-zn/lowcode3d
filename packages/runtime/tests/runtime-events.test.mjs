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

const sharedEventsSource = readSource(resolve(sharedRoot, 'types/events.ts'))
const sharedProjectDataSource = readSource(resolve(sharedRoot, 'types/projectData.ts'))
const sharedMigrationsSource = readSource(resolve(sharedRoot, 'project/migrations.ts'))
const eventStoreSource = readSource(resolve(frontendRoot, 'stores/eventStore.ts'))
const cameraBookmarkStoreSource = readSource(resolve(frontendRoot, 'stores/cameraBookmarkStore.ts'))
const eventPanelSource = readSource(resolve(frontendRoot, 'components/properties/EventPanel.vue'))
const rightSidebarSource = readSource(resolve(frontendRoot, 'components/layout/RightSidebar.vue'))
const runtimeEventSystemSource = readSource(resolve(runtimeRoot, 'events/RuntimeEventSystem.ts'))
const runtimeIndexSource = readSource(resolve(runtimeRoot, 'events/index.ts'))
const projectRuntimeSource = readSource(resolve(runtimeRoot, 'runtime/ProjectRuntime.ts'))
const diagnosticsSource = readSource(resolve(frontendRoot, 'engine/core/ProjectDiagnostics.ts'))
const serializerSource = readSource(resolve(frontendRoot, 'engine/core/SceneSerializer.ts'))
const cameraManagerSource = readSource(resolve(frontendRoot, 'engine/core/CameraManager.ts'))

assert(sharedEventsSource.includes("'doubleClick'"), 'event protocol should include doubleClick')
assert(sharedEventsSource.includes("'setObjectMaterial'"), 'event protocol should include action whitelist')
assert(sharedProjectDataSource.includes('CameraBookmarkData'), 'project protocol should define camera bookmarks')
assert(sharedProjectDataSource.includes('cameraBookmarks'), 'project data should include cameraBookmarks')
assert(sharedMigrationsSource.includes('cameraBookmarks: partial.cameraBookmarks ?? []'), 'migration should default camera bookmarks')

assert(eventStoreSource.includes('useEventStore'), 'event store should exist')
assert(eventStoreSource.includes('addEvent('), 'event store should add event configs')
assert(eventStoreSource.includes('updateEvent('), 'event store should update event configs')
assert(eventStoreSource.includes('removeEvent('), 'event store should remove event configs')
assert(eventStoreSource.includes('getEventsForObject'), 'event store should query events by object')
assert(eventStoreSource.includes('markAsModified'), 'event store should mark editor dirty')
assert(cameraBookmarkStoreSource.includes('useCameraBookmarkStore'), 'camera bookmark store should exist')
assert(cameraBookmarkStoreSource.includes('captureCurrentCamera'), 'camera bookmark store should capture current camera')
assert(cameraBookmarkStoreSource.includes('getBookmark'), 'camera bookmark store should query bookmark by id')
assert(cameraBookmarkStoreSource.includes('markAsModified'), 'camera bookmark store should mark editor dirty')

assert(eventPanelSource.includes('EventPanel'), 'event panel should exist')
assert(eventPanelSource.includes('addAction'), 'event panel should add actions')
assert(eventPanelSource.includes('openUrl'), 'event panel should expose openUrl action')
assert(eventPanelSource.includes('setObjectVisible'), 'event panel should expose visibility action')
assert(eventPanelSource.includes('cameraBookmarkStore'), 'event panel should use camera bookmark store')
assert(eventPanelSource.includes('captureCurrentCamera'), 'event panel should capture current camera bookmark')
assert(eventPanelSource.includes('bookmarkOptions'), 'event panel should list camera bookmarks')
assert(rightSidebarSource.includes('EventPanel'), 'right sidebar should render EventPanel')

assert(runtimeEventSystemSource.includes('class RuntimeEventSystem'), 'runtime event system should exist')
assert(runtimeEventSystemSource.includes('handlePointerClick'), 'runtime should handle click picking')
assert(runtimeEventSystemSource.includes('executeAction'), 'runtime should execute actions')
assert(runtimeEventSystemSource.includes('openUrl'), 'runtime should support openUrl action')
assert(runtimeEventSystemSource.includes('setObjectVisible'), 'runtime should support visibility action')
assert(runtimeEventSystemSource.includes('emitMessage'), 'runtime should support emitMessage action')
assert(runtimeEventSystemSource.includes('switchCamera'), 'runtime should execute switchCamera action')
assert(runtimeEventSystemSource.includes('cameraBookmarks'), 'runtime should read project camera bookmarks')
assert(runtimeIndexSource.includes('RuntimeEventSystem'), 'runtime events barrel should export event system')
assert(projectRuntimeSource.includes('RuntimeEventSystem'), 'ProjectRuntime should own RuntimeEventSystem')
assert(projectRuntimeSource.includes('eventSystem.bindProject'), 'ProjectRuntime should bind project events')

assert(serializerSource.includes('_serializeEvents'), 'SceneSerializer should include runtime event configs')
assert(serializerSource.includes('_serializeCameraBookmarks'), 'SceneSerializer should include camera bookmarks')
assert(
  serializerSource.includes('cameraBookmarks: this._serializeCameraBookmarks(engine)'),
  'SceneSerializer should write camera bookmarks to project data',
)
assert(cameraManagerSource.includes('applyBookmark'), 'CameraManager should apply camera bookmarks')
assert(diagnosticsSource.includes('analyzeEvents'), 'ProjectDiagnostics should analyze events')
assert(diagnosticsSource.includes("code: 'event.target_missing'"), 'diagnostics should catch missing event target')
assert(diagnosticsSource.includes("code: 'event.action_invalid'"), 'diagnostics should catch invalid event action')
assert(diagnosticsSource.includes("code: 'event.camera_bookmark_missing'"), 'diagnostics should catch missing camera bookmark')

console.log('runtime-events.test passed')
