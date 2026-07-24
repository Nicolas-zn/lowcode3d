import * as THREE from 'three'

/**
 * 网格创建选项
 */
export interface IMeshOptions {
  name?: string
  color?: number | string
  metalness?: number
  roughness?: number
  castShadow?: boolean
  receiveShadow?: boolean
  position?: { x: number; y: number; z: number }
  rotation?: { x: number; y: number; z: number }
  scale?: { x: number; y: number; z: number }
  userData?: Record<string, unknown>
}

/**
 * 默认材质选项
 */
const DEFAULT_MATERIAL_OPTIONS = {
  color: 0x409eff,
  metalness: 0.2,
  roughness: 0.5,
}

/**
 * 对象工厂
 * 负责创建标准几何体网格
 */
export class ObjectFactory {
  private static _meshCounter = 0

  /**
   * 生成唯一名称
   */
  private static _generateName(prefix: string): string {
    return `${prefix}_${++this._meshCounter}`
  }

  /**
   * 创建标准材质
   */
  private static _createMaterial(options: IMeshOptions): THREE.MeshStandardMaterial {
    return new THREE.MeshStandardMaterial({
      color: options.color ?? DEFAULT_MATERIAL_OPTIONS.color,
      metalness: options.metalness ?? DEFAULT_MATERIAL_OPTIONS.metalness,
      roughness: options.roughness ?? DEFAULT_MATERIAL_OPTIONS.roughness,
    })
  }

  /**
   * 应用通用设置到网格
   */
  private static _applyMeshSettings(mesh: THREE.Mesh, options: IMeshOptions): void {
    // 阴影设置
    mesh.castShadow = options.castShadow ?? true
    mesh.receiveShadow = options.receiveShadow ?? true

    // 位置
    if (options.position) {
      mesh.position.set(options.position.x, options.position.y, options.position.z)
    }

    // 旋转
    if (options.rotation) {
      mesh.rotation.set(options.rotation.x, options.rotation.y, options.rotation.z)
    }

    // 缩放
    if (options.scale) {
      mesh.scale.set(options.scale.x, options.scale.y, options.scale.z)
    }

    // 用户数据
    mesh.userData = {
      selectable: true,
      ...options.userData,
    }
  }

  /**
   * 创建立方体
   */
  static createBox(
    width: number = 1,
    height: number = 1,
    depth: number = 1,
    options: IMeshOptions = {}
  ): THREE.Mesh {
    const geometry = new THREE.BoxGeometry(width, height, depth)
    const material = this._createMaterial(options)
    const mesh = new THREE.Mesh(geometry, material)

    mesh.name = options.name || this._generateName('Box')
    this._applyMeshSettings(mesh, options)

    return mesh
  }

  /**
   * 创建球体
   */
  static createSphere(
    radius: number = 0.5,
    widthSegments: number = 32,
    heightSegments: number = 32,
    options: IMeshOptions = {}
  ): THREE.Mesh {
    const geometry = new THREE.SphereGeometry(radius, widthSegments, heightSegments)
    const material = this._createMaterial(options)
    const mesh = new THREE.Mesh(geometry, material)

    mesh.name = options.name || this._generateName('Sphere')
    this._applyMeshSettings(mesh, options)

    return mesh
  }

  /**
   * 创建平面
   */
  static createPlane(
    width: number = 1,
    height: number = 1,
    widthSegments: number = 1,
    heightSegments: number = 1,
    options: IMeshOptions = {}
  ): THREE.Mesh {
    const geometry = new THREE.PlaneGeometry(width, height, widthSegments, heightSegments)
    const material = this._createMaterial({
      ...options,
      // 平面默认双面渲染
    })
    material.side = THREE.DoubleSide
    const mesh = new THREE.Mesh(geometry, material)

    mesh.name = options.name || this._generateName('Plane')
    this._applyMeshSettings(mesh, options)

    return mesh
  }

  /**
   * 创建圆柱体
   */
  static createCylinder(
    radiusTop: number = 0.5,
    radiusBottom: number = 0.5,
    height: number = 1,
    radialSegments: number = 32,
    options: IMeshOptions = {}
  ): THREE.Mesh {
    const geometry = new THREE.CylinderGeometry(radiusTop, radiusBottom, height, radialSegments)
    const material = this._createMaterial(options)
    const mesh = new THREE.Mesh(geometry, material)

    mesh.name = options.name || this._generateName('Cylinder')
    this._applyMeshSettings(mesh, options)

    return mesh
  }

  /**
   * 创建圆锥体
   */
  static createCone(
    radius: number = 0.5,
    height: number = 1,
    radialSegments: number = 32,
    options: IMeshOptions = {}
  ): THREE.Mesh {
    const geometry = new THREE.ConeGeometry(radius, height, radialSegments)
    const material = this._createMaterial(options)
    const mesh = new THREE.Mesh(geometry, material)

    mesh.name = options.name || this._generateName('Cone')
    this._applyMeshSettings(mesh, options)

    return mesh
  }

