<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useUserStore } from '@/stores/userStore'
import logoIcon from '@/assets/icons/icons.svg'

const router = useRouter()
const userStore = useUserStore()

const activeTab = ref('login')
const loading = ref(false)
const allowRegister = ref(false)
const loginForm = reactive({
  email: 'nico@nico.com',
  password: '123456',
})

// 表单验证
const validateEmail = (email: string) => {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return re.test(email)
}

const handleLogin = async () => {
  // 验证
  if (!loginForm.email || !loginForm.password) {
    ElMessage.warning('请填写邮箱和密码')
    return
  }
  if (!validateEmail(loginForm.email)) {
    ElMessage.warning('请输入有效的邮箱地址')
    return
  }
  if (loginForm.password.length < 6) {
    ElMessage.warning('密码长度至少为6位')
    return
  }

  loading.value = true
  try {
    await userStore.login(loginForm.email, loginForm.password)
    ElMessage.success('登录成功')
    router.push('/assets')
  } catch (e: unknown) {
    console.error('登录错误:', e)
    const errorMessage = e instanceof Error ? e.message : '登录失败，请检查邮箱和密码'
    ElMessage.error(errorMessage)
  } finally {
    loading.value = false
  }
}

const registerForm = reactive({
  email: '',
  password: '',
  confirmPassword: '',
  nickname: '',
})

