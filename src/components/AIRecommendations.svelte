<script>
  import { createEventDispatcher } from 'svelte'
  import openaiService from '../services/openaiService.js'
  
  const dispatch = createEventDispatcher()
  
  export let symptoms = []
  export let currentMedications = []
  export let patientAge = null
  export let patientAllergies = null
  export let doctorId = null
  export let patientData = null
  
  // Expose AI diagnostics state to parent component
  export let isShowingAIDiagnostics = false
  
  let recommendations = ''
  let medicationSuggestions = ''
  let loading = false
  let error = ''
  let showRecommendations = false
  let showMedicationSuggestions = false
  let showRecommendationsInline = false
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
      const combinedResult = await openaiService.generateCombinedAnalysis(symptoms, currentMedications, patientAge, doctorId, patientAllergies, patientData?.gender, patientData?.longTermMedications)
      
      // Parse the combined result
      const combinedAnalysis = combinedResult.combinedAnalysis || combinedResult
      recommendations = combinedAnalysis
      medicationSuggestions = combinedAnalysis // Same content for both sections
      showCombinedAnalysis = true
      showRecommendationsInline = false
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
  
  
  // Close combined analysis
  const closeCombinedAnalysis = () => {
    showCombinedAnalysis = false
    recommendations = ''
    medicationSuggestions = ''
    isShowingAIDiagnostics = false
  }
  
  // Check if OpenAI is configured
  $: isOpenAIConfigured = openaiService.isConfigured()
  
  // Format AI recommendations for better display with enhanced formatting
  const formatRecommendations = (text) => {
    if (!text) return ''
    
    // First, convert markdown-style formatting to HTML
    let formattedText = text
      // Convert headers with emojis and proper styling
      .replace(/\*\*([📋🔍⚠️🎯📈🚨📝][^:]+):\*\*/g, '<h6 class="text-primary mb-2 mt-3 fw-bold">$1:</h6>')
      // Convert other bold headers
      .replace(/\*\*([^:]+):\*\*/g, '<h6 class="text-secondary mb-2 mt-3 fw-bold">$1:</h6>')
      // Convert bold text
      .replace(/\*\*([^*]+)\*\*/g, '<strong class="fw-semibold">$1</strong>')
      // Convert italic text
      .replace(/\*([^*]+)\*/g, '<em class="fst-italic">$1</em>')
      
    // Handle bullet points and lists
    formattedText = formattedText
      // Convert bullet points to proper HTML lists
      .replace(/^[\s]*[-•]\s(.+)$/gm, '<li class="mb-1">$1</li>')
      // Convert numbered lists
      .replace(/^[\s]*(\d+\.)\s(.+)$/gm, '<li class="mb-1"><strong>$1</strong> $2</li>')
      
    // Wrap consecutive list items in ul tags
    formattedText = formattedText.replace(/(<li[^>]*>.*<\/li>(\s*<li[^>]*>.*<\/li>)*)/gs, '<ul class="mb-2">$1</ul>')
    
    // Handle line breaks and paragraphs
    formattedText = formattedText
      // Convert double line breaks to paragraph breaks
      .replace(/\n\n/g, '</p><p class="mb-2">')
      // Convert single line breaks to br tags
      .replace(/\n/g, '<br>')
    
    // Wrap in paragraphs and clean up
    formattedText = '<p class="mb-2">' + formattedText + '</p>'
    
    // Clean up empty elements and spacing
    formattedText = formattedText
      .replace(/<p[^>]*><\/p>/g, '')
      .replace(/<p[^>]*>\s*<\/p>/g, '')
      .replace(/<p[^>]*>\s*<h6/g, '<h6')
      .replace(/<\/h6>\s*<\/p>/g, '</h6>')
      .replace(/<p[^>]*>\s*<ul/g, '<ul')
      .replace(/<\/ul>\s*<\/p>/g, '</ul>')
      .replace(/<br>\s*<\/p>/g, '</p>')
      .replace(/<p[^>]*>\s*<br>/g, '<p class="mb-2">')
    
    return formattedText
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
      const patientGender = patientData?.gender ? `Patient gender: ${patientData.gender}` : ''
      
      const chatPrompt = `You are a medical AI assistant. Answer this question concisely and professionally: "${userMessage}". 

Context: Patient symptoms: ${symptomsText}
${patientGender}
Previous analysis summary: ${analysisSummary}

Provide a brief, focused answer (max 200 words) with clear medical guidance. Use proper formatting with headers, bullet points, and structured sections when appropriate. Consider patient gender in your recommendations when medically relevant.`

      console.log('🤖 Chat request:', { userMessage, symptomsText, analysisSummary })

      const response = await openaiService.makeOpenAIRequest('chat/completions', {
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a medical AI assistant. Provide concise, professional medical guidance. Keep responses brief and focused (under 200 words). ALWAYS use proper formatting with **bold headers**, bullet points (- or •), and structured sections when appropriate. Format your responses with clear headings and organized information for better readability. Consider patient gender when providing medically relevant recommendations and consider gender-specific medication effects and contraindications.'
          },
          {
            role: 'user',
            content: chatPrompt
          }
        ],
        max_tokens: 400,
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
  
  
  <!-- Combined AI Analysis -->
  {#if showCombinedAnalysis}
    <div class="ai-combined-analysis mt-3">
      <div class="card border-primary">
        <div class="card-header bg-light text-dark">
          <div class="d-flex justify-content-between align-items-center">
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
        </div>
        
        <div class="card-body p-3">
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
          
          <!-- Divider between analysis and chat -->
          <hr class="my-4">
          
          <!-- AI Chatbot Interface -->
          <div class="ai-chatbot-interface">
            <div class="d-flex align-items-center mb-3">
              <i class="fas fa-comments me-2 text-primary"></i>
              <h6 class="mb-0 text-primary">Ask AI Assistant</h6>
            </div>
            
            <div class="chat-messages mb-3" id="chatMessages">
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
                  class="btn btn-primary" 
                  type="button"
                  style="background-color: #007bff !important; border-color: #007bff !important; color: white !important;"
                  on:click={sendChatMessage}
                  disabled={!chatMessage.trim() || chatLoading}
                >
                  {#if chatLoading}
                    <span class="spinner-border spinner-border-sm me-1" role="status"></span>
                    Sending...
                  {:else}
                    <i class="fas fa-paper-plane me-1"></i>
                    Send
                  {/if}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>

  /* Chatbot Interface Styling - Unified Card Format */
  .ai-chatbot-interface {
    margin-top: 0;
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
    max-width: 100%;
    width: 100%;
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
    padding: 0.75rem 1rem !important;
    border-radius: 1rem !important;
    word-wrap: break-word;
    font-size: 0.9rem;
    line-height: 1.4;
    max-width: 100%;
    position: relative;
    overflow: hidden;
  }

  .ai-message .message-bubble {
    background-color: #f8f9fa !important;
    color: #333 !important;
    border: 1px solid #dee2e6 !important;
    border-bottom-left-radius: 0.25rem !important;
    box-shadow: 0 1px 3px rgba(0,0,0,0.1) !important;
  }

  .user-message .message-bubble {
    background-color: #007bff !important;
    color: white !important;
    border: none !important;
    border-bottom-right-radius: 0.25rem !important;
    box-shadow: 0 1px 3px rgba(0,123,255,0.2) !important;
  }

  .message-time {
    font-size: 0.75rem;
    color: #6c757d;
    padding: 0 0.5rem;
  }

  /* Override any conflicting styles for chat bubbles */
  .chat-messages .message .message-bubble {
    background-color: #f8f9fa !important;
    border: 1px solid #dee2e6 !important;
    color: #333 !important;
  }
  
  .chat-messages .user-message .message-bubble {
    background-color: #007bff !important;
    border: none !important;
    color: white !important;
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
    height: 2.5rem;
    border-color: #dee2e6 !important;
    border: 1px solid #dee2e6 !important;
  }

  .chat-input .btn,
  .chat-input .btn-primary,
  .chat-input .btn-danger {
    border-radius: 0 0.75rem 0.75rem 0 !important;
    font-size: 0.875rem !important;
    align-self: stretch !important;
    height: 2.5rem !important;
    min-height: 2.5rem !important;
    min-width: 4rem !important;
    padding: 0.375rem 0.75rem !important;
    border-color: #007bff !important;
    border: 1px solid #007bff !important;
    background-color: #007bff !important;
    color: white !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
  }

  .chat-input .input-group {
    align-items: stretch;
  }
  
  /* Ensure clean input styling */
  .chat-input .input-group .form-control {
    border-right: none !important;
  }
  
  .chat-input .input-group .btn {
    border-left: none !important;
  }
  
  /* Button hover and disabled states */
  .chat-input .btn:hover {
    background-color: #0056b3 !important;
    border-color: #0056b3 !important;
  }
  
  .chat-input .btn:disabled {
    background-color: #6c757d !important;
    border-color: #6c757d !important;
    opacity: 0.65 !important;
  }

  .chat-input .form-control:focus {
    border-color: #007bff !important;
    box-shadow: 0 0 0 0.15rem rgba(0, 123, 255, 0.25) !important;
    outline: none !important;
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
