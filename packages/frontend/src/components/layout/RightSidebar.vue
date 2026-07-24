<script setup lang="ts">
/**
 * 右侧属性面板
 * 显示和编辑选中对象的属性
 */
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { Box, Delete, MagicStick, RefreshLeft, Sunny, VideoCamera } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import * as THREE from 'three'
import { useSelectionStore } from '@/stores/selectionStore'
import { useEditorStore } from '@/stores/editorStore'
import { getCommandBus, getEngine, eventBus } from '@/engine'
import { LightManager } from '@/engine/lights'
import MaterialPanel from '@/components/properties/MaterialPanel.vue'
import LightPanel from '@/components/properties/LightPanel.vue'
import EnvironmentPanel from '@/components/properties/EnvironmentPanel.vue'
import PostProcessingPanel from '@/components/properties/PostProcessingPanel.vue'
import VideoPanel from '@/components/properties/VideoPanel.vue'
import EventPanel from '@/components/properties/EventPanel.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import EditorPanelHeader from '@/components/common/EditorPanelHeader.vue'
import EditorIconButton from '@/components/common/EditorIconButton.vue'
import EditorSection from '@/components/common/EditorSection.vue'
import AxisInputGroup from '@/components/common/AxisInputGroup.vue'
import { editorIcons } from '@/constants/editorIcons'

// 环境设置 tab
const environmentTab = ref('environment')

// Store
const selectionStore = useSelectionStore()
const editorStore = useEditorStore()
const commandBus = getCommandBus()

// 当前选中的 Three.js 对象
const selectedObject = ref<THREE.Object3D | null>(null)

// 当前展开的折叠面板
const activeCollapse = ref(['transform', 'material', 'light', 'render', 'events', 'environment'])

// 是否选中灯光
const isLight = computed(() => {
  return selectedObject.value && LightManager.isLight(selectedObject.value)
})

// 是否选中网格
const isMesh = computed(() => {
  return selectedObject.value instanceof THREE.Mesh
})

// 获取材质类型名称
const materialTypeName = computed(() => {
  if (!(selectedObject.value instanceof THREE.Mesh)) return ''
  const material = selectedObject.value.material
  if (Array.isArray(material)) {
    return material.length > 0 ? material[0].type : ''
  }
  return material?.type || ''
})

// 是否是加载的模型或其子对象（不可修改名称）
// 包括用户导入的模型和从模型库加载的模型
const isLoadedModel = computed(() => {
  let current: THREE.Object3D | null = selectedObject.value
  while (current) {
    // 检查是否是用户导入的模型
    if (current.userData.isUserImported === true) {
      return true
    }
    // 检查是否是从模型库加载的模型
    if (current.userData.modelUrl || current.userData.libraryId) {
      return true
    }
    current = current.parent
  }
  return false
})

// 对象属性
const objectName = ref('')
const objectType = ref('')
const position = ref({ x: 0, y: 0, z: 0 })
const rotation = ref({ x: 0, y: 0, z: 0 })
const scale = ref({ x: 1, y: 1, z: 1 })
const visible = ref(true)
const locked = ref(false)
const castShadow = ref(true)
const receiveShadow = ref(true)

type Axis = 'x' | 'y' | 'z'
type AxisValue = number | null
type ObjectMenuCommand = 'duplicate' | 'delete' | 'reset-transform' | 'publish-check'

const multiPosition = ref<Record<Axis, AxisValue>>({ x: null, y: null, z: null })
const multiRotation = ref<Record<Axis, AxisValue>>({ x: null, y: null, z: null })
const multiScale = ref<Record<Axis, AxisValue>>({ x: null, y: null, z: null })

// 是否有选中对象
const hasSelection = computed(() => selectedObject.value !== null)
const selectionCount = computed(() => selectionStore.selectedIds.length)
const hasMultiSelection = computed(() => selectionCount.value > 1)

/**
 * 从 Three.js 对象同步属性到 UI
 */
