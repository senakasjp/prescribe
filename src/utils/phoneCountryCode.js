import { phoneCountryCodes } from '../data/phoneCountryCodes.js'

export const getDialCodeForCountry = (countryName) => {
  const normalized = String(countryName || '').trim().toLowerCase()
  if (!normalized) return ''
  const match = phoneCountryCodes.find(entry => entry.name.toLowerCase() === normalized)
  return match?.dialCode || ''
}
