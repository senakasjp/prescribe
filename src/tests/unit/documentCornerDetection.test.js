import { describe, expect, it } from 'vitest'
import { detectDocumentCornersFromImageData, normalizeCornerOrder } from '../../utils/documentCornerDetection.js'

const fallbackCorners = [
  { x: 0.08, y: 0.08 },
  { x: 0.92, y: 0.08 },
  { x: 0.92, y: 0.92 },
  { x: 0.08, y: 0.92 }
]

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
    expect(corners).toEqual(fallbackCorners)
  })

  it('returns fallback corners for very low-signal image data', () => {
    const width = 80
    const height = 60
    const data = new Uint8ClampedArray(width * height * 4)
    for (let i = 0; i < data.length; i += 4) {
      data[i] = 220
      data[i + 1] = 220
      data[i + 2] = 220
      data[i + 3] = 255
    }

    const corners = detectDocumentCornersFromImageData({ data, width, height })
    expect(corners).toEqual(fallbackCorners)
  })

  it('always returns corners within normalized bounds', () => {
    const imageData = createImageDataWithTextBlock(40, 30, {
      left: 0,
      top: 0,
      right: 39,
      bottom: 29
    })

    const corners = detectDocumentCornersFromImageData(imageData)
    expect(corners).toHaveLength(4)
    for (const corner of corners) {
      expect(corner.x).toBeGreaterThanOrEqual(0)
      expect(corner.x).toBeLessThanOrEqual(1)
      expect(corner.y).toBeGreaterThanOrEqual(0)
      expect(corner.y).toBeLessThanOrEqual(1)
    }
  })
})

describe('normalizeCornerOrder', () => {
  it('reorders arbitrary corner input to top-left, top-right, bottom-right, bottom-left', () => {
    const corners = [
      { x: 0.9, y: 0.85 }, // BR
      { x: 0.12, y: 0.88 }, // BL
      { x: 0.86, y: 0.1 }, // TR
      { x: 0.1, y: 0.12 } // TL
    ]

    const ordered = normalizeCornerOrder(corners)

    expect(ordered[0].x + ordered[0].y).toBeLessThan(0.4) // TL
    expect(ordered[1].x).toBeGreaterThan(0.7) // TR
    expect(ordered[1].y).toBeLessThan(0.3)
    expect(ordered[2].x + ordered[2].y).toBeGreaterThan(1.5) // BR
    expect(ordered[3].x).toBeLessThan(0.3) // BL
    expect(ordered[3].y).toBeGreaterThan(0.7)
  })

  it('returns fallback corners when input length is invalid', () => {
    expect(normalizeCornerOrder([])).toEqual(fallbackCorners)
    expect(normalizeCornerOrder([{ x: 0.1, y: 0.1 }])).toEqual(fallbackCorners)
  })

  it('clamps out-of-range corner values before ordering', () => {
    const corners = [
      { x: -0.5, y: -0.5 },
      { x: 1.4, y: -0.2 },
      { x: 1.6, y: 1.3 },
      { x: -0.2, y: 1.8 }
    ]

    const ordered = normalizeCornerOrder(corners)
    for (const corner of ordered) {
      expect(corner.x).toBeGreaterThanOrEqual(0)
      expect(corner.x).toBeLessThanOrEqual(1)
      expect(corner.y).toBeGreaterThanOrEqual(0)
      expect(corner.y).toBeLessThanOrEqual(1)
    }
    expect(ordered[0].x + ordered[0].y).toBeLessThanOrEqual(0.05)
    expect(ordered[2].x + ordered[2].y).toBeGreaterThanOrEqual(1.95)
  })

  it('preserves logical order when corners are already ordered', () => {
    const corners = [
      { x: 0.15, y: 0.2 }, // TL
      { x: 0.85, y: 0.22 }, // TR
      { x: 0.82, y: 0.88 }, // BR
      { x: 0.18, y: 0.9 } // BL
    ]

    const ordered = normalizeCornerOrder(corners)
    expect(ordered[0]).toEqual(corners[0])
    expect(ordered[1]).toEqual(corners[1])
    expect(ordered[2]).toEqual(corners[2])
    expect(ordered[3]).toEqual(corners[3])
  })
})
