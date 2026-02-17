// AI Token Usage Tracking Service
// Tracks OpenAI API token usage for cost monitoring and analytics
import firebaseStorage from './firebaseStorage.js'

class AITokenTracker {
  constructor() {
    this.storageKey = 'prescribe-ai-token-usage'
    this.usageData = this.loadUsageData()
    
    // Run migration to fix any requests with missing doctorId
    this.migrateRequestsWithMissingDoctorId()
    this.migrateLegacyMisorderedTrackUsage()
  }

  sanitizeNumber(value) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value
    }
    if (typeof value === 'string') {
      const cleaned = value.replace(/[^0-9.-]+/g, '')
      const parsed = Number(cleaned)
      return Number.isFinite(parsed) ? parsed : 0
    }
    return 0
  }

  normalizeUsageData() {
    this.usageData.totalTokens = this.sanitizeNumber(this.usageData.totalTokens)
    this.usageData.totalCost = this.sanitizeNumber(this.usageData.totalCost)

    Object.keys(this.usageData.dailyUsage || {}).forEach((date) => {
      const entry = this.usageData.dailyUsage[date]
      if (!entry) return
      entry.tokens = this.sanitizeNumber(entry.tokens)
      entry.cost = this.sanitizeNumber(entry.cost)
      entry.requests = this.sanitizeNumber(entry.requests)
    })

    Object.keys(this.usageData.monthlyUsage || {}).forEach((month) => {
      const entry = this.usageData.monthlyUsage[month]
      if (!entry) return
      entry.tokens = this.sanitizeNumber(entry.tokens)
      entry.cost = this.sanitizeNumber(entry.cost)
      entry.requests = this.sanitizeNumber(entry.requests)
    })

    if (Array.isArray(this.usageData.requests)) {
      this.usageData.requests = this.usageData.requests.map((req) => ({
        ...req,
        promptTokens: this.sanitizeNumber(req?.promptTokens),
        completionTokens: this.sanitizeNumber(req?.completionTokens),
        totalTokens: this.sanitizeNumber(req?.totalTokens),
        cost: this.sanitizeNumber(req?.cost)
      }))
    }
  }

  // Load usage data from localStorage
  loadUsageData() {
    try {
      const stored = localStorage.getItem(this.storageKey)
      return stored ? JSON.parse(stored) : {
        totalTokens: 0,
        totalCost: 0,
        dailyUsage: {},
        monthlyUsage: {},
        requests: [],
        doctorQuotas: {}, // New: Store doctor token quotas
        defaultQuota: 50000, // Default monthly quota for new doctors
        tokenPricePerMillion: 0.50, // Price per 1 million tokens (in USD)
        lastUpdated: null
      }
    } catch (error) {
      console.error('Error loading AI token usage data:', error)
      return {
        totalTokens: 0,
        totalCost: 0,
        dailyUsage: {},
        monthlyUsage: {},
        requests: [],
        doctorQuotas: {}, // New: Store doctor token quotas
        defaultQuota: 50000, // Default monthly quota for new doctors
        tokenPricePerMillion: 0.50, // Price per 1 million tokens (in USD)
        lastUpdated: null
      }
    }
  }

  // Save usage data to localStorage
  saveUsageData() {
    try {
      this.usageData.lastUpdated = new Date().toISOString()
      localStorage.setItem(this.storageKey, JSON.stringify(this.usageData))
    } catch (error) {
      console.error('Error saving AI token usage data:', error)
    }
  }

  // Track token usage for a request
  trackUsage(requestType, promptTokens, completionTokens, model = 'gpt-3.5-turbo', doctorId = null) {
    const safePromptTokens = this.sanitizeNumber(promptTokens)
    const safeCompletionTokens = this.sanitizeNumber(completionTokens)
    const totalTokens = safePromptTokens + safeCompletionTokens
    const cost = this.calculateRequestCost(safePromptTokens, safeCompletionTokens, model)
    const timestamp = new Date().toISOString()
    const date = new Date().toISOString().split('T')[0]
    const month = new Date().toISOString().substring(0, 7) // YYYY-MM

    // Ensure we have a valid doctorId - use fallback if null/undefined
    const validDoctorId = doctorId || 'unknown-doctor'
    
    console.log(`📊 Tracking AI usage for doctor: ${validDoctorId}`)
    console.log(`📊 Original doctorId parameter: ${doctorId}`)
    console.log(`📊 Request type: ${requestType}`)
    console.log(`📊 Tokens: ${safePromptTokens} + ${safeCompletionTokens} = ${totalTokens}`)

    // Add to requests history
    const request = {
      id: Date.now() + Math.random(),
      type: requestType,
      timestamp,
      model,
      promptTokens: safePromptTokens,
      completionTokens: safeCompletionTokens,
      totalTokens,
      cost,
      doctorId: validDoctorId
    }

    this.usageData.requests.push(request)
    this.usageData.totalTokens += totalTokens
    this.usageData.totalCost += cost

    // Update daily usage
    if (!this.usageData.dailyUsage[date]) {
      this.usageData.dailyUsage[date] = {
        tokens: 0,
        cost: 0,
        requests: 0
      }
    }
    this.usageData.dailyUsage[date].tokens += totalTokens
    this.usageData.dailyUsage[date].cost += cost
    this.usageData.dailyUsage[date].requests += 1

    // Update monthly usage
    if (!this.usageData.monthlyUsage[month]) {
      this.usageData.monthlyUsage[month] = {
        tokens: 0,
        cost: 0,
        requests: 0
      }
    }
    this.usageData.monthlyUsage[month].tokens += totalTokens
    this.usageData.monthlyUsage[month].cost += cost
    this.usageData.monthlyUsage[month].requests += 1

    // Keep only last 100 requests to prevent storage bloat
    if (this.usageData.requests.length > 100) {
      this.usageData.requests = this.usageData.requests.slice(-100)
    }

    this.saveUsageData()
    // Fire-and-forget server persistence so admin analytics are centralized.
    this.persistUsageToServer(request)
    console.log(`📊 AI Token Usage Tracked: ${totalTokens} tokens, $${cost.toFixed(4)}`)
    
    return request
  }

  async persistUsageToServer(request) {
    try {
      const normalizedDoctorId = String(request?.doctorId || '').trim()
      if (!normalizedDoctorId || normalizedDoctorId === 'unknown-doctor') {
        return
      }
      await firebaseStorage.addDoctorAIUsageRecord({
        doctorId: normalizedDoctorId,
        requestType: request?.type || '',
        promptTokens: this.sanitizeNumber(request?.promptTokens),
        completionTokens: this.sanitizeNumber(request?.completionTokens),
        totalTokens: this.sanitizeNumber(request?.totalTokens),
        cost: this.sanitizeNumber(request?.cost),
        model: request?.model || 'gpt-3.5-turbo',
        createdAt: request?.timestamp || new Date().toISOString()
      })
    } catch (error) {
      console.error('❌ Error persisting AI usage to server:', error)
    }
  }

  // Calculate request cost based on OpenAI pricing (updated for accuracy)
  calculateRequestCost(promptTokens, completionTokens, model) {
    // Updated pricing based on OpenAI's current rates (2024)
    // Note: These are approximate and may not include taxes/fees
    const pricing = {
      'gpt-3.5-turbo': { 
        prompt: 0.0005,      // $0.0005 per 1K tokens (input)
        completion: 0.0015   // $0.0015 per 1K tokens (output)
      },
      'gpt-4': { 
        prompt: 0.03,        // $0.03 per 1K tokens (input)
        completion: 0.06     // $0.06 per 1K tokens (output)
      },
      'gpt-4-turbo': { 
        prompt: 0.01,        // $0.01 per 1K tokens (input)
        completion: 0.03     // $0.03 per 1K tokens (output)
      },
      'gpt-4o': {
        prompt: 0.005,       // $0.005 per 1K tokens (input)
        completion: 0.015    // $0.015 per 1K tokens (output)
      },
      'gpt-4o-mini': {
        prompt: 0.00015,     // $0.00015 per 1K tokens (input)
        completion: 0.0006   // $0.0006 per 1K tokens (output)
      }
    }

    const modelPricing = pricing[model] || pricing['gpt-3.5-turbo']
    const promptCost = (promptTokens / 1000) * modelPricing.prompt
    const completionCost = (completionTokens / 1000) * modelPricing.completion

    const baseCost = promptCost + completionCost
    
    // Add a buffer factor to account for potential higher real costs
    // (taxes, fees, rate changes, etc.)
    const bufferFactor = 1.2 // 20% buffer
    const adjustedCost = baseCost * bufferFactor
    
    return adjustedCost
  }

  // Get usage statistics
  getUsageStats() {
    this.normalizeUsageData()
    const today = new Date().toISOString().split('T')[0]
    const thisMonth = new Date().toISOString().substring(0, 7)
    const requests = Array.isArray(this.usageData.requests) ? this.usageData.requests : []
    const totalTokens = requests.reduce((sum, req) => sum + this.sanitizeNumber(req.totalTokens), 0)
    const totalCost = requests.reduce((sum, req) => sum + this.sanitizeNumber(req.cost), 0)
    const todayStats = requests.reduce((acc, req) => {
      if (!String(req?.timestamp || '').startsWith(today)) return acc
      acc.tokens += this.sanitizeNumber(req.totalTokens)
      acc.cost += this.sanitizeNumber(req.cost)
      acc.requests += 1
      return acc
    }, { tokens: 0, cost: 0, requests: 0 })
    const monthStats = requests.reduce((acc, req) => {
      if (!String(req?.timestamp || '').startsWith(thisMonth)) return acc
      acc.tokens += this.sanitizeNumber(req.totalTokens)
      acc.cost += this.sanitizeNumber(req.cost)
      acc.requests += 1
      return acc
    }, { tokens: 0, cost: 0, requests: 0 })
    
    return {
      total: {
        tokens: totalTokens,
        cost: totalCost,
        requests: requests.length
      },
      today: todayStats,
      thisMonth: monthStats,
      lastUpdated: this.usageData.lastUpdated
    }
  }

  // Get recent requests
  getRecentRequests(limit = 10) {
    return this.usageData.requests
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, limit)
  }

  // Get daily usage for the last 7 days
  getWeeklyUsage() {
    const days = []
    for (let i = 6; i >= 0; i--) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      const dateStr = date.toISOString().split('T')[0]
      days.push({
        date: dateStr,
        ...(this.usageData.dailyUsage[dateStr] || { tokens: 0, cost: 0, requests: 0 })
      })
    }
    return days
  }

  // Get monthly usage for the last 6 months
  getMonthlyUsage() {
    const months = []
    for (let i = 5; i >= 0; i--) {
      const date = new Date()
      date.setMonth(date.getMonth() - i)
      const monthStr = date.toISOString().substring(0, 7)
      months.push({
        month: monthStr,
        ...(this.usageData.monthlyUsage[monthStr] || { tokens: 0, cost: 0, requests: 0 })
      })
    }
    return months
  }

  // Clear all usage data
  clearUsageData() {
    this.usageData = {
      totalTokens: 0,
      totalCost: 0,
      dailyUsage: {},
      monthlyUsage: {},
      requests: [],
      lastUpdated: null
    }
    this.saveUsageData()
  }

  // Get current pricing information
  getCurrentPricing() {
    return {
      'gpt-3.5-turbo': { prompt: 0.0005, completion: 0.0015 },
      'gpt-4': { prompt: 0.03, completion: 0.06 },
      'gpt-4-turbo': { prompt: 0.01, completion: 0.03 },
      'gpt-4o': { prompt: 0.005, completion: 0.015 },
      'gpt-4o-mini': { prompt: 0.00015, completion: 0.0006 },
      bufferFactor: 1.2,
      lastUpdated: '2024-12-19',
      note: 'Estimated costs with 20% buffer. Actual OpenAI billing may vary.'
    }
  }

  // Get cost calculation disclaimer
  getCostDisclaimer() {
    return {
      message: 'Cost estimates are approximate and may not reflect actual OpenAI billing.',
      factors: [
        'Pricing rates may change without notice',
        'Taxes and fees not included',
        'Buffer factor applied for safety',
        'Actual costs may be higher or lower'
      ],
      recommendation: 'Check your OpenAI dashboard for exact billing amounts'
    }
  }

  // Get doctor-specific usage statistics
  getDoctorUsageStats(doctorId) {
    if (!doctorId) {
      console.log('❌ getDoctorUsageStats: No doctorId provided')
      return null
    }
    
    console.log(`📊 getDoctorUsageStats: Looking for doctorId: ${doctorId}`)
    console.log(`📊 Total requests in storage: ${this.usageData.requests.length}`)
    
    const doctorRequests = this.usageData.requests.filter(req => req.doctorId === doctorId)
    console.log(`📊 Found ${doctorRequests.length} requests for doctor ${doctorId}`)
    
    const today = new Date().toISOString().split('T')[0]
    
    const totalTokens = doctorRequests.reduce((sum, req) => sum + this.sanitizeNumber(req.totalTokens), 0)
    const totalCost = doctorRequests.reduce((sum, req) => sum + this.sanitizeNumber(req.cost), 0)
    const totalRequests = doctorRequests.length
    
    // Today's usage for this doctor
    const todayRequests = doctorRequests.filter(req => req.timestamp.startsWith(today))
    const todayTokens = todayRequests.reduce((sum, req) => sum + this.sanitizeNumber(req.totalTokens), 0)
    const todayCost = todayRequests.reduce((sum, req) => sum + this.sanitizeNumber(req.cost), 0)
    const todayRequestCount = todayRequests.length
    
    const stats = {
      total: {
        tokens: totalTokens,
        cost: totalCost,
        requests: totalRequests
      },
      today: {
        tokens: todayTokens,
        cost: todayCost,
        requests: todayRequestCount
      }
    }
    
    console.log(`📊 getDoctorUsageStats result for ${doctorId}:`, stats)
    return stats
  }

  // Get all doctors with their usage stats
  getAllDoctorsUsageStats() {
    const doctorIds = [...new Set(this.usageData.requests.map(req => req.doctorId).filter(id => id))]
    
    return doctorIds.map(doctorId => ({
      doctorId,
      stats: this.getDoctorUsageStats(doctorId)
    }))
  }

  // Quota Management Methods
  
  // Set monthly token quota for a doctor
  setDoctorQuota(doctorId, monthlyQuota) {
    if (!this.usageData.doctorQuotas) {
      this.usageData.doctorQuotas = {}
    }
    
    this.usageData.doctorQuotas[doctorId] = {
      monthlyTokens: monthlyQuota,
      setDate: new Date().toISOString(),
      setBy: 'admin' // Could be enhanced to track who set the quota
    }
    
    this.saveUsageData()
    console.log(`✅ Set monthly quota for doctor ${doctorId}: ${monthlyQuota} tokens`)
  }
  
  // Get doctor quota
  getDoctorQuota(doctorId) {
    return this.usageData.doctorQuotas?.[doctorId] || null
  }
  
  // Get doctor's monthly usage for current month
  getDoctorMonthlyUsage(doctorId) {
    if (!doctorId) return null
    
    const currentMonth = new Date().toISOString().substring(0, 7) // YYYY-MM format
    const doctorRequests = this.usageData.requests.filter(req => 
      req.doctorId === doctorId && req.timestamp.startsWith(currentMonth)
    )
    
    const monthlyTokens = doctorRequests.reduce((sum, req) => sum + this.sanitizeNumber(req.totalTokens), 0)
    const monthlyCost = doctorRequests.reduce((sum, req) => sum + this.sanitizeNumber(req.cost), 0)
    const monthlyRequests = doctorRequests.length
    
    return {
      tokens: monthlyTokens,
      cost: monthlyCost,
      requests: monthlyRequests
    }
  }
  
  // Check if doctor has exceeded quota
  isQuotaExceeded(doctorId) {
    const quota = this.getDoctorQuota(doctorId)
    if (!quota) return false
    
    const monthlyUsage = this.getDoctorMonthlyUsage(doctorId)
    return monthlyUsage.tokens > quota.monthlyTokens
  }
  
  // Get quota status for a doctor
  getDoctorQuotaStatus(doctorId) {
    const quota = this.getDoctorQuota(doctorId)
    const monthlyUsage = this.getDoctorMonthlyUsage(doctorId)
    
    if (!quota) {
      return {
        hasQuota: false,
        quotaTokens: 0,
        usedTokens: monthlyUsage.tokens,
        remainingTokens: null,
        percentageUsed: null,
        isExceeded: false
      }
    }
    
    const remainingTokens = Math.max(0, quota.monthlyTokens - monthlyUsage.tokens)
    const percentageUsed = quota.monthlyTokens > 0 ? (monthlyUsage.tokens / quota.monthlyTokens) * 100 : 0
    
    return {
      hasQuota: true,
      quotaTokens: quota.monthlyTokens,
      usedTokens: monthlyUsage.tokens,
      remainingTokens: remainingTokens,
      percentageUsed: percentageUsed,
      isExceeded: monthlyUsage.tokens > quota.monthlyTokens
    }
  }
  
  // Get all doctors with quota information
  getAllDoctorsWithQuotas() {
    const doctorIds = [...new Set(this.usageData.requests.map(req => req.doctorId).filter(id => id))]
    
    return doctorIds.map(doctorId => ({
      doctorId,
      stats: this.getDoctorUsageStats(doctorId),
      quota: this.getDoctorQuota(doctorId),
      quotaStatus: this.getDoctorQuotaStatus(doctorId),
      monthlyUsage: this.getDoctorMonthlyUsage(doctorId)
    }))
  }

  // Migration function to fix requests with null/undefined doctorId
  migrateRequestsWithMissingDoctorId() {
    let migratedCount = 0
    
    this.usageData.requests.forEach(request => {
      if (!request.doctorId || request.doctorId === null || request.doctorId === undefined) {
        request.doctorId = 'unknown-doctor'
        migratedCount++
      }
    })
    
    if (migratedCount > 0) {
      console.log(`🔄 Migrated ${migratedCount} requests with missing doctorId`)
      this.saveUsageData()
    }
    
    return migratedCount
  }

  // Migration for legacy calls where trackUsage args were passed as:
  // trackUsage(doctorId, totalTokens, requestType)
  migrateLegacyMisorderedTrackUsage() {
    const knownRequestTypes = new Set([
      'patientSummary',
      'reportImageOcr',
      'improveText',
      'generateComprehensivePrescriptionAnalysis',
      'generateAIDrugSuggestions',
      'generateCombinedAnalysis',
      'generateRecommendationsOptimized',
      'generateMedicationSuggestionsOptimized',
      'checkDrugInteractionsOptimized',
      'generateCombinedAnalysisOptimized'
    ])

    let migratedCount = 0

    this.usageData.requests.forEach((request) => {
      if (!request || typeof request !== 'object') return

      const looksLikeLegacyOrder = (
        request.doctorId === 'unknown-doctor'
        && typeof request.type === 'string'
        && typeof request.completionTokens === 'string'
        && knownRequestTypes.has(request.completionTokens)
        && !knownRequestTypes.has(request.type)
      )

      if (!looksLikeLegacyOrder) return

      const legacyDoctorId = request.type
      const legacyRequestType = request.completionTokens
      const promptTokens = this.sanitizeNumber(request.promptTokens)
      const completionTokens = 0
      const inferredModel = (
        legacyRequestType === 'patientSummary'
        || legacyRequestType === 'reportImageOcr'
        || legacyRequestType === 'improveText'
      ) ? 'gpt-4o-mini' : (request.model || 'gpt-3.5-turbo')

      request.doctorId = legacyDoctorId
      request.type = legacyRequestType
      request.promptTokens = promptTokens
      request.completionTokens = completionTokens
      request.totalTokens = this.sanitizeNumber(request.totalTokens) || promptTokens
      request.model = inferredModel
      request.cost = this.calculateRequestCost(promptTokens, completionTokens, inferredModel)
      migratedCount += 1
    })

    if (migratedCount > 0) {
      console.log(`🔄 Migrated ${migratedCount} legacy AI usage records with misordered trackUsage args`)
      this.saveUsageData()
    }

    return migratedCount
  }

  // Configuration Management Methods
  
  // Set default quota for all doctors
  setDefaultQuota(defaultQuota) {
    this.usageData.defaultQuota = parseInt(defaultQuota)
    this.saveUsageData()
    console.log(`✅ Default quota set to: ${defaultQuota} tokens`)
  }
  
  // Get default quota
  getDefaultQuota() {
    return this.usageData.defaultQuota || 50000
  }
  
  // Set token price per million
  setTokenPricePerMillion(price) {
    this.usageData.tokenPricePerMillion = parseFloat(price)
    this.saveUsageData()
    console.log(`✅ Token price set to: $${price} per 1M tokens`)
  }
  
  // Get token price per million
  getTokenPricePerMillion() {
    return this.usageData.tokenPricePerMillion || 0.50
  }
  
  // Apply default quota to all doctors who don't have a quota set
  applyDefaultQuotaToAllDoctors() {
    const doctorIds = [...new Set(this.usageData.requests.map(req => req.doctorId).filter(id => id))]
    const defaultQuota = this.getDefaultQuota()
    let appliedCount = 0
    
    doctorIds.forEach(doctorId => {
      const existingQuota = this.getDoctorQuota(doctorId)
      if (!existingQuota) {
        this.setDoctorQuota(doctorId, defaultQuota)
        appliedCount++
      }
    })
    
    console.log(`✅ Applied default quota (${defaultQuota} tokens) to ${appliedCount} doctors`)
    return appliedCount
  }
  
  // Apply default quota to specific doctors
  applyDefaultQuotaToDoctors(doctorIds) {
    const defaultQuota = this.getDefaultQuota()
    let appliedCount = 0
    
    doctorIds.forEach(doctorId => {
      this.setDoctorQuota(doctorId, defaultQuota)
      appliedCount++
    })
    
    console.log(`✅ Applied default quota (${defaultQuota} tokens) to ${appliedCount} doctors`)
    return appliedCount
  }
  
  // Calculate cost based on current pricing
  calculateCost(tokens) {
    const pricePerMillion = this.getTokenPricePerMillion()
    return (tokens / 1000000) * pricePerMillion
  }
}

const aiTokenTracker = new AITokenTracker()
export default aiTokenTracker
