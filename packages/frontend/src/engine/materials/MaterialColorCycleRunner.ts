import * as THREE from 'three'
import { gsap } from 'gsap'

export type MaterialColorCycleMode = 'gradient' | 'jump'
export type MaterialColorCycleLoop = 'once' | 'forever'

export interface MaterialColorCycleConfig {
  enabled: boolean
  mode: MaterialColorCycleMode
  loop: MaterialColorCycleLoop
  duration: number
  colors: string[]
}

interface MaterialColorCycleOptions {
  onColorUpdate?: (color: string) => void
  onComplete?: () => void
}

const colorCycleTweens = new Map<string, gsap.core.Tween>()

export function normalizeMaterialColorCycleConfig(value: unknown): MaterialColorCycleConfig {
  const source =
    value && typeof value === 'object' ? (value as Partial<MaterialColorCycleConfig>) : {}
  const colors = Array.isArray(source.colors)
    ? source.colors.filter(
        (color): color is string => typeof color === 'string' && /^#[0-9a-f]{6}$/i.test(color)
      )
    : []

  return {
    enabled: source.enabled === true,
    mode: source.mode === 'jump' ? 'jump' : 'gradient',
    loop: source.loop === 'once' ? 'once' : 'forever',
    duration:
      typeof source.duration === 'number' && Number.isFinite(source.duration)
        ? Math.min(60, Math.max(0.2, source.duration))
        : 3,
    colors: colors.length >= 2 ? colors.slice(0, 8) : ['#409eff', '#35c46b', '#f5a524'],
  }
}

function getPrimaryCycleMaterial(object: THREE.Object3D): THREE.MeshStandardMaterial | null {
  if (object instanceof THREE.Mesh && object.material) {
    const material = Array.isArray(object.material) ? object.material[0] : object.material
    return material instanceof THREE.MeshStandardMaterial ? material : null
  }

  let result: THREE.MeshStandardMaterial | null = null
  object.traverse((child) => {
    if (result || !(child instanceof THREE.Mesh) || !child.material) return
    const material = Array.isArray(child.material) ? child.material[0] : child.material
    if (material instanceof THREE.MeshStandardMaterial) {
      result = material
    }
  })

  return result
}

function getInterpolatedCycleColor(
  colors: string[],
  mode: MaterialColorCycleMode,
  index: number
): string {
  if (colors.length === 0) return '#ffffff'
  const wrappedIndex = ((index % colors.length) + colors.length) % colors.length
  if (mode === 'jump') {
    return colors[Math.floor(wrappedIndex) % colors.length]
  }

  const fromIndex = Math.floor(wrappedIndex)
  const toIndex = (fromIndex + 1) % colors.length
  const ratio = wrappedIndex - fromIndex
  const from = new THREE.Color(colors[fromIndex])
  const to = new THREE.Color(colors[toIndex])
  from.lerp(to, ratio)
  return `#${from.getHexString()}`
}

function applyCycleColor(
  material: THREE.MeshStandardMaterial,
  color: string,
  onColorUpdate?: (color: string) => void
): void {
  material.color.set(color)
  material.needsUpdate = true
  onColorUpdate?.(color)
}

export function startMaterialColorCycle(
  object: THREE.Object3D,
  material: THREE.MeshStandardMaterial,
  config: MaterialColorCycleConfig,
  options: MaterialColorCycleOptions = {}
): void {
  if (config.colors.length < 2) return

  stopMaterialColorCycle(object)
  object.userData.materialModified = true

  const cursor = { value: 0 }
  applyCycleColor(
    getPrimaryCycleMaterial(object) ?? material,
    config.colors[0],
    options.onColorUpdate
  )

  const tween = gsap.to(cursor, {
    value: config.colors.length,
    duration: config.duration,
    repeat: config.loop === 'forever' ? -1 : 0,
    ease: 'none',
    onUpdate: () => {
      const material = getPrimaryCycleMaterial(object)
      if (!material) return
      applyCycleColor(
        material,
        getInterpolatedCycleColor(config.colors, config.mode, cursor.value),
        options.onColorUpdate
      )
    },
    onComplete: () => {
      colorCycleTweens.delete(object.uuid)
      options.onComplete?.()
    },
  })

  colorCycleTweens.set(object.uuid, tween)
}

export function restoreMaterialColorCycles(root: THREE.Object3D): void {
  root.traverse((object) => {
    const config = normalizeMaterialColorCycleConfig(object.userData.materialColorCycle)
    if (!config.enabled || config.colors.length < 2 || isMaterialColorCycleRunning(object)) {
      return
    }

    const material = getPrimaryCycleMaterial(object)
    if (!material) return

    startMaterialColorCycle(object, material, config)
  })
}

export function clearMaterialColorCycles(): void {
  for (const tween of colorCycleTweens.values()) {
    tween.kill()
  }
  colorCycleTweens.clear()
}

export function stopMaterialColorCycle(objectOrId: THREE.Object3D | string): void {
  const objectId = typeof objectOrId === 'string' ? objectOrId : objectOrId.uuid
  const tween = colorCycleTweens.get(objectId)
  tween?.kill()
  colorCycleTweens.delete(objectId)
}

export function isMaterialColorCycleRunning(objectOrId: THREE.Object3D | string | null): boolean {
  if (!objectOrId) return false
  const objectId = typeof objectOrId === 'string' ? objectOrId : objectOrId.uuid
  return colorCycleTweens.has(objectId)
}
