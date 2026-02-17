import { beforeEach, describe, expect, it, vi } from 'vitest'
import { addDoc, collection, doc, getDoc, getDocs, limit, query, setDoc, where } from 'firebase/firestore'

vi.mock('firebase/firestore', () => ({
  collection: vi.fn((_, name) => ({ path: name })),
  doc: vi.fn(),
  addDoc: vi.fn(),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  updateDoc: vi.fn(),
  setDoc: vi.fn(),
  deleteDoc: vi.fn(),
  query: vi.fn(() => ({ kind: 'query' })),
  where: vi.fn((...args) => ({ kind: 'where', args })),
  orderBy: vi.fn(),
  limit: vi.fn((n) => ({ kind: 'limit', n })),
  writeBatch: vi.fn(),
  onSnapshot: vi.fn()
}))

vi.mock('../../firebase-config.js', () => ({
  db: {}
}))

const docSnap = (id, data) => ({
  id,
  data: () => data
})

describe('firebaseStorage.getDoctorPaymentRecords', () => {
  let firebaseStorage

  beforeEach(async () => {
    vi.clearAllMocks()
    const module = await import('../../services/firebaseStorage.js')
    firebaseStorage = module.default
  })

  it('returns empty array when doctorId is missing', async () => {
    const result = await firebaseStorage.getDoctorPaymentRecords('')
    expect(result).toEqual([])
    expect(getDocs).not.toHaveBeenCalled()
  })

  it('queries wallet and stripe logs by doctorId', async () => {
    getDocs
      .mockResolvedValueOnce({ docs: [] })
      .mockResolvedValueOnce({ docs: [] })

    await firebaseStorage.getDoctorPaymentRecords('doc-1', 200)

    expect(collection).toHaveBeenCalledWith(expect.anything(), 'doctorPaymentRecords')
    expect(collection).toHaveBeenCalledWith(expect.anything(), 'stripeCheckoutLogs')
    expect(where).toHaveBeenCalledWith('doctorId', '==', 'doc-1')
    expect(limit).toHaveBeenCalledWith(200)
    expect(query).toHaveBeenCalled()
  })

  it('normalizes stripe amount from smallest unit to major currency unit', async () => {
    getDocs
      .mockResolvedValueOnce({ docs: [] })
      .mockResolvedValueOnce({
        docs: [
          docSnap('s1', {
            sessionId: 'cs_1',
            amount: 500000,
            currency: 'lkr',
            interval: 'month',
            status: 'confirmed',
            createdAt: '2026-02-15T18:30:00.000Z'
          })
        ]
      })

    const result = await firebaseStorage.getDoctorPaymentRecords('doc-1')
    expect(result).toHaveLength(1)
    expect(result[0].amount).toBe(5000)
    expect(result[0].currency).toBe('LKR')
  })

  it('applies the same amount normalization for email fallback records', async () => {
    getDocs
      .mockResolvedValueOnce({ docs: [] })
      .mockResolvedValueOnce({ docs: [] })
      .mockResolvedValueOnce({
        docs: [
          docSnap('s2', {
            sessionId: 'cs_2',
            amount: 500000,
            currency: 'lkr',
            interval: 'month',
            status: 'confirmed',
            createdAt: '2026-02-15T18:31:00.000Z',
            userEmail: 'doctor@test.com'
          })
        ]
      })

    const result = await firebaseStorage.getDoctorPaymentRecords('doc-1', 200, 'doctor@test.com')
    expect(result).toHaveLength(1)
    expect(result[0].amount).toBe(5000)
    expect(result[0].currency).toBe('LKR')
  })

  it('maps interval to monthsDelta correctly', async () => {
    getDocs
      .mockResolvedValueOnce({ docs: [] })
      .mockResolvedValueOnce({
        docs: [
          docSnap('m', { sessionId: 'cs_m', interval: 'month', amount: 1000, createdAt: '2026-01-01T00:00:00.000Z' }),
          docSnap('y', { sessionId: 'cs_y', interval: 'year', amount: 12000, createdAt: '2026-01-02T00:00:00.000Z' }),
          docSnap('u', { sessionId: 'cs_u', interval: 'week', amount: 999, createdAt: '2026-01-03T00:00:00.000Z' })
        ]
      })

    const result = await firebaseStorage.getDoctorPaymentRecords('doc-1')
    const byRef = Object.fromEntries(result.map((r) => [r.referenceId, r.monthsDelta]))
    expect(byRef.cs_m).toBe(1)
    expect(byRef.cs_y).toBe(12)
    expect(byRef.cs_u).toBe(0)
  })

  it('keeps wallet records with native shape and status', async () => {
    getDocs
      .mockResolvedValueOnce({
        docs: [
          docSnap('w1', {
            doctorId: 'doc-1',
            type: 'stripe_payment',
            source: 'stripe',
            status: 'paid',
            monthsDelta: 1,
            amount: 5000,
            currency: 'LKR',
            referenceId: 'cs_wallet',
            createdAt: '2026-02-15T18:30:00.000Z'
          })
        ]
      })
      .mockResolvedValueOnce({ docs: [] })

    const result = await firebaseStorage.getDoctorPaymentRecords('doc-1')
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual(expect.objectContaining({
      type: 'stripe_payment',
      source: 'stripe',
      status: 'paid',
      amount: 5000
    }))
  })

  it('de-duplicates records by canonical reference across sources', async () => {
    getDocs
      .mockResolvedValueOnce({
        docs: [
          docSnap('w1', {
            referenceId: 'same-ref',
            source: 'stripe',
            sourceCollection: 'doctorPaymentRecords',
            createdAt: '2026-02-15T18:30:00.000Z'
          })
        ]
      })
      .mockResolvedValueOnce({
        docs: [
          docSnap('s1', {
            sessionId: 'same-ref',
            amount: 500000,
            currency: 'lkr',
            interval: 'month',
            createdAt: '2026-02-15T18:31:00.000Z'
          })
        ]
      })

    const result = await firebaseStorage.getDoctorPaymentRecords('doc-1')
    expect(result).toHaveLength(1)
    expect(result[0].sourceCollection).toBe('doctorPaymentRecords')
  })

  it('de-duplicates duplicate stripe rows found via doctorId and email fallback', async () => {
    getDocs
      .mockResolvedValueOnce({ docs: [] })
      .mockResolvedValueOnce({
        docs: [
          docSnap('s1', {
            sessionId: 'cs_same',
            amount: 500000,
            currency: 'lkr',
            interval: 'month',
            status: 'confirmed',
            createdAt: '2026-02-15T18:30:00.000Z'
          })
        ]
      })
      .mockResolvedValueOnce({
        docs: [
          docSnap('s1', {
            sessionId: 'cs_same',
            amount: 500000,
            currency: 'lkr',
            interval: 'month',
            status: 'confirmed',
            createdAt: '2026-02-15T18:30:00.000Z'
          })
        ]
      })

    const result = await firebaseStorage.getDoctorPaymentRecords('doc-1', 200, 'doctor@test.com')
    expect(result).toHaveLength(1)
    expect(result[0].referenceId).toBe('cs_same')
  })

  it('removes weak invoice-style duplicates when a matching paid record exists', async () => {
    getDocs
      .mockResolvedValueOnce({
        docs: [
          docSnap('w-paid', {
            referenceId: 'cs_same',
            source: 'stripe',
            type: 'stripe_payment',
            status: 'confirmed',
            monthsDelta: 1,
            amount: 5000,
            currency: 'LKR',
            createdAt: '2026-02-15T18:30:00.000Z'
          }),
          docSnap('w-weak', {
            referenceId: 'in_invoice_1',
            source: 'stripe',
            type: 'stripe_payment',
            status: 'confirmed',
            monthsDelta: 1,
            amount: 0,
            currency: 'LKR',
            createdAt: '2026-02-15T18:31:00.000Z'
          })
        ]
      })
      .mockResolvedValueOnce({ docs: [] })

    const result = await firebaseStorage.getDoctorPaymentRecords('doc-1')
    expect(result).toHaveLength(1)
    expect(result[0].referenceId).toBe('cs_same')
    expect(result[0].amount).toBe(5000)
  })

  it('removes zero-amount success duplicate even without invoice-like reference', async () => {
    getDocs
      .mockResolvedValueOnce({
        docs: [
          docSnap('w-paid', {
            referenceId: 'cs_same',
            source: 'stripe',
            type: 'stripe_payment',
            status: 'confirmed',
            monthsDelta: 1,
            amount: 5000,
            currency: 'LKR',
            createdAt: '2026-02-15T18:30:00.000Z'
          }),
          docSnap('w-zero', {
            referenceId: '',
            source: 'stripe',
            type: 'stripe_payment',
            status: 'confirmed',
            monthsDelta: 1,
            amount: 0,
            currency: 'LKR',
            createdAt: '2026-02-15T18:30:30.000Z'
          })
        ]
      })
      .mockResolvedValueOnce({ docs: [] })

    const result = await firebaseStorage.getDoctorPaymentRecords('doc-1')
    expect(result).toHaveLength(1)
    expect(result[0].amount).toBe(5000)
  })

  it('removes near-identical stripe success duplicates with same amount in a short window', async () => {
    getDocs
      .mockResolvedValueOnce({
        docs: [
          docSnap('w-paid-a', {
            referenceId: 'cs_a',
            source: 'stripe',
            type: 'stripe_payment',
            status: 'confirmed',
            monthsDelta: 1,
            amount: 5000,
            currency: 'LKR',
            createdAt: '2026-02-15T18:30:00.000Z'
          }),
          docSnap('w-paid-b', {
            referenceId: 'in_b',
            source: 'stripe',
            type: 'stripe_payment',
            status: 'confirmed',
            monthsDelta: 1,
            amount: 5000,
            currency: 'LKR',
            createdAt: '2026-02-15T18:30:45.000Z'
          })
        ]
      })
      .mockResolvedValueOnce({ docs: [] })

    const result = await firebaseStorage.getDoctorPaymentRecords('doc-1')
    expect(result).toHaveLength(1)
    expect(result[0].amount).toBe(5000)
  })

  it('removes zero-amount success duplicate when months/currency metadata is missing', async () => {
    getDocs
      .mockResolvedValueOnce({
        docs: [
          docSnap('w-paid', {
            referenceId: 'cs_paid',
            source: 'stripe',
            type: 'stripe_payment',
            status: 'confirmed',
            monthsDelta: 1,
            amount: 5000,
            currency: 'LKR',
            createdAt: '2026-02-15T18:30:00.000Z'
          }),
          docSnap('w-missing-meta', {
            referenceId: 'in_missing',
            source: 'stripe',
            type: 'stripe_payment',
            status: 'confirmed',
            monthsDelta: 0,
            amount: 0,
            currency: '',
            createdAt: '2026-02-15T18:31:00.000Z'
          })
        ]
      })
      .mockResolvedValueOnce({ docs: [] })

    const result = await firebaseStorage.getDoctorPaymentRecords('doc-1')
    expect(result).toHaveLength(1)
    expect(result[0].referenceId).toBe('cs_paid')
  })

  it('sorts by newest createdAt first', async () => {
    getDocs
      .mockResolvedValueOnce({ docs: [] })
      .mockResolvedValueOnce({
        docs: [
          docSnap('s-old', { sessionId: 'old', amount: 1000, interval: 'month', createdAt: '2026-02-01T00:00:00.000Z' }),
          docSnap('s-new', { sessionId: 'new', amount: 1000, interval: 'month', createdAt: '2026-02-02T00:00:00.000Z' })
        ]
      })

    const result = await firebaseStorage.getDoctorPaymentRecords('doc-1')
    expect(result.map((r) => r.referenceId)).toEqual(['new', 'old'])
  })

  it('applies final limit after merging', async () => {
    getDocs
      .mockResolvedValueOnce({
        docs: [
          docSnap('w1', { referenceId: 'w1', createdAt: '2026-02-01T00:00:00.000Z' }),
          docSnap('w2', { referenceId: 'w2', createdAt: '2026-02-02T00:00:00.000Z' })
        ]
      })
      .mockResolvedValueOnce({
        docs: [
          docSnap('s1', { sessionId: 's1', amount: 1000, interval: 'month', createdAt: '2026-02-03T00:00:00.000Z' }),
          docSnap('s2', { sessionId: 's2', amount: 1000, interval: 'month', createdAt: '2026-02-04T00:00:00.000Z' })
        ]
      })

    const result = await firebaseStorage.getDoctorPaymentRecords('doc-1', 2)
    expect(result).toHaveLength(2)
    expect(result[0].referenceId).toBe('s2')
    expect(result[1].referenceId).toBe('s1')
  })

  it('uses default created status for stripe rows when status is missing', async () => {
    getDocs
      .mockResolvedValueOnce({ docs: [] })
      .mockResolvedValueOnce({
        docs: [
          docSnap('s1', {
            sessionId: 'cs_no_status',
            amount: 1000,
            currency: 'usd',
            interval: 'month',
            createdAt: '2026-02-15T18:30:00.000Z'
          })
        ]
      })

    const result = await firebaseStorage.getDoctorPaymentRecords('doc-1')
    expect(result).toHaveLength(1)
    expect(result[0].status).toBe('created')
  })

  it('does not collapse success and fail stripe records that share amount/time window', async () => {
    getDocs
      .mockResolvedValueOnce({
        docs: [
          docSnap('w-success', {
            referenceId: 'cs_success',
            source: 'stripe',
            type: 'stripe_payment',
            status: 'confirmed',
            monthsDelta: 1,
            amount: 5000,
            currency: 'LKR',
            createdAt: '2026-02-15T18:30:00.000Z'
          }),
          docSnap('w-fail', {
            referenceId: 'cs_fail',
            source: 'stripe',
            type: 'stripe_payment',
            status: 'failed',
            monthsDelta: 1,
            amount: 5000,
            currency: 'LKR',
            createdAt: '2026-02-15T18:31:00.000Z'
          })
        ]
      })
      .mockResolvedValueOnce({ docs: [] })

    const result = await firebaseStorage.getDoctorPaymentRecords('doc-1')
    expect(result).toHaveLength(2)
    expect(result.map((record) => String(record.status).toLowerCase()).sort()).toEqual(['confirmed', 'failed'])
  })

  it('keeps non-stripe manual adjustments even when stripe records exist nearby', async () => {
    getDocs
      .mockResolvedValueOnce({
        docs: [
          docSnap('manual-1', {
            source: 'admin',
            type: 'manual_adjustment',
            status: 'recorded',
            monthsDelta: 0,
            amount: 5000,
            currency: 'LKR',
            referenceId: 'manual-credit-1',
            createdAt: '2026-02-15T18:30:00.000Z'
          })
        ]
      })
      .mockResolvedValueOnce({
        docs: [
          docSnap('stripe-1', {
            sessionId: 'cs_live_1',
            amount: 500000,
            currency: 'lkr',
            interval: 'month',
            status: 'confirmed',
            createdAt: '2026-02-15T18:31:00.000Z'
          })
        ]
      })

    const result = await firebaseStorage.getDoctorPaymentRecords('doc-1')
    expect(result).toHaveLength(2)
    expect(result.some((record) => record.type === 'manual_adjustment')).toBe(true)
    expect(result.some((record) => record.referenceId === 'cs_live_1')).toBe(true)
  })
})

