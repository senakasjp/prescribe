<script>
  import PatientForms from './PatientForms.svelte'
  import { pharmacyMedicationService } from '../services/pharmacyMedicationService.js'
  import firebaseStorage from '../services/firebaseStorage.js'
  import chargeCalculationService from '../services/pharmacist/chargeCalculationService.js'
  
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
  export let symptoms
  export let openaiService
  export let onNewPrescription
  export let onAddDrug
  export let onPrintPrescriptions
  export let onPrintExternalPrescriptions
  export let prescriptionNotes = ''
  export let prescriptionDiscount = 0 // New discount field
  export let prescriptionProcedures = []
  export let excludeConsultationCharge = false
  export let currentUserEmail = null
  
  // Debug AI suggestions
  $: console.log('🔍 PrescriptionsTab - showAIDrugSuggestions:', showAIDrugSuggestions)
  $: console.log('🔍 PrescriptionsTab - aiDrugSuggestions:', aiDrugSuggestions)
  $: console.log('🔍 PrescriptionsTab - aiDrugSuggestions.length:', aiDrugSuggestions?.length)
  
  // Pharmacy stock availability
  let pharmacyStock = []
  let stockLoading = false
  let resolvedDoctorIdentifier = null
  let connectedPharmacyIds = []
  let hasConnectedPharmacies = false
  let doctorProfile = null
  let doctorCurrency = 'USD'
  let expectedPrice = null

  const procedureOptions = [
    'C&D- type -A',
    'C&D-type -B',
    'C&D-type-C',
    'C&D-type-D',
    'Suturing- type-A',
    'Suturing- type-B',
    'Suturing- type-C',
    'Suturing- type-D',
    'Nebulization - Ipra.0.25ml+N. saline2ml',
    'Nebulization - sal 0. 5ml+Ipra 0. 5ml+N. Saline 3ml',
    'Nebulization -sal1ml+Ipra1ml+N. Saline2ml',
    'Nebulization Ipra1ml+N. Saline3ml',
    'Nebulization - pulmicort(Budesonide)',
    'catheterization',
    'IV drip Saline/Dextrose'
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

      doctorProfile = doctorData
      doctorCurrency = doctorData?.currency || 'USD'
    } catch (error) {
      console.error('❌ Error loading doctor profile for expected price:', error)
      doctorProfile = null
      doctorCurrency = 'USD'
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

    if (!medication?.frequency || !medication?.duration) {
      return 0
    }

    const durationMatch = medication.duration.match(/(\d+)\s*days?/i)
    if (!durationMatch) {
      return 0
    }
    const days = parseInt(durationMatch[1], 10)

    let dailyFrequency = 0
    const frequency = medication.frequency

    if (frequency.includes('Once daily') || frequency.includes('(OD)')) {
      dailyFrequency = 1
    } else if (frequency.includes('Twice daily') || frequency.includes('(BD)')) {
      dailyFrequency = 2
    } else if (frequency.includes('Three times daily') || frequency.includes('(TDS)')) {
      dailyFrequency = 3
    } else if (frequency.includes('Four times daily') || frequency.includes('(QDS)')) {
      dailyFrequency = 4
    } else if (frequency.includes('Every 4 hours') || frequency.includes('(Q4H)')) {
      dailyFrequency = 6
    } else if (frequency.includes('Every 6 hours') || frequency.includes('(Q6H)')) {
      dailyFrequency = 4
    } else if (frequency.includes('Every 8 hours') || frequency.includes('(Q8H)')) {
      dailyFrequency = 3
    } else if (frequency.includes('Every 12 hours') || frequency.includes('(Q12H)')) {
      dailyFrequency = 2
    } else if (frequency.includes('Weekly')) {
      dailyFrequency = 1 / 7
    } else if (frequency.includes('Monthly')) {
      dailyFrequency = 1 / 30
    } else if (frequency.includes('Before meals') || frequency.includes('(AC)')) {
      dailyFrequency = 3
    } else if (frequency.includes('After meals') || frequency.includes('(PC)')) {
      dailyFrequency = 3
    } else if (frequency.includes('At bedtime') || frequency.includes('(HS)')) {
      dailyFrequency = 1
    }

    const totalAmount = Math.ceil(dailyFrequency * days)
    return totalAmount > 0 ? totalAmount : 0
  }

  const buildExpectedInventoryItems = () => {
    return (pharmacyStock || []).map(item => {
      const rawItem = item.rawItem || {}
      return {
        id: rawItem.id || item.inventoryItemId || item.id || null,
        brandName: rawItem.brandName || item.drugName || '',
        genericName: rawItem.genericName || item.genericName || '',
        drugName: rawItem.drugName || item.drugName || '',
        currentStock: rawItem.currentStock ?? item.quantity ?? 0,
        sellingPrice: rawItem.sellingPrice ?? rawItem.costPrice ?? rawItem.unitCost ?? null,
        expiryDate: rawItem.expiryDate || item.expiryDate || '',
        packUnit: rawItem.packUnit || item.packUnit || '',
        batches: rawItem.batches || []
      }
    })
  }

  const calculateExpectedPrice = () => {
    if (!currentPrescription || !currentMedications || currentMedications.length === 0) {
      return null
    }

    if (!doctorProfile) {
      return null
    }

    const consultationCharge = excludeConsultationCharge ? 0 : parseFloat(doctorProfile?.consultationCharge || 0)
    const hospitalCharge = parseFloat(doctorProfile?.hospitalCharge || 0)

    const procedurePricingList = doctorProfile?.templateSettings?.procedurePricing || []
    const procedurePricingMap = {}
    if (Array.isArray(procedurePricingList)) {
      procedurePricingList.forEach(item => {
        if (item?.name) {
          const parsed = Number(item.price)
          procedurePricingMap[item.name] = Number.isFinite(parsed) ? parsed : 0
        }
      })
    }

    const selectedProcedures = Array.isArray(prescriptionProcedures) ? prescriptionProcedures : []
    const procedureTotal = selectedProcedures.reduce((sum, name) => sum + (procedurePricingMap[name] || 0), 0)

    const doctorCharges = consultationCharge + hospitalCharge + procedureTotal
    const resolvedDiscount = Number.isFinite(Number(prescriptionDiscount))
      ? Number(prescriptionDiscount)
      : Number.isFinite(Number(currentPrescription?.discount))
        ? Number(currentPrescription.discount)
        : 0
    const discountPercentage = resolvedDiscount
    const discountMultiplier = 1 - (discountPercentage / 100)
    const discountedDoctorCharges = doctorCharges * discountMultiplier

    const inventoryItems = buildExpectedInventoryItems()
    let drugTotal = 0

    currentMedications.forEach(medication => {
      const quantity = calculateMedicationQuantity(medication)
      if (!quantity || quantity <= 0) {
        return
      }

      const sources = chargeCalculationService.buildInventoryPricingSources(medication, inventoryItems, null)
      if (!sources || sources.length === 0) {
        return
      }

      const allocation = chargeCalculationService.allocateQuantityAcrossSources(quantity, sources)
      if (allocation?.totalCost) {
        drugTotal += allocation.totalCost
      }
    })

    return discountedDoctorCharges + drugTotal
  }

  const formatExpectedPrice = (amount) => {
    if (!Number.isFinite(amount)) {
      return '--'
    }
    if (doctorCurrency === 'LKR') {
      return `Rs ${amount.toFixed(2)}`
    }
    try {
      return new Intl.NumberFormat('en-US', { style: 'currency', currency: doctorCurrency || 'USD' }).format(amount)
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

  $: expectedPrice = calculateExpectedPrice()
  
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
          
          <!-- AI Drug Suggestions Button -->
          <button 
              class="text-white bg-purple-600 hover:bg-purple-700 focus:ring-4 focus:outline-none focus:ring-purple-300 font-medium rounded-lg text-sm px-3 py-1 text-center dark:bg-purple-600 dark:hover:bg-purple-700 dark:focus:ring-purple-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200" 
              on:click={onGenerateAIDrugSuggestions}
              disabled={loadingAIDrugSuggestions || !symptoms || symptoms.length === 0 || !openaiService.isConfigured() || !currentPrescription}
              title={!currentPrescription ? "Create a prescription first" : (!symptoms || symptoms.length === 0) ? "Add symptoms first" : "Get AI-assisted drug suggestions based on symptoms"}
          >
            {#if loadingAIDrugSuggestions}
              <svg class="animate-spin -ml-1 mr-1 h-3 w-3 text-white inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Generating...
            {:else}
              <i class="fas fa-brain mr-1 text-red-600"></i>AI Suggestions
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
          
          <!-- AI Suggestions Section - Always visible when available -->
          {#if showAIDrugSuggestions && aiDrugSuggestions.length > 0}
            <div class="mt-4 border-t border-gray-200 pt-4">
              <div class="flex justify-between items-center mb-4">
                <h6 class="text-lg font-semibold text-gray-700 mb-0">
                  <i class="fas fa-brain mr-2 text-red-600"></i>
                  AI Drug Suggestions ({aiDrugSuggestions.length})
                </h6>
              </div>
              <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {#each aiDrugSuggestions as suggestion, index}
                  <div class="bg-white border border-gray-200 rounded-lg shadow-sm">
                    <div class="p-3">
                      <div class="flex justify-between items-start mb-2">
                        <h6 class="text-sm font-semibold text-gray-700 mb-0">{suggestion.name}</h6>
                        <div class="flex gap-1">
                          <button 
                            class="inline-flex items-center px-2 py-1 bg-teal-600 hover:bg-teal-700 text-white text-xs font-medium rounded focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 transition-colors duration-200 disabled:bg-gray-400 disabled:cursor-not-allowed"
                            on:click={() => onAddAISuggestedDrug(suggestion, index)}
                            disabled={!currentPrescription}
                            title="Add to prescription"
                          >
                            <i class="fas fa-plus"></i>
                          </button>
                          <button 
                            class="inline-flex items-center px-2 py-1 border border-red-300 text-red-700 bg-white hover:bg-red-50 text-xs font-medium rounded focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors duration-200"
                            on:click={() => onRemoveAISuggestedDrug(index)}
                            title="Remove suggestion"
                          >
                            <i class="fas fa-times"></i>
                          </button>
                        </div>
                      </div>
                      <div class="text-gray-500 text-sm mb-2">
                        <span class="font-medium">Dosage:</span> {suggestion.dosage} • <span class="font-medium">Frequency:</span> {suggestion.frequency}
                      </div>
                      {#if suggestion.reason}
                        <div class="text-gray-700 text-sm">
                          <i class="fas fa-lightbulb mr-1"></i>
                          <span class="font-medium">Reason:</span> {suggestion.reason}
                        </div>
                      {/if}
                    </div>
                  </div>
                {/each}
              </div>
            </div>
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
                      {medication.dosage} • {medication.frequency} • {medication.duration}
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

          <!-- Exclude Consultation Charge -->
          <div class="mt-2">
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

          <!-- Procedures / Treatments -->
          <div class="mt-4">
            <label class="block text-sm font-medium text-gray-700 mb-2">
              <i class="fas fa-check-square mr-1"></i>Procedures / Treatments
            </label>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
              {#each procedureOptions as option}
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
              {/each}
            </div>
            {#if !currentPrescription}
              <div class="text-xs text-gray-500 mt-2">
                <i class="fas fa-info-circle mr-1"></i>
                Create a new prescription to select procedures.
              </div>
            {/if}
          </div>

          {#if currentMedications && currentMedications.length > 0}
            <!-- Prescription Notes -->
            <div class="mt-4">
              <label for="prescriptionNotes" class="block text-sm font-medium text-gray-700 mb-2">
                <i class="fas fa-sticky-note mr-1"></i>Prescription Notes
              </label>
              <textarea
                id="prescriptionNotes"
                bind:value={prescriptionNotes}
                rows="3"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                placeholder="Additional instructions or notes for the prescription..."
              ></textarea>
            </div>
            
            <!-- Discount Field -->
            <div class="mt-4">
              <label for="prescriptionDiscount" class="block text-sm font-medium text-gray-700 mb-2">
                <i class="fas fa-percentage mr-2 text-teal-600"></i>
                Discount (for pharmacy use only)
              </label>
              <select
                id="prescriptionDiscount"
                bind:value={prescriptionDiscount}
                class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
              >
                <option value={0}>0% - No Discount</option>
                <option value={5}>5%</option>
                <option value={10}>10%</option>
                <option value={15}>15%</option>
                <option value={20}>20%</option>
                <option value={25}>25%</option>
                <option value={30}>30%</option>
                <option value={35}>35%</option>
                <option value={40}>40%</option>
                <option value={45}>45%</option>
                <option value={50}>50%</option>
                <option value={55}>55%</option>
                <option value={60}>60%</option>
                <option value={65}>65%</option>
                <option value={70}>70%</option>
                <option value={75}>75%</option>
                <option value={80}>80%</option>
                <option value={85}>85%</option>
                <option value={90}>90%</option>
                <option value={95}>95%</option>
                <option value={100}>100%</option>
              </select>
              <div class="text-xs text-gray-500 mt-1">
                <i class="fas fa-info-circle mr-1"></i>
                Discount applies only when sending to pharmacy (not included in PDF)
              </div>
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
                  Expected Price: {formatExpectedPrice(expectedPrice)}
                </span>
              </div>
            {/if}
          {:else}
            <div class="text-center text-gray-500 py-8">
              <i class="fas fa-pills text-4xl mb-3"></i>
              <p class="mb-2">No current prescriptions for today</p>
              <p class="text-sm text-gray-400 mb-1">Click the <span class="font-medium text-teal-600">"+ Add Drug"</span> button to start adding medications to this prescription.</p>
              <p class="text-sm text-gray-400">Or you can use <span class="font-medium text-teal-600">AI suggestions</span> to get AI recommendations based on symptoms.</p>
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
</style>
