// OpenAI Service for AI-powered medical recommendations
// This service provides AI-generated recommendations based on patient symptoms

import aiTokenTracker from './aiTokenTracker.js'
import { 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  orderBy, 
  limit 
} from 'firebase/firestore'
import { db } from '../firebase-config.js'

class OpenAIService {
  constructor() {
    this.apiKey = import.meta.env.VITE_OPENAI_API_KEY
    this.baseURL = 'https://api.openai.com/v1'
    this.client = null
    this.initializeClient()
  }

  // Initialize OpenAI client
  initializeClient() {
    if (this.isConfigured()) {
      try {
        // Dynamic import of OpenAI to avoid build issues
        import('openai').then(({ default: OpenAI }) => {
          this.client = new OpenAI({
            apiKey: this.apiKey,
            baseURL: this.baseURL,
            dangerouslyAllowBrowser: true
          })
          console.log('✅ OpenAI client initialized successfully')
        }).catch(error => {
          console.error('❌ Failed to initialize OpenAI client:', error)
        })
      } catch (error) {
        console.error('❌ Error importing OpenAI:', error)
      }
    }
  }

  // Check if API key is configured
  isConfigured() {
    const configured = this.apiKey && this.apiKey !== 'undefined' && this.apiKey !== ''
    console.log('🔑 OpenAI API Key Status:', {
      hasKey: !!this.apiKey,
      keyValue: this.apiKey ? `${this.apiKey.substring(0, 8)}...` : 'undefined',
      configured: configured
    })
    return configured
  }

  // Log AI prompt to Firebase for admin monitoring - Enhanced to capture ALL OpenAI requests
  async logAIPrompt(promptType, promptData, response = null, error = null, additionalInfo = {}) {
    try {
      console.log('📝 logAIPrompt called with:', {
        promptType,
        promptData: typeof promptData,
        response: !!response,
        error: !!error,
        additionalInfo
      })
      
      // Extract the complete prompt content from the request body
      let fullPrompt = ''
      let systemMessage = ''
      let userMessage = ''
      
      if (promptData.requestBody && promptData.requestBody.messages) {
        const messages = promptData.requestBody.messages
        messages.forEach(msg => {
          if (msg.role === 'system') {
            systemMessage = msg.content
          } else if (msg.role === 'user') {
            userMessage = msg.content
          }
        })
        
        // Combine system and user messages for full prompt
        fullPrompt = `SYSTEM MESSAGE:\n${systemMessage}\n\nUSER MESSAGE:\n${userMessage}`
      }

      const logEntry = {
        promptType, // 'drugSuggestions', 'drugInteractions', 'comprehensiveAnalysis', 'api_call', etc.
        timestamp: new Date().toISOString(),
        promptData: JSON.stringify(promptData, null, 2), // Stringify for storage
        fullPrompt: fullPrompt, // Complete prompt content
        systemMessage: systemMessage, // System message only
        userMessage: userMessage, // User message only
        response: response ? JSON.stringify(response, null, 2) : null,
        error: error ? error.message : null,
        success: !error,
        tokensUsed: response ? this.estimateTokens(promptData, response) : 0,
        // Additional metadata
        apiEndpoint: additionalInfo.endpoint || 'chat/completions',
        model: additionalInfo.model || 'unknown',
        requestId: additionalInfo.requestId || Date.now().toString(),
        userAgent: navigator.userAgent,
        url: window.location.href,
        // Include any additional context
        ...additionalInfo
      }

      console.log('📝 About to add document to Firebase:', logEntry.requestId)
      console.log('📝 Firebase db object:', !!db)
      console.log('📝 Collection reference:', !!collection(db, 'aiPromptLogs'))
      
      await addDoc(collection(db, 'aiPromptLogs'), logEntry)
      console.log('📝 AI prompt logged successfully:', promptType, 'Request ID:', logEntry.requestId)
      console.log('📝 Full prompt logged:', fullPrompt.substring(0, 200) + '...')
    } catch (logError) {
      console.error('❌ Failed to log AI prompt:', logError)
      console.error('❌ Log error details:', {
        message: logError.message,
        code: logError.code,
        stack: logError.stack
      })
      // Don't throw error - logging failure shouldn't break the main functionality
    }
  }

