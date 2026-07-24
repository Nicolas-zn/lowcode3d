<script setup lang="ts">
/**
 * 左侧边栏组件
 * 包含场景树、模型库、材质库、灯光库等面板
 */
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { ElMessageBox, ElMessage, ElLoading } from 'element-plus'
import ModelLibrary from '@/components/sidebar/ModelLibrary.vue'
import MaterialLibrary from '@/components/sidebar/MaterialLibrary.vue'
import LightLibrary from '@/components/sidebar/LightLibrary.vue'
import ComponentLibrary from '@/components/sidebar/ComponentLibrary.vue'
import AnnotationLibrary from '@/components/sidebar/AnnotationLibrary.vue'
import SceneTree from '@/components/sidebar/SceneTree.vue'
import EditorSidebarNav from '@/components/common/EditorSidebarNav.vue'
import EditorPanelShell from '@/components/common/EditorPanelShell.vue'
import EditorPanelHeader from '@/components/common/EditorPanelHeader.vue'
import { editorIcons } from '@/constants/editorIcons'
import type { IModelLibraryItem } from '@/stores/resourceStore'
import type { LightType } from '@/engine/lights'
import { getLightManager, getEngine, getModelLoader, getCommandBus, eventBus } from '@/engine'
import { markModelRootForSelection } from '@/engine/utils/modelSelection'
import * as THREE from 'three'
import type { LeftSidebarTab } from '@/engine/events/EventTypes'

const commandBus = getCommandBus()

// 当前激活的标签页
const activeTab = ref<LeftSidebarTab>('scene')

interface EditorSidebarNavItem {
  id: LeftSidebarTab
  label: string
  icon: string
  tooltip: string
}

const sidebarTabs: EditorSidebarNavItem[] = [
  { id: 'scene', label: '场景', icon: editorIcons.scene, tooltip: '场景' },
  { id: 'models', label: '模型', icon: editorIcons.model, tooltip: '模型库' },
  { id: 'materials', label: '材质', icon: editorIcons.material, tooltip: '材质库' },
  { id: 'components', label: '组件', icon: editorIcons.component, tooltip: '组件库' },
  { id: 'annotations', label: '标注', icon: editorIcons.annotation, tooltip: '场景标注' },
  { id: 'lights', label: '灯光', icon: editorIcons.light, tooltip: '灯光库' },
]

function handleOpenTab(payload: { tab: LeftSidebarTab }) {
  activeTab.value = payload.tab
}

/**
 * 创建基础几何体
 */
function createPrimitive(type: string, position: THREE.Vector3): THREE.Object3D | null {
  let geometry: THREE.BufferGeometry
  let material: THREE.Material

  switch (type) {
    case 'box':
      geometry = new THREE.BoxGeometry(1, 1, 1)
      break
    case 'cube':
      geometry = new THREE.BoxGeometry(1, 1, 1)
      break
    case 'sphere':
      geometry = new THREE.SphereGeometry(0.5, 32, 16)
      break
    case 'cylinder':
      geometry = new THREE.CylinderGeometry(0.5, 0.5, 1, 32)
      break
    case 'plane':
      geometry = new THREE.PlaneGeometry(1, 1)
      break
    case 'cone':
      geometry = new THREE.ConeGeometry(0.5, 1, 32)
      break
    case 'torus':
      geometry = new THREE.TorusGeometry(0.5, 0.2, 16, 32)
      break
    case 'circle':
      geometry = new THREE.CircleGeometry(0.5, 32)
      break
    case 'ring':
      geometry = new THREE.RingGeometry(0.3, 0.5, 32)
      break
    case 'tetrahedron':
      geometry = new THREE.TetrahedronGeometry(0.65, 0)
      break
    case 'octahedron':
      geometry = new THREE.OctahedronGeometry(0.65, 0)
      break
    case 'icosahedron':
      geometry = new THREE.IcosahedronGeometry(0.65, 0)
      break
    case 'dodecahedron':
      geometry = new THREE.DodecahedronGeometry(0.65, 0)
      break
    default:
      console.warn('Unknown primitive type:', type)
      return null
  }

  material = new THREE.MeshStandardMaterial({ color: 0x888888 })
  if (type === 'plane' || type === 'circle' || type === 'ring') {
    material.side = THREE.DoubleSide
  }
  const mesh = new THREE.Mesh(geometry, material)

  mesh.position.copy(position)
  mesh.castShadow = true
  mesh.receiveShadow = true
  mesh.userData.selectable = true

  return mesh
}

// 处理场景树选择
const handleSceneSelect = (uuid: string) => {
  console.log('Scene object selected:', uuid)
}

