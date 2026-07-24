import { BaseCommand, type ICommand } from '../Command'

/**
 * 组合命令
 * 将多个小命令作为一次用户操作进入历史栈。
 */
export class CompositeCommand extends BaseCommand {
  readonly name: string
  private _commands: ICommand[]

  constructor(name: string, commands: ICommand[]) {
    super()
    this.name = name
    this._commands = commands
  }

  execute(): void {
    this._commands.forEach((command) => command.execute())
  }

  undo(): void {
    ;[...this._commands].reverse().forEach((command) => command.undo())
  }
}
