export const calculateDaysUntilDate = (value, now = new Date()) => {
  if (!value) return null
  const targetDate = new Date(value)
  if (Number.isNaN(targetDate.getTime())) return null
  const baseline = new Date(now)
  baseline.setHours(0, 0, 0, 0)
  targetDate.setHours(0, 0, 0, 0)
  return Math.ceil((targetDate.getTime() - baseline.getTime()) / (1000 * 60 * 60 * 24))
}

const pluralize = (count, singular, plural) => (count === 1 ? singular : plural)

export const buildDoctorNotificationItems = ({
  isDoctor = false,
  isExternalDoctor = false,
  lowStockCount = 0,
  expiringSoonCount = 0,
  expiredCount = 0,
  adminStripeDiscountPercent = 0,
  accessExpiresAt = null,
  now = new Date()
} = {}) => {
  if (!isDoctor || isExternalDoctor) {
    return []
  }

  const items = []
  const expiringTotal = Math.max(0, Number(expiringSoonCount || 0) + Number(expiredCount || 0))
  const lowStockTotal = Math.max(0, Number(lowStockCount || 0))

  if (expiringTotal > 0 || lowStockTotal > 0) {
    const chunks = []
    if (expiringTotal > 0) {
      chunks.push(`${expiringTotal} ${pluralize(expiringTotal, 'drug', 'drugs')} expiring`)
    }
    if (lowStockTotal > 0) {
      chunks.push(`${lowStockTotal} ${pluralize(lowStockTotal, 'drug', 'drugs')} under lower limit`)
    }
    items.push({
      id: 'inventory-alerts',
      title: `Your collection has ${chunks.join(' and ')}.`,
      actionText: 'Click here for information.',
      targetView: 'notifications'
    })
  }

  const normalizedAdminDiscountPercent = Math.max(0, Math.min(100, Number(adminStripeDiscountPercent || 0)))
  const daysToAccessExpiry = calculateDaysUntilDate(accessExpiresAt, now)
  if (normalizedAdminDiscountPercent < 100 && daysToAccessExpiry !== null && daysToAccessExpiry <= 7) {
    const absDays = Math.abs(daysToAccessExpiry)
    const paymentText = daysToAccessExpiry > 0
      ? `Your payment is due in ${daysToAccessExpiry} ${pluralize(daysToAccessExpiry, 'day', 'days')}.`
      : daysToAccessExpiry === 0
        ? 'Your payment is due today.'
        : `Your payment is overdue by ${absDays} ${pluralize(absDays, 'day', 'days')}.`
    items.push({
      id: 'payment-due',
      title: paymentText,
      actionText: 'Click here to complete payment.',
      targetView: 'payments'
    })
  }

  return items
}