// 处理模型选择（双击添加到场景原点）
const handleModelSelect = async (item: IModelLibraryItem) => {
  const engine = getEngine()
  if (!engine?.isInitialized) {
    ElMessage.error('引擎未初始化')
    return
  }

  const position = new THREE.Vector3(0, 0, 0) // 添加到原点

  try {
    // 检查是否是基础形状
    if (item.url.startsWith('__primitive__:')) {
      const primitiveType = item.url.replace('__primitive__:', '')
      const object = createPrimitive(primitiveType, position)
      if (object) {
        commandBus.addObject(object, {
          name: item.name,
          type: 'mesh',
        })
        ElMessage.success(`已添加 ${item.name} 到场景原点`)
      }
      return
    }

    // 加载外部模型
    const loading = ElLoading.service({
      text: `正在加载 ${item.name}...`,
      background: 'rgba(0, 0, 0, 0.5)',
    })

    try {
      const modelLoader = getModelLoader()
      const result = await modelLoader.loadModel(item.url)

      // 克隆模型（以便多次放置）
      const model = result.model.clone()
      model.position.copy(position)

      // 计算模型的包围盒来调整位置
      const box = new THREE.Box3().setFromObject(model)
      const size = box.getSize(new THREE.Vector3())
      model.position.y = size.y / 2 // 调整 Y 位置使底部在地面

      // 设置模型根节点属性，点击子 Mesh 时默认选择整体模型
      markModelRootForSelection(model, {
        name: item.name,
        modelUrl: item.url,
        libraryId: item.id,
      })

      // 遍历所有子对象，设置阴影
      model.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.castShadow = true
          child.receiveShadow = true
        }
      })

      // 添加到场景
      commandBus.addObject(model, {
        name: item.name,
        type: 'model',
      })

      ElMessage.success(`已添加 ${item.name} 到场景原点`)
    } catch (error) {
      console.error('Failed to load model:', error)
      ElMessage.error(`加载模型失败: ${item.name}`)
    } finally {
      loading.close()
    }
  } catch (error) {
    console.error('Error adding model:', error)
    ElMessage.error('添加模型失败')
  }
}

// 处理模型拖拽开始
const handleModelDragStart = (item: IModelLibraryItem) => {
  console.log('Drag started:', item)
}

// 处理灯光选择（双击添加到场景）
const handleLightSelect = (type: LightType) => {
  const engine = getEngine()
  if (!engine?.isInitialized) return

  const lightManager = getLightManager()
  const light = lightManager.createLight(type, {
    position: { x: 0, y: 5, z: 0 },
  })

  // 将灯光添加到对象管理器
  commandBus.addObject(light, {
    name: light.name,
    type: type === 'ambient' ? 'light' : 'light',
  })

  console.log('Light created:', light.name)
}

// 处理灯光拖拽开始
const handleLightDragStart = (type: LightType) => {
  console.log('Light drag started:', type)
}

// 处理组件拖拽开始
const handleComponentDragStart = (type: string) => {
  console.log('Component drag started:', type)
}

// 清空场景
async function handleClearScene() {
  try {
    await ElMessageBox.confirm('确定要清空场景中的所有对象吗？此操作不可恢复。', '清空场景', {
      confirmButtonText: '确定清空',
      cancelButtonText: '取消',
      type: 'warning',
    })

    const engine = getEngine()
    if (!engine?.isInitialized) {
      ElMessage.error('引擎未初始化')
      return
    }

    // 清空选中
    engine.selectionManager.clearSelection()

    // 清空对象管理器中的所有对象（保留默认灯光）
    const objectsToRemove: string[] = []
    for (const entry of engine.objectManager.getAll()) {
      // 保留默认灯光和不可选择的对象
      if (entry.object.name?.includes('Default') || entry.object.userData.selectable === false) {
        continue
      }
      objectsToRemove.push(entry.object.uuid)
    }

    // 移除对象
    objectsToRemove.forEach((uuid) => {
      commandBus.removeObject(uuid)
    })

    ElMessage.success(`已清空 ${objectsToRemove.length} 个对象`)
  } catch (error) {
    // 用户取消
    if (error !== 'cancel') {
      console.error('Clear scene error:', error)
    }
  }
}

onMounted(() => {
  eventBus.on('editor:open-left-tab', handleOpenTab)
})

onBeforeUnmount(() => {
  eventBus.off('editor:open-left-tab', handleOpenTab)
})
</script>

