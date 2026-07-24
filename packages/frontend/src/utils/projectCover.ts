const PROJECT_COVER_WIDTH = 960
const PROJECT_COVER_HEIGHT = 540
const PROJECT_COVER_QUALITY = 0.84

function loadImage(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('封面图片读取失败'))
    image.src = source
  })
}

function drawCoverImage(image: HTMLImageElement): string {
  const canvas = document.createElement('canvas')
  canvas.width = PROJECT_COVER_WIDTH
  canvas.height = PROJECT_COVER_HEIGHT

  const context = canvas.getContext('2d')
  if (!context) {
    throw new Error('当前浏览器不支持封面图片处理')
  }

  context.fillStyle = '#15181d'
  context.fillRect(0, 0, canvas.width, canvas.height)

  const sourceRatio = image.naturalWidth / image.naturalHeight
  const targetRatio = canvas.width / canvas.height
  const drawHeight = sourceRatio > targetRatio ? canvas.height : canvas.width / sourceRatio
  const drawWidth = sourceRatio > targetRatio ? canvas.height * sourceRatio : canvas.width
  const offsetX = (canvas.width - drawWidth) / 2
  const offsetY = (canvas.height - drawHeight) / 2

  context.drawImage(image, offsetX, offsetY, drawWidth, drawHeight)

  return canvas.toDataURL('image/jpeg', PROJECT_COVER_QUALITY)
}

export async function imageFileToProjectCoverDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('请选择 PNG、JPG 或 WebP 图片')
  }

  const objectUrl = URL.createObjectURL(file)
  try {
    const image = await loadImage(objectUrl)
    return drawCoverImage(image)
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

export async function dataUrlToProjectCoverDataUrl(dataUrl: string): Promise<string> {
  const image = await loadImage(dataUrl)
  return drawCoverImage(image)
}
