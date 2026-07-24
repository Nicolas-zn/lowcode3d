import { migrateProjectData } from '../dist/project/migrations.js'

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${String(expected)}, received ${String(actual)}`)
  }
}

function assertDeepEqual(actual, expected, message) {
  const actualJson = JSON.stringify(actual)
  const expectedJson = JSON.stringify(expected)
  if (actualJson !== expectedJson) {
    throw new Error(`${message}: expected ${expectedJson}, received ${actualJson}`)
  }
}

const legacyProject = {
  version: '1.1.0',
  projectName: 'Legacy Scene',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  origin: {
    models: [],
    textures: [],
    hdris: [],
  },
  sceneObjects: [],
  lights: [],
  camera: {
    type: 'perspective',
    position: { x: 5, y: 5, z: 5 },
    target: { x: 0, y: 0, z: 0 },
    fov: 60,
    near: 0.1,
    far: 1000,
  },
  environment: {
    backgroundColor: '#1a1a2e',
  },
}

const migrated = migrateProjectData(legacyProject)

assertEqual(migrated.version, '1.3.0', 'version is migrated')
assertEqual(migrated.schemaVersion, '1.3.0', 'schemaVersion is migrated')
assertEqual(migrated.projectName, 'Legacy Scene', 'project name is preserved')
assertDeepEqual(migrated.components, [], 'components default to empty array')
assertDeepEqual(migrated.events, [], 'events default to empty array')
assertDeepEqual(migrated.dataSources, [], 'dataSources default to empty array')
assertDeepEqual(migrated.bindings, [], 'bindings default to empty array')
assertEqual(migrated.runtimeConfig.controls.enabled, true, 'controls default to enabled')
assertEqual(migrated.runtimeConfig.animations.autoplay, true, 'animations autoplay by default')
assertEqual(migrated.postProcessing.enabled, false, 'post processing defaults to disabled')
assertEqual(migrated.publishConfig.embedDefaults.controls, true, 'embed controls default to enabled')

const empty = migrateProjectData({})

assertEqual(empty.version, '1.3.0', 'empty input gets latest version')
assertEqual(empty.projectName, 'Untitled Project', 'empty input gets default project name')
assertDeepEqual(empty.origin.models, [], 'empty input gets default model origins')
assertDeepEqual(empty.sceneObjects, [], 'empty input gets empty scene objects')

console.log('migrations.test passed')
