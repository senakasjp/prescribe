import { resolveCurrencyFromCountry } from './currencyByCountry.js'
import { resolveLocaleFromCountry } from './localeByCountry.js'

const normalizeCurrencyCode = (value) => String(value || '').trim().toUpperCase()

export const formatCurrency = (amount, options = {}) => {
  const {
    currency,
    country,
    locale,
    minimumFractionDigits,
    maximumFractionDigits,
    includeCurrencyCode = false,
    lkrSymbol = 'prefix'
  } = options

  const resolvedCurrency = normalizeCurrencyCode(currency || resolveCurrencyFromCountry(country) || 'USD')
  const resolvedLocale = locale || resolveLocaleFromCountry(country) || 'en-GB'
  const safeAmount = Number.isFinite(Number(amount)) ? Number(amount) : 0

  try {
    const formatted = new Intl.NumberFormat(resolvedLocale, {
      style: 'currency',
      currency: resolvedCurrency,
      currencyDisplay: 'code',
      minimumFractionDigits,
      maximumFractionDigits
    }).format(safeAmount)

    if (!includeCurrencyCode) return formatted

    return formatted
  } catch (error) {
    console.error('❌ Error formatting currency:', error)
    return `${resolvedCurrency} ${safeAmount}`
  }
}
