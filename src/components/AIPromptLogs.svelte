<!-- AI Prompt Logs Component for Admin Panel -->
<script>
  import { onMount, onDestroy } from 'svelte'
  import openaiService from '../services/openaiService.js'
  import { collection, query, orderBy, limit, onSnapshot, getDocs, addDoc } from 'firebase/firestore'
  import { db } from '../firebase-config.js'

  let aiPrompts = []
  let loading = true
  let error = ''
  let selectedPrompt = null
  let showPromptDetails = false
  let unsubscribe = null
  
  // Pagination for AI prompts
  let currentPage = 1
  let itemsPerPage = 25
  
  // Pagination calculations
  $: totalPages = Math.ceil(aiPrompts.length / itemsPerPage)
  $: startIndex = (currentPage - 1) * itemsPerPage
  $: endIndex = startIndex + itemsPerPage
  $: paginatedPrompts = aiPrompts.slice(startIndex, endIndex)
  
  // Reset to first page when prompts change
  $: if (aiPrompts.length > 0) {
    currentPage = 1
  }
  
  // Pagination functions
  const goToPage = (page) => {
    if (page >= 1 && page <= totalPages) {
      currentPage = page
    }
  }
  
  const goToPreviousPage = () => {
    if (currentPage > 1) {
      currentPage--
    }
  }
  
  const goToNextPage = () => {
    if (currentPage < totalPages) {
      currentPage++
    }
  }

  onMount(async () => {
    await loadAIPrompts()
    setupRealtimeListener()
  })

  onDestroy(() => {
    if (unsubscribe) {
      unsubscribe()
    }
  })

  const loadAIPrompts = async () => {
    try {
      loading = true
      error = ''
      console.log('🔍 Loading AI prompts from Firebase...')
      aiPrompts = await openaiService.getLastAIPrompts(50)
      console.log('📊 Loaded AI prompts:', aiPrompts.length)
      console.log('📊 AI prompts data:', aiPrompts)
      
      if (aiPrompts.length === 0) {
        console.log('⚠️ No AI prompts found in Firebase collection "aiPromptLogs"')
        console.log('💡 This could mean:')
        console.log('   - No AI analysis has been performed yet')
        console.log('   - Firebase collection "aiPromptLogs" doesn\'t exist')
        console.log('   - There\'s an issue with the logging function')
      }
    } catch (err) {
      console.error('❌ Error loading AI prompts:', err)
      error = 'Failed to load AI prompts: ' + err.message
    } finally {
      loading = false
    }
  }

  // Setup real-time listener for new AI prompts
  const setupRealtimeListener = () => {
    try {
      console.log('🔴 Setting up real-time listener for AI prompts...')
      
      const q = query(
        collection(db, 'aiPromptLogs'),
        orderBy('timestamp', 'desc'),
        limit(50)
      )
      
      unsubscribe = onSnapshot(q, (querySnapshot) => {
        console.log('📡 Real-time update received:', querySnapshot.docs.length, 'documents')
        console.log('📡 Query snapshot metadata:', querySnapshot.metadata)
        console.log('📡 Query snapshot fromCache:', querySnapshot.metadata.fromCache)
        console.log('📡 Query snapshot hasPendingWrites:', querySnapshot.metadata.hasPendingWrites)
        
        // Log each document to see what's being received
        querySnapshot.docs.forEach((doc, index) => {
          console.log(`📄 Document ${index + 1}:`, {
            id: doc.id,
            data: doc.data(),
            timestamp: doc.data().timestamp,
            promptType: doc.data().promptType,
            requestId: doc.data().requestId
          })
        })
        
        const newPrompts = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }))
        
        console.log('📡 New prompts data:', newPrompts)
        console.log('📡 Previous aiPrompts count:', aiPrompts.length)
        console.log('📡 New aiPrompts count:', newPrompts.length)
        
        // Check if we have new entries
        const newEntries = newPrompts.filter(newPrompt => 
          !aiPrompts.some(existingPrompt => existingPrompt.id === newPrompt.id)
        )
        console.log('📡 New entries detected:', newEntries.length)
        if (newEntries.length > 0) {
          console.log('📡 New entries details:', newEntries.map(entry => ({
            id: entry.id,
            timestamp: entry.timestamp,
            promptType: entry.promptType,
            requestId: entry.requestId
          })))
        }
        
        // Update the prompts array
        aiPrompts = newPrompts
        
        // Ensure loading is false so table renders
        loading = false
        
        console.log('✅ Real-time update applied:', newPrompts.length, 'prompts')
        console.log('✅ Current aiPrompts array:', aiPrompts)
        
        // Clear any previous errors
        if (error) {
          error = ''
        }
      }, (error) => {
        console.error('❌ Real-time listener error:', error)
        console.error('❌ Error code:', error.code)
        console.error('❌ Error message:', error.message)
        error = 'Real-time updates failed: ' + error.message
        loading = false
      })
      
      console.log('✅ Real-time listener setup complete')
    } catch (err) {
      console.error('❌ Error setting up real-time listener:', err)
      error = 'Failed to setup real-time listener: ' + err.message
    }
  }

  // Refresh data manually (reloads initial data and resets real-time listener)
  const refreshData = async () => {
    try {
      console.log('🔄 Manual refresh requested...')
      
      // Unsubscribe from current listener
      if (unsubscribe) {
        unsubscribe()
        unsubscribe = null
      }
      
      // Reload initial data
      await loadAIPrompts()
      
      // Setup new real-time listener
      setupRealtimeListener()
      
      console.log('✅ Manual refresh completed')
    } catch (err) {
      console.error('❌ Error during manual refresh:', err)
      error = 'Refresh failed: ' + err.message
    }
  }
  
  

  const viewPromptDetails = (prompt) => {
    selectedPrompt = prompt
    showPromptDetails = true
  }

  const closePromptDetails = () => {
    showPromptDetails = false
    selectedPrompt = null
  }

  const formatTimestamp = (timestamp) => {
    return new Date(timestamp).toLocaleString()
  }

  const getPromptTypeColor = (type) => {
    switch (type) {
      case 'drugSuggestions': return 'teal'
      case 'drugInteractions': return 'yellow'
      case 'comprehensiveAnalysis': return 'green'
      default: return 'gray'
    }
  }

  const getSuccessIcon = (success) => {
    return success ? 'fas fa-check-circle text-teal-600' : 'fas fa-times-circle text-red-600'
  }

  // Extract prompt content from raw prompt data for older log entries
  const extractPromptFromData = (promptDataString) => {
    try {
      const promptData = JSON.parse(promptDataString)
      if (promptData.requestBody && promptData.requestBody.messages) {
        const messages = promptData.requestBody.messages
        let systemMessage = ''
        let userMessage = ''
        
        messages.forEach(msg => {
          if (msg.role === 'system') {
            systemMessage = msg.content
          } else if (msg.role === 'user') {
            userMessage = msg.content
          }
        })
        
        if (systemMessage || userMessage) {
          return `SYSTEM MESSAGE:\n${systemMessage}\n\nUSER MESSAGE:\n${userMessage}`
        }
      }
      return 'Prompt data not available in expected format'
    } catch (error) {
      return 'Error parsing prompt data: ' + error.message
    }
  }

  // Extract system message from raw prompt data
  const extractSystemMessage = (promptDataString) => {
    try {
      const promptData = JSON.parse(promptDataString)
      if (promptData.requestBody && promptData.requestBody.messages) {
        const systemMsg = promptData.requestBody.messages.find(msg => msg.role === 'system')
        return systemMsg ? systemMsg.content : ''
      }
      return ''
    } catch (error) {
      return ''
    }
  }

  // Extract user message from raw prompt data
  const extractUserMessage = (promptDataString) => {
    try {
      const promptData = JSON.parse(promptDataString)
      if (promptData.requestBody && promptData.requestBody.messages) {
        const userMsg = promptData.requestBody.messages.find(msg => msg.role === 'user')
        return userMsg ? userMsg.content : ''
      }
      return ''
    } catch (error) {
      return ''
    }
  }



  // Clean up malformed log entries
  const cleanupMalformedEntries = async () => {
    try {
      console.log('🧹 Cleaning up malformed log entries...')
      
      // Filter out entries with undefined promptType or missing data
      const validPrompts = aiPrompts.filter(prompt => 
        prompt.promptType && 
        prompt.promptType !== 'undefined' && 
        prompt.promptData && 
        prompt.promptData !== 'undefined'
      )
      
      console.log(`📊 Found ${aiPrompts.length} total prompts`)
      console.log(`✅ Found ${validPrompts.length} valid prompts`)
      console.log(`🗑️ Found ${aiPrompts.length - validPrompts.length} malformed prompts`)
      
      // Update the display to show only valid prompts
      aiPrompts = validPrompts
      
      console.log('✅ Cleanup completed')
    } catch (error) {
      console.error('❌ Error during cleanup:', error)
    }
  }

