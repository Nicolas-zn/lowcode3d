<script setup lang="ts">
/**
 * 场景树组件
 * 递归显示 Three.js 场景层级结构
 */
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { Box, Search } from '@element-plus/icons-vue'
import { Icon } from '@iconify/vue'
import * as THREE from 'three'
import { getCommandBus, getEngine, eventBus } from '@/engine'
import { useSelectionStore } from '@/stores/selectionStore'
import { ElMessage, ElMessageBox } from 'element-plus'
import EmptyState from '@/components/common/EmptyState.vue'
import { setTransparentDragImage } from '@/utils/dragImage'

// Props
withDefaults(
  defineProps<{
    /** 是否显示操作按钮 */
    showActions?: boolean
  }>(),
  {
    showActions: true,
  }
)

// Emits
const emit = defineEmits<{
  (e: 'select', uuid: string): void
  (e: 'group'): void
  (e: 'ungroup'): void
}>()

// Stores
const selectionStore = useSelectionStore()
const commandBus = getCommandBus()

// 场景树节点接口
interface ISceneTreeNode {
  uuid: string
  name: string
  type: 'group' | 'mesh' | 'light' | 'camera' | 'helper' | 'unknown'
  visible: boolean
  locked: boolean
  children: ISceneTreeNode[]
  object: THREE.Object3D
}

type SceneTreeFilter = ISceneTreeNode['type'] | 'hidden' | 'locked'

// 状态
const treeData = ref<ISceneTreeNode[]>([])
const searchKeyword = ref('')
const activeFilters = ref<SceneTreeFilter[]>([])
const expandedKeys = ref<string[]>([])
const editingNodeId = ref<string | null>(null)
const editingName = ref('')
const editInputRef = ref<HTMLInputElement | null>(null)

// 拖拽状态
const draggingNode = ref<ISceneTreeNode | null>(null)
const dropTargetNode = ref<ISceneTreeNode | null>(null)
const dropPosition = ref<'before' | 'after' | 'inner' | null>(null)

const contextMenu = ref<{
  visible: boolean
  x: number
  y: number
  node: ISceneTreeNode | null
}>({
  visible: false,
  x: 0,
  y: 0,
  node: null,
})

const filterOptions: Array<{ value: SceneTreeFilter; label: string }> = [
  { value: 'group', label: '组' },
  { value: 'mesh', label: '网格' },
  { value: 'light', label: '灯光' },
  { value: 'camera', label: '相机' },
  { value: 'hidden', label: '隐藏' },
  { value: 'locked', label: '锁定' },
]

// 当前选中的节点 ID 列表（支持多选）
const selectedIds = computed(() => selectionStore.selectedIds)

const filteredTreeData = computed(() => {
  const keyword = searchKeyword.value.trim().toLowerCase()
  if (!keyword && activeFilters.value.length === 0) return treeData.value
  return filterTreeNodes(treeData.value, keyword, activeFilters.value)
})

const filteredCount = computed(() => countNodes(filteredTreeData.value))

function countNodes(nodes: ISceneTreeNode[]): number {
  return nodes.reduce((total, node) => total + 1 + countNodes(node.children), 0)
}

function filterTreeNodes(
  nodes: ISceneTreeNode[],
  keyword: string,
  filters: SceneTreeFilter[]
): ISceneTreeNode[] {
  const result: ISceneTreeNode[] = []

  for (const node of nodes) {
    const filteredChildren = filterTreeNodes(node.children, keyword, filters)
    const searchableText = `${node.name} ${node.type} ${node.uuid.slice(-6)}`.toLowerCase()
    const matchesKeyword = !keyword || searchableText.includes(keyword)
    const matchesFilters =
      filters.length === 0 ||
      filters.some((filter) => {
        if (filter === 'hidden') return !node.visible
        if (filter === 'locked') return node.locked
        return node.type === filter
      })

    if ((matchesKeyword && matchesFilters) || filteredChildren.length > 0) {
      result.push({
        ...node,
        children: filteredChildren,
      })
    }
  }

  return result
}

function toggleFilter(filter: SceneTreeFilter): void {
  if (activeFilters.value.includes(filter)) {
    activeFilters.value = activeFilters.value.filter((item) => item !== filter)
  } else {
    activeFilters.value = [...activeFilters.value, filter]
  }
}

function clearFilters(): void {
  activeFilters.value = []
}

// 判断对象类型
function getObjectType(object: THREE.Object3D): ISceneTreeNode['type'] {
  if (object instanceof THREE.Group) return 'group'
  if (object instanceof THREE.Light) return 'light'
  if (object instanceof THREE.Camera) return 'camera'
  if (object instanceof THREE.Mesh) return 'mesh'
  if (object.name.includes('Helper')) return 'helper'
  return 'unknown'
}

// 检查是否是 TransformControls 的一部分
function isTransformControlsObject(object: THREE.Object3D): boolean {
  // 获取引擎的 TransformControls 实例
  const engine = getEngine()
  const transformControls = engine?.transformManager?.controls

  // 直接比较对象引用
  if (transformControls && object === transformControls) {
    return true
  }

  // 检查是否是 TransformControls 的子对象
  let current: THREE.Object3D | null = object
  while (current) {
    // 直接引用比较
    if (transformControls && current === transformControls) {
      return true
    }

    const type = current.type
    const ctorName = current.constructor?.name || ''
    if (
      type === 'TransformControls' ||
      type === 'TransformControlsPlane' ||
      type === 'TransformControlsGizmo' ||
      ctorName === 'TransformControls' ||
      ctorName === 'TransformControlsPlane' ||
      ctorName === 'TransformControlsGizmo'
    ) {
      return true
    }
    current = current.parent
  }
  return false
}

