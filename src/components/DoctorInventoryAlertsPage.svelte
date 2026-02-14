<script>
  import { onMount } from 'svelte'
  import firebaseStorage from '../services/firebaseStorage.js'
  import { pharmacyMedicationService } from '../services/pharmacyMedicationService.js'
  import { pharmacyInventoryIntegration } from '../services/pharmacyInventoryIntegration.js'
  import { formatDate } from '../utils/dataProcessing.js'

  export let user

  const EXPIRY_ALERT_DAYS = 30
  let effectiveDoctor = null
  let loading = true
  let refreshing = false
  let errorMessage = ''
  let ownPharmacies = []
  let lowStockItems = []
  let expiringSoonItems = []
  let expiredItems = []
  let lastUpdatedAt = null

  const toNumber = (value, fallback = 0) => {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : fallback
  }

  const calculateDaysToExpiry = (expiryDate) => {
    if (!expiryDate) return Number.POSITIVE_INFINITY
    const date = new Date(expiryDate)
    if (Number.isNaN(date.getTime())) return Number.POSITIVE_INFINITY
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    date.setHours(0, 0, 0, 0)
    return Math.ceil((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  }

  const loadEffectiveDoctor = async () => {
    if (user?.externalDoctor && user?.invitedByDoctorId) {
      effectiveDoctor = await firebaseStorage.getDoctorById(user.invitedByDoctorId)
    } else {
      effectiveDoctor = user
    }
  }

  const loadAlerts = async () => {
    refreshing = true
    errorMessage = ''
    try {
      const doctorId = effectiveDoctor?.id || user?.id || user?.email || user?.uid
      if (!doctorId) {
        throw new Error('Doctor profile is missing. Please sign in again.')
      }

      const connectedPharmacyIds = await pharmacyMedicationService.getConnectedPharmacies(doctorId)
      ownPharmacies = await pharmacyInventoryIntegration.getOwnPharmacies(doctorId, connectedPharmacyIds)

      if (!ownPharmacies.length) {
        lowStockItems = []
        expiringSoonItems = []
        expiredItems = []
        lastUpdatedAt = new Date().toISOString()
        return
      }

      const ownPharmacyIds = new Set(ownPharmacies.map((pharmacy) => pharmacy.id))
      const pharmacyNameById = new Map(ownPharmacies.map((pharmacy) => [pharmacy.id, pharmacy.name || 'Own Pharmacy']))
      const stock = await pharmacyMedicationService.getPharmacyStock(doctorId)
      const ownStock = (stock || []).filter((item) => ownPharmacyIds.has(item.pharmacyId))

      const normalizedStock = ownStock.map((item) => {
        const currentStock = toNumber(item.currentStock ?? item.quantity, 0)
        const minimumStock = Math.max(0, toNumber(item.minimumStock, 0))
        const daysToExpiry = calculateDaysToExpiry(item.expiryDate)
        return {
          ...item,
          currentStock,
          minimumStock,
          daysToExpiry,
          pharmacyName: pharmacyNameById.get(item.pharmacyId) || 'Own Pharmacy'
        }
      })

      lowStockItems = normalizedStock
        .filter((item) => item.currentStock <= item.minimumStock)
        .sort((a, b) => (a.currentStock - b.currentStock) || String(a.drugName || '').localeCompare(String(b.drugName || '')))

      expiringSoonItems = normalizedStock
        .filter((item) => item.daysToExpiry >= 0 && item.daysToExpiry <= EXPIRY_ALERT_DAYS)
        .sort((a, b) => a.daysToExpiry - b.daysToExpiry)

      expiredItems = normalizedStock
        .filter((item) => item.daysToExpiry < 0)
        .sort((a, b) => a.daysToExpiry - b.daysToExpiry)

      lastUpdatedAt = new Date().toISOString()
    } catch (error) {
      console.error('❌ DoctorInventoryAlertsPage: Failed to load alerts:', error)
      errorMessage = error?.message || 'Failed to load stock alerts.'
    } finally {
      loading = false
      refreshing = false
    }
  }

  const refreshAlerts = async () => {
    const doctorId = effectiveDoctor?.id || user?.id || user?.email || user?.uid
    if (doctorId) {
      pharmacyMedicationService.clearCache(doctorId)
      pharmacyInventoryIntegration.clearCache(doctorId)
    }
    await loadAlerts()
  }

  const escapeHtml = (value) => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

  const createRowsHtml = (items, type) => {
    if (!items.length) {
      return '<tr><td colspan="4">No items found.</td></tr>'
    }

    if (type === 'low-stock') {
      return items.map((item) => `
        <tr>
          <td>${escapeHtml(item.drugName || item.genericName || 'Unknown')}</td>
          <td>${escapeHtml(item.pharmacyName || 'Own Pharmacy')}</td>
          <td>${escapeHtml(item.currentStock)}</td>
          <td>${escapeHtml(item.minimumStock)}</td>
        </tr>
      `).join('')
    }

    if (type === 'expiring') {
      return items.map((item) => `
        <tr>
          <td>${escapeHtml(item.drugName || item.genericName || 'Unknown')}</td>
          <td>${escapeHtml(item.pharmacyName || 'Own Pharmacy')}</td>
          <td>${escapeHtml(item.expiryDate ? formatDate(item.expiryDate) : 'N/A')}</td>
          <td>${escapeHtml(item.daysToExpiry)}</td>
        </tr>
      `).join('')
    }

    return items.map((item) => `
      <tr>
        <td>${escapeHtml(item.drugName || item.genericName || 'Unknown')}</td>
        <td>${escapeHtml(item.pharmacyName || 'Own Pharmacy')}</td>
        <td>${escapeHtml(item.expiryDate ? formatDate(item.expiryDate) : 'N/A')}</td>
      </tr>
    `).join('')
  }

  const printReport = () => {
    if (typeof window === 'undefined') return

    const nowLabel = formatDate(new Date(), { includeTime: true })
    const doctorLabel = effectiveDoctor?.name || effectiveDoctor?.email || 'Doctor'
    const printWindow = window.open('', '_blank', 'noopener,noreferrer,width=1024,height=768')
    if (!printWindow) return

    const expiredSection = expiredItems.length ? `
      <h2>Expired Items</h2>
      <table>
        <thead>
          <tr>
            <th>Drug</th>
            <th>Pharmacy</th>
            <th>Expiry Date</th>
          </tr>
        </thead>
        <tbody>
          ${createRowsHtml(expiredItems, 'expired')}
        </tbody>
      </table>
    ` : ''

    const html = `
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Pharmacy Stock Alerts</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 24px; color: #111827; }
            h1 { margin: 0 0 8px; font-size: 22px; }
            h2 { margin: 24px 0 10px; font-size: 16px; }
            p.meta { margin: 2px 0; font-size: 12px; color: #374151; }
            .summary { margin-top: 16px; display: flex; gap: 12px; }
            .card { border: 1px solid #d1d5db; border-radius: 8px; padding: 10px 12px; min-width: 180px; }
            .card-label { font-size: 12px; color: #6b7280; }
            .card-value { font-size: 20px; font-weight: 700; margin-top: 4px; color: #0f766e; }
            table { width: 100%; border-collapse: collapse; margin-top: 8px; }
            th, td { border: 1px solid #d1d5db; padding: 8px; font-size: 12px; text-align: left; }
            th { background: #f3f4f6; }
            @media print { body { margin: 14mm; } }
          </style>
        </head>
        <body>
          <h1>Pharmacy Stock Alerts Report</h1>
          <p class="meta">Doctor: ${escapeHtml(doctorLabel)}</p>
          <p class="meta">Generated: ${escapeHtml(nowLabel)}</p>
          <p class="meta">Connected own pharmacies: ${escapeHtml(ownPharmacies.length)}</p>
          <div class="summary">
            <div class="card"><div class="card-label">Low Stock</div><div class="card-value">${escapeHtml(lowStockItems.length)}</div></div>
            <div class="card"><div class="card-label">Expiring In ${escapeHtml(EXPIRY_ALERT_DAYS)} Days</div><div class="card-value">${escapeHtml(expiringSoonItems.length)}</div></div>
            <div class="card"><div class="card-label">Expired</div><div class="card-value">${escapeHtml(expiredItems.length)}</div></div>
          </div>

          <h2>Low Stock Items</h2>
          <table>
            <thead>
              <tr>
                <th>Drug</th>
                <th>Pharmacy</th>
                <th>Current</th>
                <th>Minimum</th>
              </tr>
            </thead>
            <tbody>
              ${createRowsHtml(lowStockItems, 'low-stock')}
            </tbody>
          </table>

          <h2>Expiring Soon</h2>
          <table>
            <thead>
              <tr>
                <th>Drug</th>
                <th>Pharmacy</th>
                <th>Expiry Date</th>
                <th>Days Left</th>
              </tr>
            </thead>
            <tbody>
              ${createRowsHtml(expiringSoonItems, 'expiring')}
            </tbody>
          </table>

          ${expiredSection}
        </body>
      </html>
    `

    printWindow.document.open()
    printWindow.document.write(html)
    printWindow.document.close()
    printWindow.focus()
    printWindow.print()
  }

  onMount(async () => {
    await loadEffectiveDoctor()
    await loadAlerts()
  })
</script>

<div class="space-y-4">
  <div class="flex items-center justify-between">
    <div>
      <h2 class="text-lg font-semibold text-gray-900">
        <i class="fas fa-bell mr-2 text-cyan-600"></i>
        Pharmacy Stock Alerts
      </h2>
      <p class="text-xs text-gray-500">Low stock and expiry notifications for connected own pharmacy inventory.</p>
    </div>
    <div class="flex items-center gap-2">
      <button
        type="button"
        class="inline-flex items-center px-3 py-1.5 text-xs font-medium text-cyan-700 bg-cyan-50 border border-cyan-200 rounded-lg hover:bg-cyan-100 focus:ring-2 focus:ring-cyan-200"
        on:click={refreshAlerts}
        disabled={refreshing}
      >
        <i class="fas fa-rotate mr-2"></i>
        {refreshing ? 'Refreshing...' : 'Refresh'}
      </button>
      <button
        type="button"
        class="inline-flex items-center px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 focus:ring-2 focus:ring-gray-200"
        on:click={printReport}
      >
        <i class="fas fa-print mr-2"></i>
        Print Report
      </button>
    </div>
  </div>

  {#if loading}
    <div class="bg-white rounded-lg border border-gray-200 p-4 text-sm text-gray-500">
      Loading stock alerts...
    </div>
  {:else if errorMessage}
    <div class="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 text-sm">
      {errorMessage}
    </div>
  {:else if ownPharmacies.length === 0}
    <div class="bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-lg p-4 text-sm">
      No own pharmacy is connected. Connect your own pharmacy to see low stock and expiry alerts.
    </div>
  {:else}
    <div class="grid gap-3 sm:grid-cols-3">
      <div class="bg-white rounded-lg border border-gray-200 p-4">
        <p class="text-xs text-gray-500">Low Stock</p>
        <p class="text-2xl font-semibold text-amber-600">{lowStockItems.length}</p>
      </div>
      <div class="bg-white rounded-lg border border-gray-200 p-4">
        <p class="text-xs text-gray-500">Expiring In {EXPIRY_ALERT_DAYS} Days</p>
        <p class="text-2xl font-semibold text-orange-600">{expiringSoonItems.length}</p>
      </div>
      <div class="bg-white rounded-lg border border-gray-200 p-4">
        <p class="text-xs text-gray-500">Expired</p>
        <p class="text-2xl font-semibold text-rose-600">{expiredItems.length}</p>
      </div>
    </div>

    <div class="bg-white rounded-lg border border-gray-200 p-4">
      <h3 class="text-sm font-semibold text-gray-700 mb-3">Low Stock Items</h3>
      {#if lowStockItems.length === 0}
        <p class="text-sm text-gray-500">No low stock items.</p>
      {:else}
        <div class="overflow-x-auto">
          <table class="w-full text-sm text-left text-gray-500">
            <thead class="text-xs text-gray-600 uppercase bg-gray-50">
              <tr>
                <th class="px-3 py-2">Drug</th>
                <th class="px-3 py-2">Pharmacy</th>
                <th class="px-3 py-2">Current</th>
                <th class="px-3 py-2">Minimum</th>
              </tr>
            </thead>
            <tbody>
              {#each lowStockItems as item}
                <tr class="border-b border-gray-100">
                  <td class="px-3 py-2 text-gray-700">{item.drugName || item.genericName || 'Unknown'}</td>
                  <td class="px-3 py-2">{item.pharmacyName}</td>
                  <td class="px-3 py-2 font-semibold text-amber-700">{item.currentStock}</td>
                  <td class="px-3 py-2">{item.minimumStock}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
    </div>

    <div class="bg-white rounded-lg border border-gray-200 p-4">
      <h3 class="text-sm font-semibold text-gray-700 mb-3">Expiring Soon</h3>
      {#if expiringSoonItems.length === 0}
        <p class="text-sm text-gray-500">No items expiring within {EXPIRY_ALERT_DAYS} days.</p>
      {:else}
        <div class="overflow-x-auto">
          <table class="w-full text-sm text-left text-gray-500">
            <thead class="text-xs text-gray-600 uppercase bg-gray-50">
              <tr>
                <th class="px-3 py-2">Drug</th>
                <th class="px-3 py-2">Pharmacy</th>
                <th class="px-3 py-2">Expiry Date</th>
                <th class="px-3 py-2">Days Left</th>
              </tr>
            </thead>
            <tbody>
              {#each expiringSoonItems as item}
                <tr class="border-b border-gray-100">
                  <td class="px-3 py-2 text-gray-700">{item.drugName || item.genericName || 'Unknown'}</td>
                  <td class="px-3 py-2">{item.pharmacyName}</td>
                  <td class="px-3 py-2">{item.expiryDate ? formatDate(item.expiryDate) : 'N/A'}</td>
                  <td class="px-3 py-2 font-semibold text-orange-700">{item.daysToExpiry}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
    </div>

    {#if expiredItems.length > 0}
      <div class="bg-white rounded-lg border border-gray-200 p-4">
        <h3 class="text-sm font-semibold text-gray-700 mb-3">Expired Items</h3>
        <div class="overflow-x-auto">
          <table class="w-full text-sm text-left text-gray-500">
            <thead class="text-xs text-gray-600 uppercase bg-gray-50">
              <tr>
                <th class="px-3 py-2">Drug</th>
                <th class="px-3 py-2">Pharmacy</th>
                <th class="px-3 py-2">Expiry Date</th>
              </tr>
            </thead>
            <tbody>
              {#each expiredItems as item}
                <tr class="border-b border-gray-100">
                  <td class="px-3 py-2 text-gray-700">{item.drugName || item.genericName || 'Unknown'}</td>
                  <td class="px-3 py-2">{item.pharmacyName}</td>
                  <td class="px-3 py-2 text-rose-700 font-semibold">{item.expiryDate ? formatDate(item.expiryDate) : 'N/A'}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </div>
    {/if}

    <div class="text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-lg p-3">
      <i class="fas fa-clock mr-1 text-cyan-600"></i>
      Last updated: {lastUpdatedAt ? formatDate(lastUpdatedAt, { includeTime: true }) : 'N/A'}
    </div>
  {/if}
</div>
