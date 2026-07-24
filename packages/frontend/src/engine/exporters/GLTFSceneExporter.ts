import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js'
import type { Engine } from '../core/Engine'
import { SceneSerializer } from '../core/SceneSerializer'

export interface GLTFSceneExportOptions {
  binary?: boolean
  projectName?: string
  description?: string
}

export class GLTFSceneExporter {
  private readonly engine: Engine

  constructor(engine: Engine) {
    this.engine = engine
  }

  async export(options: GLTFSceneExportOptions = {}): Promise<ArrayBuffer | object> {
    const scene = this.engine.sceneManager.scene.clone(true)
    const projectData = SceneSerializer.serialize(
      options.projectName ?? 'Exported Scene',
      options.description
    )
    scene.userData = {
      ...scene.userData,
      extras: {
        lowcode3d: {
          schemaVersion: projectData.schemaVersion,
          components: projectData.components,
          events: projectData.events,
          dataSources: projectData.dataSources,
          bindings: projectData.bindings,
          runtimeConfig: projectData.runtimeConfig,
          publishConfig: projectData.publishConfig,
        },
      },
    }

    const exporter = new GLTFExporter()
    return await new Promise((resolve, reject) => {
      exporter.parse(
        scene,
        (result) => resolve(result as ArrayBuffer | object),
        (error) => reject(error),
        {
          binary: options.binary ?? true,
          includeCustomExtensions: true,
        }
      )
    })
  }

  async download(filename: string, options: GLTFSceneExportOptions = {}): Promise<void> {
    const result = await this.export({ ...options, binary: true })
    const blob = new Blob([result as ArrayBuffer], { type: 'model/gltf-binary' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    link.click()
    URL.revokeObjectURL(url)
  }
}
