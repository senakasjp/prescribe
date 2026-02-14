import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createRequire } from 'module'

const functionsRequire = createRequire(`${process.cwd()}/functions/index.js`)
const admin = functionsRequire('firebase-admin')
const functionsModule = functionsRequire('./index.js')

const authSpy = vi.spyOn(admin, 'auth')

const createResponse = () => ({
  statusCode: 200,
  body: '',
  headers: {},
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
})

const adminProtectedEndpoints = [
  'sendDoctorBroadcastEmail',
  'sendDoctorTemplateEmail',
  'sendPatientTemplateEmail',
  'sendAppointmentReminderTemplateEmail',
  'testSmtp',
  'sendWelcomeWhatsapp',
  'sendSmsApi',
  'clearEmailLogs'
]

describe('security: admin onRequest authorization matrix', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rejects missing bearer token on all admin-protected endpoints', async () => {
    authSpy.mockReturnValue({
      verifyIdToken: vi.fn().mockResolvedValue(null)
    })

    for (const endpointName of adminProtectedEndpoints) {
      const handler = functionsModule[endpointName]
      const req = { method: 'POST', headers: {}, body: {} }
      const res = createResponse()

      await handler(req, res)

      expect(res.statusCode, `${endpointName} should reject missing token`).toBe(401)
      expect(String(res.body || '')).toMatch(/unauthorized/i)
    }
  })

  it('rejects authenticated non-admin token on all admin-protected endpoints', async () => {
    authSpy.mockReturnValue({
      verifyIdToken: vi.fn().mockResolvedValue({
        uid: 'uid-user-1',
        email: 'not-admin@example.com'
      })
    })

    for (const endpointName of adminProtectedEndpoints) {
      const handler = functionsModule[endpointName]
      const req = { method: 'POST', headers: { authorization: 'Bearer valid-user-token' }, body: {} }
      const res = createResponse()

      await handler(req, res)

      expect(res.statusCode, `${endpointName} should reject non-admin token`).toBe(401)
      expect(String(res.body || '')).toMatch(/unauthorized/i)
    }
  })

  it('rejects invalid or expired token failures consistently', async () => {
    authSpy.mockReturnValue({
      verifyIdToken: vi.fn().mockRejectedValue(new Error('auth/id-token-expired'))
    })

    for (const endpointName of adminProtectedEndpoints) {
      const handler = functionsModule[endpointName]
      const req = { method: 'POST', headers: { authorization: 'Bearer expired-token' }, body: {} }
      const res = createResponse()

      await handler(req, res)

      expect(res.statusCode, `${endpointName} should reject invalid token`).toBe(401)
      expect(String(res.body || '')).toMatch(/unauthorized/i)
    }
  })
})
