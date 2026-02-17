import { beforeEach, describe, expect, it, vi } from 'vitest'

const { trackUsageMock } = vi.hoisted(() => ({
  trackUsageMock: vi.fn(async () => ({}))
}))

vi.mock('../../services/aiTokenTracker.js', () => ({
  default: {
    trackUsage: trackUsageMock
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
    const openaiModule = await import('../../services/openaiService.js')
    openaiService = openaiModule.default
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
    expect(trackUsageMock).toHaveBeenCalledWith(
      'reportImageOcr',
      45,
      0,
      'gpt-4o-mini',
      'doc-123'
    )
  })

  it('throws when image source is missing', async () => {
    vi.spyOn(openaiService, 'isConfigured').mockReturnValue(true)
    await expect(openaiService.extractTextFromImage('')).rejects.toThrow('Image source is required for OCR.')
  })

  it('retries with stronger compression when proxy returns payload too large', async () => {
    vi.spyOn(openaiService, 'isConfigured').mockReturnValue(true)
    const makeRequestSpy = vi.spyOn(openaiService, 'makeOpenAIRequest')
      .mockRejectedValueOnce(new Error('Payload too large'))
      .mockResolvedValueOnce({
        choices: [{ message: { content: 'HB 12.5' } }],
        usage: { total_tokens: 18 },
        __fromCache: false
      })

    const optimizeSpy = vi.spyOn(openaiService, 'optimizeImageSourceForOcr')
      .mockResolvedValue('data:image/jpeg;base64,AAA')

    const result = await openaiService.extractTextFromImage('data:image/png;base64,BBBB', 'doc-123')

    expect(makeRequestSpy.mock.calls.length).toBeGreaterThanOrEqual(2)
    expect(optimizeSpy.mock.calls.length).toBeGreaterThanOrEqual(2)
    expect(result.extractedText).toBe('HB 12.5')
  })

  it('surfaces payload-too-large error when retry also fails', async () => {
    vi.spyOn(openaiService, 'isConfigured').mockReturnValue(true)
    const makeRequestSpy = vi.spyOn(openaiService, 'makeOpenAIRequest')
      .mockImplementation(async () => {
        throw new Error('Payload too large')
      })

    const optimizeSpy = vi.spyOn(openaiService, 'optimizeImageSourceForOcr')
      .mockResolvedValue('data:image/jpeg;base64,AAA')

    await expect(
      openaiService.extractTextFromImage('data:image/png;base64,BBBB', 'doc-123')
    ).rejects.toThrow('Payload too large')

    expect(makeRequestSpy.mock.calls.length).toBeGreaterThanOrEqual(2)
    expect(optimizeSpy.mock.calls.length).toBeGreaterThanOrEqual(2)
    expect(trackUsageMock).not.toHaveBeenCalled()
  })

  it('does not retry when OCR fails with non-payload error', async () => {
    vi.spyOn(openaiService, 'isConfigured').mockReturnValue(true)
    const makeRequestSpy = vi.spyOn(openaiService, 'makeOpenAIRequest')
      .mockRejectedValue(new Error('OpenAI proxy error: upstream timeout'))
    const optimizeSpy = vi.spyOn(openaiService, 'optimizeImageSourceForOcr')
      .mockResolvedValue('data:image/jpeg;base64,AAA')

    await expect(
      openaiService.extractTextFromImage('data:image/png;base64,BBBB', 'doc-123')
    ).rejects.toThrow('upstream timeout')

    expect(makeRequestSpy).toHaveBeenCalledTimes(1)
    expect(optimizeSpy).toHaveBeenCalledTimes(1)
    expect(trackUsageMock).not.toHaveBeenCalled()
  })
})
