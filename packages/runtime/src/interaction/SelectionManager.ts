import * as THREE from 'three'
import { findModelRootForSelection } from '../utils/modelSelection'

/**
 * 选择事件
 */
export interface ISelectionEvent {
  selected: THREE.Object3D[]
  added: THREE.Object3D[]
  removed: THREE.Object3D[]
}

/**
 * 选择管理器配置
 */
export interface ISelectionManagerConfig {
  domElement: HTMLElement
  camera: THREE.Camera
  scene: THREE.Scene
  selectables?: THREE.Object3D[]
  onSelectionChange?: (event: ISelectionEvent) => void
}

type TransformControlsObject = THREE.Object3D & {
  axis?: string | null
  isTransformControls?: boolean
  object?: THREE.Object3D | null
}

/**
 * 选择管理器
 * 使用 Raycaster 处理鼠标选择
 */
export class SelectionManager {
  private _domElement: HTMLElement
  private _camera: THREE.Camera
  private _scene: THREE.Scene
  private _raycaster: THREE.Raycaster
  private _mouse: THREE.Vector2

  private _selectedObjects: Set<THREE.Object3D> = new Set()
  private _selectables: THREE.Object3D[] = []
  private _onSelectionChange?: (event: ISelectionEvent) => void

  private _selectionBoxes: Map<string, THREE.BoxHelper> = new Map()

  // 是否启用选择
  private _enabled = true

  // 事件绑定
  private _boundPointerDown: (e: PointerEvent) => void
  private _boundDoubleClick: (e: MouseEvent) => void

  constructor(config: ISelectionManagerConfig) {
    this._domElement = config.domElement
    this._camera = config.camera
    this._scene = config.scene
    this._selectables = config.selectables || []
    this._onSelectionChange = config.onSelectionChange

    this._raycaster = new THREE.Raycaster()
    this._mouse = new THREE.Vector2()

    this._boundPointerDown = this._onPointerDown.bind(this)
    this._boundDoubleClick = this._onDoubleClick.bind(this)
    this._domElement.addEventListener('pointerdown', this._boundPointerDown)
    this._domElement.addEventListener('dblclick', this._boundDoubleClick)
  }

  /**
   * 更新相机
   */
  setCamera(camera: THREE.Camera): void {
    this._camera = camera
  }

  /**
   * 设置可选择对象列表
   */
  setSelectables(objects: THREE.Object3D[]): void {
    this._selectables = objects
  }

  /**
   * 设置是否启用选择
   */
  setEnabled(enabled: boolean): void {
    this._enabled = enabled
  }

  /**
   * 获取是否启用选择
   */
  isEnabled(): boolean {
    return this._enabled
  }

  /**
   * 获取当前选中对象
   */
  getSelected(): THREE.Object3D[] {
    return Array.from(this._selectedObjects)
  }

  /**
   * 获取主选中对象 (第一个选中的)
   */
  getPrimarySelected(): THREE.Object3D | null {
    return this._selectedObjects.size > 0 ? Array.from(this._selectedObjects)[0] : null
  }

  /**
   * 选中单个对象
   */
  select(object: THREE.Object3D): void {
    const previousSelected = Array.from(this._selectedObjects)

    // 清除之前的选择高亮
    this._clearHighlights()
    this._selectedObjects.clear()

    // 添加新选择
    this._selectedObjects.add(object)
    this._applyHighlight(object)

    this._emitChange(previousSelected)
  }

  /**
   * 添加到选择
   */
  addToSelection(object: THREE.Object3D): void {
    if (this._selectedObjects.has(object)) return

    const previousSelected = Array.from(this._selectedObjects)

    this._selectedObjects.add(object)
    this._applyHighlight(object)

    this._emitChange(previousSelected)
  }

  /**
   * 从选择中移除
   */
  removeFromSelection(object: THREE.Object3D): void {
    if (!this._selectedObjects.has(object)) return

    const previousSelected = Array.from(this._selectedObjects)

    this._removeHighlight(object)
    this._selectedObjects.delete(object)

    this._emitChange(previousSelected)
  }

  /**
   * 切换选择状态
   */
  toggleSelection(object: THREE.Object3D): void {
    if (this._selectedObjects.has(object)) {
      this.removeFromSelection(object)
    } else {
      this.addToSelection(object)
    }
  }

  /**
   * 清空选择
   */
  clearSelection(): void {
    if (this._selectedObjects.size === 0) return

    const previousSelected = Array.from(this._selectedObjects)

    this._clearHighlights()
    this._selectedObjects.clear()

    this._emitChange(previousSelected)
  }

  /**
   * 按 UUID 选择
   */
  selectByUUID(uuid: string): void {
    const object = this._scene.getObjectByProperty('uuid', uuid)
    if (object && !this._isTransformControlsObject(object)) {
      this.select(object)
    }
  }

  /**
   * 检查对象是否被选中
   */
  isSelected(object: THREE.Object3D): boolean {
    return this._selectedObjects.has(object)
  }

