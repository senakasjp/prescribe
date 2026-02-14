const clamp = (value, min, max) => Math.min(max, Math.max(min, value))

const fallbackNormalizedCorners = [
  { x: 0.08, y: 0.08 },
  { x: 0.92, y: 0.08 },
  { x: 0.92, y: 0.92 },
  { x: 0.08, y: 0.92 }
]

export const detectDocumentCornersFromImageData = (imageData) => {
  const width = Number(imageData?.width || 0)
  const height = Number(imageData?.height || 0)
  const data = imageData?.data

  if (!width || !height || !data || data.length < width * height * 4) {
    return fallbackNormalizedCorners
  }

  const luma = new Float32Array(width * height)
  let sum = 0
  let sumSq = 0

  for (let i = 0, p = 0; i < luma.length; i += 1, p += 4) {
    const lum = 0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2]
    luma[i] = lum
    sum += lum
    sumSq += lum * lum
  }

  const mean = sum / luma.length
  const variance = Math.max(0, (sumSq / luma.length) - (mean * mean))
  const std = Math.sqrt(variance)
  const darkThreshold = clamp(mean - (std * 0.35), 35, 165)

  const rowRatio = new Float32Array(height)
  const colRatio = new Float32Array(width)
  let maxRowRatio = 0
  let maxColRatio = 0

  for (let y = 0; y < height; y += 1) {
    let darkCount = 0
    const rowOffset = y * width
    for (let x = 0; x < width; x += 1) {
      if (luma[rowOffset + x] <= darkThreshold) {
        darkCount += 1
      }
    }
    rowRatio[y] = darkCount / width
    if (rowRatio[y] > maxRowRatio) maxRowRatio = rowRatio[y]
  }

  for (let x = 0; x < width; x += 1) {
    let darkCount = 0
    for (let y = 0; y < height; y += 1) {
      if (luma[y * width + x] <= darkThreshold) {
        darkCount += 1
      }
    }
    colRatio[x] = darkCount / height
    if (colRatio[x] > maxColRatio) maxColRatio = colRatio[x]
  }

  const minRowRatio = Math.max(0.008, maxRowRatio * 0.2)
  const minColRatio = Math.max(0.008, maxColRatio * 0.2)

  let top = -1
  let bottom = -1
  let left = -1
  let right = -1

  for (let y = 0; y < height; y += 1) {
    if (rowRatio[y] >= minRowRatio) {
      top = y
      break
    }
  }
  for (let y = height - 1; y >= 0; y -= 1) {
    if (rowRatio[y] >= minRowRatio) {
      bottom = y
      break
    }
  }
  for (let x = 0; x < width; x += 1) {
    if (colRatio[x] >= minColRatio) {
      left = x
      break
    }
  }
  for (let x = width - 1; x >= 0; x -= 1) {
    if (colRatio[x] >= minColRatio) {
      right = x
      break
    }
  }

  if (top < 0 || bottom < 0 || left < 0 || right < 0 || bottom <= top || right <= left) {
    return fallbackNormalizedCorners
  }

  // For text areas keep very small padding so overlay tracks content edges.
  const padX = Math.round((right - left) * 0.01)
  const padY = Math.round((bottom - top) * 0.01)

  const paddedLeft = clamp(left - padX, 0, width - 1)
  const paddedRight = clamp(right + padX, 0, width - 1)
  const paddedTop = clamp(top - padY, 0, height - 1)
  const paddedBottom = clamp(bottom + padY, 0, height - 1)

  return [
    { x: paddedLeft / width, y: paddedTop / height },
    { x: paddedRight / width, y: paddedTop / height },
    { x: paddedRight / width, y: paddedBottom / height },
    { x: paddedLeft / width, y: paddedBottom / height }
  ]
}

export const detectDocumentCornersFromDataUrl = async (dataUrl) => {
  const source = String(dataUrl || '').trim()
  if (!source) {
    return fallbackNormalizedCorners
  }

  if (typeof Image === 'undefined' || typeof document === 'undefined') {
    return fallbackNormalizedCorners
  }

  const image = await new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = source
  })

  const maxDimension = 900
  const scale = Math.min(1, maxDimension / Math.max(image.width || 1, image.height || 1))
  const width = Math.max(1, Math.round(image.width * scale))
  const height = Math.max(1, Math.round(image.height * scale))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) {
    return fallbackNormalizedCorners
  }

  ctx.drawImage(image, 0, 0, width, height)
  const imageData = ctx.getImageData(0, 0, width, height)
  return detectDocumentCornersFromImageData(imageData)
}

export const createSelectedAreaDataUrl = async (dataUrl, normalizedCorners = []) => {
  const source = String(dataUrl || '').trim()
  if (!source || !Array.isArray(normalizedCorners) || normalizedCorners.length !== 4) {
    return null
  }

  if (typeof Image === 'undefined' || typeof document === 'undefined') {
    return null
  }

  const image = await new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = source
  })

  const points = normalizedCorners.map((corner) => ({
    x: clamp(Number(corner?.x || 0), 0, 1) * image.width,
    y: clamp(Number(corner?.y || 0), 0, 1) * image.height
  }))

  const xs = points.map((p) => p.x)
  const ys = points.map((p) => p.y)
  const minX = Math.floor(Math.max(0, Math.min(...xs)))
  const maxX = Math.ceil(Math.min(image.width, Math.max(...xs)))
  const minY = Math.floor(Math.max(0, Math.min(...ys)))
  const maxY = Math.ceil(Math.min(image.height, Math.max(...ys)))

  const cropWidth = Math.max(1, maxX - minX)
  const cropHeight = Math.max(1, maxY - minY)

  const canvas = document.createElement('canvas')
  canvas.width = cropWidth
  canvas.height = cropHeight
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    return null
  }

  ctx.save()
  ctx.beginPath()
  ctx.moveTo(points[0].x - minX, points[0].y - minY)
  ctx.lineTo(points[1].x - minX, points[1].y - minY)
  ctx.lineTo(points[2].x - minX, points[2].y - minY)
  ctx.lineTo(points[3].x - minX, points[3].y - minY)
  ctx.closePath()
  ctx.clip()

  ctx.drawImage(image, -minX, -minY)
  ctx.restore()

  return canvas.toDataURL('image/png')
}
