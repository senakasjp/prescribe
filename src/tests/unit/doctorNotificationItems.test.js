import { describe, expect, it } from 'vitest'
import { buildDoctorNotificationItems, calculateDaysUntilDate } from '../../utils/doctorNotificationItems.js'

describe('doctorNotificationItems', () => {
  it('returns no notifications for non-doctor or external-doctor context', () => {
    expect(buildDoctorNotificationItems({ isDoctor: false })).toEqual([])
    expect(buildDoctorNotificationItems({ isDoctor: true, isExternalDoctor: true })).toEqual([])
  })

  it('builds inventory summary notification with expiring + low-stock counts', () => {
    const items = buildDoctorNotificationItems({
      isDoctor: true,
      lowStockCount: 2,
      expiringSoonCount: 3,
      expiredCount: 1
    })

    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({
      id: 'inventory-alerts',
      actionText: 'Click here for information.',
      targetView: 'notifications'
    })
    expect(items[0].title).toContain('4 drugs expiring')
    expect(items[0].title).toContain('2 drugs under lower limit')
  })

  it('builds singular grammar correctly', () => {
    const items = buildDoctorNotificationItems({
      isDoctor: true,
      lowStockCount: 1,
      expiringSoonCount: 0,
      expiredCount: 1
    })

    expect(items[0].title).toContain('1 drug expiring')
    expect(items[0].title).toContain('1 drug under lower limit')
  })

  it('adds due-payment notification when access expires in <= 7 days', () => {
    const now = new Date('2026-02-16T10:00:00.000Z')
    const dueIn3Days = new Date('2026-02-19T10:00:00.000Z').toISOString()
    const items = buildDoctorNotificationItems({
      isDoctor: true,
      accessExpiresAt: dueIn3Days,
      now
    })
    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({
      id: 'payment-due',
      actionText: 'Click here to complete payment.',
      targetView: 'payments'
    })
    expect(items[0].title).toBe('Your payment is due in 3 days.')
  })

  it('adds due-today and overdue variants for payment notification', () => {
    const now = new Date(2026, 1, 16, 10, 0, 0)
    const dueToday = new Date(2026, 1, 16, 18, 0, 0)
    const overdue2 = new Date(2026, 1, 14, 8, 0, 0)

    const todayItems = buildDoctorNotificationItems({
      isDoctor: true,
      accessExpiresAt: dueToday,
      now
    })
    expect(todayItems[0].title).toBe('Your payment is due today.')

    const overdueItems = buildDoctorNotificationItems({
      isDoctor: true,
      accessExpiresAt: overdue2,
      now
    })
    expect(overdueItems[0].title).toBe('Your payment is overdue by 2 days.')
  })

  it('does not add due-payment notification when expiry is more than 7 days away', () => {
    const now = new Date('2026-02-16T10:00:00.000Z')
    const dueIn8Days = new Date('2026-02-24T10:00:00.000Z').toISOString()
    const items = buildDoctorNotificationItems({
      isDoctor: true,
      accessExpiresAt: dueIn8Days,
      now
    })
    expect(items).toEqual([])
  })

  it('does not add due-payment notification when admin discount is 100%', () => {
    const now = new Date('2026-02-16T10:00:00.000Z')
    const dueIn2Days = new Date('2026-02-18T10:00:00.000Z').toISOString()
    const items = buildDoctorNotificationItems({
      isDoctor: true,
      adminStripeDiscountPercent: 100,
      accessExpiresAt: dueIn2Days,
      now
    })
    expect(items).toEqual([])
  })

  it('includes both notifications when both inventory and payment criteria are met', () => {
    const now = new Date('2026-02-16T10:00:00.000Z')
    const dueIn1Day = new Date('2026-02-17T10:00:00.000Z').toISOString()
    const items = buildDoctorNotificationItems({
      isDoctor: true,
      lowStockCount: 1,
      expiringSoonCount: 2,
      expiredCount: 0,
      accessExpiresAt: dueIn1Day,
      now
    })
    expect(items.map((item) => item.id)).toEqual(['inventory-alerts', 'payment-due'])
  })

  it('calculateDaysUntilDate returns null for invalid values and whole-day deltas for valid dates', () => {
    expect(calculateDaysUntilDate(null)).toBeNull()
    expect(calculateDaysUntilDate('not-a-date')).toBeNull()

    const now = new Date(2026, 1, 16, 11, 11, 0)
    expect(calculateDaysUntilDate(new Date(2026, 1, 16, 23, 59, 59), now)).toBe(0)
    expect(calculateDaysUntilDate(new Date(2026, 1, 18, 0, 0, 0), now)).toBe(2)
    expect(calculateDaysUntilDate(new Date(2026, 1, 15, 0, 0, 0), now)).toBe(-1)
  })
})
