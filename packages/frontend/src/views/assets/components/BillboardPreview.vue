<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { BillboardMode } from '@/engine/objects/BillboardComponent'
import type { BillboardAnimationType } from '@/engine/objects/BillboardComponent'

const props = defineProps<{
  frontUrl: string
  backUrl: string
  width: number
  height: number
  mode?: BillboardMode
  animation?: BillboardAnimationType
  repeat?: [number, number]
  isVideo?: boolean
}>()

const containerRef = ref<HTMLDivElement | null>(null)
let scene: THREE.Scene
let camera: THREE.PerspectiveCamera
let renderer: THREE.WebGLRenderer
let controls: OrbitControls
let group: THREE.Group
let frontMesh: THREE.Mesh
let backMesh: THREE.Mesh
let animationId: number
let resizeObserver: ResizeObserver
let videoElements: HTMLVideoElement[] = []
let rebuildTimer: ReturnType<typeof setTimeout> | null = null

const clock = new THREE.Clock()
let time = 0
let baseY = 0
const baseScale = new THREE.Vector3(1, 1, 1)

function animate() {
  animationId = requestAnimationFrame(animate)
  controls.update()

  const dt = clock.getDelta()
  time += dt

  if (group && camera) {
    // 1. 处理动画
    if (props.animation === 'FLOAT') {
      const amplitude = 0.3
      const offset = Math.sin(time * 2) * amplitude
      group.position.y = baseY + offset
      // 重置 scale 以防切换动画遗留
      group.scale.copy(baseScale)
    } else if (props.animation === 'SCALE') {
      const range = 0.3
      // (sin + 1)/2 => 0~1. factor => 1 ~ 1.3
      const factor = 1 + range * ((Math.sin(time * 3) + 1) / 2)
      group.scale.copy(baseScale).multiplyScalar(factor)
      // 重置 position 以防切换
      group.position.y = baseY
    } else {
      // 无动画
      group.position.y = baseY
      group.scale.copy(baseScale)
    }

    // 2. 处理朝向模式
    if (props.mode) {
      if (props.mode === BillboardMode.FULL) {
        group.quaternion.copy(camera.quaternion)
      } else if (props.mode === BillboardMode.Y_LOCK) {
        const targetPos = camera.position.clone()
        targetPos.y = group.position.y
        group.lookAt(targetPos)
      }
      // NONE 模式下不强制重置旋转，允许保持当前状态或（未来）手动旋转
    }
  }

  renderer.render(scene, camera)
}

// 初始化场景
function init() {
  if (!containerRef.value) return

  // Scene
  scene = new THREE.Scene()
  scene.background = new THREE.Color(0x333333)

  // 网格辅助
  const gridHelper = new THREE.GridHelper(10, 10, 0x888888, 0x444444)
  scene.add(gridHelper)

  // Camera - 使用默认值防止除零
  const width = containerRef.value.clientWidth || 300
  const height = containerRef.value.clientHeight || 300
  camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100)
  camera.position.set(0, 2, 5)
  camera.lookAt(0, 0, 0)

  // Renderer
  renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setSize(width, height)
  renderer.setPixelRatio(window.devicePixelRatio)
  containerRef.value.appendChild(renderer.domElement)

  // Controls
  controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true

  // Objects
  createBillboard()

  // 监听容器大小变化
  resizeObserver = new ResizeObserver((entries) => {
    for (const entry of entries) {
      if (entry.contentRect) {
        const { width, height } = entry.contentRect
        if (width && height && renderer && camera) {
          camera.aspect = width / height
          camera.updateProjectionMatrix()
          renderer.setSize(width, height)
        }
      }
    }
  })
  resizeObserver.observe(containerRef.value)

  animate()
}

