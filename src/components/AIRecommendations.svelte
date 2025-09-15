<script>
  import { createEventDispatcher } from 'svelte'
  import openaiService from '../services/openaiService.js'
  
  const dispatch = createEventDispatcher()
  
  export let symptoms = []
  export let currentMedications = []
  export let patientAge = null
  export let doctorId = null
  
  let recommendations = ''
  let medicationSuggestions = ''
  let loading = false
  let error = ''
  let showRecommendations = false
  let showMedicationSuggestions = false
  let showRecommendationsInline = false
  let showMedicationSuggestionsInline = false
  let showCombinedAnalysis = false
  
  // Generate single optimized AI analysis (recommendations + medication suggestions)
  const generateComprehensiveAnalysis = async () => {
    if (!symptoms || symptoms.length === 0) {
      error = 'No symptoms available to analyze'
      return
    }
    
    loading = true
    error = ''
    
    try {
      console.log('🤖 Generating single optimized AI analysis...')
      
      // Use single API call for both recommendations and medication suggestions
      const combinedResult = await openaiService.generateCombinedAnalysis(symptoms, currentMedications, patientAge, doctorId)
      
      // Parse the combined result
      const combinedAnalysis = combinedResult.combinedAnalysis || combinedResult
      recommendations = combinedAnalysis
      medicationSuggestions = combinedAnalysis // Same content for both sections
      showCombinedAnalysis = true
      showRecommendationsInline = false
      showMedicationSuggestionsInline = false
      
      // Dispatch event to notify parent of AI usage
      dispatch('ai-usage-updated', { 
        type: 'single-panel-analysis', 
        timestamp: new Date().toISOString(),
        doctorId 
      })
      
      console.log('✅ Single optimized AI analysis generated')
    } catch (err) {
      console.error('❌ Error generating single AI analysis:', err)
      error = err.message
    } finally {
      loading = false
    }
  }
  
  // Close recommendations
  const closeRecommendations = () => {
    showRecommendations = false
    recommendations = ''
  }
  
  // Close medication suggestions
  const closeMedicationSuggestions = () => {
    showMedicationSuggestions = false
    medicationSuggestions = ''
  }
  
  // Close inline recommendations
  const closeRecommendationsInline = () => {
    showRecommendationsInline = false
    recommendations = ''
  }
  
  // Close inline medication suggestions
  const closeMedicationSuggestionsInline = () => {
    showMedicationSuggestionsInline = false
    medicationSuggestions = ''
  }
  
  // Close combined analysis
  const closeCombinedAnalysis = () => {
    showCombinedAnalysis = false
    recommendations = ''
    medicationSuggestions = ''
  }
  
  // Check if OpenAI is configured
  $: isOpenAIConfigured = openaiService.isConfigured()
  
  // Format AI recommendations for better display
  const formatRecommendations = (text) => {
    if (!text) return ''
    
    return text
      // Convert numbered lists to proper HTML
      .replace(/(\d+\.\s)/g, '<br><strong>$1</strong>')
      // Convert bullet points to proper HTML
      .replace(/^[\s]*[-•]\s/gm, '<br>• ')
      // Convert section headers (lines that end with colon)
      .replace(/^([^:\n]+):$/gm, '<br><h6 class="text-primary mb-2 mt-3">$1:</h6>')
      // Convert bold text patterns
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      // Convert italic text patterns
      .replace(/\*([^*]+)\*/g, '<em>$1</em>')
      // Convert line breaks
      .replace(/\n/g, '<br>')
      // Clean up multiple line breaks
      .replace(/(<br>){3,}/g, '<br><br>')
      // Add proper spacing after headers
      .replace(/(<h6[^>]*>.*?<\/h6>)/g, '$1<br>')
      // Clean up leading/trailing breaks
      .replace(/^(<br>)+|(<br>)+$/g, '')
  }
</script>

