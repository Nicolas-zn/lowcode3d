import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const frontendRoot = resolve(__dirname, '..')
const repoRoot = resolve(frontendRoot, '../..')

function readSource(relativePath) {
  return readFileSync(resolve(repoRoot, relativePath), 'utf8')
}

function assertFileExists(relativePath, message) {
  assert.equal(existsSync(resolve(repoRoot, relativePath)), true, message)
}

const viteConfig = readSource('packages/frontend/vite.config.ts')
const toolbar = readSource('packages/frontend/src/components/layout/Toolbar.vue')
const leftSidebar = readSource('packages/frontend/src/components/layout/LeftSidebar.vue')
const rightSidebar = readSource('packages/frontend/src/components/layout/RightSidebar.vue')
const tokens = readSource('packages/frontend/src/assets/styles/tokens.scss')
const editorIconButton = readSource(
  'packages/frontend/src/components/common/EditorIconButton.vue'
)
const axisInputGroup = readSource('packages/frontend/src/components/common/AxisInputGroup.vue')
const editorIcons = readSource('packages/frontend/src/constants/editorIcons.ts')
const myProjects = readSource('packages/frontend/src/views/assets/MyProjects.vue')
const assetsIndex = readSource('packages/frontend/src/views/assets/index.vue')
const projectsApi = readSource('packages/frontend/src/api/projects.ts')
const projectStore = readSource('packages/frontend/src/stores/projectStore.ts')
const projectService = readSource('packages/backend/src/services/ProjectService.ts')
const projectRoutes = readSource('packages/backend/src/routes/projects.ts')

assert.match(viteConfig, /unplugin-icons\/vite/, 'Vite should register unplugin-icons')
assert.match(viteConfig, /unplugin-icons\/resolver/, 'Vite should register IconsResolver')
assert.match(
  viteConfig,
  /enabledCollections:\s*\[['"]lucide['"],\s*['"]mdi['"],\s*['"]carbon['"]\]/,
  'Iconify collections should be explicitly limited'
)
assert.match(viteConfig, /autoInstall:\s*false/, 'Iconify auto install should stay disabled')
assert.match(
  editorIconButton,
  /@iconify\/vue/,
  'EditorIconButton should render icons with the Iconify Vue component'
)
assert.match(
  editorIconButton,
  /inheritAttrs:\s*false/,
  'EditorIconButton should prevent accessibility attrs from falling through to ElTooltip'
)
assert.match(
  editorIconButton,
  /v-bind="\$attrs"/,
  'EditorIconButton should bind fallthrough attrs to its native button'
)
assert.match(
  editorIconButton,
  /<span class="editor-icon-button__trigger">[\s\S]*<el-tooltip/,
  'EditorIconButton should expose a native element root for runtime directives'
)
assert.doesNotMatch(
  editorIcons,
  /~icons\//,
  'editor icon mapping should use Iconify icon names instead of virtual component imports'
)

assertFileExists(
  'packages/frontend/src/components/common/EditorIconButton.vue',
  'EditorIconButton should exist'
)
assertFileExists(
  'packages/frontend/src/components/common/EditorPanelShell.vue',
  'EditorPanelShell should exist'
)
assertFileExists(
  'packages/frontend/src/components/common/EditorPanelHeader.vue',
  'EditorPanelHeader should exist'
)
assertFileExists(
  'packages/frontend/src/components/common/EditorSidebarNav.vue',
  'EditorSidebarNav should exist'
)
assertFileExists(
  'packages/frontend/src/components/common/EditorSection.vue',
  'EditorSection should exist'
)
assertFileExists(
  'packages/frontend/src/components/common/AxisInputGroup.vue',
  'AxisInputGroup should exist'
)
assertFileExists(
  'packages/frontend/src/constants/editorIcons.ts',
  'editor icon mapping should exist'
)

assert.match(leftSidebar, /EditorSidebarNav/, 'LeftSidebar should use EditorSidebarNav')
assert.match(leftSidebar, /EditorPanelShell/, 'LeftSidebar should use EditorPanelShell')
assert.doesNotMatch(
  leftSidebar,
  /<ModelLibrary[\s\S]*:columns=["']3["']/,
  'LeftSidebar should not force ModelLibrary to three columns'
)
assert.match(toolbar, /设为封面/, 'Toolbar should expose the cover action')
assert.match(toolbar, /ScreenshotExporter/, 'Toolbar should capture the scene for cover images')
assert.match(toolbar, /handleSetCover/, 'Toolbar should expose a set-cover action')
assert.match(toolbar, /设为封面[\s\S]*预览/, 'Cover action should sit before preview in the toolbar')

assert.match(rightSidebar, /EditorPanelHeader/, 'RightSidebar should use EditorPanelHeader')
assert.match(rightSidebar, /EditorIconButton/, 'RightSidebar should use EditorIconButton')
assert.match(rightSidebar, /EditorSection/, 'RightSidebar should use EditorSection')
assert.match(rightSidebar, /AxisInputGroup/, 'RightSidebar should use AxisInputGroup')
assert.doesNotMatch(
  rightSidebar,
  /el-collapse-item\s+title=["']变换["']/,
  'RightSidebar transform section should not use the default Element Plus collapse header'
)
assert.match(
  rightSidebar,
  /overflow-x:\s*hidden/,
  'RightSidebar should suppress horizontal overflow'
)
assert.match(
  rightSidebar,
  /\.property-row[\s\S]*min-width:\s*0/,
  'RightSidebar property rows should be able to shrink inside narrow panel widths'
)
assert.match(
  rightSidebar,
  /\.property-label[\s\S]*font-size:\s*13px/,
  'RightSidebar property labels should be readable at editor panel density'
)
assert.match(
  axisInputGroup,
  /\.axis-input-group[\s\S]*min-width:\s*0/,
  'AxisInputGroup should shrink without forcing a horizontal scrollbar'
)
assert.match(
  axisInputGroup,
  /\.el-input-number[\s\S]*min-width:\s*0/,
  'AxisInputGroup numeric inputs should shrink inside the inspector'
)
assert.match(
  axisInputGroup,
  /\.el-input__inner[\s\S]*font-size:\s*13px/,
  'AxisInputGroup values should use a readable inspector font size'
)

assert.match(tokens, /--lc-panel-header-height/, 'Panel header token should exist')
assert.match(tokens, /--lc-control-height-sm/, 'Panel control height token should exist')
assert.match(
  myProjects,
  /imageFileToProjectCoverDataUrl/,
  'MyProjects should let users upload a replacement cover image'
)
assert.match(
  myProjects,
  /thumbnailUrl:\s*project\.thumbnailUrl \|\| ''/,
  'MyProjects should preload the current cover when editing'
)
assert.match(
  assetsIndex,
  /imageFileToProjectCoverDataUrl/,
  'Assets page should let users attach a cover image on create'
)
assert.match(
  projectsApi,
  /thumbnailUrl\?: string \| null/,
  'Project API should carry nullable thumbnail URLs'
)
assert.match(
  projectStore,
  /projectsApi\.createProject\(data\)/,
  'Project store should create projects in a single request'
)
assert.match(
  projectService,
  /thumbnailUrl:\s*data\.thumbnailUrl \?\? null/,
  'Project service should persist thumbnail URLs on create'
)
assert.match(
  projectRoutes,
  /thumbnailUrl:\s*\{ type: \['string', 'null'\], maxLength: 2000000 \}/,
  'Project routes should allow large thumbnail data URLs'
)
