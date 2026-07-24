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

const selectionManagerSource = readSource(resolve(runtimeRoot, 'interaction/SelectionManager.ts'))
const engineSource = readSource(resolve(runtimeRoot, 'core/Engine.ts'))

assert(selectionManagerSource.includes('THREE.BoxHelper'), 'runtime selection should use BoxHelper')
assert(
  selectionManagerSource.includes('_selectionBoxes: Map<string, THREE.BoxHelper>'),
  'runtime selection should track bounding boxes by object uuid',
)
assert(
  selectionManagerSource.includes('userData.isSelectionHelper = true'),
  'runtime selection boxes should be marked as helper objects',
)
assert(
  selectionManagerSource.includes('updateBoundingBoxes()'),
  'runtime selection manager should expose bounding box updates',
)
assert(
  engineSource.includes('selectionManager.updateBoundingBoxes()'),
  'runtime engine should refresh selection bounding boxes every frame',
)
assert(
  !selectionManagerSource.includes('emissive.setRGB'),
  'runtime selection should not modify material emissive color',
)

console.log('runtime-selection.test passed')
