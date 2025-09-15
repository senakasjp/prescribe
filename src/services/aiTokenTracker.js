// AI Token Usage Tracking Service
// Tracks OpenAI API token usage for cost monitoring and analytics

class AITokenTracker {
  constructor() {
    this.storageKey = 'prescribe-ai-token-usage'
    this.usageData = this.loadUsageData()
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
    const totalTokens = promptTokens + completionTokens
    const cost = this.calculateCost(promptTokens, completionTokens, model)
    const timestamp = new Date().toISOString()
    const date = new Date().toISOString().split('T')[0]
    const month = new Date().toISOString().substring(0, 7) // YYYY-MM

    // Add to requests history
    const request = {
      id: Date.now() + Math.random(),
      type: requestType,
      timestamp,
      model,
      promptTokens,
      completionTokens,
      totalTokens,
      cost,
      doctorId
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
    console.log(`📊 AI Token Usage Tracked: ${totalTokens} tokens, $${cost.toFixed(4)}`)
    
    return request
  }

  // Calculate cost based on OpenAI pricing (updated for accuracy)
  calculateCost(promptTokens, completionTokens, model) {
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
    const today = new Date().toISOString().split('T')[0]
    const thisMonth = new Date().toISOString().substring(0, 7)
    
    return {
      total: {
        tokens: this.usageData.totalTokens,
        cost: this.usageData.totalCost,
        requests: this.usageData.requests.length
      },
      today: this.usageData.dailyUsage[today] || { tokens: 0, cost: 0, requests: 0 },
      thisMonth: this.usageData.monthlyUsage[thisMonth] || { tokens: 0, cost: 0, requests: 0 },
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
    if (!doctorId) return null
    
    const doctorRequests = this.usageData.requests.filter(req => req.doctorId === doctorId)
    const today = new Date().toISOString().split('T')[0]
    
    const totalTokens = doctorRequests.reduce((sum, req) => sum + req.totalTokens, 0)
    const totalCost = doctorRequests.reduce((sum, req) => sum + req.cost, 0)
    const totalRequests = doctorRequests.length
    
    // Today's usage for this doctor
    const todayRequests = doctorRequests.filter(req => req.timestamp.startsWith(today))
    const todayTokens = todayRequests.reduce((sum, req) => sum + req.totalTokens, 0)
    const todayCost = todayRequests.reduce((sum, req) => sum + req.cost, 0)
    const todayRequestCount = todayRequests.length
    
    return {
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
  }

  // Get all doctors with their usage stats
  getAllDoctorsUsageStats() {
    const doctorIds = [...new Set(this.usageData.requests.map(req => req.doctorId).filter(id => id))]
    
    return doctorIds.map(doctorId => ({
      doctorId,
      stats: this.getDoctorUsageStats(doctorId)
    }))
  }
}

const aiTokenTracker = new AITokenTracker()
export default aiTokenTracker
