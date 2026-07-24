# 场景数据

编辑器导出的 JSON 数据格式说明。

## 数据结构

```typescript
interface IProjectData {
  version: string // 版本号
  projectName: string // 项目名称
  origin: IOrigin // 资源来源
  sceneObjects: ISceneObject[] // 场景对象
  lights: ILightData[] // 光源
  camera: ICameraData // 相机
  environment: IEnvironmentData // 环境设置
}
```

## 完整示例

```json
{
  "version": "1.0.0",
  "projectName": "我的场景",
  "origin": {
    "models": [
      {
        "id": "origin_1",
        "url": "https://example.com/model.glb",
        "name": "建筑模型"
      }
    ],
    "hdris": [],
    "textures": []
  },
  "sceneObjects": [
    {
      "uuid": "obj-uuid-123",
      "name": "主建筑",
      "type": "model",
      "modelOriginId": "origin_1",
      "transform": {
        "position": { "x": 0, "y": 0, "z": 0 },
        "rotation": { "x": 0, "y": 0, "z": 0 },
        "scale": { "x": 1, "y": 1, "z": 1 }
      },
      "materialOverrides": {
        "color": "#ffffff",
        "metalness": 0.5,
        "roughness": 0.5,
        "wireframe": false
      },
      "visible": true
    }
  ],
  "lights": [
    {
      "type": "directional",
      "color": "#ffffff",
      "intensity": 1,
      "position": { "x": 5, "y": 10, "z": 5 }
    }
  ],
  "camera": {
    "position": { "x": 0, "y": 5, "z": 10 },
    "target": { "x": 0, "y": 0, "z": 0 },
    "fov": 60
  },
  "environment": {
    "background": "#1a1a2e",
    "hdri": null
  }
}
```

## 字段说明

### origin

资源来源定义，记录所有使用的模型、HDRI、贴图的原始 URL。

| 字段     | 类型  | 说明          |
| -------- | ----- | ------------- |
| models   | array | 模型资源列表  |
| hdris    | array | HDRI 环境贴图 |
| textures | array | 贴图资源      |

### sceneObjects

场景中的所有对象。

| 字段              | 类型    | 说明                    |
| ----------------- | ------- | ----------------------- |
| uuid              | string  | 唯一标识                |
| name              | string  | 对象名称                |
| type              | string  | 类型: model/mesh/group  |
| modelOriginId     | string  | 关联的 origin.models.id |
| transform         | object  | 变换信息                |
| materialOverrides | object  | 材质覆盖                |
| visible           | boolean | 是否可见                |
| children          | array   | 子对象                  |

### materialOverrides

材质属性覆盖。

| 字段      | 类型    | 说明                      |
| --------- | ------- | ------------------------- |
| color     | string  | 颜色 (hex)                |
| metalness | number  | 金属度 0-1                |
| roughness | number  | 粗糙度 0-1                |
| opacity   | number  | 透明度 0-1                |
| wireframe | boolean | 线框模式                  |
| side      | string  | 渲染面: front/back/double |
