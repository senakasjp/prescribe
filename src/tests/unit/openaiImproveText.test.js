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

describe('openaiService improveText', () => {
  let openaiService

  beforeEach(async () => {
    vi.clearAllMocks()
    const openaiModule = await import('../../services/openaiService.js')
    openaiService = openaiModule.default
  })

  it('post-processes unit terms and capitalizes first letter', () => {
    const output = openaiService.postProcessImprovedText('take 500mg and 5 milliliters daily')
    expect(output).toBe('Take 500 mg and 5 ml daily')
  })

  it('includes context in prompt and returns normalized improved text', async () => {
    vi.spyOn(openaiService, 'isConfigured').mockReturnValue(true)

    const makeRequestSpy = vi.spyOn(openaiService, 'makeOpenAIRequest').mockResolvedValue({
      choices: [{ message: { content: 'take 250mg after meals' } }],
      usage: { total_tokens: 33 },
      __fromCache: false
    })

    const result = await openaiService.improveText('take 250mg after meals', 'doc-1', { context: 'medication-instructions' })

    expect(makeRequestSpy).toHaveBeenCalledTimes(1)
    const requestBody = makeRequestSpy.mock.calls[0][1]
    expect(requestBody.messages[1].content).toContain('Context: medication-instructions')
    expect(result.improvedText).toBe('Take 250 mg after meals')
    expect(result.tokensUsed).toBe(33)
    expect(trackUsageMock).toHaveBeenCalledWith(
      'improveText',
      33,
      0,
      'gpt-4o-mini',
      'doc-1'
    )
  })

  it('uses configured spell/grammar model for request and usage tracking', async () => {
    vi.spyOn(openaiService, 'isConfigured').mockReturnValue(true)
    vi.spyOn(openaiService, 'getModelForCategory').mockResolvedValue('gpt-4.1-mini')

    const makeRequestSpy = vi.spyOn(openaiService, 'makeOpenAIRequest').mockResolvedValue({
      choices: [{ message: { content: 'clean text' } }],
      usage: { prompt_tokens: 12, completion_tokens: 5, total_tokens: 17 },
      __fromCache: false
    })

    await openaiService.improveText('clean text', 'doc-2', { context: 'notes' })

    const requestBody = makeRequestSpy.mock.calls[0][1]
    expect(requestBody.model).toBe('gpt-4.1-mini')
    expect(trackUsageMock).toHaveBeenCalledWith(
      'improveText',
      12,
      5,
      'gpt-4.1-mini',
      'doc-2'
    )
  })
})