  // Estimate token usage (rough approximation)
  estimateTokens(promptData, response) {
    const promptText = typeof promptData === 'string' ? promptData : JSON.stringify(promptData)
    const responseText = typeof response === 'string' ? response : JSON.stringify(response)
    const totalText = promptText + responseText
    // Rough estimate: 1 token ≈ 4 characters
    return Math.ceil(totalText.length / 4)
  }

  // Centralized OpenAI API call wrapper that logs ALL requests
  async makeOpenAIRequest(endpoint, requestBody, promptType = 'api_call', additionalContext = {}) {
    const requestId = Date.now().toString() + Math.random().toString(36).substr(2, 9)
    
    try {
      console.log('🚀 Making OpenAI API request:', endpoint, 'Request ID:', requestId)
      console.log('🚀 Request body:', requestBody)
      console.log('🚀 Prompt type:', promptType)
      console.log('🚀 Additional context:', additionalContext)
      
      // Log the request BEFORE making the call
      console.log('📝 About to log AI prompt to Firebase...')
      await this.logAIPrompt(promptType, {
        endpoint,
        requestBody,
        requestId,
        timestamp: new Date().toISOString(),
        ...additionalContext
      }, null, null, {
        endpoint,
        model: requestBody.model || 'unknown',
        requestId,
        ...additionalContext
      })
      console.log('✅ AI prompt logged to Firebase successfully')

      const response = await fetch(`${this.baseURL}/${endpoint}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      })

      if (!response.ok) {
        const errorData = await response.json()
        const error = new Error(`OpenAI API error: ${errorData.error?.message || 'Unknown error'}`)
        
        // Log the error
        await this.logAIPrompt(promptType, {
          endpoint,
          requestBody,
          requestId,
          timestamp: new Date().toISOString(),
          ...additionalContext
        }, null, error, {
          endpoint,
          model: requestBody.model || 'unknown',
          requestId,
          ...additionalContext
        })
        
        throw error
      }

      const data = await response.json()
      
      // Log the successful response
      await this.logAIPrompt(promptType, {
        endpoint,
        requestBody,
        requestId,
        timestamp: new Date().toISOString(),
        ...additionalContext
      }, data, null, {
        endpoint,
        model: requestBody.model || 'unknown',
        requestId,
        tokensUsed: data.usage ? data.usage.total_tokens : 0,
        ...additionalContext
      })

      console.log('✅ OpenAI API request completed:', endpoint, 'Request ID:', requestId)
      return data

    } catch (error) {
      console.error('❌ OpenAI API request failed:', endpoint, 'Request ID:', requestId, error)
      
      // Log the error (if not already logged above)
      if (!error.logged) {
        await this.logAIPrompt(promptType, {
          endpoint,
          requestBody,
          requestId,
          timestamp: new Date().toISOString(),
          ...additionalContext
        }, null, error, {
          endpoint,
          model: requestBody.model || 'unknown',
          requestId,
          ...additionalContext
        })
        error.logged = true
      }
      
      throw error
    }
  }

  // Get last 50 AI prompts for admin panel
  async getLastAIPrompts(limitCount = 50) {
    try {
      const q = query(
        collection(db, 'aiPromptLogs'),
        orderBy('timestamp', 'desc'),
        limit(limitCount)
      )
      
      const querySnapshot = await getDocs(q)
      const prompts = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
      
      console.log('📊 Retrieved AI prompts:', prompts.length)
      return prompts
    } catch (error) {
      console.error('❌ Error retrieving AI prompts:', error)
      throw error
    }
  }

  // Ensure client is initialized
  async ensureClientReady() {
    if (!this.isConfigured()) {
      throw new Error('OpenAI API key not configured')
    }
    
    if (!this.client) {
      // Try to initialize client synchronously
      try {
        const { default: OpenAI } = await import('openai')
        this.client = new OpenAI({
          apiKey: this.apiKey,
          baseURL: this.baseURL,
          dangerouslyAllowBrowser: true
        })
        console.log('✅ OpenAI client initialized on demand')
      } catch (error) {
        console.error('❌ Failed to initialize OpenAI client:', error)
        throw new Error('Failed to initialize OpenAI client')
      }
    }
    
    return this.client
  }


  // Convert combined analysis JSON to HTML
  convertCombinedAnalysisToHTML(jsonResponse) {
    if (!jsonResponse) return ''

    let html = ''

    // Compact format with reduced line spacing
    if (jsonResponse.conditions && Array.isArray(jsonResponse.conditions)) {
      html += `<p class="compact-text"><strong>Possible Conditions:</strong> ${jsonResponse.conditions.join(', ')}</p>`
    }

    if (jsonResponse.treatment && Array.isArray(jsonResponse.treatment)) {
      html += `<p class="compact-text"><strong>Treatment:</strong></p><ul class="compact-list">`
      jsonResponse.treatment.forEach(med => {
        html += `<li class="compact-item">${med.medication}: ${med.dosage}</li>`
      })
      html += `</ul>`
    }

    if (jsonResponse.interactions) {
      html += `<p class="compact-text"><strong>Important:</strong> ${jsonResponse.interactions}</p>`
    }

    if (jsonResponse.redFlags && Array.isArray(jsonResponse.redFlags)) {
      html += `<p class="compact-text"><strong>Watch for:</strong> ${jsonResponse.redFlags.join(', ')}</p>`
    }

    return html
  }

  // Convert structured JSON analysis to HTML
  convertStructuredAnalysisToHTML(jsonResponse) {
    if (!jsonResponse) return ''

    let html = ''

    // Overview section
    if (jsonResponse.overview) {
      html += `<h6>📋 OVERVIEW</h6><p>${jsonResponse.overview}</p>`
    }

    // Medications section
    if (jsonResponse.medications && Array.isArray(jsonResponse.medications)) {
      html += `<h6>🔍 MEDICATIONS</h6><ul>`
      jsonResponse.medications.forEach(med => {
        html += `<li><strong>${med.drug}:</strong> ${med.assessment}`
        if (med.availability) {
          html += `<br><span class="text-info"><strong>Availability:</strong> ${med.availability}</span>`
        }
        if (med.alternatives) {
          html += `<br><span class="text-warning"><strong>Alternatives:</strong> ${med.alternatives}</span>`
        }
        html += `</li>`
      })
      html += `</ul>`
    }

    // Safety section
    if (jsonResponse.safety) {
      html += `<h6>⚠️ SAFETY</h6><div class="warning"><ul>`
      if (jsonResponse.safety.interactions) {
        html += `<li><strong>Interactions:</strong> ${jsonResponse.safety.interactions}</li>`
      }
      if (jsonResponse.safety.monitoring) {
        html += `<li><strong>Monitoring:</strong> ${jsonResponse.safety.monitoring}</li>`
      }
      html += `</ul></div>`
    }

    // Effectiveness section
    if (jsonResponse.effectiveness) {
      html += `<h6>🎯 EFFECTIVENESS</h6><ul>`
      if (jsonResponse.effectiveness.alignment) {
        html += `<li><strong>Alignment:</strong> ${jsonResponse.effectiveness.alignment}</li>`
      }
      if (jsonResponse.effectiveness.outcomes) {
        html += `<li><strong>Outcomes:</strong> ${jsonResponse.effectiveness.outcomes}</li>`
      }
      html += `</ul>`
    }

    // Recommendations section
    if (jsonResponse.recommendations) {
      html += `<h6>📈 RECOMMENDATIONS</h6><div class="recommendation"><ul>`
      if (jsonResponse.recommendations.adjustments) {
        html += `<li><strong>Adjustments:</strong> ${jsonResponse.recommendations.adjustments}</li>`
      }
      if (jsonResponse.recommendations.followUp) {
        html += `<li><strong>Follow-up:</strong> ${jsonResponse.recommendations.followUp}</li>`
      }
      html += `</ul></div>`
    }

    // Warnings section
    if (jsonResponse.warnings) {
      html += `<h6>🚨 WARNINGS</h6><div class="warning"><ul>`
      if (jsonResponse.warnings.critical) {
        html += `<li><strong>Critical:</strong> ${jsonResponse.warnings.critical}</li>`
      }
      if (jsonResponse.warnings.emergency) {
        html += `<li><strong>Emergency:</strong> ${jsonResponse.warnings.emergency}</li>`
      }
      html += `</ul></div>`
    }

    // Notes section
    if (jsonResponse.notes) {
      html += `<h6>📝 NOTES</h6><div class="highlight"><ul>`
      if (jsonResponse.notes.clinical) {
        html += `<li><strong>Clinical:</strong> ${jsonResponse.notes.clinical}</li>`
      }
      if (jsonResponse.notes.education) {
        html += `<li><strong>Education:</strong> ${jsonResponse.notes.education}</li>`
      }
      html += `</ul></div>`
    }

    return html
  }

  // Convert markdown to HTML - simple and reliable (fallback)
  convertMarkdownToHTML(text) {
    if (!text) return ''

    console.log('🔧 Converting markdown to HTML...')
    console.log('📝 Original text preview:', text.substring(0, 200))

    // Remove any HTML code blocks or markdown artifacts
    text = text.replace(/```html\s*/g, '')
    text = text.replace(/```\s*/g, '')
    text = text.replace(/`([^`]+)`/g, '$1')

    // Convert main section headers first
    text = text.replace(/\*\*📋\s*PRESCRIPTION OVERVIEW:\*\*/g, '<h6>📋 OVERVIEW</h6>')
    text = text.replace(/\*\*🔍\s*MEDICATION ANALYSIS:\*\*/g, '<h6>🔍 MEDICATIONS</h6>')
    text = text.replace(/\*\*⚠️\s*SAFETY ASSESSMENT:\*\*/g, '<h6>⚠️ SAFETY</h6>')
    text = text.replace(/\*\*🎯\s*TREATMENT EFFECTIVENESS:\*\*/g, '<h6>🎯 EFFECTIVENESS</h6>')
    text = text.replace(/\*\*📈\s*OPTIMIZATION RECOMMENDATIONS:\*\*/g, '<h6>📈 RECOMMENDATIONS</h6>')
    text = text.replace(/\*\*🚨\s*RED FLAGS & WARNINGS:\*\*/g, '<h6>🚨 WARNINGS</h6>')
    text = text.replace(/\*\*📝\s*CLINICAL NOTES:\*\*/g, '<h6>📝 NOTES</h6>')

    // Convert other bold headers
    text = text.replace(/\*\*([^*]+):\*\*/g, '<h6>$1</h6>')

    // Convert remaining bold text
    text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')

    // Convert italic text
    text = text.replace(/\*([^*]+)\*/g, '<em>$1</em>')

    // Convert bullet points
    text = text.replace(/^[-•]\s+(.+)$/gm, '<li>$1</li>')
    
    // Wrap consecutive list items
    text = text.replace(/(<li>.*<\/li>(\s*<li>.*<\/li>)*)/gs, '<ul>$1</ul>')
    
    // Add special styling to sections
    text = text.replace(/<h6>⚠️\s*SAFETY<\/h6>([\s\S]*?)(?=<h6>|$)/g, (match, content) => {
      return '<h6>⚠️ SAFETY</h6><div class="warning">' + content.trim() + '</div>'
    })
    
    text = text.replace(/<h6>📈\s*RECOMMENDATIONS<\/h6>([\s\S]*?)(?=<h6>|$)/g, (match, content) => {
      return '<h6>📈 RECOMMENDATIONS</h6><div class="recommendation">' + content.trim() + '</div>'
    })
    
    text = text.replace(/<h6>🚨\s*WARNINGS<\/h6>([\s\S]*?)(?=<h6>|$)/g, (match, content) => {
      return '<h6>🚨 WARNINGS</h6><div class="warning">' + content.trim() + '</div>'
    })
    
    text = text.replace(/<h6>📝\s*NOTES<\/h6>([\s\S]*?)(?=<h6>|$)/g, (match, content) => {
      return '<h6>📝 NOTES</h6><div class="highlight">' + content.trim() + '</div>'
    })
    
    // Convert line breaks
    text = text.replace(/\n\n/g, '</p><p>')
    text = text.replace(/\n/g, '<br>')
    
    // Wrap in paragraphs
    text = '<p>' + text + '</p>'
    
    // Clean up
    text = text.replace(/<p><\/p>/g, '')
    text = text.replace(/<p>\s*<\/p>/g, '')
    text = text.replace(/<p>\s*<h6>/g, '<h6>')
    text = text.replace(/<\/h6>\s*<\/p>/g, '</h6>')
    text = text.replace(/<p>\s*<div/g, '<div')
    text = text.replace(/<\/div>\s*<\/p>/g, '</div>')
    
    console.log('✅ Converted text preview:', text.substring(0, 200))
    return text
  }


  // Generate comprehensive prescription analysis
  async generateComprehensivePrescriptionAnalysis(patientData, doctorId = null) {
    if (!this.isConfigured()) {
      throw new Error('OpenAI API key not configured.')
    }

    try {
      console.log('🤖 Generating comprehensive prescription analysis...')

      // Prepare comprehensive patient data
      const medicationsText = patientData.medications.map(med => 
        `${med.name} (${med.dosage}, ${med.frequency}, ${med.duration})`
      ).join(', ')

      const symptomsText = patientData.symptoms.map(symptom => 
        `${symptom.description} (Severity: ${symptom.severity})`
      ).join(', ')

      const illnessesText = patientData.illnesses.map(illness => 
        `${illness.condition} (Diagnosed: ${illness.diagnosisDate})`
      ).join(', ')

        const prompt = `Analyze prescription case as second opinion support for qualified doctor. Provide structured JSON response.

        PATIENT INFORMATION:
        Name: ${patientData.name} (${patientData.firstName} ${patientData.lastName})
        Age: ${patientData.age || 'N/A'}, Weight: ${patientData.weight || 'N/A'}, Height: ${patientData.height || 'N/A'}
        Gender: ${patientData.gender || 'Not specified'}, Blood Group: ${patientData.bloodGroup || 'Not specified'}
        Date of Birth: ${patientData.dateOfBirth || 'Not specified'}

        MEDICAL INFORMATION:
        Allergies: ${patientData.allergies || 'None'}
        Medical History: ${patientData.medicalHistory || 'None'}
        Current Medications: ${patientData.currentMedications || 'None'}
        Long-term Medications: ${patientData.longTermMedications || 'None'}
        Emergency Contact: ${patientData.emergencyContact || 'Not specified'}

        LOCATION INFORMATION:
        Patient Address: ${patientData.patientAddress || 'Not specified'}
        Patient City: ${patientData.patientCity || 'Not specified'}
        Patient Country: ${patientData.patientCountry || 'Not specified'}
        Patient Phone: ${patientData.patientPhone || 'Not specified'}
        Patient Email: ${patientData.patientEmail || 'Not specified'}

        DOCTOR INFORMATION:
        Doctor Name: ${patientData.doctorName || 'Unknown'}
        Doctor Country: ${patientData.doctorCountry || 'Not specified'}
        Doctor City: ${patientData.doctorCity || 'Not specified'}
        Doctor Specialization: ${patientData.doctorSpecialization || 'General Practice'}
        Doctor License: ${patientData.doctorLicenseNumber || 'Not specified'}

        CURRENT PRESCRIPTION:
        Medications: ${medicationsText}
        Symptoms: ${symptomsText || 'None'}
        Conditions: ${illnessesText || 'None'}
        Prescription Date: ${patientData.prescriptionDate || 'Current'}

        Provide analysis in the following JSON structure:
        - overview: Brief assessment of the prescription case
        - medications: Array of objects with drug name, assessment, and availability status in patient's country
        - safety: Object with interactions and monitoring requirements
        - effectiveness: Object with alignment and expected outcomes
        - recommendations: Object with adjustments, follow-up schedule, and alternative medications if needed
        - warnings: Object with critical issues and emergency situations
        - notes: Object with clinical points, patient education, and country-specific considerations

        IMPORTANT: Check drug availability and regulatory approval in the patient's country. Suggest alternatives if medications are not available or approved in the patient's region. Consider local healthcare practices and drug naming conventions.`

        const requestBody = {
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: 'Medical AI assistant providing second opinion support to qualified medical doctors. The reader is a qualified medical doctor. Provide comprehensive prescription analysis with structured JSON output. CRITICAL: Consider regional healthcare practices, local drug availability, country-specific medical guidelines, and drug regulatory approvals. Assess if prescribed medications are available and approved in the patient\'s country. Suggest alternative medications if drugs are not available in the patient\'s region. Focus on key safety issues, effectiveness, and actionable recommendations tailored to the patient and doctor locations. Account for patient gender, age, and other demographic factors in medication recommendations and dosing considerations.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          max_tokens: 1200,
          temperature: 0.1,
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "prescription_analysis",
              schema: {
                type: "object",
                properties: {
                  overview: {
                    type: "string",
                    description: "Brief assessment of the prescription case"
                  },
                  medications: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        drug: { type: "string" },
                        assessment: { type: "string" },
                        availability: { type: "string", description: "Availability status in patient's country" },
                        alternatives: { type: "string", description: "Alternative medications if not available" }
                      },
                      required: ["drug", "assessment", "availability"]
                    }
                  },
                  safety: {
                    type: "object",
                    properties: {
                      interactions: { type: "string" },
                      monitoring: { type: "string" }
                    },
                    required: ["interactions", "monitoring"]
                  },
                  effectiveness: {
                    type: "object",
                    properties: {
                      alignment: { type: "string" },
                      outcomes: { type: "string" }
                    },
                    required: ["alignment", "outcomes"]
                  },
                  recommendations: {
                    type: "object",
                    properties: {
                      adjustments: { type: "string" },
                      followUp: { type: "string" }
                    },
                    required: ["adjustments", "followUp"]
                  },
                  warnings: {
                    type: "object",
                    properties: {
                      critical: { type: "string" },
                      emergency: { type: "string" }
                    },
                    required: ["critical", "emergency"]
                  },
                  notes: {
                    type: "object",
                    properties: {
                      clinical: { type: "string" },
                      education: { type: "string" }
                    },
                    required: ["clinical", "education"]
                  }
                },
                required: ["overview", "medications", "safety", "effectiveness", "recommendations", "warnings", "notes"]
              }
            }
          }
        }

