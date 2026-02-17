// OpenAI Service for AI-powered medical recommendations
// This service provides AI-generated recommendations based on patient symptoms

import aiTokenTracker from './aiTokenTracker.js'
import firebaseStorage from './firebaseStorage.js'
import { 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  orderBy, 
  limit 
} from 'firebase/firestore'
import { db, auth } from '../firebase-config.js'

class OpenAIService {
  constructor() {
    this.client = null
    this.responseCache = new Map()
    this.cacheTtlMs = 5 * 60 * 1000
    this.maxCacheEntries = 200
    this.imageAnalysisCache = new Map()
    this.imageAnalysisTtlMs = 24 * 60 * 60 * 1000
    this.aiModelSettingsCache = null
    this.aiModelSettingsFetchedAt = 0
    this.aiModelSettingsTtlMs = 60 * 1000
  }

  // Initialize OpenAI client
  initializeClient() {
    // Client-side OpenAI SDK is no longer used.
  }

  // Check if API key is configured
  isConfigured() {
    const configured = !!this.getFunctionsBaseUrl()
    console.log('🔑 OpenAI Proxy Status:', { configured })
    return configured
  }

  getFunctionsBaseUrl() {
    const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID
    const region = import.meta.env.VITE_FUNCTIONS_REGION || 'us-central1'
    if (!projectId) return null
    return import.meta.env.VITE_FUNCTIONS_BASE_URL || `https://${region}-${projectId}.cloudfunctions.net`
  }

  getDefaultAIModelSettings() {
    return {
      imageAnalysisModel: 'gpt-4o-mini',
      otherAnalysisModel: 'gpt-4o-mini',
      spellGrammarModel: 'gpt-4o-mini'
    }
  }

  normalizeAIModelSettings(rawSettings = {}) {
    const defaults = this.getDefaultAIModelSettings()
    return {
      imageAnalysisModel: String(rawSettings?.imageAnalysisModel || '').trim() || defaults.imageAnalysisModel,
      otherAnalysisModel: String(rawSettings?.otherAnalysisModel || '').trim() || defaults.otherAnalysisModel,
      spellGrammarModel: String(rawSettings?.spellGrammarModel || '').trim() || defaults.spellGrammarModel
    }
  }

  async getAIModelSettings(forceRefresh = false) {
    const now = Date.now()
    if (
      !forceRefresh &&
      this.aiModelSettingsCache &&
      (now - this.aiModelSettingsFetchedAt) < this.aiModelSettingsTtlMs
    ) {
      return this.aiModelSettingsCache
    }

    try {
      const rawSettings = await firebaseStorage.getAIModelSettings()
      const normalized = this.normalizeAIModelSettings(rawSettings || {})
      this.aiModelSettingsCache = normalized
      this.aiModelSettingsFetchedAt = now
      return normalized
    } catch (error) {
      console.warn('⚠️ Failed to load AI model settings, using defaults.', error)
      const defaults = this.getDefaultAIModelSettings()
      this.aiModelSettingsCache = defaults
      this.aiModelSettingsFetchedAt = now
      return defaults
    }
  }

  async getModelForCategory(category = 'other') {
    const settings = await this.getAIModelSettings()
    if (category === 'image') return settings.imageAnalysisModel
    if (category === 'spell') return settings.spellGrammarModel
    return settings.otherAnalysisModel
  }

  sanitizeForLogging(value) {
    if (value == null) return value

    if (typeof value === 'string') {
      return value
        .replace(/Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi, 'Bearer [REDACTED]')
        .replace(/sk-[A-Za-z0-9]{20,}/g, 'sk-[REDACTED]')
    }

    if (Array.isArray(value)) {
      return value.map((item) => this.sanitizeForLogging(item))
    }

    if (typeof value === 'object') {
      const redacted = {}
      for (const [key, raw] of Object.entries(value)) {
        if (/(authorization|api[-_]?key|token|secret|password)/i.test(key)) {
          redacted[key] = '[REDACTED]'
        } else {
          redacted[key] = this.sanitizeForLogging(raw)
        }
      }
      return redacted
    }

    return value
  }

