/**
 * UI utility functions
 * Provides common UI-related helper functions
 */

/**
 * Generates CSS classes based on conditions
 * @param {object} classes - Object with class names as keys and conditions as values
 * @returns {string} - Space-separated class names
 */
export function classNames(classes) {
  if (!classes || typeof classes !== 'object') return ''
  
  return Object.entries(classes)
    .filter(([_, condition]) => Boolean(condition))
    .map(([className, _]) => className)
    .join(' ')
}

/**
 * Generates responsive classes
 * @param {object} config - Responsive configuration
 * @returns {string} - Responsive class string
 */
export function responsiveClasses(config) {
  if (!config || typeof config !== 'object') return ''
  
  const breakpoints = ['sm', 'md', 'lg', 'xl']
  const classes = []
  
  // Base class
  if (config.base) {
    classes.push(config.base)
  }
  
  // Responsive classes
  breakpoints.forEach(breakpoint => {
    if (config[breakpoint]) {
      classes.push(`${breakpoint}:${config[breakpoint]}`)
    }
  })
  
  return classes.join(' ')
}

/**
 * Generates color classes based on status
 * @param {string} status - Status value
 * @param {object} colorMap - Color mapping object
 * @returns {string} - Color class
 */
export function getStatusColor(status, colorMap = {}) {
  const defaultColorMap = {
    active: 'teal',
    inactive: 'gray',
    pending: 'yellow',
    completed: 'green',
    cancelled: 'red',
    error: 'red',
    warning: 'yellow',
    info: 'blue',
    success: 'teal'
  }
  
  const color = colorMap[status] || defaultColorMap[status] || 'gray'
  return `text-${color}-600 bg-${color}-50 border-${color}-200`
}

/**
 * Generates icon classes based on type
 * @param {string} type - Icon type
 * @param {object} iconMap - Icon mapping object
 * @returns {string} - Icon class
 */
export function getIconClass(type, iconMap = {}) {
  const defaultIconMap = {
    user: 'fas fa-user',
    doctor: 'fas fa-user-md',
    pharmacist: 'fas fa-pills',
    patient: 'fas fa-user-injured',
    prescription: 'fas fa-prescription-bottle-alt',
    medication: 'fas fa-pills',
    symptom: 'fas fa-exclamation-triangle',
    illness: 'fas fa-heartbeat',
    report: 'fas fa-file-medical',
    diagnosis: 'fas fa-stethoscope',
    edit: 'fas fa-edit',
    delete: 'fas fa-trash',
    save: 'fas fa-save',
    cancel: 'fas fa-times',
    add: 'fas fa-plus',
    remove: 'fas fa-minus',
    search: 'fas fa-search',
    filter: 'fas fa-filter',
    sort: 'fas fa-sort',
    download: 'fas fa-download',
    upload: 'fas fa-upload',
    print: 'fas fa-print',
    email: 'fas fa-envelope',
    phone: 'fas fa-phone',
    calendar: 'fas fa-calendar',
    clock: 'fas fa-clock',
    location: 'fas fa-map-marker-alt',
    home: 'fas fa-home',
    settings: 'fas fa-cog',
    admin: 'fas fa-shield-alt',
    warning: 'fas fa-exclamation-triangle',
    error: 'fas fa-exclamation-circle',
    success: 'fas fa-check-circle',
    info: 'fas fa-info-circle'
  }
  
  return iconMap[type] || defaultIconMap[type] || 'fas fa-question-circle'
}

/**
 * Generates button classes based on variant
 * @param {string} variant - Button variant
 * @param {object} options - Additional options
 * @returns {string} - Button class string
 */
export function getButtonClasses(variant = 'primary', options = {}) {
  const { size = 'md', disabled = false, fullWidth = false } = options
  
  const baseClasses = 'inline-flex items-center justify-center font-medium rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2'
  
  const variantClasses = {
    primary: 'bg-teal-600 text-white hover:bg-teal-700 focus:ring-teal-500',
    secondary: 'bg-gray-200 text-gray-900 hover:bg-gray-300 focus:ring-gray-500',
    danger: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500',
    warning: 'bg-yellow-600 text-white hover:bg-yellow-700 focus:ring-yellow-500',
    success: 'bg-teal-600 text-white hover:bg-teal-700 focus:ring-teal-500',
    outline: 'border border-gray-300 text-gray-700 hover:bg-gray-50 focus:ring-gray-500',
    ghost: 'text-gray-700 hover:bg-gray-100 focus:ring-gray-500'
  }
  
  const sizeClasses = {
    xs: 'px-2 py-1 text-xs',
    sm: 'px-3 py-2 text-sm',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base',
    xl: 'px-8 py-4 text-lg'
  }
  
  const disabledClasses = disabled ? 'opacity-50 cursor-not-allowed' : ''
  const widthClasses = fullWidth ? 'w-full' : ''
  
  return classNames({
    [baseClasses]: true,
    [variantClasses[variant]]: true,
    [sizeClasses[size]]: true,
    [disabledClasses]: disabled,
    [widthClasses]: fullWidth
  })
}