describe('firebaseStorage doctor AI usage server stats', () => {
  let firebaseStorage

  beforeEach(async () => {
    vi.clearAllMocks()
    const module = await import('../../services/firebaseStorage.js')
    firebaseStorage = module.default
  })

  it('persists AI usage log and updates doctor aggregate stats', async () => {
    addDoc.mockResolvedValueOnce({ id: 'log-1' })
    getDoc.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({
        doctorId: 'doc-ai-1',
        totalTokens: 100,
        totalCost: 0.1,
        totalRequests: 2,
        todayDate: '2026-02-15',
        todayTokens: 50,
        todayCost: 0.05,
        todayRequests: 1
      })
    })
    setDoc.mockResolvedValueOnce(undefined)

    await firebaseStorage.addDoctorAIUsageRecord({
      doctorId: 'doc-ai-1',
      requestType: 'chatbotResponse',
      promptTokens: 40,
      completionTokens: 60,
      totalTokens: 100,
      cost: 0.02,
      model: 'gpt-4o-mini',
      createdAt: '2026-02-15T10:20:30.000Z'
    })

    expect(addDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        doctorId: 'doc-ai-1',
        requestType: 'chatbotResponse',
        totalTokens: 100,
        cost: 0.02
      })
    )
    const [, savedStats, saveOptions] = setDoc.mock.calls[0]
    expect(savedStats).toEqual(expect.objectContaining({
      doctorId: 'doc-ai-1',
      totalTokens: 200,
      totalRequests: 3,
      todayDate: '2026-02-15',
      todayTokens: 150,
      todayRequests: 2
    }))
    expect(savedStats.totalCost).toBeCloseTo(0.12, 8)
    expect(saveOptions).toEqual({ merge: true })
  })

  it('returns normalized doctor AI usage stats from aggregate doc', async () => {
    getDoc.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({
        totalTokens: 1200,
        totalCost: 0.45,
        totalRequests: 12,
        todayDate: new Date().toISOString().slice(0, 10),
        todayTokens: 300,
        todayCost: 0.1,
        todayRequests: 3
      })
    })

    const result = await firebaseStorage.getDoctorAIUsageStats('doc-ai-2')
    expect(doc).toHaveBeenCalledWith(expect.anything(), 'doctorAiUsageStats', 'doc-ai-2')
    expect(result).toEqual({
      total: { tokens: 1200, cost: 0.45, requests: 12 },
      today: { tokens: 300, cost: 0.1, requests: 3 }
    })
  })

  it('builds doctor usage map for multiple doctors', async () => {
    getDoc
      .mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          totalTokens: 1000,
          totalCost: 0.2,
          totalRequests: 10,
          todayDate: new Date().toISOString().slice(0, 10),
          todayTokens: 100,
          todayCost: 0.02,
          todayRequests: 1
        })
      })
      .mockResolvedValueOnce({
        exists: () => false
      })

    const result = await firebaseStorage.getDoctorAIUsageStatsMap(['doc-a', 'doc-b'])
    expect(result['doc-a']).toEqual({
      total: { tokens: 1000, cost: 0.2, requests: 10 },
      today: { tokens: 100, cost: 0.02, requests: 1 }
    })
    expect(result['doc-b']).toEqual({
      total: { tokens: 0, cost: 0, requests: 0 },
      today: { tokens: 0, cost: 0, requests: 0 }
    })
  })

  it('aggregates global AI usage summary across doctor stats docs', async () => {
    getDocs.mockResolvedValueOnce({
      docs: [
        docSnap('doc-a', {
          totalTokens: 1000,
          totalCost: 0.2,
          totalRequests: 10,
          todayDate: new Date().toISOString().slice(0, 10),
          todayTokens: 120,
          todayCost: 0.03,
          todayRequests: 2,
          updatedAt: '2026-02-15T10:00:00.000Z'
        }),
        docSnap('doc-b', {
          totalTokens: 2000,
          totalCost: 0.5,
          totalRequests: 20,
          todayDate: '2026-02-14',
          todayTokens: 90,
          todayCost: 0.01,
          todayRequests: 1,
          updatedAt: '2026-02-15T11:00:00.000Z'
        })
      ]
    })

    const result = await firebaseStorage.getAllDoctorAIUsageSummary(100)
    expect(collection).toHaveBeenCalledWith(expect.anything(), 'doctorAiUsageStats')
    expect(limit).toHaveBeenCalledWith(100)
    expect(result.total.tokens).toBe(3000)
    expect(result.total.cost).toBe(0.7)
    expect(result.total.requests).toBe(30)
    expect(result.today.tokens).toBe(120)
    expect(result.today.requests).toBe(2)
    expect(result.lastUpdated).toBe('2026-02-15T11:00:00.000Z')
  })
})