// 创建广告牌
function createBillboard() {
  if (group) {
    scene.remove(group)
  }

  group = new THREE.Group()
  const geometry = new THREE.PlaneGeometry(props.width, props.height)

  // 清理旧的视频元素
  videoElements.forEach((v) => {
    v.pause()
    v.src = ''
    v.load()
  })
  videoElements = []

  // 贴图加载辅助函数
  const loadTexture = (url: string): THREE.Texture | null => {
    // 空 URL 检查
    if (!url) {
      return null
    }
    if (props.isVideo) {
      const video = document.createElement('video')
      video.src = url
      video.loop = true
      video.muted = true
      video.crossOrigin = 'anonymous'
      video.playsInline = true
      // 保存引用以便清理
      videoElements.push(video)
      // Catch play errors (though mute helps)
      video.play().catch((e) => console.warn('Preview video play failed', e))

      const tex = new THREE.VideoTexture(video)
      tex.colorSpace = THREE.SRGBColorSpace
      return tex
    } else {
      const tex = new THREE.TextureLoader().load(url)
      tex.colorSpace = THREE.SRGBColorSpace
      return tex
    }
  }

  const applyRepeat = (tex: THREE.Texture) => {
    if (props.repeat) {
      tex.repeat.set(props.repeat[0], props.repeat[1])
      if (props.repeat[0] !== 1 || props.repeat[1] !== 1) {
        tex.wrapS = THREE.RepeatWrapping
        tex.wrapT = THREE.RepeatWrapping
      } else {
        tex.wrapS = THREE.ClampToEdgeWrapping
        tex.wrapT = THREE.ClampToEdgeWrapping
      }
    }
  }

  const frontMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    side: THREE.FrontSide,
  })

  if (props.frontUrl) {
    const tex = loadTexture(props.frontUrl)
    if (tex) {
      applyRepeat(tex)
      frontMat.map = tex
      frontMat.needsUpdate = true
    }
  }

  frontMesh = new THREE.Mesh(geometry, frontMat)
  group.add(frontMesh)

  // 背面
  const backMat = new THREE.MeshBasicMaterial({
    color: 0xffffff, // 默认白色
    transparent: true,
    side: THREE.FrontSide, // 因为旋转了180度，所以用 FrontSide 即可
  })

  if (props.backUrl) {
    const tex = loadTexture(props.backUrl)
    if (tex) {
      applyRepeat(tex)
      backMat.map = tex
      backMat.needsUpdate = true
    }
  } else {
    // 如果没有背面图片，可以用正面图片的镜像或者灰色
    backMat.color.setHex(0xaaaaaa)
  }

  backMesh = new THREE.Mesh(geometry, backMat)
  backMesh.rotation.y = Math.PI
  // 稍微错开一点点防止 Z-fighting (虽然是背靠背)
  backMesh.position.z = -0.001
  group.add(backMesh)

  // 设置基准高度（中心点在 height/2）
  baseY = props.height / 2
  group.position.y = baseY

  // 重置缩放
  group.scale.set(1, 1, 1)
  baseScale.set(1, 1, 1)

  scene.add(group)
}

// 防抖重建函数
function debouncedRebuild() {
  if (rebuildTimer) {
    clearTimeout(rebuildTimer)
  }
  rebuildTimer = setTimeout(() => {
    if (scene) {
      createBillboard()
    }
  }, 100)
}

// 监听属性变化
watch(
  () => [props.width, props.height],
  () => {
    debouncedRebuild()
  }
)

watch(
  () => props.animation,
  () => {
    time = 0 // 重置动画时间
  }
)

watch(
  () => [props.frontUrl, props.backUrl, props.isVideo],
  () => {
    // 简单粗暴：重新创建
    debouncedRebuild()
  }
)

watch(
  () => props.repeat,
  (val) => {
    const updateTex = (mesh: THREE.Mesh) => {
      const mat = mesh.material as THREE.MeshBasicMaterial
      if (mat.map && val) {
        mat.map.repeat.set(val[0], val[1])
        if (val[0] !== 1 || val[1] !== 1) {
          mat.map.wrapS = THREE.RepeatWrapping
          mat.map.wrapT = THREE.RepeatWrapping
        }
        mat.map.needsUpdate = true
      }
    }
    if (frontMesh) updateTex(frontMesh)
    if (backMesh) updateTex(backMesh)
  },
  { deep: true }
)

onMounted(() => {
  // 延迟初始化，等待 Dialog 渲染
  setTimeout(() => {
    init()
  }, 100)
})

onBeforeUnmount(() => {
  if (rebuildTimer) {
    clearTimeout(rebuildTimer)
  }
  resizeObserver?.disconnect()
  cancelAnimationFrame(animationId)
  // 清理视频元素
  videoElements.forEach((v) => {
    v.pause()
    v.src = ''
    v.load()
  })
  videoElements = []
  renderer?.dispose()
  controls?.dispose()
})
</script>

<template>
  <div ref="containerRef" class="billboard-preview"></div>
</template>

<style scoped>
.billboard-preview {
  width: 100%;
  height: 300px;
  background-color: #333;
  border-radius: 4px;
  overflow: hidden;
  /* 防止 canvas 撑开 */
}
</style>
