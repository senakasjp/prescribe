<script>
  import { createEventDispatcher } from 'svelte'
  
  export let visible = true
  
  const dispatch = createEventDispatcher()
  
  let description = ''
  let severity = 'mild'
  let duration = ''
  let onsetDate = ''
  let notes = ''
  let error = ''
  let loading = false
  
  // Reset loading state when form is hidden
  $: if (!visible) {
    loading = false
  }
  
  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault()
    error = ''
    loading = true
    
    try {
      // Validate required fields
      if (!description) {
        throw new Error('Please fill in the symptom description')
      }
      
      // Validate onset date only if provided
      if (onsetDate) {
        const onsetDateObj = new Date(onsetDate)
        const today = new Date()
        if (onsetDateObj > today) {
          throw new Error('Onset date cannot be in the future')
        }
      }
      
      const symptomsData = {
        description: description.trim(),
        severity,
        duration: duration.trim(),
        onsetDate,
        notes: notes.trim()
      }
      
      dispatch('symptoms-added', symptomsData)
      
      // Reset form
      description = ''
      severity = 'mild'
      duration = ''
      onsetDate = ''
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

<div class="bg-white border border-gray-200 rounded-lg shadow-sm">
  <!-- Card Header -->
  <div class="bg-gray-100 px-4 py-3 border-b border-gray-200 rounded-t-lg">
    <h5 class="text-lg font-semibold text-gray-800 mb-0">
      <i class="fas fa-clipboard-list mr-2 text-teal-600"></i>Add Symptoms
    </h5>
  </div>
  
  <!-- Card Body -->
  <div class="p-4">
    <form on:submit={handleSubmit}>
      <div class="mb-4">
        <label for="symptomsDescription" class="block text-sm font-medium text-gray-700 mb-1">Symptom Description <span class="text-red-500">*</span></label>
        <textarea 
          class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 disabled:bg-gray-100 disabled:cursor-not-allowed" 
          id="symptomsDescription" 
          rows="3" 
          bind:value={description}
          required
          disabled={loading}
          placeholder="Describe the symptoms in detail (e.g., chest pain, shortness of breath, fever)"
        ></textarea>
      </div>
      
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div>
          <label for="symptomsSeverity" class="block text-sm font-medium text-gray-700 mb-1">Severity</label>
          <select 
            class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 disabled:bg-gray-100 disabled:cursor-not-allowed" 
            id="symptomsSeverity" 
            bind:value={severity}
            disabled={loading}
          >
            <option value="mild">Mild</option>
            <option value="moderate">Moderate</option>
            <option value="severe">Severe</option>
            <option value="critical">Critical</option>
          </select>
        </div>
        <div>
          <label for="symptomsDuration" class="block text-sm font-medium text-gray-700 mb-1">Duration</label>
          <input 
            type="text" 
            class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 disabled:bg-gray-100 disabled:cursor-not-allowed" 
            id="symptomsDuration" 
            bind:value={duration}
            disabled={loading}
            placeholder="e.g., 2 hours, 3 days, 1 week"
          />
        </div>
      </div>
      
      <div class="mb-4">
        <label for="symptomsOnsetDate" class="block text-sm font-medium text-gray-700 mb-1">Onset Date</label>
        <input 
          type="date" 
          class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 disabled:bg-gray-100 disabled:cursor-not-allowed" 
          id="symptomsOnsetDate" 
          bind:value={onsetDate}
          disabled={loading}
        />
      </div>
      
      <div class="mb-4">
        <label for="symptomsNotes" class="block text-sm font-medium text-gray-700 mb-1">Additional Notes</label>
        <textarea 
          class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 disabled:bg-gray-100 disabled:cursor-not-allowed" 
          id="symptomsNotes" 
          rows="2" 
          bind:value={notes}
          disabled={loading}
          placeholder="Any additional notes about the symptoms (triggers, patterns, etc.)"
        ></textarea>
      </div>
      
      {#if error}
        <div class="bg-red-50 border border-red-200 rounded-lg p-3 mb-4" role="alert">
          <i class="fas fa-exclamation-triangle mr-2 text-red-600"></i><span class="text-red-700">{error}</span>
        </div>
      {/if}
      
      <div class="flex flex-col sm:flex-row gap-3">
        <button 
          type="submit" 
          class="flex-1 inline-flex items-center justify-center px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors duration-200" 
          disabled={loading}
        >
          {#if loading}
            <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          {/if}
          <i class="fas fa-save mr-1"></i>Save Symptoms
        </button>
        <button 
          type="button" 
          class="flex-1 inline-flex items-center justify-center px-4 py-2 border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 text-sm font-medium rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 disabled:bg-gray-100 disabled:cursor-not-allowed transition-colors duration-200" 
          on:click={handleCancel}
          disabled={loading}
        >
          <i class="fas fa-times mr-1"></i>Cancel
        </button>
      </div>
    </form>
  </div>
</div>