// 判断是否应该在树中显示
function shouldShowInTree(object: THREE.Object3D): boolean {
  // 过滤掉 TransformControls 及其所有子对象
  if (isTransformControlsObject(object)) return false

  // 过滤掉辅助对象
  if (object.name === 'GridHelper' || object.name === 'AxesHelper') return false
  if (object.name.startsWith('Default')) return false // 默认灯光

  // 过滤掉灯光 Helper（除非明确要显示）
  if (object.type.includes('Helper') && !object.userData.showInTree) return false
  if (object.name.includes('Helper') && !object.userData.showInTree) return false

  // 过滤掉灯光的 target 对象
  if (object.type === 'Object3D' && object.name === '') {
    const parent = object.parent
    if (parent && (parent.type.includes('Light') || parent.type === 'Scene')) {
      if (object.children.length === 0) {
        return false
      }
    }
  }

  return true
}

// 递归构建树节点
function buildTreeNode(object: THREE.Object3D): ISceneTreeNode | null {
  if (!shouldShowInTree(object)) return null

  const children: ISceneTreeNode[] = []
  for (const child of object.children) {
    const childNode = buildTreeNode(child)
    if (childNode) {
      children.push(childNode)
    }
  }

  return {
    uuid: object.uuid,
    name: object.name || `Unnamed_${object.type}`,
    type: getObjectType(object),
    visible: object.visible,
    locked: object.userData.locked || false,
    children,
    object,
  }
}

// 刷新场景树
function refreshTree(): void {
  const engine = getEngine()
  if (!engine?.isInitialized) {
    treeData.value = []
    return
  }

  const scene = engine.sceneManager.scene
  const nodes: ISceneTreeNode[] = []

  // 获取 TransformControls 的 UUID 用于过滤
  const transformControlsUuid = engine.transformManager?.controls?.uuid

  for (const child of scene.children) {
    // 直接跳过 TransformControls
    if (transformControlsUuid && child.uuid === transformControlsUuid) {
      continue
    }
    const node = buildTreeNode(child)
    if (node) {
      nodes.push(node)
    }
  }

  treeData.value = nodes

  // 自动展开所有节点
  expandedKeys.value = getAllNodeIds(nodes)
}

// 获取所有节点 ID
function getAllNodeIds(nodes: ISceneTreeNode[]): string[] {
  const ids: string[] = []
  function traverse(nodeList: ISceneTreeNode[]): void {
    for (const node of nodeList) {
      ids.push(node.uuid)
      if (node.children.length > 0) {
        traverse(node.children)
      }
    }
  }
  traverse(nodes)
  return ids
}

// 处理节点点击（选择），支持 Shift 多选
function handleNodeClick(node: ISceneTreeNode, event?: MouseEvent): void {
  if (editingNodeId.value) return
  closeContextMenu()

  const engine = getEngine()
  if (!engine) return

  const object = engine.sceneManager.scene.getObjectByProperty('uuid', node.uuid)
  if (!object) return

  if (event?.shiftKey) {
    engine.selectionManager.toggleSelection(object)
  } else {
    engine.selectionManager.selectByUUID(node.uuid)
  }
  emit('select', node.uuid)
}

function handleNodeContextMenu(node: ISceneTreeNode, event: MouseEvent): void {
  event.preventDefault()
  event.stopPropagation()

  contextMenu.value = {
    visible: true,
    x: event.clientX,
    y: event.clientY,
    node,
  }

  const engine = getEngine()
  if (engine) {
    engine.selectionManager.selectByUUID(node.uuid)
    emit('select', node.uuid)
  }
}

function closeContextMenu(): void {
  contextMenu.value.visible = false
}

// 处理双击编辑名称
function handleNodeDblClick(node: ISceneTreeNode): void {
  if (node.locked) return

  editingNodeId.value = node.uuid
  editingName.value = node.name

  nextTick(() => {
    editInputRef.value?.focus()
    editInputRef.value?.select()
  })
}

function beginRename(node: ISceneTreeNode): void {
  if (node.locked) {
    ElMessage.warning('对象已锁定，无法重命名')
    return
  }

  editingNodeId.value = node.uuid
  editingName.value = node.name
  closeContextMenu()

  nextTick(() => {
    editInputRef.value?.focus()
    editInputRef.value?.select()
  })
}

// 保存名称编辑
function saveNameEdit(): void {
  if (!editingNodeId.value) return

  const engine = getEngine()
  if (!engine) return

  const newName = editingName.value.trim()
  if (newName) {
    const object = engine.sceneManager.scene.getObjectByProperty('uuid', editingNodeId.value)
    if (object && object.name !== newName) {
      commandBus.changeObjectName(object, newName)
    }
    refreshTree()
  }

  editingNodeId.value = null
  editingName.value = ''
}

// 取消名称编辑
function cancelNameEdit(): void {
  editingNodeId.value = null
  editingName.value = ''
}

// 切换可见性
function toggleVisibility(node: ISceneTreeNode, event: Event): void {
  event.stopPropagation()

  const newVisible = !node.visible
  commandBus.changeObjectVisibleTree(node.object, newVisible)
  refreshTree()
}

// 切换锁定
function toggleLock(node: ISceneTreeNode, event: Event): void {
  event.stopPropagation()

  const newLocked = !node.locked
  commandBus.changeObjectLocked(node.object, newLocked)
  refreshTree()
}

