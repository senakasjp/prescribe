<script>
  import { createEventDispatcher, onMount } from 'svelte'
  import authService from '../services/authService.js'
  import { notifySuccess, notifyError } from '../stores/notifications.js'
  import firebaseStorage from '../services/firebaseStorage.js'
  import backupService from '../services/backupService.js'
  import { countries } from '../data/countries.js'
  import { cities, getCitiesByCountry } from '../data/cities.js'
  import ThreeDots from './ThreeDots.svelte'
  
  
  const dispatch = createEventDispatcher()
  export let user
  
  let firstName = ''
  let lastName = ''
  let email = ''
  let country = ''
  let city = ''
  let consultationCharge = ''
  let hospitalCharge = ''
  let currency = 'USD'
  let loading = false
  let error = ''

  // Backup/restore state
  let backupLoading = false
  let backupError = ''
  let backupSuccess = ''
  let restoreLoading = false
  let restoreError = ''
  let restoreSuccess = ''
  let restoreFile = null
  let restoreSummary = null
  
  // Currency options
  const currencies = [
    { code: 'USD', name: 'US Dollar', symbol: '$' },
    { code: 'EUR', name: 'Euro', symbol: '€' },
    { code: 'GBP', name: 'British Pound', symbol: '£' },
    { code: 'LKR', name: 'Sri Lankan Rupee', symbol: '₨' },
    { code: 'INR', name: 'Indian Rupee', symbol: '₹' },
    { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$' },
    { code: 'AUD', name: 'Australian Dollar', symbol: 'A$' },
    { code: 'JPY', name: 'Japanese Yen', symbol: '¥' },
    { code: 'CNY', name: 'Chinese Yuan', symbol: '¥' },
    { code: 'KRW', name: 'South Korean Won', symbol: '₩' },
    { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$' },
    { code: 'MYR', name: 'Malaysian Ringgit', symbol: 'RM' },
    { code: 'THB', name: 'Thai Baht', symbol: '฿' },
    { code: 'PHP', name: 'Philippine Peso', symbol: '₱' },
    { code: 'IDR', name: 'Indonesian Rupiah', symbol: 'Rp' },
    { code: 'VND', name: 'Vietnamese Dong', symbol: '₫' },
    { code: 'AED', name: 'UAE Dirham', symbol: 'د.إ' },
    { code: 'SAR', name: 'Saudi Riyal', symbol: '﷼' },
    { code: 'QAR', name: 'Qatari Riyal', symbol: '﷼' },
    { code: 'KWD', name: 'Kuwaiti Dinar', symbol: 'د.ك' }
  ]
  
  // Prescription template variables
  let prescriptionTemplates = []
  let newTemplateName = ''
  let newTemplateContent = ''
  
  // Tab management
  let activeTab = 'edit-profile'
  
  // Prescription template variables
  let templateType = 'printed' // 'printed', 'upload', 'system'
  let uploadedHeader = null
  let templatePreview = null
  let headerSize = 300 // Default header size in pixels
  let procedurePricing = []

  // Reactive variable for cities based on selected country
  $: {
    console.log('🔍 Debug - Reactive statement triggered:')
    console.log('  country:', country, typeof country)
    console.log('  city:', city, typeof city)
    
    try {
      availableCities = (country && typeof country === 'string' && country.trim()) ? getCitiesByCountry(country.trim()) : []
      console.log('  availableCities set successfully:', availableCities.length, 'cities')
    } catch (error) {
      console.error('❌ Error in reactive statement for cities:', error)
      availableCities = []
    }
  }

  const procedureOptions = [
    'C&D- type -A',
    'C&D-type -B',
    'C&D-type-C',
    'C&D-type-D',
    'Suturing- type-A',
    'Suturing- type-B',
    'Suturing- type-C',
    'Suturing- type-D',
    'Nebulization - Ipra.0.25ml+N. saline2ml',
    'Nebulization - sal 0. 5ml+Ipra 0. 5ml+N. Saline 3ml',
    'Nebulization -sal1ml+Ipra1ml+N. Saline2ml',
    'Nebulization Ipra1ml+N. Saline3ml',
    'Nebulization - pulmicort(Budesonide)',
    'catheterization',
    'IV drip Saline/Dextrose'
  ]

  const normalizeProcedurePricing = (savedPricing) => {
    const pricingMap = {}

    if (Array.isArray(savedPricing)) {
      savedPricing.forEach((item) => {
        if (item && item.name) {
          pricingMap[item.name] = item.price ?? ''
        }
      })
    } else if (savedPricing && typeof savedPricing === 'object') {
      Object.entries(savedPricing).forEach(([name, price]) => {
        pricingMap[name] = price
      })
    }

    return procedureOptions.map((name) => ({
      name,
      price: pricingMap[name] ?? ''
    }))
  }

  const normalizeProcedurePricingForSave = (pricingList) => {
    return (pricingList || []).map((item) => {
      let priceValue = ''
      if (item && item.price !== '' && item.price !== null && item.price !== undefined) {
        const parsed = Number(item.price)
        priceValue = Number.isFinite(parsed) ? parsed : ''
      }
      return {
        name: item?.name || '',
        price: priceValue
      }
    })
  }
  
  
  // Reset city when country changes
  $: {
    try {
      if (country && city && !availableCities.find(c => c.name === city)) {
        console.log('🔍 Debug - Resetting city because not found in availableCities')
        city = ''
      }
    } catch (error) {
      console.error('❌ Error in city reset reactive statement:', error)
    }
  }
  
  // Function to initialize form fields
  const initializeForm = () => {
    if (user) {
      console.log('🔍 Debug - Initializing form with user:', user)
      firstName = String(user.firstName || '')
      lastName = String(user.lastName || '')
      email = String(user.email || '')
      country = String(user.country || '')
      city = String(user.city || '')
      consultationCharge = String(user.consultationCharge || '')
      hospitalCharge = String(user.hospitalCharge || '')
      currency = String(user.currency || 'USD')
      templateType = String(user?.templateSettings?.templateType || templateType)
      headerSize = user?.templateSettings?.headerSize || headerSize
      templatePreview = user?.templateSettings?.templatePreview || templatePreview
      uploadedHeader = user?.templateSettings?.uploadedHeader || uploadedHeader
      procedurePricing = normalizeProcedurePricing(user?.templateSettings?.procedurePricing)
      
      console.log('🔍 Debug - Form initialized:')
      console.log('  firstName:', firstName, typeof firstName)
      console.log('  lastName:', lastName, typeof lastName)
      console.log('  country:', country, typeof country)
      console.log('  city:', city, typeof city)
      console.log('  consultationCharge:', consultationCharge, typeof consultationCharge)
      console.log('  hospitalCharge:', hospitalCharge, typeof hospitalCharge)
    }
  }
  
  // Initialize form fields when component mounts
  onMount(() => {
    // Add global error handler to catch trim errors
    window.addEventListener('error', (event) => {
      if (event.message && event.message.includes('trim is not a function')) {
        console.error('🚨 Global trim error caught:', event)
        console.error('🚨 Error details:', {
          message: event.message,
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
          error: event.error
        })
      }
    })
    
    initializeForm()
  })
  
  // Initialize form fields when user data changes
  $: if (user) {
    try {
      console.log('🔍 Debug - User changed, initializing form:', user)
      initializeForm()
    } catch (error) {
      console.error('❌ Error initializing form:', error)
      // Set default values to prevent errors
      firstName = ''
      lastName = ''
      email = ''
      country = ''
      city = ''
      consultationCharge = ''
      hospitalCharge = ''
      currency = 'USD'
      procedurePricing = normalizeProcedurePricing(null)
    }
  }
  
  
  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault()
    
    error = ''
    loading = true
    
    try {
      // Debug logging to identify the problematic variable
      console.log('🔍 Debug - firstName type:', typeof firstName, 'value:', firstName)
      console.log('🔍 Debug - lastName type:', typeof lastName, 'value:', lastName)
      console.log('🔍 Debug - country type:', typeof country, 'value:', country)
      console.log('🔍 Debug - city type:', typeof city, 'value:', city)
      console.log('🔍 Debug - consultationCharge type:', typeof consultationCharge, 'value:', consultationCharge)
      console.log('🔍 Debug - hospitalCharge type:', typeof hospitalCharge, 'value:', hospitalCharge)
      
      // Validate required fields with safe string conversion
      const safeFirstName = String(firstName || '').trim()
      const safeLastName = String(lastName || '').trim()
      const safeCountry = String(country || '').trim()
      const safeCity = String(city || '').trim()
      
      if (!safeFirstName || !safeLastName) {
        throw new Error('First name and last name are required')
      }
      
      if (!safeCountry) {
        throw new Error('Country is required')
      }
      
      if (!safeCity) {
        throw new Error('City is required')
      }
      
      
      // Update user data
      const updatedUser = {
        ...user,
        firstName: safeFirstName,
        lastName: safeLastName,
        country: safeCountry,
        city: safeCity,
        consultationCharge: String(consultationCharge || '').trim(),
        hospitalCharge: String(hospitalCharge || '').trim(),
        currency: currency,
        name: `${safeFirstName} ${safeLastName}`
      }
      
      // Update in auth service
      await authService.updateDoctor(updatedUser)
      notifySuccess('Profile updated successfully!')
      dispatch('profile-updated', updatedUser)
      
    } catch (err) {
      error = err.message
      notifyError(error)
    } finally {
      loading = false
    }
  }
  
  // Handle cancel
  const handleCancel = () => {
    dispatch('profile-cancelled')
  }
  
  // Handle tab switching
  const switchTab = (tabName) => {
    activeTab = tabName
  }
  
  // Handle template type selection
  const selectTemplateType = (type) => {
    templateType = type
    uploadedHeader = null
    
    // Only clear templatePreview if not switching to system
    if (type !== 'system') {
      templatePreview = null
    } else {
      // Initialize system template preview
      generateSystemHeader()
    }
  }
  
  // Handle header image upload
  const handleHeaderUpload = (event) => {
    const file = event.target.files[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (e) => {
        uploadedHeader = e.target.result
      }
      reader.readAsDataURL(file)
    }
  }
  
  // Generate system header preview
  const generateSystemHeader = () => {
    templatePreview = {
      type: 'system',
      doctorName: user?.name || 'Dr. [Your Name]',
      practiceName: `${user?.firstName || ''} ${user?.lastName || ''} Medical Practice`,
      address: `${user?.city || 'City'}, ${user?.country || 'Country'}`,
      phone: '+1 (555) 123-4567',
      email: user?.email || 'doctor@example.com'
    }
  }
  
  // Save template settings
  const saveTemplateSettings = async () => {
    try {
      console.log('🔍 Saving template settings...')
      
      const doctorId = await resolveDoctorId()
      if (!doctorId) {
        notifyError('Doctor profile not found. Please try again.')
        return
      }

      const templateSettings = {
        doctorId: doctorId,
        templateType: templateType,
        headerSize: headerSize,
        templatePreview: templatePreview,
        uploadedHeader: uploadedHeader,
        procedurePricing: normalizeProcedurePricingForSave(procedurePricing),
        updatedAt: new Date().toISOString()
      }

      await firebaseStorage.saveDoctorTemplateSettings(doctorId, templateSettings)

      if (user) {
        user.templateSettings = templateSettings
        dispatch('profile-updated', { doctor: user })
      }

      notifySuccess('Template settings saved successfully!')
      
    } catch (error) {
      console.error('❌ Error saving template settings:', error)
      notifyError('Failed to save template settings')
    }
  }

  const downloadJsonFile = (data, filename) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  }

  const resolveDoctorId = async () => {
    const resolvedEmail = user?.email
    if (!resolvedEmail) {
      return user?.id || user?.uid || null
    }

    try {
      const doctor = await firebaseStorage.getDoctorByEmail(resolvedEmail)
      return doctor?.id || user?.id || user?.uid || resolvedEmail
    } catch (error) {
      console.warn('⚠️ Failed to resolve doctor ID for backup:', error)
      return user?.id || user?.uid || resolvedEmail
    }
  }

  const handleDoctorBackupDownload = async () => {
    try {
      backupLoading = true
      backupError = ''
      backupSuccess = ''

      const doctorId = await resolveDoctorId()
      if (!doctorId) {
        throw new Error('Doctor ID is not available for backup')
      }

      const backup = await backupService.exportDoctorBackup(doctorId)
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      downloadJsonFile(backup, `doctor-backup-${doctorId}-${timestamp}.json`)

      backupSuccess = 'Backup downloaded successfully.'
    } catch (error) {
      backupError = error.message || 'Failed to create backup.'
    } finally {
      backupLoading = false
    }
  }

  const handleDoctorRestoreFile = (event) => {
    restoreFile = event.target.files?.[0] || null
    restoreError = ''
    restoreSuccess = ''
    restoreSummary = null
  }

  const handleDoctorRestore = async () => {
    if (!restoreFile) {
      restoreError = 'Please select a backup file to restore.'
      return
    }

    if (!confirm('Restore backup? This will merge backup data and may overwrite records with the same IDs.')) {
      return
    }

    try {
      restoreLoading = true
      restoreError = ''
      restoreSuccess = ''
      restoreSummary = null

      const doctorId = await resolveDoctorId()
      if (!doctorId) {
        throw new Error('Doctor ID is not available for restore')
      }

      const fileText = await restoreFile.text()
      const backup = JSON.parse(fileText)
      if (backup.type !== 'doctor') {
        throw new Error('Selected backup file is not a doctor backup.')
      }

      const summary = await backupService.restoreDoctorBackup(doctorId, backup)
      restoreSummary = summary
      restoreSuccess = 'Backup restored successfully.'
    } catch (error) {
      restoreError = error.message || 'Failed to restore backup.'
    } finally {
      restoreLoading = false
    }
  }