function syncFromObject(object: THREE.Object3D): void {
  objectName.value = object.name || 'Unnamed'
  objectType.value = getObjectType(object)

  position.value = {
    x: parseFloat(object.position.x.toFixed(3)),
    y: parseFloat(object.position.y.toFixed(3)),
    z: parseFloat(object.position.z.toFixed(3)),
  }

  rotation.value = {
    x: parseFloat(THREE.MathUtils.radToDeg(object.rotation.x).toFixed(1)),
    y: parseFloat(THREE.MathUtils.radToDeg(object.rotation.y).toFixed(1)),
    z: parseFloat(THREE.MathUtils.radToDeg(object.rotation.z).toFixed(1)),
  }

  scale.value = {
    x: parseFloat(object.scale.x.toFixed(3)),
    y: parseFloat(object.scale.y.toFixed(3)),
    z: parseFloat(object.scale.z.toFixed(3)),
  }

  visible.value = object.visible
  locked.value = object.userData.locked === true

  if (object instanceof THREE.Mesh) {
    castShadow.value = object.castShadow
    receiveShadow.value = object.receiveShadow
  }
}

/**
 * 获取对象类型标签
 */
function getObjectType(object: THREE.Object3D): string {
  if (object instanceof THREE.Mesh) return 'Mesh'
  if (object instanceof THREE.Group) return 'Group'
  if (object instanceof THREE.Light) return 'Light'
  if (object instanceof THREE.Camera) return 'Camera'
  return 'Object'
}

function getSceneObjectType(
  object: THREE.Object3D
): 'mesh' | 'group' | 'light' | 'camera' | 'model' {
  if (object instanceof THREE.Mesh) return 'mesh'
  if (object instanceof THREE.Group) return 'group'
  if (object instanceof THREE.Light) return 'light'
  if (object instanceof THREE.Camera) return 'camera'
  return 'model'
}

/**
 * 更新对象名称
 */
function handleNameChange(name: string): void {
  if (selectedObject.value && selectedObject.value.name !== name) {
    commandBus.changeObjectName(selectedObject.value, name)
  }
}

/**
 * 更新位置
 */
function handlePositionChange(): void {
  if (selectedObject.value) {
    const nextPosition = new THREE.Vector3(position.value.x, position.value.y, position.value.z)
    if (!selectedObject.value.position.equals(nextPosition)) {
      commandBus.transformObject(selectedObject.value, { position: nextPosition })
    }
  }
}

/**
 * 更新旋转
 */
function handleRotationChange(): void {
  if (selectedObject.value) {
    const nextRotation = new THREE.Euler(
      THREE.MathUtils.degToRad(rotation.value.x),
      THREE.MathUtils.degToRad(rotation.value.y),
      THREE.MathUtils.degToRad(rotation.value.z),
      selectedObject.value.rotation.order
    )
    if (
      Math.abs(selectedObject.value.rotation.x - nextRotation.x) > 0.0001 ||
      Math.abs(selectedObject.value.rotation.y - nextRotation.y) > 0.0001 ||
      Math.abs(selectedObject.value.rotation.z - nextRotation.z) > 0.0001
    ) {
      commandBus.transformObject(selectedObject.value, { rotation: nextRotation })
    }
  }
}

/**
 * 更新缩放
 */
function handleScaleChange(): void {
  if (selectedObject.value) {
    const nextScale = new THREE.Vector3(scale.value.x, scale.value.y, scale.value.z)
    if (!selectedObject.value.scale.equals(nextScale)) {
      commandBus.transformObject(selectedObject.value, { scale: nextScale })
    }
  }
}

/**
 * 更新可见性
 */
function handleVisibleChange(value: string | number | boolean): void {
  if (selectedObject.value && typeof value === 'boolean') {
    commandBus.changeObjectVisible(selectedObject.value, value)
    visible.value = value
  }
}

function handleLockToggle(): void {
  if (selectedObject.value) {
    commandBus.changeObjectLocked(selectedObject.value, !locked.value)
    locked.value = !locked.value
  }
}

