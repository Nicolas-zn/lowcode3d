/**
 * 广告牌工厂
 * 创建广告牌对象
 */
import * as THREE from 'three'
import {
  BillboardComponent,
  BillboardMode,
  type BillboardAnimationType,
  getBillboardManager,
  type IBillboardData,
} from './BillboardComponent'
import { getTextureLoader } from '../loaders/TextureLoader'

/**
 * 广告牌创建选项
 */
export interface IBillboardOptions {
  name?: string
  width?: number
  height?: number
  textureUrl?: string
  backTextureUrl?: string
  mode?: BillboardMode
  animation?: BillboardAnimationType
  repeat?: [number, number]
  isVideo?: boolean
  position?: THREE.Vector3
  camera?: THREE.Camera
}

/**
 * 广告牌工厂类
 */
export class BillboardFactory {
  /**
   * 创建广告牌
   */
  static async create(options: IBillboardOptions = {}): Promise<THREE.Object3D> {
    const {
      name = 'Billboard',
      width = 2,
      height = 2,
      textureUrl,
      backTextureUrl,
      mode = BillboardMode.Y_LOCK,
      animation = 'NONE',
      repeat = [1, 1],
      isVideo = false,
      position = new THREE.Vector3(0, 1, 0),
      camera,
    } = options

    // 创建容器组
    const container = new THREE.Group()
    container.name = name
    container.position.copy(position)

    // 创建几何体 (复用于正反面)
    const geometry = new THREE.PlaneGeometry(width, height)

    // 创建正面材质
    let frontMaterial: THREE.MeshBasicMaterial
    if (textureUrl) {
      try {
        const texture = await this._loadBillboardTexture(
          textureUrl,
          isVideo,
          repeat as [number, number]
        )
        frontMaterial = new THREE.MeshBasicMaterial({
          map: texture,
          transparent: true,
          depthWrite: false,
          side: THREE.FrontSide, // 单面渲染
        })
      } catch (error) {
        console.warn('Failed to load billboard front texture:', error)
        frontMaterial = this._createDefaultMaterial()
      }
    } else {
      frontMaterial = this._createDefaultMaterial()
    }

    // 创建正面网格
    const frontMesh = new THREE.Mesh(geometry, frontMaterial)
    frontMesh.name = 'FrontFace'
    // 标记为不可选择，让 SelectionManager 选择父级（广告牌根 Group）
    frontMesh.userData.selectable = false
    container.add(frontMesh)

    // 只有在明确需要背面时（或者为了统一结构总是创建？）
    // 目前逻辑：只有当有 backTextureUrl 时创建背面，或者总是创建？
    // 如果没有背面，旋转 180 度后就是透明的（因为 side: FrontSide）。
    // 为了支持 billboard 逻辑（总是要把正面朝向相机），其实背面很少会被看到，除非是 360 度或者 Y_LOCK 但相机绕到了后面。
    // 如果没有背面纹理，我们可以不创建背面，或者用正面纹理的镜像？
    // 用户需求里“最多两张图片”，暗示背面是可选的。

    if (backTextureUrl) {
      let backMaterial: THREE.MeshBasicMaterial
      try {
        const texture = await this._loadBillboardTexture(
          backTextureUrl,
          isVideo,
          repeat as [number, number]
        )
        backMaterial = new THREE.MeshBasicMaterial({
          map: texture,
          transparent: true,
          depthWrite: false,
          side: THREE.FrontSide,
        })
      } catch (error) {
        console.warn('Failed to load billboard back texture:', error)
        backMaterial = new THREE.MeshBasicMaterial({ color: 0xcccccc, side: THREE.FrontSide })
      }

      const backMesh = new THREE.Mesh(geometry, backMaterial)
      backMesh.name = 'BackFace'
      backMesh.rotation.y = Math.PI
      // 稍微错开防止 z-fighting
      backMesh.position.z = -0.005
      // 标记为不可选择
      backMesh.userData.selectable = false
      container.add(backMesh)
    } else {
      // 如果没有指定背面纹理，我们可以让 FrontMesh 双面渲染？
      // 原来的逻辑是 DoubleSide。
      // 为了兼容单图模式：如果只有 frontTexture，并且没指定 backTexture，
      // 我们把 FrontMaterial 设为 DoubleSide，且不创建 backMesh。
      frontMaterial.side = THREE.DoubleSide
    }

    // 设置 userData
    container.userData.selectable = true
    container.userData.isBillboard = true
    container.userData.billboardData = {
      mode,
      animation,
      repeat,
      isVideo,
      size: [width, height],
      texture: textureUrl || '',
      backTexture: backTextureUrl,
    } as IBillboardData

    // 创建并注册广告牌组件
    if (camera) {
      const component = new BillboardComponent(container, camera, mode)
      component.animation = animation || 'NONE'
      // getBillboardManager().register(component) // Component constructor now handles this
    }

    return container
  }

