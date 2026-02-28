<script>
  import { createEventDispatcher } from 'svelte'
  import openaiService from '../services/openaiService.js'
  import firebaseStorage from '../services/firebaseStorage.js'
  
  const dispatch = createEventDispatcher()
  
  export let selectedPatient
  export let illnesses = []
  export let prescriptions = []
  export let symptoms = []
  export let reports = []
  export let activeMedicalTab = 'prescriptions'
  export let showSymptomsNotes = false
  export let showIllnessesNotes = false
  export let showPrescriptionsNotes = false
  export let addToPrescription
  export let hasNotes
  export let toggleSymptomsNotes
  export let toggleIllnessesNotes
  export let togglePrescriptionsNotes
  export let groupByDate
  export let doctorId = null

  let aiSummary = ''
  let isLoadingSummary = false
  let summaryError = ''
  let summaryCacheKey = ''
  let lastSummarySignature = ''
  let storedSummary = ''
  let storedSummarySignature = ''
  let isLoadingStoredSummary = false
  let summaryLoadRequestId = 0
  let savedReports = []
  let lastLoadedPatientId = ''

  const CACHE_TTL_MS = 6 * 60 * 60 * 1000

  const getLatestTimestamp = (items = []) => {
    if (!items || items.length === 0) return 0
    return items.reduce((latest, item) => {
      const candidate = item?.updatedAt || item?.createdAt || item?.date || item?.lastUpdated
      const timestamp = candidate ? new Date(candidate).getTime() : 0
      return timestamp > latest ? timestamp : latest
    }, 0)
  }

  const hashString = (value) => {
    let hash = 5381
    for (let i = 0; i < value.length; i += 1) {
      hash = ((hash << 5) + hash) + value.charCodeAt(i)
      hash &= 0xffffffff
    }
    return Math.abs(hash).toString(36)
  }

  const toComparableString = (value) => {
    if (value === null || value === undefined) return ''
    if (typeof value === 'string') return value.trim()
    if (typeof value === 'number' || typeof value === 'boolean') return String(value)
    if (Array.isArray(value)) {
      return value.map((entry) => toComparableString(entry)).join('|')
    }
    if (typeof value === 'object') {
      const entries = Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, val]) => `${key}:${toComparableString(val)}`)
      return entries.join(';')
    }
    return String(value)
  }

  const buildCollectionSignature = (items = [], extractor) => {
    if (!Array.isArray(items) || items.length === 0) return ''
    const normalized = items
      .map((item) => extractor(item))
      .sort()
      .join('||')
    return hashString(normalized)
  }

  const getSummaryPrescriptions = () => {
    if (!Array.isArray(prescriptions)) return []
    return prescriptions
      .filter((prescription) => {
        if (!Array.isArray(prescription?.medications) || prescription.medications.length === 0) return false
        const status = String(prescription?.status || '').toLowerCase()
        if (['deleted', 'cancelled', 'canceled', 'void'].includes(status)) return false
        if (prescription?.deleted === true || prescription?.isDeleted === true) return false
        return true
      })
      .sort((a, b) => {
        const aTime = new Date(a?.updatedAt || a?.createdAt || 0).getTime()
        const bTime = new Date(b?.updatedAt || b?.createdAt || 0).getTime()
        return bTime - aTime
      })
  }

  const buildMedicationsSignature = () => {
    const summaryPrescriptions = getSummaryPrescriptions()
    if (summaryPrescriptions.length === 0) return ''
    const parts = summaryPrescriptions.flatMap(prescription => (
      (prescription?.medications || []).map(medication => (
        `${medication?.id || medication?.name || ''}:${medication?.updatedAt || medication?.createdAt || ''}:${medication?.duration || ''}:${medication?.frequency || ''}`
      ))
    ))
    return hashString(parts.join('|'))
  }

  const buildSummarySignature = () => {
    const summaryPrescriptions = getSummaryPrescriptions()
    const patientContentSignature = hashString(toComparableString({
      id: selectedPatient?.id || '',
      firstName: selectedPatient?.firstName || '',
      lastName: selectedPatient?.lastName || '',
      age: selectedPatient?.age || '',
      gender: selectedPatient?.gender || '',
      dateOfBirth: selectedPatient?.dateOfBirth || '',
      allergies: selectedPatient?.allergies || '',
      longTermMedications: selectedPatient?.longTermMedications || '',
      medicalHistory: selectedPatient?.medicalHistory || ''
    }))
    const symptomsSignature = buildCollectionSignature(symptoms, (symptom) => toComparableString({
      id: symptom?.id || '',
      symptom: symptom?.symptom || symptom?.name || '',
      notes: symptom?.notes || symptom?.description || '',
      severity: symptom?.severity || '',
      date: symptom?.date || '',
      updatedAt: symptom?.updatedAt || symptom?.createdAt || ''
    }))
    const illnessesSignature = buildCollectionSignature(illnesses, (illness) => toComparableString({
      id: illness?.id || '',
      illness: illness?.illness || illness?.name || '',
      diagnosis: illness?.diagnosis || '',
      notes: illness?.notes || illness?.description || '',
      date: illness?.date || '',
      updatedAt: illness?.updatedAt || illness?.createdAt || ''
    }))
    const prescriptionsSignature = buildCollectionSignature(summaryPrescriptions, (prescription) => toComparableString({
      id: prescription?.id || '',
      status: prescription?.status || '',
      date: prescription?.date || prescription?.createdAt || '',
      updatedAt: prescription?.updatedAt || prescription?.createdAt || '',
      medications: (prescription?.medications || []).map((medication) => ({
        id: medication?.id || '',
        name: medication?.name || '',
        genericName: medication?.genericName || '',
        dosageForm: medication?.dosageForm || '',
        dosage: medication?.dosage || '',
        strength: medication?.strength || '',
        strengthUnit: medication?.strengthUnit || '',
        frequency: medication?.frequency || '',
        timing: medication?.timing || '',
        duration: medication?.duration || '',
        instructions: medication?.instructions || '',
        notes: medication?.notes || '',
        updatedAt: medication?.updatedAt || medication?.createdAt || ''
      }))
    }))
    const reportsSignature = buildCollectionSignature(summaryReports, (report) => toComparableString({
      id: report?.id || '',
      title: report?.title || '',
      type: report?.type || '',
      date: report?.date || report?.createdAt || '',
      content: report?.content || report?.text || '',
      analysis: report?.analysis || '',
      updatedAt: report?.updatedAt || report?.createdAt || ''
    }))

    const base = {
      patientId: selectedPatient?.id || '',
      patientUpdatedAt: selectedPatient?.updatedAt || selectedPatient?.createdAt || '',
      patientContentSignature,
      symptomsCount,
      illnessesCount,
      prescriptionsCount,
      medicationsCount,
      reportsCount: summaryReports?.length || 0,
      medicationsSignature: buildMedicationsSignature(),
      symptomsSignature,
      illnessesSignature,
      prescriptionsSignature,
      reportsSignature,
      symptomsLatest: getLatestTimestamp(symptoms),
      illnessesLatest: getLatestTimestamp(illnesses),
      prescriptionsLatest: getLatestTimestamp(getSummaryPrescriptions()),
      reportsLatest: getLatestTimestamp(summaryReports)
    }
    return JSON.stringify(base)
  }

  const mergeReports = (primary = [], secondary = []) => {
    const map = new Map()
    const allReports = [...(Array.isArray(primary) ? primary : []), ...(Array.isArray(secondary) ? secondary : [])]
    allReports.forEach((report, index) => {
      if (!report) return
      const fallbackKey = `${report?.title || 'untitled'}|${report?.date || report?.createdAt || ''}|${report?.type || ''}|${index}`
      const key = report?.id || fallbackKey
      if (!map.has(key)) {
        map.set(key, report)
      }
    })
    return Array.from(map.values())
  }

  const stripRiskFactorsSection = (html) => {
    if (!html) return ''
    return html.replace(/<h[34][^>]*>\s*Risk Factors\s*<\/h[34]>\s*([\s\S]*?)(?=<h[34][^>]*>|$)/gi, '').trim()
  }

  const getCachedSummary = (key) => {
    try {
      const raw = localStorage.getItem(key)
      if (!raw) return null
      const parsed = JSON.parse(raw)
      if (!parsed?.summary || !parsed?.timestamp) return null
      if (Date.now() - parsed.timestamp > CACHE_TTL_MS) {
        localStorage.removeItem(key)
        return null
      }
      return parsed.summary
    } catch (error) {
      console.warn('Failed to read summary cache', error)
      return null
    }
  }

  const setCachedSummary = (key, summary) => {
    try {
      localStorage.setItem(key, JSON.stringify({
        summary,
        timestamp: Date.now()
      }))
    } catch (error) {
      console.warn('Failed to write summary cache', error)
    }
  }

  const loadStoredSummary = async () => {
    if (!selectedPatient?.id) return
    const requestId = ++summaryLoadRequestId
    isLoadingStoredSummary = true
    try {
      const persistedReportsPromise = firebaseStorage.getReportsByPatientId(selectedPatient.id)
        .catch(() => [])

      if (selectedPatient?.medicalSummary?.content) {
        storedSummary = selectedPatient.medicalSummary.content || ''
        storedSummarySignature = selectedPatient.medicalSummary.signature || ''
        const persistedReports = await persistedReportsPromise
        if (requestId === summaryLoadRequestId) {
          savedReports = Array.isArray(persistedReports) ? persistedReports : []
        }
        return
      }
      const [patientRecord, persistedReports] = await Promise.all([
        firebaseStorage.getPatientById(selectedPatient.id),
        persistedReportsPromise
      ])
      if (requestId !== summaryLoadRequestId) return
      storedSummary = patientRecord?.medicalSummary?.content || ''
      storedSummarySignature = patientRecord?.medicalSummary?.signature || ''
      savedReports = Array.isArray(persistedReports) ? persistedReports : []
    } catch (error) {
      console.warn('Failed to load stored medical summary', error)
      if (requestId === summaryLoadRequestId) {
        savedReports = []
      }
    } finally {
      if (requestId === summaryLoadRequestId) {
        isLoadingStoredSummary = false
      }
    }
  }

  const saveMedicalSummary = async (signature, summary) => {
    if (!selectedPatient?.id) return
    try {
      const payload = {
        medicalSummary: {
          content: summary,
          signature,
          updatedAt: new Date().toISOString(),
          source: 'ai'
        }
      }
      await firebaseStorage.updatePatient(selectedPatient.id, payload)
      storedSummary = summary
      storedSummarySignature = signature
    } catch (error) {
      console.warn('Failed to save medical summary', error)
    }
  }

  const generateMedicalSummary = async (signature) => {
    if (!selectedPatient) return
    if (!openaiService.isConfigured()) {
      if (storedSummary) {
        aiSummary = storedSummary
        summaryError = ''
      } else {
        summaryError = 'AI summary is unavailable because OpenAI is not configured.'
        aiSummary = ''
      }
      isLoadingSummary = false
      return
    }

    isLoadingSummary = true
    summaryError = ''

    try {
      const summaryPrescriptions = getSummaryPrescriptions()
      const patientData = {
        name: `${selectedPatient.firstName || ''} ${selectedPatient.lastName || ''}`.trim(),
        firstName: selectedPatient.firstName,
        lastName: selectedPatient.lastName,
        age: selectedPatient.age,
        weight: selectedPatient.weight,
        bloodGroup: selectedPatient.bloodGroup,
        gender: selectedPatient.gender,
        dateOfBirth: selectedPatient.dateOfBirth,
        allergies: selectedPatient.allergies,
        longTermMedications: selectedPatient.longTermMedications,
        medicalHistory: selectedPatient.medicalHistory,
        symptoms: symptoms || [],
        illnesses: illnesses || [],
        prescriptions: summaryPrescriptions,
        recentReports: summaryReports || [],
        reportAnalyses: []
      }

      const result = await openaiService.generatePatientSummary(patientData, doctorId)
      aiSummary = stripRiskFactorsSection(result.summary)
      if (signature) {
        await saveMedicalSummary(signature, aiSummary)
      }
      if (summaryCacheKey) {
        setCachedSummary(summaryCacheKey, aiSummary)
      }
    } catch (error) {
      summaryError = error?.message || 'Failed to generate AI summary.'
      aiSummary = ''
    } finally {
      isLoadingSummary = false
    }
  }

  // Reactive tab counts
  $: symptomsCount = symptoms?.length || 0
  $: illnessesCount = illnesses?.length || 0
  $: summaryReports = mergeReports(reports, savedReports)
  $: summaryPrescriptions = getSummaryPrescriptions()
  $: prescriptionsCount = summaryPrescriptions?.length || 0
  $: medicationsCount = summaryPrescriptions?.reduce((total, prescription) => {
    const meds = Array.isArray(prescription?.medications) ? prescription.medications.length : 0
    return total + meds
  }, 0) || 0

  
  // Track if prescription medications are expanded
  let showAllMedications = false
  
  // Reset expanded state when selected patient changes
  $: if (selectedPatient) {
    showAllMedications = false
  }

  
  // Extract all medications from prescriptions and group by drug name
  $: groupedMedications = summaryPrescriptions?.flatMap(prescription => 
    prescription.medications?.map(medication => ({
      ...medication,
      prescriptionId: prescription.id,
      prescriptionDate: prescription.createdAt,
      daysAgo: medication.createdAt ? Math.floor((new Date() - new Date(medication.createdAt)) / (1000 * 60 * 60 * 24)) : null
    })) || []
  ).reduce((groups, medication) => {
    const drugName = medication.name || 'Unknown medication'
    if (!groups[drugName]) {
      groups[drugName] = []
    }
    groups[drugName].push(medication)
    return groups
  }, {}) || {}
  
  // Convert grouped medications to array and sort by most recent dose
  $: allMedications = Object.entries(groupedMedications).map(([drugName, doses]) => ({
    drugName,
    doses: doses.sort((a, b) => new Date(b.createdAt || b.prescriptionDate || 0) - new Date(a.createdAt || a.prescriptionDate || 0))
  })).sort((a, b) => new Date(b.doses[0].createdAt || b.doses[0].prescriptionDate || 0) - new Date(a.doses[0].createdAt || a.doses[0].prescriptionDate || 0))

  // Check dispensed status for prescriptions
  
  // Handle tab change
  const handleTabChange = (tab) => {
    dispatch('tabChange', { tab })
  }

  $: currentPatientId = selectedPatient?.id || ''
  $: if (currentPatientId && currentPatientId !== lastLoadedPatientId) {
    lastLoadedPatientId = currentPatientId
    loadStoredSummary()
  }

  $: if (selectedPatient) {
    const signature = buildSummarySignature()
    if (signature !== lastSummarySignature) {
      lastSummarySignature = signature
      summaryCacheKey = `medicalSummary:${selectedPatient.id || 'unknown'}:${hashString(signature)}`
      const cached = getCachedSummary(summaryCacheKey)
      if (cached) {
        aiSummary = stripRiskFactorsSection(cached)
        summaryError = ''
        isLoadingSummary = false
      } else if (storedSummary && storedSummarySignature === signature) {
        aiSummary = stripRiskFactorsSection(storedSummary)
        summaryError = ''
        isLoadingSummary = false
      } else {
        aiSummary = ''
        generateMedicalSummary(signature)
      }
    }
  }
