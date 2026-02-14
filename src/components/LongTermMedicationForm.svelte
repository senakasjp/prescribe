<script>
  import { createEventDispatcher } from 'svelte'
  import openaiService from '../services/openaiService.js'
  import authService from '../services/doctor/doctorAuthService.js'
  import ThreeDots from './ThreeDots.svelte'
  import { MEDICATION_FREQUENCIES } from '../utils/constants.js'
  import DateInput from './DateInput.svelte'
  
  export let visible = true
  export let editingMedication = null // Medication data when editing
  
  const dispatch = createEventDispatcher()
  
  let medicationName = ''
  let dosage = ''
  let frequency = ''
  let prnAmount = '' // Amount for PRN medications
  let startDate = ''
  let notes = ''
  let error = ''
  let loading = false
  let improvingNotes = false
  let notesImproved = false
  let lastImprovedNotes = ''
  
  // Reset loading state when form is hidden
  $: if (!visible) {
    loading = false
  }

  $: if (!improvingNotes && notesImproved && notes !== lastImprovedNotes) {
    notesImproved = false
  }
  
  // Populate form when editing
  $: if (editingMedication) {
    medicationName = editingMedication.medicationName || ''
    dosage = editingMedication.dosage || ''
    frequency = editingMedication.frequency || ''
    prnAmount = editingMedication.prnAmount || ''
    startDate = editingMedication.startDate || ''
    notes = editingMedication.notes || ''
  }
  
  // Reset form when not editing
  $: if (!editingMedication && visible) {
    medicationName = ''
    dosage = ''
    frequency = ''
    prnAmount = ''
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
        prnAmount: frequency.includes('PRN') ? prnAmount.trim() : '', // Include PRN amount if frequency is PRN
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
      notesImproved = false
      lastImprovedNotes = ''
      
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
    return currentDoctor?.id || currentDoctor?.uid || 'default-user'
  }

  const handleImproveNotes = async () => {
    if (!notes || !notes.trim()) {
      error = 'Please enter some text to improve'
      return
    }

    try {
      improvingNotes = true
      error = ''
      const originalNotes = notes
      const doctorId = getDoctorIdForImprove()
      const result = await openaiService.improveText(notes, doctorId)
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
            <i class="fas fa-capsules mr-1"></i>Medication Name <span class="text-red-500">*</span>
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
            <i class="fas fa-weight mr-1"></i>Dosage <span class="text-red-500">*</span>
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
            <i class="fas fa-clock mr-1"></i>Frequency <span class="text-red-500">*</span>
          </label>
          <div class="flex gap-2">
            <select 
              class="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed" 
              id="frequency" 
              bind:value={frequency}
              required
              disabled={loading}
            >
              <option value="">Select Frequency</option>
              {#each MEDICATION_FREQUENCIES as freq}
                <option value={freq}>{freq}</option>
              {/each}
              <option value="Other">Other</option>
            </select>
            {#if frequency && frequency.includes('PRN')}
              <input 
                type="text" 
                class="w-32 px-3 py-2 border border-gray-300 rounded-lg text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed" 
                placeholder="Amount"
                bind:value={prnAmount}
                disabled={loading}
              >
            {/if}
          </div>
        </div>
        <div class="mb-4">
          <label for="startDate" class="block text-sm font-medium text-gray-700 mb-1">
            <i class="fas fa-calendar mr-1"></i>Start Date
          </label>
          <DateInput type="date" lang="en-GB" placeholder="dd/mm/yyyy" 
            class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed" 
            id="startDate" 
            bind:value={startDate}
            disabled={loading} />
        </div>
      </div>
      
      <div class="mb-4">
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-1">
          <label for="notes" class="text-sm font-medium text-gray-700">
            <i class="fas fa-sticky-note mr-1"></i>Additional Notes
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
            on:click={handleImproveNotes}
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
              Improve English
            {/if}
          </button>
        </div>
        <textarea 
          class="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 transition-all duration-300 {notesImproved ? 'bg-green-50 border-green-300 text-green-700 focus:ring-green-500 focus:border-green-500' : 'bg-white border-gray-300 focus:ring-blue-500 focus:border-blue-500'} {loading || improvingNotes ? 'bg-gray-100' : ''}"
          id="notes" 
          rows="3" 
          bind:value={notes}
          disabled={loading || improvingNotes}
          placeholder="Any additional notes about this medication (side effects, instructions, etc.)"
        ></textarea>
      </div>
      
      {#if error}
        <div class="bg-red-50 border border-red-200 rounded-lg p-3 mb-4" role="alert">
          <i class="fas fa-exclamation-triangle mr-2"></i>{error}
        </div>
      {/if}
      
      <div class="action-buttons">
        <button 
          type="submit" 
          class="action-button action-button-primary disabled:bg-gray-400 disabled:cursor-not-allowed" 
          disabled={loading}
        >
          {#if loading}
            <ThreeDots size="small" color="white" />
          {/if}
          <i class="fas fa-save mr-1"></i>{editingMedication ? 'Update Medication' : 'Save Medication'}
        </button>
        <button 
          type="button" 
          class="action-button action-button-secondary disabled:bg-gray-100 disabled:cursor-not-allowed" 
          on:click={handleCancel}
          disabled={loading}
        >
          <i class="fas fa-times mr-1"></i>Cancel
        </button>
      </div>
    </form>
  </div>
</div>
