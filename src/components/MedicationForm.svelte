<script>
  import { createEventDispatcher, onMount } from 'svelte'
  import DrugAutocomplete from './DrugAutocomplete.svelte'
  import drugDatabase from '../services/drugDatabase.js'
  import { notifySuccess, notifyInfo } from '../stores/notifications.js'
  
  export let visible = true
  export let editingMedication = null
  export let doctorId = null
  
  const dispatch = createEventDispatcher()
  
  let name = ''
  let dosage = ''
  let dosageUnit = 'mg'
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
  
  // Handle drug selection from autocomplete
  const handleDrugSelect = (drug) => {
    name = drug.displayName
    // Only auto-fill other fields when editing an existing prescription
    // For new prescriptions, only fill the name field
    if (editingMedication) {
      // Parse dosage if it exists
      if (drug.dosage) {
        // Try to extract number and unit from dosage string
        const dosageMatch = drug.dosage.match(/^(\d+(?:\.\d+)?)([a-zA-Z]+)$/)
        if (dosageMatch) {
          dosage = dosageMatch[1]
          dosageUnit = dosageMatch[2]
        } else {
          dosage = drug.dosage
          dosageUnit = 'mg' // default
        }
      }
      instructions = drug.instructions || instructions
      frequency = drug.frequency || frequency
      duration = drug.duration || duration
      notes = drug.notes || notes
    }
    
    // Show notification
    notifyInfo(`"${drug.displayName}" selected`)
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

<div class="bg-white border-2 border-teal-200 rounded-lg shadow-sm">
  <div class="bg-teal-600 text-white px-4 py-3 rounded-t-lg">
    <h6 class="text-lg font-semibold mb-0">
      <i class="fas fa-pills mr-2"></i>{editingMedication ? 'Edit Medication' : 'Add New Medication'}
    </h6>
  </div>
  <div class="p-4">
    <form on:submit={handleSubmit} class="space-y-4">
      <div>
        <label for="medicationName" class="block text-sm font-medium text-gray-700 mb-1">Medication Name <span class="text-red-500">*</span></label>
        <DrugAutocomplete 
          bind:value={name}
          placeholder="e.g., Metformin, Lisinopril"
          {doctorId}
          onDrugSelect={handleDrugSelect}
          disabled={loading}
        />
      </div>
      
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label for="medicationDosage" class="block text-sm font-medium text-gray-700 mb-1">Dosage <span class="text-red-500">*</span></label>
          <div class="flex">
            <input 
              type="text" 
              class="flex-1 px-3 py-2 border border-gray-300 rounded-l-lg text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 disabled:bg-gray-100 disabled:cursor-not-allowed" 
              id="medicationDosage" 
              bind:value={dosage}
              required
              disabled={loading}
              placeholder="500"
            >
            <select 
              class="px-3 py-2 border border-gray-300 border-l-0 rounded-r-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 disabled:bg-gray-100 disabled:cursor-not-allowed" 
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
          <label for="medicationFrequency" class="block text-sm font-medium text-gray-700 mb-1">Frequency <span class="text-red-500">*</span></label>
          <select 
            class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 disabled:bg-gray-100 disabled:cursor-not-allowed" 
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
        <label for="medicationInstructions" class="block text-sm font-medium text-gray-700 mb-1">Instructions <span class="text-red-500">*</span></label>
        <textarea 
          class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 disabled:bg-gray-100 disabled:cursor-not-allowed" 
          id="medicationInstructions" 
          rows="2" 
          bind:value={instructions}
          required
          disabled={loading}
          placeholder="e.g., Take with food, Take before bedtime"
        ></textarea>
      </div>
      
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div>
          <label for="medicationDuration" class="block text-sm font-medium text-gray-700 mb-1">Duration <span class="text-red-500">*</span></label>
          <input 
            type="text" 
            class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 disabled:bg-gray-100 disabled:cursor-not-allowed" 
            id="medicationDuration" 
            bind:value={duration}
            disabled={loading}
            placeholder="e.g., 30 days, 3 months"
          >
        </div>
        <div>
          <label for="medicationStartDate" class="block text-sm font-medium text-gray-700 mb-1">Start Date <span class="text-gray-500 text-xs">(Optional)</span></label>
          <input 
            type="date" 
            class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 disabled:bg-gray-100 disabled:cursor-not-allowed" 
            id="medicationStartDate" 
            bind:value={startDate}
            disabled={loading}
          >
        </div>
        <div>
          <label for="medicationEndDate" class="block text-sm font-medium text-gray-700 mb-1">End Date</label>
          <input 
            type="date" 
            class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 disabled:bg-gray-100 disabled:cursor-not-allowed" 
            id="medicationEndDate" 
            bind:value={endDate}
            disabled={loading}
          >
        </div>
      </div>
      
      <div>
        <label for="medicationNotes" class="block text-sm font-medium text-gray-700 mb-1">Additional Notes</label>
        <textarea 
          class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 disabled:bg-gray-100 disabled:cursor-not-allowed" 
          id="medicationNotes" 
          rows="2" 
          bind:value={notes}
          disabled={loading}
          placeholder="Any additional notes about the medication"
        ></textarea>
      </div>
      
      {#if error}
        <div class="bg-red-50 border border-red-200 rounded-lg p-3" role="alert">
          <i class="fas fa-exclamation-triangle text-red-500 mr-2"></i>
          <span class="text-sm text-red-700">{error}</span>
        </div>
      {/if}
      
      <div class="flex flex-col sm:flex-row gap-3">
        <button 
          type="submit" 
          class="flex-1 bg-teal-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center" 
          disabled={loading}
        >
          {#if loading}
            <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          {/if}
          <i class="fas fa-save mr-1"></i>Save Medication
        </button>
        <button 
          type="button" 
          class="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200 disabled:bg-gray-100 disabled:cursor-not-allowed flex items-center justify-center" 
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
