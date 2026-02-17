export const UNREADABLE_TEXT_INDICATORS = [
  'unreadable',
  'not clear',
  'unclear',
  'insufficient',
  'cannot interpret',
  'non-diagnostic',
  'poor quality',
  'blurry',
  'unable to read'
]

export const isUnreadableText = (text) => {
  const normalized = String(text || '').trim().toLowerCase()
  if (!normalized) {
    return false
  }
  return UNREADABLE_TEXT_INDICATORS.some((indicator) => normalized.includes(indicator))
}