function handleFocusSelected(): void {
  const engine = getEngine()
  if (engine && selectedObject.value) {
    engine.cameraManager.focusOnObject(selectedObject.value)
  }
}

function duplicateSelectedObject(): void {
  const object = selectedObject.value
  if (!object) return
  if (locked.value) {
    ElMessage.warning('对象已锁定，无法复制')
    return
  }

  const clone = object.clone(true)
  clone.name = `${object.name || object.type} 副本`
  clone.position.x += 0.5
  clone.userData = {
    ...object.userData,
    selectable: object.userData.selectable !== false,
  }

  commandBus.addObject(clone, {
    name: clone.name,
    type: getSceneObjectType(clone),
  })

  const engine = getEngine()
  if (engine?.isInitialized) {
    engine.selectionManager.select(clone)
  }

  ElMessage.success('已复制对象')
}

function resetSelectedTransform(): void {
  const object = selectedObject.value
  if (!object) return
  if (locked.value) {
    ElMessage.warning('对象已锁定，无法重置 Transform')
    return
  }

  commandBus.transformObject(object, {
    position: new THREE.Vector3(0, 0, 0),
    rotation: new THREE.Euler(0, 0, 0, object.rotation.order),
    scale: new THREE.Vector3(1, 1, 1),
  })
  syncFromObject(object)
  ElMessage.success('已重置 Transform')
}

async function deleteSelectedObject(): Promise<void> {
  const object = selectedObject.value
  if (!object) return
  if (locked.value) {
    ElMessage.warning('对象已锁定，无法删除')
    return
  }

  try {
    await ElMessageBox.confirm(`确定要删除 "${object.name || object.type}" 吗？`, '删除确认', {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning',
    })
    commandBus.removeObject(object)
    ElMessage.success('已删除对象')
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('删除对象失败')
    }
  }
}

function handleObjectMenuCommand(command: ObjectMenuCommand): void {
  if (command === 'duplicate') {
    duplicateSelectedObject()
    return
  }
  if (command === 'delete') {
    void deleteSelectedObject()
    return
  }
  if (command === 'reset-transform') {
    resetSelectedTransform()
    return
  }
  editorStore.setBottomTab('publish', { openPanel: true })
}

function toggleInspectorSection(name: string): void {
  if (activeCollapse.value.includes(name)) {
    activeCollapse.value = activeCollapse.value.filter((item) => item !== name)
    return
  }
  activeCollapse.value = [...activeCollapse.value, name]
}

function getSelectedObjects(): THREE.Object3D[] {
  const engine = getEngine()
  if (!engine?.isInitialized) return []

  return selectionStore.selectedIds
    .map(
      (id) =>
        engine.objectManager.getObject(id) ||
        engine.sceneManager.scene.getObjectByProperty('uuid', id) ||
        null
    )
    .filter((object): object is THREE.Object3D => object !== null)
}

function getCommonNumber(
  objects: THREE.Object3D[],
  getter: (object: THREE.Object3D) => number,
  precision: number
): AxisValue {
  if (objects.length === 0) return null
  const values = objects.map((object) => Number(getter(object).toFixed(precision)))
  const first = values[0]
  return values.every((value) => Math.abs(value - first) < 1 / 10 ** precision) ? first : null
}

function syncMultiFromSelection(): void {
  const objects = getSelectedObjects()
  multiPosition.value = {
    x: getCommonNumber(objects, (object) => object.position.x, 3),
    y: getCommonNumber(objects, (object) => object.position.y, 3),
    z: getCommonNumber(objects, (object) => object.position.z, 3),
  }
  multiRotation.value = {
    x: getCommonNumber(objects, (object) => THREE.MathUtils.radToDeg(object.rotation.x), 1),
    y: getCommonNumber(objects, (object) => THREE.MathUtils.radToDeg(object.rotation.y), 1),
    z: getCommonNumber(objects, (object) => THREE.MathUtils.radToDeg(object.rotation.z), 1),
  }
  multiScale.value = {
    x: getCommonNumber(objects, (object) => object.scale.x, 3),
    y: getCommonNumber(objects, (object) => object.scale.y, 3),
    z: getCommonNumber(objects, (object) => object.scale.z, 3),
  }
}

