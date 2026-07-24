import type { AnimationData, AnimationEngine } from '../../animation'
import { BaseCommand } from '../Command'

export class AnimationCommand extends BaseCommand {
  readonly name: string
  private readonly engine: AnimationEngine
  private readonly beforeData: AnimationData
  private readonly afterData: AnimationData

  constructor(
    name: string,
    engine: AnimationEngine,
    beforeData: AnimationData,
    afterData: AnimationData
  ) {
    super()
    this.name = name
    this.engine = engine
    this.beforeData = cloneAnimationData(beforeData)
    this.afterData = cloneAnimationData(afterData)
  }

  execute(): void {
    this.engine.fromJSON(cloneAnimationData(this.afterData))
  }

  undo(): void {
    this.engine.fromJSON(cloneAnimationData(this.beforeData))
  }
}

function cloneAnimationData(data: AnimationData): AnimationData {
  return structuredClone(data)
}
