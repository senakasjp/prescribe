/**
 * Error Handling Service
 * Centralized error handling and user feedback
 */

import { ERROR_MESSAGES, NOTIFICATION_TYPES } from '../utils/constants.js'

class ErrorHandlingService {
  constructor() {
    this.errorLog = []
    this.maxLogSize = 100
  }

  /**
   * Handle and log errors with context
   * @param {Error} error - The error to handle
   * @param {string} context - Context where the error occurred
   * @param {object} additionalData - Additional data for debugging
   * @returns {object} - User-friendly error information
   */
  handleError(error, context = 'Unknown', additionalData = {}) {
    const errorInfo = {
      id: this.generateErrorId(),
      timestamp: new Date().toISOString(),
      context,
      message: error.message,
      stack: error.stack,
      additionalData,
      userMessage: this.getUserMessage(error),
      severity: this.getSeverity(error),
      category: this.categorizeError(error)
    }

    // Log error
    this.logError(errorInfo)
    
    // Store in error log
    this.addToErrorLog(errorInfo)

    return {
      id: errorInfo.id,
      userMessage: errorInfo.userMessage,
      severity: errorInfo.severity,
      category: errorInfo.category,
      timestamp: errorInfo.timestamp
    }
  }

  /**
   * Get user-friendly error message
   * @param {Error} error - The error
   * @returns {string} - User-friendly message
   */
  getUserMessage(error) {
    // Check for custom user message
    if (error.userMessage) {
      return error.userMessage
    }

    // Check for Firebase error codes
    if (error.code) {
      switch (error.code) {
        case 'permission-denied':
          return ERROR_MESSAGES.UNAUTHORIZED
        case 'unavailable':
          return ERROR_MESSAGES.NETWORK_ERROR
        case 'deadline-exceeded':
          return ERROR_MESSAGES.TIMEOUT_ERROR
        case 'not-found':
          return ERROR_MESSAGES.NOT_FOUND
        case 'already-exists':
          return 'This item already exists'
        case 'failed-precondition':
          return 'Operation cannot be completed at this time'
        case 'resource-exhausted':
          return 'Service temporarily unavailable. Please try again later'
        default:
          return ERROR_MESSAGES.UNKNOWN_ERROR
      }
    }

    // Check for common error patterns
    if (error.message.includes('network') || error.message.includes('fetch')) {
      return ERROR_MESSAGES.NETWORK_ERROR
    }

    if (error.message.includes('timeout')) {
      return ERROR_MESSAGES.TIMEOUT_ERROR
    }

    if (error.message.includes('unauthorized') || error.message.includes('permission')) {
      return ERROR_MESSAGES.UNAUTHORIZED
    }

    if (error.message.includes('not found')) {
      return ERROR_MESSAGES.NOT_FOUND
    }

    return ERROR_MESSAGES.UNKNOWN_ERROR
  }

  /**
   * Get error severity level
   * @param {Error} error - The error
   * @returns {string} - Severity level
   */
  getSeverity(error) {
    if (error.code) {
      switch (error.code) {
        case 'permission-denied':
        case 'unauthenticated':
          return 'high'
        case 'unavailable':
        case 'deadline-exceeded':
        case 'resource-exhausted':
          return 'medium'
        case 'not-found':
        case 'already-exists':
          return 'low'
        default:
          return 'medium'
      }
    }

    // Check error message patterns
    if (error.message.includes('network') || error.message.includes('timeout')) {
      return 'medium'
    }

    if (error.message.includes('unauthorized') || error.message.includes('permission')) {
      return 'high'
    }

    return 'medium'
  }

  /**
   * Categorize error for better handling
   * @param {Error} error - The error
   * @returns {string} - Error category
   */
  categorizeError(error) {
    if (error.code) {
      switch (error.code) {
        case 'permission-denied':
        case 'unauthenticated':
          return 'authentication'
        case 'unavailable':
        case 'deadline-exceeded':
        case 'resource-exhausted':
          return 'network'
        case 'not-found':
          return 'not_found'
        case 'already-exists':
          return 'validation'
        case 'failed-precondition':
          return 'business_logic'
        default:
          return 'unknown'
      }
    }

    if (error.message.includes('network') || error.message.includes('fetch')) {
      return 'network'
    }

    if (error.message.includes('timeout')) {
      return 'network'
    }

    if (error.message.includes('unauthorized') || error.message.includes('permission')) {
      return 'authentication'
    }

    if (error.message.includes('validation') || error.message.includes('invalid')) {
      return 'validation'
    }

    return 'unknown'
  }

