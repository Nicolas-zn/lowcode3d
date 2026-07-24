<template>
  <div ref="container" style="width: 100%; height: 100%; overflow: hidden"></div>
</template>

<script>
import { LowCode3DViewer } from '@lowcode3d/runtime'

export default {
  name: 'LowCode3DViewer',
  props: {
    config: {
      type: Object,
      default: () => null,
    },
    models: {
      type: Array,
      default: () => [],
    },
    options: {
      type: Object,
      default: () => ({}),
    },
  },
  data() {
    return {
      viewer: null,
    }
  },
  watch: {
    config: {
      deep: true,
      async handler(newVal) {
        if (this.viewer && newVal) {
          await this.viewer.loadScene(newVal, this.models)
        }
      },
    },
  },
  async mounted() {
    this.viewer = new LowCode3DViewer(this.$refs.container)
    await this.viewer.init(this.options)

    if (this.config) {
      await this.viewer.loadScene(this.config, this.models)
    }
  },
  beforeUnmount() {
    if (this.viewer) {
      this.viewer.dispose()
      this.viewer = null
    }
  },
}
</script>
