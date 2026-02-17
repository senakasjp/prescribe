/**
 * Performance Monitoring Service
 * Tracks and monitors application performance metrics
 */

class PerformanceMonitoringService {
  constructor() {
    this.metrics = {
      apiCalls: [],
      componentRenders: [],
      userInteractions: [],
      errors: [],
      memoryUsage: [],
      networkRequests: []
    }
    
    this.thresholds = {
      slowApiCall: 1000, // 1 second
      slowComponentRender: 100, // 100ms
      slowUserInteraction: 500, // 500ms
      highMemoryUsage: 50 * 1024 * 1024, // 50MB
      slowNetworkRequest: 2000 // 2 seconds
    }
    
    this.isMonitoring = true
    this.maxMetricsPerType = 100
  }

  /**
   * Start monitoring
   */
  startMonitoring() {
    this.isMonitoring = true
    console.log('📊 Performance monitoring started')
    
    // Monitor memory usage
    this.startMemoryMonitoring()
    
    // Monitor network requests
    this.startNetworkMonitoring()
  }

  /**
   * Stop monitoring
   */
  stopMonitoring() {
    this.isMonitoring = false
    console.log('📊 Performance monitoring stopped')
  }

  /**
   * Track API call performance
   * @param {string} endpoint - API endpoint
   * @param {string} method - HTTP method
   * @param {number} duration - Duration in milliseconds
   * @param {boolean} success - Whether the call was successful
   * @param {object} metadata - Additional metadata
   */
  trackApiCall(endpoint, method, duration, success = true, metadata = {}) {
    if (!this.isMonitoring) return

    const metric = {
      id: this.generateMetricId(),
      timestamp: Date.now(),
      endpoint,
      method,
      duration,
      success,
      metadata,
      isSlow: duration > this.thresholds.slowApiCall
    }

    this.addMetric('apiCalls', metric)
    
    if (metric.isSlow) {
      console.warn(`🐌 Slow API call: ${method} ${endpoint} took ${duration}ms`)
    }
  }

  /**
   * Track component render performance
   * @param {string} componentName - Name of the component
   * @param {number} duration - Duration in milliseconds
   * @param {object} metadata - Additional metadata
   */
  trackComponentRender(componentName, duration, metadata = {}) {
    if (!this.isMonitoring) return

    const metric = {
      id: this.generateMetricId(),
      timestamp: Date.now(),
      componentName,
      duration,
      metadata,
      isSlow: duration > this.thresholds.slowComponentRender
    }

    this.addMetric('componentRenders', metric)
    
    if (metric.isSlow) {
      console.warn(`🐌 Slow component render: ${componentName} took ${duration}ms`)
    }
  }

  /**
   * Track user interaction performance
   * @param {string} interactionType - Type of interaction (click, input, etc.)
   * @param {string} target - Target element or component
   * @param {number} duration - Duration in milliseconds
   * @param {object} metadata - Additional metadata
   */
  trackUserInteraction(interactionType, target, duration, metadata = {}) {
    if (!this.isMonitoring) return

    const metric = {
      id: this.generateMetricId(),
      timestamp: Date.now(),
      interactionType,
      target,
      duration,
      metadata,
      isSlow: duration > this.thresholds.slowUserInteraction
    }

    this.addMetric('userInteractions', metric)
    
    if (metric.isSlow) {
      console.warn(`🐌 Slow user interaction: ${interactionType} on ${target} took ${duration}ms`)
    }
  }

  /**
   * Track error occurrence
   * @param {Error} error - The error that occurred
   * @param {string} context - Context where the error occurred
   * @param {object} metadata - Additional metadata
   */
  trackError(error, context, metadata = {}) {
    if (!this.isMonitoring) return

    const metric = {
      id: this.generateMetricId(),
      timestamp: Date.now(),
      error: {
        message: error.message,
        stack: error.stack,
        name: error.name
      },
      context,
      metadata
    }

    this.addMetric('errors', metric)
    console.error(`❌ Error tracked: ${error.message} in ${context}`)
  }

  /**
   * Track memory usage
   * @param {number} memoryUsage - Memory usage in bytes
   */
  trackMemoryUsage(memoryUsage) {
    if (!this.isMonitoring) return

    const metric = {
      id: this.generateMetricId(),
      timestamp: Date.now(),
      memoryUsage,
      isHigh: memoryUsage > this.thresholds.highMemoryUsage
    }

    this.addMetric('memoryUsage', metric)
    
    if (metric.isHigh) {
      console.warn(`🐌 High memory usage: ${this.formatBytes(memoryUsage)}`)
    }
  }

  /**
   * Track network request performance
   * @param {string} url - Request URL
   * @param {string} method - HTTP method
   * @param {number} duration - Duration in milliseconds
   * @param {number} size - Response size in bytes
   * @param {boolean} success - Whether the request was successful
   */
  trackNetworkRequest(url, method, duration, size = 0, success = true) {
    if (!this.isMonitoring) return

    const metric = {
      id: this.generateMetricId(),
      timestamp: Date.now(),
      url,
      method,
      duration,
      size,
      success,
      isSlow: duration > this.thresholds.slowNetworkRequest
    }

    this.addMetric('networkRequests', metric)
    
    if (metric.isSlow) {
      console.warn(`🐌 Slow network request: ${method} ${url} took ${duration}ms`)
    }
  }