<template>
  <aside class="left-sidebar">
    <EditorSidebarNav v-model="activeTab" :items="sidebarTabs" />

    <EditorPanelShell class="sidebar-main">
      <template #header>
        <EditorPanelHeader
          :title="
            activeTab === 'scene'
              ? '场景'
              : activeTab === 'models'
                ? '模型库'
                : activeTab === 'materials'
                  ? '材质库'
                  : activeTab === 'components'
                    ? '组件库'
                    : activeTab === 'annotations'
                      ? '场景标注'
                      : '灯光库'
          "
          :icon="
            activeTab === 'scene'
              ? editorIcons.scene
              : activeTab === 'models'
                ? editorIcons.model
                : activeTab === 'materials'
                  ? editorIcons.material
                  : activeTab === 'components'
                    ? editorIcons.component
                    : activeTab === 'annotations'
                      ? editorIcons.annotation
                      : editorIcons.light
          "
        >
          <template #actions>
            <el-button
              v-if="activeTab === 'scene'"
              size="small"
              type="warning"
              @click="handleClearScene"
            >
              清空场景
            </el-button>
          </template>
        </EditorPanelHeader>
      </template>

      <div class="sidebar-content">
        <!-- 场景树 -->
        <template v-if="activeTab === 'scene'">
          <SceneTree ref="sceneTreeRef" :show-actions="true" @select="handleSceneSelect" />
        </template>

        <!-- 模型库 -->
        <template v-else-if="activeTab === 'models'">
          <ModelLibrary
            :show-categories="true"
            @select="handleModelSelect"
            @drag-start="handleModelDragStart"
          />
        </template>

        <!-- 材质库 -->
        <template v-else-if="activeTab === 'materials'">
          <MaterialLibrary />
        </template>

        <!-- 组件库 -->
        <template v-else-if="activeTab === 'components'">
          <ComponentLibrary @drag-start="handleComponentDragStart" />
        </template>

        <!-- 内置标注库 -->
        <template v-else-if="activeTab === 'annotations'">
          <AnnotationLibrary />
        </template>

        <!-- 灯光库 -->
        <template v-else-if="activeTab === 'lights'">
          <LightLibrary @select="handleLightSelect" @drag-start="handleLightDragStart" />
        </template>
      </div>
    </EditorPanelShell>
  </aside>
</template>

<style scoped lang="scss">
.left-sidebar {
  display: flex;
  flex-direction: row;
  background-color: var(--el-bg-color);
  border-right: 1px solid var(--el-border-color-lighter);
  overflow: hidden;
}

// 左侧图标导航栏
.sidebar-nav {
  display: flex;
  flex-direction: column;
  width: 48px;
  flex-shrink: 0;
  background-color: var(--el-bg-color-page);
  border-right: 1px solid var(--el-border-color-lighter);
  padding: 8px 0;
}

.nav-item {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  cursor: pointer;
  color: var(--el-text-color-secondary);
  position: relative;
  transition: all 0.2s ease;

  &:hover {
    color: var(--el-text-color-primary);
    background-color: var(--el-fill-color-light);
  }

  &.active {
    color: var(--el-color-primary);
    background-color: var(--el-fill-color);

    // 左侧激活指示条
    &::before {
      content: '';
      position: absolute;
      left: 0;
      top: 50%;
      transform: translateY(-50%);
      width: 3px;
      height: 24px;
      background-color: var(--el-color-primary);
      border-radius: 0 3px 3px 0;
    }
  }
}

// 右侧主内容区
.sidebar-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  overflow: hidden;
}

// 面板标题
.sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 42px;
  padding: 0 12px;
  font-size: 13px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  background-color: var(--el-bg-color-page);
  border-bottom: 1px solid var(--el-border-color-lighter);
  flex-shrink: 0;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-left: auto;
}

.sidebar-content {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
  background-color: var(--el-bg-color);
}

.scene-tree-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.scene-tree {
  background-color: transparent;

  :deep(.el-tree-node__content) {
    height: 32px;
    border-radius: 4px;

    &:hover {
      background-color: var(--el-fill-color-light);
    }
  }

  :deep(.el-tree-node.is-current > .el-tree-node__content) {
    background-color: var(--el-color-primary-light-9);
  }

  .tree-node {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;

    .node-icon {
      color: var(--el-text-color-secondary);
    }
  }
}

.asset-library {
  .search-input {
    margin-bottom: 12px;
  }
}

.asset-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;

  &.columns-2 {
    grid-template-columns: repeat(2, 1fr);
  }
}

.asset-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 12px 8px;
  background-color: var(--el-fill-color-light);
  border: 1px solid transparent;
  border-radius: 8px;
  cursor: grab;
  transition: all 0.2s ease;
  user-select: none;

  &:hover {
    background-color: var(--el-fill-color);
    border-color: var(--el-border-color-light);
    transform: translateY(-2px);
    box-shadow: var(--el-box-shadow-light);
  }

  &:active {
    cursor: grabbing;
    transform: translateY(0);
  }

  &.is-selected {
    background-color: var(--el-color-primary-light-9);
    border-color: var(--el-color-primary);
  }

  .asset-preview {
    width: 100%;
    aspect-ratio: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--el-text-color-secondary);
    margin-bottom: 6px;
  }

  .asset-name {
    font-size: 12px;
    color: var(--el-text-color-primary);
    text-align: center;
    font-weight: 500;
  }
}

.placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 200px;
  color: var(--el-text-color-placeholder);

  p {
    margin-top: 12px;
    font-size: 14px;
  }
}
</style>
