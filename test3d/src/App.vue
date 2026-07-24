<script setup lang="ts">
import { ref, onMounted } from 'vue'
import type { IProjectData } from '@lowcode3d/shared'
import deviceMonitoringSceneConfig from './fixtures/v1.3-device-monitoring.scene.json'
import Viewer from './components/viewer.vue'
// 场景配置
const sceneConfig = ref<IProjectData | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)

// v1.3 设备监控验收项目
const defaultTestConfig = deviceMonitoringSceneConfig

// 加载 JSON 文件
const loadJsonFile = async (event: Event) => {
  const input = event.target as HTMLInputElement
  if (!input.files || input.files.length === 0) return

  const file = input.files[0]
  try {
    const text = await file.text()
    const json = JSON.parse(text) as IProjectData
    sceneConfig.value = json
    console.log('✅ 已加载 JSON:', json.projectName)
    console.log('📊 场景对象数量:', json.sceneObjects.length)
    console.log('💡 灯光数量:', json.lights?.length || 0)
  } catch (e) {
    console.error('❌ JSON 解析失败:', e)
    error.value = '无法解析 JSON 文件'
  }
}

// 使用默认测试配置
const viewerRef = ref(null)
const useDefaultConfig = () => {
  sceneConfig.value = defaultTestConfig as IProjectData
  console.log('✅ 使用 v1.3 设备监控验收项目')
  console.log(viewerRef.value)
}

onMounted(() => {
  sceneConfig.value = defaultTestConfig as IProjectData
  loading.value = false
})
const models = ref([])
</script>

<template>
  <div class="app-container">
    <!-- 控制面板 -->
    <div class="control-panel">
      <h2>🎮 Test3D</h2>
      <p>v1.3 Runtime 验收项目</p>

      <div class="controls">
        <div class="control-group">
          <label>加载 JSON 文件:</label>
          <input type="file" accept=".json" @change="loadJsonFile" />
        </div>

        <div class="control-group">
          <button @click="useDefaultConfig">加载设备监控验收项目</button>
        </div>

        <div v-if="sceneConfig" class="info">
          <p>📦 项目: {{ sceneConfig.projectName }}</p>
          <p>🧩 协议: {{ sceneConfig.schemaVersion }}</p>
          <p>🔷 对象: {{ sceneConfig.sceneObjects.length }}</p>
          <p>💡 灯光: {{ sceneConfig.lights?.length || 0 }}</p>
          <p>📡 数据源: {{ sceneConfig.dataSources?.length || 0 }}</p>
          <p>🖱️ 事件: {{ sceneConfig.events?.length || 0 }}</p>
        </div>

        <div v-if="error" class="error">
          {{ error }}
        </div>
      </div>
    </div>

    <!-- 3D 视图 -->
    <div class="viewer-container">
      <viewer v-if="sceneConfig" ref="viewerRef" :config="sceneConfig" :models="models" />
      <div v-else class="placeholder">
        <p>请加载 JSON 文件或使用默认测试场景</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.app-container {
  width: 100%;
  height: 100%;
  display: flex;
}

.control-panel {
  width: 300px;
  min-width: 300px;
  background: #2c3e50;
  color: #ecf0f1;
  padding: 20px;
  overflow-y: auto;
}

.control-panel h2 {
  margin-bottom: 10px;
  color: #3498db;
}

.control-panel p {
  margin-bottom: 20px;
  color: #95a5a6;
  font-size: 14px;
}

.controls {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.control-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.control-group label {
  font-size: 14px;
  color: #bdc3c7;
}

.control-group input[type='file'] {
  padding: 8px;
  background: #34495e;
  border: 1px solid #4a6785;
  border-radius: 4px;
  color: #ecf0f1;
}

.control-group button {
  padding: 10px 16px;
  background: #3498db;
  border: none;
  border-radius: 4px;
  color: white;
  cursor: pointer;
  font-size: 14px;
  transition: background 0.2s;
}

.control-group button:hover {
  background: #2980b9;
}

.info {
  background: #34495e;
  padding: 12px;
  border-radius: 4px;
  font-size: 13px;
}

.info p {
  margin-bottom: 5px;
  color: #ecf0f1;
}

.error {
  background: #c0392b;
  padding: 12px;
  border-radius: 4px;
  color: white;
  font-size: 13px;
}

.viewer-container {
  flex: 1;
  background: #1a1a2e;
  position: relative;
}

.placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #7f8c8d;
  font-size: 16px;
}
</style>
