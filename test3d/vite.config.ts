import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@lowcode3d/shared': fileURLToPath(
        new URL('../packages/shared/src/index.ts', import.meta.url)
      ),
    },
  },
  server: {
    port: 3333,
    open: true,
    proxy: {
      '/api': {
        target: 'https://editor3d.nicowebgl.cn',
        changeOrigin: true,
        autoRewrite: true,
        cookieDomainRewrite: 'localhost',
        configure: (proxy, options) => {
          proxy.on('proxyRes', (proxyRes, req, res) => {
            delete proxyRes.headers['access-control-allow-origin']
          })
        },
      },
      '/uploads': {
        target: 'https://editor3d.nicowebgl.cn',
        changeOrigin: true,
        autoRewrite: true,
        cookieDomainRewrite: 'localhost',
        configure: (proxy, options) => {
          proxy.on('proxyRes', (proxyRes, req, res) => {
            delete proxyRes.headers['access-control-allow-origin']
          })
        },
      },
    },
  },
})
