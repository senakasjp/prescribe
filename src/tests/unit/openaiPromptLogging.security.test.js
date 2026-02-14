import { beforeEach, describe, expect, it, vi } from 'vitest'
import { addDoc } from 'firebase/firestore'

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(() => ({ path: 'aiPromptLogs' })),
  addDoc: vi.fn(() => Promise.resolve({ id: 'log-1' })),
  getDocs: vi.fn(() => Promise.resolve({ docs: [] })),
  query: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn()
}))

vi.mock('../../firebase-config.js', () => ({
  db: {},
  auth: {}
}))

describe('security: OpenAI prompt logging redaction', () => {
  let openaiService

  beforeEach(async () => {
    vi.clearAllMocks()
    const module = await import('../../services/openaiService.js')
    openaiService = module.default
  })

  it('redacts token and API key fields from stored prompt logs', async () => {
    await openaiService.logAIPrompt(
      'api_call',
      {
        endpoint: 'chat/completions',
        token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
        requestBody: {
          apiKey: 'sk-123456789012345678901234567890',
          messages: [{ role: 'user', content: 'test' }]
        }
      },
      { accessToken: 'Bearer abc.def.ghi' },
      null,
      { authorization: 'Bearer sensitive-token' }
    )

    expect(addDoc).toHaveBeenCalledTimes(1)
    const payload = addDoc.mock.calls[0][1]
    expect(payload.promptData).toContain('[REDACTED]')
    expect(payload.promptData).not.toContain('sk-123456789012345678901234567890')
    expect(payload.promptData).not.toContain('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9')
    expect(payload.response).toContain('[REDACTED]')
  })
})
