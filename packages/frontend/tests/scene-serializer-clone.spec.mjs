import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const frontendRoot = resolve(__dirname, '..')
const sceneSerializerSource = readFileSync(
  resolve(frontendRoot, 'src/engine/core/SceneSerializer.ts'),
  'utf8'
)

assert.match(
  sceneSerializerSource,
  /_cloneProjectJson/,
  'SceneSerializer should use a JSON-safe clone helper for persisted project fields'
)

assert.doesNotMatch(
  sceneSerializerSource,
  /structuredClone\(projectData\.(cameraBookmarks|events|dataSources|bindings)\)/,
  'deserialize should not structuredClone possibly reactive project arrays directly'
)
