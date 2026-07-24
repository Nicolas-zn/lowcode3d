# v1.4 Side Panels UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the P0 slice from `packages/frontend/roadmap/1.4-ui.md`: Iconify setup, editor panel primitives, left sidebar visual architecture, model library two-column correction, and right Inspector header/section/axis input modernization.

**Architecture:** Keep Element Plus for form controls and feedback, but wrap editor-specific surfaces in local components under `packages/frontend/src/components/common/`. Use Iconify components through `unplugin-icons` and central icon mapping. Migrate the left and right sidebars incrementally without changing engine, selection, or CommandBus behavior.

**Tech Stack:** Vue 3, Vite, TypeScript, SCSS, Element Plus, unplugin-vue-components, unplugin-icons, Iconify collections.

---

### Task 1: Add Layout Regression Tests

**Files:**

- Create: `packages/frontend/tests/v1.4-ui-layout.spec.mjs`

- [x] **Step 1: Write failing source-level tests**

Create `packages/frontend/tests/v1.4-ui-layout.spec.mjs` with assertions that require:

- `vite.config.ts` to import and register `unplugin-icons`.
- `LeftSidebar.vue` to stop passing `:columns="3"` to `ModelLibrary`.
- new panel primitives to exist.
- `RightSidebar.vue` to use `InspectorHeader`, `EditorSection`, and `AxisInputGroup`.

- [x] **Step 2: Run the test to verify it fails**

Run: `node packages/frontend/tests/v1.4-ui-layout.spec.mjs`

Expected: FAIL because the icon plugin and new components are not implemented yet.

### Task 2: Install and Configure Iconify

**Files:**

- Modify: `packages/frontend/package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `packages/frontend/vite.config.ts`

- [x] **Step 1: Install dependencies**

Run: `pnpm --filter @lowcode3d/frontend add -D unplugin-icons @iconify-json/lucide @iconify-json/mdi @iconify-json/carbon`

- [x] **Step 2: Configure Vite**

Update `packages/frontend/vite.config.ts`:

- import `Icons from 'unplugin-icons/vite'`
- import `IconsResolver from 'unplugin-icons/resolver'`
- add `IconsResolver({ prefix: 'i', enabledCollections: ['lucide', 'mdi', 'carbon'] })` to `Components` resolvers
- add `Icons({ compiler: 'vue3', scale: 1, defaultClass: 'lc-icon', autoInstall: false })` after `Components`

- [x] **Step 3: Run the layout test**

Run: `node packages/frontend/tests/v1.4-ui-layout.spec.mjs`

Expected: still FAIL because components are not created yet.

### Task 3: Add Editor Panel Primitives

**Files:**

- Create: `packages/frontend/src/components/common/EditorIconButton.vue`
- Create: `packages/frontend/src/components/common/EditorPanelShell.vue`
- Create: `packages/frontend/src/components/common/EditorPanelHeader.vue`
- Create: `packages/frontend/src/components/common/EditorSidebarNav.vue`
- Create: `packages/frontend/src/components/common/EditorSection.vue`
- Create: `packages/frontend/src/components/common/AxisInputGroup.vue`
- Create: `packages/frontend/src/constants/editorIcons.ts`
- Modify: `packages/frontend/src/assets/styles/tokens.scss`

- [x] **Step 1: Add icon mapping**

Create `editorIcons.ts` with navigation, inspector, and action icon tag names.

- [x] **Step 2: Add common components**

Create small, focused Vue components:

- `EditorIconButton`: renders a dynamic Iconify component in an Element Plus tooltip.
- `EditorPanelShell`: consistent sidebar background, header slot, content slot.
- `EditorPanelHeader`: icon, title, optional subtitle, action slots.
- `EditorSidebarNav`: config-driven vertical navigation.
- `EditorSection`: custom collapsible section visual.
- `AxisInputGroup`: X/Y/Z input-number group preserving `@change` handlers.

- [x] **Step 3: Add panel tokens**

Extend `tokens.scss` with panel header, section, row, icon, and control sizing tokens.

- [x] **Step 4: Run the layout test**

Run: `node packages/frontend/tests/v1.4-ui-layout.spec.mjs`

Expected: still FAIL until sidebars are migrated.

### Task 4: Migrate Left Sidebar Shell and Navigation

**Files:**

- Modify: `packages/frontend/src/components/layout/LeftSidebar.vue`

- [x] **Step 1: Replace Element Plus navigation icons**

Use `EditorSidebarNav` with a local `sidebarTabs` config array.

- [x] **Step 2: Wrap content in editor panel shell/header**

Use `EditorPanelShell` and `EditorPanelHeader` for the content side.

- [x] **Step 3: Fix model library columns**

Remove `:columns="3"` from `ModelLibrary` or set `:columns="2"`.

- [x] **Step 4: Run the layout test**

Run: `node packages/frontend/tests/v1.4-ui-layout.spec.mjs`

Expected: still FAIL until right sidebar is migrated.

### Task 5: Migrate Right Sidebar P0 Surfaces

**Files:**

- Modify: `packages/frontend/src/components/layout/RightSidebar.vue`

- [x] **Step 1: Replace object headers**

Use `InspectorHeader`-style markup through `EditorPanelHeader` and `EditorIconButton` for single selection and multi-selection states.

- [x] **Step 2: Replace Transform collapse sections**

Use `EditorSection` for Transform and batch operations first.

- [x] **Step 3: Replace Transform axis rows**

Use `AxisInputGroup` for position, rotation, and scale in both single and multi selection states.

- [x] **Step 4: Preserve behavior**

Keep all current handlers:

- `handlePositionChange`
- `handleRotationChange`
- `handleScaleChange`
- `handleMultiPositionChange`
- `handleMultiRotationChange`
- `handleMultiScaleChange`
- `handleVisibleChange`
- `handleLockToggle`
- `handleFocusSelected`
- `handleFocusMultiSelection`

- [x] **Step 5: Run the layout test**

Run: `node packages/frontend/tests/v1.4-ui-layout.spec.mjs`

Expected: PASS.

### Task 6: Verify Build

**Files:**

- Verify all changed frontend files.

- [x] **Step 1: Run source-level layout test**

Run: `node packages/frontend/tests/v1.4-ui-layout.spec.mjs`

Expected: PASS.

- [x] **Step 2: Run frontend build**

Run: `pnpm --filter @lowcode3d/frontend build`

Expected: PASS.

- [x] **Step 3: Start or reuse dev server**

Run: `pnpm --filter @lowcode3d/frontend dev --host 0.0.0.0`

Expected: Vite prints a local URL.