  // Log AI prompt to Firebase for admin monitoring - Enhanced to capture ALL OpenAI requests
  async logAIPrompt(promptType, promptData, response = null, error = null, additionalInfo = {}) {
    try {
      const sanitizedPromptData = this.sanitizeForLogging(promptData)
      const sanitizedResponse = this.sanitizeForLogging(response)
      const sanitizedAdditionalInfo = this.sanitizeForLogging(additionalInfo)

      console.log('📝 logAIPrompt called with:', {
        promptType,
        promptData: typeof sanitizedPromptData,
        response: !!response,
        error: !!error,
        additionalInfo: sanitizedAdditionalInfo
      })
      
      // Extract the complete prompt content from the request body
      let fullPrompt = ''
      let systemMessage = ''
      let userMessage = ''
      
      if (sanitizedPromptData.requestBody && sanitizedPromptData.requestBody.messages) {
        const messages = sanitizedPromptData.requestBody.messages
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
        promptData: JSON.stringify(sanitizedPromptData, null, 2), // Stringify for storage
        fullPrompt: fullPrompt, // Complete prompt content
        systemMessage: systemMessage, // System message only
        userMessage: userMessage, // User message only
        response: response ? JSON.stringify(sanitizedResponse, null, 2) : null,
        error: error ? error.message : null,
        success: !error,
        tokensUsed: response ? this.estimateTokens(sanitizedPromptData, sanitizedResponse) : 0,
        // Additional metadata
        apiEndpoint: additionalInfo.endpoint || 'chat/completions',
        model: additionalInfo.model || 'unknown',
        requestId: additionalInfo.requestId || Date.now().toString(),
        userAgent: navigator.userAgent,
        url: window.location.href,
        // Include any additional context
        ...sanitizedAdditionalInfo
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

      const cacheKey = this.getCacheKey(endpoint, requestBody)
      if (this.shouldUseCache(endpoint, requestBody, additionalContext)) {
        const cachedResponse = this.getCachedResponse(cacheKey)
        if (cachedResponse) {
          console.log('🧠 OpenAI cache hit:', endpoint, 'Cache Key:', cacheKey)
          return cachedResponse
        }
      }
      
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

      const baseUrl = this.getFunctionsBaseUrl()
      if (!baseUrl) {
        throw new Error('OpenAI is not configured.')
      }
      const currentUser = auth?.currentUser
      if (!currentUser) {
        throw new Error('Not authenticated')
      }
      const token = await currentUser.getIdToken()

      const response = await fetch(`${baseUrl}/openaiProxy`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ endpoint, requestBody })
      })

      if (!response.ok) {
        const errorText = await response.text()
        const error = new Error(errorText || 'OpenAI proxy error')
        
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

      const responseText = await response.text()
      const data = responseText ? JSON.parse(responseText) : {}

      if (this.shouldUseCache(endpoint, requestBody, additionalContext)) {
        this.setCachedResponse(cacheKey, data)
      }
      
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

  shouldUseCache(endpoint, requestBody, additionalContext = {}) {
    if (additionalContext?.disableCache) {
      return false
    }

    if (requestBody?.stream) {
      return false
    }

    return endpoint === 'chat/completions'
  }

  getCacheKey(endpoint, requestBody) {
    const payload = { endpoint, requestBody }
    const serialized = this.stableStringify(payload)
    const hash = this.hashString(serialized)
    return `${endpoint}:${hash}`
  }

  getCachedResponse(cacheKey) {
    const entry = this.responseCache.get(cacheKey)
    if (!entry) {
      return null
    }

    if (Date.now() - entry.timestamp > this.cacheTtlMs) {
      this.responseCache.delete(cacheKey)
      return null
    }

    return { ...entry.data, __fromCache: true }
  }

  setCachedResponse(cacheKey, data) {
    this.pruneCache()
    this.responseCache.set(cacheKey, { data, timestamp: Date.now() })
  }

  pruneCache() {
    if (this.responseCache.size < this.maxCacheEntries) {
      return
    }

    const entries = Array.from(this.responseCache.entries())
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp)
    const excess = entries.length - this.maxCacheEntries + 1
    entries.slice(0, excess).forEach(([key]) => this.responseCache.delete(key))
  }

  stableStringify(value) {
    if (value === null || typeof value !== 'object') {
      return JSON.stringify(value)
    }

    if (Array.isArray(value)) {
      return `[${value.map(item => this.stableStringify(item)).join(',')}]`
    }

    const keys = Object.keys(value).sort()
    const props = keys.map(key => `${JSON.stringify(key)}:${this.stableStringify(value[key])}`)
    return `{${props.join(',')}}`
  }

