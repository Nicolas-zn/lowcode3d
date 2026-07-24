<script setup lang="ts">
import { useRouter } from 'vue-router'
import { HomeFilled } from '@element-plus/icons-vue'

const router = useRouter()

const goHome = () => {
  router.push('/')
}
</script>

<template>
  <div class="error-page">
    <!-- 背景装饰 -->
    <div class="bg-decoration">
      <div class="orb orb-1"></div>
      <div class="orb orb-2"></div>
      <div class="orb orb-3"></div>
    </div>

    <div class="error-container">
      <div class="error-content">
        <div class="error-icon">
          <span class="icon-number">4</span>
          <span class="icon-zero">0</span>
          <span class="icon-number">4</span>
        </div>
        <h1 class="error-title">页面未找到</h1>
        <p class="error-description">抱歉，您访问的页面不存在或已被移除</p>
        <div class="error-actions">
          <el-button type="primary" size="large" @click="goHome">
            <el-icon><HomeFilled /></el-icon>
            返回首页
          </el-button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.error-page {
  width: 100%;
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 50%, #16213e 100%);
  position: relative;
  overflow: hidden;
}

// 背景装饰
.bg-decoration {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;

  .orb {
    position: absolute;
    border-radius: 50%;
    filter: blur(100px);
    opacity: 0.4;
    animation: float 20s infinite ease-in-out;
  }

  .orb-1 {
    width: 500px;
    height: 500px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    top: -200px;
    left: -100px;
    animation-delay: 0s;
  }

  .orb-2 {
    width: 400px;
    height: 400px;
    background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
    bottom: -150px;
    right: -100px;
    animation-delay: -5s;
  }

  .orb-3 {
    width: 300px;
    height: 300px;
    background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
    top: 50%;
    left: 60%;
    animation-delay: -10s;
  }
}

@keyframes float {
  0%,
  100% {
    transform: translate(0, 0) scale(1);
  }

  25% {
    transform: translate(50px, -30px) scale(1.1);
  }

  50% {
    transform: translate(-30px, 50px) scale(0.95);
  }

  75% {
    transform: translate(-50px, -20px) scale(1.05);
  }
}

.error-container {
  width: 100%;
  max-width: 600px;
  padding: 48px 40px;
  position: relative;
  z-index: 1;
}

.error-content {
  text-align: center;
  color: #fff;
}

.error-icon {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 8px;
  margin-bottom: 32px;
  font-size: 120px;
  font-weight: 700;
  line-height: 1;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;

  .icon-number,
  .icon-zero {
    display: inline-block;
    animation: bounce 2s infinite;
  }

  .icon-zero {
    animation-delay: 0.1s;
  }

  .icon-number:last-child {
    animation-delay: 0.2s;
  }
}

@keyframes bounce {
  0%,
  100% {
    transform: translateY(0);
  }

  50% {
    transform: translateY(-20px);
  }
}

.error-title {
  font-size: 32px;
  font-weight: 700;
  margin-bottom: 16px;
  color: #fff;
}

.error-description {
  font-size: 16px;
  color: #a6adc8;
  margin-bottom: 40px;
  line-height: 1.6;
}

.error-actions {
  display: flex;
  justify-content: center;
  gap: 16px;

  :deep(.el-button) {
    height: 48px;
    font-size: 16px;
    font-weight: 600;
    border-radius: 12px;
    padding: 0 32px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    border: none;
    transition: all 0.3s;

    &:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 20px rgba(102, 126, 234, 0.4);
    }

    &:active {
      transform: translateY(0);
    }

    .el-icon {
      margin-right: 8px;
    }
  }
}
</style>
