import { afterEach, describe, expect, it, vi } from 'vitest'
import { createRequire } from 'module'

const functionsRequire = createRequire(`${process.cwd()}/functions/index.js`)
const functionsModule = functionsRequire('./index.js')
const admin = functionsRequire('firebase-admin')

const mockPromoLookup = (promoData = {}) => {
  const getMock = vi.fn().mockResolvedValue({
    empty: false,
    docs: [
      {
        id: 'promo-1',
        data: () => ({
          code: 'SAVE10',
          discountType: 'percent',
          percentOff: 10,
          isActive: true,
          validFrom: '2026-01-01T00:00:00.000Z',
          validUntil: '2026-12-31T23:59:59.999Z',
          ...promoData
        })
      }
    ]
  })
  const limitMock = vi.fn(() => ({ get: getMock }))
  const whereMock = vi.fn(() => ({ limit: limitMock }))
  const collectionMock = vi.fn(() => ({ where: whereMock }))
  vi.spyOn(admin, 'firestore').mockReturnValue({
    collection: collectionMock
  })
}

describe('stripe pricing overrides', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('keeps default plan pricing when config is missing or disabled', () => {
    const defaults = functionsModule.__resolvePlanCatalogForCheckoutForTests({
      pricingConfig: null,
      isNewCustomer: true
    })
    expect(defaults.professional_monthly_usd.unitAmount).toBe(2000)
    expect(defaults.professional_annual_usd.unitAmount).toBe(20000)

    const disabled = functionsModule.__resolvePlanCatalogForCheckoutForTests({
      pricingConfig: {
        enabled: false,
        monthlyUsd: 99,
        annualUsd: 999,
        monthlyLkr: 9999,
        annualLkr: 99999,
        appliesTo: 'all_customers'
      },
      isNewCustomer: true
    })
    expect(disabled.professional_monthly_usd.unitAmount).toBe(2000)
    expect(disabled.professional_annual_lkr.unitAmount).toBe(5000000)
  })

  it('applies overrides for new customers when scope is new_customers', () => {
    const catalog = functionsModule.__resolvePlanCatalogForCheckoutForTests({
      pricingConfig: {
        enabled: true,
        monthlyUsd: 35,
        annualUsd: 350,
        monthlyLkr: 7000,
        annualLkr: 70000,
        appliesTo: 'new_customers'
      },
      isNewCustomer: true
    })

    expect(catalog.professional_monthly_usd.unitAmount).toBe(3500)
    expect(catalog.professional_annual_usd.unitAmount).toBe(35000)
    expect(catalog.professional_monthly_lkr.unitAmount).toBe(700000)
    expect(catalog.professional_annual_lkr.unitAmount).toBe(7000000)
  })

  it('does not apply new-customer overrides for existing paying doctors', () => {
    const catalog = functionsModule.__resolvePlanCatalogForCheckoutForTests({
      pricingConfig: {
        enabled: true,
        monthlyUsd: 35,
        annualUsd: 350,
        monthlyLkr: 7000,
        annualLkr: 70000,
        appliesTo: 'new_customers'
      },
      isNewCustomer: false
    })

    expect(catalog.professional_monthly_usd.unitAmount).toBe(2000)
    expect(catalog.professional_annual_lkr.unitAmount).toBe(5000000)
  })

  it('applies overrides for existing customers when scope is all_customers', () => {
    const catalog = functionsModule.__resolvePlanCatalogForCheckoutForTests({
      pricingConfig: {
        enabled: true,
        monthlyUsd: 45,
        annualUsd: 450,
        monthlyLkr: 9000,
        annualLkr: 90000,
        appliesTo: 'all_customers'
      },
      isNewCustomer: false
    })

    expect(catalog.professional_monthly_usd.unitAmount).toBe(4500)
    expect(catalog.professional_annual_usd.unitAmount).toBe(45000)
    expect(catalog.professional_monthly_lkr.unitAmount).toBe(900000)
    expect(catalog.professional_annual_lkr.unitAmount).toBe(9000000)
  })

  it('ignores invalid or too-small override values and keeps defaults', () => {
    const catalog = functionsModule.__resolvePlanCatalogForCheckoutForTests({
      pricingConfig: {
        enabled: true,
        monthlyUsd: -10,
        annualUsd: 0,
        monthlyLkr: 'abc',
        annualLkr: 0.2,
        appliesTo: 'all_customers'
      },
      isNewCustomer: true
    })

    expect(catalog.professional_monthly_usd.unitAmount).toBe(2000)
    expect(catalog.professional_annual_usd.unitAmount).toBe(20000)
    expect(catalog.professional_monthly_lkr.unitAmount).toBe(500000)
    expect(catalog.professional_annual_lkr.unitAmount).toBe(5000000)
  })

  it('ignores overrides when appliesTo has unknown value', () => {
    const existingCustomerCatalog = functionsModule.__resolvePlanCatalogForCheckoutForTests({
      pricingConfig: {
        enabled: true,
        monthlyUsd: 55,
        annualUsd: 550,
        monthlyLkr: 9500,
        annualLkr: 95000,
        appliesTo: 'invalid_scope'
      },
      isNewCustomer: false
    })
    const newCustomerCatalog = functionsModule.__resolvePlanCatalogForCheckoutForTests({
      pricingConfig: {
        enabled: true,
        monthlyUsd: 55,
        annualUsd: 550,
        monthlyLkr: 9500,
        annualLkr: 95000,
        appliesTo: 'invalid_scope'
      },
      isNewCustomer: true
    })

    expect(existingCustomerCatalog.professional_monthly_usd.unitAmount).toBe(2000)
    expect(existingCustomerCatalog.professional_annual_lkr.unitAmount).toBe(5000000)
    expect(newCustomerCatalog.professional_monthly_usd.unitAmount).toBe(2000)
    expect(newCustomerCatalog.professional_annual_lkr.unitAmount).toBe(5000000)
  })

  it('treats doctor as existing customer when payment markers are present', () => {
    expect(functionsModule.__hasDoctorPriorPaymentHistoryForTests({})).toBe(false)
    expect(functionsModule.__hasDoctorPriorPaymentHistoryForTests({ paymentDone: true })).toBe(true)
    expect(functionsModule.__hasDoctorPriorPaymentHistoryForTests({ paymentStatus: 'paid' })).toBe(true)
    expect(functionsModule.__hasDoctorPriorPaymentHistoryForTests({ paymentStatus: '  CONFIRMED ' })).toBe(true)
    expect(functionsModule.__hasDoctorPriorPaymentHistoryForTests({ walletMonths: 1 })).toBe(true)
    expect(functionsModule.__hasDoctorPriorPaymentHistoryForTests({ stripeCustomerId: 'cus_123' })).toBe(true)
    expect(functionsModule.__hasDoctorPriorPaymentHistoryForTests({ stripeSubscriptionId: 'sub_123' })).toBe(true)
    expect(functionsModule.__hasDoctorPriorPaymentHistoryForTests({ paymentDoneAt: '2026-02-01T00:00:00.000Z' })).toBe(true)
    expect(functionsModule.__hasDoctorPriorPaymentHistoryForTests({ stripeLastPaymentAt: '2026-02-01T00:00:00.000Z' })).toBe(true)
  })

  it('applies promo discount on scoped override amount for existing customers', async () => {
    mockPromoLookup()
    const catalog = functionsModule.__resolvePlanCatalogForCheckoutForTests({
      pricingConfig: {
        enabled: true,
        monthlyUsd: 45,
        annualUsd: 450,
        monthlyLkr: 9000,
        annualLkr: 90000,
        appliesTo: 'all_customers'
      },
      isNewCustomer: false
    })
    const selectedPlan = {
      planId: 'professional_monthly_usd',
      currency: 'usd',
      unitAmount: catalog.professional_monthly_usd.unitAmount
    }

    const result = await functionsModule.__resolvePromoForCheckoutForTests({
      promoCode: 'save10',
      selectedPlan,
      baseUnitAmount: selectedPlan.unitAmount
    })

    expect(selectedPlan.unitAmount).toBe(4500)
    expect(result.promo.code).toBe('SAVE10')
    expect(result.discountAmount).toBe(450)
    expect(result.finalUnitAmount).toBe(4050)
  })

  it('keeps existing-customer default pricing when scope is new_customers before promo', async () => {
    mockPromoLookup()
    const catalog = functionsModule.__resolvePlanCatalogForCheckoutForTests({
      pricingConfig: {
        enabled: true,
        monthlyUsd: 45,
        annualUsd: 450,
        monthlyLkr: 9000,
        annualLkr: 90000,
        appliesTo: 'new_customers'
      },
      isNewCustomer: false
    })
    const selectedPlan = {
      planId: 'professional_monthly_usd',
      currency: 'usd',
      unitAmount: catalog.professional_monthly_usd.unitAmount
    }

    const result = await functionsModule.__resolvePromoForCheckoutForTests({
      promoCode: 'save10',
      selectedPlan,
      baseUnitAmount: selectedPlan.unitAmount
    })

    expect(selectedPlan.unitAmount).toBe(2000)
    expect(result.discountAmount).toBe(200)
    expect(result.finalUnitAmount).toBe(1800)
  })

  it('accepts promo exactly at validity window boundaries', async () => {
    const nowMs = Date.parse('2026-06-15T10:00:00.000Z')
    vi.spyOn(Date, 'now').mockReturnValue(nowMs)
    mockPromoLookup({
      validFrom: '2026-06-15T10:00:00.000Z',
      validUntil: '2026-06-15T10:00:00.000Z',
      maxRedemptions: 10,
      redemptionCount: 5
    })

    const result = await functionsModule.__resolvePromoForCheckoutForTests({
      promoCode: 'save10',
      selectedPlan: {
        planId: 'professional_monthly_usd',
        currency: 'usd',
        unitAmount: 2000
      },
      baseUnitAmount: 2000
    })

    expect(result.promo.code).toBe('SAVE10')
    expect(result.discountAmount).toBe(200)
    expect(result.finalUnitAmount).toBe(1800)
  })

  it('rejects promo when expired by 1ms or redemption limit reached', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-06-15T10:00:00.000Z'))
    mockPromoLookup({
      validFrom: '2026-01-01T00:00:00.000Z',
      validUntil: '2026-06-15T09:59:59.999Z',
      maxRedemptions: 10,
      redemptionCount: 10
    })

    await expect(
      functionsModule.__resolvePromoForCheckoutForTests({
        promoCode: 'save10',
        selectedPlan: {
          planId: 'professional_monthly_usd',
          currency: 'usd',
          unitAmount: 2000
        },
        baseUnitAmount: 2000
      })
    ).rejects.toThrow(/expired|redemption limit reached/i)
  })

  it('rejects inactive promo code', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-06-15T10:00:00.000Z'))
    mockPromoLookup({
      isActive: false,
      validFrom: '2026-01-01T00:00:00.000Z',
      validUntil: '2026-12-31T23:59:59.999Z'
    })

    await expect(
      functionsModule.__resolvePromoForCheckoutForTests({
        promoCode: 'save10',
        selectedPlan: {
          planId: 'professional_monthly_usd',
          currency: 'usd',
          unitAmount: 2000
        },
        baseUnitAmount: 2000
      })
    ).rejects.toThrow(/inactive/i)
  })

  it('clamps fixed promo discount to minimum checkout amount', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-06-15T10:00:00.000Z'))
    mockPromoLookup({
      discountType: 'fixed',
      fixedAmountMinor: 999999,
      validFrom: '2026-01-01T00:00:00.000Z',
      validUntil: '2026-12-31T23:59:59.999Z',
      isActive: true
    })

    const result = await functionsModule.__resolvePromoForCheckoutForTests({
      promoCode: 'save10',
      selectedPlan: {
        planId: 'professional_monthly_usd',
        currency: 'usd',
        unitAmount: 2000
      },
      baseUnitAmount: 2000
    })

    expect(result.promo.discountType).toBe('fixed')
    expect(result.finalUnitAmount).toBe(50)
  })

  it('rejects promo when currency does not match selected plan', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-06-15T10:00:00.000Z'))
    mockPromoLookup({
      currency: 'lkr',
      validFrom: '2026-01-01T00:00:00.000Z',
      validUntil: '2026-12-31T23:59:59.999Z',
      isActive: true
    })

    await expect(
      functionsModule.__resolvePromoForCheckoutForTests({
        promoCode: 'save10',
        selectedPlan: {
          planId: 'professional_monthly_usd',
          currency: 'usd',
          unitAmount: 2000
        },
        baseUnitAmount: 2000
      })
    ).rejects.toThrow(/not valid for this currency/i)
  })

  it('rejects promo when plan scope does not include selected plan', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-06-15T10:00:00.000Z'))
    mockPromoLookup({
      planIds: ['professional_annual_usd'],
      validFrom: '2026-01-01T00:00:00.000Z',
      validUntil: '2026-12-31T23:59:59.999Z',
      isActive: true
    })

    await expect(
      functionsModule.__resolvePromoForCheckoutForTests({
        promoCode: 'save10',
        selectedPlan: {
          planId: 'professional_monthly_usd',
          currency: 'usd',
          unitAmount: 2000
        },
        baseUnitAmount: 2000
      })
    ).rejects.toThrow(/not valid for this plan/i)
  })
})
