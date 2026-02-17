import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createRequire } from 'module'

process.env.OPENAI_API_KEY = 'test-openai-key'

const functionsRequire = createRequire(`${process.cwd()}/functions/index.js`)
const admin = functionsRequire('firebase-admin')
const functionsModule = functionsRequire('./index.js')

const authSpy = vi.spyOn(admin, 'auth')

const createResponse = () => {
  const res = {
    statusCode: 200,
    headers: {},
    body: '',
    status(code) {
      this.statusCode = code
      return this
    },
    set(key, value) {
      this.headers[key] = value
      return this
    },
    send(payload) {
      this.body = payload
      return this
    },
    json(payload) {
      this.body = payload
      return this
    }
  }
  return res
}

describe('security: openaiProxy', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn()
    if (typeof functionsModule.__resetInMemoryGuardsForTests === 'function') {
      functionsModule.__resetInMemoryGuardsForTests()
    }
  })

  it('rejects request without bearer token', async () => {
    authSpy.mockReturnValue({
      verifyIdToken: vi.fn().mockResolvedValue(null)
    })

    const req = { method: 'POST', headers: {}, body: { endpoint: 'chat/completions', requestBody: {} } }
    const res = createResponse()

    await functionsModule.openaiProxy(req, res)

    expect(res.statusCode).toBe(401)
    expect(res.body).toBe('Unauthorized')
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('rejects endpoint injection attempts containing protocol', async () => {
    authSpy.mockReturnValue({
      verifyIdToken: vi.fn().mockResolvedValue({ uid: 'uid-1', email: 'doctor@example.com' })
    })

    const req = {
      method: 'POST',
      headers: { authorization: 'Bearer valid-token' },
      body: { endpoint: 'https://evil.test/path', requestBody: {} }
    }
    const res = createResponse()

    await functionsModule.openaiProxy(req, res)

    expect(res.statusCode).toBe(400)
    expect(res.body).toBe('Invalid endpoint')
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('forwards only sanitized endpoint to OpenAI API', async () => {
    authSpy.mockReturnValue({
      verifyIdToken: vi.fn().mockResolvedValue({ uid: 'uid-1', email: 'doctor@example.com' })
    })
    global.fetch.mockResolvedValue({
      status: 200,
      headers: { get: vi.fn().mockReturnValue('application/json') },
      text: vi.fn().mockResolvedValue('{"ok":true}')
    })

    const req = {
      method: 'POST',
      headers: { authorization: 'Bearer valid-token' },
      body: { endpoint: '/chat/completions', requestBody: { model: 'gpt-3.5-turbo' } }
    }
    const res = createResponse()

    await functionsModule.openaiProxy(req, res)

    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.openai.com/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer test-openai-key',
          'Content-Type': 'application/json'
        })
      })
    )
    expect(res.statusCode).toBe(200)
    expect(res.body).toBe('{"ok":true}')
  })

  it('rejects endpoints that are not explicitly allowlisted', async () => {
    authSpy.mockReturnValue({
      verifyIdToken: vi.fn().mockResolvedValue({ uid: 'uid-1', email: 'doctor@example.com' })
    })

    const req = {
      method: 'POST',
      headers: { authorization: 'Bearer valid-token' },
      body: { endpoint: 'embeddings', requestBody: {} }
    }
    const res = createResponse()

    await functionsModule.openaiProxy(req, res)

    expect(res.statusCode).toBe(403)
    expect(res.body).toBe('Endpoint not allowed')
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('rejects oversized payload bodies', async () => {
    authSpy.mockReturnValue({
      verifyIdToken: vi.fn().mockResolvedValue({ uid: 'uid-1', email: 'doctor@example.com' })
    })

    const req = {
      method: 'POST',
      headers: { authorization: 'Bearer valid-token' },
      body: {
        endpoint: 'chat/completions',
        requestBody: {
          model: 'gpt-3.5-turbo',
          messages: [{ role: 'user', content: 'A'.repeat(2_500_000) }]
        }
      }
    }
    const res = createResponse()

    await functionsModule.openaiProxy(req, res)

    expect(res.statusCode).toBe(413)
    expect(res.body).toBe('Payload too large')
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('rejects excessive max_tokens values in requestBody', async () => {
    authSpy.mockReturnValue({
      verifyIdToken: vi.fn().mockResolvedValue({ uid: 'uid-1', email: 'doctor@example.com' })
    })

    const req = {
      method: 'POST',
      headers: { authorization: 'Bearer valid-token' },
      body: {
        endpoint: 'chat/completions',
        requestBody: { model: 'gpt-3.5-turbo', max_tokens: 5000 }
      }
    }
    const res = createResponse()

    await functionsModule.openaiProxy(req, res)

    expect(res.statusCode).toBe(400)
    expect(res.body).toBe('max_tokens too large')
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('enforces per-user rate limit window', async () => {
    authSpy.mockReturnValue({
      verifyIdToken: vi.fn().mockResolvedValue({ uid: 'uid-rate-1', email: 'doctor@example.com' })
    })
    global.fetch.mockResolvedValue({
      status: 200,
      headers: { get: vi.fn().mockReturnValue('application/json') },
      text: vi.fn().mockResolvedValue('{"ok":true}')
    })

    const buildReq = () => ({
      method: 'POST',
      headers: { authorization: 'Bearer valid-token' },
      body: { endpoint: 'chat/completions', requestBody: { model: 'gpt-3.5-turbo' } }
    })

    for (let i = 0; i < 30; i += 1) {
      const res = createResponse()
      await functionsModule.openaiProxy(buildReq(), res)
      expect(res.statusCode).toBe(200)
    }

    const blocked = createResponse()
    await functionsModule.openaiProxy(buildReq(), blocked)
    expect(blocked.statusCode).toBe(429)
    expect(blocked.body).toBe('Rate limit exceeded')
  })

  it('isolates rate limits per authenticated user', async () => {
    const verifyIdToken = vi.fn()
      .mockResolvedValueOnce({ uid: 'uid-rate-a', email: 'doctor-a@example.com' })
      .mockResolvedValueOnce({ uid: 'uid-rate-b', email: 'doctor-b@example.com' })
    authSpy.mockReturnValue({ verifyIdToken })

    global.fetch.mockResolvedValue({
      status: 200,
      headers: { get: vi.fn().mockReturnValue('application/json') },
      text: vi.fn().mockResolvedValue('{"ok":true}')
    })

    const reqA = {
      method: 'POST',
      headers: { authorization: 'Bearer token-a' },
      body: { endpoint: 'chat/completions', requestBody: { model: 'gpt-4o-mini' } }
    }
    const reqB = {
      method: 'POST',
      headers: { authorization: 'Bearer token-b' },
      body: { endpoint: 'chat/completions', requestBody: { model: 'gpt-4o-mini' } }
    }

    const resA = createResponse()
    const resB = createResponse()

    await functionsModule.openaiProxy(reqA, resA)
    await functionsModule.openaiProxy(reqB, resB)

    expect(resA.statusCode).toBe(200)
    expect(resB.statusCode).toBe(200)
  })
})
