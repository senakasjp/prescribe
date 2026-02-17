const localeByCountry = {
  'United States': 'en-US',
  'USA': 'en-US',
  'United Kingdom': 'en-GB',
  'UK': 'en-GB',
  'Sri Lanka': 'en-LK',
  'India': 'en-IN',
  'Australia': 'en-AU',
  'Canada': 'en-CA',
  'New Zealand': 'en-NZ',
  'Singapore': 'en-SG',
  'Ireland': 'en-IE',
  'South Africa': 'en-ZA'
}

export const resolveLocaleFromCountry = (country) => {
  const name = String(country || '').trim()
  if (!name) return 'en-GB'
  return localeByCountry[name] || 'en-GB'
}

export const getLocaleByCountry = () => ({ ...localeByCountry })
