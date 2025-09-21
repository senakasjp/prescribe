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
      case 'drugSuggestions': return 'info'
      case 'drugInteractions': return 'warning'
      case 'comprehensiveAnalysis': return 'success'
      default: return 'secondary'
    }
  }

  const getSuccessIcon = (success) => {
    return success ? 'fas fa-check-circle text-success' : 'fas fa-times-circle text-danger'
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

<div class="card">
  <div class="card-header d-flex justify-content-between align-items-center">
    <div>
      <h5 class="mb-0">
        <i class="fas fa-brain me-2 text-danger"></i>
        AI Prompt Logs (Last 50)
      </h5>
      {#if unsubscribe}
        <small class="text-success">
          <i class="fas fa-circle me-1" style="font-size: 0.5rem;"></i>
          Real-time updates active
        </small>
      {:else}
        <small class="text-muted">
          <i class="fas fa-circle me-1" style="font-size: 0.5rem;"></i>
          Real-time updates inactive
        </small>
      {/if}
    </div>
    <div class="d-flex gap-2">
      <button 
        class="btn btn-outline-secondary btn-sm" 
        on:click={cleanupMalformedEntries}
        disabled={loading || aiPrompts.length === 0}
      >
        <i class="fas fa-broom me-1"></i>
        Cleanup
      </button>
      <button 
        class="btn btn-outline-primary btn-sm" 
        on:click={refreshData}
        disabled={loading}
      >
        <i class="fas fa-sync-alt me-1"></i>
        Refresh
      </button>
    </div>
  </div>
  
  <div class="card-body">
    {#if loading}
      <div class="text-center py-4">
        <div class="spinner-border text-primary" role="status">
          <span class="visually-hidden">Loading...</span>
        </div>
        <p class="mt-2 text-muted">Loading AI prompt logs...</p>
      </div>
    {:else if error}
      <div class="alert alert-danger">
        <i class="fas fa-exclamation-triangle me-2"></i>
        {error}
      </div>
    {:else if aiPrompts.length === 0}
      <div class="text-center py-4">
        <i class="fas fa-inbox fa-3x text-muted mb-3"></i>
        <p class="text-muted">No AI prompts found</p>
      </div>
    {:else}
      <div class="table-responsive">
        <table class="table table-hover">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Type</th>
              <th>Status</th>
              <th>Tokens</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {#each aiPrompts as prompt}
              <tr>
                <td class="text-muted small">
                  {formatTimestamp(prompt.timestamp)}
                </td>
                <td>
                  <span class="badge bg-{getPromptTypeColor(prompt.promptType)}">
                    {prompt.promptType || 'Unknown'}
                  </span>
                </td>
                <td>
                  <i class="{getSuccessIcon(prompt.success)}"></i>
                  {prompt.success ? 'Success' : 'Error'}
                </td>
                <td class="text-muted">
                  {prompt.tokensUsed || 0}
                </td>
                <td>
                  <div class="btn-group" role="group">
                    <button 
                      class="btn btn-outline-primary btn-sm"
                      on:click={() => viewPromptDetails(prompt)}
                      title="View details"
                    >
                      <i class="fas fa-eye"></i>
                    </button>
                    <button 
                      class="btn btn-outline-info btn-sm"
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
    {/if}
  </div>
</div>

<!-- Prompt Details Modal -->
{#if showPromptDetails && selectedPrompt}
  <div class="modal show d-block" tabindex="-1" style="background-color: rgba(0,0,0,0.5);">
    <div class="modal-dialog modal-xl">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title">
            <i class="fas fa-brain me-2 text-danger"></i>
            AI Prompt Details - {selectedPrompt.promptType || 'Unknown Type'}
          </h5>
          <button 
            type="button" 
            class="btn-close" 
            on:click={closePromptDetails}
          ></button>
        </div>
        <div class="modal-body">
          <!-- Full Prompt Content -->
          {#if selectedPrompt.fullPrompt || (selectedPrompt.promptData && JSON.parse(selectedPrompt.promptData).requestBody?.messages)}
            <div class="mb-4">
              <h6 class="text-primary">
                <i class="fas fa-file-text me-2"></i>
                Complete Prompt Sent to OpenAI
              </h6>
              <div class="bg-light p-3 rounded" style="max-height: 300px; overflow-y: auto;">
                <pre class="mb-0 small text-wrap" style="white-space: pre-wrap;">{selectedPrompt.fullPrompt || extractPromptFromData(selectedPrompt.promptData)}</pre>
              </div>
            </div>
          {/if}

          <!-- System and User Messages Separately -->
          {#if selectedPrompt.systemMessage || selectedPrompt.userMessage || (selectedPrompt.promptData && JSON.parse(selectedPrompt.promptData).requestBody?.messages)}
            <div class="row mb-4">
              {#if selectedPrompt.systemMessage || extractSystemMessage(selectedPrompt.promptData)}
                <div class="col-md-6">
                  <h6 class="text-info">
                    <i class="fas fa-cog me-2"></i>
                    System Message
                  </h6>
                  <div class="bg-info bg-opacity-10 p-3 rounded" style="max-height: 200px; overflow-y: auto;">
                    <pre class="mb-0 small text-wrap" style="white-space: pre-wrap;">{selectedPrompt.systemMessage || extractSystemMessage(selectedPrompt.promptData)}</pre>
                  </div>
                </div>
              {/if}
              {#if selectedPrompt.userMessage || extractUserMessage(selectedPrompt.promptData)}
                <div class="col-md-6">
                  <h6 class="text-warning">
                    <i class="fas fa-user me-2"></i>
                    User Message
                  </h6>
                  <div class="bg-warning bg-opacity-10 p-3 rounded" style="max-height: 200px; overflow-y: auto;">
                    <pre class="mb-0 small text-wrap" style="white-space: pre-wrap;">{selectedPrompt.userMessage || extractUserMessage(selectedPrompt.promptData)}</pre>
                  </div>
                </div>
              {/if}
            </div>
          {/if}

          <div class="row">
            <div class="col-md-6">
              <h6 class="text-primary">
                <i class="fas fa-info-circle me-2"></i>
                Raw Request Data
              </h6>
              <div class="bg-light p-3 rounded" style="max-height: 200px; overflow-y: auto;">
                {#if selectedPrompt.promptData}
                  <pre class="mb-0 small">{selectedPrompt.promptData}</pre>
                {:else}
                  <p class="text-muted mb-0">No request data available</p>
                {/if}
              </div>
            </div>
            <div class="col-md-6">
              <h6 class="text-success">
                <i class="fas fa-brain me-2 text-danger"></i>
                AI Response
              </h6>
              <div class="bg-light p-3 rounded" style="max-height: 200px; overflow-y: auto;">
                {#if selectedPrompt.response}
                  <pre class="mb-0 small text-wrap" style="white-space: pre-wrap;">{selectedPrompt.response}</pre>
                {:else}
                  <p class="text-muted mb-0">No response data</p>
                {/if}
              </div>
            </div>
          </div>
          
          {#if selectedPrompt.error}
            <div class="mt-3">
              <h6 class="text-danger">
                <i class="fas fa-exclamation-triangle me-2"></i>
                Error Details
              </h6>
              <div class="bg-danger bg-opacity-10 p-3 rounded">
                <p class="text-danger mb-0">{selectedPrompt.error}</p>
              </div>
            </div>
          {/if}
          
          <div class="mt-3">
            <h6 class="text-info">
              <i class="fas fa-chart-bar me-2"></i>
              Metadata
            </h6>
            <div class="row">
              <div class="col-md-3">
                <strong>Timestamp:</strong><br>
                <span class="text-muted">{formatTimestamp(selectedPrompt.timestamp)}</span>
              </div>
              <div class="col-md-3">
                <strong>Type:</strong><br>
                <span class="badge bg-{getPromptTypeColor(selectedPrompt.promptType)}">
                  {selectedPrompt.promptType || 'Unknown'}
                </span>
              </div>
              <div class="col-md-3">
                <strong>Status:</strong><br>
                <i class="{getSuccessIcon(selectedPrompt.success)}"></i>
                {selectedPrompt.success ? 'Success' : 'Error'}
              </div>
              <div class="col-md-3">
                <strong>Tokens Used:</strong><br>
                <span class="text-muted">{selectedPrompt.tokensUsed || 0}</span>
              </div>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button 
            type="button" 
            class="btn btn-secondary btn-sm" 
            on:click={closePromptDetails}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}
