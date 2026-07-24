# 二次开发：场景操控

本节介绍如何在运行时动态操控场景对象、修改材质、控制相机和环境。

## 动态添加对象

### 基础几何体

```typescript
import * as THREE from 'three'

const geometry = new THREE.BoxGeometry(1, 1, 1)
const material = new THREE.MeshStandardMaterial({
  color: '#4a90d9',
  metalness: 0.3,
  roughness: 0.7,
})
const cube = new THREE.Mesh(geometry, material)
cube.position.set(0, 0.5, 0)
cube.castShadow = true
cube.receiveShadow = true
cube.userData.selectable = true

engine.addObject(cube, {
  name: '数据立方体',
})
```

### 使用 ObjectFactory

引擎内置了 ObjectFactory，提供便捷的对象创建方法：

```typescript
import { ObjectFactory } from '@lowcode3d/runtime'

const box = ObjectFactory.createBox(2, 1, 1, { name: '矩形' })
const sphere = ObjectFactory.createSphere(0.5, 32, 32, { name: '球体' })
const cylinder = ObjectFactory.createCylinder(0.5, 0.5, 2, 32, { name: '圆柱' })
const cone = ObjectFactory.createCone(0.5, 1, 32, { name: '锥体' })
const torus = ObjectFactory.createTorus(0.5, 0.2, 16, 32, { name: '圆环' })
const plane = ObjectFactory.createPlane(10, 10, 1, 1, { name: '地面' })

engine.addObject(box)
engine.addObject(sphere)
```

### 加载外部模型

```typescript
import { getModelLoader } from '@lowcode3d/runtime'

const loader = getModelLoader()

const result = await loader.loadModel('/models/building.glb', {
  center: true,
  onProgress: (progress) => {
    console.log(`加载进度: ${(progress * 100).toFixed(0)}%`)
  },
})

const model = result.model
model.userData.selectable = true
model.userData.type = 'building'
model.userData.buildingId = 'B001'

engine.addObject(model, {
  name: '办公楼',
})
```

### 克隆现有模型

```typescript
const loader = getModelLoader()
const clone = loader.cloneModel(originalModel)
clone.position.set(5, 0, 0)
clone.name = '办公楼-副本'

engine.addObject(clone, {
  name: clone.name,
})
```

## 删除对象

```typescript
// 通过 UUID 删除
objectManager.remove(object.uuid)

// 通过对象引用删除
engine.removeObject(object)

// 删除选中对象
const selected = engine.selectionManager.getSelected()
for (const obj of selected) {
  engine.removeObject(obj)
}

// 清空所有对象
objectManager.clear()
```

## 修改对象属性

### 变换

```typescript
const object = objectManager.getObject('uuid')
if (!object) return

// 位置
object.position.set(1, 2, 3)

// 旋转（弧度）
object.rotation.set(0, Math.PI / 4, 0)

// 缩放
object.scale.set(2, 2, 2)

// 同步元数据（重要！否则序列化时数据不一致）
objectManager.updateTransform(object.uuid)
```

### 可见性

```typescript
object.visible = false
objectManager.updateMetadata(object.uuid, { visible: false })
```

### 自定义名称

```typescript
objectManager.updateMetadata(object.uuid, { name: '新名称' })
```

### 锁定状态

```typescript
objectManager.updateMetadata(object.uuid, { locked: true })
```

## 材质修改

### 修改颜色

```typescript
import * as THREE from 'three'

function setObjectColor(object: THREE.Object3D, color: string) {
  object.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      if (child.material instanceof THREE.MeshStandardMaterial) {
        child.material.color.set(color)
        child.material.needsUpdate = true
      }
    }
  })
}

setObjectColor(mesh, '#ff4444')
```

### 修改 PBR 属性

```typescript
function setPBRProperties(
  object: THREE.Object3D,
  props: { metalness?: number; roughness?: number; opacity?: number }
) {
  object.traverse((child) => {
    if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial) {
      if (props.metalness !== undefined) child.material.metalness = props.metalness
      if (props.roughness !== undefined) child.material.roughness = props.roughness
      if (props.opacity !== undefined) {
        child.material.opacity = props.opacity
        child.material.transparent = props.opacity < 1
      }
      child.material.needsUpdate = true
    }
  })
}

setPBRProperties(mesh, { metalness: 0.8, roughness: 0.2, opacity: 0.7 })
```

### 使用 MaterialManager

