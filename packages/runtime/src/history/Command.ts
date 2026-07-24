/**
 * 命令接口
 * 实现命令模式的基础接口
 */
export interface ICommand {
  /** 命令名称（用于显示） */
  readonly name: string

  /** 执行命令 */
  execute(): void

  /** 撤销命令 */
  undo(): void

  /** 是否可以与前一个命令合并 */
  canMergeWith?(command: ICommand): boolean

  /** 与前一个命令合并 */
  mergeWith?(command: ICommand): void
}

/**
 * 命令基类
 * 提供命令的基础实现
 */
export abstract class BaseCommand implements ICommand {
  abstract readonly name: string

  abstract execute(): void
  abstract undo(): void

  canMergeWith(_command: ICommand): boolean {
    return false
  }

  mergeWith(_command: ICommand): void {
    // 默认不合并
  }
}
