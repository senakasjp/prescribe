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

describe('openaiService improveText', () => {
  let openaiService

  beforeEach(async () => {
    vi.clearAllMocks()
    const module = await import('../../services/openaiService.js')
    openaiService = module.default
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
  })
})

