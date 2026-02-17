import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { createRequire } from 'module'

const functionsRequire = createRequire(`${process.cwd()}/functions/index.js`)
const admin = functionsRequire('firebase-admin')
const functionsModule = functionsRequire('./index.js')

const authSpy = vi.spyOn(admin, 'auth')
const firestoreSpy = vi.spyOn(admin, 'firestore')

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

describe('stripe functions: confirmStripeCheckoutSuccess idempotency', () => {
  let originalStripeExport
  let originalFunctionsExport
  let freshFunctionsModule
  let stripeRetrieveMock
  let doctorsStore
  let paymentLocks
  let doctorPaymentRecords

  const buildFirestoreMock = () => ({
    collection: (name) => {
      if (name === 'stripePaymentLocks') {
        return {
          doc: (id) => ({
            create: vi.fn().mockImplementation(async () => {
              if (paymentLocks.has(id)) {
                const error = new Error('Already exists')
                error.code = 6
                throw error
              }
              paymentLocks.add(id)
            })
          })
        }
      }

      if (name === 'doctors') {
        const queryDoctorsByField = (field, value) => {
          const docs = Array.from(doctorsStore.entries())
            .filter(([, data]) => {
              if (field === 'emailLower') {
                return String(data?.email || '').toLowerCase() === String(value || '').toLowerCase()
              }
              return String(data?.[field] || '') === String(value || '')
            })
            .map(([id, data]) => ({
              id,
              data: () => data
            }))
          return { empty: docs.length === 0, docs }
        }

        return {
          doc: (id) => ({
            get: vi.fn().mockResolvedValue({
              id,
              exists: doctorsStore.has(id),
              data: () => doctorsStore.get(id) || {}
            }),
            set: vi.fn().mockImplementation(async (payload, opts = {}) => {
              const current = doctorsStore.get(id) || {}
              if (opts && opts.merge) {
                doctorsStore.set(id, { ...current, ...payload })
              } else {
                doctorsStore.set(id, payload)
              }
            })
          }),
          where: vi.fn((field, _op, value) => ({
            limit: vi.fn(() => ({
              get: vi.fn().mockResolvedValue(queryDoctorsByField(field, value))
            }))
          }))
        }
      }

      if (name === 'doctorPaymentRecords') {
        return {
          add: vi.fn().mockImplementation(async (payload) => {
            doctorPaymentRecords.push(payload)
          })
        }
      }

      if (name === 'stripeCheckoutLogs') {
        return {
          where: vi.fn(() => ({
            limit: vi.fn(() => ({
              get: vi.fn().mockResolvedValue({
                empty: false,
                docs: [{ ref: { id: 'log-1' } }]
              })
            }))
          }))
        }
      }

      if (name === 'systemSettings') {
        return {
          doc: () => ({
            get: vi.fn().mockResolvedValue({ exists: false, data: () => ({}) })
          })
        }
      }

      return {
        doc: () => ({
          get: vi.fn().mockResolvedValue({ exists: false, data: () => ({}) }),
          set: vi.fn().mockResolvedValue(undefined)
        }),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        get: vi.fn().mockResolvedValue({ empty: true, docs: [] }),
        add: vi.fn().mockResolvedValue(undefined),
        orderBy: vi.fn().mockReturnThis(),
        offset: vi.fn().mockReturnThis()
      }
    },
    batch: () => ({
      set: vi.fn(),
      delete: vi.fn(),
      commit: vi.fn().mockResolvedValue(undefined)
    })
  })

  beforeEach(() => {
    vi.clearAllMocks()
    process.env.STRIPE_SECRET_KEY = 'sk_test_dummy'

    doctorsStore = new Map([
      ['doctor-1', {
        email: 'doctor@example.com',
        walletMonths: 0
      }]
    ])
    paymentLocks = new Set()
    doctorPaymentRecords = []

    stripeRetrieveMock = vi.fn().mockResolvedValue({
      id: 'cs_test_dup',
      status: 'complete',
      customer_email: 'doctor@example.com',
      metadata: {
        planId: 'professional_monthly_usd',
        doctorId: 'doctor-1',
        userUid: 'uid-doctor-1'
      },
      customer: 'cus_123',
      subscription: 'sub_123',
      amount_total: 2000,
      currency: 'usd'
    })

    const stripePath = functionsRequire.resolve('stripe')
    const functionsPath = functionsRequire.resolve('./index.js')
    originalStripeExport = functionsRequire.cache[stripePath]?.exports
    originalFunctionsExport = functionsRequire.cache[functionsPath]?.exports

    const StripeMock = vi.fn().mockImplementation(() => ({
      checkout: {
        sessions: {
          retrieve: stripeRetrieveMock
        }
      }
    }))
    StripeMock.default = StripeMock

    functionsRequire.cache[stripePath] = {
      ...(functionsRequire.cache[stripePath] || {}),
      exports: StripeMock
    }
    delete functionsRequire.cache[functionsPath]
    freshFunctionsModule = functionsRequire('./index.js')

    authSpy.mockReturnValue({
      verifyIdToken: vi.fn().mockResolvedValue({
        uid: 'uid-doctor-1',
        email: 'doctor@example.com'
      })
    })
    firestoreSpy.mockImplementation(() => buildFirestoreMock())
  })

  afterEach(() => {
    const stripePath = functionsRequire.resolve('stripe')
    const functionsPath = functionsRequire.resolve('./index.js')
    if (originalStripeExport) {
      functionsRequire.cache[stripePath] = {
        ...(functionsRequire.cache[stripePath] || {}),
        exports: originalStripeExport
      }
    }
    if (originalFunctionsExport) {
      functionsRequire.cache[functionsPath] = {
        ...(functionsRequire.cache[functionsPath] || {}),
        exports: originalFunctionsExport
      }
    } else {
      delete functionsRequire.cache[functionsPath]
    }
    process.env.STRIPE_SECRET_KEY = ORIGINAL_STRIPE_SECRET_KEY
    authSpy.mockReset()
    firestoreSpy.mockReset()
  })

  it('keeps doctor wallet/payment records idempotent when confirm is submitted twice', async () => {
    const req = {
      method: 'POST',
      headers: { authorization: 'Bearer valid-token' },
      body: {
        sessionId: 'cs_test_dup',
        doctorId: 'doctor-1'
      }
    }
    const firstRes = createResponse()
    const secondRes = createResponse()

    await freshFunctionsModule.confirmStripeCheckoutSuccess(req, firstRes)
    await freshFunctionsModule.confirmStripeCheckoutSuccess(req, secondRes)

    expect(firstRes.statusCode).toBe(200)
    expect(firstRes.body).toEqual(expect.objectContaining({ success: true }))
    expect(secondRes.statusCode).toBe(200)
    expect(secondRes.body).toEqual(expect.objectContaining({ success: true }))
    expect(stripeRetrieveMock).toHaveBeenCalledTimes(2)
    expect(doctorsStore.get('doctor-1')?.walletMonths).toBe(1)
    expect(doctorPaymentRecords).toHaveLength(1)
  })

  it('credits exactly one referral free month to referrer when referred doctor completes eligible paid month', async () => {
    doctorsStore = new Map([
      ['referrer-1', {
        email: 'referrer@example.com',
        doctorIdShort: 'DR99999',
        walletMonths: 0,
        accessExpiresAt: '2026-01-10T00:00:00.000Z'
      }],
      ['doctor-1', {
        email: 'doctor@example.com',
        walletMonths: 0,
        referredByDoctorId: 'DR99999',
        referralEligibleAt: '2025-01-01T00:00:00.000Z',
        referralBonusApplied: false
      }]
    ])

    const req = {
      method: 'POST',
      headers: { authorization: 'Bearer valid-token' },
      body: {
        sessionId: 'cs_test_dup',
        doctorId: 'doctor-1'
      }
    }
    const firstRes = createResponse()
    const secondRes = createResponse()

    await freshFunctionsModule.confirmStripeCheckoutSuccess(req, firstRes)
    await freshFunctionsModule.confirmStripeCheckoutSuccess(req, secondRes)

    expect(firstRes.statusCode).toBe(200)
    expect(secondRes.statusCode).toBe(200)

    const referredDoctor = doctorsStore.get('doctor-1')
    const referrerDoctor = doctorsStore.get('referrer-1')
    expect(referredDoctor?.referralBonusApplied).toBe(true)
    expect(typeof referredDoctor?.referralBonusAppliedAt).toBe('string')
    expect(referredDoctor?.referredByDoctorId).toBe('referrer-1')

    expect(referrerDoctor?.walletMonths).toBe(1)
    expect(new Date(referrerDoctor?.accessExpiresAt || '').getTime()).toBeGreaterThan(
      new Date('2026-01-10T00:00:00.000Z').getTime()
    )

    const referralRewardRecords = doctorPaymentRecords.filter(
      (record) => record.type === 'referral_reward' && record.doctorId === 'referrer-1'
    )
    expect(referralRewardRecords).toHaveLength(1)
    expect(referralRewardRecords[0]).toEqual(
      expect.objectContaining({
        source: 'referral',
        status: 'credited',
        monthsDelta: 1,
        referenceId: 'doctor-1'
      })
    )
  })

  it('rejects confirm when Stripe session belongs to a different email', async () => {
    stripeRetrieveMock.mockResolvedValueOnce({
      id: 'cs_test_other_email',
      status: 'complete',
      customer_email: 'other@example.com',
      metadata: {
        planId: 'professional_monthly_usd',
        doctorId: 'doctor-1',
        userUid: 'uid-doctor-1'
      },
      customer: 'cus_456',
      subscription: 'sub_456',
      amount_total: 2000,
      currency: 'usd'
    })

    const req = {
      method: 'POST',
      headers: { authorization: 'Bearer valid-token' },
      body: { sessionId: 'cs_test_other_email', doctorId: 'doctor-1' }
    }
    const res = createResponse()

    await freshFunctionsModule.confirmStripeCheckoutSuccess(req, res)

    expect(res.statusCode).toBe(403)
    expect(res.body).toEqual(expect.objectContaining({
      success: false,
      error: expect.stringMatching(/does not belong to current user/i)
    }))
    expect(doctorsStore.get('doctor-1')?.walletMonths).toBe(0)
    expect(doctorPaymentRecords).toHaveLength(0)
  })

  it('rejects confirm when Stripe session is not complete', async () => {
    stripeRetrieveMock.mockResolvedValueOnce({
      id: 'cs_test_incomplete',
      status: 'open',
      customer_email: 'doctor@example.com',
      metadata: {
        planId: 'professional_monthly_usd',
        doctorId: 'doctor-1',
        userUid: 'uid-doctor-1'
      },
      customer: 'cus_789',
      subscription: 'sub_789',
      amount_total: 2000,
      currency: 'usd'
    })

    const req = {
      method: 'POST',
      headers: { authorization: 'Bearer valid-token' },
      body: { sessionId: 'cs_test_incomplete', doctorId: 'doctor-1' }
    }
    const res = createResponse()

    await freshFunctionsModule.confirmStripeCheckoutSuccess(req, res)

    expect(res.statusCode).toBe(409)
    expect(res.body).toEqual(expect.objectContaining({
      success: false,
      error: expect.stringMatching(/not completed/i)
    }))
    expect(doctorsStore.get('doctor-1')?.walletMonths).toBe(0)
    expect(doctorPaymentRecords).toHaveLength(0)
  })
})

