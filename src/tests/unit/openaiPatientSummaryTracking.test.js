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

describe('openaiService generatePatientSummary tracking', () => {
  let openaiService

  beforeEach(async () => {
    vi.clearAllMocks()
    const openaiModule = await import('../../services/openaiService.js')
    openaiService = openaiModule.default
  })

  it('tracks patientSummary tokens using correct tracker argument order', async () => {
    vi.spyOn(openaiService, 'isConfigured').mockReturnValue(true)
    vi.spyOn(openaiService, 'makeOpenAIRequest').mockResolvedValue({
      choices: [{ message: { content: '<h3>Overview</h3><p>Stable.</p>' } }],
      usage: { total_tokens: 55 },
      __fromCache: false
    })

    const result = await openaiService.generatePatientSummary({
      name: 'Test Patient',
      age: '35',
      gender: 'male',
      symptoms: [],
      illnesses: [],
      prescriptions: [],
      recentReports: []
    }, 'doc-456')

    expect(result.summary).toContain('Stable')
    expect(result.tokensUsed).toBe(55)
    expect(trackUsageMock).toHaveBeenCalledWith(
      'patientSummary',
      55,
      0,
      'gpt-4o-mini',
      'doc-456'
    )
  })
})
