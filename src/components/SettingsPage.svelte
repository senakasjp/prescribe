<!-- Settings Page - Full page settings interface -->
<script>
  console.log('📄 SettingsPage script loaded')
  
  import { createEventDispatcher, onMount } from 'svelte'
  import authService from '../services/authService.js'
  import { countries } from '../data/countries.js'
  import { cities, getCitiesByCountry } from '../data/cities.js'
  import ThreeDots from './ThreeDots.svelte'
  import { notifySuccess, notifyError } from '../stores/notifications.js'
  import HeaderEditor from './HeaderEditor.svelte'

  const dispatch = createEventDispatcher()
  export let user

  // Profile form data
  let firstName = ''
  let lastName = ''
  let country = ''
  let city = ''
  let consultationCharge = ''
  let hospitalCharge = ''
  let currency = 'USD' // New state variable
  let loading = false
  let error = ''

  // Prescription template variables
  let templateType = 'printed' // 'printed', 'upload', 'system'
  let uploadedHeader = null
  let templatePreview = null
  let headerSize = 300 // Default header size in pixels
  let headerText = ''
  let previewElement = null

  // Tab management
  let activeTab = 'edit-profile'
  
  // Available cities based on selected country
  let availableCities = []

  // Debug: Log initial state
  onMount(() => {
    console.log('🚀 SettingsPage onMount called')
    console.log('🚀 Initial templateType:', templateType)
    console.log('🚀 Initial templatePreview:', templatePreview)
    console.log('🚀 Initial headerText:', headerText)
    console.log('🚀 User object:', user)
    console.log('🚀 Active tab:', activeTab)
  })

  // Add debugging to template type reactive statement
  $: {
    console.log('🔄 templateType changed to:', templateType)
    console.log('🔄 templatePreview is:', templatePreview)
  }

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

  // Reactive variable for cities based on selected country
  $: {
    try {
      availableCities = (country && typeof country === 'string' && country.trim()) ? getCitiesByCountry(country.trim()) : []
    } catch (error) {
      console.error('❌ SettingsPage: Error in availableCities reactive statement:', error)
      availableCities = []
    }
  }

  // Reset city when country changes
  $: {
    try {
      if (country && city && !availableCities.find(c => c.name === city)) {
    city = ''
      }
    } catch (error) {
      console.error('❌ SettingsPage: Error in city reset reactive statement:', error)
    }
  }

  // Initialize form with user data
  const initializeForm = () => {
    firstName = user?.firstName || ''
    lastName = user?.lastName || ''
    country = user?.country || ''
    city = user?.city || ''
    consultationCharge = String(user?.consultationCharge || '')
    hospitalCharge = String(user?.hospitalCharge || '')
    currency = user?.currency || 'USD'
    
    // Load template settings
    if (user?.templateSettings) {
      console.log('🔍 Loading template settings from user:', user.templateSettings)
      templateType = user.templateSettings.templateType || 'printed'
      headerSize = user.templateSettings.headerSize || 300
      headerText = user.templateSettings.headerText || ''
      templatePreview = user.templateSettings.templatePreview || null
      uploadedHeader = user.templateSettings.uploadedHeader || null
      console.log('🔍 Applied template settings - templateType:', templateType)
    } else {
      console.log('🔍 No template settings found, using defaults')
      console.log('🔍 User object keys:', Object.keys(user || {}))
      console.log('🔍 User.templateSettings:', user?.templateSettings)
    }
  }

  // Initialize form when user changes
  $: if (user) {
    try {
      console.log('🔍 Debug - SettingsPage: User changed, initializing form:', user)
      console.log('🔍 Current templateType:', templateType)
      console.log('🔍 Current templatePreview:', templatePreview)
      console.log('🔍 Current headerText:', headerText)
      initializeForm()
    } catch (error) {
      console.error('❌ SettingsPage: Error initializing form:', error)
      // Set default values to prevent errors
      firstName = ''
      lastName = ''
      email = ''
      country = ''
      city = ''
      consultationCharge = ''
      hospitalCharge = ''
      currency = 'USD'
    }
  }

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault()
    
    error = ''
    loading = true
    
    try {
      // Validate required fields
      if (!firstName.trim() || !lastName.trim()) {
        throw new Error('First name and last name are required')
      }
      
      if (!country.trim()) {
        throw new Error('Country is required')
      }
      
      if (!city.trim()) {
        throw new Error('City is required')
      }
      
      // Update user data
      const updatedUser = {
        ...user,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        country: country.trim(),
        city: city.trim(),
        consultationCharge: String(consultationCharge || '').trim(),
        hospitalCharge: String(hospitalCharge || '').trim(),
        currency: currency,
        name: `${firstName.trim()} ${lastName.trim()}`
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

  // Handle tab switching
  const switchTab = (tabName) => {
    activeTab = tabName
  }

  // Handle template type selection
  const selectTemplateType = async (type) => {
    console.log('🚀🚀🚀 NEW DEBUG VERSION LOADED! 🚀🚀🚀')
    console.log('🔧 selectTemplateType called with:', type)
    console.log('🔧 Current templateType before change:', templateType)
    console.log('🔧 Current templatePreview before change:', templatePreview)
    
    templateType = type
    uploadedHeader = null
    
    console.log('🔧 templateType after change:', templateType)
    
    // Only clear templatePreview if not switching to system
    if (type !== 'system') {
      console.log('🔧 Clearing templatePreview for non-system type')
      templatePreview = null
    } else {
      console.log('🔧 Initializing system template preview')
      // Initialize system template preview
      generateSystemHeader()
      console.log('🔧 templatePreview after generateSystemHeader:', templatePreview)
    }
    
    console.log('🔧 Final state - templateType:', templateType, 'templatePreview:', templatePreview)
    
    // Auto-save template settings when selecting system type
    if (type === 'system') {
      console.log('🔧 Auto-saving template settings for system type')
      try {
        await saveTemplateSettings()
      } catch (error) {
        console.error('❌ Error auto-saving template settings:', error)
      }
    }
  }

  // Handle third option click specifically
  const handleThirdOptionClick = () => {
    console.log('🔥 CLICK DETECTED ON THIRD OPTION!')
    selectTemplateType('system')
  }

  // Removed temporary click test

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
    console.log('🏥 generateSystemHeader called')
    console.log('🏥 Current user:', user)
    
    templatePreview = {
      type: 'system',
      doctorName: user?.name || 'Dr. [Your Name]',
      practiceName: `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || 'Medical Practice',
      address: `${user?.city || 'City'}, ${user?.country || 'Country'}`,
      phone: '+1 (555) 123-4567',
      email: user?.email || 'doctor@example.com',
      formattedHeader: '',
      logo: null
    }
    
    console.log('🏥 templatePreview created:', templatePreview)
    
    // Load saved header content if available
    const savedHeader = localStorage.getItem('prescriptionHeader')
    console.log('🏥 savedHeader from localStorage:', savedHeader)
    
    if (savedHeader) {
      headerText = savedHeader
      templatePreview.formattedHeader = savedHeader
      console.log('🏥 Using saved header content')
    } else {
      // Initialize with default content
      console.log('🏥 Using default header content')
      updateHeaderText()
    }
    
    console.log('🏥 Final templatePreview:', templatePreview)
    console.log('🏥 Final headerText:', headerText)
  }
  
  // Update header text from template preview
  const updateHeaderText = () => {
    if (templatePreview) {
      // If there's saved formatted content, use it; otherwise use default
      if (templatePreview.formattedHeader) {
        headerText = templatePreview.formattedHeader
      } else {
        headerText = `<h5 style="font-weight: bold; margin: 10px 0; text-align: center;">${templatePreview.doctorName}</h5>
<p style="font-weight: 600; margin: 5px 0; text-align: center;">${templatePreview.practiceName}</p>
<p style="font-size: 0.875rem; margin: 5px 0; text-align: center;">${templatePreview.address}</p>
<p style="font-size: 0.875rem; margin: 5px 0; text-align: center;">Tel: ${templatePreview.phone} | Email: ${templatePreview.email}</p>
<hr style="margin: 10px 0; border: 1px solid #ccc;">
<p style="font-weight: bold; margin: 5px 0; text-align: center;">PRESCRIPTION</p>`
      }
    }
  }
  
  // Legacy functions removed - now using TinyMCE component
  
  // TinyMCE Editor handlers
  const handleHeaderContentChange = (content) => {
    headerText = content
    if (templatePreview) {
      templatePreview.formattedHeader = content
      // Trigger reactive update
      templatePreview = { ...templatePreview }
    }
  }
  
  const handleHeaderSave = (content) => {
    headerText = content
    if (templatePreview) {
      templatePreview.formattedHeader = content
      // Save to localStorage or database if needed
      localStorage.setItem('prescriptionHeader', content)
      // Trigger reactive update
      templatePreview = { ...templatePreview }
    }
  }

  // Generate prescription preview
  const generatePrescriptionPreview = () => {
    if (templateType === 'printed') {
      templatePreview = {
        type: 'printed',
        headerSpace: headerSize,
        doctorName: user?.name || 'Dr. [Your Name]',
        practiceName: `${user?.firstName || ''} ${user?.lastName || ''} Medical Practice`,
        address: `${user?.city || 'City'}, ${user?.country || 'Country'}`,
        phone: '+1 (555) 123-4567',
        email: user?.email || 'doctor@example.com'
      }
    } else if (templateType === 'upload' && uploadedHeader) {
      templatePreview = {
        type: 'upload',
        headerImage: uploadedHeader,
        doctorName: user?.name || 'Dr. [Your Name]',
        practiceName: `${user?.firstName || ''} ${user?.lastName || ''} Medical Practice`,
        address: `${user?.city || 'City'}, ${user?.country || 'Country'}`,
        phone: '+1 (555) 123-4567',
        email: user?.email || 'doctor@example.com'
      }
    } else if (templateType === 'system') {
      generateSystemHeader()
    }
  }

  // Watch for template changes to auto-generate preview
  $: if (templateType) {
    generatePrescriptionPreview()
  }

  // Save template settings
  const saveTemplateSettings = async () => {
    try {
      console.log('🔍 Saving template settings...')
      console.log('🔍 Current templateType:', templateType)
      console.log('🔍 Current templatePreview:', templatePreview)
      console.log('🔍 Current headerText:', headerText)
      console.log('🔍 Current headerSize:', headerSize)
      console.log('🔍 Current uploadedHeader:', uploadedHeader)
      
      if (!user?.id) {
        console.error('❌ No user ID available')
        console.error('❌ User object:', user)
        notifyError('User not authenticated')
        return
      }
      
      console.log('🔍 User ID found:', user.id)
      
      // Prepare template settings object
      const templateSettings = {
        templateType: templateType,
        headerSize: headerSize,
        headerText: headerText,
        templatePreview: templatePreview,
        uploadedHeader: uploadedHeader
      }
      
      console.log('🔍 Template settings to save:', templateSettings)
      
      // Import firebaseStorage service (default export)
      console.log('🔍 Importing firebaseStorage service (default export)...')
      const firebaseModule = await import('../services/firebaseStorage.js')
      const firebaseStorage = firebaseModule.default
      console.log('🔍 firebaseStorage service imported:', !!firebaseStorage)
      
      // Persist via dedicated API that handles serialization
      console.log('🔍 Calling firebaseStorage.saveDoctorTemplateSettings...')
      const result = await firebaseStorage.saveDoctorTemplateSettings(user.id, templateSettings)
      
      console.log('🔍 Update result:', result)
      console.log('✅ Template settings saved successfully!')
      notifySuccess('Template settings saved successfully!')
      
    } catch (error) {
      console.error('❌ Error saving template settings:', error)
      console.error('❌ Error details:', {
        message: error.message,
        stack: error.stack,
        user: user,
        templateSettings: templateSettings
      })
      notifyError(`Failed to save template settings: ${error.message}`)
    }
  }

  // Handle back to main app
  const handleBack = () => {
    dispatch('back-to-app')
  }
</script>

<!-- Settings Page -->
<div class="min-h-screen bg-gray-50">
  <!-- Header -->
  <div class="bg-white shadow-sm border-b border-gray-200">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex items-center justify-between h-16">
        <div class="flex items-center">
          <button 
            type="button"
            class="mr-4 p-2 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors duration-200"
            on:click={handleBack}
          >
            <i class="fas fa-arrow-left text-lg"></i>
          </button>
          <div class="flex items-center">
            <i class="fas fa-cog text-teal-600 text-xl mr-3"></i>
            <h1 class="text-xl font-semibold text-gray-900">Settings</h1>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Main Content -->
  <div class="max-w-6xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
    <div class="bg-white rounded-lg shadow-sm border border-gray-200">
      <!-- Tab Navigation -->
      <div class="border-b border-gray-200">
        <nav class="flex space-x-8 px-6" aria-label="Tabs">
          <button 
            class="py-4 px-1 border-b-2 font-medium text-sm {activeTab === 'edit-profile' ? 'border-teal-500 text-teal-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}"
            on:click={() => switchTab('edit-profile')}
          >
            <i class="fas fa-user-edit mr-2"></i>
            Edit Profile
          </button>
          <button 
            class="py-4 px-1 border-b-2 font-medium text-sm {activeTab === 'prescription-template' ? 'border-teal-500 text-teal-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}"
            on:click={() => switchTab('prescription-template')}
          >
            <i class="fas fa-file-medical mr-2"></i>
            Prescription Template
          </button>
        </nav>
      </div>

      <!-- Tab Content -->
      <div class="p-6">
        <!-- Edit Profile Tab -->
        {#if activeTab === 'edit-profile'}
        <div>
          <h2 class="text-lg font-semibold text-gray-900 mb-6">Edit Profile</h2>
          
          {#if error}
          <div class="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div class="flex">
              <i class="fas fa-exclamation-circle text-red-400 mr-2 mt-0.5"></i>
              <p class="text-sm text-red-700">{error}</p>
            </div>
          </div>
          {/if}

          <form id="edit-profile-form" on:submit={handleSubmit}>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label for="firstName" class="block text-sm font-medium text-gray-700 mb-2">First Name *</label>
                <input 
                  type="text" 
                  id="firstName"
                    value={firstName}
                    on:input={(e) => firstName = e.target.value}
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                  required
                />
              </div>
              
              <div>
                <label for="lastName" class="block text-sm font-medium text-gray-700 mb-2">Last Name *</label>
                <input 
                  type="text" 
                  id="lastName"
                  value={lastName}
                  on:input={(e) => lastName = e.target.value}
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                  required
                />
              </div>
              
              <div>
                <label for="country" class="block text-sm font-medium text-gray-700 mb-2">Country *</label>
                <select 
                  id="country"
                  value={country}
                  on:change={(e) => country = e.target.value}
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                  required
                >
                  <option value="">Select Country</option>
                  {#each countries as countryOption}
                    <option value={countryOption.name}>{countryOption.name}</option>
                  {/each}
                </select>
              </div>
              
              <div>
                <label for="city" class="block text-sm font-medium text-gray-700 mb-2">City *</label>
                <select 
                  id="city"
                  value={city}
                  on:change={(e) => city = e.target.value}
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                  required
                  disabled={!country}
                >
                  <option value="">Select City</option>
                  {#each availableCities as cityOption}
                    <option value={cityOption.name}>{cityOption.name}</option>
                  {/each}
                </select>
              </div>
              
              <!-- Currency Selection -->
              <div>
                <label for="currency" class="block text-sm font-medium text-gray-700 mb-2">Currency *</label>
                <select 
                  id="currency"
                  value={currency}
                  on:change={(e) => currency = e.target.value}
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                  required
                >
                  {#each currencies as currencyOption}
                    <option value={currencyOption.code}>{currencyOption.symbol} {currencyOption.name} ({currencyOption.code})</option>
                  {/each}
                </select>
              </div>
            </div>
            
            <!-- Charges Section -->
            <div class="mt-6">
              <h6 class="text-sm font-semibold text-gray-700 mb-4">
                <i class="fas fa-dollar-sign mr-2"></i>
                Consultation & Hospital Charges
              </h6>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label for="consultationCharge" class="block text-sm font-medium text-gray-700 mb-2">
                    Consultation Charge
                  </label>
                  <div class="relative">
                    <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <span class="text-gray-500 text-sm">{currencies.find(c => c.code === currency)?.symbol || '$'}</span>
                    </div>
                    <input 
                      type="text" 
                      id="consultationCharge"
                      value={consultationCharge}
                      on:input={(e) => consultationCharge = e.target.value}
                      class="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                      placeholder="0.00"
                    />
                  </div>
                  <div class="text-xs text-gray-500 mt-1">
                    <i class="fas fa-info-circle mr-1"></i>
                    Your standard consultation fee
                  </div>
                </div>
                <div>
                  <label for="hospitalCharge" class="block text-sm font-medium text-gray-700 mb-2">
                    Hospital Charge
                  </label>
                  <div class="relative">
                    <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <span class="text-gray-500 text-sm">{currencies.find(c => c.code === currency)?.symbol || '$'}</span>
                    </div>
                    <input 
                      type="text" 
                      id="hospitalCharge"
                      value={hospitalCharge}
                      on:input={(e) => hospitalCharge = e.target.value}
                      class="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                      placeholder="0.00"
                    />
                  </div>
                  <div class="text-xs text-gray-500 mt-1">
                    <i class="fas fa-info-circle mr-1"></i>
                    Hospital visit or admission fee
                  </div>
                </div>
              </div>
            </div>
          </form>
        </div>
        {/if}

        <!-- Prescription Template Tab -->
        {#if activeTab === 'prescription-template'}
        <div>
          <h2 class="text-lg font-semibold text-gray-900 mb-6">Prescription Template Settings</h2>
          <p class="text-gray-600 mb-6">Choose how you want your prescription header to appear on printed prescriptions.</p>
          
          <!-- Template Type Selection -->
          <div class="space-y-4">
            <label class="block text-sm font-semibold text-gray-700">Select Template Type:</label>
            
            <!-- Option 1: Printed Letterheads -->
              <button type="button" class="w-full text-left bg-white border-2 rounded-lg shadow-sm {templateType === 'printed' ? 'border-teal-500' : 'border-gray-200'}" on:click={() => selectTemplateType('printed')}>
              <div class="p-4">
                <div class="flex items-center">
                  <input 
                    class="w-4 h-4 text-teal-600 bg-gray-100 border-gray-300 rounded focus:ring-teal-500 focus:ring-2 mr-3" 
                    type="radio" 
                    name="templateType" 
                    id="templatePrinted" 
                    value="printed"
                    checked={templateType === 'printed'}
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
                        value={headerSize}
                        on:input={(e) => headerSize = parseInt(e.target.value)}
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
            </button>
            
            <!-- Option 2: Upload Image -->
              <button type="button" class="w-full text-left bg-white border-2 rounded-lg shadow-sm {templateType === 'upload' ? 'border-teal-500' : 'border-gray-200'}" on:click={() => selectTemplateType('upload')}>
              <div class="p-4">
                <div class="flex items-center">
                  <input 
                    class="w-4 h-4 text-teal-600 bg-gray-100 border-gray-300 rounded focus:ring-teal-500 focus:ring-2 mr-3" 
                    type="radio" 
                    name="templateType" 
                    id="templateUpload" 
                    value="upload"
                    checked={templateType === 'upload'}
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
            </button>
            
            <!-- Option 3: System Header -->
            <button type="button" class="w-full text-left bg-white border-2 rounded-lg shadow-sm {templateType === 'system' ? 'border-teal-500' : 'border-gray-200'}" style="display: block !important;" on:click={handleThirdOptionClick} on:keydown={(e) => (e.key === 'Enter' || e.key === ' ') && handleThirdOptionClick()}>
              <div class="p-4">
                <div class="flex items-center">
                  <input 
                    class="w-4 h-4 text-teal-600 bg-gray-100 border-gray-300 rounded focus:ring-teal-500 focus:ring-2 mr-3" 
                    type="radio" 
                    name="templateType" 
                    id="templateSystem" 
                    value="system"
                    checked={templateType === 'system'}
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
                  
                  <!-- Debug info -->
                  <div class="mt-2 p-2 bg-yellow-100 text-xs">
                    Debug: templateType = {templateType}, templatePreview = {JSON.stringify(templatePreview)}
                  </div>
                  
                  {#if templatePreview && templatePreview.type === 'system'}
                  <div class="mt-4">
                    <label class="block text-sm font-medium text-gray-700 mb-4">
                      <i class="fas fa-edit mr-2"></i>Professional Header Editor
                    </label>
                    
                    <HeaderEditor 
                      bind:headerText={headerText}
                      onContentChange={handleHeaderContentChange}
                      onSave={handleHeaderSave}
                    />
                  </div>
                  {:else}
                  <div class="mt-4 p-3 bg-red-100 text-red-700 text-sm">
                    Editor not showing. templatePreview: {JSON.stringify(templatePreview)}
                  </div>
                  {/if}
                </div>
                {/if}
              </div>
            </button>
          </div>
          
          <!-- Prescription Preview Section -->
          {#if templateType && templatePreview}
          <div class="mt-8">
            <h3 class="text-lg font-semibold text-gray-900 mb-4">Prescription Preview</h3>
            <div class="bg-white border-2 border-gray-200 rounded-lg p-6">
              <div class="max-w-2xl mx-auto">
                <!-- Prescription Header -->
                {#if templatePreview.type === 'printed'}
                  <div class="text-center mb-6" style="height: {templatePreview.headerSpace}px; border: 2px dashed #d1d5db; display: flex; align-items: center; justify-content: center;">
                    <div class="text-gray-500 text-sm">
                      <i class="fas fa-print text-2xl mb-2"></i>
                      <p>Printed Letterhead Space</p>
                      <p class="text-xs">{templatePreview.headerSpace}px height</p>
                    </div>
                  </div>
                {:else if templatePreview.type === 'upload' && templatePreview.headerImage}
                  <div class="text-center mb-6">
                    <img src={templatePreview.headerImage} alt="Header Preview" class="max-w-full h-auto mx-auto rounded" style="max-height: 200px;">
                  </div>
                {:else if templatePreview.type === 'system'}
                  <div class="text-center mb-6 bg-gray-50 p-4 rounded-lg">
                    {#if templatePreview.formattedHeader}
                      <div class="system-header-preview" bind:this={previewElement}>
                        {@html templatePreview.formattedHeader}
                      </div>
                    {:else}
                      <h4 class="font-bold text-lg mb-2">{templatePreview.doctorName}</h4>
                      <p class="font-semibold mb-1">{templatePreview.practiceName}</p>
                      <p class="text-sm mb-1">{templatePreview.address}</p>
                      <p class="text-sm">Tel: {templatePreview.phone} | Email: {templatePreview.email}</p>
                      <hr class="my-3 border-gray-300">
                      <p class="font-bold text-teal-600">PRESCRIPTION</p>
                    {/if}
                  </div>
                {/if}
                
                <!-- Sample Prescription Content -->
                <div class="space-y-4">
                  <div class="flex justify-between items-center">
                    <div>
                      <p class="font-semibold">Patient: John Doe</p>
                      <p class="text-sm text-gray-600">DOB: 01/15/1985</p>
                    </div>
                    <div class="text-right">
                      <p class="text-sm">Date: {new Date().toLocaleDateString()}</p>
                      <p class="text-sm">Rx #: 12345</p>
                    </div>
                  </div>
                  
                  <div class="border-t pt-4">
                    <div class="mb-3">
                      <p class="font-semibold">Medication:</p>
                      <p>Amoxicillin 500mg</p>
                    </div>
                    <div class="mb-3">
                      <p class="font-semibold">Dosage:</p>
                      <p>Take 1 capsule by mouth every 8 hours for 7 days</p>
                    </div>
                    <div class="mb-3">
                      <p class="font-semibold">Quantity:</p>
                      <p>21 capsules</p>
                    </div>
                    <div class="mb-3">
                      <p class="font-semibold">Refills:</p>
                      <p>0</p>
                    </div>
                  </div>
                  
                  <div class="border-t pt-4">
                    <p class="font-semibold mb-2">Instructions:</p>
                    <p class="text-sm">Take with food to reduce stomach upset. Complete the full course of treatment even if you feel better.</p>
                  </div>
                  
                  <div class="border-t pt-4">
                    <div class="flex justify-between items-end">
                      <div>
                        <p class="font-semibold">Doctor Signature:</p>
                        <div class="mt-8 border-b border-gray-400 w-32"></div>
                        <p class="text-sm mt-1">{templatePreview.doctorName}</p>
                      </div>
                      <div class="text-right">
                        <p class="text-sm">License #: MD12345</p>
                        <p class="text-sm">DEA #: AB1234567</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          {/if}
        </div>
        {/if}
      </div>

      <!-- Footer Actions -->
      <div class="bg-gray-50 px-6 py-4 rounded-b-lg flex justify-between">
        <button 
          type="button" 
          class="px-4 py-2 text-sm bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors duration-200"
          on:click={handleBack}
        >
          <i class="fas fa-arrow-left mr-1 fa-sm"></i>
          Back to App
        </button>
        
        <div class="flex gap-3">
          {#if activeTab === 'edit-profile'}
            <button 
              type="submit" 
              form="edit-profile-form"
              class="px-4 py-2 text-sm bg-red-600 hover:bg-red-700 text-white rounded-lg flex items-center transition-colors duration-200"
              style="background-color: #dc2626 !important;"
              disabled={loading}
            >
              {#if loading}
                <ThreeDots size="small" color="white" />
              {/if}
              <i class="fas fa-save mr-1 fa-sm"></i>
              Save Profile
            </button>
          {:else if activeTab === 'prescription-template'}
            <button 
              type="button" 
              class="px-4 py-2 text-sm bg-teal-600 hover:bg-teal-700 text-white rounded-lg flex items-center transition-colors duration-200"
              on:click={saveTemplateSettings}
              disabled={!templateType}
            >
              <i class="fas fa-save mr-1 fa-sm"></i>
              Save Template Settings
            </button>
          {/if}
        </div>
      </div>
    </div>
  </div>
</div>