  /**
   * 创建圆环
   */
  static createTorus(
    radius: number = 0.5,
    tube: number = 0.2,
    radialSegments: number = 16,
    tubularSegments: number = 32,
    options: IMeshOptions = {}
  ): THREE.Mesh {
    const geometry = new THREE.TorusGeometry(radius, tube, radialSegments, tubularSegments)
    const material = this._createMaterial(options)
    const mesh = new THREE.Mesh(geometry, material)

    mesh.name = options.name || this._generateName('Torus')
    this._applyMeshSettings(mesh, options)

    return mesh
  }

  /**
   * 创建圆片
   */
  static createCircle(
    radius: number = 0.5,
    segments: number = 32,
    options: IMeshOptions = {}
  ): THREE.Mesh {
    const geometry = new THREE.CircleGeometry(radius, segments)
    const material = this._createMaterial(options)
    material.side = THREE.DoubleSide
    const mesh = new THREE.Mesh(geometry, material)

    mesh.name = options.name || this._generateName('Circle')
    this._applyMeshSettings(mesh, options)

    return mesh
  }

  /**
   * 创建圆环片
   */
  static createRing(
    innerRadius: number = 0.3,
    outerRadius: number = 0.5,
    thetaSegments: number = 32,
    options: IMeshOptions = {}
  ): THREE.Mesh {
    const geometry = new THREE.RingGeometry(innerRadius, outerRadius, thetaSegments)
    const material = this._createMaterial(options)
    material.side = THREE.DoubleSide
    const mesh = new THREE.Mesh(geometry, material)

    mesh.name = options.name || this._generateName('Ring')
    this._applyMeshSettings(mesh, options)

    return mesh
  }

  /**
   * 创建四面体
   */
  static createTetrahedron(
    radius: number = 0.65,
    detail: number = 0,
    options: IMeshOptions = {}
  ): THREE.Mesh {
    const geometry = new THREE.TetrahedronGeometry(radius, detail)
    const material = this._createMaterial(options)
    const mesh = new THREE.Mesh(geometry, material)

    mesh.name = options.name || this._generateName('Tetrahedron')
    this._applyMeshSettings(mesh, options)

    return mesh
  }

  /**
   * 创建八面体
   */
  static createOctahedron(
    radius: number = 0.65,
    detail: number = 0,
    options: IMeshOptions = {}
  ): THREE.Mesh {
    const geometry = new THREE.OctahedronGeometry(radius, detail)
    const material = this._createMaterial(options)
    const mesh = new THREE.Mesh(geometry, material)

    mesh.name = options.name || this._generateName('Octahedron')
    this._applyMeshSettings(mesh, options)

    return mesh
  }

  /**
   * 创建二十面体
   */
  static createIcosahedron(
    radius: number = 0.65,
    detail: number = 0,
    options: IMeshOptions = {}
  ): THREE.Mesh {
    const geometry = new THREE.IcosahedronGeometry(radius, detail)
    const material = this._createMaterial(options)
    const mesh = new THREE.Mesh(geometry, material)

    mesh.name = options.name || this._generateName('Icosahedron')
    this._applyMeshSettings(mesh, options)

    return mesh
  }

  /**
   * 创建十二面体
   */
  static createDodecahedron(
    radius: number = 0.65,
    detail: number = 0,
    options: IMeshOptions = {}
  ): THREE.Mesh {
    const geometry = new THREE.DodecahedronGeometry(radius, detail)
    const material = this._createMaterial(options)
    const mesh = new THREE.Mesh(geometry, material)

    mesh.name = options.name || this._generateName('Dodecahedron')
    this._applyMeshSettings(mesh, options)

    return mesh
  }

  /**
   * 创建地板 (接收阴影但不投射)
   */
  static createFloor(size: number = 20, options: IMeshOptions = {}): THREE.Mesh {
    const geometry = new THREE.PlaneGeometry(size, size)
    const material = new THREE.MeshStandardMaterial({
      color: options.color ?? 0x333355,
      roughness: 0.9,
      metalness: 0.1,
    })
    const mesh = new THREE.Mesh(geometry, material)

    mesh.name = options.name || 'Floor'
    mesh.rotation.x = -Math.PI / 2
    mesh.receiveShadow = true
    mesh.castShadow = false
    mesh.userData = {
      selectable: false,
      isFloor: true,
      ...options.userData,
    }

    return mesh
  }

  /**
   * 重置计数器
   */
  static resetCounter(): void {
    this._meshCounter = 0
  }
}
