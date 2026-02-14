import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../services/aiTokenTracker.js', () => ({
  default: {
    trackUsage: vi.fn()
  }
}))

vi.mock('../../firebase-config.js', () => ({
  auth: {
    currentUser: null
  }
}))

const loadService = async () => {
  const module = await import('../../services/optimizedOpenaiService.js')
  return module.default
}

const loadAuth = async () => {
  const module = await import('../../firebase-config.js')
  return module.auth
}

const loadTracker = async () => {
  const module = await import('../../services/aiTokenTracker.js')
  return module.default
}

describe('security: optimizedOpenaiService auth and proxy checks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    import.meta.env.VITE_FUNCTIONS_BASE_URL = 'https://example-functions.test'
    import.meta.env.VITE_FIREBASE_PROJECT_ID = 'prescribe-7e1e8'
    global.fetch = vi.fn()
  })

  it('rejects when user is not authenticated', async () => {
    const service = await loadService()
    await expect(service.callProxy({ model: 'gpt-3.5-turbo' })).rejects.toThrow('Not authenticated')
  })

  it('sends bearer token to proxy when authenticated', async () => {
    const auth = await loadAuth()
    auth.currentUser = {
      getIdToken: vi.fn().mockResolvedValue('id-token-123')
    }
    global.fetch.mockResolvedValue({
      ok: true,
      text: vi.fn().mockResolvedValue(JSON.stringify({ choices: [{ message: { content: 'ok' } }] }))
    })

    const service = await loadService()
    const response = await service.callProxy({ model: 'gpt-3.5-turbo' })

    expect(response.choices[0].message.content).toBe('ok')
    expect(global.fetch).toHaveBeenCalledWith(
      'https://example-functions.test/openaiProxy',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer id-token-123',
          'Content-Type': 'application/json'
        })
      })
    )
  })

  it('propagates proxy error payloads', async () => {
    const auth = await loadAuth()
    auth.currentUser = {
      getIdToken: vi.fn().mockResolvedValue('id-token-123')
    }
    global.fetch.mockResolvedValue({
      ok: false,
      text: vi.fn().mockResolvedValue('Unauthorized')
    })

    const service = await loadService()
    await expect(service.callProxy({ model: 'gpt-3.5-turbo' })).rejects.toThrow('Unauthorized')
  })

  it('tracks token usage after successful optimized recommendation response', async () => {
    const auth = await loadAuth()
    const tracker = await loadTracker()
    auth.currentUser = {
      getIdToken: vi.fn().mockResolvedValue('id-token-123')
    }
    global.fetch.mockResolvedValue({
      ok: true,
      text: vi.fn().mockResolvedValue(
        JSON.stringify({
          choices: [{ message: { content: '1. Flu' } }],
          usage: { prompt_tokens: 40, completion_tokens: 20 }
        })
      )
    })

    const service = await loadService()
    const result = await service.generateRecommendationsOptimized(
      [{ description: 'fever' }],
      25,
      'doc-secure'
    )

    expect(result).toBe('1. Flu')
    expect(tracker.trackUsage).toHaveBeenCalledWith(
      'generateRecommendationsOptimized',
      40,
      20,
      'gpt-3.5-turbo',
      'doc-secure'
    )
  })
})
