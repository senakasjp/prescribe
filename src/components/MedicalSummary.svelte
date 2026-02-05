<script>
  import { createEventDispatcher } from 'svelte'
  import openaiService from '../services/openaiService.js'
  
  const dispatch = createEventDispatcher()
  
  export let selectedPatient
  export let illnesses = []
  export let prescriptions = []
  export let symptoms = []
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

  const buildSummarySignature = () => {
    const base = {
      patientId: selectedPatient?.id || '',
      patientUpdatedAt: selectedPatient?.updatedAt || selectedPatient?.createdAt || '',
      symptomsCount,
      illnessesCount,
      prescriptionsCount,
      symptomsLatest: getLatestTimestamp(symptoms),
      illnessesLatest: getLatestTimestamp(illnesses),
      prescriptionsLatest: getLatestTimestamp(prescriptions)
    }
    return JSON.stringify(base)
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

  const generateMedicalSummary = async () => {
    if (!selectedPatient) return
    if (!openaiService.isConfigured()) {
      summaryError = 'AI summary is unavailable because OpenAI is not configured.'
      aiSummary = ''
      isLoadingSummary = false
      return
    }

    isLoadingSummary = true
    summaryError = ''

    try {
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
        prescriptions: prescriptions || [],
        recentReports: [],
        reportAnalyses: []
      }

      const result = await openaiService.generatePatientSummary(patientData, doctorId)
      aiSummary = result.summary
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
  $: prescriptionsCount = prescriptions?.length || 0

  
  // Track if prescription medications are expanded
  let showAllMedications = false
  
  // Reset expanded state when selected patient changes
  $: if (selectedPatient) {
    showAllMedications = false
  }

  
  // Extract all medications from prescriptions and group by drug name
  $: groupedMedications = prescriptions?.flatMap(prescription => 
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

  $: if (selectedPatient) {
    const signature = buildSummarySignature()
    if (signature !== lastSummarySignature) {
      lastSummarySignature = signature
      summaryCacheKey = `medicalSummary:${selectedPatient.id || 'unknown'}:${hashString(signature)}`
      const cached = getCachedSummary(summaryCacheKey)
      if (cached) {
        aiSummary = cached
        summaryError = ''
        isLoadingSummary = false
      } else {
        aiSummary = ''
        generateMedicalSummary()
      }
    }
  }
</script>

{#if selectedPatient}
  <div class="bg-white border-2 border-blue-200 rounded-lg shadow-sm mt-3">
    <div class="bg-gray-50 px-4 py-3 border-b border-gray-200">
      <div class="flex justify-between items-center">
        <h6 class="text-lg font-semibold text-gray-900 mb-0">
          <i class="fas fa-chart-pie mr-2 text-blue-600"></i>Medical Summary
        </h6>
        <button 
          class="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 rounded-lg transition-colors duration-200" 
          on:click={() => selectedPatient = null}
          title="Back to patient list"
        >
          <i class="fas fa-arrow-left mr-1"></i>Back
        </button>
      </div>
    </div>
    <div class="p-4">
      {#if isLoadingSummary}
        <div class="text-sm text-gray-500">
          <i class="fas fa-spinner fa-spin mr-2"></i>Generating AI summary...
        </div>
      {:else if summaryError}
        <div class="text-sm text-red-600">
          <i class="fas fa-exclamation-circle mr-2"></i>{summaryError}
        </div>
      {:else if aiSummary}
        <div class="flex items-center justify-between mb-3">
          <div class="flex items-center gap-2 text-blue-700 font-semibold text-sm">
            <span class="inline-flex items-center justify-center w-7 h-7 rounded-full bg-blue-100 text-blue-600">
              <i class="fas fa-robot text-sm"></i>
            </span>
            <span>AI Medical Summary</span>
          </div>
          <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
            Auto‑generated
          </span>
        </div>
        <div class="prose max-w-none text-sm text-slate-700">
          {@html aiSummary}
        </div>
      {:else}
        <div class="text-sm text-gray-500">
          <i class="fas fa-info-circle mr-2"></i>No summary available.
        </div>
      {/if}

    </div>
  </div>
{/if}
