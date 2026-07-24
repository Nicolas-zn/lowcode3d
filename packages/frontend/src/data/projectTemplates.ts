import type { IProjectData, ISceneObjectData, ILightData } from '@lowcode3d/shared'
import { createDefaultProjectData } from '@lowcode3d/shared'

export type ProjectTemplateId = 'blank' | 'product-showcase' | 'digital-twin' | 'gis-annotation'

export interface ProjectTemplate {
  id: ProjectTemplateId
  name: string
  industry: string
  description: string
  sceneObjects: ISceneObjectData[]
  lights: ILightData[]
  backgroundColor: string
  camera: IProjectData['camera']
}

const createTransform = (
  position = { x: 0, y: 0, z: 0 },
  rotation = { x: 0, y: 0, z: 0 },
  scale = { x: 1, y: 1, z: 1 }
) => ({
  position,
  rotation,
  scale,
})

const object = (
  uuid: string,
  name: string,
  primitiveType: NonNullable<ISceneObjectData['primitiveType']>,
  transform: ISceneObjectData['transform'],
  color: string
): ISceneObjectData => ({
  uuid,
  name,
  type: 'primitive',
  primitiveType,
  primitiveParams:
    primitiveType === 'plane'
      ? { width: 1, height: 1 }
      : primitiveType === 'sphere'
        ? { radius: 0.5, widthSegments: 32, heightSegments: 32 }
        : primitiveType === 'cylinder'
          ? { radiusTop: 0.5, radiusBottom: 0.5, height: 1, radialSegments: 32 }
          : { width: 1, height: 1, depth: 1 },
  transform,
  materialOverrides: {
    color,
    roughness: 0.58,
    metalness: 0.12,
  },
  visible: true,
  locked: false,
  userData: {
    templateObject: true,
  },
})

const defaultLights: ILightData[] = [
  {
    uuid: 'template_light_ambient',
    name: 'Ambient Light',
    type: 'ambient',
    color: '#ffffff',
    intensity: 0.45,
  },
  {
    uuid: 'template_light_key',
    name: 'Key Light',
    type: 'directional',
    color: '#ffffff',
    intensity: 1.4,
    position: { x: 6, y: 8, z: 5 },
    castShadow: true,
  },
]