  /**
   * Log error to console with appropriate level
   * @param {object} errorInfo - Error information object
   */
  logError(errorInfo) {
    const logMessage = `[${errorInfo.timestamp}] ${errorInfo.context}: ${errorInfo.message}`
    
    switch (errorInfo.severity) {
      case 'high':
        console.error(`🚨 ${logMessage}`, errorInfo)
        break
      case 'medium':
        console.warn(`⚠️ ${logMessage}`, errorInfo)
        break
      case 'low':
        console.info(`ℹ️ ${logMessage}`, errorInfo)
        break
      default:
        console.error(`❌ ${logMessage}`, errorInfo)
    }
  }

  /**
   * Add error to error log
   * @param {object} errorInfo - Error information object
   */
  addToErrorLog(errorInfo) {
    this.errorLog.unshift(errorInfo)
    
    // Keep only the most recent errors
    if (this.errorLog.length > this.maxLogSize) {
      this.errorLog = this.errorLog.slice(0, this.maxLogSize)
    }
  }

  /**
   * Generate unique error ID
   * @returns {string} - Unique error ID
   */
  generateErrorId() {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Get recent errors
   * @param {number} limit - Maximum number of errors to return
   * @returns {Array} - Array of recent errors
   */
  getRecentErrors(limit = 10) {
    return this.errorLog.slice(0, limit)
  }

  /**
   * Get errors by category
   * @param {string} category - Error category
   * @returns {Array} - Array of errors in the category
   */
  getErrorsByCategory(category) {
    return this.errorLog.filter(error => error.category === category)
  }

  /**
   * Get errors by severity
   * @param {string} severity - Error severity
   * @returns {Array} - Array of errors with the severity
   */
  getErrorsBySeverity(severity) {
    return this.errorLog.filter(error => error.severity === severity)
  }

  /**
   * Clear error log
   */
  clearErrorLog() {
    this.errorLog = []
  }

  /**
   * Get error statistics
   * @returns {object} - Error statistics
   */
  getErrorStats() {
    const stats = {
      total: this.errorLog.length,
      byCategory: {},
      bySeverity: {},
      recent: this.errorLog.slice(0, 5)
    }

    this.errorLog.forEach(error => {
      // Count by category
      stats.byCategory[error.category] = (stats.byCategory[error.category] || 0) + 1
      
      // Count by severity
      stats.bySeverity[error.severity] = (stats.bySeverity[error.severity] || 0) + 1
    })

    return stats
  }

  /**
   * Create a user-friendly notification from error
   * @param {Error} error - The error
   * @param {string} context - Context where the error occurred
   * @returns {object} - Notification object
   */
  createNotification(error, context = 'Unknown') {
    const errorInfo = this.handleError(error, context)
    
    return {
      id: errorInfo.id,
      type: this.getNotificationType(errorInfo.severity),
      title: this.getNotificationTitle(errorInfo.category),
      message: errorInfo.userMessage,
      timestamp: errorInfo.timestamp,
      context: context,
      severity: errorInfo.severity,
      category: errorInfo.category
    }
  }

  /**
   * Get notification type based on severity
   * @param {string} severity - Error severity
   * @returns {string} - Notification type
   */
  getNotificationType(severity) {
    switch (severity) {
      case 'high':
        return NOTIFICATION_TYPES.ERROR
      case 'medium':
        return NOTIFICATION_TYPES.WARNING
      case 'low':
        return NOTIFICATION_TYPES.INFO
      default:
        return NOTIFICATION_TYPES.ERROR
    }
  }

  /**
   * Get notification title based on category
   * @param {string} category - Error category
   * @returns {string} - Notification title
   */
  getNotificationTitle(category) {
    switch (category) {
      case 'authentication':
        return 'Authentication Error'
      case 'network':
        return 'Connection Error'
      case 'not_found':
        return 'Not Found'
      case 'validation':
        return 'Validation Error'
      case 'business_logic':
        return 'Operation Error'
      default:
        return 'Error'
    }
  }

  /**
   * Wrap async function with error handling
   * @param {Function} fn - Async function to wrap
   * @param {string} context - Context for error handling
   * @returns {Function} - Wrapped function
   */
  wrapAsync(fn, context = 'Unknown') {
    return async (...args) => {
      try {
        return await fn(...args)
      } catch (error) {
        const errorInfo = this.handleError(error, context, { args })
        throw new Error(errorInfo.userMessage)
      }
    }
  }

  /**
   * Wrap sync function with error handling
   * @param {Function} fn - Sync function to wrap
   * @param {string} context - Context for error handling
   * @returns {Function} - Wrapped function
   */
  wrapSync(fn, context = 'Unknown') {
    return (...args) => {
      try {
        return fn(...args)
      } catch (error) {
        const errorInfo = this.handleError(error, context, { args })
        throw new Error(errorInfo.userMessage)
      }
    }
  }
}

// Create and export singleton instance
const errorHandlingService = new ErrorHandlingService()
export default errorHandlingService
