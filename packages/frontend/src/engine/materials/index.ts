/**
 * 材质模块导出
 */
export {
  MaterialManager,
  getMaterialManager,
  extractMaterials,
  getPrimaryMaterial,
  getMaterialProps,
} from './MaterialManager'
export {
  clearMaterialColorCycles,
  startMaterialColorCycle,
  restoreMaterialColorCycles,
  stopMaterialColorCycle,
  isMaterialColorCycleRunning,
  normalizeMaterialColorCycleConfig,
} from './MaterialColorCycleRunner'

export type { IPBRMaterialProps, TextureSlot, ITextureInfo, IMaterialInfo } from './MaterialManager'
export type {
  MaterialColorCycleConfig,
  MaterialColorCycleLoop,
  MaterialColorCycleMode,
} from './MaterialColorCycleRunner'
