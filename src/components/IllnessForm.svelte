<script>
  import { createEventDispatcher } from 'svelte'
  
  export let visible = true
  
  const dispatch = createEventDispatcher()
  
  let name = ''
  let description = ''
  let status = 'active'
  let diagnosisDate = ''
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
      if (!name || !diagnosisDate) {
        throw new Error('Please fill in all required fields')
      }
      
      // Validate diagnosis date
      const diagnosisDateObj = new Date(diagnosisDate)
      const today = new Date()
      if (diagnosisDateObj > today) {
        throw new Error('Diagnosis date cannot be in the future')
      }
      
      const illnessData = {
        name: name.trim(),
        description: description.trim(),
        status,
        diagnosisDate,
        notes: notes.trim()
      }
      
      dispatch('illness-added', illnessData)
      
      // Reset form
      name = ''
      description = ''
      status = 'active'
      diagnosisDate = ''
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

<form on:submit={handleSubmit}>
      <div class="mb-4">
        <label for="illnessName" class="block text-sm font-medium text-gray-700 mb-1">Illness Name <span class="text-red-500">*</span></label>
        <input 
          type="text" 
          class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 disabled:bg-gray-100 disabled:cursor-not-allowed" 
          id="illnessName" 
          bind:value={name}
          required
          disabled={loading}
          placeholder="e.g., Diabetes, Hypertension"
        />
      </div>
      
      <div class="mb-4">
        <label for="illnessDescription" class="block text-sm font-medium text-gray-700 mb-1">Description</label>
        <textarea 
          class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 disabled:bg-gray-100 disabled:cursor-not-allowed" 
          id="illnessDescription" 
          rows="3" 
          bind:value={description}
          disabled={loading}
          placeholder="Describe the illness, symptoms, or condition"
        ></textarea>
      </div>
      
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div>
          <label for="illnessStatus" class="block text-sm font-medium text-gray-700 mb-1">Status</label>
          <select 
            class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 disabled:bg-gray-100 disabled:cursor-not-allowed" 
            id="illnessStatus" 
            bind:value={status}
            disabled={loading}
          >
            <option value="active">Active</option>
            <option value="chronic">Chronic</option>
            <option value="resolved">Resolved</option>
            <option value="monitoring">Under Monitoring</option>
          </select>
        </div>
        <div>
          <label for="diagnosisDate" class="block text-sm font-medium text-gray-700 mb-1">Diagnosis Date <span class="text-red-500">*</span></label>
          <input 
            type="date" 
            class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 disabled:bg-gray-100 disabled:cursor-not-allowed" 
            id="diagnosisDate" 
            bind:value={diagnosisDate}
            required
            disabled={loading}
          />
        </div>
      </div>
      
      <div class="mb-4">
        <label for="illnessNotes" class="block text-sm font-medium text-gray-700 mb-1">Additional Notes</label>
        <textarea 
          class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 disabled:bg-gray-100 disabled:cursor-not-allowed" 
          id="illnessNotes" 
          rows="2" 
          bind:value={notes}
          disabled={loading}
          placeholder="Any additional notes about the illness"
        ></textarea>
      </div>
      
      {#if error}
        <div class="bg-red-50 border border-red-200 rounded-lg p-3 mb-4" role="alert">
          <i class="fas fa-exclamation-triangle mr-2 text-red-600"></i><span class="text-red-700">{error}</span>
        </div>
      {/if}
      
      <div class="flex gap-3">
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
          <i class="fas fa-save mr-1"></i>Save Illness
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
