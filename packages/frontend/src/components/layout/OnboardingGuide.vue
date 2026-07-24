<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { Box, MagicStick, Setting, Upload } from '@element-plus/icons-vue'
import { eventBus } from '@/engine'
import { useEditorStore } from '@/stores/editorStore'

interface GuideStep {
  title: string
  eyebrow: string
  description: string
  actionText: string
  action: () => void
}

const STORAGE_KEY = 'lowcode3d_editor_onboarding_seen_v1'
const editorStore = useEditorStore()
const isOpen = ref(false)
const activeStepIndex = ref(0)

const steps: GuideStep[] = [
  {
    eyebrow: 'Step 1',
    title: '从资源开始搭建场景',
    description: '先打开模型库或组件库，把基础 Mesh、灯光、模型拖入 Canvas，建立第一个可编辑对象。',
    actionText: '打开资源搭建工作区',
    action: () => {
      editorStore.applyWorkspacePreset('asset')
      eventBus.emit('editor:open-left-tab', { tab: 'models' })
    },
  },
  {
    eyebrow: 'Step 2',
    title: '选中对象后编辑属性',
    description:
      'Canvas、场景树和 Inspector 会同步选中状态。右侧面板负责 Transform、Material、Events 等属性编辑。',
    actionText: '恢复默认编辑工作区',
    action: () => editorStore.applyWorkspacePreset('default'),
  },
  {
    eyebrow: 'Step 3',
    title: '预览前完成发布检查',
    description: '发布检查会提示缺失资源、错误配置和性能风险。先修复阻断项，再进入预览或发布流程。',
    actionText: '打开发布检查工作区',
    action: () => editorStore.applyWorkspacePreset('publish'),
  },
]

const currentStep = computed(() => steps[activeStepIndex.value])
const progressText = computed(() => `${activeStepIndex.value + 1} / ${steps.length}`)
const isLastStep = computed(() => activeStepIndex.value === steps.length - 1)

function openGuide(): void {
  activeStepIndex.value = 0
  isOpen.value = true
}

function closeGuide(markSeen = true): void {
  isOpen.value = false
  if (markSeen) {
    localStorage.setItem(STORAGE_KEY, '1')
  }
}

function nextStep(): void {
  if (isLastStep.value) {
    closeGuide()
    return
  }
  activeStepIndex.value += 1
}

function previousStep(): void {
  activeStepIndex.value = Math.max(0, activeStepIndex.value - 1)
}

function runStepAction(): void {
  currentStep.value.action()
}

function handleOpenRequest(): void {
  openGuide()
}

function handleKeydown(event: KeyboardEvent): void {
  if (!isOpen.value) return

  if (event.key === 'Escape') {
    event.preventDefault()
    closeGuide()
  }
}

onMounted(() => {
  eventBus.on('editor:open-onboarding', handleOpenRequest)
  window.addEventListener('keydown', handleKeydown)

  if (!localStorage.getItem(STORAGE_KEY)) {
    window.setTimeout(() => {
      openGuide()
    }, 700)
  }
})

