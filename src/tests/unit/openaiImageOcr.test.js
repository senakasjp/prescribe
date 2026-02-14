import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../services/aiTokenTracker.js', () => ({
  default: {
    trackUsage: vi.fn(async () => ({}))
  }
}))

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(() => ({ path: 'aiPromptLogs' })),
  addDoc: vi.fn(async () => ({ id: 'log-1' })),
  getDocs: vi.fn(async () => ({ docs: [] })),
  query: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn()
}))

vi.mock('../../firebase-config.js', () => ({
  db: {},
  auth: {}
}))

describe('openaiService extractTextFromImage', () => {
  let openaiService

  beforeEach(async () => {
    vi.clearAllMocks()
    const module = await import('../../services/openaiService.js')
    openaiService = module.default
  })

  it('builds a vision request and returns OCR text', async () => {
    vi.spyOn(openaiService, 'isConfigured').mockReturnValue(true)
    const makeRequestSpy = vi.spyOn(openaiService, 'makeOpenAIRequest').mockResolvedValue({
      choices: [{ message: { content: 'HB: 11.2 g/dL\nTSH: 3.4' } }],
      usage: { total_tokens: 45 },
      __fromCache: false
    })

    const imageDataUrl = 'data:image/jpeg;base64,AAA'
    const result = await openaiService.extractTextFromImage(imageDataUrl, 'doc-123')

    expect(makeRequestSpy).toHaveBeenCalledTimes(1)
    const [, requestBody] = makeRequestSpy.mock.calls[0]
    expect(requestBody.messages[1].content[1].type).toBe('image_url')
    expect(requestBody.messages[1].content[1].image_url.url).toBe(imageDataUrl)
    expect(result.extractedText).toContain('HB: 11.2 g/dL')
    expect(result.tokensUsed).toBe(45)
  })

  it('throws when image source is missing', async () => {
    vi.spyOn(openaiService, 'isConfigured').mockReturnValue(true)
    await expect(openaiService.extractTextFromImage('')).rejects.toThrow('Image source is required for OCR.')
  })
})