function handleMultiPositionChange(axis: Axis, value: number | undefined): void {
  if (typeof value !== 'number') return
  const objects = getSelectedObjects()
  commandBus.transformObjects(
    `批量修改位置 ${axis.toUpperCase()}`,
    objects.map((object) => {
      const nextPosition = object.position.clone()
      nextPosition[axis] = value
      return { object, position: nextPosition }
    })
  )
  syncMultiFromSelection()
}

function handleMultiRotationChange(axis: Axis, value: number | undefined): void {
  if (typeof value !== 'number') return
  const objects = getSelectedObjects()
  commandBus.transformObjects(
    `批量修改旋转 ${axis.toUpperCase()}`,
    objects.map((object) => {
      const nextRotation = object.rotation.clone()
      nextRotation[axis] = THREE.MathUtils.degToRad(value)
      return { object, rotation: nextRotation }
    })
  )
  syncMultiFromSelection()
}

function handleMultiScaleChange(axis: Axis, value: number | undefined): void {
  if (typeof value !== 'number') return
  const objects = getSelectedObjects()
  commandBus.transformObjects(
    `批量修改缩放 ${axis.toUpperCase()}`,
    objects.map((object) => {
      const nextScale = object.scale.clone()
      nextScale[axis] = value
      return { object, scale: nextScale }
    })
  )
  syncMultiFromSelection()
}

function handleMultiVisibleChange(value: boolean): void {
  commandBus.changeProperties(
    value ? '批量显示对象' : '批量隐藏对象',
    getSelectedObjects()
      .filter((object) => object.visible !== value)
      .map((object) => ({ target: object, propertyPath: 'visible', value }))
  )
}

function handleMultiLockChange(value: boolean): void {
  commandBus.changeProperties(
    value ? '批量锁定对象' : '批量解锁对象',
    getSelectedObjects().flatMap((object) => [
      { target: object, propertyPath: 'userData.locked', value },
      { target: object, propertyPath: 'userData.selectable', value: !value },
    ])
  )
}

function handleMultiShadowChange(property: 'castShadow' | 'receiveShadow', value: boolean): void {
  commandBus.changeProperties(
    property === 'castShadow' ? '批量修改投射阴影' : '批量修改接收阴影',
    getSelectedObjects()
      .filter((object): object is THREE.Mesh => object instanceof THREE.Mesh)
      .filter((object) => object[property] !== value)
      .map((object) => ({ target: object, propertyPath: property, value }))
  )
}

function handleFocusMultiSelection(): void {
  const engine = getEngine()
  if (!engine?.isInitialized) return

  const objects = getSelectedObjects().filter((object) => object.visible)
  if (objects.length === 0) return

  const box = new THREE.Box3()
  objects.forEach((object) => box.expandByObject(object))
  if (!box.isEmpty()) {
    engine.cameraManager.focusOnBox(box)
  }
}

/**
 * 更新投射阴影
 */
function handleCastShadowChange(value: string | number | boolean): void {
  if (selectedObject.value instanceof THREE.Mesh && typeof value === 'boolean') {
    commandBus.changeProperty(selectedObject.value, 'castShadow', value)
  }
}

/**
 * 更新接收阴影
 */
function handleReceiveShadowChange(value: string | number | boolean): void {
  if (selectedObject.value instanceof THREE.Mesh && typeof value === 'boolean') {
    commandBus.changeProperty(selectedObject.value, 'receiveShadow', value)
  }
}

/**
 * 监听选择变化
 */
