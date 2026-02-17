import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  firestoreStore,
  trackUsageMock
} = vi.hoisted(() => ({
  firestoreStore: new Map(),
  trackUsageMock: vi.fn(async () => ({}))
}))

vi.mock('firebase/firestore', () => {
  const pathOf = (segments = []) => segments.map((segment) => String(segment)).join('/')

  return {
    collection: vi.fn((...segments) => ({ path: pathOf(segments.slice(1)) })),
    addDoc: vi.fn(async () => ({ id: 'log-1' })),
    getDocs: vi.fn(async () => ({ docs: [] })),
    query: vi.fn(() => ({})),
    orderBy: vi.fn(() => ({})),
    limit: vi.fn(() => ({})),
    where: vi.fn(() => ({})),
    writeBatch: vi.fn(() => ({})),
    onSnapshot: vi.fn(() => vi.fn()),
    updateDoc: vi.fn(async () => ({})),
    deleteDoc: vi.fn(async () => ({})),
    doc: vi.fn((...segments) => ({ path: pathOf(segments.slice(1)) })),
    getDoc: vi.fn(async (docRef) => {
      const data = firestoreStore.get(docRef.path)
      return {
        exists: () => typeof data !== 'undefined',
        data: () => data
      }
    }),
    setDoc: vi.fn(async (docRef, payload, options = {}) => {
      const current = firestoreStore.get(docRef.path) || {}
      const merged = options?.merge ? { ...current, ...payload } : { ...payload }
      firestoreStore.set(docRef.path, merged)
    })
  }
})

vi.mock('../../services/aiTokenTracker.js', () => ({
  default: {
    trackUsage: trackUsageMock
  }
}))

vi.mock('../../firebase-config.js', () => ({
  db: {},
  auth: {}
}))

describe('AI model selection integration flow', () => {
  let firebaseStorage
  let openaiService

  beforeEach(async () => {
    vi.clearAllMocks()
    firestoreStore.clear()

    const firebaseStorageModule = await import('../../services/firebaseStorage.js')
    firebaseStorage = firebaseStorageModule.default

    const openaiServiceModule = await import('../../services/openaiService.js')
    openaiService = openaiServiceModule.default
    openaiService.aiModelSettingsCache = null
    openaiService.aiModelSettingsFetchedAt = 0
  })

  it('applies admin-saved models to spell, other, and image AI paths', async () => {
    await firebaseStorage.saveAIModelSettings({
      imageAnalysisModel: 'gpt-4.1-mini',
      otherAnalysisModel: 'gpt-4.1',
      spellGrammarModel: 'gpt-5-mini',
      updatedBy: 'admin@test.com'
    })

    const readBack = await openaiService.getAIModelSettings(true)
    expect(readBack).toEqual(expect.objectContaining({
      imageAnalysisModel: 'gpt-4.1-mini',
      otherAnalysisModel: 'gpt-4.1',
      spellGrammarModel: 'gpt-5-mini'
    }))

    vi.spyOn(openaiService, 'isConfigured').mockReturnValue(true)
    const modelByPromptType = new Map()
    vi.spyOn(openaiService, 'makeOpenAIRequest').mockImplementation(async (_endpoint, requestBody, promptType) => {
      modelByPromptType.set(promptType, requestBody.model)
      return {
        choices: [{ message: { content: 'ok' } }],
        usage: { prompt_tokens: 10, completion_tokens: 4, total_tokens: 14 },
        __fromCache: false
      }
    })

    await openaiService.improveText('take 5 mg', 'doc-1', { context: 'medication-notes' })
    await openaiService.generatePatientSummary({
      name: 'Integration Patient',
      age: '34',
      gender: 'female',
      symptoms: [],
      illnesses: [],
      prescriptions: [],
      recentReports: []
    }, 'doc-1')
    await openaiService.extractTextFromImage('data:image/jpeg;base64,AAA', 'doc-1')

    expect(modelByPromptType.get('improveText')).toBe('gpt-5-mini')
    expect(modelByPromptType.get('patientSummary')).toBe('gpt-4.1')
    expect(modelByPromptType.get('reportImageOcr')).toBe('gpt-4.1-mini')
  })
})