```typescript
import { getMaterialManager } from '@lowcode3d/runtime'

const materialManager = getMaterialManager()

const material = materialManager.createPBRMaterial({
  color: '#ffffff',
  metalness: 0.5,
  roughness: 0.5,
  emissive: '#000000',
  emissiveIntensity: 0,
})

materialManager.applyMaterial(mesh, material)
```

### 添加贴图

```typescript
import { getTextureLoader } from '@lowcode3d/runtime'

const textureLoader = getTextureLoader()
const texture = await textureLoader.load('/textures/wood.jpg')

if (mesh.material instanceof THREE.MeshStandardMaterial) {
  mesh.material.map = texture
  mesh.material.needsUpdate = true
}
```

## 灯光控制

### 添加灯光

```typescript
import { getLightManager } from '@lowcode3d/runtime'

const lightManager = getLightManager()

const pointLight = lightManager.createLight('point', {
  color: '#ffffff',
  intensity: 2,
  position: { x: 5, y: 5, z: 5 },
  distance: 50,
  castShadow: true,
})

engine.sceneManager.addObject(pointLight)
```

### 支持的灯光类型

| 类型          | 说明   | 特有属性                                      |
| ------------- | ------ | --------------------------------------------- |
| `ambient`     | 环境光 | —                                             |
| `directional` | 平行光 | `target`, `castShadow`                        |
| `point`       | 点光源 | `distance`, `decay`, `castShadow`             |
| `spot`        | 聚光灯 | `distance`, `angle`, `penumbra`, `castShadow` |
| `hemisphere`  | 半球光 | `groundColor`                                 |

## 环境设置

### 背景颜色

```typescript
engine.sceneManager.setBackgroundColor('#2a2a3a')
```

### HDRI 环境贴图

```typescript
await engine.sceneManager.setEnvironmentMap('/hdri/studio.hdr')
engine.sceneManager.setBackgroundAsEnvironment()
```

### 雾效

```typescript
// 线性雾
engine.sceneManager.setFog('linear', '#cccccc', 10, 100)

// 指数雾
engine.sceneManager.setFog('exponential', '#cccccc', 0.02)

// 清除雾效
engine.sceneManager.clearFog()
```

## 相机控制

### 设置相机位置

```typescript
const camera = engine.cameraManager.camera
camera.position.set(10, 10, 10)
camera.lookAt(0, 0, 0)

engine.cameraManager.controls.target.set(0, 0, 0)
engine.cameraManager.controls.update()
```

### 相机参数

```typescript
if (camera instanceof THREE.PerspectiveCamera) {
  camera.fov = 45
  camera.near = 0.1
  camera.far = 2000
  camera.updateProjectionMatrix()
}
```

### 轨道控制器配置

```typescript
const controls = engine.cameraManager.controls

controls.enableDamping = true
controls.dampingFactor = 0.05
controls.minDistance = 2
controls.maxDistance = 100
controls.maxPolarAngle = Math.PI / 2 // 限制仰角
```

## 截图导出

```typescript
const dataUrl = engine.takeScreenshot('image/png', 1.0)

// 下载截图
const link = document.createElement('a')
link.download = 'scene-screenshot.png'
link.href = dataUrl
link.click()
```

## 场景序列化

### 导出 JSON

```typescript
import { SceneSerializer } from '@lowcode3d/runtime'

const json = SceneSerializer.exportToJSON('我的项目', '项目描述')
const blob = new Blob([json], { type: 'application/json' })
const url = URL.createObjectURL(blob)

const link = document.createElement('a')
link.download = 'scene.json'
link.href = url
link.click()
```

### 从 JSON 加载

```typescript
const data = await SceneSerializer.importFromJSON(jsonString)
console.log('加载的项目:', data.projectName)
```

## 性能信息

```typescript
const info = engine.getRenderInfo()
console.log('三角面数:', info.render.triangles)
console.log('Draw Calls:', info.render.calls)
console.log('纹理数:', info.memory.textures)
console.log('几何体数:', info.memory.geometries)
```

## 窗口大小响应

```typescript
window.addEventListener('resize', () => {
  engine.resize()
})
```

## 资源释放

在组件卸载或页面离开时，务必释放引擎资源：

```typescript
engine.dispose()
// 或
Engine.destroyInstance()
```

::: warning 重要
不调用 `dispose()` 会导致 WebGL 上下文泄漏、内存泄漏等问题。在 Vue/React 组件中，应在 `onBeforeUnmount` / `useEffect cleanup` 中释放。
:::

## 下一步

- [高级定制](/guide/dev-advanced) - 自定义命令、扩展事件、后处理效果
- [交互开发](/guide/dev-interaction) - 选择、高亮、数据绑定
