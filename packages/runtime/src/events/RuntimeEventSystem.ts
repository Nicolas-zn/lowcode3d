import * as THREE from 'three'
import type {
  CameraBookmarkData,
  IProjectData,
  RuntimeActionConfig,
  RuntimeEventConfig,
  RuntimeTriggerType,
} from '@lowcode3d/shared'
import type { Engine } from '../core/Engine'
import { eventBus } from './EventBus'

export class RuntimeEventSystem {
  private readonly raycaster = new THREE.Raycaster()
  private readonly pointer = new THREE.Vector2()
  private engine: Engine
  private container: HTMLElement | null = null
  private events: RuntimeEventConfig[] = []
  private cameraBookmarks: CameraBookmarkData[] = []
  private hoveredObject: THREE.Object3D | null = null

  constructor(engine: Engine) {
    this.engine = engine
  }

  attach(container: HTMLElement): void {
    if (this.container === container) return
    this.dispose()
    this.container = container
    container.addEventListener('click', this.handlePointerClick)
    container.addEventListener('dblclick', this.handlePointerDoubleClick)
    container.addEventListener('pointermove', this.handlePointerMove)
    container.addEventListener('pointerleave', this.handlePointerLeave)
  }

  bindProject(projectData: IProjectData): void {
    this.events = projectData.events.filter((event) => event.enabled)
    this.cameraBookmarks = projectData.cameraBookmarks
  }

  trigger(objectUuid: string, trigger: RuntimeTriggerType): void {
    this.events
      .filter(
        (event) => event.objectUuid === objectUuid && event.trigger === trigger && event.enabled
      )
      .forEach((event) => {
        event.actions
          .filter((action) => action.enabled)
          .forEach((action) => this.executeAction(action))
      })
  }

  handlePointerClick = (event: PointerEvent | MouseEvent): void => {
    const object = this.pickObject(event)
    if (object) {
      this.trigger(object.uuid, 'click')
    }
  }

  private handlePointerDoubleClick = (event: PointerEvent | MouseEvent): void => {
    const object = this.pickObject(event)
    if (object) {
      this.trigger(object.uuid, 'doubleClick')
    }
  }

  private handlePointerMove = (event: PointerEvent): void => {
    const object = this.pickObject(event)
    if (object === this.hoveredObject) return

    if (this.hoveredObject) {
      this.trigger(this.hoveredObject.uuid, 'hoverLeave')
    }
    if (object) {
      this.trigger(object.uuid, 'hoverEnter')
    }

    this.hoveredObject = object
  }

  private handlePointerLeave = (): void => {
    if (this.hoveredObject) {
      this.trigger(this.hoveredObject.uuid, 'hoverLeave')
    }
    this.hoveredObject = null
  }

  private pickObject(event: PointerEvent | MouseEvent): THREE.Object3D | null {
    if (!this.container || !this.engine.isInitialized) return null

    const rect = this.container.getBoundingClientRect()
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
    this.raycaster.setFromCamera(this.pointer, this.engine.cameraManager.camera)

    const eventObjectIds = new Set(this.events.map((item) => item.objectUuid))
    const intersects = this.raycaster.intersectObjects(
      this.engine.sceneManager.scene.children,
      true
    )

    for (const intersect of intersects) {
      let current: THREE.Object3D | null = intersect.object
      while (current) {
        if (eventObjectIds.has(current.uuid)) {
          return current
        }
        current = current.parent
      }
    }

    return null
  }

  executeAction(action: RuntimeActionConfig): void {
    if (!action.enabled) return

    switch (action.type) {
      case 'openUrl':
        this.openUrl(action.payload)
        break
      case 'playAnimation':
        this.playAnimation(action.payload)
        break
      case 'pauseAnimation':
        this.pauseAnimation(action.payload)
        break
      case 'setObjectVisible':
        this.setObjectVisible(action.payload)
        break
      case 'setObjectMaterial':
        this.setObjectMaterial(action.payload)
        break
      case 'showPopup':
        eventBus.emit('runtime:popup', {
          title: String(action.payload.title ?? ''),
          content: String(action.payload.content ?? ''),
        })
        break
      case 'emitMessage':
        eventBus.emit('runtime:message', {
          name: String(action.payload.name ?? ''),
          data: action.payload.data,
        })
        break
      case 'switchCamera':
        this.switchCamera(action.payload)
        break
      default:
        break
    }
  }

  private openUrl(payload: Record<string, unknown>): void {
    const url = typeof payload.url === 'string' ? payload.url : ''
    if (!url) return
    window.open(url, typeof payload.target === 'string' ? payload.target : '_blank')
  }

  private playAnimation(payload: Record<string, unknown>): void {
    this.engine.animationEngine?.play(this.getAnimationClipId(payload))
  }

  private pauseAnimation(payload: Record<string, unknown>): void {
    this.engine.animationEngine?.pause(this.getAnimationClipId(payload))
  }

  private getAnimationClipId(payload: Record<string, unknown>): string | undefined {
    const clipId = payload.clipId ?? payload.animationId
    return typeof clipId === 'string' && clipId.trim() !== '' ? clipId : undefined
  }

  private setObjectVisible(payload: Record<string, unknown>): void {
    const objectUuid = String(payload.objectUuid ?? payload.objectId ?? '')
    const object = this.findObject(objectUuid)
    if (!object) return

    object.visible = Boolean(payload.visible)
    eventBus.emit('scene:object-updated', {
      id: object.uuid,
      changes: { visible: object.visible },
    })
  }

  private setObjectMaterial(payload: Record<string, unknown>): void {
    const objectUuid = String(payload.objectUuid ?? payload.objectId ?? '')
    const object = this.findObject(objectUuid)
    if (!(object instanceof THREE.Mesh)) return

    const materials = Array.isArray(object.material) ? object.material : [object.material]
    materials.forEach((material) => {
      if (material instanceof THREE.MeshStandardMaterial && typeof payload.color === 'string') {
        material.color.set(payload.color)
        material.needsUpdate = true
      }
    })
  }

  private switchCamera(payload: Record<string, unknown>): void {
    const bookmarkId = String(payload.bookmarkId ?? '')
    const bookmark = this.cameraBookmarks.find((item) => item.id === bookmarkId)
    if (!bookmark) return

    this.engine.cameraManager.applyBookmark(bookmark)
    eventBus.emit('camera:changed', {
      type: bookmark.type,
    })
  }

  private findObject(objectUuid: string): THREE.Object3D | null {
    if (!objectUuid) return null
    return (
      this.engine.objectManager?.getObject(objectUuid) ??
      this.engine.sceneManager.scene.getObjectByProperty('uuid', objectUuid) ??
      null
    )
  }

  dispose(): void {
    if (this.container) {
      this.container.removeEventListener('click', this.handlePointerClick)
      this.container.removeEventListener('dblclick', this.handlePointerDoubleClick)
      this.container.removeEventListener('pointermove', this.handlePointerMove)
      this.container.removeEventListener('pointerleave', this.handlePointerLeave)
    }
    this.container = null
    this.events = []
    this.cameraBookmarks = []
    this.hoveredObject = null
  }
}