/**
 * Generates input classes based on state
 * @param {object} state - Input state
 * @returns {string} - Input class string
 */
export function getInputClasses(state = {}) {
  const { error = false, disabled = false, size = 'md' } = state
  
  const baseClasses = 'block w-full border rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-0'
  
  const stateClasses = error 
    ? 'border-red-300 text-red-900 placeholder-red-300 focus:ring-red-500 focus:border-red-500'
    : 'border-gray-300 text-gray-900 placeholder-gray-500 focus:ring-teal-500 focus:border-teal-500'
  
  const sizeClasses = {
    sm: 'px-3 py-2 text-sm',
    md: 'px-3 py-2 text-sm',
    lg: 'px-4 py-3 text-base'
  }
  
  const disabledClasses = disabled ? 'bg-gray-50 cursor-not-allowed' : 'bg-white'
  
  return classNames({
    [baseClasses]: true,
    [stateClasses]: true,
    [sizeClasses[size]]: true,
    [disabledClasses]: disabled
  })
}

/**
 * Generates card classes based on variant
 * @param {string} variant - Card variant
 * @param {object} options - Additional options
 * @returns {string} - Card class string
 */
export function getCardClasses(variant = 'default', options = {}) {
  const { padding = 'md', shadow = true, border = true } = options
  
  const baseClasses = 'bg-white rounded-lg'
  
  const variantClasses = {
    default: '',
    elevated: 'shadow-lg',
    outlined: 'border border-gray-200',
    filled: 'bg-gray-50'
  }
  
  const paddingClasses = {
    none: '',
    sm: 'p-3',
    md: 'p-4',
    lg: 'p-6',
    xl: 'p-8'
  }
  
  const shadowClasses = shadow ? 'shadow-sm' : ''
  const borderClasses = border ? 'border border-gray-200' : ''
  
  return classNames({
    [baseClasses]: true,
    [variantClasses[variant]]: true,
    [paddingClasses[padding]]: true,
    [shadowClasses]: shadow,
    [borderClasses]: border
  })
}

/**
 * Generates badge classes based on variant
 * @param {string} variant - Badge variant
 * @param {object} options - Additional options
 * @returns {string} - Badge class string
 */
export function getBadgeClasses(variant = 'default', options = {}) {
  const { size = 'sm' } = options
  
  const baseClasses = 'inline-flex items-center font-medium rounded-full'
  
  const variantClasses = {
    default: 'bg-gray-100 text-gray-800',
    primary: 'bg-teal-100 text-teal-800',
    secondary: 'bg-gray-100 text-gray-800',
    success: 'bg-teal-100 text-teal-800',
    warning: 'bg-yellow-100 text-yellow-800',
    danger: 'bg-red-100 text-red-800',
    info: 'bg-blue-100 text-blue-800'
  }
  
  const sizeClasses = {
    xs: 'px-2 py-0.5 text-xs',
    sm: 'px-2.5 py-0.5 text-xs',
    md: 'px-3 py-1 text-sm',
    lg: 'px-4 py-1.5 text-sm'
  }
  
  return classNames({
    [baseClasses]: true,
    [variantClasses[variant]]: true,
    [sizeClasses[size]]: true
  })
}

/**
 * Generates loading spinner classes
 * @param {object} options - Spinner options
 * @returns {string} - Spinner class string
 */
export function getSpinnerClasses(options = {}) {
  const { size = 'md', color = 'teal' } = options
  
  const baseClasses = 'animate-spin rounded-full border-solid'
  
  const sizeClasses = {
    xs: 'w-3 h-3 border',
    sm: 'w-4 h-4 border',
    md: 'w-6 h-6 border-2',
    lg: 'w-8 h-8 border-2',
    xl: 'w-12 h-12 border-4'
  }
  
  const colorClasses = {
    teal: 'border-teal-600',
    gray: 'border-gray-600',
    white: 'border-white',
    blue: 'border-blue-600',
    teal: 'border-teal-600',
    red: 'border-red-600'
  }
  
  return classNames({
    [baseClasses]: true,
    [sizeClasses[size]]: true,
    [colorClasses[color]]: true
  })
}

/**
 * Generates tooltip classes
 * @param {object} options - Tooltip options
 * @returns {string} - Tooltip class string
 */
export function getTooltipClasses(options = {}) {
  const { position = 'top', size = 'sm' } = options
  
  const baseClasses = 'absolute z-50 px-2 py-1 text-white bg-gray-900 rounded shadow-lg'
  
  const positionClasses = {
    top: 'bottom-full left-1/2 transform -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 transform -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 transform -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 transform -translate-y-1/2 ml-2'
  }
  
  const sizeClasses = {
    xs: 'text-xs',
    sm: 'text-sm',
    md: 'text-base'
  }
  
  return classNames({
    [baseClasses]: true,
    [positionClasses[position]]: true,
    [sizeClasses[size]]: true
  })
}
