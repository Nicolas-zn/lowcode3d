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

const dataBindingTypesSource = readSource(resolve(sharedRoot, 'types/dataBinding.ts'))
const migrationSource = readSource(resolve(sharedRoot, 'project/migrations.ts'))
const dataBindingStoreSource = readSource(resolve(frontendRoot, 'stores/dataBindingStore.ts'))
const dataSourcePanelSource = readSource(resolve(frontendRoot, 'components/bottom/DataSourcePanel.vue'))
const bottomPanelSource = readSource(resolve(frontendRoot, 'components/layout/BottomPanel.vue'))
const editorStoreSource = readSource(resolve(frontendRoot, 'stores/editorStore.ts'))
const serializerSource = readSource(resolve(frontendRoot, 'engine/core/SceneSerializer.ts'))
const diagnosticsSource = readSource(resolve(frontendRoot, 'engine/core/ProjectDiagnostics.ts'))
const runtimeDataSourceSource = readSource(resolve(runtimeRoot, 'data/RuntimeDataSource.ts'))
const runtimeDataBindingSource = readSource(resolve(runtimeRoot, 'data/RuntimeDataBinding.ts'))
const runtimeDataIndexSource = readSource(resolve(runtimeRoot, 'data/index.ts'))
const projectRuntimeSource = readSource(resolve(runtimeRoot, 'runtime/ProjectRuntime.ts'))
const viewerSource = readSource(resolve(runtimeRoot, 'LowCode3DViewer.ts'))

assert(dataBindingTypesSource.includes("'staticJson'"), 'data source protocol should include staticJson')
assert(dataBindingTypesSource.includes("'http'"), 'data source protocol should include http')
assert(dataBindingTypesSource.includes("'websocket'"), 'data source protocol should include websocket')
assert(dataBindingTypesSource.includes('propertyPath'), 'binding protocol should include propertyPath')
assert(dataBindingTypesSource.includes('fallbackValue'), 'binding protocol should include fallbackValue')
assert(migrationSource.includes('dataSources: Array.isArray'), 'migration should preserve dataSources')
assert(migrationSource.includes('bindings: Array.isArray'), 'migration should preserve bindings')

assert(dataBindingStoreSource.includes('useDataBindingStore'), 'data binding store should exist')
assert(dataBindingStoreSource.includes('addDataSource('), 'store should add data sources')
assert(dataBindingStoreSource.includes('testDataSource('), 'store should test data sources')
assert(dataBindingStoreSource.includes('addBinding('), 'store should add bindings')
assert(dataBindingStoreSource.includes('getBindingsForObject'), 'store should query bindings by object')
assert(dataBindingStoreSource.includes('markAsModified'), 'store should mark editor dirty')

assert(dataSourcePanelSource.includes('DataSourcePanel'), 'data source panel should exist')
assert(dataSourcePanelSource.includes('staticJson'), 'data source panel should support static JSON')
assert(dataSourcePanelSource.includes('http'), 'data source panel should support HTTP')
assert(dataSourcePanelSource.includes('testDataSource'), 'data source panel should test data sources')
assert(bottomPanelSource.includes('DataSourcePanel'), 'bottom panel should render DataSourcePanel')
assert(editorStoreSource.includes("'dataSources'"), 'editor store should include dataSources bottom tab')

assert(serializerSource.includes('_serializeDataSources'), 'SceneSerializer should serialize data sources')
assert(serializerSource.includes('_serializeBindings'), 'SceneSerializer should serialize bindings')
assert(serializerSource.includes('scene.userData.dataSources'), 'SceneSerializer should use scene data source state')

assert(runtimeDataSourceSource.includes('class RuntimeDataSource'), 'RuntimeDataSource should exist')
assert(runtimeDataSourceSource.includes('refreshDataSource'), 'RuntimeDataSource should refresh by source id')
assert(runtimeDataSourceSource.includes('setDataSourceData'), 'RuntimeDataSource should accept injected data')
assert(runtimeDataBindingSource.includes('class RuntimeDataBinding'), 'RuntimeDataBinding should exist')
assert(runtimeDataBindingSource.includes('applyBindings'), 'RuntimeDataBinding should apply bindings')
assert(runtimeDataBindingSource.includes('resolveDataPath'), 'RuntimeDataBinding should resolve data paths')
assert(runtimeDataBindingSource.includes('setObjectVisible'), 'RuntimeDataBinding should bind visible')
assert(runtimeDataBindingSource.includes('setMaterialColor'), 'RuntimeDataBinding should bind material color')
assert(runtimeDataIndexSource.includes('RuntimeDataSource'), 'runtime data barrel should export data source')
assert(projectRuntimeSource.includes('RuntimeDataSource'), 'ProjectRuntime should own RuntimeDataSource')
assert(projectRuntimeSource.includes('RuntimeDataBinding'), 'ProjectRuntime should own RuntimeDataBinding')
assert(projectRuntimeSource.includes('refreshDataSource('), 'ProjectRuntime should expose refreshDataSource')
assert(viewerSource.includes('refreshDataSource('), 'LowCode3DViewer should expose refreshDataSource')

assert(diagnosticsSource.includes('analyzeDataBindings'), 'ProjectDiagnostics should analyze data bindings')
assert(diagnosticsSource.includes("code: 'data_source.missing'"), 'diagnostics should catch missing data source')
assert(diagnosticsSource.includes("code: 'binding.target_missing'"), 'diagnostics should catch missing binding target')
assert(diagnosticsSource.includes("code: 'data_source.http_url_invalid'"), 'diagnostics should catch invalid HTTP URL')

console.log('runtime-data.test passed')