function updateSelectedObject(): void {
  const primaryId = selectionStore.primarySelectedId
  if (!primaryId) {
    selectedObject.value = null
    return
  }

  const engine = getEngine()
  if (!engine || !engine.isInitialized) {
    selectedObject.value = null
    return
  }

  // 检查 objectManager 和 sceneManager 是否已初始化
  if (!engine.objectManager || !engine.sceneManager) {
    selectedObject.value = null
    return
  }

  // 首先尝试从 ObjectManager 获取
  let object = engine.objectManager.getObject(primaryId)

  // 如果 ObjectManager 中没有（可能是 Alt+点击选中的子 mesh），从场景中查找
  if (!object && engine.sceneManager.scene) {
    object = engine.sceneManager.scene.getObjectByProperty('uuid', primaryId) ?? undefined
  }

  if (object) {
    selectedObject.value = object
    syncFromObject(object)
  } else {
    selectedObject.value = null
  }
}

function handleTransformUpdate(_payload: { objectId?: string }): void {
  if (selectedObject.value) {
    syncFromObject(selectedObject.value)
  }
}

function handlePropertyUpdate(): void {
  if (selectedObject.value) {
    syncFromObject(selectedObject.value)
  }
}

watch(() => selectionStore.primarySelectedId, updateSelectedObject, { immediate: true })
watch(
  () => [...selectionStore.selectedIds],
  () => {
    updateSelectedObject()
    syncMultiFromSelection()
  },
  { immediate: true }
)

onMounted(() => {
  updateSelectedObject()
  eventBus.on('scene:transform-changed', handleTransformUpdate)
  eventBus.on('scene:property-changed', handlePropertyUpdate)
})

onBeforeUnmount(() => {
  eventBus.off('scene:transform-changed', handleTransformUpdate)
  eventBus.off('scene:property-changed', handlePropertyUpdate)
})
</script>

