import { describe, expect, it } from 'vitest'
import { createRequire } from 'module'

const functionsRequire = createRequire(`${process.cwd()}/functions/index.js`)
const functionsModule = functionsRequire('./index.js')

describe('stripe pricing overrides', () => {
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

  it('treats doctor as existing customer when payment markers are present', () => {
    expect(functionsModule.__hasDoctorPriorPaymentHistoryForTests({})).toBe(false)
    expect(functionsModule.__hasDoctorPriorPaymentHistoryForTests({ paymentDone: true })).toBe(true)
    expect(functionsModule.__hasDoctorPriorPaymentHistoryForTests({ paymentStatus: 'paid' })).toBe(true)
    expect(functionsModule.__hasDoctorPriorPaymentHistoryForTests({ walletMonths: 1 })).toBe(true)
    expect(functionsModule.__hasDoctorPriorPaymentHistoryForTests({ stripeCustomerId: 'cus_123' })).toBe(true)
    expect(functionsModule.__hasDoctorPriorPaymentHistoryForTests({ stripeSubscriptionId: 'sub_123' })).toBe(true)
  })
})