// 删除节点
function handleDelete(node: ISceneTreeNode, event: Event): void {
  event.stopPropagation()

  if (node.locked) {
    ElMessage.warning('对象已锁定，无法删除')
    return
  }

  ElMessageBox.confirm(`确定要删除 "${node.name}" 吗？`, '删除确认', {
    confirmButtonText: '删除',
    cancelButtonText: '取消',
    type: 'warning',
  })
    .then(() => {
      const engine = getEngine()
      if (!engine) return

      commandBus.removeObject(node.uuid)
      refreshTree()
      ElMessage.success('已删除')
    })
    .catch(() => {})
}

function duplicateNode(node: ISceneTreeNode): void {
  if (node.locked) {
    ElMessage.warning('对象已锁定，无法复制')
    return
  }

  const clone = node.object.clone(true)
  clone.name = `${node.name} Copy`
  clone.position.x += 0.5
  clone.userData = {
    ...node.object.userData,
    selectable: node.object.userData.selectable !== false,
  }

  commandBus.addObject(clone, {
    name: clone.name,
    type: node.type === 'mesh' ? 'mesh' : node.type === 'light' ? 'light' : 'model',
  })

  const engine = getEngine()
  if (engine?.isInitialized) {
    engine.selectionManager.select(clone)
  }

  closeContextMenu()
  refreshTree()
  ElMessage.success('已复制对象')
}

// 聚焦到节点
function handleFocusNode(node: ISceneTreeNode, event: Event): void {
  event.stopPropagation()

  const engine = getEngine()
  if (!engine) return

  // 聚焦相机到该对象
  engine.cameraManager.focusOnObject(node.object)

  // 同时选中该对象
  engine.selectionManager.selectByUUID(node.uuid)
  emit('select', node.uuid)
}

function runContextAction(
  action: 'rename' | 'focus' | 'visible' | 'lock' | 'duplicate' | 'delete'
) {
  const node = contextMenu.value.node
  if (!node) return

  if (action === 'rename') {
    beginRename(node)
    return
  }
  if (action === 'focus') {
    handleFocusNode(node, new Event('contextmenu'))
    closeContextMenu()
    return
  }
  if (action === 'visible') {
    commandBus.changeObjectVisibleTree(node.object, !node.visible)
    closeContextMenu()
    refreshTree()
    return
  }
  if (action === 'lock') {
    commandBus.changeObjectLocked(node.object, !node.locked)
    closeContextMenu()
    refreshTree()
    return
  }
  if (action === 'duplicate') {
    duplicateNode(node)
    return
  }
  if (action === 'delete') {
    handleDelete(node, new Event('contextmenu'))
    closeContextMenu()
  }
}

// ========== 拖拽相关 ==========

function handleDragStart(event: DragEvent, node: ISceneTreeNode): void {
  if (node.locked) {
    event.preventDefault()
    return
  }

  draggingNode.value = node
  event.dataTransfer!.effectAllowed = 'move'
  event.dataTransfer!.setData('text/plain', node.uuid)
  setTransparentDragImage(event)
}

function handleDragOver(event: DragEvent, node: ISceneTreeNode): void {
  event.preventDefault()
  if (!draggingNode.value || draggingNode.value.uuid === node.uuid) return

  // 计算放置位置
  const rect = (event.target as HTMLElement).getBoundingClientRect()
  const y = event.clientY - rect.top
  const height = rect.height

  if (y < height * 0.25) {
    dropPosition.value = 'before'
  } else if (y > height * 0.75) {
    dropPosition.value = 'after'
  } else {
    dropPosition.value = 'inner'
  }

  dropTargetNode.value = node
  event.dataTransfer!.dropEffect = 'move'
}

function handleDragLeave(): void {
  dropTargetNode.value = null
  dropPosition.value = null
}

function handleDragEnd(): void {
  draggingNode.value = null
  dropTargetNode.value = null
  dropPosition.value = null
}

function handleDrop(event: DragEvent, node: ISceneTreeNode): void {
  event.preventDefault()
  event.stopPropagation()

  if (!draggingNode.value || draggingNode.value.uuid === node.uuid) {
    handleDragEnd()
    return
  }

  const engine = getEngine()
  if (!engine) return

  const draggedObject = draggingNode.value.object
  const targetObject = node.object

  // 检查是否会形成循环
  if (isDescendant(draggedObject, targetObject)) {
    ElMessage.warning('不能将父对象拖入子对象')
    handleDragEnd()
    return
  }

  let newParent: THREE.Object3D | null = null
  let newIndex: number | null = null

  if (dropPosition.value === 'inner' && node.type === 'group') {
    newParent = targetObject
  } else {
    newParent = targetObject.parent
    if (newParent) {
      const targetIndex = newParent.children.indexOf(targetObject)
      newIndex = dropPosition.value === 'before' ? targetIndex : targetIndex + 1

      if (draggedObject.parent === newParent) {
        const oldIndex = newParent.children.indexOf(draggedObject)
        if (oldIndex >= 0 && oldIndex < newIndex) {
          newIndex -= 1
        }
      }
    }
  }

  if (!newParent) {
    handleDragEnd()
    return
  }

  commandBus.reparentObject(draggedObject, newParent, newIndex)

  handleDragEnd()
  refreshTree()
  ElMessage.success('层级已更新')
}

// 检查是否是后代
function isDescendant(parent: THREE.Object3D, child: THREE.Object3D): boolean {
  let current: THREE.Object3D | null = child
  while (current) {
    if (current === parent) return true
    current = current.parent
  }
  return false
}

