import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
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

const ORIGINAL_STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY
const ORIGINAL_STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET

describe('stripe functions: auth and webhook guardrails', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.STRIPE_SECRET_KEY = ''
    process.env.STRIPE_WEBHOOK_SECRET = ''
  })

  afterEach(() => {
    process.env.STRIPE_SECRET_KEY = ORIGINAL_STRIPE_SECRET_KEY
    process.env.STRIPE_WEBHOOK_SECRET = ORIGINAL_STRIPE_WEBHOOK_SECRET
  })

  it('rejects missing bearer token for createStripeCheckoutSession', async () => {
    const req = { method: 'POST', headers: {}, body: { planId: 'professional_monthly_usd' } }
    const res = createResponse()

    await functionsModule.createStripeCheckoutSession(req, res)

    expect(res.statusCode).toBe(401)
    expect(String(res.body || '')).toMatch(/unauthorized/i)
  })

  it('returns config error for createStripeCheckoutSession when secret is missing', async () => {
    authSpy.mockReturnValue({
      verifyIdToken: vi.fn().mockResolvedValue({
        uid: 'uid-doctor-1',
        email: 'doctor@example.com'
      })
    })

    const req = {
      method: 'POST',
      headers: { authorization: 'Bearer valid-token' },
      body: { planId: 'professional_monthly_usd', doctorId: 'doctor-1' }
    }
    const res = createResponse()

    await functionsModule.createStripeCheckoutSession(req, res)

    expect(res.statusCode).toBe(500)
    expect(res.body).toEqual(
      expect.objectContaining({
        success: false,
        error: expect.stringMatching(/secret key is not configured/i)
      })
    )
  })

  it('rejects confirmStripeCheckoutSuccess without sessionId', async () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_dummy'
    authSpy.mockReturnValue({
      verifyIdToken: vi.fn().mockResolvedValue({
        uid: 'uid-doctor-1',
        email: 'doctor@example.com'
      })
    })

    const req = {
      method: 'POST',
      headers: { authorization: 'Bearer valid-token' },
      body: {}
    }
    const res = createResponse()

    await functionsModule.confirmStripeCheckoutSuccess(req, res)

    expect(res.statusCode).toBe(400)
    expect(res.body).toEqual(
      expect.objectContaining({
        success: false,
        error: expect.stringMatching(/sessionId is required/i)
      })
    )
  })

  it('requires POST for stripeWebhook', async () => {
    const req = { method: 'GET', headers: {}, body: {} }
    const res = createResponse()

    await functionsModule.stripeWebhook(req, res)

    expect(res.statusCode).toBe(405)
    expect(String(res.body || '')).toMatch(/method not allowed/i)
  })

  it('returns config error for stripeWebhook when webhook secret is missing', async () => {
    const req = { method: 'POST', headers: {}, body: {} }
    const res = createResponse()

    await functionsModule.stripeWebhook(req, res)

    expect(res.statusCode).toBe(500)
    expect(String(res.body || '')).toMatch(/webhook is not configured/i)
  })

  it('requires stripe-signature header for stripeWebhook when configured', async () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_dummy'
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_dummy'
    const req = { method: 'POST', headers: {}, body: {} }
    const res = createResponse()

    await functionsModule.stripeWebhook(req, res)

    expect(res.statusCode).toBe(400)
    expect(String(res.body || '')).toMatch(/missing stripe signature/i)
  })
})
