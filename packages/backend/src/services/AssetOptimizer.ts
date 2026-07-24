import { NodeIO, Document } from '@gltf-transform/core'
import { KHRDracoMeshCompression } from '@gltf-transform/extensions'
import { draco, dedup, prune, textureCompress } from '@gltf-transform/functions'
import draco3d from 'draco3d'
import sharp from 'sharp'

export interface AssetStats {
  triangles: number
  materials: number
  animations: number
  meshes: number
  textures: number
  maxTextureSize: number
  [key: string]: number
}

export interface AssetOptimizationRecommendation {
  code:
    | 'draco_recommended'
    | 'texture_downsample_recommended'
    | 'material_merge_recommended'
    | 'instance_reuse_recommended'
  label: string
  severity: 'info' | 'warning'
  reason: string
  action: string
}

export interface AssetInspectionResult {
  stats: AssetStats
  optimizationRecommendations: AssetOptimizationRecommendation[]
}

export class AssetOptimizer {
  static async inspect(buffer: Buffer): Promise<AssetInspectionResult> {
    const io = await AssetOptimizer.createIO()
    const doc = await io.readBinary(new Uint8Array(buffer))
    const stats = await AssetOptimizer.getStats(doc)

    return {
      stats,
      optimizationRecommendations: AssetOptimizer.buildOptimizationRecommendations(stats),
    }
  }

  static async optimize(buffer: Buffer): Promise<{
    optimizedBuffer: Buffer
    stats: AssetStats
    optimizationRecommendations: AssetOptimizationRecommendation[]
  }> {
    const io = await AssetOptimizer.createIO()
    const doc = await io.readBinary(new Uint8Array(buffer))
    const originalStats = await AssetOptimizer.getStats(doc)

    await doc.transform(
      dedup(),
      prune(),
      textureCompress({
        encoder: sharp,
        targetFormat: 'png',
        resize: [2048, 2048],
      }),
      draco()
    )

    const stats = await AssetOptimizer.getStats(doc)
    const optimizedBuffer = Buffer.from(await io.writeBinary(doc))

    return {
      optimizedBuffer,
      stats,
      optimizationRecommendations: AssetOptimizer.buildOptimizationRecommendations(originalStats),
    }
  }

  static buildOptimizationRecommendations(stats: AssetStats): AssetOptimizationRecommendation[] {
    const recommendations: AssetOptimizationRecommendation[] = []

    if (stats.triangles >= 200_000 || stats.meshes >= 20) {
      recommendations.push({
        code: 'draco_recommended',
        label: '启用 Draco',
        severity: stats.triangles >= 800_000 ? 'warning' : 'info',
        reason: `模型包含 ${stats.triangles.toLocaleString()} 个三角面和 ${stats.meshes} 个网格`,
        action: '发布前启用 Draco 压缩，并为远景准备低模或 LOD。',
      })
    }

    if (stats.textures >= 4 || stats.maxTextureSize >= 2048) {
      recommendations.push({
        code: 'texture_downsample_recommended',
        label: '贴图降采样',
        severity: stats.maxTextureSize >= 4096 ? 'warning' : 'info',
        reason: `贴图数量 ${stats.textures}，最大尺寸 ${stats.maxTextureSize}px`,
        action: '将 4K 贴图压到 2K 或以下，并合并重复纹理。',
      })
    }

    if (stats.materials >= 8) {
      recommendations.push({
        code: 'material_merge_recommended',
        label: '合并材质',
        severity: stats.materials >= 20 ? 'warning' : 'info',
        reason: `模型包含 ${stats.materials} 个材质`,
        action: '合并相近材质或抽取共享材质预设，降低 Draw Calls。',
      })
    }

    if (stats.meshes >= 20) {
      recommendations.push({
        code: 'instance_reuse_recommended',
        label: '复用实例',
        severity: stats.meshes >= 80 ? 'warning' : 'info',
        reason: `模型包含 ${stats.meshes} 个网格节点`,
        action: '对重复设备、螺丝、管线等结构改用实例化或组件复用。',
      })
    }

    return recommendations
  }

  static async getStats(doc: Document): Promise<AssetStats> {
    let triangles = 0

    for (const mesh of doc.getRoot().listMeshes()) {
      for (const prim of mesh.listPrimitives()) {
        const position = prim.getAttribute('POSITION')
        const indices = prim.getIndices()
        const mode = prim.getMode()

        // TRIANGLES = 4
        if (mode === 4) {
          if (indices) {
            triangles += indices.getCount() / 3
          } else if (position) {
            triangles += position.getCount() / 3
          }
        }
      }
    }

    const materials = doc.getRoot().listMaterials().length
    const animations = doc.getRoot().listAnimations().length
    const meshes = doc.getRoot().listMeshes().length
    const textureList = doc.getRoot().listTextures()
    const textures = textureList.length
    const textureSizes = await Promise.all(
      textureList.map((texture) => AssetOptimizer.getTextureMaxSize(texture))
    )
    const maxTextureSize = textureSizes.reduce((max, size) => Math.max(max, size), 0)

    return {
      triangles: Math.round(triangles),
      materials,
      animations,
      meshes,
      textures,
      maxTextureSize,
    }
  }

  private static async createIO(): Promise<NodeIO> {
    return new NodeIO().registerExtensions([KHRDracoMeshCompression]).registerDependencies({
      'draco3d.decoder': await draco3d.createDecoderModule(),
      'draco3d.encoder': await draco3d.createEncoderModule(),
    })
  }

  private static async getTextureMaxSize(texture: { getImage(): unknown }): Promise<number> {
    const image = texture.getImage()
    if (!image) return 0

    if (typeof image === 'object' && image !== null && 'width' in image && 'height' in image) {
      const width = Number((image as { width?: unknown }).width ?? 0)
      const height = Number((image as { height?: unknown }).height ?? 0)
      return Math.max(width, height)
    }

    if (Buffer.isBuffer(image) || image instanceof Uint8Array) {
      try {
        const metadata = await sharp(Buffer.from(image)).metadata()
        return Math.max(metadata.width ?? 0, metadata.height ?? 0)
      } catch {
        return 0
      }
    }

    return 0
  }
}