// ========== Group/Ungroup ==========

/** 成组：将选中对象放入新 Group */
function groupSelected(): void {
  const engine = getEngine()
  if (!engine || !engine.isInitialized || !engine.objectManager) {
    return
  }

  const ids = selectionStore.selectedIds
  if (ids.length < 2) {
    ElMessage.warning('请至少选择两个对象进行成组')
    return
  }

  const scene = engine.sceneManager.scene
  const objects: THREE.Object3D[] = []
  for (const id of ids) {
    const obj = engine.objectManager.getObject(id) || scene.getObjectByProperty('uuid', id)
    if (obj) objects.push(obj)
  }

  if (objects.length < 2) return

  const groupName = `Group_${Date.now()}`
  const group = commandBus.groupObjects(objects, groupName)
  if (!group) return

  engine.selectionManager.clearSelection()
  engine.selectionManager.select(group)
  refreshTree()
  ElMessage.success('成组成功')
  emit('group')
}

/** 解组：将 Group 中的对象移出到父级 */
function ungroupSelected(): void {
  const engine = getEngine()
  if (!engine || !engine.isInitialized || !engine.objectManager) {
    return
  }

  const primaryId = selectionStore.primarySelectedId
  if (!primaryId) return

  const scene = engine.sceneManager.scene
  const obj =
    engine.objectManager.getObject(primaryId) || scene.getObjectByProperty('uuid', primaryId)
  if (!obj || !(obj instanceof THREE.Group)) {
    ElMessage.warning('请选择一个组进行解组')
    return
  }
  const group = obj
  commandBus.ungroupObject(group)

  engine.selectionManager.clearSelection()
  refreshTree()
  ElMessage.success('解组成功')
  emit('ungroup')
}

// 监听场景变化
let refreshTimer: number | null = null

function scheduleRefresh(): void {
  if (refreshTimer) clearTimeout(refreshTimer)
  refreshTimer = window.setTimeout(() => {
    refreshTree()
  }, 100)
}

function handleSceneChange(): void {
  scheduleRefresh()
}

// 处理快捷键成组
function handleGroupShortcut(): void {
  groupSelected()
}

// 处理快捷键解组
function handleUngroupShortcut(): void {
  ungroupSelected()
}

const onSceneChange = () => handleSceneChange()
const onGroupShortcut = () => handleGroupShortcut()
const onUngroupShortcut = () => handleUngroupShortcut()

onMounted(() => {
  refreshTree()
  document.addEventListener('click', closeContextMenu)
  document.addEventListener('contextmenu', closeContextMenu)
  eventBus.on('scene:selection-changed', onSceneChange)
  eventBus.on('scene:object-added', onSceneChange)
  eventBus.on('scene:object-removed', onSceneChange)
  eventBus.on('scene:object-updated', onSceneChange)
  eventBus.on('scene:property-changed', onSceneChange)
  eventBus.on('scene:group-selected', onGroupShortcut)
  eventBus.on('scene:ungroup-selected', onUngroupShortcut)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', closeContextMenu)
  document.removeEventListener('contextmenu', closeContextMenu)
  eventBus.off('scene:selection-changed', onSceneChange)
  eventBus.off('scene:object-added', onSceneChange)
  eventBus.off('scene:object-removed', onSceneChange)
  eventBus.off('scene:object-updated', onSceneChange)
  eventBus.off('scene:property-changed', onSceneChange)
  eventBus.off('scene:group-selected', onGroupShortcut)
  eventBus.off('scene:ungroup-selected', onUngroupShortcut)
  if (refreshTimer) clearTimeout(refreshTimer)
})

// 暴露方法
defineExpose({
  refreshTree,
  groupSelected,
  ungroupSelected,
})
</script>

