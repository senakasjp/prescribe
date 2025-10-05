<script>
  import { createEventDispatcher, onMount } from 'svelte'
  import drugDatabase from '../services/drugDatabase.js'
  import { notifySuccess, notifyInfo } from '../stores/notifications.js'
  
  export let visible = true
  export let editingMedication = null
  export let doctorId = null
  
  const dispatch = createEventDispatcher()
  
  let name = ''
  let dosage = ''
  let dosageUnit = 'mg'
  let route = ''
  let instructions = ''
  let frequency = ''
  let duration = ''
  let startDate = ''
  let endDate = ''
  let notes = ''
  let error = ''
  let loading = false
  
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
    // Force reset all variables
    name = ''
    dosage = ''
    dosageUnit = 'mg'
    route = ''
    instructions = ''
    frequency = ''
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
        name, dosage, instructions, frequency, duration, startDate, endDate, notes
      })
    }, 10)
  }
  
  // Populate form when editing (only once)
  $: if (editingMedication && !formInitialized) {
    name = editingMedication.name || ''
    
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
    duration = editingMedication.duration || ''
    startDate = editingMedication.startDate || ''
    endDate = editingMedication.endDate || ''
    notes = editingMedication.notes || ''
    formInitialized = true
  }
  
  // No reactive reset - only reset on mount to avoid conflicts
  
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
        name: name.trim(),
        dosage: dosage.trim() + dosageUnit,
        dosageUnit: dosageUnit,
        route: route.trim(),
        instructions: instructions.trim(),
        frequency,
        duration: duration.trim(),
        startDate: startDate || new Date().toISOString().split('T')[0], // Default to today if not provided
        endDate: endDate || null,
        notes: notes.trim()
      }
      
      // Add editing information if in edit mode
      if (editingMedication) {
        medicationData.id = editingMedication.id
        medicationData.isEdit = true
      }
      
      // Save to drug database for future autocomplete
      if (doctorId) {
        const existingDrug = drugDatabase.getDoctorDrugs(doctorId).find(drug => 
          drug.name === name.trim().toLowerCase()
        )
        
        drugDatabase.addDrug(doctorId, {
          name: name.trim(),
          dosage: dosage.trim() + dosageUnit,
          dosageUnit: dosageUnit,
          instructions: instructions.trim(),
          frequency,
          duration: duration.trim(),
          notes: notes.trim()
        })
        
        // Show notification
        if (existingDrug) {
          notifyInfo(`"${name.trim()}" updated in your drug database`)
        } else {
          notifySuccess(`"${name.trim()}" added to your drug database`)
        }
      }
      
      dispatch('medication-added', medicationData)
      
      // Reset form
      name = ''
      dosage = ''
      dosageUnit = 'mg'
      route = ''
      instructions = ''
      frequency = ''
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
        />
      </div>
      
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
        <div>
          <label for="medicationDosage" class="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Dosage <span class="text-red-500">*</span></label>
          <div class="flex">
            <input 
              type="text" 
              class="flex-1 px-2 sm:px-3 py-2 border border-gray-300 rounded-l-lg text-xs sm:text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 disabled:bg-gray-100 disabled:cursor-not-allowed" 
              id="medicationDosage" 
              bind:value={dosage}
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
              <option value="IM">IM (Intramuscular)</option>
              <option value="IV">IV (Intravenous)</option>
              <option value="SC">SC (Subcutaneous)</option>
              <option value="PO">PO (Oral)</option>
              <option value="Topical">Topical</option>
              <option value="Inhalation">Inhalation</option>
              <option value="Rectal">Rectal</option>
              <option value="Vaginal">Vaginal</option>
              <option value="Otic">Otic (Ear)</option>
              <option value="Ophthalmic">Ophthalmic (Eye)</option>
              <option value="Nasal">Nasal</option>
              <option value="Transdermal">Transdermal</option>
            </select>
            <input 
              type="text" 
              class="flex-1 px-2 sm:px-3 py-2 border border-gray-300 border-l-0 rounded-r-lg text-xs sm:text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 disabled:bg-gray-100 disabled:cursor-not-allowed" 
              placeholder="Or enter custom route"
              bind:value={route}
              disabled={loading}
            >
          </div>
        </div>
        <div>
          <label for="medicationFrequency" class="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Frequency <span class="text-red-500">*</span></label>
          <select 
            class="w-full px-2 sm:px-3 py-2 border border-gray-300 rounded-lg text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 disabled:bg-gray-100 disabled:cursor-not-allowed" 
            id="medicationFrequency" 
            bind:value={frequency}
            required
            disabled={loading}
          >
            <option value="">Select frequency</option>
            <option value="once daily">Once daily</option>
            <option value="twice daily">Twice daily</option>
            <option value="three times daily">Three times daily</option>
            <option value="four times daily">Four times daily</option>
            <option value="as needed">As needed</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
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
          <label for="medicationDuration" class="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Duration <span class="text-red-500">*</span></label>
          <input 
            type="text" 
            class="w-full px-2 sm:px-3 py-2 border border-gray-300 rounded-lg text-xs sm:text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 disabled:bg-gray-100 disabled:cursor-not-allowed" 
            id="medicationDuration" 
            bind:value={duration}
            disabled={loading}
            placeholder="e.g., 30 days, 3 months"
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
