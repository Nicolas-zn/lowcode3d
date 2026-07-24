import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const frontendRoot = resolve(__dirname, '..')
const repoRoot = resolve(frontendRoot, '../..')

function readSource(relativePath) {
  return readFileSync(resolve(repoRoot, relativePath), 'utf8')
}

const selectionManager = readSource(
  'packages/frontend/src/engine/interaction/SelectionManager.ts'
)
const engine = readSource('packages/frontend/src/engine/core/Engine.ts')

assert.match(
  selectionManager,
  /THREE\.BoxHelper/,
  'SelectionManager should use BoxHelper for selection feedback'
)
assert.match(
  selectionManager,
  /_selectionBoxes:\s*Map<string,\s*THREE\.BoxHelper>/,
  'SelectionManager should track selection bounding boxes by object uuid'
)
assert.match(
  selectionManager,
  /userData\.isSelectionHelper = true/,
  'Selection bounding boxes should be marked as helper objects'
)
assert.match(
  selectionManager,
  /updateBoundingBoxes\(\)/,
  'SelectionManager should expose a per-frame bounding box update method'
)
assert.match(
  engine,
  /selectionManager\.updateBoundingBoxes\(\)/,
  'Engine render loop should keep selection bounding boxes aligned'
)
assert.doesNotMatch(
  selectionManager,
  /mat\.emissive\.setRGB/,
  'Selection feedback should not modify material emissive color'
)
assert.doesNotMatch(
  selectionManager,
  /mesh\.material = cloned/,
  'Selection feedback should not clone and replace selected mesh materials'
)

console.log('selection-bounds-highlight.spec passed')
