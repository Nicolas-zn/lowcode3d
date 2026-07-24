import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.tsx'),
      name: 'LowCode3DReact',
      fileName: 'lowcode3d-react',
    },
    rollupOptions: {
      external: ['react', 'react-dom', '@lowcode3d/runtime'],
      output: {
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM',
          '@lowcode3d/runtime': 'LowCode3DRuntime',
        },
      },
    },
  },
})
