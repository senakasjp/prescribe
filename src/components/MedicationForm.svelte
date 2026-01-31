<script>
  import { createEventDispatcher, onMount } from 'svelte'
  import drugDatabase from '../services/drugDatabase.js'
  import { pharmacyMedicationService } from '../services/pharmacyMedicationService.js'
  import { notifySuccess, notifyInfo } from '../stores/notifications.js'
  import { MEDICATION_FREQUENCIES } from '../utils/constants.js'
  import openaiService from '../services/openaiService.js'
  import authService from '../services/doctor/doctorAuthService.js'
  import DateInput from './DateInput.svelte'

  export let visible = true
  export let editingMedication = null
  export let doctorId = null
  export let allowNonPharmacyDrugs = true
  export let excludePharmacyDrugs = false

  const dispatch = createEventDispatcher()

  let name = ''
  let genericName = '' // Generic name for display
  let dosage = ''
  let dosageUnit = 'mg'
  let dosageForm = ''
  let route = 'PO'
  let instructions = ''
  let frequency = ''
  let prnAmount = '' // Amount for PRN medications
  let timing = ''
  const TIMING_OPTIONS = [
    'Before meals (AC)',
    'After meals (PC)',
    'At bedtime (HS)',
    'Noon'
  ]
  $: frequencyOptions = MEDICATION_FREQUENCIES.filter(
    (freq) => !TIMING_OPTIONS.includes(freq),
  )
  let duration = ''
  let startDate = ''
  let endDate = ''
  let notes = ''
  let error = ''
  let loading = false
  let improvingBrandName = false
  let brandNameImproved = false
  let lastImprovedName = ''
  let improvingInstructions = false
  let instructionsImproved = false
  let lastImprovedInstructions = ''
  let improvingNotes = false
  let notesImproved = false
  let lastImprovedNotes = ''

  // Mapping for routes to their full display names
  const routeDisplayMap = {
    'IM': 'Intramuscular (IM)',
    'IV': 'Intravenous (IV)',
    'SC': 'Subcutaneous (SC)',
    'PO': 'Oral (PO)',
    'Topical': 'Topical',
    'Inhalation': 'Inhalation',
    'Rectal': 'Rectal',
    'Vaginal': 'Vaginal',
    'Otic': 'Ear (Otic)',
    'Ophthalmic': 'Eye (Ophthalmic)',
    'Nasal': 'Nasal',
    'Transdermal': 'Transdermal'
  }

  // Reactive statement to get the display value for the right input
  $: routeDisplay = route ? routeDisplayMap[route] || route : ''

  // Autofill suggestions state (inventory + local database)
  let nameSuggestions = []
  let showNameSuggestions = false
  let nameSelectedIndex = -1
  let nameSearchTimeout = null
  
  // Reset loading state when form is hidden
  $: if (!visible) {
    loading = false
    improvingBrandName = false
    brandNameImproved = false
    improvingInstructions = false
    instructionsImproved = false
    improvingNotes = false
    notesImproved = false
  }

  // Reset improved state only when the user edits after a successful correction
  $: if (!improvingBrandName && brandNameImproved && name !== lastImprovedName) {
    brandNameImproved = false
  }

  $: if (!improvingInstructions && instructionsImproved && instructions !== lastImprovedInstructions) {
    instructionsImproved = false
  }

  $: if (!improvingNotes && notesImproved && notes !== lastImprovedNotes) {
    notesImproved = false
  }
  
  // Track if form has been initialized for editing
  let formInitialized = false
  let formKey = 0
  
  // Function to reset form to empty state
  const resetForm = () => {
    console.log('🔄 Resetting MedicationForm to empty state')
    // Force reset all variables to empty strings
    name = ''
    genericName = ''
    dosage = ''
    dosageUnit = 'mg'
    dosageForm = ''
    route = 'PO' // Set default route
    instructions = ''
    frequency = ''
    prnAmount = ''
    timing = ''
    duration = ''
    startDate = ''
    endDate = ''
    notes = ''
    timing = ''
    error = ''
    formInitialized = false
    formKey++ // Increment key to force DrugAutocomplete reset
    
    // Force a small delay to ensure state updates
    setTimeout(() => {
      console.log('✅ MedicationForm reset complete - final state:', {
        name, genericName, dosage, dosageForm, instructions, frequency, duration, startDate, endDate, notes
      })
    }, 10)
  }
  
  // Populate form when editing (only once)
  $: if (editingMedication && !formInitialized) {
    name = editingMedication.name || ''
    genericName = editingMedication.genericName || ''
    dosageForm = editingMedication.dosageForm || editingMedication.form || ''
    
    // Parse dosage if it exists
    if (editingMedication.dosage) {
      // Try to extract number and unit from dosage string
      const dosageMatch = editingMedication.dosage.match(/^(\d+(?:\.\d+)?)([a-zA-Z]+)$/)
      if (dosageMatch) {
        dosage = dosageMatch[1]
        dosageUnit = dosageMatch[2]
      } else {
        dosage = editingMedication.dosage
        dosageUnit = editingMedication.dosageUnit || 'mg'
      }
    } else {
      dosage = ''
      dosageUnit = 'mg'
    }
    
    route = editingMedication.route || ''
    instructions = editingMedication.instructions || ''
    timing = editingMedication.timing || ''
    frequency = editingMedication.frequency || ''
    prnAmount = editingMedication.prnAmount || ''
    // Remove 'days' suffix if present for editing
    duration = editingMedication.duration ? editingMedication.duration.replace(/\s*days?$/i, '') : ''
    startDate = editingMedication.startDate || ''
    endDate = editingMedication.endDate || ''
    notes = editingMedication.notes || ''
    formInitialized = true
  }
  
  // No reactive reset - only reset on mount to avoid conflicts

  // Debounced search for brand name suggestions (local + connected pharmacies)
  const searchNameSuggestions = async () => {
    const query = String(name ?? '').trim()
    if (!doctorId || !query || query.length < 2) {
      nameSuggestions = []
      showNameSuggestions = false
      nameSelectedIndex = -1
      return
    }

    // Local drugs
    const local = drugDatabase.searchDrugs(doctorId, query).map(d => ({
      displayName: d.brandName || d.name || d.genericName,
      brandName: d.brandName || d.name || '',
      genericName: d.genericName || '',
      strength: d.strength || d.dosage || '',
      dosageForm: d.dosageForm || d.form || '',
      source: 'local'
    }))

    // Inventory drugs
    const inventory = await pharmacyMedicationService.searchMedicationsFromPharmacies(doctorId, query, 20)
    const inventoryMapped = inventory.map(d => ({
      displayName: d.brandName || d.drugName || d.displayName || d.genericName,
      brandName: d.brandName || '',
      genericName: d.genericName || '',
      strength: d.strength || '',
      source: 'inventory',
      currentStock: d.currentStock || 0,
      packUnit: d.packUnit || '',
      dosageForm: d.dosageForm || '',
      expiryDate: d.expiryDate || ''
    }))

    // Merge and de-dupe by brand+generic
    const combined = [...local]
    inventoryMapped.forEach(item => {
      const exists = combined.find(x =>
        (x.brandName || '').toLowerCase() === (item.brandName || '').toLowerCase() &&
        (x.genericName || '').toLowerCase() === (item.genericName || '').toLowerCase()
      )
      if (!exists) combined.push(item)
    })

    // Sort: exact startsWith first, then local before inventory, then alpha
    const q = query.toLowerCase()
    combined.sort((a, b) => {
      const aExact = (a.brandName || '').toLowerCase().startsWith(q) || (a.genericName || '').toLowerCase().startsWith(q) ? 1 : 0
      const bExact = (b.brandName || '').toLowerCase().startsWith(q) || (b.genericName || '').toLowerCase().startsWith(q) ? 1 : 0
      if (aExact !== bExact) return bExact - aExact
      if (a.source !== b.source) return a.source === 'local' ? -1 : 1
      return (a.displayName || '').localeCompare(b.displayName || '')
    })

    nameSuggestions = combined.slice(0, 20)
    showNameSuggestions = nameSuggestions.length > 0
    nameSelectedIndex = -1
  }

  const handleNameInput = () => {
    clearTimeout(nameSearchTimeout)
    nameSearchTimeout = setTimeout(searchNameSuggestions, 250)
  }

  const handleNameKeydown = (event) => {
    if (!showNameSuggestions || nameSuggestions.length === 0) return
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault()
        nameSelectedIndex = Math.min(nameSelectedIndex + 1, nameSuggestions.length - 1)
        break
      case 'ArrowUp':
        event.preventDefault()
        nameSelectedIndex = Math.max(nameSelectedIndex - 1, -1)
        break
      case 'Enter':
        if (nameSelectedIndex >= 0) {
          event.preventDefault()
          selectNameSuggestion(nameSuggestions[nameSelectedIndex])
        }
        break
      case 'Escape':
        showNameSuggestions = false
        nameSelectedIndex = -1
        break
    }
  }

  const selectNameSuggestion = (s) => {
    // Always use brandName if available, otherwise extract from displayName
    if (s.brandName) {
      name = s.brandName
    } else if (s.displayName) {
      // Extract brand name from displayName format "BrandName (GenericName)"
      const match = s.displayName.match(/^([^(]+)\s*\(/)
      name = match ? match[1].trim() : s.displayName
    } else {
      name = ''
    }
    
    // Set generic name and dosage form from selected drug
    genericName = s.genericName || ''
    dosageForm = s.dosageForm || s.form || ''

    // If the suggestion has a numeric strength like "500 mg", try to prefill dosage
    if (s.strength && !dosage) {
      const m = String(s.strength).match(/(\d+(?:\.\d+)?)/)
      if (m) {
        dosage = m[1]
      }
    }
    showNameSuggestions = false
    nameSelectedIndex = -1
  }
  
  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault()
    error = ''
    loading = true
    
    try {
      // Validate required fields
      if (!name || !dosage || !frequency || !duration) {
        throw new Error('Please fill in all required fields')
      }
      if (frequency && frequency.includes('PRN') && !String(prnAmount || '').trim()) {
        throw new Error('Please enter the PRN amount')
      }
      if (!timing) {
        throw new Error('Please select when to take')
      }

      const enforcePharmacyOnly = !allowNonPharmacyDrugs
      const enforceNonPharmacyOnly = excludePharmacyDrugs

      if (enforcePharmacyOnly || enforceNonPharmacyOnly) {
        if (!doctorId) {
          throw new Error('Doctor information is missing. Update prescription settings to continue.')
        }

        const pharmacyStock = await pharmacyMedicationService.getPharmacyStock(doctorId)
        if (!pharmacyStock || pharmacyStock.length === 0) {
          throw new Error('No connected pharmacy inventory found. Update prescription settings to continue.')
        }

        const normalizedMedName = String(name ?? '').toLowerCase().trim()
        const normalizedMedNames = Array.from(new Set([
          normalizedMedName,
          normalizedMedName.split('(')[0]?.trim() || '',
          normalizedMedName.replace(/\(.*\)/, '').trim()
        ])).filter(Boolean)

        const dosageText = String(dosage ?? '').trim() + String(dosageUnit ?? '').trim()
        const dosageMatch = dosageText.match(/^(\d+(?:\.\d+)?)([a-zA-Z]+)$/)

        const matchingStock = pharmacyStock.find(stock => {
          const stockName = stock.drugName?.toLowerCase().trim() || ''
          const stockGeneric = stock.genericName?.toLowerCase().trim() || ''
          const stockNames = [stockName, stockGeneric].filter(Boolean)

          const nameMatch = normalizedMedNames.some(medName =>
            stockNames.some(stockValue => stockValue && (stockValue.includes(medName) || medName.includes(stockValue)))
          )

          if (!dosageMatch) {
            return nameMatch
          }

          const [, strength, unit] = dosageMatch
          const stockStrength = String(stock.strength || '')
          const stockUnit = String(stock.strengthUnit || '')
          const strengthMatch = stockStrength === strength || stockStrength.includes(strength)
          const unitMatch = !stockUnit || stockUnit === unit || stockUnit.includes(unit)

          return nameMatch && strengthMatch && unitMatch
        })

        const isAvailable = !!(matchingStock && (parseInt(matchingStock.quantity || 0, 10) > 0))

        if (enforcePharmacyOnly && !isAvailable) {
          throw new Error('This drug is not available in connected pharmacy inventory. Update prescription settings to continue.')
        }

        if (enforceNonPharmacyOnly && isAvailable) {
          throw new Error('This drug is available in connected pharmacy inventory. Uncheck "Exclude own pharmacy drugs" to continue.')
        }
      }
      
      // Validate dates
      const startDateObj = startDate ? new Date(startDate) : new Date() // Default to today if no start date
      
      if (endDate) {
        const endDateObj = new Date(endDate)
        if (endDateObj <= startDateObj) {
          throw new Error('End date must be after start date')
        }
      }
      
      const medicationData = {
        name: String(name ?? '').trim(),
        genericName: String(genericName ?? '').trim(),
        dosage: String(dosage ?? '').trim() + dosageUnit,
        dosageUnit: dosageUnit,
        dosageForm: String(dosageForm ?? '').trim(),
        route: String(route ?? '').trim(),
        instructions: String(instructions ?? '').trim(),
        frequency,
        timing,
        prnAmount: frequency.includes('PRN') ? String(prnAmount ?? '').trim() : '', // Include PRN amount if frequency is PRN
        duration: String(duration ?? '').trim() + ' days',
        startDate: startDate || new Date().toISOString().split('T')[0], // Default to today if not provided
        endDate: endDate || null,
        notes: String(notes ?? '').trim()
      }
      
      // Add editing information if in edit mode
      if (editingMedication) {
        medicationData.id = editingMedication.id
        medicationData.isEdit = true
      }
      
      // Save to drug database for future autocomplete
      if (doctorId) {
        const existingDrug = drugDatabase.getDoctorDrugs(doctorId).find(drug => 
          drug.name === String(name ?? '').trim().toLowerCase()
        )
        
        drugDatabase.addDrug(doctorId, {
          name: String(name ?? '').trim(),
          brandName: String(name ?? '').trim(),
        genericName: String(genericName ?? '').trim(),
        dosage: String(dosage ?? '').trim() + dosageUnit,
        dosageUnit: dosageUnit,
        dosageForm: String(dosageForm ?? '').trim(),
        instructions: String(instructions ?? '').trim(),
        frequency,
        timing,
        duration: String(duration ?? '').trim() + ' days',
        notes: String(notes ?? '').trim()
        })
        
        // Show notification
        if (existingDrug) {
          notifyInfo(`"${String(name ?? '').trim()}" updated in your drug database`)
        } else {
          notifySuccess(`"${String(name ?? '').trim()}" added to your drug database`)
        }
      }
      
      dispatch('medication-added', medicationData)
      
      // Reset form
      name = ''
      genericName = ''
      dosage = ''
      dosageUnit = 'mg'
      dosageForm = ''
      route = 'PO' // Set default route
      instructions = ''
      frequency = ''
      prnAmount = ''
      duration = ''
      startDate = ''
      endDate = ''
      notes = ''
      
    } catch (err) {
      error = err.message
      console.error('Form validation error:', err)
    } finally {
      loading = false
    }
  }
  
  
  // Handle cancel
  const handleCancel = () => {
    dispatch('cancel')
  }

  const getDoctorIdForImprove = () => {
    const currentDoctor = authService.getCurrentDoctor()
    return doctorId || currentDoctor?.id || currentDoctor?.uid || 'default-user'
  }

  // Improve brand name with AI
  const improveBrandName = async () => {
    if (!name || !name.trim()) {
      error = 'Please enter a brand name to improve'
      return
    }

    try {
      improvingBrandName = true
      error = ''
      const originalName = name

      // Get doctor information for token tracking
      const resolvedDoctorId = getDoctorIdForImprove()

      // Call OpenAI service to improve text
      const result = await openaiService.improveText(name, resolvedDoctorId)

      // Update the brand name with improved text
      name = result.improvedText

      // Mark as improved to show visual feedback
      const normalizedOriginal = String(originalName ?? '').trim()
      const normalizedImproved = String(name ?? '').trim()
      brandNameImproved = normalizedImproved !== '' && normalizedImproved !== normalizedOriginal
      lastImprovedName = brandNameImproved ? normalizedImproved : ''

      // Dispatch event for token tracking
      dispatch('ai-usage-updated', {
        tokensUsed: result.tokensUsed,
        type: 'improveText'
      })

      console.log('✅ Brand name improved successfully')

    } catch (err) {
      console.error('❌ Error improving brand name:', err)
      error = err.message || 'Failed to improve brand name. Please try again.'
    } finally {
      improvingBrandName = false
    }
  }

  const improveInstructions = async () => {
    if (!instructions || !instructions.trim()) {
      error = 'Please enter instructions to improve'
      return
    }

    try {
      improvingInstructions = true
      error = ''
      const originalInstructions = instructions
      const resolvedDoctorId = getDoctorIdForImprove()

      const result = await openaiService.improveText(instructions, resolvedDoctorId)
      instructions = result.improvedText

      const normalizedOriginal = String(originalInstructions ?? '').trim()
      const normalizedImproved = String(instructions ?? '').trim()
      instructionsImproved = normalizedImproved !== '' && normalizedImproved !== normalizedOriginal
      lastImprovedInstructions = instructionsImproved ? normalizedImproved : ''

      dispatch('ai-usage-updated', {
        tokensUsed: result.tokensUsed,
        type: 'improveText'
      })
    } catch (err) {
      console.error('❌ Error improving instructions:', err)
      error = err.message || 'Failed to improve text. Please try again.'
    } finally {
      improvingInstructions = false
    }
  }

  const improveNotes = async () => {
    if (!notes || !notes.trim()) {
      error = 'Please enter notes to improve'
      return
    }

    try {
      improvingNotes = true
      error = ''
      const originalNotes = notes
      const resolvedDoctorId = getDoctorIdForImprove()

      const result = await openaiService.improveText(notes, resolvedDoctorId)
      notes = result.improvedText

      const normalizedOriginal = String(originalNotes ?? '').trim()
      const normalizedImproved = String(notes ?? '').trim()
      notesImproved = normalizedImproved !== '' && normalizedImproved !== normalizedOriginal
      lastImprovedNotes = notesImproved ? normalizedImproved : ''

      dispatch('ai-usage-updated', {
        tokensUsed: result.tokensUsed,
        type: 'improveText'
      })
    } catch (err) {
      console.error('❌ Error improving notes:', err)
      error = err.message || 'Failed to improve text. Please try again.'
    } finally {
      improvingNotes = false
    }
  }

  // Reset form when component mounts if not editing
  onMount(() => {
    console.log('🚀 MedicationForm mounted - checking if reset needed')
    if (!editingMedication) {
      console.log('🔄 New prescription - resetting to empty state')
      resetForm()
    } else {
      console.log('📝 Editing existing prescription - keeping data')
    }
  })
</script>

<div class="bg-white border-2 border-teal-200 rounded-lg shadow-sm mx-2 sm:mx-0">
  <div class="bg-teal-600 text-white px-3 sm:px-4 py-3 rounded-t-lg">
    <h6 class="text-base sm:text-lg font-semibold mb-0">
      <i class="fas fa-pills mr-2"></i>{editingMedication ? 'Edit Medication' : 'Add New Medication'}
    </h6>
  </div>
  <div class="p-3 sm:p-4">
    <form on:submit={handleSubmit} class="space-y-3 sm:space-y-4">
      <div>
        <label for="brandName" class="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
          Brand Name <span class="text-red-500">*</span>
          {#if brandNameImproved}
            <span class="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
              <i class="fas fa-check-circle mr-1"></i>
              AI Corrected
            </span>
          {/if}
        </label>
        <div class="relative">
          <input
            type="text"
            class="w-full px-2 sm:px-3 py-2 pr-28 border rounded-lg text-xs sm:text-sm placeholder-gray-500 focus:outline-none focus:ring-2 disabled:cursor-not-allowed transition-all duration-300 {brandNameImproved ? 'bg-green-50 border-green-300 text-green-700 focus:ring-green-500 focus:border-green-500' : 'border-gray-300 focus:ring-teal-500 focus:border-teal-500'} {loading || improvingBrandName ? 'bg-gray-100' : ''}"
            id="brandName"
            bind:value={name}
            required
            disabled={loading || improvingBrandName}
            placeholder="e.g., Glucophage, Prinivil"
            on:input={handleNameInput}
            on:keydown={handleNameKeydown}
            on:focus={searchNameSuggestions}
          />
          <button
            type="button"
            class="absolute top-1.5 right-1.5 inline-flex items-center px-2 py-1 bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white text-xs font-medium rounded focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:bg-gray-400 disabled:cursor-not-allowed transition-all duration-200 shadow-sm"
            on:click={improveBrandName}
            disabled={loading || improvingBrandName || !name}
            title="Correct spelling with AI"
          >
            {#if improvingBrandName}
              <svg class="animate-spin h-3 w-3 mr-1 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Fixing...
            {:else}
              <i class="fas fa-sparkles mr-1"></i>
              Fix Spelling
            {/if}
          </button>
        </div>
        {#if showNameSuggestions && nameSuggestions.length > 0}
          <div class="relative">
            <div class="absolute top-1 left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-56 overflow-y-auto">
              {#each nameSuggestions as s, idx}
                <button
                  type="button"
                  class="w-full px-3 py-2 text-left text-xs sm:text-sm hover:bg-teal-50 focus:bg-teal-50 border-b last:border-b-0 {nameSelectedIndex === idx ? 'bg-teal-50' : ''}"
                  on:click={() => selectNameSuggestion(s)}
                  on:mouseenter={() => nameSelectedIndex = idx}
                >
                  <div class="flex items-center justify-between">
                    <div class="text-gray-900 font-medium truncate">{s.displayName}</div>
                    <span class="ml-3 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium {s.source === 'local' ? 'bg-blue-100 text-blue-800' : 'bg-emerald-100 text-emerald-800'}">
                      <i class="fas {s.source === 'local' ? 'fa-database' : 'fa-store'} mr-1"></i>{s.source === 'local' ? 'Local' : 'Inventory'}
                    </span>
                  </div>
                  {#if s.strength}
                    <div class="text-[11px] text-gray-500 mt-1">
                      Strength: {s.strength}{#if s.dosageForm} • Form: {s.dosageForm}{/if}
                      {#if s.source === 'inventory' && s.currentStock !== undefined}
                        <span class="ml-1 text-blue-600 font-medium">({s.currentStock} {s.packUnit || 'units'})</span>
                      {/if}
                    </div>
                  {/if}
                </button>
              {/each}
            </div>
          </div>
        {/if}
      </div>
      
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
        <div>
          <label for="medicationDosage" class="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Dosage <span class="text-red-500">*</span></label>
          <div class="flex">
            <input 
              type="number" 
              class="flex-1 px-2 sm:px-3 py-2 border border-gray-300 rounded-l-lg text-xs sm:text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 disabled:bg-gray-100 disabled:cursor-not-allowed" 
              id="medicationDosage" 
              bind:value={dosage}
              min="0"
              step="0.1"
              required
              disabled={loading}
              placeholder="500"
            >
            <select 
              class="px-2 sm:px-3 py-2 border border-gray-300 border-l-0 rounded-r-lg text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 disabled:bg-gray-100 disabled:cursor-not-allowed" 
              id="dosageUnit" 
              bind:value={dosageUnit}
              disabled={loading}
            >
              <option value="mg">mg</option>
              <option value="g">g</option>
              <option value="ml">ml</option>
              <option value="l">l</option>
              <option value="units">units</option>
              <option value="mcg">mcg</option>
              <option value="tablets">tablets</option>
              <option value="pills">pills</option>
              <option value="capsules">capsules</option>
              <option value="drops">drops</option>
              <option value="patches">patches</option>
              <option value="injections">injections</option>
              <option value="sachets">sachets</option>
            </select>
          </div>
        </div>
        <div>
          <label for="medicationRoute" class="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Route of Administration</label>
          <div class="flex">
            <select 
              class="flex-1 px-2 sm:px-3 py-2 border border-gray-300 rounded-l-lg text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 disabled:bg-gray-100 disabled:cursor-not-allowed" 
              id="medicationRoute" 
              on:change={(e) => {
                if (e.target.value) {
                  route = e.target.value;
                }
              }}
              disabled={loading}
            >
              <option value="">Select route</option>
              <option value="IM">Intramuscular (IM)</option>
              <option value="IV">Intravenous (IV)</option>
              <option value="SC">Subcutaneous (SC)</option>
              <option value="PO">Oral (PO)</option>
              <option value="Topical">Topical</option>
              <option value="Inhalation">Inhalation</option>
              <option value="Rectal">Rectal</option>
              <option value="Vaginal">Vaginal</option>
              <option value="Otic">Ear (Otic)</option>
              <option value="Ophthalmic">Eye (Ophthalmic)</option>
              <option value="Nasal">Nasal</option>
              <option value="Transdermal">Transdermal</option>
            </select>
            <input 
              type="text" 
              class="flex-1 px-2 sm:px-3 py-2 border border-gray-300 border-l-0 rounded-r-lg text-xs sm:text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 disabled:bg-gray-100 disabled:cursor-not-allowed" 
              placeholder="Or enter custom route"
              bind:value={routeDisplay}
              disabled={loading}
            >
          </div>
        </div>
        <div>
          <label for="medicationDosageForm" class="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Dosage Form</label>
          <select
            class="w-full px-2 sm:px-3 py-2 border border-gray-300 rounded-lg text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
            id="medicationDosageForm"
            bind:value={dosageForm}
            disabled={loading}
          >
            <option value="">Select dosage form</option>
            <option value="Tablet">Tablet</option>
            <option value="Capsule">Capsule</option>
            <option value="Liquid">Liquid</option>
            <option value="Injection">Injection</option>
            <option value="Cream">Cream</option>
            <option value="Ointment">Ointment</option>
            <option value="Suppository">Suppository</option>
            <option value="Drops">Drops</option>
            <option value="Inhaler">Inhaler</option>
            <option value="Spray">Spray</option>
          </select>
        </div>
        <div>
          <label for="medicationFrequency" class="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Frequency <span class="text-red-500">*</span></label>
          <div class="flex gap-2">
            <select 
              class="flex-1 px-2 sm:px-3 py-2 border border-gray-300 rounded-lg text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 disabled:bg-gray-100 disabled:cursor-not-allowed" 
              id="medicationFrequency" 
              bind:value={frequency}
              required
              disabled={loading}
            >
              <option value="">Select frequency</option>
              {#each frequencyOptions as freq}
                <option value={freq}>{freq}</option>
              {/each}
            </select>
            {#if frequency && frequency.includes('PRN')}
              <div class="w-24">
                <label class="block text-[10px] sm:text-xs font-medium text-gray-700 mb-1">
                  Amount <span class="text-red-500">*</span>
                </label>
                <input 
                  type="text" 
                  class="w-full px-2 sm:px-3 py-2 border border-gray-300 rounded-lg text-xs sm:text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 disabled:bg-gray-100 disabled:cursor-not-allowed" 
                  placeholder="Amount"
                  bind:value={prnAmount}
                  required
                  aria-required="true"
                  disabled={loading}
                >
              </div>
            {/if}
          </div>
        </div>
      </div>
      
      <div>
        <label for="medicationTiming" class="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
          When to take <span class="text-red-500">*</span>
        </label>
        <select
          id="medicationTiming"
          bind:value={timing}
          class="w-full px-2 sm:px-3 py-2 border border-gray-300 rounded-lg text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
          required
          disabled={loading}
        >
          <option value="">Select timing</option>
          {#each TIMING_OPTIONS as option}
            <option value={option}>{option}</option>
          {/each}
        </select>
      </div>

      <div>
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-1">
          <label for="medicationInstructions" class="text-xs sm:text-sm font-medium text-gray-700">
            Instructions
            {#if instructionsImproved}
              <span class="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                <i class="fas fa-check-circle mr-1"></i>
                AI Improved
              </span>
            {/if}
          </label>
          <button
            type="button"
            class="inline-flex items-center px-3 py-1.5 bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white text-xs font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:bg-gray-400 disabled:cursor-not-allowed transition-all duration-200 shadow-sm"
            on:click={improveInstructions}
            disabled={loading || improvingInstructions || instructionsImproved || !instructions}
            title="Fix spelling and grammar with AI"
          >
            {#if improvingInstructions}
              <svg class="animate-spin h-3 w-3 mr-1.5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Improving...
            {:else}
              <i class="fas fa-sparkles mr-1.5"></i>
              Improve English AI
            {/if}
          </button>
        </div>
        <textarea 
          class="w-full px-2 sm:px-3 py-2 border rounded-lg text-xs sm:text-sm placeholder-gray-500 focus:outline-none focus:ring-2 disabled:bg-gray-100 disabled:cursor-not-allowed transition-all duration-300 {instructionsImproved ? 'bg-green-50 border-green-300 text-green-700 focus:ring-green-500 focus:border-green-500' : 'bg-white border-gray-300 focus:ring-teal-500 focus:border-teal-500'} {loading || improvingInstructions ? 'bg-gray-100' : ''}"
          id="medicationInstructions" 
          rows="2" 
          bind:value={instructions}
          disabled={loading || improvingInstructions}
          placeholder="e.g., Take with food, Take before bedtime"
        ></textarea>
      </div>
      
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        <div>
          <label for="medicationDuration" class="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Duration in days <span class="text-red-500">*</span></label>
          <input 
            type="number" 
            class="w-full px-2 sm:px-3 py-2 border border-gray-300 rounded-lg text-xs sm:text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 disabled:bg-gray-100 disabled:cursor-not-allowed" 
            id="medicationDuration" 
            bind:value={duration}
            min="1"
            disabled={loading}
            placeholder="e.g., 30"
          >
        </div>
        <div>
          <label for="medicationStartDate" class="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Start Date <span class="text-gray-500 text-xs">(Optional)</span></label>
          <DateInput type="date" lang="en-GB" placeholder="dd/mm/yyyy" 
            class="w-full px-2 sm:px-3 py-2 border border-gray-300 rounded-lg text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 disabled:bg-gray-100 disabled:cursor-not-allowed" 
            id="medicationStartDate" 
            bind:value={startDate}
            disabled={loading} />
        </div>
        <div>
          <label for="medicationEndDate" class="block text-xs sm:text-sm font-medium text-gray-700 mb-1">End Date</label>
          <DateInput type="date" lang="en-GB" placeholder="dd/mm/yyyy" 
            class="w-full px-2 sm:px-3 py-2 border border-gray-300 rounded-lg text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 disabled:bg-gray-100 disabled:cursor-not-allowed" 
            id="medicationEndDate" 
            bind:value={endDate}
            disabled={loading} />
        </div>
      </div>
      
      <div>
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-1">
          <label for="medicationNotes" class="text-xs sm:text-sm font-medium text-gray-700">
            Additional Notes
            {#if notesImproved}
              <span class="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                <i class="fas fa-check-circle mr-1"></i>
                AI Improved
              </span>
            {/if}
          </label>
          <button
            type="button"
            class="inline-flex items-center px-3 py-1.5 bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white text-xs font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:bg-gray-400 disabled:cursor-not-allowed transition-all duration-200 shadow-sm"
            on:click={improveNotes}
            disabled={loading || improvingNotes || notesImproved || !notes}
            title="Fix spelling and grammar with AI"
          >
            {#if improvingNotes}
              <svg class="animate-spin h-3 w-3 mr-1.5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Improving...
            {:else}
              <i class="fas fa-sparkles mr-1.5"></i>
              Improve English AI
            {/if}
          </button>
        </div>
        <textarea 
          class="w-full px-2 sm:px-3 py-2 border rounded-lg text-xs sm:text-sm placeholder-gray-500 focus:outline-none focus:ring-2 disabled:bg-gray-100 disabled:cursor-not-allowed transition-all duration-300 {notesImproved ? 'bg-green-50 border-green-300 text-green-700 focus:ring-green-500 focus:border-green-500' : 'bg-white border-gray-300 focus:ring-teal-500 focus:border-teal-500'} {loading || improvingNotes ? 'bg-gray-100' : ''}"
          id="medicationNotes" 
          rows="2" 
          bind:value={notes}
          disabled={loading || improvingNotes}
          placeholder="Any additional notes about the medication"
        ></textarea>
      </div>
      
      {#if error}
        <div class="bg-red-50 border border-red-200 rounded-lg p-2 sm:p-3" role="alert">
          <i class="fas fa-exclamation-triangle text-red-500 mr-2"></i>
          <span class="text-xs sm:text-sm text-red-700">{error}</span>
        </div>
      {/if}
      
      <div class="flex flex-col sm:flex-row gap-2 sm:gap-3">
        <button 
          type="submit" 
          class="flex-1 text-white bg-teal-600 hover:bg-teal-700 focus:ring-4 focus:outline-none focus:ring-teal-300 font-medium rounded-lg text-xs sm:text-sm px-3 sm:px-5 py-2 sm:py-2.5 text-center dark:bg-teal-600 dark:hover:bg-teal-700 dark:focus:ring-teal-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center" 
          disabled={loading}
        >
          {#if loading}
            <svg class="animate-spin -ml-1 mr-2 h-3 w-3 sm:h-4 sm:w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          {/if}
          <i class="fas fa-save mr-1"></i>Save Medication
        </button>
        <button 
          type="button" 
          class="flex-1 py-2 sm:py-2.5 px-3 sm:px-5 text-xs sm:text-sm font-medium text-gray-900 focus:outline-none bg-white rounded-lg border border-gray-200 hover:bg-gray-100 hover:text-blue-700 focus:z-10 focus:ring-4 focus:ring-gray-100 dark:focus:ring-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-600 dark:hover:text-white dark:hover:bg-gray-700 transition-all duration-200 flex items-center justify-center" 
          on:click={handleCancel}
          disabled={loading}
        >
          <i class="fas fa-times mr-1"></i>Cancel
        </button>
      </div>
    </form>
  </div>
</div>

<style>
  /* Minimal custom styles for MedicationForm component */
  /* All styling is now handled by Tailwind CSS utility classes */
</style>
