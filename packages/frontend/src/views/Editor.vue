<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import EditorLayout from '@/components/layout/EditorLayout.vue'
import { useProjectStore } from '@/stores/projectStore'
import { useEditorStateStore } from '@/stores/editorStateStore'

const route = useRoute()
const router = useRouter()
const projectStore = useProjectStore()
const editorStateStore = useEditorStateStore()

const loading = ref(true)
const projectId = ref<string>('')

onMounted(async () => {
  projectId.value = route.params.id as string

  if (!projectId.value) {
    ElMessage.error('项目ID不存在')
    router.push('/assets')
    return
  }

  try {
    await projectStore.fetchProject(projectId.value)
    // 项目加载成功后重置编辑器状态
    editorStateStore.reset()
    loading.value = false
  } catch (e) {
    ElMessage.error('加载项目失败')
    router.push('/assets')
  }
})
</script>

<template>
  <div v-if="loading" class="loading-container">
    <div class="loading-content">
      <div class="loading-spinner"></div>
      <p>正在加载项目...</p>
    </div>
  </div>
  <EditorLayout v-else />
</template>

<style scoped lang="scss">
.loading-container {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #1e1e2e;
}

.loading-content {
  text-align: center;
  color: #a6adc8;

  p {
    margin-top: 16px;
    font-size: 14px;
  }
}

.loading-spinner {
  width: 48px;
  height: 48px;
  border: 3px solid rgba(102, 126, 234, 0.2);
  border-top-color: #667eea;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