<div class="ai-recommendations">
  <!-- AI Comprehensive Analysis Button -->
  {#if symptoms && symptoms.length > 0}
    <div class="mb-3">
      <button 
        class="btn btn-outline-danger btn-sm w-100"
        on:click={generateComprehensiveAnalysis}
        disabled={loading || !isOpenAIConfigured}
        title="Generate comprehensive AI analysis including medical recommendations and medication suggestions"
      >
        {#if loading}
          <span class="spinner-border spinner-border-sm me-2" role="status"></span>
        {/if}
        <i class="fas fa-robot me-2"></i>
        AI-Powered Medical Intelligence
      </button>
    </div>
  {/if}
  
  <!-- Error Message -->
  {#if error}
    <div class="alert alert-warning alert-dismissible fade show" role="alert">
      <i class="fas fa-exclamation-triangle me-2"></i>
      {error}
      <button type="button" class="btn-close" on:click={() => error = ''}></button>
    </div>
  {/if}
  
  <!-- OpenAI Configuration Warning -->
  {#if !isOpenAIConfigured}
    <div class="alert alert-info" role="alert">
      <i class="fas fa-info-circle me-2"></i>
      <strong>AI Features Disabled:</strong> To enable AI recommendations, please configure your OpenAI API key in the environment variables (VITE_OPENAI_API_KEY).
    </div>
  {/if}
  
  <!-- Inline AI Recommendations -->
  {#if showRecommendationsInline}
    <div class="ai-recommendations-inline mt-3">
      <div class="card">
        <div class="card-header d-flex justify-content-between align-items-center">
          <h6 class="mb-0 text-danger">
            <i class="fas fa-robot me-2"></i>AI-Powered Medical Intelligence
          </h6>
          <button 
            type="button" 
            class="btn-close btn-sm" 
            on:click={closeRecommendationsInline}
            title="Close recommendations"
          ></button>
        </div>
        
        <div class="card-body">
          <div class="alert alert-info alert-sm mb-3" role="alert">
            <i class="fas fa-info-circle me-2"></i>
            <strong>Disclaimer:</strong> These recommendations are generated by AI and are for informational purposes only. They should not replace professional medical consultation.
          </div>
          
          <div class="ai-recommendations-content">
            {#if recommendations}
              <div class="recommendations-text">
                {@html formatRecommendations(recommendations)}
              </div>
            {/if}
          </div>
        </div>
      </div>
    </div>
  {/if}
  
  <!-- Inline Medication Suggestions -->
  {#if showMedicationSuggestionsInline}
    <div class="ai-medication-suggestions-inline mt-3">
      <div class="card">
        <div class="card-header d-flex justify-content-between align-items-center">
          <h6 class="mb-0">
            <i class="fas fa-pills me-2 text-success"></i>AI Medication Suggestions
          </h6>
          <button 
            type="button" 
            class="btn-close btn-sm" 
            on:click={closeMedicationSuggestionsInline}
            title="Close medication suggestions"
          ></button>
        </div>
        
        <div class="card-body">
          <div class="alert alert-warning alert-sm mb-3" role="alert">
            <i class="fas fa-exclamation-triangle me-2"></i>
            <strong>Important:</strong> These medication suggestions are generated by AI and are for informational purposes only. Always consult with a healthcare professional before taking any medications.
          </div>
          
          <div class="medication-suggestions-content">
            {#if medicationSuggestions}
              <div class="suggestions-text">
                {@html formatRecommendations(medicationSuggestions)}
              </div>
            {/if}
          </div>
        </div>
      </div>
    </div>
  {/if}
  
  <!-- Combined AI Analysis -->
  {#if showCombinedAnalysis}
    <div class="ai-combined-analysis mt-3">
      <div class="card">
        <div class="card-header d-flex justify-content-between align-items-center">
          <h6 class="mb-0 text-danger">
            <i class="fas fa-robot me-2"></i>AI-Powered Medical Intelligence
          </h6>
          <button 
            type="button" 
            class="btn-close btn-sm" 
            on:click={closeCombinedAnalysis}
            title="Close AI analysis"
          ></button>
        </div>
        
        <div class="card-body">
          <div class="alert alert-info alert-sm mb-3" role="alert">
            <i class="fas fa-info-circle me-2"></i>
            <strong>Disclaimer:</strong> This analysis is generated by AI and is for informational purposes only. It should not replace professional medical consultation.
          </div>
          
          <!-- Single Combined Analysis -->
          {#if recommendations}
            <div class="mb-2">
              <div class="alert alert-info alert-sm mb-3" role="alert">
                <i class="fas fa-info-circle me-2"></i>
                <strong>Medical Analysis:</strong> This analysis includes recommendations, medication suggestions, and interaction warnings. Always consult with a healthcare professional.
              </div>
              <div class="combined-analysis-content">
                <div class="analysis-text">
                  {@html formatRecommendations(recommendations)}
                </div>
              </div>
            </div>
          {/if}
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .ai-recommendations-inline .card,
  .ai-medication-suggestions-inline .card,
  .ai-combined-analysis .card {
    border: 1px solid #dee2e6;
    box-shadow: 0 0.125rem 0.25rem rgba(0, 0, 0, 0.075);
  }
  
  .ai-recommendations-inline .card-header,
  .ai-medication-suggestions-inline .card-header,
  .ai-combined-analysis .card-header {
    background-color: #f8f9fa;
    border-bottom: 1px solid #dee2e6;
  }
  
  .ai-recommendations-content,
  .medication-suggestions-content,
  .combined-analysis-content {
    max-height: 300px;
    overflow-y: auto;
    padding: 0.75rem;
    background-color: #f8f9fa;
    border-radius: 0.375rem;
    border: 1px solid #dee2e6;
  }
  
  .alert-sm {
    padding: 0.5rem 0.75rem;
    font-size: 0.875rem;
  }
  
  .recommendations-text,
  .suggestions-text,
  .analysis-text {
    line-height: 1.7;
    font-size: 0.95rem;
    color: #333;
  }
  
  .recommendations-text h6,
  .suggestions-text h6,
  .analysis-text h6 {
    color: #0d6efd !important;
    font-weight: 600;
    font-size: 1rem;
    margin-top: 1.5rem !important;
    margin-bottom: 0.75rem !important;
    border-bottom: 2px solid #e9ecef;
    padding-bottom: 0.25rem;
  }
  
  .recommendations-text strong,
  .suggestions-text strong,
  .analysis-text strong {
    color: #495057;
    font-weight: 600;
  }
  
  .recommendations-text em,
  .suggestions-text em,
  .analysis-text em {
    color: #6c757d;
    font-style: italic;
  }
  
  .recommendations-text ul,
  .suggestions-text ul,
  .analysis-text ul {
    padding-left: 1.5rem;
    margin: 0.5rem 0;
  }
  
  .recommendations-text li,
  .suggestions-text li,
  .analysis-text li {
    margin-bottom: 0.5rem;
    line-height: 1.6;
  }
  
  .recommendations-text br + strong,
  .suggestions-text br + strong,
  .analysis-text br + strong {
    display: block;
    margin-top: 0.75rem;
    margin-bottom: 0.25rem;
    color: #0d6efd;
  }
  
  .recommendations-text br + •,
  .suggestions-text br + •,
  .analysis-text br + • {
    display: block;
    margin-top: 0.5rem;
    margin-bottom: 0.25rem;
  }
</style>