  /**
   * 处理鼠标按下事件（单击）
   * 单击选择子 Mesh（直接击中的对象）
   */
  private _onPointerDown(event: PointerEvent): void {
    // 检查是否启用选择
    if (!this._enabled) return

    // 只处理左键点击
    if (event.button !== 0) return

    // 计算标准化设备坐标
    const rect = this._domElement.getBoundingClientRect()
    this._mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
    this._mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1

    // 射线检测
    this._raycaster.setFromCamera(this._mouse, this._camera)

    // 检查是否点击了激活状态的 TransformControls
    const transformControls = this._findActiveTransformControls()
    if (transformControls) {
      const axis = transformControls.axis
      if (axis !== null && axis !== undefined) {
        // 点击了 TransformControls 的 gizmo，让它自己处理
        return
      }
    }

    // 获取可选择对象
    const targets = this._selectables.length > 0 ? this._selectables : this._getDefaultSelectables()
    const intersects = this._raycaster.intersectObjects(targets, true)

    if (intersects.length > 0) {
      const intersectedObject = intersects[0].object

      const objectToSelect = this._resolveSelectableTarget(intersectedObject, event.altKey)

      if (!objectToSelect) {
        if (!event.shiftKey) {
          this.clearSelection()
        }
        return
      }

      // 单击选择对象
      if (event.shiftKey) {
        this.toggleSelection(objectToSelect)
      } else {
        // 如果点击的是当前唯一选中的对象，则取消选择
        if (this._selectedObjects.size === 1 && this._selectedObjects.has(objectToSelect)) {
          this.clearSelection()
        } else {
          this.select(objectToSelect)
        }
      }
    } else if (!event.shiftKey) {
      // 点击空白处清除选择
      this.clearSelection()
    }
  }

  /**
   * 处理双击事件
   * 双击选择整体模型（最顶层的可选择父对象）
   */
  private _onDoubleClick(event: MouseEvent): void {
    // 检查是否启用选择
    if (!this._enabled) return

    // 计算标准化设备坐标
    const rect = this._domElement.getBoundingClientRect()
    this._mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
    this._mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1

    // 射线检测
    this._raycaster.setFromCamera(this._mouse, this._camera)

    // 检查是否点击了 TransformControls
    const transformControls = this._findActiveTransformControls()
    if (transformControls) {
      const axis = transformControls.axis
      if (axis !== null && axis !== undefined) {
        return
      }
    }

    // 获取可选择对象
    const targets = this._selectables.length > 0 ? this._selectables : this._getDefaultSelectables()
    const intersects = this._raycaster.intersectObjects(targets, true)

    if (intersects.length > 0) {
      const intersectedObject = intersects[0].object

      // 双击选择整体模型（找到最顶层的可选择父对象）
      const hit = this._findSelectableParent(intersectedObject)
      if (hit) {
        if (event.shiftKey) {
          this.toggleSelection(hit)
        } else {
          // 如果双击的是当前唯一选中的对象，则取消选择
          if (this._selectedObjects.size === 1 && this._selectedObjects.has(hit)) {
            this.clearSelection()
          } else {
            this.select(hit)
          }
        }
      } else if (!event.shiftKey) {
        // 击中了不可选择的对象（如地板），清除选择
        this.clearSelection()
      }
    }
  }

  /**
   * 解析最终选择对象。
   * 默认把 GLTF/GLB 子 Mesh 命中归一到模型根节点；按住 Alt/Option 时允许选择子级。
   */
  private _resolveSelectableTarget(
    object: THREE.Object3D,
    allowChildSelection = false
  ): THREE.Object3D | null {
    if (this._isTransformControlsObject(object)) {
      return null
    }

    const sceneObject = this._scene.getObjectByProperty('uuid', object.uuid)
    const hitObject = sceneObject || object

    if (allowChildSelection) {
      return hitObject
    }

    const modelRoot = findModelRootForSelection(hitObject)
    if (modelRoot) {
      const sceneModelRoot = this._scene.getObjectByProperty('uuid', modelRoot.uuid)
      return sceneModelRoot || modelRoot
    }

    if (hitObject.userData.selectable === false) {
      return this._findSelectableParent(hitObject)
    }

    return this._findSelectableParent(hitObject) || hitObject
  }

  /**
   * 查找场景中激活状态的 TransformControls
   * 激活状态 = visible 且有 object 附加
   */
  private _findActiveTransformControls(): TransformControlsObject | null {
    for (const child of this._scene.children) {
      // TransformControls 使用 isTransformControls 属性标识
      const control = child as TransformControlsObject
      if (control.isTransformControls && control.visible && control.object) {
        return control
      }
    }
    return null
  }

