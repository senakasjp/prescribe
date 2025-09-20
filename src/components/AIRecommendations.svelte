<script>
  import { createEventDispatcher } from 'svelte'
  import openaiService from '../services/openaiService.js'
  
  const dispatch = createEventDispatcher()
  
  export let symptoms = []
  export let currentMedications = []
  export let patientAge = null
  export let patientAllergies = null
  export let doctorId = null
  
  // Expose AI diagnostics state to parent component
  export let isShowingAIDiagnostics = false
  
  let recommendations = ''
  let medicationSuggestions = ''
  let loading = false
  let error = ''
  let showRecommendations = false
  let showMedicationSuggestions = false
  let showRecommendationsInline = false
  let showMedicationSuggestionsInline = false
  let showCombinedAnalysis = false
  
  // Chatbot variables
  let chatMessage = ''
  let chatLoading = false
  let chatMessages = []
  
  // Generate single optimized AI analysis (recommendations + medication suggestions)
  const generateComprehensiveAnalysis = async () => {
    console.log('🚀 AI Button Clicked! Starting comprehensive analysis...')
    
    if (!symptoms || symptoms.length === 0) {
      error = 'No symptoms available to analyze'
      console.log('❌ No symptoms available, aborting AI analysis')
      return
    }
    
    console.log('✅ Symptoms available, proceeding with AI analysis')
    loading = true
    error = ''
    
    try {
      console.log('🤖 Generating single optimized AI analysis...')
      console.log('🤖 Symptoms:', symptoms)
      console.log('🤖 Current medications:', currentMedications)
      console.log('🤖 Patient age:', patientAge)
      console.log('🤖 Doctor ID:', doctorId)
      console.log('🤖 OpenAI configured:', openaiService.isConfigured())
      
      // Use single API call for both recommendations and medication suggestions
      const combinedResult = await openaiService.generateCombinedAnalysis(symptoms, currentMedications, patientAge, doctorId, patientAllergies)
      
      // Parse the combined result
      const combinedAnalysis = combinedResult.combinedAnalysis || combinedResult
      recommendations = combinedAnalysis
      medicationSuggestions = combinedAnalysis // Same content for both sections
      showCombinedAnalysis = true
      showRecommendationsInline = false
      showMedicationSuggestionsInline = false
      isShowingAIDiagnostics = true
      
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
    isShowingAIDiagnostics = false
  }
  
  // Check if OpenAI is configured
  $: isOpenAIConfigured = openaiService.isConfigured()
  
  // Format AI recommendations for better display
  const formatRecommendations = (text) => {
    if (!text) return ''
    
    return text
      // Remove hash symbols (###)
      .replace(/#{1,6}\s*/g, '')
      // Convert numbered lists to proper HTML (minimal spacing)
      .replace(/(\d+\.\s)/g, '<strong>$1</strong>')
      // Convert bullet points to proper HTML (minimal spacing)
      .replace(/^[\s]*[-•]\s/gm, '• ')
      // Convert section headers (lines that end with colon) - compact
      .replace(/^([^:\n]+):$/gm, '<h6 class="text-primary mb-1 mt-1">$1:</h6>')
      // Convert bold text patterns
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      // Convert italic text patterns
      .replace(/\*([^*]+)\*/g, '<em>$1</em>')
      // Convert line breaks to minimal spacing
      .replace(/\n/g, ' ')
      // Clean up multiple spaces
      .replace(/\s{2,}/g, ' ')
      // Clean up leading/trailing spaces
      .replace(/^\s+|\s+$/g, '')
  }

  // Chatbot functions
  const sendChatMessage = async () => {
    if (!chatMessage.trim()) return
    
    const userMessage = chatMessage.trim()
    chatMessage = ''
    chatLoading = true
    
    // Add user message to chat
    chatMessages = [...chatMessages, {
      type: 'user',
      content: userMessage,
      timestamp: new Date()
    }]
    
    // Auto-scroll to bottom
    scrollToBottom()
    
    try {
      // Generate token-optimized AI response for chat
      const symptomsText = symptoms && symptoms.length > 0 ? symptoms.map(s => s.symptom).join(', ') : 'No symptoms recorded'
      const analysisSummary = recommendations && recommendations.length > 0 ? recommendations.substring(0, 500) : 'No previous analysis available'
      
      const chatPrompt = `You are a medical AI assistant. Answer this question concisely and professionally: "${userMessage}". 

Context: Patient symptoms: ${symptomsText}
Previous analysis summary: ${analysisSummary}

Provide a brief, focused answer (max 200 words) with clear medical guidance.`

      console.log('🤖 Chat request:', { userMessage, symptomsText, analysisSummary })

      const response = await openaiService.makeOpenAIRequest('chat/completions', {
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a medical AI assistant. Provide concise, professional medical guidance. Keep responses brief and focused (under 200 words). Use clear formatting with headers and bullet points when appropriate.'
          },
          {
            role: 'user',
            content: chatPrompt
          }
        ],
        max_tokens: 300,
        temperature: 0.1
      }, 'chatbotResponse', {
        symptoms: symptomsText,
        question: userMessage,
        doctorId: doctorId
      })
      
      console.log('🤖 Chat response:', response)
      
      // Add AI response to chat
      chatMessages = [...chatMessages, {
        type: 'ai',
        content: response.choices[0].message.content,
        timestamp: new Date()
      }]
      
      // Auto-scroll to bottom
      scrollToBottom()
      
    } catch (error) {
      console.error('❌ Chat error:', error)
      console.error('❌ Error details:', {
        message: error.message,
        stack: error.stack,
        symptoms: symptoms,
        recommendations: recommendations,
        doctorId: doctorId
      })
      
      chatMessages = [...chatMessages, {
        type: 'ai',
        content: `I apologize, but I encountered an error while processing your question: "${error.message}". Please try again or rephrase your question.`,
        timestamp: new Date()
      }]
      
      // Auto-scroll to bottom
      scrollToBottom()
    } finally {
      chatLoading = false
    }
  }

  // Auto-scroll to bottom of chat
  const scrollToBottom = () => {
    setTimeout(() => {
      const chatMessagesElement = document.getElementById('chatMessages')
      if (chatMessagesElement) {
        chatMessagesElement.scrollTop = chatMessagesElement.scrollHeight
      }
    }, 100) // Small delay to ensure DOM is updated
  }