</script>

{#if selectedPatient}
  <div class="bg-white border-2 border-blue-200 rounded-lg shadow-sm mt-3 sm:text-sm dark:bg-slate-900 dark:border-blue-400">
    <div class="bg-gray-50 px-4 py-3 border-b border-gray-200 dark:bg-slate-950 dark:border-slate-700">
      <div class="flex justify-between items-center">
        <h6 class="text-lg font-semibold text-gray-900 mb-0 dark:text-slate-100">
          <i class="fas fa-chart-pie mr-2 text-blue-600"></i>Medical Summary
        </h6>
        <button 
          class="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 rounded-lg transition-colors duration-200 dark:bg-slate-800 dark:text-slate-100 dark:border-slate-600 dark:hover:bg-slate-700" 
          on:click={() => generateMedicalSummary(lastSummarySignature || buildSummarySignature())}
          title="Refresh summary"
          disabled={isLoadingSummary}
        >
          {#if isLoadingSummary}
            <i class="fas fa-spinner fa-spin mr-1"></i>Refreshing...
          {:else}
            <i class="fas fa-rotate mr-1"></i>Refresh
          {/if}
        </button>
      </div>
    </div>
    <div class="p-4 dark:bg-slate-900">
      {#if isLoadingSummary}
        <div class="text-sm text-gray-500 dark:text-slate-300">
          <i class="fas fa-spinner fa-spin mr-2"></i>Generating AI summary...
        </div>
      {:else if summaryError}
        <div class="text-sm text-red-600">
          <i class="fas fa-exclamation-circle mr-2"></i>{summaryError}
        </div>
      {:else if aiSummary}
        <div class="rounded-lg border border-blue-200 bg-blue-50/80 p-4 dark:bg-slate-800 dark:border-blue-400">
          <div class="prose max-w-none text-sm text-slate-800 prose-headings:text-slate-900 prose-strong:text-slate-900 prose-li:marker:text-blue-500 dark:prose-invert dark:text-slate-100 dark:prose-headings:text-slate-50 dark:prose-strong:text-slate-100 dark:prose-li:marker:text-blue-300">
            {@html aiSummary}
          </div>
        </div>
      {:else}
        <div class="text-sm text-gray-500 dark:text-slate-300">
          <i class="fas fa-info-circle mr-2"></i>No summary available.
        </div>
      {/if}

    </div>
  </div>
{/if}