      const data = await this.makeOpenAIRequest('chat/completions', requestBody, 'comprehensiveAnalysis', {
        patientData,
        doctorId,
        currentMedications: patientData.medications,
        symptoms: patientData.symptoms,
        illnesses: patientData.illnesses
      })
      
      let analysis = data.choices[0]?.message?.content || 'Unable to generate comprehensive analysis.'
      console.log('📝 Raw AI response:', analysis.substring(0, 200) + '...')

      // Parse JSON response and convert to HTML
      try {
        const jsonResponse = JSON.parse(analysis)
        analysis = this.convertStructuredAnalysisToHTML(jsonResponse)
        console.log('✅ Successfully converted structured JSON to HTML')
      } catch (parseError) {
        console.warn('⚠️ Failed to parse JSON response, using raw content:', parseError.message)
        // Fallback to markdown conversion if JSON parsing fails
        analysis = this.convertMarkdownToHTML(analysis)
      }

      // Track token usage
      if (data.usage) {
        aiTokenTracker.trackUsage(
          'generateComprehensivePrescriptionAnalysis',
          data.usage.prompt_tokens,
          data.usage.completion_tokens,
          'gpt-4o-mini',
          doctorId
        )
      }

      console.log('✅ Comprehensive prescription analysis generated')
      return analysis

    } catch (error) {
      console.error('❌ Error generating comprehensive prescription analysis:', error)
      throw error
    }
  }

  // Generate AI-assisted drug suggestions for prescriptions
  async generateAIDrugSuggestions(symptoms, currentMedications = [], patientAge = null, doctorId = null, additionalContext = {}) {
    if (!this.isConfigured()) {
      throw new Error('OpenAI API key not configured.')
    }

    try {
      console.log('💊 Generating AI drug suggestions...')

      const symptomsText = symptoms.map(symptom => symptom.description).join(', ')
      const currentMedsText = currentMedications.length > 0 
        ? `Current medications: ${currentMedications.map(med => med.name).join(', ')}`
        : 'No current medications'

      // Get patient allergies, gender, long-term medications, patient country, and doctor country from additional context
      const patientAllergies = additionalContext?.patientAllergies || 'None'
      const patientGender = additionalContext?.patientGender || 'Not specified'
      const longTermMedications = additionalContext?.longTermMedications || 'None'
      const patientCountry = additionalContext?.patientCountry || 'Not specified'
      const doctorCountry = additionalContext?.doctorCountry || 'Not specified'

      // Use patient's country if specified, otherwise use doctor's country
      const effectivePatientCountry = patientCountry && patientCountry !== 'Not specified' ? patientCountry : doctorCountry

      // Include patient age, gender, allergies, long-term medications in prompt
      const ageText = patientAge ? `, Age: ${patientAge} years` : ''
      const genderText = patientGender && patientGender !== 'Not specified' ? `, Gender: ${patientGender}` : ''
      const allergiesText = patientAllergies && patientAllergies !== 'None' ? `, Allergies: ${patientAllergies}` : ''
      const longTermMedsText = longTermMedications && longTermMedications !== 'None' ? `, Long-term medications: ${longTermMedications}` : ''

      const prompt = `Patient: ${ageText}${genderText}${allergiesText}${longTermMedsText}
Symptoms: ${symptomsText}
${currentMedsText}
Patient Country: ${effectivePatientCountry}

Suggest 3-5 specific medications (both prescription and OTC) with dosages for qualified medical doctor to prescribe or recommend. Return as JSON object with "suggestions" array:
{
  "suggestions": [
    {
      "name": "Medication Name",
      "dosage": "20mg",
      "frequency": "Once daily",
      "duration": "7 days",
      "instructions": "Take with food",
      "reason": "Brief reason for suggestion",
      "type": "prescription" or "OTC"
    }
  ]
}

IMPORTANT: MEDICATION SUGGESTIONS:
- Suggest both prescription medications and OTC (over-the-counter) medications as appropriate
- Use medication names commonly available in ${patientCountry}
- Consider local drug regulations and approval status
- Account for drug interactions and local prescribing practices
- Suggest medications that are legally available and commonly used in ${patientCountry}
- Consider endemic diseases and local health patterns in the patient's country
- Account for gender-specific medication effects and contraindications`

      const requestBody = {
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'Medical AI assistant providing drug suggestions for qualified medical doctors. The reader is a qualified medical doctor. CRITICAL: Consider patient age, gender, allergies, long-term medications, current active medications, and contraindications. Avoid medications that patient is allergic to. Check for drug interactions with both long-term medications and current active medications. Account for age-related and gender-specific dosing adjustments. Consider gender-specific medication effects and contraindications. Suggest both prescription and OTC medications as clinically appropriate. Consider endemic diseases and local health patterns based on doctor and patient locations. Return valid JSON only.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 800,
        temperature: 0.1,
        response_format: {
          type: "json_object"
        }
      }

      const data = await this.makeOpenAIRequest(
        'chat/completions',
        requestBody,
        'drugSuggestions',
        {
          symptoms: symptomsText,
          currentMedications: currentMedsText,
          patientAge,
          patientAllergies,
          doctorId,
          patientCountry: patientCountry
        }
      )

      let suggestions = []
      try {
        const jsonResponse = JSON.parse(data.choices[0]?.message?.content || '{}')
        console.log('🔍 Raw AI response:', jsonResponse)
        
        // Handle both object with suggestions array and direct array
        if (jsonResponse.suggestions && Array.isArray(jsonResponse.suggestions)) {
          suggestions = jsonResponse.suggestions
        } else if (Array.isArray(jsonResponse)) {
          suggestions = jsonResponse
        } else {
          console.warn('⚠️ Unexpected JSON structure:', jsonResponse)
          suggestions = []
        }
        
        console.log('✅ Successfully parsed AI drug suggestions:', suggestions.length)
        console.log('📋 Suggestions data:', suggestions)
      } catch (parseError) {
        console.warn('⚠️ Failed to parse drug suggestions JSON:', parseError.message)
        console.warn('⚠️ Raw response:', data.choices[0]?.message?.content)
        // Fallback: create basic suggestions from text
        suggestions = []
      }

      // Track token usage
      if (data.usage) {
        aiTokenTracker.trackUsage(
          'generateAIDrugSuggestions',
          data.usage.prompt_tokens,
          data.usage.completion_tokens,
          'gpt-4o-mini',
          doctorId
        )
      }

      console.log('✅ AI drug suggestions generated:', suggestions.length)
      return suggestions

    } catch (error) {
      console.error('❌ Error generating AI drug suggestions:', error)
      throw error
    }
  }

  // Generate combined analysis (recommendations + medication suggestions) in single call
  async generateCombinedAnalysis(symptoms, currentMedications = [], patientAge = null, doctorId = null, patientAllergies = null, patientGender = null, longTermMedications = null, additionalContext = {}) {
    if (!this.isConfigured()) {
      throw new Error('OpenAI API key not configured.')
    }

    try {
      console.log('🤖 Generating combined AI analysis...')

      // Optimized symptom formatting
      const symptomsText = symptoms.map(symptom => symptom.description).join(', ')
      
      // Optimized medication formatting
      const currentMedsText = currentMedications.length > 0 
        ? `Current medications: ${currentMedications.map(med => med.name).join(', ')}`
        : 'No current medications'

      // Get patient country and doctor country from additional context
      const patientCountry = additionalContext?.patientCountry || 'Not specified'
      const doctorCountry = additionalContext?.doctorCountry || 'Not specified'

      // Use patient's country if specified, otherwise use doctor's country
      const effectivePatientCountry = patientCountry && patientCountry !== 'Not specified' ? patientCountry : doctorCountry

      // Include patient age, gender, allergies, and long-term medications in prompt
      const ageText = patientAge ? `, Age: ${patientAge} years` : ''
      const genderText = patientGender && patientGender !== 'Not specified' ? `, Gender: ${patientGender}` : ''
      const allergiesText = patientAllergies ? `, Allergies: ${patientAllergies}` : ''
      const longTermMedsText = longTermMedications && longTermMedications !== 'None' ? `, Long-term medications: ${longTermMedications}` : ''

      // Ultra-concise prompt with patient data
      const prompt = `Patient: ${ageText}${genderText}${allergiesText}${longTermMedsText}
Symptoms: ${symptomsText}
${currentMedsText}
Patient Country: ${effectivePatientCountry}

Brief analysis:
**Conditions:** 2-3 likely diagnoses
**Treatment:** Key medications + dosages
**Interactions:** Critical warnings
**Red Flags:** Emergency signs

Concise medical info only.`

      const requestBody = {
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
              content: 'Medical AI assistant providing second opinion support to qualified medical doctors. The reader is a qualified medical doctor. Provide structured JSON analysis. Consider patient age, gender, allergies, long-term medications, current active medications, drug availability and regulatory approval in the patient\'s country. Suggest alternatives if medications are not available in the patient\'s region. CRITICAL: Check for drug allergies, contraindications, and interactions with both long-term medications and current active medications based on patient age, gender, and allergy profile. Account for gender-specific medication effects and dosing considerations. Consider endemic diseases and local health patterns in the patient\'s country.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 600,
        temperature: 0.1,
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "combined_analysis",
            schema: {
              type: "object",
              properties: {
                conditions: {
                  type: "array",
                  items: { type: "string" },
                  description: "2-3 likely diagnoses"
                },
                treatment: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      medication: { type: "string" },
                      dosage: { type: "string" },
                      availability: { type: "string", description: "Availability in patient's country" },
                      alternatives: { type: "string", description: "Alternative medications if not available" }
                    },
                    required: ["medication", "dosage", "availability"]
                  },
                  description: "Key medications and dosages with availability status"
                },
                interactions: {
                  type: "string",
                  description: "Critical interaction warnings"
                },
                redFlags: {
                  type: "array",
                  items: { type: "string" },
                  description: "Emergency signs to watch for"
                }
              },
              required: ["conditions", "treatment", "interactions", "redFlags"]
            }
          }
        }
      }

      // Use the centralized logging method instead of direct fetch
      console.log('🔍 About to call makeOpenAIRequest with logging...')
      console.log('🔍 Request body for logging:', requestBody)
      console.log('🔍 Additional context for logging:', {
        symptoms: symptomsText,
        currentMedications: currentMedsText,
        patientAge,
        doctorId
      })
      
      const data = await this.makeOpenAIRequest(
        'chat/completions',
        requestBody,
        'comprehensiveAnalysis',
        {
          symptoms: symptomsText,
          currentMedications: currentMedsText,
          patientAge,
          patientAllergies,
          doctorId
        }
      )
      console.log('✅ makeOpenAIRequest completed, data received:', data)
      let combinedAnalysis = data.choices[0]?.message?.content || 'No analysis available.'

      // Parse JSON response and convert to readable format
      try {
        const jsonResponse = JSON.parse(combinedAnalysis)
        combinedAnalysis = this.convertCombinedAnalysisToHTML(jsonResponse)
        console.log('✅ Successfully converted structured JSON to HTML')
      } catch (parseError) {
        console.warn('⚠️ Failed to parse JSON response, using raw content:', parseError.message)
      }

      // Track token usage
      if (data.usage) {
        aiTokenTracker.trackUsage(
          'generateCombinedAnalysis',
          data.usage.prompt_tokens,
          data.usage.completion_tokens,
          'gpt-4o-mini',
          doctorId
        )
      }

      console.log('✅ Combined AI analysis generated')

      return {
        combinedAnalysis,
        recommendations: combinedAnalysis,
        medicationSuggestions: combinedAnalysis
      }

    } catch (error) {
      console.error('❌ Error generating combined analysis:', error)
      throw error
    }
  }

}

// Create singleton instance
const openaiService = new OpenAIService()

export default openaiService
