import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

const __dirname = dirname(fileURLToPath(import.meta.url))
const runtimeSource = readFileSync(resolve(__dirname, '../src/runtime/ProjectRuntime.ts'), 'utf8')
const indexSource = readFileSync(resolve(__dirname, '../src/index.ts'), 'utf8')
const viewerSource = readFileSync(resolve(__dirname, '../src/LowCode3DViewer.ts'), 'utf8')

assert(indexSource.includes("export { ProjectRuntime }"), 'ProjectRuntime should be exported')
assert(runtimeSource.includes('class ProjectRuntime'), 'ProjectRuntime class should exist')
assert(runtimeSource.includes('init('), 'ProjectRuntime.init should exist')
assert(runtimeSource.includes('loadProject('), 'ProjectRuntime.loadProject should exist')
assert(runtimeSource.includes('setDataSourceData('), 'ProjectRuntime.setDataSourceData should exist')
assert(runtimeSource.includes('playAnimation('), 'ProjectRuntime.playAnimation should exist')
assert(runtimeSource.includes('setObjectVisible('), 'ProjectRuntime.setObjectVisible should exist')
assert(runtimeSource.includes('dispose('), 'ProjectRuntime.dispose should exist')
assert(viewerSource.includes('emit('), 'LowCode3DViewer.emit should exist')
assert(runtimeSource.includes('onProgress?'), 'ProjectRuntimeOptions.onProgress should exist')
assert(runtimeSource.includes('onWarning?'), 'ProjectRuntimeOptions.onWarning should exist')
assert(runtimeSource.includes('onError?'), 'ProjectRuntimeOptions.onError should exist')
assert(runtimeSource.includes('notifyProgress('), 'ProjectRuntime should notify load progress')

console.log('project-runtime.test passed')
