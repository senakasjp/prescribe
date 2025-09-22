<script>
  import { createEventDispatcher } from 'svelte'
  import ThreeDots from './ThreeDots.svelte'
  
  export let visible = true
  export let editingMedication = null // Medication data when editing
  
  const dispatch = createEventDispatcher()
  
  let medicationName = ''
  let dosage = ''
  let frequency = ''
  let startDate = ''
  let notes = ''
  let error = ''
  let loading = false
  
  // Reset loading state when form is hidden
  $: if (!visible) {
    loading = false
  }
  
  // Populate form when editing
  $: if (editingMedication) {
    medicationName = editingMedication.medicationName || ''
    dosage = editingMedication.dosage || ''
    frequency = editingMedication.frequency || ''
    startDate = editingMedication.startDate || ''
    notes = editingMedication.notes || ''
  }
  
  // Reset form when not editing
  $: if (!editingMedication && visible) {
    medicationName = ''
    dosage = ''
    frequency = ''
    startDate = ''
    notes = ''
    error = ''
  }
  
  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault()
    error = ''
    loading = true
    
    try {
      // Validate required fields
      if (!medicationName.trim() || !dosage.trim() || !frequency.trim()) {
        throw new Error('Please fill in medication name, dosage, and frequency')
      }
      
      // Validate start date
      if (startDate) {
        const startDateObj = new Date(startDate)
        const today = new Date()
        if (startDateObj > today) {
          throw new Error('Start date cannot be in the future')
        }
      }
      
      const longTermMedicationData = {
        medicationName: medicationName.trim(),
        dosage: dosage.trim(),
        frequency: frequency.trim(),
        startDate: startDate || '',
        notes: notes.trim()
      }
      
      if (editingMedication) {
        // Editing existing medication
        dispatch('long-term-medication-updated', {
          id: editingMedication.id,
          data: longTermMedicationData
        })
      } else {
        // Adding new medication
        dispatch('long-term-medication-added', longTermMedicationData)
      }
      
      // Reset form
      medicationName = ''
      dosage = ''
      frequency = ''
      startDate = ''
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
</script>

<div class="bg-white border-2 border-blue-200 rounded-lg shadow-sm">
  <div class="bg-blue-600 text-white px-4 py-3 rounded-t-lg">
    <h6 class="text-lg font-semibold mb-0">
      <i class="fas fa-pills mr-2"></i>{editingMedication ? 'Edit Long-Term Medication' : 'Add Long-Term Medication'}
    </h6>
  </div>
  <div class="p-4">
    <form on:submit={handleSubmit}>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div class="mb-4">
          <label for="medicationName" class="block text-sm font-medium text-gray-700 mb-1">
            <i class="fas fa-capsules mr-1"></i>Medication Name *
          </label>
          <input 
            type="text" 
            class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed" 
            id="medicationName" 
            bind:value={medicationName}
            required
            disabled={loading}
            placeholder="e.g., Lisinopril, Metformin, Aspirin"
          >
        </div>
        <div class="mb-4">
          <label for="dosage" class="block text-sm font-medium text-gray-700 mb-1">
            <i class="fas fa-weight mr-1"></i>Dosage *
          </label>
          <input 
            type="text" 
            class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed" 
            id="dosage" 
            bind:value={dosage}
            required
            disabled={loading}
            placeholder="e.g., 10mg, 500mg, 81mg"
            >
          </div>
        </div>
      </div>
      
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div class="mb-4">
          <label for="frequency" class="block text-sm font-medium text-gray-700 mb-1">
            <i class="fas fa-clock mr-1"></i>Frequency *
          </label>
          <select 
            class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed" 
            id="frequency" 
            bind:value={frequency}
            required
            disabled={loading}
          >
            <option value="">Select Frequency</option>
            <option value="Once daily">Once daily</option>
            <option value="Twice daily">Twice daily</option>
            <option value="Three times daily">Three times daily</option>
            <option value="Four times daily">Four times daily</option>
            <option value="As needed">As needed</option>
            <option value="Weekly">Weekly</option>
            <option value="Monthly">Monthly</option>
            <option value="Other">Other</option>
          </select>
        </div>
        <div class="mb-4">
          <label for="startDate" class="block text-sm font-medium text-gray-700 mb-1">
            <i class="fas fa-calendar mr-1"></i>Start Date
          </label>
          <input 
            type="date" 
            class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed" 
            id="startDate" 
            bind:value={startDate}
            disabled={loading}
          >
        </div>
      </div>
      
      <div class="mb-4">
        <label for="notes" class="block text-sm font-medium text-gray-700 mb-1">
          <i class="fas fa-sticky-note mr-1"></i>Additional Notes
        </label>
        <textarea 
          class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed" 
          id="notes" 
          rows="3" 
          bind:value={notes}
          disabled={loading}
          placeholder="Any additional notes about this medication (side effects, instructions, etc.)"
        ></textarea>
      </div>
      
      {#if error}
        <div class="bg-red-50 border border-red-200 rounded-lg p-3 mb-4" role="alert">
          <i class="fas fa-exclamation-triangle mr-2"></i>{error}
        </div>
      {/if}
      
      <div class="flex flex-col sm:flex-row gap-3">
        <button 
          type="submit" 
          class="flex-1 inline-flex items-center justify-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors duration-200" 
          disabled={loading}
        >
          {#if loading}
            <ThreeDots size="small" color="white" />
          {/if}
          <i class="fas fa-save mr-1"></i>{editingMedication ? 'Update Medication' : 'Save Medication'}
        </button>
        <button 
          type="button" 
          class="flex-1 inline-flex items-center justify-center px-4 py-2 border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 text-sm font-medium rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:bg-gray-100 disabled:cursor-not-allowed transition-colors duration-200" 
          on:click={handleCancel}
          disabled={loading}
        >
          <i class="fas fa-times mr-1"></i>Cancel
        </button>
      </div>
    </form>
  </div>
</div>
