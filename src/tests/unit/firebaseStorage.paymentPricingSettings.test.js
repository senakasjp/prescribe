import { beforeEach, describe, expect, it, vi } from 'vitest'
import { doc, getDoc, setDoc } from 'firebase/firestore'

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  doc: vi.fn(() => ({ path: 'systemSettings/paymentPricing' })),
  addDoc: vi.fn(),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  updateDoc: vi.fn(),
  setDoc: vi.fn(),
  deleteDoc: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  writeBatch: vi.fn(),
  onSnapshot: vi.fn()
}))

vi.mock('../../firebase-config.js', () => ({
  db: {}
}))

describe('firebaseStorage payment pricing settings', () => {
  let firebaseStorage

  beforeEach(async () => {
    vi.clearAllMocks()
    const module = await import('../../services/firebaseStorage.js')
    firebaseStorage = module.default
  })

  it('returns null when paymentPricing settings doc does not exist', async () => {
    getDoc.mockResolvedValueOnce({
      exists: () => false
    })

    const result = await firebaseStorage.getPaymentPricingSettings()

    expect(doc).toHaveBeenCalledWith(expect.anything(), 'systemSettings', 'paymentPricing')
    expect(result).toBeNull()
  })

  it('returns paymentPricing settings data when doc exists', async () => {
    getDoc.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({
        monthlyUsd: 35,
        annualUsd: 350,
        appliesTo: 'all_customers',
        enabled: true
      })
    })

    const result = await firebaseStorage.getPaymentPricingSettings()

    expect(result).toEqual({
      monthlyUsd: 35,
      annualUsd: 350,
      appliesTo: 'all_customers',
      enabled: true
    })
  })

  it('saves paymentPricing settings with merge and updatedAt', async () => {
    await firebaseStorage.savePaymentPricingSettings({
      monthlyUsd: 35,
      annualUsd: 350,
      monthlyLkr: 7000,
      annualLkr: 70000,
      appliesTo: 'new_customers',
      enabled: true,
      updatedBy: 'admin@test.com'
    })

    expect(doc).toHaveBeenCalledWith(expect.anything(), 'systemSettings', 'paymentPricing')
    expect(setDoc).toHaveBeenCalledTimes(1)

    const [_, payload, options] = setDoc.mock.calls[0]
    expect(payload).toEqual(expect.objectContaining({
      monthlyUsd: 35,
      annualUsd: 350,
      monthlyLkr: 7000,
      annualLkr: 70000,
      appliesTo: 'new_customers',
      enabled: true,
      updatedBy: 'admin@test.com',
      updatedAt: expect.any(String)
    }))
    expect(options).toEqual({ merge: true })
  })

  it('returns null when aiModelSettings doc does not exist', async () => {
    getDoc.mockResolvedValueOnce({
      exists: () => false
    })

    const result = await firebaseStorage.getAIModelSettings()

    expect(doc).toHaveBeenCalledWith(expect.anything(), 'systemSettings', 'aiModelSettings')
    expect(result).toBeNull()
  })

  it('returns aiModelSettings data when doc exists', async () => {
    getDoc.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({
        imageAnalysisModel: 'gpt-4.1-mini',
        otherAnalysisModel: 'gpt-4.1',
        spellGrammarModel: 'gpt-4o-mini'
      })
    })

    const result = await firebaseStorage.getAIModelSettings()

    expect(result).toEqual({
      imageAnalysisModel: 'gpt-4.1-mini',
      otherAnalysisModel: 'gpt-4.1',
      spellGrammarModel: 'gpt-4o-mini'
    })
  })

  it('saves aiModelSettings with merge and updatedAt', async () => {
    await firebaseStorage.saveAIModelSettings({
      imageAnalysisModel: 'gpt-4.1-mini',
      otherAnalysisModel: 'gpt-4.1',
      spellGrammarModel: 'gpt-4o-mini',
      updatedBy: 'admin@test.com'
    })

    expect(doc).toHaveBeenCalledWith(expect.anything(), 'systemSettings', 'aiModelSettings')
    expect(setDoc).toHaveBeenCalledTimes(1)

    const [_, payload, options] = setDoc.mock.calls[0]
    expect(payload).toEqual(expect.objectContaining({
      imageAnalysisModel: 'gpt-4.1-mini',
      otherAnalysisModel: 'gpt-4.1',
      spellGrammarModel: 'gpt-4o-mini',
      updatedBy: 'admin@test.com',
      updatedAt: expect.any(String)
    }))
    expect(options).toEqual({ merge: true })
  })
})
