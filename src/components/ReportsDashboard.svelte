<script>
  import { onMount } from 'svelte'
  import firebaseStorage from '../services/firebaseStorage.js'
  import { pharmacyMedicationService } from '../services/pharmacyMedicationService.js'
  import chargeCalculationService from '../services/pharmacist/chargeCalculationService.js'

  export let user
  
  let effectiveDoctor = null
  
  let loading = true
  let errorMessage = ''
  let missingPriceCount = 0
  let missingQuantityCount = 0
  let isRefreshing = false

  let report = {
    today: { doctor: 0, pharmacy: 0, total: 0 },
    month: { doctor: 0, pharmacy: 0, total: 0 },
    daily: [],
    monthly: []
  }

  const loadEffectiveDoctor = async () => {
    if (user?.externalDoctor && user?.invitedByDoctorId) {
      effectiveDoctor = await firebaseStorage.getDoctorById(user.invitedByDoctorId)
    } else {
      effectiveDoctor = user
    }
  }

  $: if (user) {
    loadEffectiveDoctor()
  }

  $: currency = effectiveDoctor?.currency || user?.currency || 'USD'

  const formatCurrency = (amount) => {
    const safeAmount = Number.isFinite(amount) ? amount : 0
    try {
      return new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: currency || 'USD',
        maximumFractionDigits: 2
      }).format(safeAmount)
    } catch (error) {
      return safeAmount.toFixed(2)
    }
  }

  const toDateKey = (dateValue) => {
    const date = new Date(dateValue)
    if (Number.isNaN(date.getTime())) {
      return null
    }
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  const toMonthKey = (dateValue) => {
    const date = new Date(dateValue)
    if (Number.isNaN(date.getTime())) {
      return null
    }
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    return `${year}-${month}`
  }

  const buildDailyBuckets = (days = 7) => {
    const buckets = []
    const now = new Date()
    for (let i = days - 1; i >= 0; i -= 1) {
      const date = new Date(now)
      date.setDate(now.getDate() - i)
      const key = toDateKey(date)
      buckets.push({ key, label: key, doctor: 0, pharmacy: 0, total: 0 })
    }
    return buckets
  }

  const buildMonthlyBuckets = (months = 6) => {
    const buckets = []
    const now = new Date()
    for (let i = months - 1; i >= 0; i -= 1) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const key = toMonthKey(date)
      buckets.push({ key, label: key, doctor: 0, pharmacy: 0, total: 0 })
    }
    return buckets
  }

  const getPrescriptionDate = (prescription) => {
    return prescription?.createdAt || prescription?.dateCreated || prescription?.sentAt || null
  }

  const loadReport = async () => {
    loading = !report?.daily?.length
    isRefreshing = true
    errorMessage = ''
    missingPriceCount = 0
    missingQuantityCount = 0

    try {
      const doctorId = effectiveDoctor?.id || user?.id || user?.uid
      if (!doctorId) {
        throw new Error('Doctor ID is missing. Please sign in again.')
      }

      const prescriptions = await firebaseStorage.getPrescriptionsByDoctorId(doctorId)
      const pharmacyStock = await pharmacyMedicationService.getPharmacyStock(doctorId)

      const dailyBuckets = buildDailyBuckets()
      const monthlyBuckets = buildMonthlyBuckets()
      const dailyIndex = new Map(dailyBuckets.map((bucket) => [bucket.key, bucket]))
      const monthlyIndex = new Map(monthlyBuckets.map((bucket) => [bucket.key, bucket]))

      const todayKey = toDateKey(new Date())
      const monthKey = toMonthKey(new Date())

      let todayDoctor = 0
      let todayPharmacy = 0
      let monthDoctor = 0
      let monthPharmacy = 0

      prescriptions.forEach((prescription) => {
        const dateKey = toDateKey(getPrescriptionDate(prescription))
        const monthBucketKey = toMonthKey(getPrescriptionDate(prescription))

        const expectedCharge = chargeCalculationService.calculateExpectedChargeFromStock(
          prescription,
          effectiveDoctor,
          pharmacyStock,
          {
            roundingPreference: effectiveDoctor?.roundingPreference || 'none',
            currency,
            ignoreAvailability: false,
            assumeDispensedForAvailable: true
          }
        )

        const doctorCharge = expectedCharge.doctorCharges.totalAfterDiscount || 0
        const pharmacyIncome = expectedCharge.drugCharges.totalCost || 0
        missingPriceCount += expectedCharge.drugCharges.missingPriceCount || 0
        missingQuantityCount += expectedCharge.drugCharges.missingQuantityCount || 0

        if (dateKey) {
          if (dateKey === todayKey) {
            todayPharmacy += pharmacyIncome
            todayDoctor += doctorCharge
          }
          const bucket = dailyIndex.get(dateKey)
          if (bucket) {
            bucket.pharmacy += pharmacyIncome
            bucket.doctor += doctorCharge
          }
        }

        if (monthBucketKey) {
          if (monthBucketKey === monthKey) {
            monthPharmacy += pharmacyIncome
            monthDoctor += doctorCharge
          }
          const bucket = monthlyIndex.get(monthBucketKey)
          if (bucket) {
            bucket.pharmacy += pharmacyIncome
            bucket.doctor += doctorCharge
          }
        }
      })

      dailyBuckets.forEach((bucket) => {
        bucket.total = bucket.doctor + bucket.pharmacy
      })
      monthlyBuckets.forEach((bucket) => {
        bucket.total = bucket.doctor + bucket.pharmacy
      })

      report = {
        today: {
          doctor: todayDoctor,
          pharmacy: todayPharmacy,
          total: todayDoctor + todayPharmacy
        },
        month: {
          doctor: monthDoctor,
          pharmacy: monthPharmacy,
          total: monthDoctor + monthPharmacy
        },
        daily: dailyBuckets,
        monthly: monthlyBuckets
      }

      await firebaseStorage.saveDoctorReport(doctorId, {
        report,
        doctorId: doctorId
      })
    } catch (error) {
      console.error('❌ ReportsDashboard: Error loading reports:', error)
      errorMessage = error.message || 'Failed to load reports.'
    } finally {
      loading = false
      isRefreshing = false
    }
  }

  const loadCachedReport = async () => {
    try {
      const doctorId = effectiveDoctor?.id || user?.id || user?.uid
      if (!doctorId) return
      const cached = await firebaseStorage.getDoctorReport(doctorId)
      if (cached?.report) {
        report = cached.report
        loading = false
      }
    } catch (error) {
      console.warn('ReportsDashboard: Failed to load cached report:', error)
    }
  }

  const downloadFile = (content, filename, type) => {
    const blob = new Blob([content], { type })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const exportDailyCsv = () => {
    const rows = [
      ['Date', 'Doctor Income', 'Pharmacy Income', 'Total Income'],
      ...report.daily.map((item) => [
        item.label,
        item.doctor.toFixed(2),
        item.pharmacy.toFixed(2),
        item.total.toFixed(2)
      ])
    ]
    const csv = rows.map((row) => row.join(',')).join('\n')
    downloadFile(csv, 'reports-daily.csv', 'text/csv')
  }

  const exportMonthlyCsv = () => {
    const rows = [
      ['Month', 'Doctor Income', 'Pharmacy Income', 'Total Income'],
      ...report.monthly.map((item) => [
        item.label,
        item.doctor.toFixed(2),
        item.pharmacy.toFixed(2),
        item.total.toFixed(2)
      ])
    ]
    const csv = rows.map((row) => row.join(',')).join('\n')
    downloadFile(csv, 'reports-monthly.csv', 'text/csv')
  }

  const exportPdf = async () => {
    const module = await import('jspdf')
    const doc = new module.jsPDF()
    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()
    const margin = 14
    const contentWidth = pageWidth - margin * 2
    const headerHeight = 26
    const rowHeight = 7
    const cardGap = 6
    const cardHeight = 26
    const cardWidth = (contentWidth - cardGap) / 2
    let y = headerHeight + 12

    const setTextColor = (r, g, b) => doc.setTextColor(r, g, b)
    const ensureSpace = (height) => {
      if (y + height > pageHeight - margin) {
        doc.addPage()
        y = margin
      }
    }

    doc.setFillColor(13, 116, 106)
    doc.rect(0, 0, pageWidth, headerHeight, 'F')
    setTextColor(255, 255, 255)
    doc.setFontSize(16)
    doc.text('Income Reports', margin, 16)
    doc.setFontSize(9)
    doc.text('Doctor and pharmacy income overview', margin, 22)

    setTextColor(55, 65, 81)
    doc.setFontSize(9)
    const doctorLabel = `Doctor: ${user?.name || user?.email || 'Doctor'}`
    doc.text(doctorLabel, margin, y)
    const generatedLabel = `Generated: ${new Date().toLocaleString()}`
    doc.text(generatedLabel, pageWidth - margin, y, { align: 'right' })
    y += 10

    const drawSectionTitle = (title) => {
      ensureSpace(10)
      setTextColor(15, 23, 42)
      doc.setFontSize(11)
      doc.text(title, margin, y)
      doc.setDrawColor(226, 232, 240)
      doc.line(margin, y + 2, pageWidth - margin, y + 2)
      y += 8
    }

    const drawSummaryCard = (title, summary, x, yPos) => {
      doc.setDrawColor(221, 230, 228)
      doc.setFillColor(245, 250, 249)
      doc.roundedRect(x, yPos, cardWidth, cardHeight, 3, 3, 'FD')
      setTextColor(13, 116, 106)
      doc.setFontSize(10)
      doc.text(title, x + 6, yPos + 7)
      setTextColor(75, 85, 99)
      doc.setFontSize(9)
      doc.text(`Doctor: ${formatCurrency(summary.doctor)}`, x + 6, yPos + 14)
      doc.text(`Pharmacy: ${formatCurrency(summary.pharmacy)}`, x + 6, yPos + 19)
      setTextColor(13, 116, 106)
      doc.setFontSize(11)
      doc.text(formatCurrency(summary.total), x + cardWidth - 6, yPos + 19, { align: 'right' })
    }

    drawSectionTitle('Summary')
    ensureSpace(cardHeight + 4)
    drawSummaryCard('Today', report.today, margin, y)
    drawSummaryCard('This Month', report.month, margin + cardWidth + cardGap, y)
    y += cardHeight + 10

    const drawTableHeader = (columns) => {
      doc.setFillColor(15, 118, 110)
      doc.rect(margin, y, contentWidth, rowHeight, 'F')
      setTextColor(255, 255, 255)
      doc.setFontSize(9)
      let x = margin + 2
      columns.forEach((column) => {
        doc.text(column.label, x, y + 5)
        x += column.width
      })
      y += rowHeight
    }

    const drawTableRow = (columns, row, index) => {
      if (y + rowHeight > pageHeight - margin) {
        doc.addPage()
        y = margin
        drawTableHeader(columns)
      }
      const fill = index % 2 === 0
      if (fill) {
        doc.setFillColor(248, 250, 252)
        doc.rect(margin, y, contentWidth, rowHeight, 'F')
      }
      setTextColor(51, 65, 85)
      doc.setFontSize(9)
      let x = margin + 2
      columns.forEach((column, columnIndex) => {
        const value = String(row[columnIndex] ?? '')
        doc.text(value, x, y + 5)
        x += column.width
      })
      y += rowHeight
    }

    const addTable = (title, rows, isMonthly = false) => {
      const labelWidth = Math.floor(contentWidth * 0.33)
      const valueWidth = Math.floor(contentWidth * 0.22)
      const totalWidth = contentWidth - labelWidth - valueWidth * 2
      const columns = [
        { label: isMonthly ? 'Month' : 'Date', width: labelWidth },
        { label: 'Doctor', width: valueWidth },
        { label: 'Pharmacy', width: valueWidth },
        { label: 'Total', width: totalWidth }
      ]
      drawSectionTitle(title)
      ensureSpace(rowHeight * 2)
      drawTableHeader(columns)
      rows.forEach((row, index) => {
        drawTableRow(columns, row, index)
      })
      y += 6
    }

    addTable(
      'Last 7 Days',
      report.daily.map((item) => [
        item.label,
        formatCurrency(item.doctor),
        formatCurrency(item.pharmacy),
        formatCurrency(item.total)
      ])
    )

    addTable(
      'Last 6 Months',
      report.monthly.map((item) => [
        item.label,
        formatCurrency(item.doctor),
        formatCurrency(item.pharmacy),
        formatCurrency(item.total)
      ]),
      true
    )

    const pageCount = doc.internal.getNumberOfPages()
    for (let pageIndex = 1; pageIndex <= pageCount; pageIndex += 1) {
      doc.setPage(pageIndex)
      setTextColor(148, 163, 184)
      doc.setFontSize(8)
      doc.text('Confidential', margin, pageHeight - 8)
      doc.text(`Page ${pageIndex} of ${pageCount}`, pageWidth - margin, pageHeight - 8, { align: 'right' })
    }

    doc.save('reports-income.pdf')
  }

  onMount(async () => {
    await loadEffectiveDoctor()
    await loadCachedReport()
    await loadReport()
  })
</script>

<div class="space-y-4">
  <div class="flex items-center justify-between">
    <div>
      <h2 class="text-lg font-semibold text-gray-900">
        <i class="fas fa-chart-line mr-2 text-teal-600"></i>
        Income Reports
      </h2>
      <p class="text-xs text-gray-500">Daily and monthly income from consultations, hospital charges, and pharmacy sales.</p>
    </div>
    <div class="flex flex-wrap items-center gap-2">
      <button
        type="button"
        class="inline-flex items-center px-3 py-1.5 text-xs font-medium text-teal-700 bg-teal-50 border border-teal-200 rounded-lg hover:bg-teal-100 focus:ring-2 focus:ring-teal-200"
        on:click={loadReport}
      >
        <i class="fas fa-rotate mr-2"></i>
        {isRefreshing ? 'Refreshing...' : 'Refresh'}
      </button>
      <button
        type="button"
        class="inline-flex items-center px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 focus:ring-2 focus:ring-gray-200"
        on:click={exportDailyCsv}
      >
        <i class="fas fa-file-csv mr-2"></i>
        Export Daily CSV
      </button>
      <button
        type="button"
        class="inline-flex items-center px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 focus:ring-2 focus:ring-gray-200"
        on:click={exportMonthlyCsv}
      >
        <i class="fas fa-file-csv mr-2"></i>
        Export Monthly CSV
      </button>
      <button
        type="button"
        class="inline-flex items-center px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 focus:ring-2 focus:ring-gray-200"
        on:click={exportPdf}
      >
        <i class="fas fa-file-pdf mr-2"></i>
        Export PDF
      </button>
    </div>
  </div>

  {#if loading}
    <div class="bg-white rounded-lg border border-gray-200 p-4 text-sm text-gray-500">
      Loading reports...
    </div>
  {:else if errorMessage}
    <div class="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 text-sm">
      {errorMessage}
    </div>
  {:else}
    <div class="grid gap-3 sm:grid-cols-2">
      <div class="bg-white rounded-lg border border-gray-200 p-4">
        <h3 class="text-sm font-semibold text-gray-700 mb-2">Today</h3>
        <div class="space-y-2 text-sm">
          <div class="flex items-center justify-between">
            <span class="text-gray-500">Consultation + Hospital</span>
            <span class="font-semibold text-gray-900">{formatCurrency(report.today.doctor)}</span>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-gray-500">Pharmacy</span>
            <span class="font-semibold text-gray-900">{formatCurrency(report.today.pharmacy)}</span>
          </div>
          <div class="flex items-center justify-between border-t border-gray-100 pt-2">
            <span class="text-gray-700 font-semibold">Total</span>
            <span class="font-semibold text-teal-600">{formatCurrency(report.today.total)}</span>
          </div>
        </div>
      </div>
      <div class="bg-white rounded-lg border border-gray-200 p-4">
        <h3 class="text-sm font-semibold text-gray-700 mb-2">This Month</h3>
        <div class="space-y-2 text-sm">
          <div class="flex items-center justify-between">
            <span class="text-gray-500">Consultation + Hospital</span>
            <span class="font-semibold text-gray-900">{formatCurrency(report.month.doctor)}</span>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-gray-500">Pharmacy</span>
            <span class="font-semibold text-gray-900">{formatCurrency(report.month.pharmacy)}</span>
          </div>
          <div class="flex items-center justify-between border-t border-gray-100 pt-2">
            <span class="text-gray-700 font-semibold">Total</span>
            <span class="font-semibold text-teal-600">{formatCurrency(report.month.total)}</span>
          </div>
        </div>
      </div>
    </div>

    <div class="grid gap-4 lg:grid-cols-2">
      <div class="bg-white rounded-lg border border-gray-200 p-4">
        <h3 class="text-sm font-semibold text-gray-700 mb-3">Last 7 Days</h3>
        <div class="overflow-x-auto">
          <table class="w-full text-sm text-left text-gray-500">
            <thead class="text-xs text-gray-600 uppercase bg-gray-50">
              <tr>
                <th scope="col" class="px-3 py-2">Date</th>
                <th scope="col" class="px-3 py-2">Doctor</th>
                <th scope="col" class="px-3 py-2">Pharmacy</th>
                <th scope="col" class="px-3 py-2">Total</th>
              </tr>
            </thead>
            <tbody>
              {#each report.daily as item}
                <tr class="border-b border-gray-100">
                  <td class="px-3 py-2 text-gray-700">{item.label}</td>
                  <td class="px-3 py-2">{formatCurrency(item.doctor)}</td>
                  <td class="px-3 py-2">{formatCurrency(item.pharmacy)}</td>
                  <td class="px-3 py-2 font-semibold text-gray-900">{formatCurrency(item.total)}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </div>

      <div class="bg-white rounded-lg border border-gray-200 p-4">
        <h3 class="text-sm font-semibold text-gray-700 mb-3">Last 6 Months</h3>
        <div class="overflow-x-auto">
          <table class="w-full text-sm text-left text-gray-500">
            <thead class="text-xs text-gray-600 uppercase bg-gray-50">
              <tr>
                <th scope="col" class="px-3 py-2">Month</th>
                <th scope="col" class="px-3 py-2">Doctor</th>
                <th scope="col" class="px-3 py-2">Pharmacy</th>
                <th scope="col" class="px-3 py-2">Total</th>
              </tr>
            </thead>
            <tbody>
              {#each report.monthly as item}
                <tr class="border-b border-gray-100">
                  <td class="px-3 py-2 text-gray-700">{item.label}</td>
                  <td class="px-3 py-2">{formatCurrency(item.doctor)}</td>
                  <td class="px-3 py-2">{formatCurrency(item.pharmacy)}</td>
                  <td class="px-3 py-2 font-semibold text-gray-900">{formatCurrency(item.total)}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <div class="text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-lg p-3">
      <i class="fas fa-circle-info mr-1 text-teal-600"></i>
      Pharmacy income is estimated from connected pharmacy stock pricing and assumes all pharmacy-available drugs are selected.
      Missing pricing: {missingPriceCount}, missing quantities: {missingQuantityCount}.
    </div>
  {/if}
</div>
