import LowCode3DViewer from './LowCode3DViewer.vue'

export { LowCode3DViewer }

export const install = (app: any) => {
  app.component('LowCode3DViewer', LowCode3DViewer)
}

export default {
  install,
  LowCode3DViewer,
}
