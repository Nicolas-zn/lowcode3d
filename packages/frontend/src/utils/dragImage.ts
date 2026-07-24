/**
 * 拖拽影像工具
 * 将浏览器默认的拖拽影子替换为透明图，避免遮挡画布预览
 */
let transparentDragImage: HTMLCanvasElement | null = null

function getTransparentDragImage(): HTMLCanvasElement {
  if (transparentDragImage) return transparentDragImage

  const canvas = document.createElement('canvas')
  canvas.width = 1
  canvas.height = 1

  const context = canvas.getContext('2d')
  if (context) {
    context.clearRect(0, 0, 1, 1)
  }

  transparentDragImage = canvas
  return canvas
}

export function setTransparentDragImage(event: DragEvent): void {
  if (!event.dataTransfer) return
  event.dataTransfer.setDragImage(getTransparentDragImage(), 0, 0)
}