</script>

<div class="bg-white border-2 border-teal-200 rounded-lg shadow-sm">
  <div class="bg-gray-50 px-4 py-3 border-b border-gray-200">
    <div class="flex justify-between items-center">
      <div>
        <h5 class="text-lg font-semibold text-gray-900 mb-0">
          <i class="fas fa-brain mr-2 text-red-600"></i>
          AI Prompt Logs (Last 50)
        </h5>
        {#if unsubscribe}
          <small class="text-teal-600">
            <i class="fas fa-circle mr-1" style="font-size: 0.5rem;"></i>
            Real-time updates active
          </small>
        {:else}
          <small class="text-gray-500">
            <i class="fas fa-circle mr-1" style="font-size: 0.5rem;"></i>
            Real-time updates inactive
          </small>
        {/if}
      </div>
      <div class="flex gap-2">
        <button 
          class="inline-flex items-center px-3 py-2 border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 text-sm font-medium rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors duration-200 disabled:bg-gray-100 disabled:cursor-not-allowed" 
          on:click={cleanupMalformedEntries}
          disabled={loading || aiPrompts.length === 0}
        >
          <i class="fas fa-broom mr-1"></i>
          Cleanup
        </button>
        <button 
          class="inline-flex items-center px-3 py-2 border border-blue-300 text-blue-700 bg-white hover:bg-blue-50 text-sm font-medium rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors duration-200 disabled:bg-gray-100 disabled:cursor-not-allowed" 
          on:click={refreshData}
          disabled={loading}
        >
          <i class="fas fa-sync-alt mr-1"></i>
          Refresh
        </button>
      </div>
    </div>
  </div>
  
  <div class="p-4">
    {#if loading}
      <div class="text-center py-8">
        <svg class="animate-spin h-8 w-8 text-teal-600 mx-auto mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <p class="text-gray-500">Loading AI prompt logs...</p>
      </div>
    {:else if error}
      <div class="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
        <i class="fas fa-exclamation-triangle mr-2 text-red-600"></i>
        <span class="text-red-800">{error}</span>
      </div>
    {:else if aiPrompts.length === 0}
      <div class="text-center py-8">
        <i class="fas fa-inbox text-4xl text-gray-400 mb-3"></i>
        <p class="text-gray-500">No AI prompts found</p>
      </div>
    {:else}
      <!-- Desktop Table View -->
      <div class="hidden md:block overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Timestamp</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tokens</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            {#each paginatedPrompts as prompt}
              <tr class="hover:bg-gray-50">
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {formatTimestamp(prompt.timestamp)}
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-teal-100 text-blue-800">
                    {prompt.promptType || 'Unknown'}
                  </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  <div class="flex items-center">
                    <i class="{getSuccessIcon(prompt.success)}"></i>
                    <span class="ml-2">{prompt.success ? 'Success' : 'Error'}</span>
                  </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {prompt.tokensUsed || 0}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <div class="flex space-x-2">
                    <button 
                      class="text-teal-600 hover:text-blue-900 bg-blue-50 hover:bg-teal-100 px-3 py-1 rounded text-sm font-medium transition-colors duration-200"
                      on:click={() => viewPromptDetails(prompt)}
                      title="View details"
                    >
                      <i class="fas fa-eye"></i>
                    </button>
                    <button 
                      class="text-teal-600 hover:text-blue-900 bg-blue-50 hover:bg-teal-100 px-3 py-1 rounded text-sm font-medium transition-colors duration-200"
                      on:click={() => viewPromptDetails(prompt)}
                      title="View full prompt"
                    >
                      <i class="fas fa-file-text"></i>
                    </button>
                  </div>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>

      <!-- Mobile Card View -->
      <div class="md:hidden space-y-3 p-4">
        {#each paginatedPrompts as prompt}
          <div class="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <div class="flex justify-between items-start mb-3">
              <div class="flex-1">
                <h3 class="font-semibold text-gray-900 text-sm">{formatTimestamp(prompt.timestamp)}</h3>
                <p class="text-xs text-gray-500">{prompt.promptType || 'Unknown'}</p>
              </div>
              <div class="flex flex-col items-end space-y-1">
                <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-teal-100 text-blue-800">
                  {prompt.promptType || 'Unknown'}
                </span>
                <div class="flex items-center text-xs">
                  <i class="{getSuccessIcon(prompt.success)}"></i>
                  <span class="ml-1">{prompt.success ? 'Success' : 'Error'}</span>
                </div>
              </div>
            </div>
            
            <div class="space-y-2 mb-3">
              <div class="flex items-center text-xs">
                <i class="fas fa-coins text-yellow-600 mr-2 w-3"></i>
                <span class="text-gray-600 font-medium">{prompt.tokensUsed || 0} tokens</span>
              </div>
            </div>
            
            <div class="flex space-x-2">
              <button 
                class="flex-1 text-teal-600 hover:text-blue-900 bg-blue-50 hover:bg-teal-100 px-3 py-2 rounded text-xs font-medium transition-colors duration-200"
                on:click={() => viewPromptDetails(prompt)}
                title="View details"
              >
                <i class="fas fa-eye mr-1"></i>
                View
              </button>
              <button 
                class="flex-1 text-teal-600 hover:text-blue-900 bg-blue-50 hover:bg-teal-100 px-3 py-2 rounded text-xs font-medium transition-colors duration-200"
                on:click={() => viewPromptDetails(prompt)}
                title="View full prompt"
              >
                <i class="fas fa-file-text mr-1"></i>
                Full
              </button>
            </div>
          </div>
        {/each}
      </div>
      
      <!-- Pagination Controls -->
      {#if totalPages > 1}
        <div class="flex items-center justify-between mt-4 px-4 py-3 bg-gray-50 rounded-lg">
          <div class="flex items-center text-sm text-gray-700">
            <span>Showing {startIndex + 1} to {Math.min(endIndex, aiPrompts.length)} of {aiPrompts.length} prompts</span>
          </div>
          
          <div class="flex items-center space-x-2">
            <!-- Previous Button -->
            <button 
              class="inline-flex items-center px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
              on:click={goToPreviousPage}
              disabled={currentPage === 1}
            >
              <i class="fas fa-chevron-left mr-1"></i>
              Previous
            </button>
            
            <!-- Page Numbers -->
            <div class="flex items-center space-x-1">
              {#each Array.from({length: Math.min(5, totalPages)}, (_, i) => {
                const startPage = Math.max(1, currentPage - 2)
                const endPage = Math.min(totalPages, startPage + 4)
                const page = startPage + i
                return page <= endPage ? page : null
              }).filter(Boolean) as page}
                <button 
                  class="inline-flex items-center px-3 py-2 text-sm font-medium rounded-lg {currentPage === page ? 'text-white bg-teal-600 border-teal-600' : 'text-gray-500 bg-white border border-gray-300 hover:bg-gray-50 hover:text-gray-700'}"
                  on:click={() => goToPage(page)}
                >
                  {page}
                </button>
              {/each}
            </div>
            
            <!-- Next Button -->
            <button 
              class="inline-flex items-center px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
              on:click={goToNextPage}
              disabled={currentPage === totalPages}
            >
              Next
              <i class="fas fa-chevron-right ml-1"></i>
            </button>
          </div>
        </div>
      {/if}
    {/if}
  </div>
</div>

<!-- Prompt Details Modal -->
{#if showPromptDetails && selectedPrompt}
  <div class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50" tabindex="-1">
    <div class="relative top-20 mx-auto p-5 border w-11/12 max-w-6xl shadow-lg rounded-md bg-white">
      <div class="bg-teal-600 text-white px-4 py-3 rounded-t-lg">
        <div class="flex justify-between items-center">
          <h5 class="text-lg font-semibold">
            <i class="fas fa-brain mr-2"></i>
            AI Prompt Details - {selectedPrompt.promptType || 'Unknown Type'}
          </h5>
          <button 
            type="button" 
            class="text-white hover:text-gray-200 text-xl font-bold" 
            on:click={closePromptDetails}
          >
            ×
          </button>
        </div>
      </div>
      <div class="p-6">
          <!-- Full Prompt Content -->
          {#if selectedPrompt.fullPrompt || (selectedPrompt.promptData && JSON.parse(selectedPrompt.promptData).requestBody?.messages)}
            <div class="mb-6">
              <h6 class="text-teal-600 font-semibold mb-3">
                <i class="fas fa-file-text mr-2"></i>
                Complete Prompt Sent to OpenAI
              </h6>
              <div class="bg-gray-50 p-4 rounded-lg border border-gray-200" style="max-height: 300px; overflow-y: auto;">
                <pre class="text-sm text-gray-800 whitespace-pre-wrap">{selectedPrompt.fullPrompt || extractPromptFromData(selectedPrompt.promptData)}</pre>
              </div>
            </div>
          {/if}

          <!-- System and User Messages Separately -->
          {#if selectedPrompt.systemMessage || selectedPrompt.userMessage || (selectedPrompt.promptData && JSON.parse(selectedPrompt.promptData).requestBody?.messages)}
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              {#if selectedPrompt.systemMessage || extractSystemMessage(selectedPrompt.promptData)}
                <div>
                  <h6 class="text-teal-600 font-semibold mb-3">
                    <i class="fas fa-cog mr-2"></i>
                    System Message
                  </h6>
                  <div class="bg-blue-50 p-4 rounded-lg border border-teal-200" style="max-height: 200px; overflow-y: auto;">
                    <pre class="text-sm text-blue-800 whitespace-pre-wrap">{selectedPrompt.systemMessage || extractSystemMessage(selectedPrompt.promptData)}</pre>
                  </div>
                </div>
              {/if}
              {#if selectedPrompt.userMessage || extractUserMessage(selectedPrompt.promptData)}
                <div>
                  <h6 class="text-yellow-600 font-semibold mb-3">
                    <i class="fas fa-user mr-2"></i>
                    User Message
                  </h6>
                  <div class="bg-yellow-50 p-4 rounded-lg border border-yellow-200" style="max-height: 200px; overflow-y: auto;">
                    <pre class="text-sm text-yellow-800 whitespace-pre-wrap">{selectedPrompt.userMessage || extractUserMessage(selectedPrompt.promptData)}</pre>
                  </div>
                </div>
              {/if}
            </div>
          {/if}

          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h6 class="text-teal-600 font-semibold mb-3">
                <i class="fas fa-info-circle mr-2"></i>
                Raw Request Data
              </h6>
              <div class="bg-gray-50 p-4 rounded-lg border border-gray-200" style="max-height: 200px; overflow-y: auto;">
                {#if selectedPrompt.promptData}
                  <pre class="text-sm text-gray-800">{selectedPrompt.promptData}</pre>
                {:else}
                  <p class="text-gray-500">No request data available</p>
                {/if}
              </div>
            </div>
            <div>
              <h6 class="text-teal-600 font-semibold mb-3">
                <i class="fas fa-brain mr-2 text-red-600"></i>
                AI Response
              </h6>
              <div class="bg-gray-50 p-4 rounded-lg border border-gray-200" style="max-height: 200px; overflow-y: auto;">
                {#if selectedPrompt.response}
                  <pre class="text-sm text-gray-800 whitespace-pre-wrap">{selectedPrompt.response}</pre>
                {:else}
                  <p class="text-gray-500">No response data</p>
                {/if}
              </div>
            </div>
          </div>
          
          {#if selectedPrompt.error}
            <div class="mt-6">
              <h6 class="text-red-600 font-semibold mb-3">
                <i class="fas fa-exclamation-triangle mr-2"></i>
                Error Details
              </h6>
              <div class="bg-red-50 p-4 rounded-lg border border-red-200">
                <p class="text-red-800">{selectedPrompt.error}</p>
              </div>
            </div>
          {/if}
          
          <div class="mt-6">
            <h6 class="text-teal-600 font-semibold mb-4">
              <i class="fas fa-chart-bar mr-2"></i>
              Metadata
            </h6>
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <strong class="text-gray-700">Timestamp:</strong><br>
                <span class="text-gray-500">{formatTimestamp(selectedPrompt.timestamp)}</span>
              </div>
              <div>
                <strong class="text-gray-700">Type:</strong><br>
                <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-teal-100 text-blue-800">
                  {selectedPrompt.promptType || 'Unknown'}
                </span>
              </div>
              <div>
                <strong class="text-gray-700">Status:</strong><br>
                <div class="flex items-center">
                  <i class="{getSuccessIcon(selectedPrompt.success)}"></i>
                  <span class="ml-2">{selectedPrompt.success ? 'Success' : 'Error'}</span>
                </div>
              </div>
              <div>
                <strong class="text-gray-700">Tokens Used:</strong><br>
                <span class="text-gray-500">{selectedPrompt.tokensUsed || 0}</span>
              </div>
            </div>
          </div>
      </div>
      <div class="bg-gray-50 px-6 py-3 rounded-b-lg">
        <div class="flex justify-end">
          <button 
            type="button" 
            class="inline-flex items-center px-4 py-2 border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 text-sm font-medium rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors duration-200" 
            on:click={closePromptDetails}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}
