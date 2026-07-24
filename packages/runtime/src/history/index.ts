/**
 * 历史记录模块导出
 */
export type { ICommand } from './Command'
export { BaseCommand } from './Command'
export { HistoryManager, getHistoryManager } from './HistoryManager'
export type { IHistoryChangeEvent, IHistoryManagerConfig } from './HistoryManager'

// 具体命令
export {
  TransformCommand,
  AddObjectCommand,
  RemoveObjectCommand,
  PropertyChangeCommand,
  CompositeCommand,
  ReparentObjectCommand,
  GroupObjectsCommand,
  UngroupObjectsCommand,
  MaterialChangeCommand,
  LightChangeCommand,
  AnimationCommand,
} from './commands'
