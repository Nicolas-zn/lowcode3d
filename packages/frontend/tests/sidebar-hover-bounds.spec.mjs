import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const frontendRoot = resolve(__dirname, '..')

const lightLibrary = readFileSync(
  resolve(frontendRoot, 'src/components/sidebar/LightLibrary.vue'),
  'utf8'
)
const componentLibrary = readFileSync(
  resolve(frontendRoot, 'src/components/sidebar/ComponentLibrary.vue'),
  'utf8'
)

assert.doesNotMatch(
  lightLibrary,
  /\.light-item[\s\S]*?&:hover\s*{[\s\S]*?transform:\s*translateX\(/,
  'LightLibrary light type cards should not move horizontally on hover'
)

assert.match(
  componentLibrary,
  /\.component-grid\s*{[\s\S]*?padding:\s*4px/,
  'ComponentLibrary grid should reserve top space for elevated hover cards'
)
