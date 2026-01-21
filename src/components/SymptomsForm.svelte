<script>
  import { createEventDispatcher } from 'svelte'
  import openaiService from '../services/openaiService.js'
  import firebaseStorage from '../services/firebaseStorage.js'
  import authService from '../services/doctor/doctorAuthService.js'

  export let visible = true

  const dispatch = createEventDispatcher()

  let description = ''
  let severity = 'mild'
  let duration = ''
  let onsetDate = ''
  let notes = ''
  let error = ''
  let loading = false
  let improvingText = false
  let textImproved = false
  let lastImprovedDescription = ''

  // Reset loading state when form is hidden
  $: if (!visible) {
    loading = false
    improvingText = false
    textImproved = false
  }

  // Reset improved state only when the user edits after a successful correction
  $: if (!improvingText && textImproved && description !== lastImprovedDescription) {
    textImproved = false
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

  // Improve text with AI
  const handleImproveText = async () => {
    if (!description || !description.trim()) {
      error = 'Please enter some text to improve'
      return
    }

    try {
      improvingText = true
      error = ''
      const originalDescription = description

      // Get doctor information for token tracking
      const currentDoctor = authService.getCurrentDoctor()
      const doctorId = currentDoctor?.id || currentDoctor?.uid || 'default-user'

      // Call OpenAI service to improve text
      const result = await openaiService.improveText(description, doctorId)

      // Update the description with improved text
      description = result.improvedText

      // Mark as improved to show visual feedback
      const normalizedOriginal = String(originalDescription ?? '').trim()
      const normalizedImproved = String(description ?? '').trim()
      textImproved = normalizedImproved !== '' && normalizedImproved !== normalizedOriginal
      lastImprovedDescription = textImproved ? normalizedImproved : ''

      // Dispatch event for token tracking
      dispatch('ai-usage-updated', {
        tokensUsed: result.tokensUsed,
        type: 'improveText'
      })

      console.log('✅ Text improved successfully')

    } catch (err) {
      console.error('❌ Error improving text:', err)
      error = err.message || 'Failed to improve text. Please try again.'
    } finally {
      improvingText = false
    }
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
        <label for="symptomsDescription" class="block text-sm font-medium text-gray-700 mb-1">
          Symptom Description <span class="text-red-500">*</span>
          {#if textImproved}
            <span class="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
              <i class="fas fa-check-circle mr-1"></i>
              AI Improved
            </span>
          {/if}
        </label>
        <div class="relative">
          <textarea
            class="w-full px-3 py-2 border rounded-lg text-sm placeholder-gray-500 focus:outline-none focus:ring-2 disabled:cursor-not-allowed transition-all duration-300 {textImproved ? 'bg-green-50 border-green-300 text-green-700 focus:ring-green-500 focus:border-green-500' : 'bg-white border-teal-300 focus:ring-teal-500 focus:border-teal-500'} {loading || improvingText ? 'bg-gray-100' : ''}"
            id="symptomsDescription"
            rows="3"
            bind:value={description}
            required
            disabled={loading || improvingText}
            placeholder="Describe the symptoms in detail (e.g., chest pain, shortness of breath, fever)"
          ></textarea>
          <button
            type="button"
            class="absolute top-2 right-2 inline-flex items-center px-3 py-1.5 bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white text-xs font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:bg-gray-400 disabled:cursor-not-allowed transition-all duration-200 shadow-sm"
            on:click={handleImproveText}
            disabled={loading || improvingText || !description}
            title="Improve grammar and spelling with AI"
          >
            {#if improvingText}
              <svg class="animate-spin h-3 w-3 mr-1.5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Improving...
            {:else}
              <i class="fas fa-sparkles mr-1.5"></i>
              Improve with AI
            {/if}
          </button>
        </div>
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