  /**
   * 加载广告牌纹理（支持图片和视频）
   */
  private static async _loadBillboardTexture(
    url: string,
    isVideo: boolean,
    repeat: [number, number]
  ): Promise<THREE.Texture> {
    let texture: THREE.Texture

    if (isVideo) {
      const video = document.createElement('video')
      video.src = url
      video.loop = true
      video.muted = true
      video.crossOrigin = 'anonymous'
      video.playsInline = true
      await video.play()
      texture = new THREE.VideoTexture(video)
      texture.colorSpace = THREE.SRGBColorSpace
    } else {
      // 检查是否是 SVG
      const isSVG = url.toLowerCase().endsWith('.svg') || url.startsWith('data:image/svg+xml')

      if (isSVG) {
        // 使用高分辨率加载 SVG
        texture = await new Promise<THREE.Texture>((resolve, reject) => {
          const img = new Image()
          img.crossOrigin = 'anonymous'
          img.onload = () => {
            // 计算高分辨率尺寸 (例如最大边 1024)
            const maxSize = 1024
            let width = img.width
            let height = img.height

            // 如果 SVG 没有默认尺寸，给定一个默认值
            if (width === 0) width = 512
            if (height === 0) height = 512

            const aspect = width / height
            if (width > height) {
              width = maxSize
              height = Math.round(maxSize / aspect)
            } else {
              height = maxSize
              width = Math.round(maxSize * aspect)
            }

            const canvas = document.createElement('canvas')
            canvas.width = width
            canvas.height = height
            const ctx = canvas.getContext('2d')!
            ctx.drawImage(img, 0, 0, width, height)

            const canvasTexture = new THREE.CanvasTexture(canvas)
            canvasTexture.colorSpace = THREE.SRGBColorSpace
            resolve(canvasTexture)
          }
          img.onerror = (e) => reject(e)
          img.src = url
        })
      } else {
        const textureLoader = getTextureLoader()
        texture = await textureLoader.loadTexture(url, {
          colorSpace: THREE.SRGBColorSpace,
        })
      }
    }

    if (repeat && (repeat[0] !== 1 || repeat[1] !== 1)) {
      texture.repeat.set(repeat[0], repeat[1])
      texture.wrapS = THREE.RepeatWrapping
      texture.wrapT = THREE.RepeatWrapping
    }

    return texture
  }

  /**
   * 创建默认材质（带占位图案）
   */
  private static _createDefaultMaterial(): THREE.MeshBasicMaterial {
    // 创建一个简单的棋盘格纹理作为占位
    const canvas = document.createElement('canvas')
    canvas.width = 128
    canvas.height = 128
    const ctx = canvas.getContext('2d')!

    // 背景
    ctx.fillStyle = '#4a90d9'
    ctx.fillRect(0, 0, 128, 128)

    // 图标（简单的广告牌符号）
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(54, 20, 20, 60)
    ctx.fillRect(34, 20, 60, 20)

    // 边框
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 4
    ctx.strokeRect(10, 10, 108, 108)

    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace

    return new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    })
  }

  /**
   * 从序列化数据创建广告牌
   */
  static async createFromData(
    data: IBillboardData,
    camera?: THREE.Camera,
    name?: string
  ): Promise<THREE.Object3D> {
    return this.create({
      name: name || 'Billboard',
      width: data.size[0],
      height: data.size[1],
      textureUrl: data.texture || undefined,
      backTextureUrl: data.backTexture || undefined,
      mode: data.mode,
      animation: data.animation,
      repeat: data.repeat,
      isVideo: data.isVideo,
      camera,
    })
  }

  /**
   * 为已存在的广告牌对象添加组件
   */
  static attachComponent(
    object: THREE.Object3D,
    camera: THREE.Camera,
    mode: BillboardMode = BillboardMode.Y_LOCK
  ): BillboardComponent {
    const component = new BillboardComponent(object, camera, mode)
    getBillboardManager().register(component)
    return component
  }

  /**
   * 更新广告牌纹理
   * TODO: 支持分别更新正反面
   * 暂时还是只更新正面
   */
  static async updateTexture(billboard: THREE.Object3D, textureUrl: string): Promise<void> {
    if (!billboard.userData.isBillboard) return

    // 获取正面 Mesh
    // 如果是 Group，找到 FrontFace
    let mesh: THREE.Mesh | null = null
    if (billboard instanceof THREE.Group) {
      mesh = billboard.getObjectByName('FrontFace') as THREE.Mesh
    } else if (billboard instanceof THREE.Mesh) {
      mesh = billboard
    }

    if (!mesh) return

    try {
      const textureLoader = getTextureLoader()
      const texture = await textureLoader.loadTexture(textureUrl, {
        colorSpace: THREE.SRGBColorSpace,
      })

      const material = mesh.material as THREE.MeshBasicMaterial
      if (material.map) {
        material.map.dispose()
      }
      material.map = texture
      material.needsUpdate = true

      // 更新 userData
      if (billboard.userData.billboardData) {
        billboard.userData.billboardData.texture = textureUrl
      }
    } catch (error) {
      console.error('Failed to update billboard texture:', error)
    }
  }

  /**
   * 更新广告牌尺寸
   */
  static updateSize(billboard: THREE.Object3D, width: number, height: number): void {
    if (!billboard.userData.isBillboard) return

    const newGeometry = new THREE.PlaneGeometry(width, height)

    // 如果是 Group，更新所有子 Mesh 的 geometry
    if (billboard instanceof THREE.Group) {
      billboard.children.forEach((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose()
          child.geometry = newGeometry
        }
      })
    } else if (billboard instanceof THREE.Mesh) {
      billboard.geometry.dispose()
      billboard.geometry = newGeometry
    }

    // 更新 userData
    if (billboard.userData.billboardData) {
      billboard.userData.billboardData.size = [width, height]
    }
  }

  /**
   * 更新广告牌模式
   */
  static updateMode(billboard: THREE.Object3D, mode: BillboardMode): void {
    const component = billboard.userData.billboardComponent as BillboardComponent | undefined
    if (component) {
      component.mode = mode
    }

    // 更新 userData
    if (billboard.userData.billboardData) {
      billboard.userData.billboardData.mode = mode
    }
  }
}
