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

const materialPanel = readSource('packages/frontend/src/components/properties/MaterialPanel.vue')
const materialIndex = readSource('packages/frontend/src/engine/materials/index.ts')
const materialColorCycleRunner = readSource(
  'packages/frontend/src/engine/materials/MaterialColorCycleRunner.ts'
)
const sceneSerializer = readSource('packages/frontend/src/engine/core/SceneSerializer.ts')
const previewSceneRuntime = readSource('packages/frontend/src/engine/runtime/PreviewSceneRuntime.ts')

assert.match(
  materialPanel,
  /startMaterialColorCycle/,
  'MaterialPanel should delegate playback to the material color cycle runner'
)
assert.match(
  materialPanel,
  /stopMaterialColorCycle/,
  'MaterialPanel should delegate stopping to the material color cycle runner'
)
assert.doesNotMatch(
  materialPanel,
  /colorCycleTween\.value\?\.kill\(\)/,
  'MaterialPanel should not own GSAP tween cleanup because deselection unmounts the panel'
)
assert.match(
  materialIndex,
  /MaterialColorCycleRunner/,
  'material module should export the color cycle runner'
)
assert.match(
  materialColorCycleRunner,
  /from ['"]gsap['"]/,
  'MaterialColorCycleRunner should use GSAP for color cycles'
)
assert.match(
  materialColorCycleRunner,
  /colorCycleTweens = new Map/,
  'MaterialColorCycleRunner should keep tweens outside Inspector component lifecycle'
)
assert.match(
  materialColorCycleRunner,
  /normalizeMaterialColorCycleConfig/,
  'MaterialColorCycleRunner should normalize persisted cycle configs'
)
assert.match(
  materialColorCycleRunner,
  /getPrimaryCycleMaterial/,
  'MaterialColorCycleRunner should resolve the current object material during playback'
)
assert.match(
  materialColorCycleRunner,
  /const material = getPrimaryCycleMaterial\(object\)/,
  'MaterialColorCycleRunner should not keep animating a stale selected-material clone'
)
assert.match(
  materialColorCycleRunner,
  /export function startMaterialColorCycle/,
  'MaterialColorCycleRunner should start color cycles'
)
assert.match(
  materialColorCycleRunner,
  /export function stopMaterialColorCycle/,
  'MaterialColorCycleRunner should stop color cycles explicitly'
)
assert.match(
  materialColorCycleRunner,
  /export function isMaterialColorCycleRunning/,
  'MaterialColorCycleRunner should expose running state for the Inspector'
)
assert.match(
  materialColorCycleRunner,
  /type MaterialColorCycleMode = ['"]gradient['"] \| ['"]jump['"]/,
  'MaterialColorCycleRunner should support gradient and jump color cycle modes'
)
assert.match(
  materialColorCycleRunner,
  /type MaterialColorCycleLoop = ['"]once['"] \| ['"]forever['"]/,
  'MaterialColorCycleRunner should support once and forever loop modes'
)
assert.match(
  materialColorCycleRunner,
  /export function restoreMaterialColorCycles/,
  'MaterialColorCycleRunner should restore enabled cycles after scene load'
)
assert.match(
  materialColorCycleRunner,
  /export function clearMaterialColorCycles/,
  'MaterialColorCycleRunner should clear stale cycles before reloading a scene'
)
assert.match(
  materialPanel,
  /materialColorCycle/,
  'MaterialPanel should persist color cycle settings on object userData'
)
assert.match(
  materialPanel,
  /cycleConfig[\s\S]*colors:\s*\[/,
  'MaterialPanel should expose editable cycle colors'
)
assert.match(
  materialPanel,
  /cycleConfig[\s\S]*duration/,
  'MaterialPanel should expose cycle duration'
)
assert.match(
  materialPanel,
  /addCycleColor/,
  'MaterialPanel should allow increasing color count'
)
assert.match(
  materialPanel,
  /removeCycleColor/,
  'MaterialPanel should allow decreasing color count'
)
assert.match(
  materialColorCycleRunner,
  /repeat:\s*config\.loop === ['"]forever['"] \? -1 : 0/,
  'GSAP color cycle should support infinite repeat'
)
assert.match(
  materialColorCycleRunner,
  /value:\s*config\.colors\.length/,
  'Gradient cycles should animate through the closing segment back to the first color'
)
assert.match(
  materialColorCycleRunner,
  /toIndex = \(fromIndex \+ 1\) % colors\.length/,
  'Gradient color interpolation should wrap from the last color back to the first color'
)
assert.match(
  materialColorCycleRunner,
  /ease:\s*['"]none['"]/,
  'GSAP color cycle should use linear progress for both gradient and jump modes'
)
assert.match(
  materialPanel,
  /stopColorCycle/,
  'MaterialPanel should expose a stop control for the running color cycle'
)
assert.match(
  materialPanel,
  /restoreSavedColorCycle/,
  'MaterialPanel should restore persisted enabled color cycles when the object is loaded'
)
assert.match(
  materialPanel,
  /cycleConfig\.value\.enabled = false[\s\S]*persistCycleConfig\(\)/,
  'Stopping a color cycle should persist enabled=false'
)
assert.match(
  materialPanel,
  /if \(cycleConfig\.value\.enabled\) \{[\s\S]*startColorCycle\(\)/,
  'Persisted enabled cycles should start automatically after material sync'
)
assert.match(
  materialPanel,
  /selectionManager\.updateOriginalMaterial\(props\.object\)/,
  'Starting a color cycle while selected should prevent deselection from restoring the old material reference'
)
assert.match(
  materialPanel,
  /const enableEmissive = ref\(false\)/,
  'Emissive should be off by default'
)
assert.match(
  materialPanel,
  /handleEmissiveEnabledChange/,
  'MaterialPanel should expose an emissive enable switch handler'
)
assert.match(
  materialPanel,
  /v-model="enableEmissive"/,
  'MaterialPanel should render an emissive switch'
)
assert.match(
  materialPanel,
  /v-if="showEmissive"/,
  'Emissive color and intensity controls should be hidden while disabled'
)
assert.match(
  materialPanel,
  /background:\s*var\(--lc-accent\)/,
  'Selected cycle mode should use an obvious accent background'
)
assert.match(
  materialPanel,
  /\.cycle-color-list[\s\S]*flex-direction:\s*row/,
  'Cycle colors should be arranged in one horizontal row'
)
assert.doesNotMatch(
  materialPanel,
  /onBeforeUnmount\(\(\) => \{[\s\S]*stopColorCycle\(false\)/,
  'Deselecting an object should not stop a running material color cycle'
)
assert.match(
  sceneSerializer,
  /clearMaterialColorCycles\(\)/,
  'SceneSerializer should clear stale cycles before rebuilding the scene'
)
assert.match(
  sceneSerializer,
  /restoreMaterialColorCycles\(engine\.sceneManager\.scene\)/,
  'SceneSerializer should restore persisted cycles after scene load'
)
assert.match(
  sceneSerializer,
  /userData:\s*\{[\s\S]*\.\.\.this\._filterUserData\(child\.userData\)[\s\S]*path:\s*childPath/,
  'SceneSerializer should persist child mesh color cycle userData for imported models'
)
assert.match(
  previewSceneRuntime,
  /clearMaterialColorCycles\(\)/,
  'PreviewSceneRuntime should clear stale cycles before rebuilding the scene'
)
assert.match(
  previewSceneRuntime,
  /restoreMaterialColorCycles\(this\.scene\)/,
  'PreviewSceneRuntime should restore persisted cycles after scene load'
)

console.log('material-color-cycle.spec passed')
