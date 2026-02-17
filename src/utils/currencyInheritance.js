import { resolveCurrencyFromCountry } from './currencyByCountry.js'

const normalizeCurrencyCode = (value) => String(value || '').trim().toUpperCase()

export const resolveInheritedCurrency = ({ ownerDoctor, fallbackCountry } = {}) => {
  const ownerCurrency = normalizeCurrencyCode(ownerDoctor?.currency)
  if (ownerCurrency) {
    return ownerCurrency
  }

  const ownerCountry = ownerDoctor?.country
  const ownerResolved = resolveCurrencyFromCountry(ownerCountry)
  if (ownerResolved) {
    return ownerResolved
  }

  const fallbackResolved = resolveCurrencyFromCountry(fallbackCountry)
  return fallbackResolved || 'USD'
}
