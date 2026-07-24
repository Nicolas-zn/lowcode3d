import { defineConfig } from 'vite'
import vue2 from '@vitejs/plugin-vue2'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue2()],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.js'),
      name: 'LowCode3DVue2',
      fileName: 'lowcode3d-vue2',
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