  hashString(value) {
    let hash = 5381
    for (let i = 0; i < value.length; i++) {
      hash = ((hash << 5) + hash) + value.charCodeAt(i)
      hash = hash & 0xffffffff
    }
    return Math.abs(hash).toString(36)
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
      throw new Error('OpenAI is not configured')
    }
    throw new Error('OpenAI client is not available in the browser')
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
      if (Array.isArray(jsonResponse.recommendations.additionalMedications) && jsonResponse.recommendations.additionalMedications.length > 0) {
        html += `<li><strong>Additional medications to consider:</strong><ul>`
        jsonResponse.recommendations.additionalMedications.forEach(item => {
          html += `<li>${item}</li>`
        })
        html += `</ul></li>`
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

  formatRecentPrescriptions(recentPrescriptions) {
    if (!Array.isArray(recentPrescriptions) || recentPrescriptions.length === 0) {
      return 'None'
    }

    return recentPrescriptions.map((prescription, index) => {
      if (typeof prescription === 'string') {
        return `${index + 1}) ${prescription}`
      }

      const date =
        prescription?.date ||
        prescription?.createdAt ||
        prescription?.updatedAt ||
        'Unknown date'
      const medications = Array.isArray(prescription?.medications)
        ? prescription.medications.map(med => {
            if (!med) {
              return ''
            }

            const details = [
              med.name,
              med.dosage,
              med.frequency,
              med.duration
            ].filter(Boolean)

            return details.join(' ')
          }).filter(Boolean).join('; ')
        : ''

      return `${index + 1}) ${date}: ${medications || 'No medications listed'}`
    }).join('\n')
  }

  formatRecentReports(recentReports) {
    if (!Array.isArray(recentReports) || recentReports.length === 0) {
      return 'None'
    }

    return recentReports.map((report, index) => {
      if (typeof report === 'string') {
        return `${index + 1}) ${report}`
      }

      const date = report?.date || report?.createdAt || 'Unknown date'
      const type = report?.type || 'unknown'
      const title = report?.title || 'Untitled report'
      const filename = report?.filename ? `File: ${report.filename}` : ''
      const content = report?.content ? `Notes: ${report.content}` : ''
      const details = [title, filename, content].filter(Boolean).join(' | ')

      return `${index + 1}) ${date} (${type}): ${details || 'No details'}`
    }).join('\n')
  }

  formatReportAnalyses(reportAnalyses) {
    if (!Array.isArray(reportAnalyses) || reportAnalyses.length === 0) {
      return 'None'
    }

    return reportAnalyses.map((report, index) => {
      const title = report?.title || 'Untitled report'
      const date = report?.date || report?.createdAt || 'Unknown date'
      const analysis = report?.analysis || 'No analysis'
      return `${index + 1}) ${date} - ${title}: ${analysis}`
    }).join('\n')
  }

  getImageAnalysisCache(key) {
    const entry = this.imageAnalysisCache.get(key)
    if (!entry) {
      return null
    }

    if (Date.now() - entry.timestamp > this.imageAnalysisTtlMs) {
      this.imageAnalysisCache.delete(key)
      return null
    }

    return entry.analysis
  }

  setImageAnalysisCache(key, analysis) {
    this.imageAnalysisCache.set(key, { analysis, timestamp: Date.now() })
  }

  async getReportImageDataUrl(report) {
    if (!report) {
      return null
    }

    const url = report.previewUrl || report.dataUrl || null
    if (!url) {
      return null
    }

    if (url.startsWith('data:')) {
      return url
    }

    if (url.startsWith('blob:')) {
      const response = await fetch(url)
      const blob = await response.blob()
      return await new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result)
        reader.onerror = reject
        reader.readAsDataURL(blob)
      })
    }

    return url
  }

  async analyzeReportImages(recentReports = [], context = {}) {
    const imageReports = Array.isArray(recentReports)
      ? recentReports.filter(report => report?.type === 'image' && (report.previewUrl || report.dataUrl))
      : []

    if (imageReports.length === 0) {
      return []
    }

    const analyses = []

    for (const report of imageReports) {
      const dataUrl = await this.getReportImageDataUrl(report)
      if (!dataUrl) {
        continue
      }

      const cacheKey = this.hashString(dataUrl)
      const cached = this.getImageAnalysisCache(cacheKey)
      if (cached) {
        analyses.push({
          id: report.id,
          title: report.title,
          date: report.date || report.createdAt || null,
          type: report.type,
          analysis: cached
        })
        continue
      }

      const selectedModel = await this.getModelForCategory('image')
      const requestBody = {
        model: selectedModel,
        messages: [
          {
            role: 'system',
            content: 'You are a medical imaging assistant. Summarize clinically relevant findings from the report image. Focus on key observations and possible impressions. If the image is unreadable, say so.'
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Analyze this medical report image (X-ray, ECG, etc.) and provide a concise clinical summary.'
              },
              {
                type: 'image_url',
                image_url: {
                  url: dataUrl,
                  detail: 'low'
                }
              }
            ]
          }
        ],
        max_tokens: 400,
        temperature: 0.1
      }

      const data = await this.makeOpenAIRequest('chat/completions', requestBody, 'reportImageAnalysis', {
        reportId: report.id,
        reportTitle: report.title,
        ...context
      })

      const analysis = data.choices[0]?.message?.content?.trim() || 'No analysis available.'
      this.setImageAnalysisCache(cacheKey, analysis)
      analyses.push({
        id: report.id,
        title: report.title,
        date: report.date || report.createdAt || null,
        type: report.type,
        analysis
      })
    }

    return analyses
  }


  // Generate comprehensive prescription analysis
  async generateComprehensivePrescriptionAnalysis(patientData, doctorId = null) {
    if (!this.isConfigured()) {
      throw new Error('OpenAI is not configured.')
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
      const recentPrescriptionsText = this.formatRecentPrescriptions(patientData.recentPrescriptions)
      const recentReportsText = this.formatRecentReports(patientData.recentReports)
      const reportAnalysesText = this.formatReportAnalyses(patientData.reportAnalyses)

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
        Recent Prescriptions (last 3): ${recentPrescriptionsText}
        Recent Reports (last 3): ${recentReportsText}
        Report Analyses (last 3): ${reportAnalysesText}
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
        Recent Prescriptions (last 3): ${recentPrescriptionsText}
        Recent Reports (last 3): ${recentReportsText}
        Report Analyses (last 3): ${reportAnalysesText}
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

        const selectedModel = await this.getModelForCategory('other')
        const requestBody = {
          model: selectedModel,
          messages: [
            {
              role: 'system',
              content: 'Medical AI assistant providing second opinion support to qualified medical doctors. The reader is a qualified medical doctor. Provide comprehensive prescription analysis with structured JSON output. CRITICAL: Consider regional healthcare practices, local drug availability, country-specific medical guidelines, and drug regulatory approvals. Assess if prescribed medications are available and approved in the patient\'s country. Suggest alternative medications if drugs are not available in the patient\'s region. Suggest any additional medications that may be clinically appropriate or missing (e.g., supportive, adjunct, prophylactic, or monitoring-related) and populate recommendations.additionalMedications with specific, concise items. Focus on key safety issues, effectiveness, and actionable recommendations tailored to the patient and doctor locations. Account for patient gender, age, and other demographic factors in medication recommendations and dosing considerations. Use clear, clinician-friendly language with concise headings and bullet points.'
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
                      followUp: { type: "string" },
                      additionalMedications: {
                        type: "array",
                        items: { type: "string" },
                        description: "Other clinically appropriate or missing medications to consider"
                      }
                    },
                    required: ["adjustments", "followUp", "additionalMedications"]
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
        illnesses: patientData.illnesses,
        recentPrescriptions: patientData.recentPrescriptions,
        recentReports: patientData.recentReports
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
      if (data.usage && !data.__fromCache) {
        aiTokenTracker.trackUsage(
          'generateComprehensivePrescriptionAnalysis',
          data.usage.prompt_tokens,
          data.usage.completion_tokens,
          selectedModel,
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
      throw new Error('OpenAI is not configured.')
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
      const recentPrescriptionsText = this.formatRecentPrescriptions(additionalContext?.recentPrescriptions)
      const recentReportsText = this.formatRecentReports(additionalContext?.recentReports)
      const reportAnalysesText = this.formatReportAnalyses(additionalContext?.reportAnalyses)

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
Recent prescriptions (last 3): ${recentPrescriptionsText}
Recent reports (last 3): ${recentReportsText}
Report analyses (last 3): ${reportAnalysesText}
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

      const selectedModel = await this.getModelForCategory('other')
      const requestBody = {
        model: selectedModel,
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
          patientCountry: patientCountry,
          recentPrescriptions: additionalContext?.recentPrescriptions,
          recentReports: additionalContext?.recentReports
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
      if (data.usage && !data.__fromCache) {
        aiTokenTracker.trackUsage(
          'generateAIDrugSuggestions',
          data.usage.prompt_tokens,
          data.usage.completion_tokens,
          selectedModel,
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
      throw new Error('OpenAI is not configured.')
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
      const recentPrescriptionsText = this.formatRecentPrescriptions(additionalContext?.recentPrescriptions)
      const recentReportsText = this.formatRecentReports(additionalContext?.recentReports)
      const reportAnalysesText = this.formatReportAnalyses(additionalContext?.reportAnalyses)

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
Recent prescriptions (last 3): ${recentPrescriptionsText}
Recent reports (last 3): ${recentReportsText}
Report analyses (last 3): ${reportAnalysesText}
Patient Country: ${effectivePatientCountry}

Brief analysis:
**Conditions:** 2-3 likely diagnoses
**Treatment:** Key medications + dosages
**Interactions:** Critical warnings
**Red Flags:** Emergency signs

Concise medical info only.`

      const selectedModel = await this.getModelForCategory('other')
      const requestBody = {
        model: selectedModel,
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
          doctorId,
          recentPrescriptions: additionalContext?.recentPrescriptions,
          recentReports: additionalContext?.recentReports
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
      if (data.usage && !data.__fromCache) {
        aiTokenTracker.trackUsage(
          'generateCombinedAnalysis',
          data.usage.prompt_tokens,
          data.usage.completion_tokens,
          selectedModel,
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

  // Generate patient management summary
  async generatePatientSummary(patientData, doctorId = null) {
    if (!this.isConfigured()) {
      throw new Error('OpenAI is not configured.')
    }

    try {
      console.log('🤖 Generating patient management summary...')

      const userId = doctorId || 'default-user'

      const formatDaysAgo = (value) => {
        if (!value) return 'unknown time'
        const timestamp = new Date(value).getTime()
        if (Number.isNaN(timestamp)) return 'unknown time'
        const days = Math.floor((Date.now() - timestamp) / (1000 * 60 * 60 * 24))
        if (days <= 0) return 'today'
        if (days === 1) return '1 day ago'
        return `${days} days ago`
      }

      const resolveMedicationName = (medication) => (
        medication?.name || medication?.drugName || medication?.brandName || 'Unnamed medication'
      )

      const resolveMedicationFrequency = (medication) => (
        medication?.frequency || medication?.frequencyLabel || medication?.dosageFrequency || ''
      )

      const resolveMedicationDuration = (medication) => (
        medication?.duration || medication?.durationLabel || medication?.days || ''
      )

      const resolveMedicationDate = (medication) => (
        medication?.updatedAt || medication?.createdAt || medication?.prescriptionDate || medication?.date
      )

      const resolveIllnessName = (illness) => (
        illness?.name || illness?.illness || illness?.diagnosis || 'Unknown condition'
      )

      const resolveIllnessStatus = (illness) => (
        illness?.status || illness?.stage || illness?.conditionStatus || ''
      )

      const resolveIllnessDate = (illness) => (
        illness?.updatedAt || illness?.createdAt || illness?.date
      )

      const resolveSymptomText = (symptom) => (
        symptom?.symptom || symptom?.description || 'Unnamed symptom'
      )

      const resolveSymptomDate = (symptom) => (
        symptom?.updatedAt || symptom?.createdAt || symptom?.date
      )

      const ongoingMedications = (patientData.prescriptions || [])
        .flatMap(prescription => prescription?.medications || [])
        .filter(medication => !['completed', 'stopped', 'discontinued'].includes((medication?.status || '').toLowerCase()))

      const chronicConditions = (patientData.illnesses || [])
        .filter(illness => (resolveIllnessStatus(illness) || '').toLowerCase().includes('chronic'))

      // Prepare patient context
      const patientContext = `
Patient: ${patientData.name || `${patientData.firstName} ${patientData.lastName}`}
Age: ${patientData.age || 'Not specified'}
Gender: ${patientData.gender || 'Not specified'}
Weight: ${patientData.weight ? `${patientData.weight} kg` : 'Not specified'}
Blood Group: ${patientData.bloodGroup || 'Not specified'}

Medical History:
${patientData.medicalHistory || 'No medical history recorded'}

Allergies: ${patientData.allergies || 'None recorded'}

Long-term Medications: ${patientData.longTermMedications || 'None'}

Recent Symptoms (last recorded):
${patientData.symptoms && patientData.symptoms.length > 0
  ? patientData.symptoms
      .slice(0, 5)
      .map(s => `- ${resolveSymptomText(s)} (${s.severity || 'N/A'}, ${formatDaysAgo(resolveSymptomDate(s))})`)
      .join('\n')
  : 'No recent symptoms recorded'}

Recent Diagnoses:
${patientData.illnesses && patientData.illnesses.length > 0
  ? patientData.illnesses
      .slice(0, 3)
      .map(i => `- ${resolveIllnessName(i)}${resolveIllnessStatus(i) ? ` (${resolveIllnessStatus(i)})` : ''} · ${formatDaysAgo(resolveIllnessDate(i))}`)
      .join('\n')
  : 'No recent diagnoses recorded'}

Current Prescriptions:
${patientData.prescriptions && patientData.prescriptions.length > 0
  ? patientData.prescriptions
      .slice(0, 3)
      .map(p =>
        p.medications
          ? p.medications
              .map(m => `- ${resolveMedicationName(m)} (${m.dosage || m.dose || 'dose N/A'}${resolveMedicationFrequency(m) ? `, ${resolveMedicationFrequency(m)}` : ''}${resolveMedicationDuration(m) ? `, ${resolveMedicationDuration(m)}` : ''}) · ${formatDaysAgo(resolveMedicationDate(m))}`)
              .join('\n')
          : ''
      )
      .join('\n')
  : 'No active prescriptions'}

Ongoing Medications:
${ongoingMedications.length > 0
  ? ongoingMedications
      .slice(0, 5)
      .map(m => `- ${resolveMedicationName(m)} (${m.dosage || m.dose || 'dose N/A'}${resolveMedicationFrequency(m) ? `, ${resolveMedicationFrequency(m)}` : ''})`)
      .join('\n')
  : 'No ongoing medications identified'}

Chronic Conditions:
${chronicConditions.length > 0
  ? chronicConditions
      .slice(0, 5)
      .map(c => `- ${resolveIllnessName(c)}${resolveIllnessStatus(c) ? ` (${resolveIllnessStatus(c)})` : ''}`)
      .join('\n')
  : 'No chronic conditions recorded'}

Recent Reports:
${patientData.recentReports && patientData.recentReports.length > 0
  ? patientData.recentReports.map((report, index) => `- ${index + 1}) ${report.date || 'Unknown date'} (${report.type || 'unknown'}): ${report.title || 'Untitled'}${report.filename ? ` [${report.filename}]` : ''}${report.content ? ` - ${report.content}` : ''}`).join('\n')
  : 'No recent reports'}

Report Analyses:
${patientData.reportAnalyses && patientData.reportAnalyses.length > 0
  ? patientData.reportAnalyses.map((report, index) => `- ${index + 1}) ${report.date || 'Unknown date'}: ${report.title || 'Untitled'} - ${report.analysis || 'No analysis'}`).join('\n')
  : 'No report analyses'}
`

      const systemMessage = `You are an AI medical assistant helping doctors manage patient care. Generate a concise, professional patient management summary that includes:

1. Patient Overview (2-3 sentences about demographics and general health status)
2. Key Health Concerns (bullet points of main issues based on symptoms and diagnoses)
3. Current Treatment Plan (summary of active medications and their purpose)
4. Recommendations for Monitoring (what to watch for, follow-up timing)

IMPORTANT FORMATTING RULES:
- DO NOT wrap the response in markdown code blocks (no \`\`\`html tags)
- Return ONLY the HTML content directly
- Use proper HTML tags: <h3>, <h4>, <p>, <ul>, <li>, <strong>
- Use Tailwind CSS classes for styling:
  * Headings: class="text-lg font-semibold text-gray-900 mb-2"
  * Subheadings: class="text-base font-semibold text-gray-800 mb-2 mt-3"
  * Paragraphs: class="text-sm text-gray-700 mb-2"
  * Lists: <ul class="list-disc list-inside text-sm text-gray-700 space-y-1 mb-3">
  * List items: class="ml-2"
- Keep it concise but informative - aim for 200-300 words total
- Use a professional, clinical tone`

      const userMessage = `Generate a patient management summary for:\n\n${patientContext}`

      // Prepare request body
      const selectedModel = await this.getModelForCategory('other')
      const requestBody = {
        model: selectedModel,
        messages: [
          { role: 'system', content: systemMessage },
          { role: 'user', content: userMessage }
        ],
        temperature: 0.7,
        max_tokens: 800
      }

      // Make OpenAI API request
      const data = await this.makeOpenAIRequest('chat/completions', requestBody, 'patientSummary', {
        patientData: {
          name: patientData.name,
          age: patientData.age,
          gender: patientData.gender
        },
        doctorId
      })

      let summary = data.choices[0]?.message?.content || 'Unable to generate summary.'
      const tokensUsed = data.__fromCache ? 0 : (data.usage?.total_tokens || 0)

      // Clean up the summary - remove markdown code blocks if present
      summary = summary.trim()

      // Remove ```html and ``` if present
      if (summary.startsWith('```html')) {
        summary = summary.replace(/^```html\s*\n?/, '')
      }
      if (summary.startsWith('```')) {
        summary = summary.replace(/^```\s*\n?/, '')
      }
      if (summary.endsWith('```')) {
        summary = summary.replace(/\n?```\s*$/, '')
      }

      summary = summary.replace(/<h[34][^>]*>\s*Risk Factors\s*<\/h[34]>\s*([\s\S]*?)(?=<h[34][^>]*>|$)/gi, '').trim()

      summary = summary.trim()

      console.log('✅ Patient summary generated, tokens used:', tokensUsed)

      // Track token usage
      if (doctorId && !data.__fromCache) {
        const promptTokens = Number(data?.usage?.prompt_tokens ?? tokensUsed ?? 0)
        const completionTokens = Number(data?.usage?.completion_tokens ?? 0)
        await aiTokenTracker.trackUsage('patientSummary', promptTokens, completionTokens, selectedModel, userId)
      }

      return {
        summary,
        tokensUsed
      }

    } catch (error) {
      console.error('❌ Error generating patient summary:', error)
      throw error
    }
  }

  normalizeMedicalUnits(text) {
    if (!text) return text

    let normalized = String(text)

    const replacements = [
      [/\bmilligrams?\b/gi, 'mg'],
      [/\bmgs?\b/gi, 'mg'],
      [/\bmicrograms?\b/gi, 'mcg'],
      [/\bmcgs?\b/gi, 'mcg'],
      [/\bmillilit(?:er|re)s?\b/gi, 'ml'],
      [/\bmls?\b/gi, 'ml'],
      [/\bkilograms?\b/gi, 'kg'],
      [/\bgrams?\b/gi, 'g'],
      [/\bI\.?\s*U\.?\b/gi, 'IU'],
      [/\binternational units?\b/gi, 'IU']
    ]

    replacements.forEach(([pattern, replacement]) => {
      normalized = normalized.replace(pattern, replacement)
    })

    normalized = normalized.replace(/(\d(?:\.\d+)?)\s*(mg|mcg|g|kg|ml|IU)\b/g, '$1 $2')
    normalized = normalized.replace(/\s{2,}/g, ' ')

    return normalized
  }

  capitalizeFirstLetterIfNeeded(text) {
    if (!text) return text
    return String(text).replace(/^(\s*)([a-z])/, (_, ws, char) => `${ws}${char.toUpperCase()}`)
  }

  postProcessImprovedText(text) {
    let result = String(text || '').trim()
    result = this.normalizeMedicalUnits(result)
    result = this.capitalizeFirstLetterIfNeeded(result)
    return result
  }

  getUtf8ByteLength(value = '') {
    const text = String(value || '')
    if (typeof TextEncoder !== 'undefined') {
      return new TextEncoder().encode(text).length
    }
    return text.length
  }

  async optimizeImageSourceForOcr(imageSource, options = {}) {
    const source = String(imageSource || '').trim()
    if (!source || !/^data:image\//i.test(source)) {
      return source
    }

    const targetMaxBytes = Number(options?.targetMaxBytes || (1.1 * 1024 * 1024))
    const sourceBytes = this.getUtf8ByteLength(source)
    if (!Number.isFinite(targetMaxBytes) || sourceBytes <= targetMaxBytes) {
      return source
    }

    if (typeof Image === 'undefined' || typeof document === 'undefined') {
      return source
    }

    try {
      const image = await new Promise((resolve, reject) => {
        const img = new Image()
        img.onload = () => resolve(img)
        img.onerror = reject
        img.src = source
      })

      const maxDimensions = Array.isArray(options?.maxDimensions) && options.maxDimensions.length > 0
        ? options.maxDimensions
        : [1800, 1500, 1200, 1000, 800]
      const qualities = Array.isArray(options?.qualities) && options.qualities.length > 0
        ? options.qualities
        : [0.82, 0.74, 0.66, 0.58, 0.5]
      let bestCandidate = source
      let bestBytes = sourceBytes

      for (const maxDim of maxDimensions) {
        const scale = Math.min(1, maxDim / Math.max(image.width || 1, image.height || 1))
        const width = Math.max(1, Math.round((image.width || 1) * scale))
        const height = Math.max(1, Math.round((image.height || 1) * scale))
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        if (!ctx) continue
        ctx.drawImage(image, 0, 0, width, height)

        for (const quality of qualities) {
          const candidate = canvas.toDataURL('image/jpeg', quality)
          const candidateBytes = this.getUtf8ByteLength(candidate)
          if (candidateBytes < bestBytes) {
            bestCandidate = candidate
            bestBytes = candidateBytes
          }
          if (candidateBytes <= targetMaxBytes) {
            return candidate
          }
        }
      }

      return bestCandidate
    } catch (error) {
      console.warn('⚠️ Failed to optimize OCR image payload, using original source.', error)
      return source
    }
  }

  async extractTextFromImage(imageSource, doctorId = null, options = {}) {
    if (!this.isConfigured()) {
      throw new Error('OpenAI is not configured.')
    }

    const imageUrl = String(imageSource || '').trim()
    if (!imageUrl) {
      throw new Error('Image source is required for OCR.')
    }

    const compressionProfiles = [
      { targetMaxBytes: Number(options?.targetMaxBytes || (1.1 * 1024 * 1024)), detail: 'high', maxDimensions: [1800, 1500, 1200, 1000, 800], qualities: [0.82, 0.74, 0.66, 0.58, 0.5] },
      { targetMaxBytes: 320 * 1024, detail: 'low', maxDimensions: [1200, 1000, 800, 700, 600], qualities: [0.74, 0.64, 0.56, 0.48, 0.4] },
      { targetMaxBytes: 140 * 1024, detail: 'low', maxDimensions: [900, 800, 700, 600, 520, 460], qualities: [0.62, 0.52, 0.44, 0.36, 0.3] },
      { targetMaxBytes: 90 * 1024, detail: 'low', maxDimensions: [760, 680, 620, 540, 460, 400, 360], qualities: [0.5, 0.42, 0.34, 0.28, 0.24] }
    ]

    let lastError = null
    for (let i = 0; i < compressionProfiles.length; i += 1) {
      const profile = compressionProfiles[i]
      try {
        const optimizedImageUrl = await this.optimizeImageSourceForOcr(imageUrl, profile)

        const selectedModel = await this.getModelForCategory('image')
        const requestBody = {
          model: selectedModel,
          messages: [
            {
              role: 'system',
              content: 'You are an OCR assistant for medical reports. Extract all visible text faithfully. Preserve line breaks. Do not summarize. If text is unreadable, say "Unreadable". Return only extracted text.'
            },
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: 'Extract the text from this medical report image.'
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: optimizedImageUrl,
                    detail: profile.detail
                  }
                }
              ]
            }
          ],
          temperature: 0,
          max_tokens: 1500
        }

        const data = await this.makeOpenAIRequest('chat/completions', requestBody, 'reportImageOcr', {
          doctorId,
          context: options?.context || 'report-camera-ocr'
        })

        const extractedText = String(data?.choices?.[0]?.message?.content || '').trim()
        const tokensUsed = data.__fromCache ? 0 : (data?.usage?.total_tokens || 0)

        if (doctorId && !data.__fromCache) {
          const promptTokens = Number(data?.usage?.prompt_tokens ?? tokensUsed ?? 0)
          const completionTokens = Number(data?.usage?.completion_tokens ?? 0)
          await aiTokenTracker.trackUsage('reportImageOcr', promptTokens, completionTokens, selectedModel, doctorId)
        }

        return {
          extractedText,
          tokensUsed
        }
      } catch (error) {
        lastError = error
        const message = String(error?.message || '')
        const isPayloadError = /payload too large|413/i.test(message)
        const hasMoreProfiles = i < (compressionProfiles.length - 1)
        if (isPayloadError && hasMoreProfiles) {
          continue
        }
        break
      }
    }

    console.error('❌ Error extracting OCR text from image:', lastError)
    throw lastError || new Error('Failed to extract text from image.')
  }

  // Improve text with spelling/grammar + medical context normalization
  async improveText(text, doctorId = null, options = {}) {
    if (!this.isConfigured()) {
      throw new Error('OpenAI is not configured.')
    }

    try {
      console.log('🤖 Improving medical text with context-aware corrections...')
      const context = String(options?.context || 'medical-note')

      const systemMessage = `You are a medical English editor for clinical notes and prescriptions.

STRICT RULES:
1. Correct spelling, grammar, and punctuation.
2. Preserve medical meaning; do not add/remove facts.
3. Keep the original intent and concise style (no verbose rewriting).
4. Normalize medication/unit expressions when applicable:
   - milligram/milligrams/mg -> mg
   - microgram/mcg -> mcg
   - milliliter/ml -> ml
   - gram/g -> g, kilogram/kg -> kg
   - international units/IU -> IU
5. Ensure proper spacing between numbers and units (e.g., "500mg" -> "500 mg").
6. Capitalize the first letter when the sentence starts with a letter.
7. If text already looks correct, return it unchanged.
8. Return ONLY the corrected text.

Example:
Input: "take 5 milligrams after meal"
Output: "Take 5 mg after meals."`

      const userMessage = `Context: ${context}\nImprove this text using the rules above:\n\n${text}`

      // Prepare request body
      const selectedModel = await this.getModelForCategory('spell')
      const requestBody = {
        model: selectedModel,
        messages: [
          { role: 'system', content: systemMessage },
          { role: 'user', content: userMessage }
        ],
        temperature: 0.3, // Lower temperature for more consistent corrections
        max_tokens: 500
      }

      // Make OpenAI API request
      const data = await this.makeOpenAIRequest('chat/completions', requestBody, 'improveText', {
        originalText: text.substring(0, 100) + '...',
        doctorId
      })

      const improvedTextRaw = data.choices[0]?.message?.content || text
      const improvedText = this.postProcessImprovedText(improvedTextRaw)
      const tokensUsed = data.__fromCache ? 0 : (data.usage?.total_tokens || 0)

      console.log('✅ Text improved, tokens used:', tokensUsed)

      // Track token usage
      if (doctorId && !data.__fromCache) {
        const promptTokens = Number(data?.usage?.prompt_tokens ?? tokensUsed ?? 0)
        const completionTokens = Number(data?.usage?.completion_tokens ?? 0)
        await aiTokenTracker.trackUsage('improveText', promptTokens, completionTokens, selectedModel, doctorId)
      }

      return {
        improvedText,
        tokensUsed
      }

    } catch (error) {
      console.error('❌ Error improving text:', error)
      throw error
    }
  }

}

// Create singleton instance
const openaiService = new OpenAIService()

export default openaiService