<template>
  <div class="scene-tree">
    <!-- 工具栏 -->
    <div v-if="showActions" class="tree-toolbar">
      <div class="tree-toolbar-title">
        <Icon icon="lucide:layers-3" />
        <span>{{ filteredCount }} 个对象</span>
      </div>
      <div class="tree-toolbar-actions">
        <el-tooltip content="成组 (Ctrl+G)" placement="bottom">
          <button class="tree-tool-button" type="button" @click="groupSelected">
            <Icon icon="lucide:folder-plus" />
          </button>
        </el-tooltip>
        <el-tooltip content="解组 (Ctrl+Shift+G)" placement="bottom">
          <button class="tree-tool-button" type="button" @click="ungroupSelected">
            <Icon icon="lucide:folder-minus" />
          </button>
        </el-tooltip>
        <el-tooltip content="刷新场景树" placement="bottom">
          <button class="tree-tool-button" type="button" @click="refreshTree">
            <Icon icon="lucide:refresh-cw" />
          </button>
        </el-tooltip>
      </div>
    </div>

    <div class="tree-search">
      <el-input v-model="searchKeyword" size="small" clearable placeholder="搜索名称、类型、ID">
        <template #prefix>
          <el-icon>
            <Search />
          </el-icon>
        </template>
      </el-input>
      <span v-if="searchKeyword" class="search-count">{{ filteredCount }} 项</span>
    </div>

    <div class="tree-filters">
      <button
        v-for="filter in filterOptions"
        :key="filter.value"
        class="filter-chip"
        :class="{ 'is-active': activeFilters.includes(filter.value) }"
        @click="toggleFilter(filter.value)"
      >
        {{ filter.label }}
      </button>
      <button v-if="activeFilters.length > 0" class="filter-clear" @click="clearFilters">
        清除
      </button>
    </div>

    <!-- 树结构 -->
    <div class="tree-container">
      <template v-if="filteredTreeData.length > 0">
        <SceneTreeNode
          v-for="treeNode in filteredTreeData"
          :key="treeNode.uuid"
          :node="treeNode"
          :depth="0"
          :selected-ids="selectedIds"
          :editing-node-id="editingNodeId"
          :editing-name="editingName"
          :drop-target-uuid="dropTargetNode?.uuid"
          :drop-position="dropPosition"
          @click="(node: ISceneTreeNode, e: MouseEvent) => handleNodeClick(node, e)"
          @dblclick="handleNodeDblClick"
          @toggle-visibility="toggleVisibility"
          @toggle-lock="toggleLock"
          @delete="handleDelete"
          @focus="handleFocusNode"
          @context-menu="handleNodeContextMenu"
          @dragstart="handleDragStart"
          @dragover="handleDragOver"
          @dragleave="handleDragLeave"
          @dragend="handleDragEnd"
          @drop="handleDrop"
          @update:editing-name="editingName = $event"
          @save-edit="saveNameEdit"
          @cancel-edit="cancelNameEdit"
        />
      </template>
      <EmptyState
        v-else
        compact
        :icon="Box"
        :title="searchKeyword ? '没有匹配对象' : '场景为空'"
        :description="
          searchKeyword ? '尝试更换关键词或清除搜索条件。' : '从模型库拖入对象后会显示在这里。'
        "
      />
    </div>

    <Teleport to="body">
      <div
        v-if="contextMenu.visible && contextMenu.node"
        class="scene-tree-context-menu"
        :style="{ left: `${contextMenu.x}px`, top: `${contextMenu.y}px` }"
        @click.stop
        @contextmenu.prevent.stop
      >
        <button @click="runContextAction('rename')">重命名</button>
        <button @click="runContextAction('focus')">聚焦对象</button>
        <button @click="runContextAction('visible')">
          {{ contextMenu.node.visible ? '隐藏' : '显示' }}
        </button>
        <button @click="runContextAction('lock')">
          {{ contextMenu.node.locked ? '解锁' : '锁定' }}
        </button>
        <button @click="runContextAction('duplicate')">
          <Icon icon="lucide:copy" />
          复制
        </button>
        <button class="is-danger" @click="runContextAction('delete')">删除</button>
      </div>
    </Teleport>
  </div>
</template>

<!-- 递归子组件 -->
<script lang="ts">
import { defineComponent, h, ref as vueRef } from 'vue'
import { Icon as IconifyIcon } from '@iconify/vue'

