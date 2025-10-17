<script>
  import { createEventDispatcher, onMount } from 'svelte'
  import drugDatabase from '../services/drugDatabase.js'
  import { pharmacyMedicationService } from '../services/pharmacyMedicationService.js'
  import { notifySuccess, notifyInfo } from '../stores/notifications.js'
  import { MEDICATION_FREQUENCIES } from '../utils/constants.js'
  
  export let visible = true
  export let editingMedication = null
  export let doctorId = null
  
  const dispatch = createEventDispatcher()
  
  let name = ''
  let genericName = '' // Generic name for display
  let dosage = ''
  let dosageUnit = 'mg'
  let route = 'PO'
  let instructions = ''
  let frequency = ''
  let prnAmount = '' // Amount for PRN medications
  let duration = ''
  let startDate = ''
  let endDate = ''
  let notes = ''
  let error = ''
  let loading = false

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
    route = 'PO' // Set default route
    instructions = ''
    frequency = ''
    prnAmount = ''
    duration = ''
    startDate = ''
    endDate = ''
    notes = ''
    error = ''
    formInitialized = false
    formKey++ // Increment key to force DrugAutocomplete reset
    
    // Force a small delay to ensure state updates
    setTimeout(() => {
      console.log('✅ MedicationForm reset complete - final state:', {
        name, genericName, dosage, instructions, frequency, duration, startDate, endDate, notes
      })
    }, 10)
  }
  
  // Populate form when editing (only once)
  $: if (editingMedication && !formInitialized) {
    name = editingMedication.name || ''
    genericName = editingMedication.genericName || ''
    
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
      displayName: d.displayName || d.name || d.brandName || d.genericName,
      brandName: d.brandName || d.name || '',
      genericName: d.genericName || '',
      strength: d.strength || d.dosage || '',
      source: 'local'
    }))

    // Inventory drugs
    const inventory = await pharmacyMedicationService.searchMedicationsFromPharmacies(doctorId, query, 20)
    const inventoryMapped = inventory.map(d => ({
      displayName: d.displayName || d.brandName || d.genericName,
      brandName: d.brandName || '',
      genericName: d.genericName || '',
      strength: d.strength || '',
      source: 'inventory',
      currentStock: d.currentStock || 0,
      packUnit: d.packUnit || '',
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
    
    // Set generic name
    genericName = s.genericName || ''
    
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
      if (!name || !dosage || !instructions || !frequency || !duration) {
        throw new Error('Please fill in all required fields')
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
        route: String(route ?? '').trim(),
        instructions: String(instructions ?? '').trim(),
        frequency,
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
          instructions: String(instructions ?? '').trim(),
          frequency,
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
        <label for="brandName" class="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Brand Name <span class="text-red-500">*</span></label>
        <input 
          type="text" 
          class="w-full px-2 sm:px-3 py-2 border border-gray-300 rounded-lg text-xs sm:text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 disabled:bg-gray-100 disabled:cursor-not-allowed" 
          id="brandName" 
          bind:value={name}
          required
          disabled={loading}
          placeholder="e.g., Glucophage, Prinivil"
          on:input={handleNameInput}
          on:keydown={handleNameKeydown}
          on:focus={searchNameSuggestions}
        />
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
                      Strength: {s.strength}
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
              {#each MEDICATION_FREQUENCIES as freq}
                <option value={freq}>{freq}</option>
              {/each}
            </select>
            {#if frequency && frequency.includes('PRN')}
              <input 
                type="text" 
                class="w-24 px-2 sm:px-3 py-2 border border-gray-300 rounded-lg text-xs sm:text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 disabled:bg-gray-100 disabled:cursor-not-allowed" 
                placeholder="Amount"
                bind:value={prnAmount}
                disabled={loading}
              >
            {/if}
          </div>
        </div>
      </div>
      
      <div>
        <label for="medicationInstructions" class="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Instructions <span class="text-red-500">*</span></label>
        <textarea 
          class="w-full px-2 sm:px-3 py-2 border border-gray-300 rounded-lg text-xs sm:text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 disabled:bg-gray-100 disabled:cursor-not-allowed" 
          id="medicationInstructions" 
          rows="2" 
          bind:value={instructions}
          required
          disabled={loading}
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
          <input 
            type="date" 
            class="w-full px-2 sm:px-3 py-2 border border-gray-300 rounded-lg text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 disabled:bg-gray-100 disabled:cursor-not-allowed" 
            id="medicationStartDate" 
            bind:value={startDate}
            disabled={loading}
          >
        </div>
        <div>
          <label for="medicationEndDate" class="block text-xs sm:text-sm font-medium text-gray-700 mb-1">End Date</label>
          <input 
            type="date" 
            class="w-full px-2 sm:px-3 py-2 border border-gray-300 rounded-lg text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 disabled:bg-gray-100 disabled:cursor-not-allowed" 
            id="medicationEndDate" 
            bind:value={endDate}
            disabled={loading}
          >
        </div>
      </div>
      
      <div>
        <label for="medicationNotes" class="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Additional Notes</label>
        <textarea 
          class="w-full px-2 sm:px-3 py-2 border border-gray-300 rounded-lg text-xs sm:text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 disabled:bg-gray-100 disabled:cursor-not-allowed" 
          id="medicationNotes" 
          rows="2" 
          bind:value={notes}
          disabled={loading}
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
