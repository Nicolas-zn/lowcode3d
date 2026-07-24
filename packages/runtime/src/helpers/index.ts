/**
 * 辅助工具模块导出
 */
export { HelperManager, getHelperManager, type IHelperConfig } from './HelperManager'
export {
  HotkeyManager,
  getHotkeyManager,
  DEFAULT_HOTKEYS,
  type IHotkeyConfig,
  type HotkeyHandler,
} from './HotkeyManager'
export {
  SnappingManager,
  getSnappingManager,
  SNAPPING_PRESETS,
  type ISnappingConfig,
  type SnappingPreset,
} from './SnappingManager'
