import { describe, expect, it } from 'vitest'
import { detectDocumentCornersFromImageData } from '../../utils/documentCornerDetection.js'

const createImageDataWithTextBlock = (width, height, rect) => {
  const data = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const idx = (y * width + x) * 4
      const withinTextBox = x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom
      const textLineBand = withinTextBox && ((y - rect.top) % 9 <= 2)
      const textColumnBand = withinTextBox && ((x - rect.left) % 11 <= 1)
      const isInk = textLineBand || textColumnBand
      const value = isInk ? 20 : 240
      data[idx] = value
      data[idx + 1] = value
      data[idx + 2] = value
      data[idx + 3] = 255
    }
  }
  return { data, width, height }
}

describe('detectDocumentCornersFromImageData', () => {
  it('detects four corners close to text area bounds', () => {
    const imageData = createImageDataWithTextBlock(120, 100, {
      left: 24,
      top: 18,
      right: 96,
      bottom: 82
    })

    const corners = detectDocumentCornersFromImageData(imageData)
    expect(corners).toHaveLength(4)

    expect(corners[0].x).toBeGreaterThan(0.15)
    expect(corners[0].x).toBeLessThan(0.28)
    expect(corners[0].y).toBeGreaterThan(0.12)
    expect(corners[0].y).toBeLessThan(0.25)

    expect(corners[2].x).toBeGreaterThan(0.75)
    expect(corners[2].x).toBeLessThan(0.86)
    expect(corners[2].y).toBeGreaterThan(0.72)
    expect(corners[2].y).toBeLessThan(0.9)
  })

  it('returns fallback corners for invalid image data', () => {
    const corners = detectDocumentCornersFromImageData({ data: null, width: 0, height: 0 })
    expect(corners).toEqual([
      { x: 0.08, y: 0.08 },
      { x: 0.92, y: 0.08 },
      { x: 0.92, y: 0.92 },
      { x: 0.08, y: 0.92 }
    ])
  })
})
