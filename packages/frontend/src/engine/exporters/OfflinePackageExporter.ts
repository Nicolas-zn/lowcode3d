import type { Engine } from '../core/Engine'
import { SceneSerializer } from '../core/SceneSerializer'

export interface OfflinePackageFile {
  path: string
  content: string
  mimeType: string
}

export class OfflinePackageExporter {
  private readonly engine: Engine

  constructor(engine: Engine) {
    this.engine = engine
  }

  export(projectName: string, description?: string): OfflinePackageFile[] {
    if (!this.engine.isInitialized) {
      throw new Error('Engine not initialized')
    }

    const projectData = SceneSerializer.serialize(projectName, description)
    const assetManifest = projectData.assetManifest ?? {
      generatedAt: new Date().toISOString(),
      items: [],
    }
    const runtimeConfig = {
      projectName,
      description,
      runtimeVersion: '1.3.0',
      embedDefaults: projectData.publishConfig.embedDefaults,
    }

    return [
      {
        path: 'project.json',
        content: JSON.stringify(projectData, null, 2),
        mimeType: 'application/json',
      },
      {
        path: 'asset-manifest.json',
        content: JSON.stringify(assetManifest, null, 2),
        mimeType: 'application/json',
      },
      {
        path: 'runtime-config.json',
        content: JSON.stringify(runtimeConfig, null, 2),
        mimeType: 'application/json',
      },
      {
        path: 'index.html',
        content: this.createExampleHtml(projectData.projectName),
        mimeType: 'text/html',
      },
    ]
  }

  private createExampleHtml(title: string): string {
    return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
</head>
<body>
  <div id="app"></div>
  <script type="module">
    console.log('offline package preview bootstrap')
  </script>
</body>
</html>`
  }
}
