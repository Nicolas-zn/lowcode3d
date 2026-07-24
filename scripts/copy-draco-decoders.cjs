const fs = require('node:fs')
const path = require('node:path')

const rootDir = path.resolve(__dirname, '..')
const frontendDir = path.join(rootDir, 'packages/frontend')
const threeMain = require.resolve('three', { paths: [frontendDir, rootDir] })
const threeDir = path.resolve(path.dirname(threeMain), '..')
const sourceDir = path.join(threeDir, 'examples/jsm/libs/draco/gltf')
const targetDir = path.join(frontendDir, 'public/draco')

const decoderFiles = [
  'draco_decoder.js',
  'draco_decoder.wasm',
  'draco_encoder.js',
  'draco_wasm_wrapper.js',
]

if (!fs.existsSync(sourceDir)) {
  throw new Error(`Three.js DRACO decoder directory not found: ${sourceDir}`)
}

fs.mkdirSync(targetDir, { recursive: true })

decoderFiles.forEach((fileName) => {
  const source = path.join(sourceDir, fileName)
  const target = path.join(targetDir, fileName)

  if (!fs.existsSync(source)) {
    throw new Error(`Three.js DRACO decoder file not found: ${source}`)
  }

  fs.copyFileSync(source, target)
})

console.log(`DRACO decoders copied to ${path.relative(rootDir, targetDir)}`)
