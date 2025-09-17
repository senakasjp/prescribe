<!-- AI Prompt Logs Component for Admin Panel -->
<script>
  import { onMount } from 'svelte'
  import openaiService from '../services/openaiService.js'

  let aiPrompts = []
  let loading = true
  let error = ''
  let selectedPrompt = null
  let showPromptDetails = false

  onMount(async () => {
    await loadAIPrompts()
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

  // Test Firebase connection directly
  const testFirebaseConnection = async () => {
    try {
      console.log('🔥 Testing Firebase connection directly...')
      
      // Import Firebase functions directly
      const { collection, addDoc, getDocs, query, orderBy, limit } = await import('firebase/firestore')
      const { db } = await import('../firebase-config.js')
      
      console.log('📡 Firebase imports successful')
      
      // Test writing to collection
      const testDoc = {
        testType: 'firebase_connection_test',
        timestamp: new Date().toISOString(),
        message: 'Testing Firebase write access',
        success: true
      }
      
      console.log('📝 Writing test document to Firebase...')
      const docRef = await addDoc(collection(db, 'aiPromptLogs'), testDoc)
      console.log('✅ Test document written with ID:', docRef.id)
      
      // Test reading from collection
      console.log('📖 Reading from Firebase collection...')
      const q = query(collection(db, 'aiPromptLogs'), orderBy('timestamp', 'desc'), limit(5))
      const querySnapshot = await getDocs(q)
      const docs = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
      
      console.log('📊 Retrieved documents:', docs.length)
      console.log('📊 Document data:', docs)
      
      // Reload prompts to see if the test document appears
      await loadAIPrompts()
      
      console.log('✅ Firebase connection test completed successfully')
    } catch (error) {
      console.error('❌ Firebase connection test failed:', error)
      console.error('❌ Error details:', error.message)
      console.error('❌ Error code:', error.code)
      console.error('❌ Error stack:', error.stack)
    }
  }

  // Verify data integrity of saved prompts
  const verifyPromptData = async () => {
    try {
      console.log('🔍 Verifying prompt data integrity...')
      
      if (aiPrompts.length === 0) {
        console.log('⚠️ No prompts to verify')
        return
      }
      
      // Check each prompt's data structure
      aiPrompts.forEach((prompt, index) => {
        console.log(`📋 Prompt ${index + 1} verification:`)
        console.log('  - ID:', prompt.id)
        console.log('  - Type:', prompt.promptType)
        console.log('  - Timestamp:', prompt.timestamp)
        console.log('  - Success:', prompt.success)
        console.log('  - Tokens:', prompt.tokensUsed)
        console.log('  - Has Prompt Data:', !!prompt.promptData)
        console.log('  - Has Response:', !!prompt.response)
        console.log('  - Has Error:', !!prompt.error)
        
        // Verify prompt data structure
        if (prompt.promptData) {
          try {
            const parsedData = JSON.parse(prompt.promptData)
            console.log('  - Prompt Data Keys:', Object.keys(parsedData))
            console.log('  - Prompt Data Size:', prompt.promptData.length, 'characters')
          } catch (e) {
            console.log('  - ❌ Prompt Data Parse Error:', e.message)
          }
        }
        
        // Verify response data
        if (prompt.response) {
          try {
            const parsedResponse = JSON.parse(prompt.response)
            console.log('  - Response Type:', typeof parsedResponse)
            console.log('  - Response Size:', prompt.response.length, 'characters')
          } catch (e) {
            console.log('  - Response is plain text (not JSON)')
            console.log('  - Response Size:', prompt.response.length, 'characters')
          }
        }
        
        console.log('  - ✅ Prompt verification complete')
        console.log('---')
      })
      
      console.log('✅ All prompts verified successfully')
    } catch (error) {
      console.error('❌ Error verifying prompt data:', error)
    }
  }

  // Test function to create a sample AI prompt log
  const createTestPrompt = async () => {
    try {
      console.log('🧪 Creating comprehensive test AI prompt log...')
      
      // Create a more comprehensive test log entry
      const testPromptData = {
        patientData: {
          name: 'Test Patient',
          age: 30,
          weight: 70,
          allergies: 'None',
          medications: ['Paracetamol', 'Ibuprofen'],
          symptoms: ['Fever', 'Headache'],
          illnesses: ['Common Cold']
        },
        doctorId: 'test-doctor-123',
        timestamp: new Date().toISOString(),
        testType: 'comprehensive_analysis_test'
      }
      
      const testResponse = 'This is a comprehensive test response from AI analysis system. It includes detailed medical recommendations and safety assessments.'
      
      // Test the logging function directly with full prompt structure
      console.log('🔍 Testing logAIPrompt function...')
      const testRequestData = {
        endpoint: 'chat/completions',
        requestBody: {
          model: 'gpt-4o',
          messages: [
            {
              role: 'system',
              content: 'Medical AI assistant providing second opinion support to qualified doctors. Provide comprehensive prescription analysis with HTML formatting.'
            },
            {
              role: 'user',
              content: `Analyze prescription case as second opinion support for qualified doctor. Use HTML format only.

PATIENT INFORMATION:
Name: Test Patient (Test Patient)
Age: 30, Weight: 70kg, Height: 175cm
Gender: Male, Blood Group: A+
Date of Birth: 1994-01-01

MEDICAL INFORMATION:
Allergies: None
Medical History: None
Current Medications: None
Emergency Contact: Not specified

LOCATION INFORMATION:
Patient Address: Test Address
Patient City: Test City
Patient Country: Test Country
Patient Phone: +1234567890
Patient Email: test@example.com

DOCTOR INFORMATION:
Doctor Name: Dr. Test Doctor
Doctor Country: Test Country
Doctor City: Test City
Doctor Specialization: General Practice
Doctor License: MD123456

CURRENT PRESCRIPTION:
Medications: Paracetamol 500mg TID for headache
Symptoms: Headache (moderate, 2 days, throbbing pain)
Conditions: None
Prescription Date: 2024-01-15T10:30:00.000Z

Format response as:
<h6>📋 OVERVIEW</h6><p>[Brief assessment]</p>
<h6>🔍 MEDICATIONS</h6><ul><li><strong>[Drug]:</strong> [Assessment]</li></ul>
<h6>⚠️ SAFETY</h6><div class="warning"><ul><li><strong>Interactions:</strong> [Key issues]</li><li><strong>Monitoring:</strong> [Required]</li></ul></div>
<h6>🎯 EFFECTIVENESS</h6><ul><li><strong>Alignment:</strong> [Symptom coverage]</li><li><strong>Outcomes:</strong> [Expected results]</li></ul>
<h6>📈 RECOMMENDATIONS</h6><div class="recommendation"><ul><li><strong>Adjustments:</strong> [Dosage changes]</li><li><strong>Follow-up:</strong> [Schedule]</li></ul></div>
<h6>🚨 WARNINGS</h6><div class="warning"><ul><li><strong>Critical:</strong> [Safety issues]</li><li><strong>Emergency:</strong> [When to seek help]</li></ul></div>
<h6>📝 NOTES</h6><div class="highlight"><ul><li><strong>Clinical:</strong> [Key points]</li><li><strong>Education:</strong> [Patient instructions]</li></ul></div>

Be concise. HTML only.`
            }
          ],
          max_tokens: 1200,
          temperature: 0.1
        },
        requestId: 'test-' + Date.now(),
        timestamp: new Date().toISOString(),
        testType: 'comprehensive_analysis_test'
      }
      
      await openaiService.logAIPrompt('comprehensiveAnalysis', testRequestData, testResponse, null)
      console.log('✅ Comprehensive test prompt created successfully')
      console.log('📊 Test data saved:', {
        promptType: 'comprehensiveAnalysis',
        promptDataSize: JSON.stringify(testPromptData).length,
        responseSize: testResponse.length,
        timestamp: testPromptData.timestamp
      })
      
      // Wait a moment for Firebase to process
      console.log('⏳ Waiting for Firebase to process...')
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      // Reload the prompts
      console.log('🔄 Reloading prompts...')
      await loadAIPrompts()
      
      console.log('✅ Test complete - check if logs appear in table')
    } catch (error) {
      console.error('❌ Error creating test prompt:', error)
      console.error('❌ Error details:', error.message)
      console.error('❌ Error stack:', error.stack)
      
      // Show error in UI
      error = 'Test failed: ' + error.message
    }
  }
</script>

<div class="card">
  <div class="card-header d-flex justify-content-between align-items-center">
    <h5 class="mb-0">
      <i class="fas fa-brain me-2"></i>
      AI Prompt Logs (Last 50)
    </h5>
    <div class="d-flex gap-2">
      <button 
        class="btn btn-outline-danger btn-sm" 
        on:click={testFirebaseConnection}
        disabled={loading}
      >
        <i class="fas fa-fire me-1"></i>
        Test Firebase
      </button>
      <button 
        class="btn btn-outline-warning btn-sm" 
        on:click={createTestPrompt}
        disabled={loading}
      >
        <i class="fas fa-vial me-1"></i>
        Test Log
      </button>
      <button 
        class="btn btn-outline-info btn-sm" 
        on:click={verifyPromptData}
        disabled={loading || aiPrompts.length === 0}
      >
        <i class="fas fa-search me-1"></i>
        Verify Data
      </button>
      <button 
        class="btn btn-outline-primary btn-sm" 
        on:click={loadAIPrompts}
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
                    {prompt.promptType}
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
            <i class="fas fa-brain me-2"></i>
            AI Prompt Details - {selectedPrompt.promptType}
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
                <pre class="mb-0 small">{selectedPrompt.promptData}</pre>
              </div>
            </div>
            <div class="col-md-6">
              <h6 class="text-success">
                <i class="fas fa-robot me-2"></i>
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
                  {selectedPrompt.promptType}
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
            class="btn btn-secondary" 
            on:click={closePromptDetails}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}
