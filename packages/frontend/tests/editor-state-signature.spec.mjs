import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const frontendRoot = resolve(__dirname, '..')
const editorStateStoreSource = readFileSync(
  resolve(frontendRoot, 'src/stores/editorStateStore.ts'),
  'utf8'
)

assert.match(
  editorStateStoreSource,
  /sanitizeSignatureData/,
  'editor state signatures should sanitize project data before stringifying'
)

assert.doesNotMatch(
  editorStateStoreSource,
  /structuredClone\(sceneData\)/,
  'captureSceneSignature should not structuredClone scene data that may contain runtime objects'
)

assert.match(
  editorStateStoreSource,
  /value instanceof Window/,
  'signature sanitizer should drop Window references from runtime userData'
)
