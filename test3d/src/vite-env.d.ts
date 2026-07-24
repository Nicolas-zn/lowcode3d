/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

declare module '@lowcode3d/vue3' {
  import type { DefineComponent } from 'vue'
  export const LowCode3DViewer: DefineComponent<{
    config: any
    models?: Array<{ name: string; url: string }>
    options?: {
      backgroundColor?: string
      enableShadows?: boolean
      antialias?: boolean
      pixelRatio?: number
    }
  }>
  export const install: (app: any) => void
}