// 递归节点类型
type TreeNodeType = {
  uuid: string
  name: string
  type: 'group' | 'mesh' | 'light' | 'camera' | 'helper' | 'unknown'
  visible: boolean
  locked: boolean
  children: TreeNodeType[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  object: any
}

// 递归节点组件
const SceneTreeNode: ReturnType<typeof defineComponent> = defineComponent({
  name: 'SceneTreeNode',
  props: {
    node: { type: Object, required: true },
    depth: { type: Number, default: 0 },
    selectedIds: { type: Array, default: () => [] },
    editingNodeId: { type: String, default: null },
    editingName: { type: String, default: '' },
    dropTargetUuid: { type: String, default: null },
    dropPosition: { type: String, default: null },
  },
  emits: [
    'click',
    'dblclick',
    'toggle-visibility',
    'toggle-lock',
    'delete',
    'focus',
    'context-menu',
    'dragstart',
    'dragover',
    'dragleave',
    'dragend',
    'drop',
    'update:editing-name',
    'save-edit',
    'cancel-edit',
  ],
  setup(props, { emit }) {
    const isExpanded = vueRef(true)
    const inputRef = vueRef<HTMLInputElement | null>(null)

    const toggleExpand = (): void => {
      isExpanded.value = !isExpanded.value
    }

    const getNodeIcon = (type: string): string => {
      switch (type) {
        case 'group':
          return 'lucide:folder'
        case 'mesh':
          return 'mdi:cube-outline'
        case 'light':
          return 'lucide:lightbulb'
        case 'camera':
          return 'lucide:camera'
        case 'helper':
          return 'lucide:crosshair'
        default:
          return 'lucide:box'
      }
    }

    const getNodeTypeLabel = (type: string): string => {
      switch (type) {
        case 'group':
          return '组'
        case 'mesh':
          return '网格'
        case 'light':
          return '灯光'
        case 'camera':
          return '相机'
        case 'helper':
          return '辅助'
        default:
          return '对象'
      }
    }

    return (): ReturnType<typeof h> => {
      const node = props.node as TreeNodeType
      const isSelected = (props.selectedIds as string[]).includes(node.uuid)
      const isEditing = props.editingNodeId === node.uuid
      const isDropTarget = props.dropTargetUuid === node.uuid
      const hasChildren = node.children && node.children.length > 0

      // 节点内容
      const nodeContent = h(
        'div',
        {
          class: [
            'tree-node-item',
            { 'is-selected': isSelected },
            { 'is-locked': node.locked },
            { 'is-drop-target': isDropTarget },
            { [`drop-${props.dropPosition}`]: isDropTarget && props.dropPosition },
          ],
          style: { paddingLeft: `${props.depth * 16 + 8}px` },
          draggable: !node.locked,
          onClick: (e: MouseEvent) => emit('click', node, e),
          onDblclick: () => emit('dblclick', node),
          onContextmenu: (e: MouseEvent) => emit('context-menu', node, e),
          onDragstart: (e: DragEvent) => emit('dragstart', e, node),
          onDragover: (e: DragEvent) => emit('dragover', e, node),
          onDragleave: () => emit('dragleave'),
          onDragend: () => emit('dragend'),
          onDrop: (e: DragEvent) => emit('drop', e, node),
        },
        [
          // 展开/折叠箭头
          h(
            'button',
            {
              class: [
                'expand-icon',
                { 'has-children': hasChildren, 'is-expanded': isExpanded.value },
              ],
              type: 'button',
              onClick: (e: Event) => {
                e.stopPropagation()
                if (hasChildren) toggleExpand()
              },
            },
            hasChildren
              ? [
                  h(IconifyIcon, {
                    icon: 'lucide:chevron-right',
                  }),
                ]
              : undefined
          ),

          // 类型图标
          h(
            'span',
            {
              class: ['node-icon', `node-icon--${node.type}`],
              title: getNodeTypeLabel(node.type),
            },
            [
              h(IconifyIcon, {
                icon: getNodeIcon(node.type),
              }),
            ]
          ),

          // 名称（编辑状态或显示状态）
          isEditing
            ? h('input', {
                ref: inputRef,
                class: 'name-input',
                value: props.editingName,
                onInput: (e: Event) =>
                  emit('update:editing-name', (e.target as HTMLInputElement).value),
                onBlur: () => emit('save-edit'),
                onKeydown: (e: KeyboardEvent) => {
                  if (e.key === 'Enter') emit('save-edit')
                  if (e.key === 'Escape') emit('cancel-edit')
                },
                onClick: (e: Event) => e.stopPropagation(),
              })
            : h('span', { class: 'node-name', title: node.name }, node.name),

          h('span', { class: ['node-type-badge', `node-type-badge--${node.type}`] }, [
            getNodeTypeLabel(node.type),
          ]),

          // 操作按钮
          h('div', { class: 'node-actions' }, [
            // 定位聚焦
            h(
              'span',
              {
                class: 'action-btn focus-btn',
                title: '定位聚焦',
                onClick: (e: Event) => emit('focus', node, e),
              },
              [h(IconifyIcon, { icon: 'lucide:focus' })]
            ),

            // 可见性
            h(
              'span',
              {
                class: ['action-btn', { 'is-hidden': !node.visible }],
                title: node.visible ? '隐藏对象' : '显示对象',
                onClick: (e: Event) => emit('toggle-visibility', node, e),
              },
              [h(IconifyIcon, { icon: node.visible ? 'lucide:eye' : 'lucide:eye-off' })]
            ),

            // 锁定
            h(
              'span',
              {
                class: ['action-btn', { 'is-locked': node.locked }],
                title: node.locked ? '解锁对象' : '锁定对象',
                onClick: (e: Event) => emit('toggle-lock', node, e),
              },
              [h(IconifyIcon, { icon: node.locked ? 'lucide:lock' : 'lucide:lock-open' })]
            ),

            // 删除
            h(
              'span',
              {
                class: 'action-btn delete-btn',
                title: '删除对象',
                onClick: (e: Event) => emit('delete', node, e),
              },
              [h(IconifyIcon, { icon: 'lucide:trash-2' })]
            ),
          ]),
        ]
      )

      // 子节点
      const childNodes: ReturnType<typeof h>[] =
        hasChildren && isExpanded.value
          ? node.children.map(
              (child: TreeNodeType): ReturnType<typeof h> =>
                h(SceneTreeNode, {
                  key: child.uuid,
                  node: child,
                  depth: props.depth + 1,
                  selectedIds: props.selectedIds,
                  editingNodeId: props.editingNodeId,
                  editingName: props.editingName,
                  dropTargetUuid: props.dropTargetUuid,
                  dropPosition: props.dropPosition,
                  onClick: (n: TreeNodeType, e: MouseEvent) => emit('click', n, e),
                  onDblclick: (n: TreeNodeType) => emit('dblclick', n),
                  onToggleVisibility: (n: TreeNodeType, e: Event) =>
                    emit('toggle-visibility', n, e),
                  onToggleLock: (n: TreeNodeType, e: Event) => emit('toggle-lock', n, e),
                  onDelete: (n: TreeNodeType, e: Event) => emit('delete', n, e),
                  onFocus: (n: TreeNodeType, e: Event) => emit('focus', n, e),
                  onContextMenu: (n: TreeNodeType, e: MouseEvent) => emit('context-menu', n, e),
                  onDragstart: (e: DragEvent, n: TreeNodeType) => emit('dragstart', e, n),
                  onDragover: (e: DragEvent, n: TreeNodeType) => emit('dragover', e, n),
                  onDragleave: () => emit('dragleave'),
                  onDragend: () => emit('dragend'),
                  onDrop: (e: DragEvent, n: TreeNodeType) => emit('drop', e, n),
                  'onUpdate:editing-name': (v: string) => emit('update:editing-name', v),
                  onSaveEdit: () => emit('save-edit'),
                  onCancelEdit: () => emit('cancel-edit'),
                })
            )
          : []

      return h('div', { class: 'tree-node' }, [nodeContent, ...childNodes])
    }
  },
})

export { SceneTreeNode }
</script>

<style scoped lang="scss">
.scene-tree {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  color: var(--lc-text-primary);
}

.tree-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  min-height: 38px;
  padding: 4px 2px 10px;
  margin-bottom: 10px;
  border-bottom: 1px solid var(--lc-border-subtle);
}

