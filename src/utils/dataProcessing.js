/**
 * Data processing utility functions
 * Provides common data manipulation and processing functions
 */

/**
 * Formats date to readable string
 * @param {string|Date} date - Date to format
 * @param {object} options - Formatting options
 * @returns {string} - Formatted date string
 */
export function formatDate(date, options = {}) {
  if (!date) return 'Unknown'
  
  try {
    const dateObj = new Date(date)
    if (isNaN(dateObj.getTime())) return 'Invalid Date'
    
    const {
      includeTime = false,
      format = 'short',
      locale = 'en-US'
    } = options
    
    if (format === 'long') {
      return dateObj.toLocaleDateString(locale, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        ...(includeTime && {
          hour: '2-digit',
          minute: '2-digit'
        })
      })
    } else if (format === 'short') {
      return dateObj.toLocaleDateString(locale, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        ...(includeTime && {
          hour: '2-digit',
          minute: '2-digit'
        })
      })
    } else if (format === 'time') {
      return dateObj.toLocaleTimeString(locale, {
        hour: '2-digit',
        minute: '2-digit'
      })
    }
    
    return dateObj.toLocaleDateString(locale)
  } catch (error) {
    console.error('Error formatting date:', error)
    return 'Invalid Date'
  }
}

/**
 * Calculates age from date of birth
 * @param {string|Date} dateOfBirth - Date of birth
 * @returns {number|null} - Age in years or null if invalid
 */
export function calculateAge(dateOfBirth) {
  if (!dateOfBirth) return null
  
  try {
    const birthDate = new Date(dateOfBirth)
    const today = new Date()
    
    if (isNaN(birthDate.getTime())) return null
    
    let age = today.getFullYear() - birthDate.getFullYear()
    const monthDiff = today.getMonth() - birthDate.getMonth()
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--
    }
    
    return age >= 0 ? age : null
  } catch (error) {
    console.error('Error calculating age:', error)
    return null
  }
}

/**
 * Groups array of objects by a specific key
 * @param {array} array - Array to group
 * @param {string} key - Key to group by
 * @returns {object} - Grouped object
 */
export function groupBy(array, key) {
  if (!Array.isArray(array)) return {}
  
  return array.reduce((groups, item) => {
    const groupKey = item[key]
    if (!groups[groupKey]) {
      groups[groupKey] = []
    }
    groups[groupKey].push(item)
    return groups
  }, {})
}

/**
 * Sorts array by date (newest first)
 * @param {array} array - Array to sort
 * @param {string} dateField - Date field name
 * @returns {array} - Sorted array
 */
export function sortByDate(array, dateField = 'createdAt') {
  if (!Array.isArray(array)) return []
  
  return [...array].sort((a, b) => {
    const dateA = new Date(a[dateField] || 0)
    const dateB = new Date(b[dateField] || 0)
    return dateB.getTime() - dateA.getTime()
  })
}

/**
 * Filters array by search query
 * @param {array} array - Array to filter
 * @param {string} query - Search query
 * @param {array} fields - Fields to search in
 * @returns {array} - Filtered array
 */
export function filterBySearch(array, query, fields = []) {
  if (!Array.isArray(array) || !query) return array
  
  const lowercaseQuery = query.toLowerCase().trim()
  
  return array.filter(item => {
    return fields.some(field => {
      const value = item[field]
      if (value === null || value === undefined) return false
      return String(value).toLowerCase().includes(lowercaseQuery)
    })
  })
}

/**
 * Calculates statistics from array
 * @param {array} array - Array to calculate stats for
 * @param {string} field - Field to calculate stats for
 * @returns {object} - Statistics object
 */
export function calculateStats(array, field = 'value') {
  if (!Array.isArray(array) || array.length === 0) {
    return { count: 0, sum: 0, average: 0, min: 0, max: 0 }
  }
  
  const values = array.map(item => {
    const value = item[field]
    return typeof value === 'number' ? value : 0
  }).filter(value => !isNaN(value))
  
  if (values.length === 0) {
    return { count: 0, sum: 0, average: 0, min: 0, max: 0 }
  }
  
  const sum = values.reduce((acc, val) => acc + val, 0)
  const average = sum / values.length
  const min = Math.min(...values)
  const max = Math.max(...values)
  
  return {
    count: values.length,
    sum,
    average: Math.round(average * 100) / 100,
    min,
    max
  }
}

/**
 * Debounces function calls
 * @param {function} func - Function to debounce
 * @param {number} delay - Delay in milliseconds
 * @returns {function} - Debounced function
 */
export function debounce(func, delay) {
  let timeoutId
  return function (...args) {
    clearTimeout(timeoutId)
    timeoutId = setTimeout(() => func.apply(this, args), delay)
  }
}

/**
 * Throttles function calls
 * @param {function} func - Function to throttle
 * @param {number} delay - Delay in milliseconds
 * @returns {function} - Throttled function
 */
export function throttle(func, delay) {
  let lastCall = 0
  return function (...args) {
    const now = Date.now()
    if (now - lastCall >= delay) {
      lastCall = now
      return func.apply(this, args)
    }
  }
}

/**
 * Deep clones an object
 * @param {any} obj - Object to clone
 * @returns {any} - Cloned object
 */
export function deepClone(obj) {
  if (obj === null || typeof obj !== 'object') return obj
  if (obj instanceof Date) return new Date(obj.getTime())
  if (obj instanceof Array) return obj.map(item => deepClone(item))
  if (typeof obj === 'object') {
    const clonedObj = {}
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        clonedObj[key] = deepClone(obj[key])
      }
    }
    return clonedObj
  }
}

/**
 * Merges two objects deeply
 * @param {object} target - Target object
 * @param {object} source - Source object
 * @returns {object} - Merged object
 */
export function deepMerge(target, source) {
  const result = deepClone(target)
  
  for (const key in source) {
    if (source.hasOwnProperty(key)) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = deepMerge(result[key] || {}, source[key])
      } else {
        result[key] = source[key]
      }
    }
  }
  
  return result
}

/**
 * Generates unique ID
 * @param {string} prefix - Prefix for the ID
 * @returns {string} - Unique ID
 */
export function generateId(prefix = 'id') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Formats file size in human readable format
 * @param {number} bytes - File size in bytes
 * @returns {string} - Formatted file size
 */
export function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes'
  
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

/**
 * Truncates text to specified length
 * @param {string} text - Text to truncate
 * @param {number} maxLength - Maximum length
 * @param {string} suffix - Suffix to add (default: '...')
 * @returns {string} - Truncated text
 */
export function truncateText(text, maxLength, suffix = '...') {
  if (!text || typeof text !== 'string') return ''
  if (text.length <= maxLength) return text
  return text.substring(0, maxLength - suffix.length) + suffix
}
