<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import type { Asset } from '@/api/assets'
import { assetsApi } from '@/api'
import { ElMessage } from 'element-plus'

const props = defineProps<{
  modelValue: boolean
  asset: Asset | null
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'cover-updated', asset: Asset): void
}>()

const canvasHost = ref<HTMLDivElement>()
const isLoading = ref(false)
const isSettingCover = ref(false)
const loadError = ref('')

let renderer: THREE.WebGLRenderer | null = null
let scene: THREE.Scene | null = null
let camera: THREE.PerspectiveCamera | null = null
let controls: OrbitControls | null = null
let animationFrame = 0

watch(
  () => props.modelValue,
  async (visible) => {
    if (visible) {
      await nextTick()
      await loadPreview()
    } else {
      disposePreview()
    }
  }
)

watch(
  () => props.asset?.url,
  async () => {
    if (props.modelValue) {
      await nextTick()
      await loadPreview()
    }
  }
)

onBeforeUnmount(() => {
  disposePreview()
})

function handleClose() {
  emit('update:modelValue', false)
}

async function loadPreview() {
  disposePreview()

  if (!props.asset?.url || !canvasHost.value) return

  isLoading.value = true
  loadError.value = ''

  try {
    const width = canvasHost.value.clientWidth || 720
    const height = canvasHost.value.clientHeight || 420

    scene = new THREE.Scene()
    scene.background = new THREE.Color(0x111827)

    camera = new THREE.PerspectiveCamera(45, width / height, 0.01, 5000)
    camera.position.set(3, 2, 4)

    renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true,
    })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(width, height)
    renderer.outputColorSpace = THREE.SRGBColorSpace
    canvasHost.value.appendChild(renderer.domElement)

    controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.08
    controls.addEventListener('change', renderPreview)

    scene.add(new THREE.HemisphereLight(0xffffff, 0x334155, 1.2))
    const keyLight = new THREE.DirectionalLight(0xffffff, 1.4)
    keyLight.position.set(4, 6, 4)
    scene.add(keyLight)

    const loader = new GLTFLoader()
    const gltf = await loader.loadAsync(props.asset.url)
    const model = gltf.scene
    scene.add(model)
    fitCameraToObject(model)
    animate()
  } catch (error) {
    console.error('Model preview failed:', error)
    loadError.value = '模型预览失败，请检查 URL、文件格式或跨域配置'
  } finally {
    isLoading.value = false
  }
}

function fitCameraToObject(object: THREE.Object3D) {
  if (!camera || !controls) return

  const box = new THREE.Box3().setFromObject(object)
  const size = box.getSize(new THREE.Vector3())
  const center = box.getCenter(new THREE.Vector3())
  const maxSize = Math.max(size.x, size.y, size.z) || 1
  const distance = maxSize * 2.2

  camera.position.set(center.x + distance, center.y + distance * 0.7, center.z + distance)
  camera.near = Math.max(distance / 100, 0.01)
  camera.far = distance * 100
  camera.updateProjectionMatrix()

  controls.target.copy(center)
  controls.update()
  renderPreview()
}

function renderPreview() {
  if (!renderer || !scene || !camera) return
  renderer.render(scene, camera)
}

function animate() {
  if (!renderer || !scene || !camera) return

  controls?.update()
  renderPreview()
  animationFrame = requestAnimationFrame(animate)
}

async function handleSetCover() {
  if (!props.asset || !renderer) return

  renderPreview()

  isSettingCover.value = true
  try {
    const blob = await new Promise<Blob | null>((resolve) => {
      renderer?.domElement.toBlob(resolve, 'image/png')
    })

    if (!blob) {
      ElMessage.error('封面截图失败')
      return
    }

    const file = new File([blob], `${props.asset.name || 'model'}-cover.png`, {
      type: 'image/png',
    })
    const result = await assetsApi.updateAsset(props.asset.id, undefined, {
      thumbnail: file,
    })

    if (result.success && result.data) {
      emit('cover-updated', result.data)
      ElMessage.success('已设为模型封面')
    } else {
      ElMessage.error(result.error || '设置封面失败')
    }
  } catch (error) {
    console.error('Failed to set model cover:', error)
    ElMessage.error('设置封面失败')
  } finally {
    isSettingCover.value = false
  }
}

function disposePreview() {
  if (animationFrame) {
    cancelAnimationFrame(animationFrame)
    animationFrame = 0
  }

  controls?.dispose()
  controls = null

  if (scene) {
    scene.traverse((object) => {
      const mesh = object as THREE.Mesh
      mesh.geometry?.dispose()
      const material = mesh.material
      if (Array.isArray(material)) {
        material.forEach((item) => item.dispose())
      } else {
        material?.dispose()
      }
    })
  }

  renderer?.dispose()
  renderer?.domElement.remove()
  renderer = null
  scene = null
  camera = null
}
</script>

<template>
  <el-dialog
    :model-value="modelValue"
    :title="asset ? `预览模型：${asset.name}` : '预览模型'"
    width="820px"
    append-to-body
    class="model-preview-dialog"
    @close="handleClose"
  >
    <div class="model-preview-shell">
      <div ref="canvasHost" class="model-preview-canvas"></div>
      <div v-if="isLoading" class="model-preview-state">模型加载中...</div>
      <div v-else-if="loadError" class="model-preview-state is-error">{{ loadError }}</div>
    </div>
    <div v-if="asset" class="model-preview-meta">
      <span>{{ asset.url }}</span>
    </div>
    <template #footer>
      <el-button @click="handleClose">关闭</el-button>
      <el-button
        type="primary"
        :loading="isSettingCover"
        :disabled="isLoading || !!loadError || !asset"
        @click="handleSetCover"
      >
        设为封面
      </el-button>
    </template>
  </el-dialog>
</template>

<style scoped lang="scss">
.model-preview-shell {
  position: relative;
  height: 460px;
  overflow: hidden;
  border-radius: 8px;
  background: #111827;
}

.model-preview-canvas {
  width: 100%;
  height: 100%;
}

.model-preview-state {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #cbd5e1;
  background: rgba(15, 23, 42, 0.72);
  font-size: 13px;

  &.is-error {
    color: #fecaca;
  }
}

.model-preview-meta {
  margin-top: 10px;
  color: #94a3b8;
  font-size: 12px;
  word-break: break-all;
}
</style>
