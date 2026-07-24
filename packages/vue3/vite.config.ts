import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'LowCode3DVue3',
      fileName: 'lowcode3d-vue3',
    },
    rollupOptions: {
      external: ['vue', '@lowcode3d/runtime'],
      output: {
        globals: {
          vue: 'Vue',
          '@lowcode3d/runtime': 'LowCode3DRuntime',
        },
      },
    },
  },
})