onBeforeUnmount(() => {
  eventBus.off('editor:open-onboarding', handleOpenRequest)
  window.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <Teleport to="body">
    <Transition name="guide-fade">
      <div v-if="isOpen" class="guide-overlay" role="dialog" aria-label="编辑器新手引导">
        <section class="guide-panel">
          <div class="guide-visual" aria-hidden="true">
            <div class="guide-visual__viewport">
              <div class="guide-visual__grid"></div>
              <div class="guide-visual__object">
                <el-icon>
                  <Box />
                </el-icon>
              </div>
            </div>
            <div class="guide-visual__rail">
              <span :class="{ active: activeStepIndex === 0 }"></span>
              <span :class="{ active: activeStepIndex === 1 }"></span>
              <span :class="{ active: activeStepIndex === 2 }"></span>
            </div>
          </div>

          <div class="guide-content">
            <div class="guide-topline">
              <span>{{ currentStep.eyebrow }}</span>
              <span>{{ progressText }}</span>
            </div>

            <h2>{{ currentStep.title }}</h2>
            <p>{{ currentStep.description }}</p>

            <div class="guide-steps">
              <button
                v-for="(step, index) in steps"
                :key="step.title"
                :class="{ active: activeStepIndex === index }"
                @click="activeStepIndex = index"
              >
                <el-icon>
                  <MagicStick v-if="index === 0" />
                  <Setting v-else-if="index === 1" />
                  <Upload v-else />
                </el-icon>
                <span>{{ step.title }}</span>
              </button>
            </div>

            <div class="guide-actions">
              <el-button text @click="closeGuide()">跳过</el-button>
              <el-button :disabled="activeStepIndex === 0" @click="previousStep">上一步</el-button>
              <el-button @click="runStepAction">{{ currentStep.actionText }}</el-button>
              <el-button type="primary" @click="nextStep">
                {{ isLastStep ? '完成' : '下一步' }}
              </el-button>
            </div>
          </div>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped lang="scss">
.guide-overlay {
  position: fixed;
  inset: 0;
  z-index: 3100;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(7, 10, 18, 0.58);
  backdrop-filter: blur(8px);
}

.guide-panel {
  width: min(760px, calc(100vw - 32px));
  min-height: 360px;
  display: grid;
  grid-template-columns: 280px minmax(0, 1fr);
  overflow: hidden;
  color: var(--lc-text-primary);
  background: var(--lc-bg-panel-raised);
  border: 1px solid var(--lc-border);
  border-radius: var(--lc-radius-lg);
  box-shadow: var(--lc-shadow-dialog);
}

.guide-visual {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 18px;
  background:
    linear-gradient(145deg, rgba(42, 167, 255, 0.16), transparent 42%),
    linear-gradient(315deg, rgba(45, 212, 191, 0.14), transparent 36%), var(--lc-bg-canvas);
  border-right: 1px solid var(--lc-border-subtle);
}

.guide-visual__viewport {
  position: relative;
  flex: 1;
  min-height: 236px;
  overflow: hidden;
  background: rgba(10, 15, 27, 0.92);
  border: 1px solid var(--lc-border-subtle);
  border-radius: var(--lc-radius-md);
}

.guide-visual__grid {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(148, 163, 184, 0.14) 1px, transparent 1px),
    linear-gradient(90deg, rgba(148, 163, 184, 0.14) 1px, transparent 1px);
  background-size: 26px 26px;
  transform: perspective(420px) rotateX(58deg) translateY(54px) scale(1.45);
  transform-origin: center bottom;
}

.guide-visual__object {
  position: absolute;
  left: 50%;
  top: 46%;
  width: 74px;
  height: 74px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--lc-accent);
  background: rgba(39, 51, 78, 0.88);
  border: 1px solid var(--lc-selection-border);
  border-radius: var(--lc-radius-md);
  box-shadow: 0 0 0 5px rgba(42, 167, 255, 0.14);
  transform: translate(-50%, -50%) rotate(-12deg);

  .el-icon {
    font-size: 34px;
  }
}

.guide-visual__rail {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;

  span {
    height: 4px;
    background: var(--lc-bg-control);
    border-radius: 999px;

    &.active {
      background: var(--lc-accent);
    }
  }
}

.guide-content {
  min-width: 0;
  display: flex;
  flex-direction: column;
  padding: 22px;
}

.guide-topline {
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: var(--lc-text-muted);
  font-size: 12px;
  font-weight: 600;
}

h2 {
  margin: 18px 0 10px;
  color: var(--lc-text-primary);
  font-size: 22px;
  line-height: 1.25;
}

p {
  min-height: 68px;
  margin: 0;
  color: var(--lc-text-secondary);
  font-size: 14px;
  line-height: 1.7;
}

.guide-steps {
  display: grid;
  gap: 8px;
  margin-top: 18px;

  button {
    height: 42px;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 0 10px;
    color: var(--lc-text-secondary);
    background: var(--lc-bg-control);
    border: 1px solid var(--lc-border-subtle);
    border-radius: var(--lc-radius-md);
    text-align: left;
    cursor: pointer;

    &:hover,
    &.active {
      color: var(--lc-text-primary);
      background: var(--lc-selection-bg);
      border-color: var(--lc-selection-border);
    }

    span {
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }
}

.guide-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  margin-top: auto;
  padding-top: 20px;
}

.guide-fade-enter-active,
.guide-fade-leave-active {
  transition: opacity 0.16s ease;
}

.guide-fade-enter-from,
.guide-fade-leave-to {
  opacity: 0;
}

@media (max-width: 720px) {
  .guide-panel {
    grid-template-columns: 1fr;
  }

  .guide-visual {
    min-height: 180px;
    border-right: none;
    border-bottom: 1px solid var(--lc-border-subtle);
  }

  .guide-actions {
    flex-wrap: wrap;
  }
}
</style>
