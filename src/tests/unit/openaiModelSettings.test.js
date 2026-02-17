import { beforeEach, describe, expect, it, vi } from 'vitest'

const { getAIModelSettingsMock } = vi.hoisted(() => ({
  getAIModelSettingsMock: vi.fn()
}))

vi.mock('../../services/firebaseStorage.js', () => ({
  default: {
    getAIModelSettings: getAIModelSettingsMock
  }
}))

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

describe('openaiService AI model settings', () => {
  let openaiService

  beforeEach(async () => {
    vi.clearAllMocks()
    const openaiModule = await import('../../services/openaiService.js')
    openaiService = openaiModule.default
    openaiService.aiModelSettingsCache = null
    openaiService.aiModelSettingsFetchedAt = 0
  })

  it('maps category lookups from stored model settings', async () => {
    getAIModelSettingsMock.mockResolvedValueOnce({
      imageAnalysisModel: 'gpt-4.1-mini',
      otherAnalysisModel: 'gpt-4.1',
      spellGrammarModel: 'gpt-5-mini'
    })

    expect(await openaiService.getModelForCategory('image')).toBe('gpt-4.1-mini')
    expect(await openaiService.getModelForCategory('other')).toBe('gpt-4.1')
    expect(await openaiService.getModelForCategory('spell')).toBe('gpt-5-mini')
    expect(getAIModelSettingsMock).toHaveBeenCalledTimes(1)
  })

  it('returns defaults when settings fetch fails', async () => {
    getAIModelSettingsMock.mockRejectedValueOnce(new Error('firestore unavailable'))

    const settings = await openaiService.getAIModelSettings()
    expect(settings).toEqual({
      imageAnalysisModel: 'gpt-4o-mini',
      otherAnalysisModel: 'gpt-4o-mini',
      spellGrammarModel: 'gpt-4o-mini'
    })
  })

  it('uses cache within ttl and refetches when forceRefresh is true', async () => {
    getAIModelSettingsMock.mockResolvedValueOnce({
      imageAnalysisModel: 'gpt-4.1-mini',
      otherAnalysisModel: 'gpt-4.1',
      spellGrammarModel: 'gpt-4.1-mini'
    })
    getAIModelSettingsMock.mockResolvedValueOnce({
      imageAnalysisModel: 'gpt-5-mini',
      otherAnalysisModel: 'gpt-5-mini',
      spellGrammarModel: 'gpt-5-mini'
    })

    const first = await openaiService.getAIModelSettings()
    const second = await openaiService.getAIModelSettings()
    const refreshed = await openaiService.getAIModelSettings(true)

    expect(first.otherAnalysisModel).toBe('gpt-4.1')
    expect(second.otherAnalysisModel).toBe('gpt-4.1')
    expect(refreshed.otherAnalysisModel).toBe('gpt-5-mini')
    expect(getAIModelSettingsMock).toHaveBeenCalledTimes(2)
  })
})

