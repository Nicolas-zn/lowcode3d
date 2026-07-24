import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { ISceneObject, ILightConfig, ICameraConfig } from '@lowcode3d/shared'

export const useSceneStore = defineStore('scene', () => {
  // 场景对象列表
  const objects = ref<Map<string, ISceneObject>>(new Map())

  // 灯光配置
  const lights = ref<ILightConfig[]>([])

  // 相机配置
  const camera = ref<ICameraConfig>({
    type: 'perspective',
    position: { x: 5, y: 5, z: 5 },
    target: { x: 0, y: 0, z: 0 },
    fov: 60,
    near: 0.1,
    far: 1000,
  })

  // 场景设置
  const settings = ref({
    backgroundColor: '#1a1a2e',
    showGrid: true,
    showAxes: true,
    fogEnabled: false,
    fogColor: '#1a1a2e',
    fogDensity: 0.01,
  })

  // 对象列表 (数组形式)
  const objectList = computed(() => Array.from(objects.value.values()))

  // 添加对象
  function addObject(obj: ISceneObject) {
    objects.value.set(obj.uuid, obj)
  }

  // 移除对象
  function removeObject(uuid: string) {
    objects.value.delete(uuid)
  }

  // 获取对象
  function getObject(uuid: string): ISceneObject | undefined {
    return objects.value.get(uuid)
  }

  // 更新对象属性
  function updateObject(uuid: string, updates: Partial<ISceneObject>) {
    const obj = objects.value.get(uuid)
    if (obj) {
      objects.value.set(uuid, { ...obj, ...updates })
    }
  }

  // 添加灯光
  function addLight(light: ILightConfig) {
    lights.value.push(light)
  }

  // 移除灯光
  function removeLight(uuid: string) {
    const index = lights.value.findIndex((l) => l.uuid === uuid)
    if (index > -1) {
      lights.value.splice(index, 1)
    }
  }

  // 更新场景设置
  function updateSettings(updates: Partial<typeof settings.value>) {
    settings.value = { ...settings.value, ...updates }
  }

  // 清空场景
  function clearScene() {
    objects.value.clear()
    lights.value = []
  }

  return {
    objects,
    objectList,
    lights,
    camera,
    settings,
    addObject,
    removeObject,
    getObject,
    updateObject,
    addLight,
    removeLight,
    updateSettings,
    clearScene,
  }
})
