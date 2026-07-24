# 动态操作

运行时动态操作场景对象。

## 修改对象属性

```typescript
const obj = manager.getObjectByName('MyBox')

// 位置
obj.position.set(1, 2, 3)
obj.position.x += 1

// 旋转 (弧度)
obj.rotation.y = Math.PI / 2
obj.rotation.set(0, Math.PI, 0)

// 缩放
obj.scale.set(2, 2, 2)
obj.scale.multiplyScalar(1.5)

// 可见性
obj.visible = false
```

## 修改材质

```typescript
import * as THREE from 'three'

const mesh = manager.getObjectByName('MyMesh') as THREE.Mesh

if (mesh.material instanceof THREE.MeshStandardMaterial) {
  // 颜色
  mesh.material.color.set('#ff0000')
  mesh.material.color.setHex(0x00ff00)

  // 材质属性
  mesh.material.metalness = 0.8
  mesh.material.roughness = 0.2
  mesh.material.opacity = 0.5
  mesh.material.transparent = true

  // 需要更新
  mesh.material.needsUpdate = true
}
```

## 动画效果

```typescript
import * as THREE from 'three'

const obj = manager.getObjectByName('Target')
const clock = new THREE.Clock()

function animate() {
  requestAnimationFrame(animate)

  const elapsed = clock.getElapsedTime()

  // 旋转动画
  obj.rotation.y = elapsed * 0.5

  // 浮动动画
  obj.position.y = Math.sin(elapsed) * 0.5 + 1
}

animate()
```

## 切换场景

```typescript
async function switchScene(sceneId: string) {
  // 获取新场景数据
  const response = await fetch(`/api/scenes/${sceneId}`)
  const data = await response.json()

  // 加载新场景
  await manager.loadScene(data.sceneData, {
    modelMappings,
  })
}
```

## 动态添加对象

```typescript
import * as THREE from 'three'

const scene = manager.getScene()

// 添加几何体
const geometry = new THREE.BoxGeometry(1, 1, 1)
const material = new THREE.MeshStandardMaterial({ color: 0x00ff00 })
const cube = new THREE.Mesh(geometry, material)
cube.position.set(0, 0.5, 0)
scene.add(cube)

// 添加光源
const light = new THREE.PointLight(0xffffff, 1, 100)
light.position.set(5, 5, 5)
scene.add(light)
```

## 相机控制

```typescript
const camera = manager.getCamera()
const controls = manager.getControls()

// 设置相机位置
camera.position.set(10, 10, 10)
camera.lookAt(0, 0, 0)

// 设置控制器目标
controls.target.set(0, 0, 0)
controls.update()

// 平滑过渡函数
function flyTo(targetPosition: THREE.Vector3, lookAt: THREE.Vector3) {
  const startPos = camera.position.clone()
  const startTarget = controls.target.clone()

  let progress = 0

  function update() {
    progress += 0.02
    if (progress > 1) progress = 1

    camera.position.lerpVectors(startPos, targetPosition, progress)
    controls.target.lerpVectors(startTarget, lookAt, progress)
    controls.update()

    if (progress < 1) {
      requestAnimationFrame(update)
    }
  }

  update()
}
```

## 状态管理 (Vue)

```vue
<script setup>
import { ref, watch } from 'vue'

const manager = ref(null)
const highlightedId = ref(null)

watch(highlightedId, (newId, oldId) => {
  if (oldId) {
    const oldObj = manager.value?.getObjectByUUID(oldId)
    if (oldObj) resetHighlight(oldObj)
  }

  if (newId) {
    const newObj = manager.value?.getObjectByUUID(newId)
    if (newObj) applyHighlight(newObj)
  }
})

function applyHighlight(obj) {
  obj.traverse((child) => {
    if (child.material) {
      child.userData.originalColor = child.material.color.getHex()
      child.material.emissive?.setHex(0x333333)
    }
  })
}
</script>
```
