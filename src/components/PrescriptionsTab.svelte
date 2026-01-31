<script>
  import PatientForms from './PatientForms.svelte'
  import { pharmacyMedicationService } from '../services/pharmacyMedicationService.js'
  import firebaseStorage from '../services/firebaseStorage.js'
  import chargeCalculationService from '../services/pharmacist/chargeCalculationService.js'
  import DateInput from './DateInput.svelte'
  
  export let selectedPatient
  export let showMedicationForm
  export let editingMedication
  export let doctorId
  export let allowNonPharmacyDrugs = true
  export let excludePharmacyDrugs = false
  export let currentMedications
  export let prescriptionsFinalized
  export let showAIDrugSuggestions
  export let aiDrugSuggestions
  export let currentPrescription
  export let onMedicationAdded
  export let onCancelMedication
  export let onEditPrescription
  export let onDeletePrescription
  export let onDeleteMedicationByIndex
  export let onFinalizePrescription
  export let onShowPharmacyModal
  export let onGoToPreviousTab
  export let onGenerateAIDrugSuggestions
  export let onAddAISuggestedDrug
  export let onRemoveAISuggestedDrug
  export let loadingAIDrugSuggestions
  export let onGenerateAIAnalysis = null
  export let loadingAIAnalysis = false
  export let showAIAnalysis = false
  export let aiAnalysisHtml = ''
  export let aiAnalysisError = ''
  export let symptoms
  export let openaiService
  export let onNewPrescription
  export let onAddDrug
  export let onPrintPrescriptions
  export let onPrintExternalPrescriptions
  export let prescriptionNotes = ''
  export let prescriptionDiscount = 0 // New discount field
  export let prescriptionDiscountScope = 'consultation' // 'consultation' | 'consultation_hospital'
  export let nextAppointmentDate = ''
  export let prescriptionProcedures = []
  export let otherProcedurePrice = ''
  export let excludeConsultationCharge = false
  export let currentUserEmail = null
  export let doctorProfileFallback = null
  
  // Debug AI analysis
  $: console.log('🔍 PrescriptionsTab - showAIAnalysis:', showAIAnalysis)
  
  // Pharmacy stock availability
  let pharmacyStock = []
  let stockLoading = false
  let resolvedDoctorIdentifier = null
  let connectedPharmacyIds = []
  let hasConnectedPharmacies = false
  let doctorProfile = null
  let doctorCurrency = 'USD'
  let expectedPrice = null
  let expectedPriceLoading = false
  let expectedPharmacist = null
  let expectedPriceRequestId = 0
  let showProcedures = false
  let showNotes = false
  let showDiscounts = false
  let showNextAppointment = false
  let improvingNotes = false
  let notesImproved = false
  let lastImprovedNotes = ''
  
  $: if (!prescriptionProcedures?.includes('Other')) {
    otherProcedurePrice = ''
  }

  $: if (currentPrescription?.notes && !showNotes) {
    showNotes = true
  }

  $: if (!improvingNotes && notesImproved && prescriptionNotes !== lastImprovedNotes) {
    notesImproved = false
  }

  $: {
    const hasDiscount = Number(prescriptionDiscount) > 0 || Number(currentPrescription?.discount) > 0
    if (hasDiscount && !showDiscounts) {
      showDiscounts = true
    }
  }

  $: if (currentPrescription?.nextAppointmentDate && !showNextAppointment) {
    showNextAppointment = true
  }

  $: if (currentPrescription?.notes && !showNotes) {
    showNotes = true
  }

  $: {
    const hasDiscount = Number(prescriptionDiscount) > 0 || Number(currentPrescription?.discount) > 0
    if (hasDiscount && !showDiscounts) {
      showDiscounts = true
    }
  }

  const handleImprovePrescriptionNotes = async () => {
    if (!prescriptionNotes || !prescriptionNotes.trim()) {
      return
    }

    if (!openaiService) {
      console.error('OpenAI service is not available for improving notes.')
      return
    }

    try {
      improvingNotes = true
      const originalNotes = prescriptionNotes
      const resolvedDoctorId = doctorId || currentPrescription?.doctorId || 'default-user'
      const result = await openaiService.improveText(prescriptionNotes, resolvedDoctorId)
      prescriptionNotes = result.improvedText

      const normalizedOriginal = String(originalNotes ?? '').trim()
      const normalizedImproved = String(prescriptionNotes ?? '').trim()
      notesImproved = normalizedImproved !== '' && normalizedImproved !== normalizedOriginal
      lastImprovedNotes = notesImproved ? normalizedImproved : ''
    } catch (err) {
      console.error('❌ Error improving prescription notes:', err)
    } finally {
      improvingNotes = false
    }
  }

  const procedureOptions = [
    'C&D- type -A',
    'C&D-type -B',
    'C&D-type-C',
    'C&D-type-D',
    'Suturing- type-A',
    'Suturing- type-B',
    'Suturing- type-C',
    'Suturing- type-D',
    'Nebulization - Ipra.0.25ml+N. saline2ml+Oxygen',
    'Nebulization - sal 0. 5ml+Ipra 0. 5ml+N. Saline 3ml',
    'Nebulization - sal 0. 5ml+Ipra 0. 5ml+N. Saline 3ml+Oxygen',
    'Nebulization -sal1ml+Ipra1ml+N. Saline2ml+Oxygen',
    'Nebulization Ipra1ml+N. Saline3ml',
    'Nebulization -sal1ml+Ipra1ml+N. Saline2ml',
    'Nebulization - pulmicort(Budesonide)',
    'catheterization',
    'IV drip Saline/Dextrose',
    'Other'
  ]

  // Load pharmacy stock for availability checking
  const MAX_STOCK_ATTEMPTS = 5
  const RETRY_DELAY_MS = 1000

  const loadPharmacyStock = async (identifier = null, attempt = 0) => {
    let resolvedDoctorId = identifier ?? doctorId

    // Fallback to patient-linked doctor ID or email when primary doctorId is missing/default
    if (!resolvedDoctorId || resolvedDoctorId === 'default-user' || resolvedDoctorId === 'unknown') {
      resolvedDoctorId = selectedPatient?.doctorId ||
        selectedPatient?.doctor?.id ||
        currentPrescription?.doctorId ||
        selectedPatient?.doctorEmail ||
        currentPrescription?.doctorEmail ||
        null
    }

    if (!resolvedDoctorId) {
      console.warn('⚠️ Unable to resolve doctor identifier for pharmacy stock lookup')
      pharmacyStock = []
      return
    }
    
    try {
      stockLoading = true
      console.log('📦 Loading pharmacy stock for doctor:', resolvedDoctorId, 'attempt', attempt + 1)
      console.log('🔍 Selected patient doctorId:', selectedPatient?.doctorId, 'doctor email:', selectedPatient?.doctorEmail)

      // Ensure doctor has connected pharmacies before fetching inventory
      const connectedPharmacies = await pharmacyMedicationService.getConnectedPharmacies(resolvedDoctorId)
      connectedPharmacyIds = Array.isArray(connectedPharmacies) ? connectedPharmacies : []
      hasConnectedPharmacies = connectedPharmacyIds.length > 0
      console.log('🏥 Connected pharmacies for doctor:', resolvedDoctorId, connectedPharmacies)

      if (!hasConnectedPharmacies && attempt < MAX_STOCK_ATTEMPTS - 1) {
        console.warn(`⚠️ No connected pharmacies yet (attempt ${attempt + 1}/${MAX_STOCK_ATTEMPTS}). Retrying...`)
        setTimeout(() => loadPharmacyStock(resolvedDoctorId, attempt + 1), RETRY_DELAY_MS)
        return
      }

      // Clear cache to ensure we always reflect latest inventory (especially after doctor connection updates)
      pharmacyMedicationService.clearCache(resolvedDoctorId)

      const stockData = await pharmacyMedicationService.getPharmacyStock(resolvedDoctorId)
      pharmacyStock = stockData

      console.log('📦 Total loaded pharmacy stock:', pharmacyStock.length)
      if (pharmacyStock.length === 0 && attempt < MAX_STOCK_ATTEMPTS - 1) {
        console.warn(`⚠️ Pharmacy stock empty, retrying fetch (attempt ${attempt + 1}/${MAX_STOCK_ATTEMPTS})`)
        setTimeout(() => loadPharmacyStock(resolvedDoctorId, attempt + 1), RETRY_DELAY_MS)
      } else if (pharmacyStock.length === 0) {
        console.warn('⚠️ Pharmacy stock remains empty after maximum retries')
      }

    } catch (error) {
      console.error('❌ Error loading pharmacy stock:', error)
      pharmacyStock = []
    } finally {
      stockLoading = false
    }
  }

  const loadDoctorProfile = async (identifier = null) => {
    try {
      let resolvedDoctorId = identifier ?? doctorId
      let doctorData = null

      if (resolvedDoctorId && resolvedDoctorId !== 'default-user' && resolvedDoctorId !== 'unknown') {
        doctorData = await firebaseStorage.getDoctorById(resolvedDoctorId)
      }

      if (!doctorData && resolvedDoctorId) {
        doctorData = await firebaseStorage.getDoctorByEmail(resolvedDoctorId)
      }

      if (!doctorData && currentUserEmail) {
        doctorData = await firebaseStorage.getDoctorByEmail(currentUserEmail)
      }

      const fallbackHasCharges = doctorProfileFallback &&
        (doctorProfileFallback.consultationCharge || doctorProfileFallback.hospitalCharge)

      if (!doctorData && currentUserEmail) {
        doctorData = await firebaseStorage.getDoctorByEmail(currentUserEmail)
      }

      if (!doctorData && doctorProfileFallback && fallbackHasCharges) {
        doctorData = doctorProfileFallback
      }

      doctorProfile = doctorData
      doctorCurrency = doctorData?.currency || doctorProfileFallback?.currency || 'USD'
    } catch (error) {
      console.error('❌ Error loading doctor profile for expected price:', error)
      doctorProfile = doctorProfileFallback
      doctorCurrency = doctorProfileFallback?.currency || 'USD'
    }
  }

  const loadExpectedPharmacist = async () => {
    try {
      if (!connectedPharmacyIds || connectedPharmacyIds.length === 0) {
        expectedPharmacist = null
        return
      }

      const pharmacistId = connectedPharmacyIds[0]
      const pharmacistData = await firebaseStorage.getPharmacistById(pharmacistId)
      expectedPharmacist = pharmacistData || null
    } catch (error) {
      console.error('❌ Error loading pharmacist for expected price:', error)
      expectedPharmacist = null
    }
  }
  
  // Check if a medication is available in pharmacy stock
  const isMedicationAvailable = (medication) => {
    if (!medication || !pharmacyStock.length) return null
    
    console.log('🔍 ===== STARTING AVAILABILITY CHECK =====')
    console.log('🔍 Medication to check:', JSON.stringify(medication, null, 2))
    console.log('📦 Pharmacy stock array length:', pharmacyStock.length)
    console.log('📦 All pharmacy stock:', JSON.stringify(pharmacyStock, null, 2))
    
    // Parse medication dosage to extract strength and unit
    console.log('🔍 Dosage string:', medication.dosage)
    const dosageMatch = medication.dosage?.match(/^(\d+(?:\.\d+)?)([a-zA-Z]+)$/)
    console.log('🔍 Dosage match result:', dosageMatch)
    
    if (!dosageMatch) {
      console.log('⚠️ Could not parse dosage:', medication.dosage, '- trying name-only match')
      
      const matchingStock = pharmacyStock.find(stock => {
        const stockName = stock.drugName?.toLowerCase().trim() || ''
        const stockGeneric = stock.genericName?.toLowerCase().trim() || ''
        const stockNames = [stockName, stockGeneric].filter(Boolean)
        const medName = medication.name?.toLowerCase().trim() || ''
        const normalizedMedNames = Array.from(new Set([
          medName,
          medName.split('(')[0]?.trim() || '',
          medName.replace(/\(.*\)/, '').trim()
        ])).filter(Boolean)

        const nameMatch = normalizedMedNames.some(name => 
          stockNames.some(stockValue => stockValue.includes(name) || name.includes(stockValue))
        )
        
        console.log('🔍 Name-only comparison:', stockNames, 'vs', normalizedMedNames, 'match:', nameMatch)
        return nameMatch
      })
      
      if (matchingStock) {
        const quantity = parseInt(matchingStock.quantity) || 0
        console.log('✅ Found name-only match:', matchingStock, 'quantity:', quantity)
        return {
          available: quantity > 0,
          quantity: quantity,
          stockItem: matchingStock
        }
      }
      
      return null
    }
    
    const [, strength, unit] = dosageMatch
    console.log('🔍 Parsed strength:', strength, 'unit:', unit)
    
    // Find matching stock item with more flexible matching
    const matchingStock = pharmacyStock.find(stock => {
      // Check drug name match (case insensitive, partial match)
      const stockName = stock.drugName?.toLowerCase().trim() || ''
      const stockGeneric = stock.genericName?.toLowerCase().trim() || ''
      const stockNames = [stockName, stockGeneric].filter(Boolean)
      const medNameRaw = medication.name?.toLowerCase().trim() || ''
      const normalizedMedNames = Array.from(new Set([
        medNameRaw,
        medNameRaw.split('(')[0]?.trim() || '',
        medNameRaw.replace(/\(.*\)/, '').trim()
      ])).filter(Boolean)
      const nameMatch = normalizedMedNames.some(name => 
        stockNames.some(stockValue => stockValue && (stockValue.includes(name) || name.includes(stockValue)))
      )
      
      console.log('🔍 Name comparison:', stockNames, 'vs', normalizedMedNames, 'match:', nameMatch)
      
      // Check strength match (flexible)
      const stockStrength = stock.strength || ''
      const strengthMatch = stockStrength === strength || stockStrength.includes(strength)
      
      console.log('🔍 Strength comparison:', stockStrength, 'vs', strength, 'match:', strengthMatch)
      
      // Check unit match (flexible)
      const stockUnit = stock.strengthUnit || ''
      const unitMatch = !stockUnit || stockUnit === unit || stockUnit.includes(unit)
      
      console.log('🔍 Unit comparison:', stockUnit, 'vs', unit, 'match:', unitMatch)
      
      const isMatch = nameMatch && strengthMatch && unitMatch
      console.log('🔍 Overall match for stock item:', stock.drugName, ':', isMatch)
      
      return isMatch
    })
    
    if (matchingStock) {
      // Check if quantity is available
      const quantity = parseInt(matchingStock.quantity) || 0
      console.log('✅ Found matching stock:', matchingStock, 'quantity:', quantity)
      return {
        available: quantity > 0,
        quantity: quantity,
        stockItem: matchingStock
      }
    }
    
    console.log('❌ No matching stock found for:', medication.name)
    return { available: false, quantity: 0, stockItem: null }
  }

  const calculateMedicationQuantity = (medication) => {
    if (medication?.amount !== undefined && medication?.amount !== null && medication?.amount !== '') {
      return chargeCalculationService.parseMedicationQuantity(medication.amount) || 0
    }

    if (medication?.frequency && medication.frequency.includes('PRN') && medication?.prnAmount) {
      return chargeCalculationService.parseMedicationQuantity(medication.prnAmount) || 0
    }

    if (!medication?.frequency || !medication?.duration) {
      return 0
    }

    const durationMatch = medication.duration.match(/(\d+)\s*days?/i)
    if (!durationMatch) {
      return 0
    }
    const days = parseInt(durationMatch[1], 10)

    return days > 0 ? days : 0
  }

  const buildExpectedPrescriptionForCharge = () => {
    if (!currentPrescription || !currentMedications || currentMedications.length === 0) {
      return null
    }

    const resolvedDiscount = Number.isFinite(Number(prescriptionDiscount))
      ? Number(prescriptionDiscount)
      : Number.isFinite(Number(currentPrescription?.discount))
        ? Number(currentPrescription.discount)
        : 0
    const resolvedDiscountScope = prescriptionDiscountScope
      || currentPrescription?.discountScope
      || 'consultation'

    const medicationsForCharge = currentMedications.map(medication => ({
      ...medication,
      amount: calculateMedicationQuantity(medication),
      isDispensed: true
    }))

    const doctorIdentifier = currentPrescription?.doctorId || doctorProfile?.id || doctorId || null
    const procedures = Array.isArray(prescriptionProcedures) ? prescriptionProcedures : []

    return {
      id: currentPrescription.id,
      doctorId: doctorIdentifier,
      discount: resolvedDiscount,
      discountScope: resolvedDiscountScope,
      procedures: procedures,
      otherProcedurePrice: otherProcedurePrice,
      excludeConsultationCharge: !!excludeConsultationCharge,
      prescriptions: [
        {
          id: currentPrescription.id,
          medications: medicationsForCharge,
          procedures: procedures,
          otherProcedurePrice: otherProcedurePrice,
          discount: resolvedDiscount,
          discountScope: resolvedDiscountScope,
          excludeConsultationCharge: !!excludeConsultationCharge
        }
      ]
    }
  }

  const recomputeExpectedPrice = async () => {
    const requestId = ++expectedPriceRequestId
    expectedPriceLoading = true

    try {
      if (!expectedPharmacist) {
        expectedPrice = null
        return
      }

      const prescriptionForCharge = buildExpectedPrescriptionForCharge()
      if (!prescriptionForCharge) {
        expectedPrice = null
        return
      }

      const chargeBreakdown = chargeCalculationService.calculateExpectedChargeFromStock(
        prescriptionForCharge,
        doctorProfile || doctorProfileFallback || {},
        pharmacyStock,
        {
          roundingPreference: doctorProfile?.roundingPreference
            || doctorProfileFallback?.roundingPreference
            || 'none',
          currency: expectedPharmacist?.currency || doctorCurrency || 'USD',
          ignoreAvailability: true
        }
      )
      if (requestId !== expectedPriceRequestId) {
        return
      }
      expectedPrice = chargeBreakdown?.totalCharge ?? null
    } catch (error) {
      console.error('❌ Error calculating expected price:', error)
      if (requestId === expectedPriceRequestId) {
        expectedPrice = null
      }
    } finally {
      if (requestId === expectedPriceRequestId) {
        expectedPriceLoading = false
      }
    }
  }

  const formatExpectedPrice = (amount) => {
    if (!Number.isFinite(amount)) {
      return '--'
    }
    const currency = expectedPharmacist?.currency || doctorCurrency || 'USD'
    if (currency === 'LKR') {
      return `Rs ${amount.toFixed(2)}`
    }
    try {
      return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount)
    } catch (error) {
      return amount.toFixed(2)
    }
  }

  const getUnavailableMedications = () => {
    if (!currentMedications || currentMedications.length === 0) {
      return []
    }

    return currentMedications.filter(medication => {
      const availability = isMedicationAvailable(medication)
      return availability?.available === false
    })
  }
  
  // Determine doctor identifier reactively and load stock
  $: resolvedDoctorIdentifier = (() => {
    if (doctorId && doctorId !== 'default-user' && doctorId !== 'unknown') {
      return doctorId
    }
    return selectedPatient?.doctorId ||
      selectedPatient?.doctor?.id ||
      currentPrescription?.doctorId ||
      selectedPatient?.doctorEmail ||
      currentPrescription?.doctorEmail ||
      currentUserEmail ||
      null
  })()
  
  $: if (resolvedDoctorIdentifier) {
    loadPharmacyStock(resolvedDoctorIdentifier)
    loadDoctorProfile(resolvedDoctorIdentifier)
  } else {
    connectedPharmacyIds = []
    hasConnectedPharmacies = false
    pharmacyStock = []
    doctorProfile = null
    doctorCurrency = 'USD'
  }

  $: if (!doctorProfile && currentUserEmail) {
    loadDoctorProfile(currentUserEmail)
  }

  $: if (connectedPharmacyIds && connectedPharmacyIds.length > 0) {
    loadExpectedPharmacist()
  } else {
    expectedPharmacist = null
  }

  $: if (prescriptionsFinalized && currentMedications && currentMedications.length > 0) {
    recomputeExpectedPrice()
  } else {
    expectedPrice = null
  }
  
