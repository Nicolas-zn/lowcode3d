import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

function readSource(path) {
  return readFileSync(path, 'utf8')
}

const __dirname = dirname(fileURLToPath(import.meta.url))
const runtimeRoot = resolve(__dirname, '../src')
const frontendRoot = resolve(__dirname, '../../frontend/src')
const sharedRoot = resolve(__dirname, '../../shared/src')

const projectDataSource = readSource(resolve(sharedRoot, 'types/projectData.ts'))
const migrationSource = readSource(resolve(sharedRoot, 'project/migrations.ts'))
const frontendAnimationEngineSource = readSource(
  resolve(frontendRoot, 'engine/animation/AnimationEngine.ts'),
)
const runtimeAnimationEngineSource = readSource(resolve(runtimeRoot, 'animation/AnimationEngine.ts'))
const timelinePanelSource = readSource(resolve(frontendRoot, 'components/bottom/TimelinePanel.vue'))
const animationCommandSource = readSource(
  resolve(frontendRoot, 'engine/history/commands/AnimationCommand.ts'),
)
const commandBusSource = readSource(resolve(frontendRoot, 'engine/editor/CommandBus.ts'))
const projectRuntimeSource = readSource(resolve(runtimeRoot, 'runtime/ProjectRuntime.ts'))
const viewerSource = readSource(resolve(runtimeRoot, 'LowCode3DViewer.ts'))
const runtimeEventSystemSource = readSource(resolve(runtimeRoot, 'events/RuntimeEventSystem.ts'))
const diagnosticsSource = readSource(resolve(frontendRoot, 'engine/core/ProjectDiagnostics.ts'))

assert(projectDataSource.includes('IAnimationClipData'), 'animation protocol should define clips')
assert(projectDataSource.includes('clips: IAnimationClipData[]'), 'IAnimationData should include clips')
assert(projectDataSource.includes('loop:'), 'animation clip protocol should include loop')
assert(projectDataSource.includes('autoplay:'), 'animation clip protocol should include autoplay')
assert(projectDataSource.includes('enabled:'), 'animation clip protocol should include enabled')
assert(projectDataSource.includes('targetRef'), 'animation track protocol should include targetRef')
assert(projectDataSource.includes('easing'), 'animation track protocol should include easing')
assert(migrationSource.includes('normalizeAnimationData'), 'migration should normalize animation data')
assert(migrationSource.includes('default-clip'), 'migration should create default clip for old tracks')

assert(frontendAnimationEngineSource.includes('createClip('), 'AnimationEngine should create clips')
assert(frontendAnimationEngineSource.includes('duplicateClip('), 'AnimationEngine should duplicate clips')
assert(frontendAnimationEngineSource.includes('removeClip('), 'AnimationEngine should remove clips')
assert(frontendAnimationEngineSource.includes('setActiveClip('), 'AnimationEngine should set active clip')
assert(frontendAnimationEngineSource.includes('getClips('), 'AnimationEngine should list clips')
assert(frontendAnimationEngineSource.includes('play(clipId'), 'AnimationEngine.play should accept clipId')
assert(frontendAnimationEngineSource.includes('pause(clipId'), 'AnimationEngine.pause should accept clipId')
assert(frontendAnimationEngineSource.includes('stop(clipId'), 'AnimationEngine.stop should accept clipId')
assert(frontendAnimationEngineSource.includes('clipId'), 'AnimationEngine should serialize clipId')
assert(runtimeAnimationEngineSource.includes('createClip('), 'runtime AnimationEngine should include clip API')

assert(timelinePanelSource.includes('clipOptions'), 'TimelinePanel should list clip options')
assert(timelinePanelSource.includes('createClip'), 'TimelinePanel should create clips')
assert(timelinePanelSource.includes('duplicateClip'), 'TimelinePanel should duplicate clips')
assert(timelinePanelSource.includes('removeClip'), 'TimelinePanel should remove clips')
assert(timelinePanelSource.includes('activeClipId'), 'TimelinePanel should track active clip')
assert(timelinePanelSource.includes('loop'), 'TimelinePanel should edit clip loop')
assert(timelinePanelSource.includes('autoplay'), 'TimelinePanel should edit clip autoplay')
assert(animationCommandSource.includes('AnimationCommand'), 'AnimationCommand should commandize edits')
assert(animationCommandSource.includes('beforeData'), 'AnimationCommand should keep undo snapshot')
assert(animationCommandSource.includes('afterData'), 'AnimationCommand should keep redo snapshot')
assert(commandBusSource.includes('executeAnimationCommand'), 'CommandBus should execute animation commands')
assert(timelinePanelSource.includes('executeAnimationCommand'), 'TimelinePanel should use animation commands')

assert(projectRuntimeSource.includes('pauseAnimation('), 'ProjectRuntime should expose pauseAnimation')
assert(projectRuntimeSource.includes('stopAnimation('), 'ProjectRuntime should expose stopAnimation')
assert(projectRuntimeSource.includes('playAnimation(clipId'), 'ProjectRuntime.playAnimation should pass clipId')
assert(viewerSource.includes('pauseAnimation('), 'LowCode3DViewer should expose pauseAnimation')
assert(viewerSource.includes('stopAnimation('), 'LowCode3DViewer should expose stopAnimation')
assert(runtimeEventSystemSource.includes('playAnimation(action.payload'), 'events should pass clip payload to play')
assert(runtimeEventSystemSource.includes('pauseAnimation(action.payload'), 'events should pass clip payload to pause')

assert(diagnosticsSource.includes('analyzeAnimationClips'), 'ProjectDiagnostics should analyze clips')
assert(diagnosticsSource.includes("code: 'animation.clip_empty'"), 'diagnostics should catch empty clips')
assert(diagnosticsSource.includes("code: 'animation.clip_duplicate'"), 'diagnostics should catch duplicate clips')
assert(diagnosticsSource.includes("code: 'animation.target_missing'"), 'diagnostics should catch missing targets')
assert(diagnosticsSource.includes("code: 'animation.property_unsupported'"), 'diagnostics should catch unsupported properties')

console.log('runtime-animation.test passed')