<template>
  <aside class="right-sidebar">
    <template v-if="hasMultiSelection">
      <EditorPanelHeader
        :icon="editorIcons.multiSelect"
        :title="`已选择 ${selectionCount} 个对象`"
        subtitle="批量编辑"
      >
        <template #actions>
          <EditorIconButton
            :icon="editorIcons.visible"
            tooltip="显示全部"
            @click="handleMultiVisibleChange(true)"
          />
          <EditorIconButton
            :icon="editorIcons.hidden"
            tooltip="隐藏全部"
            @click="handleMultiVisibleChange(false)"
          />
          <EditorIconButton
            :icon="editorIcons.locked"
            tooltip="锁定全部"
            @click="handleMultiLockChange(true)"
          />
          <EditorIconButton
            :icon="editorIcons.focus"
            tooltip="聚焦选择"
            @click="handleFocusMultiSelection"
          />
        </template>
      </EditorPanelHeader>

      <EditorSection
        title="变换"
        :icon="editorIcons.transform"
        :open="activeCollapse.includes('transform')"
        @toggle="toggleInspectorSection('transform')"
      >
        <div class="property-group">
          <div class="property-row">
            <span class="property-label">位置</span>
            <AxisInputGroup
              v-model:x="multiPosition.x"
              v-model:y="multiPosition.y"
              v-model:z="multiPosition.z"
              placeholder="混合"
              :step="0.1"
              @update:x="(value) => handleMultiPositionChange('x', value ?? undefined)"
              @update:y="(value) => handleMultiPositionChange('y', value ?? undefined)"
              @update:z="(value) => handleMultiPositionChange('z', value ?? undefined)"
            />
          </div>
          <div class="property-row">
            <span class="property-label">旋转</span>
            <AxisInputGroup
              v-model:x="multiRotation.x"
              v-model:y="multiRotation.y"
              v-model:z="multiRotation.z"
              placeholder="混合"
              :step="5"
              @update:x="(value) => handleMultiRotationChange('x', value ?? undefined)"
              @update:y="(value) => handleMultiRotationChange('y', value ?? undefined)"
              @update:z="(value) => handleMultiRotationChange('z', value ?? undefined)"
            />
          </div>
          <div class="property-row">
            <span class="property-label">缩放</span>
            <AxisInputGroup
              v-model:x="multiScale.x"
              v-model:y="multiScale.y"
              v-model:z="multiScale.z"
              placeholder="混合"
              :step="0.1"
              :min="0.01"
              @update:x="(value) => handleMultiScaleChange('x', value ?? undefined)"
              @update:y="(value) => handleMultiScaleChange('y', value ?? undefined)"
              @update:z="(value) => handleMultiScaleChange('z', value ?? undefined)"
            />
          </div>
        </div>
      </EditorSection>

      <EditorSection
        title="批量操作"
        :icon="editorIcons.more"
        :open="activeCollapse.includes('render')"
        @toggle="toggleInspectorSection('render')"
      >
        <div class="batch-actions">
          <el-button size="small" @click="handleMultiVisibleChange(true)">显示</el-button>
          <el-button size="small" @click="handleMultiVisibleChange(false)">隐藏</el-button>
          <el-button size="small" @click="handleMultiLockChange(true)">锁定</el-button>
          <el-button size="small" @click="handleMultiLockChange(false)">解锁</el-button>
          <el-button size="small" @click="handleMultiShadowChange('castShadow', true)">
            投射阴影
          </el-button>
          <el-button size="small" @click="handleMultiShadowChange('receiveShadow', true)">
            接收阴影
          </el-button>
        </div>
      </EditorSection>
    </template>

    <template v-else-if="hasSelection">
      <EditorPanelHeader
        :icon="editorIcons.object"
        title=""
        :subtitle="isLoadedModel ? '外部模型' : objectType"
      >
        <template #title>
          <el-input
            v-model="objectName"
            size="small"
            class="object-name-input"
            :disabled="isLoadedModel"
            :placeholder="isLoadedModel ? '外部模型（不可修改）' : ''"
            @change="handleNameChange"
          />
        </template>
        <template #actions>
          <EditorIconButton
            :icon="visible ? editorIcons.visible : editorIcons.hidden"
            :tooltip="visible ? '隐藏对象' : '显示对象'"
            @click="handleVisibleChange(!visible)"
          />
          <EditorIconButton
            :icon="locked ? editorIcons.locked : editorIcons.unlocked"
            :tooltip="locked ? '解锁对象' : '锁定对象'"
            @click="handleLockToggle"
          />
          <EditorIconButton
            :icon="editorIcons.focus"
            tooltip="聚焦对象 F"
            @click="handleFocusSelected"
          />
          <el-dropdown trigger="click" @command="handleObjectMenuCommand">
            <EditorIconButton :icon="editorIcons.more" tooltip="更多" />
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="duplicate">
                  <el-icon>
                    <Box />
                  </el-icon>
                  复制对象
                </el-dropdown-item>
                <el-dropdown-item command="reset-transform">
                  <el-icon>
                    <RefreshLeft />
                  </el-icon>
                  重置 Transform
                </el-dropdown-item>
                <el-dropdown-item command="publish-check">
                  <el-icon>
                    <MagicStick />
                  </el-icon>
                  查看发布检查
                </el-dropdown-item>
                <el-dropdown-item command="delete" divided>
                  <el-icon>
                    <Delete />
                  </el-icon>
                  删除对象
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </template>
      </EditorPanelHeader>

      <EditorSection
        title="变换"
        :icon="editorIcons.transform"
        :open="activeCollapse.includes('transform')"
        @toggle="toggleInspectorSection('transform')"
      >
        <div class="property-group">
          <div class="property-row">
            <span class="property-label">位置</span>
            <AxisInputGroup
              v-model:x="position.x"
              v-model:y="position.y"
              v-model:z="position.z"
              @change="handlePositionChange"
            />
          </div>
          <div class="property-row">
            <span class="property-label">旋转</span>
            <AxisInputGroup
              v-model:x="rotation.x"
              v-model:y="rotation.y"
              v-model:z="rotation.z"
              :step="5"
              @change="handleRotationChange"
            />
          </div>
          <div class="property-row">
            <span class="property-label">缩放</span>
            <AxisInputGroup
              v-model:x="scale.x"
              v-model:y="scale.y"
              v-model:z="scale.z"
              :step="0.1"
              :min="0.01"
              @change="handleScaleChange"
            />
          </div>
        </div>
      </EditorSection>

      <!-- 属性面板 -->
      <el-collapse v-model="activeCollapse" class="property-collapse">
        <!-- 灯光属性（仅灯光显示） -->
        <el-collapse-item v-if="isLight" title="灯光" name="light">
          <LightPanel :object="selectedObject" />
        </el-collapse-item>

        <!-- 材质属性（仅网格显示） -->
        <el-collapse-item v-if="isMesh" name="material">
          <template #title>
            材质<span v-if="materialTypeName" class="material-type-label">
              - {{ materialTypeName }}</span
            >
          </template>
          <MaterialPanel :object="selectedObject" />
        </el-collapse-item>

        <!-- 渲染属性（仅网格显示） -->
        <el-collapse-item v-if="isMesh" title="渲染" name="render">
          <div class="property-group">
            <div class="property-row inline">
              <el-checkbox v-model="visible" @change="handleVisibleChange"> 可见 </el-checkbox>
            </div>
            <div class="property-row inline">
              <el-checkbox v-model="castShadow" @change="handleCastShadowChange">
                投射阴影
              </el-checkbox>
              <el-checkbox v-model="receiveShadow" @change="handleReceiveShadowChange">
                接收阴影
              </el-checkbox>
            </div>
          </div>
        </el-collapse-item>

        <!-- 数据绑定 -->
        <el-collapse-item title="数据" name="data">
          <div class="property-group">
            <EmptyState
              compact
              :icon="MagicStick"
              title="未绑定数据"
              description="后续可在这里绑定数据源、字段映射和状态规则。"
            />
          </div>
        </el-collapse-item>

        <!-- 事件属性 -->
        <el-collapse-item title="交互事件" name="events">
          <EventPanel :object="selectedObject" />
        </el-collapse-item>
      </el-collapse>
    </template>

    <!-- 无选中状态 - 显示环境设置、后处理和视频录制 -->
    <template v-else>
      <EmptyState
        compact
        :icon="Sunny"
        title="请选择对象"
        description="未选择对象时，可在这里调整场景环境、后处理和录制设置。"
      />
      <el-tabs v-model="environmentTab" class="environment-tabs">
        <el-tab-pane name="environment">
          <template #label>
            <span class="tab-label">
              <el-icon>
                <Sunny />
              </el-icon>
              环境
            </span>
          </template>
          <EnvironmentPanel />
        </el-tab-pane>
        <el-tab-pane name="postprocessing">
          <template #label>
            <span class="tab-label">
              <el-icon>
                <MagicStick />
              </el-icon>
              后处理
            </span>
          </template>
          <PostProcessingPanel />
        </el-tab-pane>
        <el-tab-pane name="video">
          <template #label>
            <span class="tab-label">
              <el-icon>
                <VideoCamera />
              </el-icon>
              录制
            </span>
          </template>
          <VideoPanel />
        </el-tab-pane>
      </el-tabs>
    </template>
  </aside>
