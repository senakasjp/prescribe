<script>
  import { createEventDispatcher } from 'svelte'
  import openaiService from '../services/openaiService.js'
  import aiTokenTracker from '../services/aiTokenTracker.js'
  
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
  let reportAnalyses = []
  
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
      
      reportAnalyses = await openaiService.analyzeReportImages(patientData?.recentReports || [], {
        patientCountry: patientData?.country || 'Not specified',
        doctorCountry: patientData?.doctorCountry || 'Not specified'
      })

      // Use single API call for both recommendations and medication suggestions
      const combinedResult = await openaiService.generateCombinedAnalysis(symptoms, currentMedications, patientAge, doctorId, patientAllergies, patientData?.gender, patientData?.longTermMedications, {
        patientCountry: patientData?.country || 'Not specified',
        currentActiveMedications: patientData?.currentActiveMedications || [],
        recentPrescriptions: patientData?.recentPrescriptions || [],
        recentReports: patientData?.recentReports || [],
        reportAnalyses: reportAnalyses,
        doctorCountry: patientData?.doctorCountry || 'Not specified'
      })
      
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
      .replace(/\*\*([📋🔍⚠️🎯📈🚨📝][^:]+):\*\*/g, '<h6 class="text-blue-600 mb-2 mt-3 fw-bold">$1:</h6>')
      // Convert other bold headers
      .replace(/\*\*([^:]+):\*\*/g, '<h6 class="text-gray-600 mb-2 mt-3 fw-bold">$1:</h6>')
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
      const allergiesText = patientAllergies ? `Patient allergies: ${patientAllergies}` : 'Patient allergies: None'
      const recentPrescriptions = Array.isArray(patientData?.recentPrescriptions) && patientData.recentPrescriptions.length > 0
        ? patientData.recentPrescriptions.map((prescription, index) => {
            if (typeof prescription === 'string') {
              return `${index + 1}) ${prescription}`
            }
            const date = prescription?.date || prescription?.createdAt || prescription?.updatedAt || 'Unknown date'
            const medications = Array.isArray(prescription?.medications)
              ? prescription.medications.map(med => [med?.name, med?.dosage, med?.frequency, med?.duration].filter(Boolean).join(' ')).filter(Boolean).join('; ')
              : ''
            return `${index + 1}) ${date}: ${medications || 'No medications listed'}`
          }).join('\n')
        : 'None'
      const recentReports = Array.isArray(patientData?.recentReports) && patientData.recentReports.length > 0
        ? patientData.recentReports.map((report, index) => {
            if (typeof report === 'string') {
              return `${index + 1}) ${report}`
            }
            const date = report?.date || report?.createdAt || 'Unknown date'
            const title = report?.title || 'Untitled report'
            const type = report?.type || 'unknown'
            const filename = report?.filename ? `File: ${report.filename}` : ''
            const notes = report?.content ? `Notes: ${report.content}` : ''
            const details = [title, filename, notes].filter(Boolean).join(' | ')
            return `${index + 1}) ${date} (${type}): ${details || 'No details'}`
          }).join('\n')
        : 'None'
      const reportAnalysesText = Array.isArray(reportAnalyses) && reportAnalyses.length > 0
        ? reportAnalyses.map((report, index) => `${index + 1}) ${report.date || 'Unknown date'}: ${report.title || 'Untitled'} - ${report.analysis || 'No analysis'}`).join('\n')
        : 'None'
      
      const chatPrompt = `You are a medical AI assistant. Answer this question concisely and professionally: "${userMessage}". 

Context: Patient symptoms: ${symptomsText}
${patientGender}
${allergiesText}
Recent prescriptions (last 3): ${recentPrescriptions}
Recent reports (last 3): ${recentReports}
Report analyses (last 3): ${reportAnalysesText}
Previous analysis summary: ${analysisSummary}

Provide a brief, focused answer (max 200 words) with clear medical guidance. Use proper formatting with headers, bullet points, and structured sections when appropriate. Consider patient gender and allergies in your recommendations when medically relevant.`

      console.log('🤖 Chat request:', { userMessage, symptomsText, analysisSummary })

      const response = await openaiService.makeOpenAIRequest('chat/completions', {
model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a medical AI assistant. Provide concise, professional medical guidance. Keep responses brief and focused (under 200 words). ALWAYS use proper formatting with **bold headers**, bullet points (- or •), and structured sections when appropriate. Format your responses with clear headings and organized information for better readability. Consider patient gender, allergies, and recent prescription history when providing medically relevant recommendations and consider gender-specific medication effects and contraindications.'
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
        doctorId: doctorId,
        patientAllergies: patientAllergies,
        recentPrescriptions: patientData?.recentPrescriptions || [],
        recentReports: patientData?.recentReports || [],
        reportAnalyses: reportAnalyses
      })

      // Track token usage for chat
      if (response.usage && !response.__fromCache) {
        aiTokenTracker.trackUsage(
          'chatbotResponse',
          response.usage.prompt_tokens,
          response.usage.completion_tokens,
          'gpt-4o-mini',
          doctorId
        )
      }
      
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
    <div class="mb-4 text-center">
      <button 
        class="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors duration-200 disabled:bg-gray-400 disabled:cursor-not-allowed"
        on:click={generateComprehensiveAnalysis}
        disabled={loading || !isOpenAIConfigured}
        title="Generate comprehensive AI analysis including medical recommendations and medication suggestions"
      >
        {#if loading}
          <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        {/if}
        <i class="fas fa-brain mr-2 text-red-400"></i>
        AI Assistant
      </button>
    </div>
  {:else if !isShowingAIDiagnostics}
    <div class="mb-4">
      <div class="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center" role="alert">
        <i class="fas fa-info-circle mr-2 text-blue-600"></i>
        <span class="font-medium text-blue-800">No Symptoms Available:</span> <span class="text-blue-700">Please add symptoms in the Symptoms tab first to enable AI analysis.</span>
      </div>
    </div>
  {/if}
  
  <!-- Error Message -->
  {#if error}
    <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4" role="alert">
      <div class="flex justify-between items-start">
        <div class="flex">
          <i class="fas fa-exclamation-triangle mr-2 text-yellow-600 mt-0.5"></i>
          <span class="text-yellow-800">{error}</span>
        </div>
        <button type="button" class="text-yellow-600 hover:text-yellow-800 focus:outline-none focus:ring-4 focus:ring-yellow-300 rounded-lg transition-all duration-200" on:click={() => error = ''}>
          <i class="fas fa-times"></i>
        </button>
      </div>
    </div>
  {/if}
  
  <!-- OpenAI Configuration Warning -->
  {#if !isOpenAIConfigured}
    <div class="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4" role="alert">
      <i class="fas fa-info-circle mr-2 text-blue-600"></i>
      <span class="font-medium text-blue-800">AI Features Disabled:</span> <span class="text-blue-700">To enable AI recommendations, please configure your OpenAI API key in the environment variables (VITE_OPENAI_API_KEY).</span>
    </div>
  {/if}
  
  <!-- Inline AI Recommendations -->
  {#if showRecommendationsInline}
    <div class="ai-recommendations-inline mt-4">
      <div class="flex justify-between items-center mb-4">
        <h6 class="text-lg font-semibold text-red-600 mb-0">
          <i class="fas fa-brain mr-2 text-red-600"></i>AI-Powered Medical Intelligence
        </h6>
        <button 
          type="button" 
          class="text-gray-600 hover:text-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-500 rounded" 
          on:click={closeRecommendationsInline}
          title="Close recommendations"
        >
          <i class="fas fa-times"></i>
        </button>
      </div>
      
      <div>
        <div class="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4" role="alert">
          <i class="fas fa-info-circle mr-2 text-blue-600"></i>
          <span class="font-medium text-blue-800">Disclaimer:</span> <span class="text-blue-700">These recommendations are generated by AI and are for informational purposes only. They should not replace professional medical consultation.</span>
        </div>
        
        <div class="max-h-80 overflow-auto p-4 bg-gray-50 rounded-lg border border-gray-200">
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
    <div class="ai-combined-analysis mt-4">
      <div class="bg-white border-2 border-blue-200 rounded-lg shadow-sm">
        <div class="bg-gray-50 px-4 py-3 border-b border-gray-200">
          <div class="flex justify-between items-center">
            <h6 class="text-lg font-semibold text-red-600 mb-0">
              <i class="fas fa-brain mr-2 text-red-600"></i>AI-Powered Medical Intelligence
            </h6>
            <button 
              type="button" 
              class="text-gray-600 hover:text-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-500 rounded" 
              on:click={closeCombinedAnalysis}
              title="Close AI analysis"
            >
              <i class="fas fa-times"></i>
            </button>
          </div>
        </div>
        
        <div class="p-4">
          <div class="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4" role="alert">
            <i class="fas fa-info-circle mr-2 text-blue-600"></i>
            <span class="font-medium text-blue-800">Disclaimer:</span> <span class="text-blue-700">This analysis is generated by AI and is for informational purposes only. It should not replace professional medical consultation.</span>
          </div>
          
          <!-- Single Combined Analysis -->
          {#if recommendations}
            <div class="mb-6">
              <div class="p-4 bg-gray-50 rounded-lg border border-gray-200">
                <div class="analysis-text">
                  {@html formatRecommendations(recommendations)}
                </div>
              </div>
            </div>
          {/if}
          
          <!-- Divider between analysis and chat -->
          <hr class="my-6 border-gray-200">
          
          <!-- AI Chatbot Interface -->
          <div class="ai-chatbot-interface">
            <div class="flex items-center mb-4">
              <i class="fas fa-comments mr-2 text-blue-600"></i>
              <h6 class="text-lg font-semibold text-blue-600 mb-0">Ask AI Assistant</h6>
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
                      <i class="fas fa-brain text-red-600"></i>
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
                    <i class="fas fa-brain text-danger"></i>
                  </div>
                  <div class="message-content">
                    <div class="message-bubble">
                      <div class="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Thinking...
                    </div>
                  </div>
                </div>
              {/if}
            </div>
            
            <div class="chat-input">
              <div class="flex">
                <textarea 
                  class="flex-1 px-3 py-2 border border-gray-300 rounded-l-lg text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none" 
                  placeholder="Ask a question about the analysis..."
                  bind:value={chatMessage}
                  rows="2"
                  on:keydown={(e) => e.key === 'Enter' && !e.shiftKey && sendChatMessage()}
                ></textarea>
                <button 
                  class="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-r-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors duration-200 disabled:bg-gray-400 disabled:cursor-not-allowed" 
                  type="button"
                  on:click={sendChatMessage}
                  disabled={!chatMessage.trim() || chatLoading}
                >
                  {#if chatLoading}
                    <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Sending...
                  {:else}
                    <i class="fas fa-paper-plane mr-1"></i>
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
  /* Chatbot Interface Styling */
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
    background: linear-gradient(135deg, #3b82f6, #1d4ed8);
    color: white;
  }

  .user-message .message-avatar {
    background: linear-gradient(135deg, #36807a, #2d6b63);
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
    padding: 0.75rem 1rem;
    border-radius: 1rem;
    word-wrap: break-word;
    font-size: 0.9rem;
    line-height: 1.4;
    max-width: 100%;
    position: relative;
    overflow: hidden;
  }

  .ai-message .message-bubble {
    background-color: #f8f9fa;
    color: #333;
    border: 1px solid #dee2e6;
    border-bottom-left-radius: 0.25rem;
    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  }

  .user-message .message-bubble {
    background-color: #3b82f6;
    color: white;
    border: none;
    border-bottom-right-radius: 0.25rem;
    box-shadow: 0 1px 3px rgba(59,130,246,0.2);
  }

  .message-time {
    font-size: 0.75rem;
    color: #6b7280;
    padding: 0 0.5rem;
  }

  /* Custom styles for AI recommendations */
</style>
