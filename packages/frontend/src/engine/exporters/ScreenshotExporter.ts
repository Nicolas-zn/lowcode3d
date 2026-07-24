import type { Engine } from '../core/Engine'
import { Vector2 } from 'three'

export interface ScreenshotExportOptions {
  width?: number
  height?: number
  mimeType?: string
  quality?: number
  transparent?: boolean
}

export class ScreenshotExporter {
  private readonly engine: Engine

  constructor(engine: Engine) {
    this.engine = engine
  }

  export(options: ScreenshotExportOptions = {}): string {
    const renderer = this.engine.renderManager.renderer
    const canvas = renderer.domElement
    const previousSize = renderer.getSize(new Vector2())
    const previousClearAlpha = renderer.getClearAlpha()
    const width = options.width ?? canvas.width
    const height = options.height ?? canvas.height

    if (options.width || options.height) {
      renderer.setSize(width, height, false)
    }
    if (options.transparent) {
      renderer.setClearAlpha(0)
    }

    this.engine.renderManager.render(
      this.engine.sceneManager.scene,
      this.engine.cameraManager.camera
    )
    const dataUrl = renderer.domElement.toDataURL(
      options.mimeType ?? 'image/png',
      options.quality ?? 1
    )

    if (options.transparent) {
      renderer.setClearAlpha(previousClearAlpha)
    }
    if (options.width || options.height) {
      renderer.setSize(previousSize.x, previousSize.y, false)
    }
    return dataUrl
  }

  download(filename: string, options: ScreenshotExportOptions = {}): void {
    const dataUrl = this.export(options)
    const link = document.createElement('a')
    link.href = dataUrl
    link.download = filename
    link.click()
  }
}