</script>

<div class="ai-recommendations">
  <!-- AI Comprehensive Analysis Button -->
  {#if symptoms && symptoms.length > 0}
    <div class="mb-3 text-center">
      <button 
        class="btn btn-info btn-sm"
        on:click={generateComprehensiveAnalysis}
        disabled={loading || !isOpenAIConfigured}
        title="Generate comprehensive AI analysis including medical recommendations and medication suggestions"
      >
        {#if loading}
          <span class="spinner-border spinner-border-sm me-2" role="status"></span>
        {/if}
        <i class="fas fa-brain me-2"></i>
        AI Assistant
      </button>
    </div>
  {:else if !isShowingAIDiagnostics}
    <div class="mb-3">
      <div class="alert alert-info" role="alert">
        <i class="fas fa-info-circle me-2"></i>
        <strong>No Symptoms Available:</strong> Please add symptoms in the Symptoms tab first to enable AI analysis.
      </div>
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
      <div class="d-flex justify-content-between align-items-center mb-3">
        <h6 class="mb-0 text-danger">
          <i class="fas fa-brain me-2"></i>AI-Powered Medical Intelligence
        </h6>
        <button 
          type="button" 
          class="btn-close btn-sm" 
          on:click={closeRecommendationsInline}
          title="Close recommendations"
        ></button>
      </div>
      
      <div>
          <div class="alert alert-info alert-sm mb-3" role="alert">
            <i class="fas fa-info-circle me-2"></i>
            <strong>Disclaimer:</strong> These recommendations are generated by AI and are for informational purposes only. They should not replace professional medical consultation.
          </div>
          
          <div class="max-height-300 overflow-auto p-3 bg-light rounded border">
            {#if recommendations}
              <div class="recommendations-text">
                {@html formatRecommendations(recommendations)}
              </div>
            {/if}
          </div>
        </div>
    </div>
  {/if}
  
  <!-- Inline Medication Suggestions -->
  {#if showMedicationSuggestionsInline}
    <div class="ai-medication-suggestions-inline mt-3">
      <div class="d-flex justify-content-between align-items-center mb-3">
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
      
      <div>
          <div class="alert alert-warning alert-sm mb-3" role="alert">
            <i class="fas fa-exclamation-triangle me-2"></i>
            <strong>Important:</strong> These medication suggestions are generated by AI and are for informational purposes only. Always consult with a healthcare professional before taking any medications.
          </div>
          
          <div class="max-height-300 overflow-auto p-3 bg-light rounded border">
            {#if medicationSuggestions}
              <div class="suggestions-text">
                {@html formatRecommendations(medicationSuggestions)}
              </div>
            {/if}
          </div>
        </div>
    </div>
  {/if}
  
  <!-- Combined AI Analysis -->
  {#if showCombinedAnalysis}
    <div class="ai-combined-analysis mt-3">
      <div class="d-flex justify-content-between align-items-center mb-3">
        <h6 class="mb-0 text-danger">
          <i class="fas fa-brain me-2"></i>AI-Powered Medical Intelligence
        </h6>
        <button 
          type="button" 
          class="btn-close btn-sm" 
          on:click={closeCombinedAnalysis}
          title="Close AI analysis"
        ></button>
      </div>
      
      <div>
          <div class="alert alert-info alert-sm mb-3" role="alert">
            <i class="fas fa-info-circle me-2"></i>
            <strong>Disclaimer:</strong> This analysis is generated by AI and is for informational purposes only. It should not replace professional medical consultation.
          </div>
          
          <!-- Single Combined Analysis -->
          {#if recommendations}
            <div class="mb-4">
              <div class="p-3 bg-light rounded border">
                <div class="analysis-text">
                  {@html formatRecommendations(recommendations)}
                </div>
              </div>
            </div>
          {/if}
          
          <!-- AI Chatbot Interface -->
          <div class="ai-chatbot-interface mt-3">
            <div class="card border-primary">
              <div class="card-header bg-light text-dark py-2">
                <h6 class="mb-0 small">
                  <i class="fas fa-comments me-1"></i>Ask AI Assistant
                </h6>
                <small class="small">Have follow-up questions? Ask our AI assistant for more details.</small>
              </div>
              <div class="card-body p-2 bg-light">
                <div class="chat-messages mb-2" id="chatMessages">
                  <!-- Initial AI message -->
                  <div class="message ai-message mb-3">
                    <div class="message-avatar">
                      <i class="fas fa-robot"></i>
                    </div>
                    <div class="message-content">
                      <div class="message-bubble">
                        Hello! I've analyzed the patient's symptoms and provided recommendations above. Do you have any specific questions about the diagnosis, treatment options, or medication interactions? I'm here to help clarify any aspects of the analysis.
                      </div>
                      <div class="message-time">
                        {new Date().toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                  
                  <!-- Dynamic chat messages -->
                  {#each chatMessages as message (message.timestamp)}
                    <div class="message {message.type}-message mb-3">
                      {#if message.type === 'user'}
                        <div class="message-content">
                          <div class="message-bubble">
                            {message.content}
                          </div>
                          <div class="message-time">
                            {message.timestamp.toLocaleTimeString()}
                          </div>
                        </div>
                        <div class="message-avatar">
                          <i class="fas fa-user-md"></i>
                        </div>
                      {:else}
                        <div class="message-avatar">
                          <i class="fas fa-robot"></i>
                        </div>
                        <div class="message-content">
                          <div class="message-bubble">
                            {@html formatRecommendations(message.content)}
                          </div>
                          <div class="message-time">
                            {message.timestamp.toLocaleTimeString()}
                          </div>
                        </div>
                      {/if}
                    </div>
                  {/each}
                  
                  <!-- Loading indicator -->
                  {#if chatLoading}
                    <div class="message ai-message mb-3">
                      <div class="message-avatar">
                        <i class="fas fa-robot"></i>
                      </div>
                      <div class="message-content">
                        <div class="message-bubble">
                          <span class="spinner-border spinner-border-sm me-2" role="status"></span>
                          Thinking...
                        </div>
                      </div>
                    </div>
                  {/if}
                </div>
                
                <div class="chat-input">
                  <div class="input-group input-group-sm">
                    <textarea 
                      class="form-control form-control-sm" 
                      placeholder="Ask a question about the analysis..."
                      bind:value={chatMessage}
                      rows="2"
                      on:keydown={(e) => e.key === 'Enter' && !e.shiftKey && sendChatMessage()}
                    ></textarea>
                    <button 
                      class="btn btn-danger" 
                      type="button"
                      on:click={sendChatMessage}
                      disabled={!chatMessage.trim() || chatLoading}
                    >
                      {#if chatLoading}
                        <span class="spinner-border spinner-border-sm me-1" role="status"></span>
                      {/if}
                      <i class="fas fa-paper-plane"></i>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
    </div>
  {/if}
</div>

<style>

  /* Chatbot Interface Styling - Image Format */
  .ai-chatbot-interface {
    margin-top: 0.5rem;
  }

  .chat-messages {
    max-height: 400px;
    overflow-y: auto;
    padding: 1rem;
    background-color: #f8f9fa;
    border-radius: 0.5rem;
    border: 1px solid #dee2e6;
  }

  .message {
    display: flex;
    align-items: flex-start;
    margin-bottom: 1rem;
    gap: 0.75rem;
  }

  .user-message {
    flex-direction: row-reverse;
  }

  .message-avatar {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.2rem;
    flex-shrink: 0;
  }

  .ai-message .message-avatar {
    background: linear-gradient(135deg, #007bff, #0056b3);
    color: white;
  }

  .user-message .message-avatar {
    background: linear-gradient(135deg, #28a745, #1e7e34);
    color: white;
  }

  .message-content {
    max-width: 70%;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .user-message .message-content {
    align-items: flex-end;
  }

  .ai-message .message-content {
    align-items: flex-start;
  }

  .message-bubble {
    padding: 0.75rem 1rem;
    border-radius: 1rem;
    word-wrap: break-word;
    font-size: 0.9rem;
    line-height: 1.4;
    max-width: 100%;
  }

  .ai-message .message-bubble {
    background-color: white;
    color: #333;
    border: 1px solid #e9ecef;
    border-bottom-left-radius: 0.25rem;
  }

  .user-message .message-bubble {
    background-color: #007bff;
    color: white;
    border-bottom-right-radius: 0.25rem;
  }

  .message-time {
    font-size: 0.75rem;
    color: #6c757d;
    padding: 0 0.5rem;
  }

  .ai-message .message-bubble h6 {
    color: #007bff !important;
    font-weight: 600;
    font-size: 0.95rem;
    margin-bottom: 0.5rem;
  }

  .ai-message .message-bubble strong {
    color: #333;
    font-weight: 600;
  }

  .ai-message .message-bubble ul {
    padding-left: 1rem;
    margin: 0.5rem 0;
  }

  .ai-message .message-bubble li {
    margin-bottom: 0.25rem;
    font-size: 0.85rem;
  }

  .chat-input .form-control {
    border-radius: 0.75rem 0 0 0.75rem;
    font-size: 0.875rem;
    resize: none;
    min-height: 2.5rem;
    border-color: #dc3545;
  }

  .chat-input .btn {
    border-radius: 0 0.75rem 0.75rem 0;
    font-size: 0.875rem;
    align-self: flex-end;
    border-color: #dc3545;
  }

  .chat-input .input-group {
    align-items: flex-end;
  }

  .chat-input .form-control:focus {
    border-color: #dc3545;
    box-shadow: 0 0 0 0.15rem rgba(220, 53, 69, 0.25);
  }

  /* Ultra Compact AI Analysis Styling */
  .compact-text {
    margin: 0.1rem 0;
    font-size: 0.85rem;
    line-height: 1.1;
    padding: 0;
  }

  .compact-list {
    margin: 0.1rem 0;
    padding-left: 0.8rem;
  }

  .compact-item {
    margin: 0.05rem 0;
    font-size: 0.85rem;
    line-height: 1.1;
    padding: 0;
  }

  /* Remove all extra spacing from AI analysis content */
  .ai-analysis-content p,
  .ai-analysis-content ul,
  .ai-analysis-content li {
    margin: 0.05rem 0 !important;
    line-height: 1.1 !important;
  }

  .ai-analysis-content {
    padding: 0.5rem !important;
  }

  .ai-analysis-content h6,
  .ai-analysis-content h5,
  .ai-analysis-content h4 {
    margin: 0.1rem 0 !important;
    line-height: 1.2 !important;
  }

  /* Bootstrap 5 utility classes used for card styling */
  .max-height-300 {
    max-height: 300px;
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
    color: var(--bs-body-color);
  }
  
  .recommendations-text h6,
  .suggestions-text h6,
  .analysis-text h6 {
    color: var(--bs-primary) !important;
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
    color: var(--bs-body-color);
    font-weight: 600;
  }
  
  .recommendations-text em,
  .suggestions-text em,
  .analysis-text em {
    color: var(--bs-secondary);
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
    color: var(--bs-primary);
  }
  
  .recommendations-text br + •,
  .suggestions-text br + •,
  .analysis-text br + • {
    display: block;
    margin-top: 0.5rem;
    margin-bottom: 0.25rem;
  }
</style>
