<template>
  <section class="editor-panel-shell">
    <header v-if="$slots.header" class="editor-panel-shell__header">
      <slot name="header" />
    </header>
    <div class="editor-panel-shell__body">
      <slot />
    </div>
  </section>
</template>

<style scoped lang="scss">
.editor-panel-shell {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  background: var(--lc-bg-panel);

  &__header {
    flex-shrink: 0;
    border-bottom: 1px solid var(--lc-border-subtle);
    background: var(--lc-bg-panel-raised);
  }

  &__body {
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }
}
</style>
