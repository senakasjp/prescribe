<script>
  import { createEventDispatcher } from 'svelte'
  import openaiService from '../services/openaiService.js'
  import authService from '../services/doctor/doctorAuthService.js'
  
  export let visible = true
  
  const dispatch = createEventDispatcher()
  
  let name = ''
  let description = ''
  let status = 'active'
  let diagnosisDate = ''
  let notes = ''
  let error = ''
  let loading = false
  let improvingFields = {
    description: false,
    notes: false
  }
  let improvedFields = {
    description: false,
    notes: false
  }
  let lastImprovedValues = {
    description: '',
    notes: ''
  }
  
  // Reset loading state when form is hidden
  $: if (!visible) {
    loading = false
  }

  $: if (!improvingFields.description && improvedFields.description && description !== lastImprovedValues.description) {
    improvedFields = { ...improvedFields, description: false }
  }

  $: if (!improvingFields.notes && improvedFields.notes && notes !== lastImprovedValues.notes) {
    improvedFields = { ...improvedFields, notes: false }
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
      improvedFields = { description: false, notes: false }
      lastImprovedValues = { description: '', notes: '' }
      
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

  const handleFieldEdit = (fieldKey, value) => {
    if (lastImprovedValues[fieldKey] && value !== lastImprovedValues[fieldKey]) {
      lastImprovedValues = { ...lastImprovedValues, [fieldKey]: '' }
      improvedFields = { ...improvedFields, [fieldKey]: false }
    }
  }

  const handleImproveField = async (fieldKey, currentValue, setter) => {
    if (!currentValue || !currentValue.trim()) {
      error = 'Please enter some text to improve'
      return
    }

    try {
      improvingFields = { ...improvingFields, [fieldKey]: true }
      error = ''
      const doctorId = getDoctorIdForImprove()
      const result = await openaiService.improveText(currentValue, doctorId)
      setter(result.improvedText)

      const normalizedImproved = String(result.improvedText ?? '').trim()
      improvedFields = { ...improvedFields, [fieldKey]: normalizedImproved !== '' }
      lastImprovedValues = { ...lastImprovedValues, [fieldKey]: normalizedImproved }

      dispatch('ai-usage-updated', {
        tokensUsed: result.tokensUsed,
        type: 'improveText'
      })
    } catch (err) {
      console.error('❌ Error improving text:', err)
      error = err.message || 'Failed to improve text. Please try again.'
    } finally {
      improvingFields = { ...improvingFields, [fieldKey]: false }
    }
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
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-1">
          <label for="illnessDescription" class="text-sm font-medium text-gray-700">
            Description
            {#if improvedFields.description}
              <span class="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                <i class="fas fa-check-circle mr-1"></i>
                AI Improved
              </span>
            {/if}
          </label>
          <button
            type="button"
            class="inline-flex items-center px-3 py-1.5 bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white text-xs font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:bg-gray-400 disabled:cursor-not-allowed transition-all duration-200 shadow-sm"
            on:click={() => handleImproveField('description', description, (value) => description = value)}
            disabled={loading || improvingFields.description || improvedFields.description || !description}
            title="Fix spelling and grammar with AI"
          >
            {#if improvingFields.description}
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
          class="w-full px-3 py-2 border rounded-lg text-sm placeholder-gray-500 focus:outline-none focus:ring-2 disabled:bg-gray-100 disabled:cursor-not-allowed transition-all duration-300 {improvedFields.description ? 'bg-green-50 border-green-300 text-green-700 focus:ring-green-500 focus:border-green-500' : 'bg-white border-gray-300 focus:ring-teal-500 focus:border-teal-500'} {loading || improvingFields.description ? 'bg-gray-100' : ''}"
          id="illnessDescription" 
          rows="3" 
          bind:value={description}
          on:input={(e) => handleFieldEdit('description', e.target.value)}
          disabled={loading || improvingFields.description}
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
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-1">
          <label for="illnessNotes" class="text-sm font-medium text-gray-700">
            Additional Notes
            {#if improvedFields.notes}
              <span class="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                <i class="fas fa-check-circle mr-1"></i>
                AI Improved
              </span>
            {/if}
          </label>
          <button
            type="button"
            class="inline-flex items-center px-3 py-1.5 bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white text-xs font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:bg-gray-400 disabled:cursor-not-allowed transition-all duration-200 shadow-sm"
            on:click={() => handleImproveField('notes', notes, (value) => notes = value)}
            disabled={loading || improvingFields.notes || improvedFields.notes || !notes}
            title="Fix spelling and grammar with AI"
          >
            {#if improvingFields.notes}
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
          class="w-full px-3 py-2 border rounded-lg text-sm placeholder-gray-500 focus:outline-none focus:ring-2 disabled:bg-gray-100 disabled:cursor-not-allowed transition-all duration-300 {improvedFields.notes ? 'bg-green-50 border-green-300 text-green-700 focus:ring-green-500 focus:border-green-500' : 'bg-white border-gray-300 focus:ring-teal-500 focus:border-teal-500'} {loading || improvingFields.notes ? 'bg-gray-100' : ''}"
          id="illnessNotes" 
          rows="2" 
          bind:value={notes}
          on:input={(e) => handleFieldEdit('notes', e.target.value)}
          disabled={loading || improvingFields.notes}
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