.tree-toolbar-title {
  display: inline-flex;
  align-items: center;
  min-width: 0;
  gap: 8px;
  color: var(--lc-text-secondary);
  font-size: 13px;
  font-weight: 600;

  svg {
    width: 17px;
    height: 17px;
    color: var(--lc-accent);
  }
}

.tree-toolbar-actions {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.tree-tool-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  color: var(--lc-text-secondary);
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--lc-radius-sm);
  cursor: pointer;
  transition:
    color 0.15s ease,
    background-color 0.15s ease,
    border-color 0.15s ease;

  svg {
    width: 16px;
    height: 16px;
  }

  &:hover {
    color: var(--lc-text-primary);
    background: var(--lc-bg-control-hover);
    border-color: var(--lc-border-subtle);
  }

  &:active {
    background: var(--lc-bg-control-active);
  }
}

.tree-search {
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
  padding-bottom: 10px;

  :deep(.el-input) {
    --el-input-height: 30px;
  }

  :deep(.el-input__wrapper) {
    background: var(--lc-bg-control);
    border: 1px solid var(--lc-border-subtle);
    border-radius: var(--lc-radius-md);
    box-shadow: none;
    transition:
      background-color 0.15s ease,
      border-color 0.15s ease,
      box-shadow 0.15s ease;

    &:hover {
      background: var(--lc-bg-control-hover);
      border-color: var(--lc-border-strong);
    }

    &.is-focus {
      border-color: var(--lc-border-focus);
      box-shadow: 0 0 0 2px rgba(79, 140, 255, 0.18);
    }
  }

  :deep(.el-input__inner) {
    color: var(--lc-text-primary);
    font-size: 13px;
  }

  :deep(.el-input__prefix) {
    color: var(--lc-text-muted);
  }
}

.tree-filters {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding-bottom: 10px;
}

.filter-chip,
.filter-clear {
  height: 26px;
  padding: 0 9px;
  color: var(--lc-text-secondary);
  background: var(--lc-bg-control);
  border: 1px solid var(--lc-border-subtle);
  border-radius: var(--lc-radius-sm);
  font-size: 12px;
  line-height: 24px;
  cursor: pointer;
  transition:
    color 0.15s ease,
    background-color 0.15s ease,
    border-color 0.15s ease;

  &:hover {
    color: var(--lc-text-primary);
    background: var(--lc-bg-control-hover);
  }

  &.is-active {
    color: var(--lc-text-primary);
    background: var(--lc-selection-bg);
    border-color: var(--lc-selection-border);
    box-shadow: inset 0 0 0 1px rgba(79, 140, 255, 0.1);
  }
}

.filter-clear {
  color: var(--lc-warning);
}

.search-count {
  flex-shrink: 0;
  color: var(--lc-text-muted);
  font-size: 12px;
}

.tree-container {
  flex: 1;
  min-height: 0;
  padding: 2px 2px 12px 0;
  overflow-y: auto;
  overflow-x: hidden;

  &::-webkit-scrollbar {
    width: 8px;
  }

  &::-webkit-scrollbar-thumb {
    background: transparent;
    border: 2px solid transparent;
    border-radius: 999px;
    background-clip: padding-box;
  }

  &:hover::-webkit-scrollbar-thumb {
    background-color: var(--lc-border-strong);
  }
}

.empty-tree {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100px;
  color: var(--lc-text-muted);
  font-size: 13px;
}