const handleRegister = async () => {
  // 验证
  if (!registerForm.email || !registerForm.password) {
    ElMessage.warning('请填写邮箱和密码')
    return
  }
  if (!validateEmail(registerForm.email)) {
    ElMessage.warning('请输入有效的邮箱地址')
    return
  }
  if (registerForm.password.length < 6) {
    ElMessage.warning('密码长度至少为6位')
    return
  }
  if (registerForm.password !== registerForm.confirmPassword) {
    ElMessage.warning('两次输入的密码不一致')
    return
  }

  loading.value = true
  try {
    await userStore.register(
      registerForm.email,
      registerForm.password,
      registerForm.nickname || undefined
    )
    ElMessage.success('注册成功')
    router.push('/assets')
  } catch (e: unknown) {
    console.error('注册错误:', e)
    const errorMessage = e instanceof Error ? e.message : '注册失败，请稍后重试'
    ElMessage.error(errorMessage)
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="login-page">
    <!-- 背景装饰 -->
    <div class="bg-decoration">
      <div class="orb orb-1"></div>
      <div class="orb orb-2"></div>
      <div class="orb orb-3"></div>
    </div>

    <div class="login-wrapper">
      <!-- 左侧图片区域 -->
      <div class="login-left">
        <div class="image-placeholder">
          <img src="@/assets/images/login.png" alt="Login" />
          <!-- <div class="placeholder-content">
            <span class="placeholder-icon">🖼️</span>
            <p>图片区域</p>
          </div> -->
        </div>
      </div>

      <!-- 分割线 -->
      <div class="divider"></div>

      <!-- 右侧表单区域 -->
      <div class="login-right">
        <div class="login-container">
          <div class="login-header">
            <div class="logo-wrapper">
              <img :src="logoIcon" alt="logo" class="logo-icon" />
              <h1>editor3D<sup class="version-tag">v1.4</sup></h1>
            </div>
            <p>低代码 3D 场景编辑器</p>
            <div class="feature-tags">
              <span class="tag">可视化编辑</span>
              <span class="tag">实时预览</span>
              <span class="tag">一键发布</span>
            </div>
          </div>

          <el-tabs v-model="activeTab" class="login-tabs">
            <el-tab-pane label="登录" name="login">
              <el-form :model="loginForm" class="auth-form">
                <el-form-item>
                  <el-input
                    v-model="loginForm.email"
                    placeholder="邮箱"
                    size="large"
                    prefix-icon="Message"
                    clearable
                  />
                </el-form-item>
                <el-form-item>
                  <el-input
                    v-model="loginForm.password"
                    type="password"
                    placeholder="密码"
                    size="large"
                    prefix-icon="Lock"
                    show-password
                    @keyup.enter="handleLogin"
                  />
                </el-form-item>
                <el-form-item>
                  <el-button
                    type="primary"
                    size="large"
                    class="submit-btn"
                    :loading="loading"
                    @click="handleLogin"
                  >
                    <span v-if="!loading">登录</span>
                    <span v-else>登录中...</span>
                  </el-button>
                </el-form-item>
              </el-form>
            </el-tab-pane>

            <el-tab-pane label="注册" name="register">
              <!-- 不允许注册时显示提示 -->
              <div v-if="!allowRegister" class="register-closed">
                <div class="closed-header">
                  <span class="closed-icon">🚫</span>
                  <h3>完全开源/演示网址/暂不开放注册</h3>
                </div>
                <p>合作请联系 Nico</p>
                <div class="qrcode-wrapper">
                  <img src="@/assets/images/qrcode.jpeg" alt="联系二维码" class="qrcode-image" />
                </div>
              </div>
              <!-- 允许注册时显示表单 -->
              <el-form v-else :model="registerForm" class="auth-form">
                <el-form-item>
                  <el-input
                    v-model="registerForm.nickname"
                    placeholder="昵称（可选）"
                    size="large"
                    prefix-icon="User"
                    clearable
                  />
                </el-form-item>
                <el-form-item>
                  <el-input
                    v-model="registerForm.email"
                    placeholder="邮箱"
                    size="large"
                    prefix-icon="Message"
                    clearable
                  />
                </el-form-item>
                <el-form-item>
                  <el-input
                    v-model="registerForm.password"
                    type="password"
                    placeholder="密码（至少6位）"
                    size="large"
                    prefix-icon="Lock"
                    show-password
                  />
                </el-form-item>
                <el-form-item>
                  <el-input
                    v-model="registerForm.confirmPassword"
                    type="password"
                    placeholder="确认密码"
                    size="large"
                    prefix-icon="Lock"
                    show-password
                    @keyup.enter="handleRegister"
                  />
                </el-form-item>
                <el-form-item>
                  <el-button
                    type="primary"
                    size="large"
                    class="submit-btn"
                    :loading="loading"
                    @click="handleRegister"
                  >
                    <span v-if="!loading">注册</span>
                    <span v-else>注册中...</span>
                  </el-button>
                </el-form-item>
              </el-form>
            </el-tab-pane>
          </el-tabs>

          <div class="login-footer">
            <p>继续使用即表示您同意我们的服务条款</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.login-page {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 50%, #16213e 100%);
  position: relative;
  overflow: hidden;
}

.login-wrapper {
  display: flex;
  max-width: 1600px;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  position: relative;
  z-index: 1;
}

.version-tag {
  font-size: 12px;
  color: #fff;
  -webkit-text-fill-color: #fff;
}

// 左侧图片区域
.login-left {
  flex: 1;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px;
  min-width: 0;

  .image-placeholder {
    background: rgba(30, 30, 46, 0.3);
    border-radius: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.3s;
    overflow: hidden;
    position: relative;

    &:hover {
      border-color: rgba(102, 126, 234, 0.3);
      background: rgba(30, 30, 46, 0.4);
    }

    img {
      width: 100%;
      height: 100%;
      object-fit: contain;
      border-radius: 16px;
    }

    .placeholder-content {
      text-align: center;
      color: rgba(255, 255, 255, 0.4);

      .placeholder-icon {
        font-size: 64px;
        display: block;
        margin-bottom: 16px;
      }

      p {
        font-size: 16px;
        color: rgba(255, 255, 255, 0.3);
      }
    }
  }
}

// 分割线
.divider {
  width: 1px;
  height: 70%;
  background: linear-gradient(
    to bottom,
    transparent,
    rgba(255, 255, 255, 0.1),
    rgba(255, 255, 255, 0.2),
    rgba(255, 255, 255, 0.1),
    transparent
  );
  margin: 0 40px;
  flex-shrink: 0;
}

// 右侧表单区域
.login-right {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px;
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

.login-container {
  width: 420px;
  padding: 48px 40px;
  background: rgba(30, 30, 46, 0.85);
  border-radius: 24px;
  box-shadow:
    0 25px 50px -12px rgba(0, 0, 0, 0.5),
    0 0 0 1px rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(16px);
  position: relative;
  z-index: 1;
  flex-shrink: 0;
}

// 响应式设计
@media (max-width: 1024px) {
  .login-wrapper {
    flex-direction: column;
    padding: 20px;
  }

  .login-left {
    display: none;
  }

  .divider {
    display: none;
  }

  .login-right {
    width: 100%;
    padding: 20px;
  }

  .login-container {
    width: 100%;
    max-width: 420px;
  }
}

.login-header {
  text-align: center;
  margin-bottom: 32px;

  .logo-wrapper {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    margin-bottom: 12px;

    .logo-icon {
      width: 40px;
      height: 40px;
      display: block;
      filter: brightness(0) saturate(100%) invert(48%) sepia(79%) saturate(2476%) hue-rotate(222deg)
        brightness(97%) contrast(97%);
    }

    h1 {
      font-size: 32px;
      font-weight: 700;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
  }

  p {
    color: #a6adc8;
    font-size: 14px;
    margin-bottom: 16px;
  }

  .feature-tags {
    display: flex;
    justify-content: center;
    gap: 8px;

    .tag {
      padding: 4px 12px;
      background: rgba(102, 126, 234, 0.15);
      border-radius: 20px;
      font-size: 12px;
      color: #667eea;
      border: 1px solid rgba(102, 126, 234, 0.3);
    }
  }
}

.login-tabs {
  :deep(.el-tabs__header) {
    margin-bottom: 24px;
  }

  :deep(.el-tabs__nav-wrap::after) {
    display: none;
  }

  :deep(.el-tabs__active-bar) {
    background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
    height: 3px;
    border-radius: 3px;
  }

  :deep(.el-tabs__item) {
    font-size: 16px;
    font-weight: 500;
    color: #6c7086;

    &.is-active {
      color: #fff;
    }

    &:hover {
      color: #a6adc8;
    }
  }
}

.auth-form {
  .el-form-item {
    margin-bottom: 20px;
  }

  :deep(.el-input__wrapper) {
    background: rgba(255, 255, 255, 0.05);
    box-shadow: none;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    padding: 4px 12px;
    transition: all 0.3s;

    &:hover {
      border-color: rgba(102, 126, 234, 0.5);
    }

    &.is-focus {
      border-color: #667eea;
      box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.2);
    }
  }

  :deep(.el-input__prefix-inner) {
    color: #6c7086;
  }
}

.submit-btn {
  width: 100%;
  height: 48px;
  font-size: 16px;
  font-weight: 600;
  border-radius: 12px;
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
}

.login-footer {
  margin-top: 24px;
  text-align: center;

  p {
    font-size: 12px;
    color: #6c7086;
  }
}

// 注册关闭状态样式
.register-closed {
  text-align: center;
  padding: 20px 0;

  .closed-header {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    margin-bottom: 8px;
  }

  .closed-icon {
    font-size: 22px;
  }

  h3 {
    font-size: 20px;
    font-weight: 600;
    color: #fff;
    margin: 0;
  }

  p {
    font-size: 14px;
    color: #a6adc8;
    margin-bottom: 20px;
  }

  .qrcode-wrapper {
    display: flex;
    justify-content: center;

    .qrcode-image {
      max-width: 240px;
      height: auto;
      border-radius: 12px;
      border: 2px solid rgba(102, 126, 234, 0.3);
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
    }
  }
}
</style>
