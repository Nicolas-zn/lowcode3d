import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'
import Icons from 'unplugin-icons/vite'
import IconsResolver from 'unplugin-icons/resolver'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  base: './',
  plugins: [
    vue(),
    AutoImport({
      imports: ['vue', 'vue-router', 'pinia'],
      resolvers: [ElementPlusResolver()],
      dts: 'src/auto-imports.d.ts',
    }),
    Components({
      resolvers: [
        ElementPlusResolver(),
        IconsResolver({
          prefix: 'i',
          enabledCollections: ['lucide', 'mdi', 'carbon'],
        }),
      ],
      dts: 'src/components.d.ts',
    }),
    Icons({
      compiler: 'vue3',
      scale: 1,
      defaultClass: 'lc-icon',
      autoInstall: false,
    }),
  ],
  // 打包
  build: {
    outDir: './editor3d',
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          // 将 engine 相关模块打包到同一个 chunk，避免循环依赖警告
          if (id.includes('/engine/')) {
            return 'engine'
          }
          // 将 three.js 单独打包
          if (id.includes('node_modules/three')) {
            return 'three'
          }
          // 将 Element Plus 单独打包
          if (id.includes('node_modules/element-plus')) {
            return 'element-plus'
          }
          // 将 Vue 相关库单独打包
          if (id.includes('node_modules/vue') || id.includes('node_modules/@vue')) {
            return 'vue-vendor'
          }
          // 将其他 node_modules 打包到 vendor
          if (id.includes('node_modules')) {
            return 'vendor'
          }
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 3005,
    host: true,
    // proxy: {
    //   '/api': {
    //     target: 'https://editor3d.nicowebgl.cn',
    //     changeOrigin: true,
    //     autoRewrite: true,
    //     cookieDomainRewrite: 'localhost',
    //     configure: (proxy, options) => {
    //       proxy.on('proxyRes', (proxyRes, req, res) => {
    //         delete proxyRes.headers['access-control-allow-origin']
    //       })
    //     },
    //   },
    //   '/uploads': {
    //     target: 'https://editor3d.nicowebgl.cn',
    //     changeOrigin: true,
    //     autoRewrite: true,
    //     cookieDomainRewrite: 'localhost',
    //     configure: (proxy, options) => {
    //       proxy.on('proxyRes', (proxyRes, req, res) => {
    //         delete proxyRes.headers['access-control-allow-origin']
    //       })
    //     },
    //   },
    // },
    proxy: {
      '/api': {
        target: 'http://localhost:4001',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://localhost:4001',
        changeOrigin: true,
      },
    },
  },
  css: {
    preprocessorOptions: {
      scss: {
        additionalData: `@import "@/assets/styles/variables.scss";`,
        silenceDeprecations: ['legacy-js-api', 'import'],
      },
    },
  },
})