</script>

<!-- Edit Profile Modal -->
<div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" tabindex="-1">
  <div class="w-full max-w-4xl">
    <div class="bg-white rounded-lg shadow-lg">
      <div class="bg-teal-600 text-white px-4 py-3 rounded-t-lg">
        <div class="flex justify-between items-center">
          <h6 class="text-lg font-semibold">
            <i class="fas fa-cog mr-2 fa-sm"></i>
            Settings
          </h6>
          <div class="flex gap-2">
          <button type="button" class="px-3 py-1 text-sm border border-gray-300 rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-4 focus:ring-gray-300 focus:ring-offset-2 dark:bg-white dark:text-gray-700 dark:border-gray-300 dark:hover:bg-gray-50 transition-all duration-200" on:click={initializeForm} title="Reload current values">
            <i class="fas fa-sync-alt fa-sm"></i>
          </button>
          <button type="button" class="text-white hover:text-gray-200 focus:outline-none focus:ring-4 focus:ring-white focus:ring-offset-2 rounded-lg p-1 transition-all duration-200" on:click={handleCancel}>
            <i class="fas fa-times"></i>
          </button>
          </div>
        </div>
      </div>
      
      <!-- Clean Tab Navigation -->
      <div class="mb-6">
        <div class="flex border-b border-gray-300">
          <div class="flex-1">
            <button 
              class="w-full py-4 px-6 text-center font-medium text-sm {activeTab === 'edit-profile' ? 'text-teal-600 border-b-2 border-teal-600' : 'text-gray-500 hover:text-gray-700'}" 
              on:click={() => switchTab('edit-profile')}
            >
              <i class="fas fa-user-edit mr-2"></i>
              Edit Profile
            </button>
          </div>
          <div class="flex-1">
            <button 
              class="w-full py-4 px-6 text-center font-medium text-sm {activeTab === 'prescription-template' ? 'text-teal-600 border-b-2 border-teal-600' : 'text-gray-500 hover:text-gray-700'}" 
              on:click={() => switchTab('prescription-template')}
            >
              <i class="fas fa-file-medical mr-2"></i>
              Prescription Template
            </button>
          </div>
          <div class="flex-1">
            <button 
              class="w-full py-4 px-6 text-center font-medium text-sm {activeTab === 'procedures' ? 'text-teal-600 border-b-2 border-teal-600' : 'text-gray-500 hover:text-gray-700'}" 
              on:click={() => switchTab('procedures')}
            >
              <i class="fas fa-list-check mr-2"></i>
              Procedures
            </button>
          </div>
          <div class="flex-1">
            <button 
              class="w-full py-4 px-6 text-center font-medium text-sm {activeTab === 'backup-restore' ? 'text-teal-600 border-b-2 border-teal-600' : 'text-gray-500 hover:text-gray-700'}" 
              on:click={() => switchTab('backup-restore')}
            >
              <i class="fas fa-database mr-2"></i>
              Backup
            </button>
          </div>
        </div>
      </div>
      
      <!-- Tab Content -->
      <div id="default-styled-tab-content">
          <!-- Edit Profile Tab -->
          {#if activeTab === 'edit-profile'}
          <div class="p-6 bg-white" id="edit-profile" role="tabpanel" aria-labelledby="edit-profile-tab">
            <form id="edit-profile-form" on:submit={handleSubmit}>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
            <div>
              <label for="editFirstName" class="block text-sm font-medium text-gray-700 mb-1">
                First Name <span class="text-red-600">*</span>
              </label>
              <input 
                type="text" 
                class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500" 
                id="editFirstName" 
                bind:value={firstName}
                placeholder="Enter your first name"
                required
                disabled={loading}
              >
            </div>
            <div>
              <label for="editLastName" class="block text-sm font-medium text-gray-700 mb-1">
                Last Name <span class="text-red-600">*</span>
              </label>
              <input 
                type="text" 
                class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500" 
                id="editLastName" 
                bind:value={lastName}
                placeholder="Enter your last name"
                required
                disabled={loading}
              >
            </div>
          </div>
          
          <div class="mb-3">
            <label for="editEmail" class="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
            <input 
              type="email" 
              class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
              id="editEmail" 
              value={email}
              disabled
              readonly
            >
            <div class="text-sm text-gray-500 mt-1">
              <i class="fas fa-info-circle mr-1"></i>
              Email cannot be changed for security reasons
            </div>
          </div>
          
          <div class="mb-3">
            <label for="editCountry" class="block text-sm font-medium text-gray-700 mb-1">
              Country <span class="text-red-600">*</span>
            </label>
            <select 
              class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
              id="editCountry" 
              bind:value={country}
              required
              disabled={loading}
            >
              <option value="">Select your country</option>
              {#each countries as countryOption}
                <option value={countryOption.name}>{countryOption.name}</option>
              {/each}
            </select>
          </div>
          
          <div class="mb-3">
            <label for="editCity" class="block text-sm font-medium text-gray-700 mb-1">
              City <span class="text-red-600">*</span>
            </label>
            <select 
              class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
              id="editCity" 
              bind:value={city}
              required
              disabled={loading || !country}
            >
              <option value="">Select your city</option>
              {#each availableCities as cityOption}
                <option value={cityOption.name}>{cityOption.name}</option>
              {/each}
            </select>
            {#if country && availableCities.length === 0}
              <div class="text-sm text-gray-500 mt-1 text-yellow-600">
                <i class="fas fa-exclamation-triangle mr-1"></i>
                No cities available for the selected country. Please contact support.
              </div>
            {/if}
          </div>
          
          <!-- Currency Selection -->
          <div class="mb-3">
            <label for="editCurrency" class="block text-sm font-medium text-gray-700 mb-1">
              Currency <span class="text-red-600">*</span>
            </label>
            <select 
              class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
              id="editCurrency" 
              bind:value={currency}
              required
              disabled={loading}
            >
              {#each currencies as currencyOption}
                <option value={currencyOption.code}>{currencyOption.symbol} {currencyOption.name} ({currencyOption.code})</option>
              {/each}
            </select>
          </div>
          
          <!-- Charges Section -->
          <div class="mb-3">
            <h6 class="text-sm font-semibold text-gray-700 mb-3">
              <i class="fas fa-dollar-sign mr-2"></i>
              Consultation & Hospital Charges
            </h6>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label for="editConsultationCharge" class="block text-sm font-medium text-gray-700 mb-1">
                  Consultation Charge
                </label>
                <div class="relative">
                  <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span class="text-gray-500 text-sm">{currencies.find(c => c.code === currency)?.symbol || '$'}</span>
                  </div>
                    <input 
                      type="text" 
                      class="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500" 
                      id="editConsultationCharge" 
                      bind:value={consultationCharge}
                      placeholder="0.00"
                      pattern="[0-9]*\.?[0-9]*"
                      disabled={loading}
                    />
                </div>
                <div class="text-xs text-gray-500 mt-1">
                  <i class="fas fa-info-circle mr-1"></i>
                  Your standard consultation fee
                </div>
              </div>
              <div>
                <label for="editHospitalCharge" class="block text-sm font-medium text-gray-700 mb-1">
                  Hospital Charge
                </label>
                <div class="relative">
                  <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span class="text-gray-500 text-sm">{currencies.find(c => c.code === currency)?.symbol || '$'}</span>
                  </div>
                    <input 
                      type="text" 
                      class="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500" 
                      id="editHospitalCharge" 
                      bind:value={hospitalCharge}
                      placeholder="0.00"
                      pattern="[0-9]*\.?[0-9]*"
                      disabled={loading}
                    />
                </div>
                <div class="text-xs text-gray-500 mt-1">
                  <i class="fas fa-info-circle mr-1"></i>
                  Hospital visit or admission fee
                </div>
              </div>
            </div>
          </div>
          
          {#if error}
            <div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-3" role="alert">
              <i class="fas fa-exclamation-triangle mr-2"></i>{error}
            </div>
          {/if}
            </form>
          </div>
          {/if}
          
          <!-- Prescription Template Tab -->
          {#if activeTab === 'prescription-template'}
          <div class="p-6 bg-white" id="prescription-template" role="tabpanel" aria-labelledby="prescription-template-tab">
            <div class="mb-4">
              <h6 class="fw-bold mb-3">
                <i class="fas fa-file-medical mr-2"></i>
                Prescription Template Settings
              </h6>
              <p class="text-gray-600 dark:text-gray-300 small mb-4">Choose how you want your prescription header to appear on printed prescriptions.</p>
            </div>
            
            <!-- Template Type Selection -->
            <div class="row mb-4">
              <div class="col-span-full">
                <label class="block text-sm font-semibold text-gray-700 mb-3">Select Template Type:</label>
                
                <!-- Option 1: Printed Letterheads -->
                {#if templateType !== 'upload'}
                <div class="bg-white border-2 rounded-lg shadow-sm mb-4 {templateType === 'printed' ? 'border-teal-500' : 'border-gray-200'}" style="border-color: {templateType === 'printed' ? '#36807a' : '#e5e7eb'};">
                  <div class="p-4">
                    <div class="flex items-center">
                      <input 
                        class="w-4 h-4 text-teal-600 bg-gray-100 border-gray-300 rounded focus:ring-teal-500 focus:ring-2 mr-3" 
                        type="radio" 
                        name="templateType" 
                        id="templatePrinted" 
                        value="printed"
                        bind:group={templateType}
                        on:change={() => selectTemplateType('printed')}
                      />
                      <label class="w-full cursor-pointer" for="templatePrinted">
                        <div class="flex items-center">
                          <div class="flex-shrink-0 mr-3">
                            <i class="fas fa-print text-2xl text-teal-600"></i>
                          </div>
                          <div class="flex-1">
                            <h6 class="text-sm font-semibold text-gray-900 mb-1">I have printed A3 letterheads</h6>
                            <p class="text-gray-500 text-sm mb-0">Use your existing printed letterhead paper for prescriptions. No header will be added to the PDF.</p>
                          </div>
                        </div>
                      </label>
                    </div>
                    
                    {#if templateType === 'printed'}
                    <div class="mt-4">
                      <label class="block text-sm font-medium text-gray-700 mb-2">Header Size Adjustment:</label>
                      <div class="flex items-center">
                        <div class="flex-1 mr-4">
                          <input 
                            type="range" 
                            class="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer" 
                            min="50" 
                            max="300" 
                            step="10"
                            bind:value={headerSize}
                          />
                        </div>
                        <div class="flex-shrink-0">
                          <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-teal-100 text-teal-800">{headerSize}px</span>
                        </div>
                      </div>
                      <div class="text-sm text-gray-500 mt-2">
                        <i class="fas fa-info-circle mr-1"></i>
                        Adjust the header space to match your printed letterhead height.
                      </div>
                    </div>
                    {/if}
                  </div>
                </div>
                {/if}
                
                <!-- Option 2: Upload Image -->
                <div class="bg-white border-2 rounded-lg shadow-sm mb-4 {templateType === 'upload' ? 'border-teal-500' : 'border-gray-200'}" style="border-color: {templateType === 'upload' ? '#36807a' : '#e5e7eb'};">
                  <div class="p-4">
                    <div class="flex items-center">
                      <input 
                        class="w-4 h-4 text-teal-600 bg-gray-100 border-gray-300 rounded focus:ring-teal-500 focus:ring-2 mr-3" 
                        type="radio" 
                        name="templateType" 
                        id="templateUpload" 
                        value="upload"
                        bind:group={templateType}
                        on:change={() => selectTemplateType('upload')}
                      />
                      <label class="w-full cursor-pointer" for="templateUpload">
                        <div class="flex items-center">
                          <div class="flex-shrink-0 mr-3">
                            <i class="fas fa-image text-2xl text-teal-600"></i>
                          </div>
                          <div class="flex-1">
                            <h6 class="text-sm font-semibold text-gray-900 mb-1">I want to upload an image for header</h6>
                            <p class="text-gray-500 text-sm mb-0">Upload your custom header image to be used on all prescriptions.</p>
                          </div>
                        </div>
                      </label>
                    </div>
                    
                    {#if templateType === 'upload'}
                    <div class="mt-3">
                      <input 
                        type="file" 
                        class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500" 
                        accept="image/*"
                        on:change={handleHeaderUpload}
                      />
                      <div class="text-sm text-gray-500">
                        <i class="fas fa-info-circle mr-1"></i>
                        Supported formats: JPG, PNG, GIF. Recommended size: 800x200 pixels.
                      </div>
                    </div>
                    {/if}
                  </div>
                </div>
                
                <!-- Option 3: System Header -->
                <div class="bg-white border-2 rounded-lg shadow-sm mb-4 {templateType === 'system' ? 'border-teal-500' : 'border-gray-200'}" style="border-color: {templateType === 'system' ? '#36807a' : '#e5e7eb'};">
                  <div class="p-4">
                    <div class="flex items-center">
                      <input 
                        class="w-4 h-4 text-teal-600 bg-gray-100 border-gray-300 rounded focus:ring-teal-500 focus:ring-2 mr-3" 
                        type="radio" 
                        name="templateType" 
                        id="templateSystem" 
                        value="system"
                        bind:group={templateType}
                        on:change={() => selectTemplateType('system')}
                      />
                      <label class="w-full cursor-pointer" for="templateSystem">
                        <div class="flex items-center">
                          <div class="flex-shrink-0 mr-3">
                            <i class="fas fa-cog text-2xl text-teal-600"></i>
                          </div>
                          <div class="flex-1">
                            <h6 class="text-sm font-semibold text-gray-900 mb-1">I want system to add header for template</h6>
                            <p class="text-gray-500 text-sm mb-0">Use a system-generated header with your practice information.</p>
                          </div>
                        </div>
                      </label>
                    </div>
                    
                    {#if templateType === 'system'}
                    <div class="mt-3">
                      <button 
                        type="button" 
                        class="inline-flex items-center px-3 py-2 border border-teal-300 text-teal-700 bg-white hover:bg-teal-50 text-sm font-medium rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 transition-colors duration-200"
                        on:click={generateSystemHeader}
                      >
                        <i class="fas fa-eye mr-2"></i>
                        Preview System Header
              </button>
                      
                      {#if templatePreview && templatePreview.type === 'system'}
                      <div class="mt-4">
                        <label class="block text-sm font-medium text-gray-700 mb-2">System Header Preview:</label>
                        <div class="border rounded p-3 bg-gray-50">
                          <div class="text-center">
                            <h5 class="fw-bold mb-1">{templatePreview.doctorName}</h5>
                            <p class="mb-1 fw-semibold">{templatePreview.practiceName}</p>
                            <p class="mb-1 small">{templatePreview.address}</p>
                            <p class="mb-1 small">Tel: {templatePreview.phone} | Email: {templatePreview.email}</p>
                            <hr class="my-2">
                            <p class="mb-0 fw-bold">PRESCRIPTION</p>
                          </div>
                        </div>
                      </div>
                      {/if}
                    </div>
                    {/if}
                  </div>
                </div>
              </div>
            </div>
            
            <!-- Template settings will be saved via modal footer -->
          </div>
          {/if}
          
          {#if activeTab === 'procedures'}
          <div class="p-6 bg-white" id="procedures" role="tabpanel" aria-labelledby="procedures-tab">
            <h6 class="text-sm font-semibold text-gray-800 mb-2">Procedures Pricing</h6>
            <p class="text-xs text-gray-500 mb-4">
              Set default prices for procedures. These prices are used in pharmacy billing.
            </p>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
              {#each procedurePricing as item}
                <div class="flex items-center justify-between gap-3 bg-gray-50 border border-gray-200 rounded-lg p-3">
                  <div class="text-sm font-medium text-gray-700">{item.name}</div>
                  <div class="flex items-center gap-2">
                    <span class="text-xs text-gray-500">{currency}</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      class="w-28 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                      bind:value={item.price}
                      placeholder="0.00"
                    >
                  </div>
                </div>
              {/each}
            </div>
          </div>
          {/if}

          {#if activeTab === 'backup-restore'}
          <div class="p-6 bg-white" id="backup-restore" role="tabpanel" aria-labelledby="backup-restore-tab">
            <div class="mb-4">
              <h6 class="fw-bold mb-2">
                <i class="fas fa-database mr-2"></i>
                Backup & Restore
              </h6>
              <p class="text-gray-600 dark:text-gray-300 small">
                Download a backup of your patients and prescriptions, then restore it if data is deleted.
              </p>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div class="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <h6 class="text-sm font-semibold text-gray-800 mb-2">Create Backup</h6>
                <p class="text-xs text-gray-500 mb-3">
                  Exports patients, prescriptions, symptoms, and long-term medications.
                </p>
                <button
                  type="button"
                  class="inline-flex items-center px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 transition-colors duration-200 disabled:bg-gray-400 disabled:cursor-not-allowed"
                  on:click={handleDoctorBackupDownload}
                  disabled={backupLoading}
                >
                  <i class="fas fa-download mr-2"></i>
                  {backupLoading ? 'Preparing...' : 'Download Backup'}
                </button>
                {#if backupError}
                  <div class="mt-3 text-xs text-red-600">{backupError}</div>
                {/if}
                {#if backupSuccess}
                  <div class="mt-3 text-xs text-green-600">{backupSuccess}</div>
                {/if}
              </div>

              <div class="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <h6 class="text-sm font-semibold text-gray-800 mb-2">Restore Backup</h6>
                <p class="text-xs text-gray-500 mb-3">
                  Upload a backup file to restore missing data. Existing records with the same IDs will be updated.
                </p>
                <input
                  type="file"
                  accept="application/json"
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                  on:change={handleDoctorRestoreFile}
                />
                <button
                  type="button"
                  class="mt-3 inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors duration-200 disabled:bg-gray-400 disabled:cursor-not-allowed"
                  on:click={handleDoctorRestore}
                  disabled={restoreLoading || !restoreFile}
                >
                  <i class="fas fa-upload mr-2"></i>
                  {restoreLoading ? 'Restoring...' : 'Restore Backup'}
                </button>
                {#if restoreError}
                  <div class="mt-3 text-xs text-red-600">{restoreError}</div>
                {/if}
                {#if restoreSuccess}
                  <div class="mt-3 text-xs text-green-600">{restoreSuccess}</div>
                {/if}
                {#if restoreSummary}
                  <div class="mt-3 text-xs text-gray-600">
                    Restored: {restoreSummary.patients} patients, {restoreSummary.prescriptions} prescriptions, {restoreSummary.symptoms} symptoms, {restoreSummary.reports || 0} reports.
                  </div>
                {/if}
              </div>
            </div>
          </div>
          {/if}
      </div>
        
      <!-- Modal Footer -->
      <div class="bg-gray-50 px-4 py-3 rounded-b-lg flex justify-end gap-3">
        <button type="button" class="px-4 py-2 text-sm bg-gray-600 hover:bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-4 focus:ring-gray-300 dark:bg-gray-600 dark:hover:bg-gray-700 dark:focus:ring-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200" on:click={handleCancel} disabled={loading}>
          <i class="fas fa-times mr-1 fa-sm"></i>
          Cancel
        </button>
        {#if activeTab === 'edit-profile'}
          <button 
            type="submit" 
            form="edit-profile-form"
            class="px-4 py-2 text-sm bg-red-600 hover:bg-red-700 text-white rounded-lg flex items-center"
            disabled={loading}
          >
          {#if loading}
            <ThreeDots size="small" color="white" />
          {/if}
          <i class="fas fa-save mr-1 fa-sm"></i>
          Save Changes
        </button>
        {:else if activeTab === 'prescription-template'}
          <button 
            type="button" 
            class="px-4 py-2 text-sm bg-teal-600 hover:bg-teal-700 text-white rounded-lg flex items-center"
            on:click={saveTemplateSettings}
            disabled={!templateType}
          >
            <i class="fas fa-save mr-1 fa-sm"></i>
            Save Template Settings
          </button>
        {:else if activeTab === 'procedures'}
          <button 
            type="button" 
            class="px-4 py-2 text-sm bg-teal-600 hover:bg-teal-700 text-white rounded-lg flex items-center"
            on:click={saveTemplateSettings}
          >
            <i class="fas fa-save mr-1 fa-sm"></i>
            Save Procedure Prices
          </button>
        {/if}
      </div>
    </div>
  </div>
</div>

<!-- No custom CSS - using pure Tailwind -->