  /**
   * 获取默认可选择对象
   * 返回所有可被射线检测的 Mesh，让 _findSelectableParent 决定实际选中哪个对象
   */
  private _getDefaultSelectables(): THREE.Object3D[] {
    const selectables: THREE.Object3D[] = []
    this._scene.traverse((object) => {
      // 跳过 TransformControls 相关对象
      if (this._isTransformControlsObject(object)) {
        return
      }
      // 跳过辅助对象
      if (
        object.type === 'GridHelper' ||
        object.type === 'AxesHelper' ||
        object.userData.isSelectionHelper === true ||
        object.name.includes('Helper')
      ) {
        return
      }
      // 收集所有可见的 Mesh
      if (object instanceof THREE.Mesh && object.visible) {
        selectables.push(object)
      }
    })
    return selectables
  }

  /**
   * 向上查找可选择的父对象
   * 从击中的 Mesh 向上查找，找到第一个有 selectable=true 的父对象
   * 然后从场景中获取该对象的正确引用（确保对象在场景树中）
   */
  private _findSelectableParent(object: THREE.Object3D): THREE.Object3D | null {
    let current: THREE.Object3D | null = object

    while (current) {
      // 跳过 TransformControls 相关对象
      if (this._isTransformControlsObject(current)) {
        return null
      }

      // 找到标记为可选择的对象
      if (current.userData.selectable === true) {
        // 从场景中获取该对象的正确引用
        // 这解决了射线击中的对象可能不在场景根级别的问题
        const sceneObject = this._scene.getObjectByProperty('uuid', current.uuid)
        return sceneObject || current
      }

      // 注意：这里不再因为 selectable === false 就立即返回 null
      // 而是允许继续向上查找，以便支持复合对象（如广告牌）的子对象标记为不可选择但能选中父对象
      // 如果直到根节点都没找到 selectable === true 的对象，最终会返回 null

      current = current.parent
    }

    // 没有找到 selectable 标记，返回 null（不可选择）
    return null
  }

  /**
   * 检查对象是否是 TransformControls 的一部分
   * 需要向上遍历父级链，因为 gizmo 的子 Mesh 类型是普通的 'Mesh'
   */
  private _isTransformControlsObject(object: THREE.Object3D): boolean {
    let current: THREE.Object3D | null = object
    while (current) {
      if (
        current.type === 'TransformControls' ||
        current.type === 'TransformControlsGizmo' ||
        current.type === 'TransformControlsPlane'
      ) {
        return true
      }
      current = current.parent
    }
    return false
  }

  /**
   * 应用选择高亮
   * 使用包围盒作为选择反馈，不修改对象材质。
   */
  private _applyHighlight(object: THREE.Object3D): void {
    if (this._selectionBoxes.has(object.uuid)) {
      return
    }

    const box = new THREE.BoxHelper(object, 0x4f8cff)
    box.name = 'SelectionBoundingBoxHelper'
    box.userData.isSelectionHelper = true
    box.renderOrder = 1000
    const material = box.material as THREE.LineBasicMaterial
    material.depthTest = false
    material.transparent = true
    material.opacity = 0.95
    this._scene.add(box)
    this._selectionBoxes.set(object.uuid, box)
  }

  /**
   * 移除选择高亮
   */
  private _removeHighlight(object: THREE.Object3D): void {
    const box = this._selectionBoxes.get(object.uuid)
    if (!box) {
      return
    }

    box.removeFromParent()
    box.geometry.dispose()
    ;(box.material as THREE.Material).dispose()
    this._selectionBoxes.delete(object.uuid)
  }

  /**
   * 更新对象的原始材质引用（当材质被替换时调用）
   * 例如应用预定义材质时或在 MaterialPanel 中修改材质时
   */
  updateOriginalMaterial(_object: THREE.Object3D): void {
    this.updateBoundingBoxes()
  }

  /**
   * 获取材质的原始 emissive 值（在高亮之前的值）
   * 用于 MaterialPanel 在克隆材质时恢复原始 emissive
   */
  getOriginalEmissive(materialUuid: string): { color: number; intensity: number } | null {
    void materialUuid
    return null
  }

  /**
   * 更新包围盒位置和尺寸。
   */
  updateBoundingBoxes(): void {
    this._selectionBoxes.forEach((box) => {
      box.update()
    })
  }

  /**
   * 清除所有高亮
   */
  private _clearHighlights(): void {
    for (const object of this._selectedObjects) {
      this._removeHighlight(object)
    }
  }

  /**
   * 发送选择变更事件
   */
  private _emitChange(previousSelected: THREE.Object3D[]): void {
    if (!this._onSelectionChange) return

    const currentSelected = Array.from(this._selectedObjects)

    const added = currentSelected.filter((obj) => !previousSelected.includes(obj))
    const removed = previousSelected.filter((obj) => !currentSelected.includes(obj))

    this._onSelectionChange({
      selected: currentSelected,
      added,
      removed,
    })
  }

  /**
   * 销毁管理器
   */
  dispose(): void {
    this._domElement.removeEventListener('pointerdown', this._boundPointerDown)
    this._domElement.removeEventListener('dblclick', this._boundDoubleClick)
    this._clearHighlights()
    this._selectedObjects.clear()
    this._selectionBoxes.clear()
  }
}