  /**
   * Add metric to the appropriate collection
   * @param {string} type - Type of metric
   * @param {object} metric - Metric data
   */
  addMetric(type, metric) {
    if (!this.metrics[type]) {
      this.metrics[type] = []
    }

    this.metrics[type].unshift(metric)

    // Keep only the most recent metrics
    if (this.metrics[type].length > this.maxMetricsPerType) {
      this.metrics[type] = this.metrics[type].slice(0, this.maxMetricsPerType)
    }
  }

  /**
   * Generate unique metric ID
   * @returns {string} - Unique metric ID
   */
  generateMetricId() {
    return `metric_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Start memory monitoring
   */
  startMemoryMonitoring() {
    if (typeof performance !== 'undefined' && performance.memory) {
      setInterval(() => {
        const memoryInfo = performance.memory
        this.trackMemoryUsage(memoryInfo.usedJSHeapSize)
      }, 30000) // Check every 30 seconds
    }
  }

  /**
   * Start network monitoring
   */
  startNetworkMonitoring() {
    if (typeof performance !== 'undefined' && performance.getEntriesByType) {
      // Monitor existing network entries
      const networkEntries = performance.getEntriesByType('resource')
      networkEntries.forEach(entry => {
        this.trackNetworkRequest(
          entry.name,
          'GET', // Default method
          entry.duration,
          entry.transferSize || 0,
          true
        )
      })
    }
  }

  /**
   * Get performance statistics
   * @returns {object} - Performance statistics
   */
  getPerformanceStats() {
    const stats = {
      apiCalls: this.getStatsForType('apiCalls'),
      componentRenders: this.getStatsForType('componentRenders'),
      userInteractions: this.getStatsForType('userInteractions'),
      errors: this.getStatsForType('errors'),
      memoryUsage: this.getStatsForType('memoryUsage'),
      networkRequests: this.getStatsForType('networkRequests')
    }

    return stats
  }

  /**
   * Get statistics for a specific metric type
   * @param {string} type - Metric type
   * @returns {object} - Statistics for the metric type
   */
  getStatsForType(type) {
    const metrics = this.metrics[type] || []
    
    if (metrics.length === 0) {
      return {
        count: 0,
        average: 0,
        min: 0,
        max: 0,
        slowCount: 0
      }
    }

    const durations = metrics
      .filter(m => typeof m.duration === 'number')
      .map(m => m.duration)

    const slowCount = metrics.filter(m => m.isSlow).length

    return {
      count: metrics.length,
      average: durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0,
      min: durations.length > 0 ? Math.min(...durations) : 0,
      max: durations.length > 0 ? Math.max(...durations) : 0,
      slowCount,
      recent: metrics.slice(0, 5)
    }
  }

  /**
   * Get slow operations
   * @returns {object} - Slow operations grouped by type
   */
  getSlowOperations() {
    const slowOps = {}

    Object.keys(this.metrics).forEach(type => {
      slowOps[type] = this.metrics[type].filter(metric => metric.isSlow)
    })

    return slowOps
  }

  /**
   * Clear all metrics
   */
  clearMetrics() {
    Object.keys(this.metrics).forEach(type => {
      this.metrics[type] = []
    })
  }

  /**
   * Format bytes to human readable format
   * @param {number} bytes - Bytes to format
   * @returns {string} - Formatted string
   */
  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes'
    
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  /**
   * Create performance report
   * @returns {object} - Performance report
   */
  generateReport() {
    const stats = this.getPerformanceStats()
    const slowOps = this.getSlowOperations()
    
    return {
      timestamp: new Date().toISOString(),
      summary: {
        totalApiCalls: stats.apiCalls.count,
        totalComponentRenders: stats.componentRenders.count,
        totalUserInteractions: stats.userInteractions.count,
        totalErrors: stats.errors.count,
        slowOperations: Object.values(slowOps).reduce((total, ops) => total + ops.length, 0)
      },
      stats,
      slowOperations: slowOps,
      recommendations: this.generateRecommendations(stats, slowOps)
    }
  }

  /**
   * Generate performance recommendations
   * @param {object} stats - Performance statistics
   * @param {object} slowOps - Slow operations
   * @returns {Array} - Array of recommendations
   */
  generateRecommendations(stats, slowOps) {
    const recommendations = []

    if (stats.apiCalls.slowCount > 0) {
      recommendations.push({
        type: 'api',
        message: `${stats.apiCalls.slowCount} slow API calls detected. Consider optimizing backend or implementing caching.`,
        priority: 'medium'
      })
    }

    if (stats.componentRenders.slowCount > 0) {
      recommendations.push({
        type: 'component',
        message: `${stats.componentRenders.slowCount} slow component renders detected. Consider optimizing component logic or implementing lazy loading.`,
        priority: 'high'
      })
    }

    if (stats.userInteractions.slowCount > 0) {
      recommendations.push({
        type: 'interaction',
        message: `${stats.userInteractions.slowCount} slow user interactions detected. Consider optimizing event handlers or implementing debouncing.`,
        priority: 'medium'
      })
    }

    if (stats.errors.count > 0) {
      recommendations.push({
        type: 'error',
        message: `${stats.errors.count} errors detected. Review error handling and fix underlying issues.`,
        priority: 'high'
      })
    }

    return recommendations
  }
}

// Create and export singleton instance
const performanceMonitoringService = new PerformanceMonitoringService()
export default performanceMonitoringService
