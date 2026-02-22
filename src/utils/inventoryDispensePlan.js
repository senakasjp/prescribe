const parseQuantityValue = (value) => {
  if (value === null || value === undefined) return NaN
  const raw = String(value).trim()
  if (!raw) return NaN
  const parts = raw.split(/\s+/)
  let total = 0
  for (const part of parts) {
    if (!part) continue
    if (part.includes('/')) {
      const [num, den] = part.split('/')
      const numerator = parseFloat(num)
      const denominator = parseFloat(den)
      if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) {
        return NaN
      }
      total += numerator / denominator
      continue
    }
    const parsed = parseFloat(part)
    if (!Number.isFinite(parsed)) return NaN
    total += parsed
  }
  return total
}

const resolveDispenseQuantity = (value) => {
  const parsed = parseQuantityValue(value)
  if (!Number.isFinite(parsed) || parsed <= 0) return 1
  return parsed
}

const buildInventoryDispensePlan = ({ inventoryData, allocationPreview, fallbackQuantity }) => {
  const matches = inventoryData?.matches || []
  const orderedMatches = allocationPreview?.orderedMatches || []

  if (matches.length === 0 && !inventoryData?.inventoryItemId) {
    return []
  }

  if (orderedMatches.length > 0) {
    return orderedMatches
      .filter(match => Number(match.allocated) > 0 && match.inventoryItemId)
      .map(match => ({
        inventoryItemId: match.inventoryItemId,
        batchId: match.batchId || null,
        quantity: Number(match.allocated)
      }))
  }

  if (inventoryData?.inventoryItemId) {
    return [{
      inventoryItemId: inventoryData.inventoryItemId,
      quantity: resolveDispenseQuantity(fallbackQuantity)
    }]
  }

  return []
}

export { buildInventoryDispensePlan, resolveDispenseQuantity }