</template>

<style scoped lang="scss">
.right-sidebar {
  min-width: 0;
  display: flex;
  flex-direction: column;
  background-color: var(--lc-bg-panel);
  border-left: 1px solid var(--lc-border-subtle);
  overflow-y: auto;
  overflow-x: hidden;
  font-size: 14px;

  :deep(*) {
    box-sizing: border-box;
  }

  :deep(.editor-panel-header__title .el-input) {
    width: 100%;
    min-width: 0;
  }

  :deep(.editor-panel-header__title .el-input__inner) {
    font-size: 14px;
    font-weight: 600;
  }

  :deep(.editor-icon-button__trigger) {
    width: 30px;
    height: 30px;
  }
}

.object-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
  border-bottom: 1px solid var(--lc-border-subtle);
  background-color: var(--lc-bg-panel-raised);

  .object-type-icon {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--lc-accent);
    background: var(--lc-bg-control);
    border: 1px solid var(--lc-border-subtle);
    border-radius: var(--lc-radius-md);
  }

  .object-title {
    flex: 1;
    min-width: 0;
  }

  .object-name-input {
    width: 100%;
  }

  .object-type-label {
    display: block;
    margin-top: 3px;
    color: var(--lc-text-muted);
    font-size: 11px;
  }

  .multi-title {
    color: var(--lc-text-primary);
    font-size: 13px;
    font-weight: 600;
  }

  .object-actions {
    display: flex;
    align-items: center;
    gap: 2px;
    flex-shrink: 0;
  }

  .icon-action {
    width: 28px;
    height: 28px;
    padding: 0;
    color: var(--lc-text-secondary);
    border-radius: var(--lc-radius-sm);

    &:hover {
      color: var(--lc-text-primary);
      background: var(--lc-bg-control-hover);
    }
  }
}