export const PROJECT_TEMPLATES: ProjectTemplate[] = [
  {
    id: 'blank',
    name: '空白项目',
    industry: '通用',
    description: '只有相机、灯光和环境，适合从零搭建。',
    sceneObjects: [],
    lights: defaultLights,
    backgroundColor: '#1a1a2e',
    camera: {
      type: 'perspective',
      position: { x: 6, y: 5, z: 6 },
      target: { x: 0, y: 0, z: 0 },
      fov: 60,
      near: 0.1,
      far: 2000,
    },
  },
  {
    id: 'product-showcase',
    name: '产品展示',
    industry: '营销展示',
    description: '中心展台、产品主体和补光布局，适合快速做 Web 3D 展示。',
    sceneObjects: [
      object(
        'template_product_floor',
        '展示底座',
        'cylinder',
        createTransform(
          { x: 0, y: -0.08, z: 0 },
          { x: 0, y: 0, z: 0 },
          { x: 3.2, y: 0.16, z: 3.2 }
        ),
        '#2f3545'
      ),
      object(
        'template_product_body',
        '产品主体',
        'box',
        createTransform(
          { x: 0, y: 0.72, z: 0 },
          { x: 0.12, y: 0.72, z: 0 },
          { x: 1.25, y: 1.25, z: 1.25 }
        ),
        '#6ea8fe'
      ),
      object(
        'template_product_accent',
        '高光部件',
        'sphere',
        createTransform(
          { x: 0.9, y: 1.05, z: 0.45 },
          { x: 0, y: 0, z: 0 },
          { x: 0.45, y: 0.45, z: 0.45 }
        ),
        '#2ee6a6'
      ),
    ],
    lights: defaultLights,
    backgroundColor: '#10131d',
    camera: {
      type: 'perspective',
      position: { x: 4.5, y: 3.4, z: 5 },
      target: { x: 0, y: 0.6, z: 0 },
      fov: 50,
      near: 0.1,
      far: 2000,
    },
  },
  {
    id: 'digital-twin',
    name: '数字孪生园区',
    industry: '数字孪生',
    description: '楼宇、道路和设备节点骨架，适合园区可视化原型。',
    sceneObjects: [
      object(
        'template_twin_ground',
        '园区地面',
        'plane',
        createTransform(
          { x: 0, y: -0.01, z: 0 },
          { x: -Math.PI / 2, y: 0, z: 0 },
          { x: 10, y: 10, z: 1 }
        ),
        '#27303f'
      ),
      object(
        'template_twin_building_a',
        'A 座楼宇',
        'box',
        createTransform(
          { x: -2.1, y: 1.25, z: -0.8 },
          { x: 0, y: 0.12, z: 0 },
          { x: 1.4, y: 2.5, z: 1.1 }
        ),
        '#7dd3fc'
      ),
      object(
        'template_twin_building_b',
        'B 座楼宇',
        'box',
        createTransform(
          { x: 1.5, y: 0.9, z: -1.1 },
          { x: 0, y: -0.18, z: 0 },
          { x: 1.7, y: 1.8, z: 1.2 }
        ),
        '#93c5fd'
      ),
      object(
        'template_twin_device',
        '设备节点',
        'cylinder',
        createTransform(
          { x: 0.6, y: 0.32, z: 2.2 },
          { x: 0, y: 0, z: 0 },
          { x: 0.45, y: 0.65, z: 0.45 }
        ),
        '#22c55e'
      ),
    ],
    lights: defaultLights,
    backgroundColor: '#111827',
    camera: {
      type: 'perspective',
      position: { x: 5.8, y: 5.2, z: 6.4 },
      target: { x: 0, y: 0.8, z: 0 },
      fov: 55,
      near: 0.1,
      far: 3000,
    },
  },
  {
    id: 'gis-annotation',
    name: 'GIS 标注场景',
    industry: 'GIS',
    description: '平面地图、兴趣点和区域标记，适合位置可视化起步。',
    sceneObjects: [
      object(
        'template_gis_base',
        '地图底板',
        'plane',
        createTransform(
          { x: 0, y: 0, z: 0 },
          { x: -Math.PI / 2, y: 0, z: 0 },
          { x: 8, y: 8, z: 1 }
        ),
        '#1f6f8b'
      ),
      object(
        'template_gis_marker_a',
        '北区标记',
        'cylinder',
        createTransform(
          { x: -1.8, y: 0.28, z: -1.4 },
          { x: 0, y: 0, z: 0 },
          { x: 0.32, y: 0.56, z: 0.32 }
        ),
        '#f97316'
      ),
      object(
        'template_gis_marker_b',
        '南区标记',
        'cylinder',
        createTransform(
          { x: 1.6, y: 0.28, z: 1.5 },
          { x: 0, y: 0, z: 0 },
          { x: 0.32, y: 0.56, z: 0.32 }
        ),
        '#facc15'
      ),
      object(
        'template_gis_region',
        '重点区域',
        'box',
        createTransform(
          { x: 0, y: 0.04, z: 0 },
          { x: 0, y: 0.4, z: 0 },
          { x: 2.4, y: 0.08, z: 1.2 }
        ),
        '#38bdf8'
      ),
    ],
    lights: defaultLights,
    backgroundColor: '#0f172a',
    camera: {
      type: 'perspective',
      position: { x: 0, y: 7.4, z: 5.2 },
      target: { x: 0, y: 0, z: 0 },
      fov: 52,
      near: 0.1,
      far: 2000,
    },
  },
]

export function getProjectTemplate(id: ProjectTemplateId): ProjectTemplate {
  return PROJECT_TEMPLATES.find((template) => template.id === id) ?? PROJECT_TEMPLATES[0]
}

export function createProjectDataFromTemplate(
  templateId: ProjectTemplateId,
  projectName: string,
  description?: string
): IProjectData {
  const template = getProjectTemplate(templateId)
  const now = new Date().toISOString()

  return createDefaultProjectData({
    projectName,
    description,
    createdAt: now,
    updatedAt: now,
    origin: {
      models: [],
      textures: [],
      hdris: [],
    },
    sceneObjects: structuredClone(template.sceneObjects),
    lights: structuredClone(template.lights),
    camera: structuredClone(template.camera),
    environment: {
      backgroundColor: template.backgroundColor,
      backgroundType: 'color',
    },
    animations: {
      duration: 10,
      fps: 30,
      clips: [],
      tracks: [],
    },
    assetManifest: {
      generatedAt: now,
      items: [],
    },
  })
}
