import * as THREE from 'three'

export interface ModelSelectionOptions {
  name?: string
  modelUrl?: string
  libraryId?: string
  isUserImported?: boolean
  importedFileName?: string
}

export function markModelRootForSelection(
  model: THREE.Object3D,
  options: ModelSelectionOptions = {}
): THREE.Object3D {
  model.userData.selectable = true
  model.userData.isModelRoot = true
  model.userData.modelRootUuid = model.uuid

  if (options.name) model.name = options.name
  if (options.modelUrl) model.userData.modelUrl = options.modelUrl
  if (options.libraryId) model.userData.libraryId = options.libraryId
  if (options.isUserImported) model.userData.isUserImported = true
  if (options.importedFileName) model.userData.importedFileName = options.importedFileName

  model.traverse((child) => {
    child.userData.modelRootUuid = model.uuid

    if (child !== model && child instanceof THREE.Mesh) {
      child.userData.selectable = false
    }
  })

  return model
}

export function findModelRootForSelection(object: THREE.Object3D): THREE.Object3D | null {
  let current: THREE.Object3D | null = object

  while (current) {
    if (current.userData.isModelRoot === true) {
      return current
    }
    current = current.parent
  }

  return null
}