describe('stripe functions: createStripeCheckoutSession pricing scope matrix', () => {
  let originalStripeExport
  let originalFunctionsExport
  let freshFunctionsModule
  let stripeCreateMock
  let doctorsStore
  let promoDocsByCode
  let pricingConfigDoc
  let checkoutLogs

  const buildFirestoreMock = () => ({
    collection: (name) => {
      if (name === 'doctors') {
        return {
          doc: (id) => ({
            get: vi.fn().mockResolvedValue({
              id,
              exists: doctorsStore.has(id),
              data: () => doctorsStore.get(id) || {}
            })
          })
        }
      }

      if (name === 'systemSettings') {
        return {
          doc: (docId) => ({
            get: vi.fn().mockResolvedValue((() => {
              if (docId === 'paymentPricing') {
                if (!pricingConfigDoc) return { exists: false, data: () => ({}) }
                return { exists: true, data: () => pricingConfigDoc }
              }
              return { exists: false, data: () => ({}) }
            })())
          })
        }
      }

      if (name === 'promoCodes') {
        return {
          where: vi.fn((_field, _op, value) => ({
            limit: vi.fn(() => ({
              get: vi.fn().mockResolvedValue((() => {
                const normalized = String(value || '').trim().toUpperCase()
                const doc = promoDocsByCode.get(normalized)
                if (!doc) return { empty: true, docs: [] }
                return {
                  empty: false,
                  docs: [
                    {
                      id: doc.id,
                      data: () => doc.data
                    }
                  ]
                }
              })())
            }))
          }))
        }
      }

      if (name === 'stripeCheckoutLogs') {
        return {
          add: vi.fn().mockImplementation(async (payload) => {
            checkoutLogs.push(payload)
          })
        }
      }

      return {
        doc: () => ({
          get: vi.fn().mockResolvedValue({ exists: false, data: () => ({}) }),
          set: vi.fn().mockResolvedValue(undefined)
        }),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        get: vi.fn().mockResolvedValue({ empty: true, docs: [] }),
        add: vi.fn().mockResolvedValue(undefined),
        orderBy: vi.fn().mockReturnThis(),
        offset: vi.fn().mockReturnThis()
      }
    },
    batch: () => ({
      set: vi.fn(),
      delete: vi.fn(),
      commit: vi.fn().mockResolvedValue(undefined)
    })
  })

  beforeEach(() => {
    vi.clearAllMocks()
    process.env.STRIPE_SECRET_KEY = 'sk_test_dummy'

    doctorsStore = new Map()
    promoDocsByCode = new Map()
    pricingConfigDoc = null
    checkoutLogs = []

    stripeCreateMock = vi.fn().mockResolvedValue({
      id: 'cs_test_matrix',
      url: 'https://checkout.stripe.com/c/pay/cs_test_matrix'
    })

    const stripePath = functionsRequire.resolve('stripe')
    const functionsPath = functionsRequire.resolve('./index.js')
    originalStripeExport = functionsRequire.cache[stripePath]?.exports
    originalFunctionsExport = functionsRequire.cache[functionsPath]?.exports

    const StripeMock = vi.fn().mockImplementation(() => ({
      checkout: {
        sessions: {
          create: stripeCreateMock
        }
      }
    }))
    StripeMock.default = StripeMock

    functionsRequire.cache[stripePath] = {
      ...(functionsRequire.cache[stripePath] || {}),
      exports: StripeMock
    }
    delete functionsRequire.cache[functionsPath]
    freshFunctionsModule = functionsRequire('./index.js')

    authSpy.mockReturnValue({
      verifyIdToken: vi.fn().mockResolvedValue({
        uid: 'uid-doctor-1',
        email: 'doctor@example.com'
      })
    })
    firestoreSpy.mockImplementation(() => buildFirestoreMock())
  })

  afterEach(() => {
    const stripePath = functionsRequire.resolve('stripe')
    const functionsPath = functionsRequire.resolve('./index.js')
    if (originalStripeExport) {
      functionsRequire.cache[stripePath] = {
        ...(functionsRequire.cache[stripePath] || {}),
        exports: originalStripeExport
      }
    }
    if (originalFunctionsExport) {
      functionsRequire.cache[functionsPath] = {
        ...(functionsRequire.cache[functionsPath] || {}),
        exports: originalFunctionsExport
      }
    } else {
      delete functionsRequire.cache[functionsPath]
    }
    process.env.STRIPE_SECRET_KEY = ORIGINAL_STRIPE_SECRET_KEY
    authSpy.mockReset()
    firestoreSpy.mockReset()
  })

  it.each([
    {
      name: 'new doctor + new_customers scope uses override before promo',
      doctorData: { email: 'doctor@example.com', walletMonths: 0, paymentDone: false },
      pricingConfig: {
        enabled: true,
        monthlyUsd: 35,
        annualUsd: 350,
        monthlyLkr: 7000,
        annualLkr: 70000,
        appliesTo: 'new_customers'
      },
      expectedUnitAmount: 3150
    },
    {
      name: 'existing doctor + new_customers scope keeps default before promo',
      doctorData: { email: 'doctor@example.com', walletMonths: 1, paymentDone: true },
      pricingConfig: {
        enabled: true,
        monthlyUsd: 35,
        annualUsd: 350,
        monthlyLkr: 7000,
        annualLkr: 70000,
        appliesTo: 'new_customers'
      },
      expectedUnitAmount: 1800
    },
    {
      name: 'existing doctor + all_customers scope uses override before promo',
      doctorData: { email: 'doctor@example.com', walletMonths: 1, paymentDone: true },
      pricingConfig: {
        enabled: true,
        monthlyUsd: 45,
        annualUsd: 450,
        monthlyLkr: 9000,
        annualLkr: 90000,
        appliesTo: 'all_customers'
      },
      expectedUnitAmount: 4050
    }
  ])('$name', async ({ doctorData, pricingConfig, expectedUnitAmount }) => {
    doctorsStore.set('doctor-1', doctorData)
    pricingConfigDoc = pricingConfig
    promoDocsByCode.set('SAVE10', {
      id: 'promo-1',
      data: {
        code: 'SAVE10',
        discountType: 'percent',
        percentOff: 10,
        isActive: true,
        validFrom: '2026-01-01T00:00:00.000Z',
        validUntil: '2026-12-31T23:59:59.999Z',
        maxRedemptions: 100,
        redemptionCount: 0
      }
    })

    const req = {
      method: 'POST',
      headers: { authorization: 'Bearer valid-token' },
      body: {
        planId: 'professional_monthly_usd',
        doctorId: 'doctor-1',
        promoCode: 'save10',
        successUrl: 'https://www.mprescribe.net/payments?ok=1',
        cancelUrl: 'https://www.mprescribe.net/payments?cancel=1'
      }
    }
    const res = createResponse()

    await freshFunctionsModule.createStripeCheckoutSession(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual(expect.objectContaining({ success: true, promoApplied: true }))
    expect(stripeCreateMock).toHaveBeenCalledTimes(1)
    const stripeArgs = stripeCreateMock.mock.calls[0][0]
    expect(stripeArgs.line_items[0].price_data.unit_amount).toBe(expectedUnitAmount)
    expect(checkoutLogs).toHaveLength(1)
    expect(checkoutLogs[0]).toEqual(expect.objectContaining({
      doctorId: 'doctor-1',
      planId: 'professional_monthly_usd',
      promoCode: 'SAVE10',
      amount: expectedUnitAmount
    }))
  })

  it('applies higher individual discount when promo discount is lower', async () => {
    doctorsStore.set('doctor-1', {
      email: 'doctor@example.com',
      walletMonths: 1,
      paymentDone: true,
      adminStripeDiscountPercent: 30
    })
    promoDocsByCode.set('SAVE10', {
      id: 'promo-1',
      data: {
        code: 'SAVE10',
        discountType: 'percent',
        percentOff: 10,
        isActive: true,
        validFrom: '2026-01-01T00:00:00.000Z',
        validUntil: '2026-12-31T23:59:59.999Z',
        maxRedemptions: 100,
        redemptionCount: 0
      }
    })

    const req = {
      method: 'POST',
      headers: { authorization: 'Bearer valid-token' },
      body: {
        planId: 'professional_monthly_usd',
        doctorId: 'doctor-1',
        promoCode: 'save10',
        successUrl: 'https://www.mprescribe.net/payments?ok=1',
        cancelUrl: 'https://www.mprescribe.net/payments?cancel=1'
      }
    }
    const res = createResponse()

    await freshFunctionsModule.createStripeCheckoutSession(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual(expect.objectContaining({
      success: true,
      promoApplied: false,
      promoValidated: true,
      appliedDiscountSource: 'individual',
      originalAmount: 2000,
      discountedAmount: 1400
    }))
    const stripeArgs = stripeCreateMock.mock.calls[0][0]
    expect(stripeArgs.line_items[0].price_data.unit_amount).toBe(1400)
    expect(stripeArgs.metadata.promoCode).toBe('')
    expect(checkoutLogs[0]).toEqual(expect.objectContaining({
      amount: 1400,
      promoCode: '',
      appliedDiscountSource: 'individual'
    }))
  })

  it('applies higher promo discount when individual discount is lower', async () => {
    doctorsStore.set('doctor-1', {
      email: 'doctor@example.com',
      walletMonths: 1,
      paymentDone: true,
      adminStripeDiscountPercent: 10
    })
    promoDocsByCode.set('SAVE25', {
      id: 'promo-25',
      data: {
        code: 'SAVE25',
        discountType: 'percent',
        percentOff: 25,
        isActive: true,
        validFrom: '2026-01-01T00:00:00.000Z',
        validUntil: '2026-12-31T23:59:59.999Z',
        maxRedemptions: 100,
        redemptionCount: 0
      }
    })

    const req = {
      method: 'POST',
      headers: { authorization: 'Bearer valid-token' },
      body: {
        planId: 'professional_monthly_usd',
        doctorId: 'doctor-1',
        promoCode: 'save25',
        successUrl: 'https://www.mprescribe.net/payments?ok=1',
        cancelUrl: 'https://www.mprescribe.net/payments?cancel=1'
      }
    }
    const res = createResponse()

    await freshFunctionsModule.createStripeCheckoutSession(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual(expect.objectContaining({
      success: true,
      promoApplied: true,
      promoValidated: true,
      appliedDiscountSource: 'promo',
      promoCode: 'SAVE25',
      originalAmount: 2000,
      discountedAmount: 1500
    }))
    const stripeArgs = stripeCreateMock.mock.calls[0][0]
    expect(stripeArgs.line_items[0].price_data.unit_amount).toBe(1500)
    expect(stripeArgs.metadata.promoCode).toBe('SAVE25')
    expect(checkoutLogs[0]).toEqual(expect.objectContaining({
      amount: 1500,
      promoCode: 'SAVE25',
      appliedDiscountSource: 'promo'
    }))
  })

  it('returns checkout error for invalid promo code in request', async () => {
    doctorsStore.set('doctor-1', { email: 'doctor@example.com', walletMonths: 0, paymentDone: false })
    pricingConfigDoc = {
      enabled: true,
      monthlyUsd: 35,
      annualUsd: 350,
      monthlyLkr: 7000,
      annualLkr: 70000,
      appliesTo: 'new_customers'
    }

    const req = {
      method: 'POST',
      headers: { authorization: 'Bearer valid-token' },
      body: {
        planId: 'professional_monthly_usd',
        doctorId: 'doctor-1',
        promoCode: 'NOTREAL',
        successUrl: 'https://www.mprescribe.net/payments?ok=1',
        cancelUrl: 'https://www.mprescribe.net/payments?cancel=1'
      }
    }
    const res = createResponse()

    await freshFunctionsModule.createStripeCheckoutSession(req, res)

    expect(res.statusCode).toBe(500)
    expect(res.body).toEqual(expect.objectContaining({
      success: false,
      error: expect.stringMatching(/invalid promo code/i)
    }))
    expect(stripeCreateMock).not.toHaveBeenCalled()
    expect(checkoutLogs).toHaveLength(0)
  })
})