</script>

<div class="space-y-4">
  <!-- Prescription Card -->
  <div class="bg-white border-2 border-gray-200 rounded-lg shadow-sm">
    <div class="bg-gray-100 text-gray-800 px-4 py-3 rounded-t-lg">
      <div class="flex flex-col md:flex-row justify-between items-start md:items-center">
        <h5 class="text-lg font-semibold mb-2 md:mb-0">
          <i class="fas fa-prescription-bottle-alt mr-2"></i>Prescription
        </h5>
        <div class="flex flex-wrap gap-2">
          <!-- New Prescription Button -->
          <button 
            class="text-white bg-teal-600 hover:bg-teal-700 focus:ring-4 focus:outline-none focus:ring-teal-300 font-medium rounded-lg text-sm px-3 py-1 text-center dark:bg-teal-600 dark:hover:bg-teal-700 dark:focus:ring-teal-800 transition-all duration-200" 
            on:click={onNewPrescription}
            title="Create a new prescription"
          >
            <i class="fas fa-plus mr-1"></i>New Prescription
          </button>
          
          <!-- Add Drug Button -->
          <button 
              class="text-white bg-teal-600 hover:bg-teal-700 focus:ring-4 focus:outline-none focus:ring-teal-300 font-medium rounded-lg text-sm px-3 py-1 text-center dark:bg-teal-600 dark:hover:bg-teal-700 dark:focus:ring-teal-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200" 
              on:click={onAddDrug}
              disabled={showMedicationForm || !currentPrescription}
              title={!currentPrescription ? "Click 'New Prescription' first" : "Add medication to current prescription"}
          >
            <i class="fas fa-plus mr-1"></i>Add Drug
          </button>
          
          <!-- AI Analysis Button -->
          <button 
              class="text-white bg-purple-600 hover:bg-purple-700 focus:ring-4 focus:outline-none focus:ring-purple-300 font-medium rounded-lg text-sm px-3 py-1 text-center dark:bg-purple-600 dark:hover:bg-purple-700 dark:focus:ring-purple-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200" 
              on:click={onGenerateAIAnalysis}
              disabled={loadingAIAnalysis || !currentPrescription || !openaiService.isConfigured() || !currentMedications || currentMedications.length === 0}
              title={!currentPrescription ? "Create a prescription first" : (!currentMedications || currentMedications.length === 0) ? "Add medications first" : "Run AI analysis for this prescription"}
          >
            {#if loadingAIAnalysis}
              <svg class="animate-spin -ml-1 mr-1 h-3 w-3 text-white inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Generating...
            {:else}
              <i class="fas fa-brain mr-1 text-red-600"></i>AI Analysis
            {/if}
          </button>
        </div>
      </div>
    </div>
    <div class="p-4">
          <!-- Patient Forms -->
          <PatientForms 
            {showMedicationForm}
            {selectedPatient}
            {editingMedication}
            {doctorId}
            {allowNonPharmacyDrugs}
            {excludePharmacyDrugs}
            onMedicationAdded={onMedicationAdded}
            onCancelMedication={onCancelMedication}
          />
          <!-- AI Analysis Section -->
          {#if showAIAnalysis}
            <div class="mt-4 border-t border-gray-200 pt-4">
              <div class="flex justify-between items-center mb-4">
                <h6 class="text-lg font-semibold text-gray-700 mb-0">
                  <i class="fas fa-brain mr-2 text-red-600"></i>
                  AI Analysis
                </h6>
              </div>
              {#if aiAnalysisError}
                <div class="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  {aiAnalysisError}
                </div>
              {:else if aiAnalysisHtml}
                <div class="prose max-w-none text-gray-700 ai-analysis ai-analysis-short" style="font-size: 0.95rem;">
                  {@html aiAnalysisHtml}
                </div>
              {:else}
                <p class="text-sm text-gray-500">Run AI Analysis to see results.</p>
              {/if}
            </div>
            <hr class="mt-4 border-gray-200" />
          {/if}
          
          
          <!-- Current Prescriptions List -->
          {#if currentMedications && currentMedications.length > 0}
            <div class="medication-list">
              {#each currentMedications as medication, index}
                <div class="flex justify-between items-center py-3 border-b border-gray-200 last:border-b-0">
                  <div class="flex-1">
                    <div class="font-semibold text-gray-900">
                      {medication.name}
                      {#if medication.aiSuggested}
                        <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 ml-2">
                          <i class="fas fa-brain mr-1 text-red-600"></i>AI Suggested
                        </span>
                      {/if}
                      <!-- Availability Badge -->
                      {#if !stockLoading}
                        {@const availability = isMedicationAvailable(medication)}
                        {#if availability !== null && availability.available}
                          {@const isLowStock = availability.stockItem && availability.stockItem.initialQuantity && availability.quantity <= (availability.stockItem.initialQuantity * 0.1)}
                          <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium {isLowStock ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'} ml-2">
                            <i class="fas fa-check-circle mr-1"></i>In Stock
                          </span>
                        {/if}
                      {:else}
                        <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 ml-2">
                          <i class="fas fa-spinner fa-spin mr-1"></i>Checking...
                        </span>
                      {/if}
                    </div>
                    <div class="text-gray-500 text-sm">
                      {medication.dosage} • {medication.frequency} • {medication.duration}{#if medication.dosageForm} • {medication.dosageForm}{/if}
                    </div>
                    {#if medication.instructions}
                      <div class="mt-1">
                        <div class="text-gray-500 text-sm">{medication.instructions}</div>
                      </div>
                    {/if}
                    {#if medication.aiReason}
                      <div class="mt-1">
                        <div class="text-gray-700 text-sm">
                          <i class="fas fa-lightbulb mr-1"></i>
                          <span class="font-medium">AI Reason:</span> {medication.aiReason}
                        </div>
                      </div>
                    {/if}
                  </div>
                  {#if !prescriptionsFinalized}
                    <div class="flex gap-2">
                      <button 
                        class="inline-flex items-center px-2 py-1 border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 text-xs font-medium rounded focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 transition-colors duration-200"
                        on:click={() => onEditPrescription(medication, index)}
                        title="Edit medication"
                      >
                        <i class="fas fa-edit"></i>
                      </button>
                      <button 
                        class="inline-flex items-center px-2 py-1 border border-red-300 text-red-700 bg-white hover:bg-red-50 text-xs font-medium rounded focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors duration-200"
                        on:click={() => {
                          if (medication.id) {
                            onDeletePrescription(medication.id, index)
                          } else {
                            console.warn('⚠️ Medication missing ID, attempting to delete by index:', medication)
                            onDeleteMedicationByIndex(index)
                          }
                        }}
                        title="Delete medication"
                      >
                        <i class="fas fa-trash"></i>
                      </button>
                    </div>
                  {:else}
                    <div class="text-gray-500">
                      <div class="text-sm"><i class="fas fa-check-circle mr-1"></i>Finalized</div>
                    </div>
                  {/if}
                </div>
              {/each}
            </div>
          {/if}

          <!-- Procedures / Treatments -->
          <div class="mt-4">
            <div class="flex items-center gap-2 mb-2">
              <input
                class="w-4 h-4 text-teal-600 bg-gray-100 border-gray-300 rounded focus:ring-teal-500 focus:ring-2"
                type="checkbox"
                id="toggleProcedures"
                bind:checked={showProcedures}
                disabled={!currentPrescription}
              >
              <label class="text-sm font-medium text-gray-700" for="toggleProcedures">
                Procedures / Treatments
              </label>
            </div>
            {#if showProcedures}
              <div class="mb-2">
                <label class="flex items-center gap-2 text-sm font-medium text-red-600">
                  <input
                    class="w-4 h-4 text-teal-600 bg-gray-100 border-gray-300 rounded focus:ring-teal-500 focus:ring-2"
                    type="checkbox"
                    bind:checked={excludeConsultationCharge}
                    disabled={!currentPrescription}
                  >
                  Exclude consultation charge
                </label>
              </div>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
                {#each procedureOptions as option}
                  {#if option === 'Other'}
                    <div class="flex items-center justify-between gap-2 p-2 border border-gray-200 rounded-lg bg-white">
                      <label class="flex items-start gap-2">
                        <input
                          class="w-4 h-4 mt-0.5 text-teal-600 bg-gray-100 border-gray-300 rounded focus:ring-teal-500 focus:ring-2"
                          type="checkbox"
                          value={option}
                          bind:group={prescriptionProcedures}
                          disabled={!currentPrescription}
                        >
                        <span class="text-sm text-gray-700">Other</span>
                      </label>
                      <div class="flex items-center gap-2">
                        <span class="text-xs text-gray-500">{doctorCurrency}</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          class="w-24 px-2 py-1 border border-gray-300 rounded-lg text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                          placeholder="Price"
                          bind:value={otherProcedurePrice}
                          disabled={!currentPrescription || !prescriptionProcedures.includes('Other')}
                        />
                      </div>
                    </div>
                  {:else}
                    <label class="flex items-start gap-2 p-2 border border-gray-200 rounded-lg bg-white">
                      <input
                        class="w-4 h-4 mt-0.5 text-teal-600 bg-gray-100 border-gray-300 rounded focus:ring-teal-500 focus:ring-2"
                        type="checkbox"
                        value={option}
                        bind:group={prescriptionProcedures}
                        disabled={!currentPrescription}
                      >
                      <span class="text-sm text-gray-700">{option}</span>
                    </label>
                  {/if}
                {/each}
              </div>
            {/if}
            {#if !currentPrescription}
              <div class="text-xs text-gray-500 mt-2">
                <i class="fas fa-info-circle mr-1"></i>
                Create a new prescription to select procedures.
              </div>
            {/if}
          </div>

          {#if currentMedications && currentMedications.length > 0}
            <!-- Prescription Notes Toggle -->
            <div class="mt-4">
              <div class="flex items-center justify-between gap-2 mb-2">
                <label class="flex items-center gap-2 text-sm font-medium text-gray-700" for="toggleNotes">
                  <input
                    class="w-4 h-4 text-teal-600 bg-gray-100 border-gray-300 rounded focus:ring-teal-500 focus:ring-2"
                    type="checkbox"
                    id="toggleNotes"
                    bind:checked={showNotes}
                    disabled={!currentPrescription}
                  >
                  <span>Prescription Notes</span>
                  {#if notesImproved}
                    <span class="ml-1 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                      <i class="fas fa-check-circle mr-1"></i>
                      AI Improved
                    </span>
                  {/if}
                </label>
                {#if showNotes}
                  <button
                    type="button"
                    class="inline-flex items-center px-3 py-1.5 bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white text-xs font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:bg-gray-400 disabled:cursor-not-allowed transition-all duration-200 shadow-sm"
                    on:click={handleImprovePrescriptionNotes}
                    disabled={!currentPrescription || improvingNotes || notesImproved || !prescriptionNotes}
                    title="Fix spelling and grammar with AI"
                  >
                    {#if improvingNotes}
                      <svg class="animate-spin h-3 w-3 mr-1.5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014-12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Improving...
                    {:else}
                      <i class="fas fa-sparkles mr-1.5"></i>
                      Improve English AI
                    {/if}
                  </button>
                {/if}
              </div>
              {#if showNotes}
                <textarea
                  id="prescriptionNotes"
                  bind:value={prescriptionNotes}
                  rows="3"
                  class="w-full px-3 py-2 border rounded-lg text-sm placeholder-gray-500 focus:outline-none focus:ring-2 transition-all duration-200 {notesImproved ? 'bg-green-50 border-green-300 text-green-700 focus:ring-green-500 focus:border-green-500' : 'bg-white border-gray-300 focus:ring-teal-500 focus:border-teal-500'} {improvingNotes ? 'bg-gray-100' : ''}"
                  placeholder="Additional instructions or notes for the prescription..."
                ></textarea>
              {/if}
            </div>

            <!-- Next Appointment Toggle -->
            <div class="mt-4">
              <div class="flex items-center gap-2 mb-2">
                <input
                  class="w-4 h-4 text-teal-600 bg-gray-100 border-gray-300 rounded focus:ring-teal-500 focus:ring-2"
                  type="checkbox"
                  id="toggleNextAppointment"
                  bind:checked={showNextAppointment}
                  disabled={!currentPrescription}
                >
                <label class="text-sm font-medium text-gray-700" for="toggleNextAppointment">
                  Next Appointment Date
                </label>
              </div>
              {#if showNextAppointment}
                <DateInput type="date" lang="en-GB" placeholder="dd/mm/yyyy"
                  class="w-48 max-w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                  bind:value={nextAppointmentDate} />
              {/if}
            </div>
            
            <!-- Discount Toggle + Fields -->
            <div class="mt-4">
              <div class="flex items-center gap-2 mb-2">
                <input
                  class="w-4 h-4 text-teal-600 bg-gray-100 border-gray-300 rounded focus:ring-teal-500 focus:ring-2"
                  type="checkbox"
                  id="toggleDiscounts"
                  bind:checked={showDiscounts}
                  disabled={!currentPrescription}
                >
                <label class="text-sm font-medium text-gray-700" for="toggleDiscounts">
                  Discount (for pharmacy use only)
                </label>
              </div>
              {#if showDiscounts}
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label for="prescriptionDiscount" class="block text-sm font-medium text-gray-700 mb-2">
                      <i class="fas fa-percentage mr-2 text-teal-600"></i>
                      Discount percentage
                    </label>
                    <select
                      id="prescriptionDiscount"
                      bind:value={prescriptionDiscount}
                      class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                    >
                      <option value={0}>0% - No Discount</option>
                      <option value={10}>10%</option>
                      <option value={20}>20%</option>
                      <option value={30}>30%</option>
                      <option value={50}>50%</option>
                      <option value={100}>100%</option>
                    </select>
                    <div class="text-xs text-gray-500 mt-1">
                      <i class="fas fa-info-circle mr-1"></i>
                      Discount applies only when sending to pharmacy (not included in PDF)
                    </div>
                  </div>

                  <div>
                    <label for="discountScope" class="block text-sm font-medium text-gray-700 mb-2">
                      <i class="fas fa-sliders-h mr-2 text-teal-600"></i>
                      Discount applies to
                    </label>
                    <select
                      id="discountScope"
                      bind:value={prescriptionDiscountScope}
                      class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                    >
                      <option value="consultation">Only Consultation (default)</option>
                      <option value="consultation_hospital">Consultation + Hospital</option>
                    </select>
                  </div>
                </div>
              {/if}
            </div>
            
            <!-- Prescription Actions -->
            <div class="mt-4 flex gap-3 justify-center">
              {#if !prescriptionsFinalized}
                <button 
                  class="inline-flex items-center px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 transition-colors duration-200 disabled:bg-gray-400 disabled:cursor-not-allowed"
                  on:click={onFinalizePrescription}
                  disabled={currentMedications.length === 0}
                  title="Finalize this prescription"
                >
                  <i class="fas fa-check mr-1"></i>Finalize Prescription
                </button>
              {:else}
                <button 
                  class="inline-flex items-center px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white text-sm font-medium rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2 transition-colors duration-200"
                  on:click={onShowPharmacyModal}
                  title="Send to pharmacy"
                >
                  <i class="fas fa-paper-plane mr-1"></i>Send to Pharmacy
                </button>
              {/if}
              
              <!-- Print Buttons - Only available after finalizing -->
              {#if prescriptionsFinalized && currentMedications.length > 0}
                <button 
                  class="inline-flex items-center px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 transition-colors duration-200"
                  on:click={onPrintPrescriptions}
                  title="Generate and download full prescription PDF"
                >
                  <i class="fas fa-file-pdf mr-1"></i>Print (Full)
                </button>
                {#if hasConnectedPharmacies}
                  {@const unavailableMedications = getUnavailableMedications()}
                  <button 
                    class="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors duration-200 disabled:bg-gray-400 disabled:cursor-not-allowed"
                    on:click={() => onPrintExternalPrescriptions && onPrintExternalPrescriptions(unavailableMedications)}
                    disabled={unavailableMedications.length === 0}
                    title={unavailableMedications.length === 0 ? 'All medications are available in connected pharmacies' : 'Generate PDF for external pharmacy'}
                  >
                    <i class="fas fa-print mr-1"></i>Print (External)
                  </button>
                {/if}
              {/if}
            </div>

            {#if prescriptionsFinalized && currentMedications.length > 0}
              <!-- Expected Price -->
              <div class="mt-4 text-center">
                <span class="text-sm font-semibold text-green-600">
                  Expected Price: {expectedPriceLoading ? 'Calculating...' : formatExpectedPrice(expectedPrice)}
                </span>
              </div>
            {/if}
          {:else}
            <div class="text-center text-gray-500 py-8">
              <i class="fas fa-pills text-4xl mb-3"></i>
              <p class="mb-2">No current prescriptions for today</p>
              <p class="text-sm text-gray-400 mb-1">Click the <span class="font-medium text-teal-600">"+ Add Drug"</span> button to start adding medications to this prescription.</p>
              <p class="text-sm text-gray-400">Or you can use <span class="font-medium text-teal-600">AI Analysis</span> to review interactions, allergies, and dosing risks.</p>
            </div>
          {/if}
          
        </div>
      </div>
    </div>
  
  <!-- Navigation Buttons -->
  <div class="mt-4 text-center">
    <button 
      class="inline-flex items-center px-4 py-2 border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 text-sm font-medium rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 transition-colors duration-200"
      on:click={onGoToPreviousTab}
      title="Go back to Diagnoses tab"
    >
      <i class="fas fa-arrow-left mr-2"></i>Back
    </button>
  </div>

<style>
  /* Component-specific styles - main responsive styles are in PatientDetails.svelte */
  .ai-analysis :global(h1),
  .ai-analysis :global(h2),
  .ai-analysis :global(h3) {
    font-weight: 700;
    color: #0f172a;
    margin-top: 0.75rem;
    margin-bottom: 0.5rem;
  }

  .ai-analysis :global(p) {
    line-height: 1.6;
    margin: 0.5rem 0;
  }

  .ai-analysis :global(ul),
  .ai-analysis :global(ol) {
    padding-left: 1.25rem;
    margin: 0.5rem 0 0.75rem;
  }

  .ai-analysis :global(li) {
    margin: 0.25rem 0;
  }

  .ai-analysis :global(strong) {
    color: #0f172a;
  }

  .ai-analysis-short {
    max-height: 220px;
    overflow-y: auto;
    scrollbar-gutter: stable;
  }

  .ai-analysis-short::-webkit-scrollbar {
    width: 8px;
  }

  .ai-analysis-short::-webkit-scrollbar-track {
    background: #e5e7eb;
    border-radius: 999px;
  }

  .ai-analysis-short::-webkit-scrollbar-thumb {
    background: #94a3b8;
    border-radius: 999px;
  }

  .ai-analysis-short::-webkit-scrollbar-thumb:hover {
    background: #64748b;
  }
</style>