.property-collapse {
  border: none;
  background: transparent;

  :deep(.el-collapse-item__header) {
    min-width: 0;
    height: 40px;
    background-color: var(--lc-panel-section-bg);
    border-bottom: 1px solid var(--lc-border-subtle);
    padding: 0 12px;
    font-size: 14px;
    font-weight: 600;
    color: var(--lc-text-primary);

    &:hover {
      color: var(--lc-accent-hover);
      background: var(--lc-bg-control-hover);
    }

    &.is-active {
      color: var(--lc-accent);
    }
  }

  :deep(.el-collapse-item__content) {
    padding: 0;
    background-color: transparent;
  }

  :deep(.el-collapse-item__wrap) {
    background: transparent;
    border-bottom: 1px solid var(--lc-border-subtle);
  }

  :deep(.el-collapse-item__arrow) {
    color: var(--lc-text-muted);
  }

  :deep(.el-collapse-item__content > .property-group) {
    padding: 12px;
  }
}

.property-group {
  min-width: 0;
  padding: 12px;
}

.property-row {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;

  &:last-child {
    margin-bottom: 0;
  }

  &.inline {
    gap: 16px;
  }

  .property-label {
    width: 44px;
    flex-shrink: 0;
    font-size: 13px;
    font-weight: 600;
    color: var(--lc-text-secondary);
  }

  .property-inputs {
    min-width: 0;
    flex: 1;
    display: flex;
    gap: 6px;

    .el-input-number {
      flex: 1;
      min-width: 0;

      :deep(.el-input__inner) {
        text-align: center;
      }
    }
  }

  .el-slider {
    flex: 1;
    margin-left: 8px;
  }
}

.full-width {
  width: 100%;
}

.batch-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  padding: 12px;

  .el-button {
    width: 100%;
    margin-left: 0;
    font-size: 13px;
    border-color: var(--lc-border-subtle);
    background: var(--lc-bg-control);
  }
}

.no-selection {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 300px;
  color: var(--el-text-color-placeholder);

  p {
    margin-top: 12px;
    font-size: 14px;
  }
}

.environment-section {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.section-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
  background-color: var(--el-bg-color-page);
  border-bottom: 1px solid var(--el-border-color-light);
  font-size: 13px;
  font-weight: 600;
  color: var(--el-text-color-primary);

  .el-icon {
    color: var(--el-color-primary);
  }
}

.environment-tabs {
  min-width: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  margin-top: 8px;

  :deep(.el-tabs__header) {
    margin: 0;
    background-color: var(--lc-bg-panel-raised);
    border-bottom: 1px solid var(--lc-border-subtle);
  }

  :deep(.el-tabs__nav-scroll) {
    padding-left: 12px;
  }

  :deep(.el-tabs__content) {
    min-width: 0;
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
  }

  :deep(.el-tab-pane) {
    height: 100%;
  }

  .tab-label {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 14px;
    font-weight: 600;
  }
}

.material-type-label {
  font-size: 11px;
  font-weight: 400;
  color: var(--el-text-color-secondary);
}
</style>