:deep(.tree-node) {
  .tree-node-item {
    position: relative;
    display: flex;
    align-items: center;
    min-width: 0;
    height: 34px;
    margin: 1px 0;
    padding-right: 106px;
    border: 1px solid transparent;
    border-radius: var(--lc-radius-md);
    cursor: pointer;
    transition:
      color 0.15s ease,
      background-color 0.15s ease,
      border-color 0.15s ease,
      box-shadow 0.15s ease;
    user-select: none;

    &:hover {
      background: var(--lc-bg-control-hover);
      border-color: var(--lc-border-subtle);

      .node-actions {
        opacity: 1;
        pointer-events: auto;
      }

      .node-icon {
        transform: translateY(-1px);
      }
    }

    &.is-selected {
      background: var(--lc-selection-bg);
      border-color: rgba(79, 140, 255, 0.32);
      box-shadow: inset 2px 0 0 var(--lc-selection-border);

      .node-name {
        color: var(--lc-text-primary);
        font-weight: 600;
      }

      .node-icon {
        border-color: rgba(79, 140, 255, 0.46);
        box-shadow: 0 0 0 1px rgba(79, 140, 255, 0.12);
      }

      .node-actions {
        opacity: 1;
        pointer-events: auto;
      }
    }

    &.is-locked {
      .node-name {
        color: var(--lc-text-muted);
      }

      .node-icon {
        filter: grayscale(0.28);
      }
    }

    &.is-drop-target {
      background: rgba(79, 140, 255, 0.16);
      border-color: rgba(79, 140, 255, 0.48);

      &.drop-before::before {
        content: '';
        position: absolute;
        left: 8px;
        right: 8px;
        top: 0;
        height: 2px;
        background: var(--lc-accent);
        border-radius: 999px;
      }

      &.drop-after::after {
        content: '';
        position: absolute;
        left: 8px;
        right: 8px;
        bottom: 0;
        height: 2px;
        background: var(--lc-accent);
        border-radius: 999px;
      }

      &.drop-inner {
        outline: 2px solid rgba(79, 140, 255, 0.6);
        outline-offset: -2px;
      }
    }
  }

  .expand-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: 0 0 20px;
    width: 20px;
    height: 24px;
    padding: 0;
    margin-right: 2px;
    color: var(--lc-text-muted);
    background: transparent;
    border: 0;
    border-radius: var(--lc-radius-sm);
    cursor: pointer;
    transition:
      color 0.15s ease,
      background-color 0.15s ease;

    svg {
      width: 14px;
      height: 14px;
      transition: transform 0.18s ease;
    }

    &.has-children:hover {
      color: var(--lc-text-primary);
      background: rgba(255, 255, 255, 0.05);
    }

    &.has-children.is-expanded {
      svg {
        transform: rotate(90deg);
      }
    }
  }

  .node-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: 0 0 24px;
    width: 24px;
    height: 24px;
    margin-right: 8px;
    color: var(--lc-text-secondary);
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: var(--lc-radius-sm);
    transition:
      color 0.15s ease,
      transform 0.15s ease,
      border-color 0.15s ease,
      background-color 0.15s ease;

    svg {
      width: 15px;
      height: 15px;
    }

    &.node-icon--group {
      color: var(--lc-warning);
      background: rgba(245, 165, 36, 0.12);
      border-color: rgba(245, 165, 36, 0.18);
    }

    &.node-icon--mesh {
      color: var(--lc-accent);
      background: rgba(79, 140, 255, 0.12);
      border-color: rgba(79, 140, 255, 0.18);
    }

    &.node-icon--light {
      color: var(--lc-warning);
      background: rgba(245, 165, 36, 0.15);
      border-color: rgba(245, 165, 36, 0.22);
    }

    &.node-icon--camera {
      color: var(--lc-success);
      background: rgba(53, 196, 107, 0.12);
      border-color: rgba(53, 196, 107, 0.18);
    }

    &.node-icon--helper,
    &.node-icon--unknown {
      color: var(--lc-text-muted);
      background: rgba(255, 255, 255, 0.035);
      border-color: rgba(255, 255, 255, 0.06);
    }
  }

  .node-name {
    flex: 1;
    min-width: 0;
    color: var(--lc-text-primary);
    font-size: 14px;
    font-weight: 500;
    line-height: 20px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .node-type-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: 0 0 auto;
    max-width: 42px;
    height: 18px;
    margin-left: 8px;
    padding: 0 6px;
    color: var(--lc-text-muted);
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 999px;
    font-size: 11px;
    font-weight: 600;
    line-height: 16px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;

    &.node-type-badge--mesh {
      color: var(--lc-accent);
      background: rgba(79, 140, 255, 0.08);
      border-color: rgba(79, 140, 255, 0.14);
    }

    &.node-type-badge--light,
    &.node-type-badge--group {
      color: var(--lc-warning);
      background: rgba(245, 165, 36, 0.08);
      border-color: rgba(245, 165, 36, 0.14);
    }

    &.node-type-badge--camera {
      color: var(--lc-success);
      background: rgba(53, 196, 107, 0.08);
      border-color: rgba(53, 196, 107, 0.14);
    }
  }

  .name-input {
    flex: 1;
    min-width: 0;
    height: 26px;
    padding: 0 8px;
    color: var(--lc-text-primary);
    background: var(--lc-bg-panel-raised);
    border: 1px solid var(--lc-border-focus);
    border-radius: var(--lc-radius-sm);
    font-size: 14px;
    font-weight: 500;
    outline: none;
    box-shadow: 0 0 0 2px rgba(79, 140, 255, 0.16);
  }

  .node-actions {
    position: absolute;
    top: 50%;
    right: 6px;
    display: flex;
    align-items: center;
    gap: 3px;
    opacity: 0;
    pointer-events: none;
    transform: translateY(-50%);
    transition:
      opacity 0.15s ease,
      transform 0.15s ease;
  }

  .action-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    color: var(--lc-text-secondary);
    background: transparent;
    border: 1px solid transparent;
    border-radius: var(--lc-radius-sm);
    cursor: pointer;
    transition:
      color 0.15s ease,
      background-color 0.15s ease,
      border-color 0.15s ease;

    svg {
      width: 14px;
      height: 14px;
    }

    &:hover {
      color: var(--lc-text-primary);
      background: var(--lc-bg-control-active);
      border-color: var(--lc-border-subtle);
    }

    &.is-hidden {
      color: var(--lc-text-muted);
    }

    &.is-locked {
      color: var(--lc-warning);
    }

    &.delete-btn:hover {
      color: var(--lc-error);
      background: rgba(255, 92, 92, 0.12);
      border-color: rgba(255, 92, 92, 0.18);
    }

    &.focus-btn:hover {
      color: var(--lc-accent);
    }
  }
}
</style>

<style lang="scss">
.scene-tree-context-menu {
  position: fixed;
  z-index: 2400;
  min-width: 148px;
  padding: 6px;
  background: var(--lc-bg-panel-raised);
  border: 1px solid var(--lc-border-subtle);
  border-radius: var(--lc-radius-lg);
  box-shadow: var(--lc-shadow-floating);

  button {
    width: 100%;
    height: 28px;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 0 10px;
    color: var(--lc-text-secondary);
    background: transparent;
    border: none;
    border-radius: var(--lc-radius-md);
    font-size: 12px;
    text-align: left;
    cursor: pointer;

    &:hover {
      color: var(--lc-text-primary);
      background: var(--lc-bg-control-hover);
    }

    &.is-danger {
      color: var(--lc-error);
    }
  }
}
</style>
