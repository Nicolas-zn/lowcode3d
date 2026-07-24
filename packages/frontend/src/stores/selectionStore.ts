import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useSelectionStore = defineStore('selection', () => {
  // 当前选中的对象 UUID 列表
  const selectedIds = ref<string[]>([])

  // 当前主选中对象 (多选时为第一个)
  const primarySelectedId = ref<string | null>(null)

  // 选中单个对象
  function select(id: string) {
    selectedIds.value = [id]
    primarySelectedId.value = id
  }

  // 添加到选择 (多选)
  function addToSelection(id: string) {
    if (!selectedIds.value.includes(id)) {
      selectedIds.value.push(id)
    }
    if (!primarySelectedId.value) {
      primarySelectedId.value = id
    }
  }

  // 从选择中移除
  function removeFromSelection(id: string) {
    const index = selectedIds.value.indexOf(id)
    if (index > -1) {
      selectedIds.value.splice(index, 1)
    }
    if (primarySelectedId.value === id) {
      primarySelectedId.value = selectedIds.value[0] || null
    }
  }

  // 切换选择状态
  function toggleSelection(id: string) {
    if (selectedIds.value.includes(id)) {
      removeFromSelection(id)
    } else {
      addToSelection(id)
    }
  }

  // 清空选择
  function clearSelection() {
    selectedIds.value = []
    primarySelectedId.value = null
  }

  // 是否已选中
  function isSelected(id: string): boolean {
    return selectedIds.value.includes(id)
  }

  return {
    selectedIds,
    primarySelectedId,
    select,
    addToSelection,
    removeFromSelection,
    toggleSelection,
    clearSelection,
    isSelected,
  }
})
