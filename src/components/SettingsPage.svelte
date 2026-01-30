<!-- Settings Page - Full page settings interface -->
<script>
  
  import { createEventDispatcher, onMount } from 'svelte'
  import authService from '../services/authService.js'
  import firebaseAuthService from '../services/firebaseAuth.js'
  import { countries } from '../data/countries.js'
  import { cities, getCitiesByCountry } from '../data/cities.js'
  import ThreeDots from './ThreeDots.svelte'
  import ConfirmationModal from './ConfirmationModal.svelte'
  import { notifySuccess, notifyError } from '../stores/notifications.js'
  import HeaderEditor from './HeaderEditor.svelte'
  import backupService from '../services/backupService.js'
  import firebaseStorage from '../services/firebaseStorage.js'
  import { resolveCurrencyFromCountry } from '../utils/currencyByCountry.js'

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
  let backupLoading = false
  let backupError = ''
  let backupSuccess = ''
  let restoreLoading = false
  let restoreError = ''
  let restoreSuccess = ''
  let restoreFile = null
  let restoreSummary = null

  // External doctor form
  let externalFirstName = ''
  let externalLastName = ''
  let externalUsername = ''
  let externalPassword = ''
  let externalPasswordConfirm = ''
  let externalPhone = ''
  let externalSpecialization = ''
  let externalCountry = ''
  let externalCity = ''
  let externalLoading = false
  let externalError = ''
  let externalSuccess = ''
  let externalAvailableCities = []
  let resetExternalDeviceModal = false
  let resetExternalDeviceLoading = false
  let resetExternalDeviceMessage = ''

  // Prescription template variables
  let templateType = '' // Will be set from user.templateSettings
  let uploadedHeader = null
  let templatePreview = null
  let headerSize = 300 // Default header size in pixels
  let headerText = ''
  let previewElement = null
  let isSaving = false
  let excludePharmacyDrugs = false
  let procedurePricing = []
  let deleteCode = ''
  let renewingDeleteCode = false

  // Tab management
  let activeTab = 'edit-profile'
  
  // Available cities based on selected country
  let availableCities = []

  // Debug: Log initial state
  onMount(() => {
    // Component mounted
    loadDeleteCode()
  })

  // Add debugging to template type reactive statement
  $: {
    // Template type reactive statement
  }

  $: if (user?.email) {
    loadDeleteCode()
  }

  const handleRenewDeleteCode = async () => {
    if (renewingDeleteCode) return
    renewingDeleteCode = true
    try {
      if (!user?.email) {
        throw new Error('Doctor email is not available')
      }
      const doctor = await firebaseStorage.getDoctorByEmail(user.email)
      if (!doctor?.id) {
        throw new Error('Doctor profile not found')
      }
      const newDeleteCode = firebaseStorage.generateDeleteCode()
      await firebaseStorage.updateDoctor({ ...doctor, deleteCode: newDeleteCode })
      deleteCode = newDeleteCode
      notifySuccess('Delete code renewed successfully!')
    } catch (err) {
      notifyError(err?.message || 'Failed to renew delete code')
    } finally {
      renewingDeleteCode = false
    }
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

  const procedureOptions = [
    'C&D- type -A',
    'C&D-type -B',
    'C&D-type-C',
    'C&D-type-D',
    'Suturing- type-A',
    'Suturing- type-B',
    'Suturing- type-C',
    'Suturing- type-D',
    'Nebulization - Ipra.0.25ml+N. saline2ml+Oxygen',
    'Nebulization - sal 0. 5ml+Ipra 0. 5ml+N. Saline 3ml',
    'Nebulization - sal 0. 5ml+Ipra 0. 5ml+N. Saline 3ml+Oxygen',
    'Nebulization -sal1ml+Ipra1ml+N. Saline2ml+Oxygen',
    'Nebulization Ipra1ml+N. Saline3ml',
    'Nebulization -sal1ml+Ipra1ml+N. Saline2ml',
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

  // Reactive variable for cities based on selected country
  $: {
    try {
      availableCities = (country && typeof country === 'string' && country.trim()) ? getCitiesByCountry(country.trim()) : []
    } catch (error) {
      console.error('❌ SettingsPage: Error in availableCities reactive statement:', error)
      availableCities = []
    }
  }

  $: {
    try {
      externalAvailableCities = (externalCountry && typeof externalCountry === 'string' && externalCountry.trim())
        ? getCitiesByCountry(externalCountry.trim())
        : []
    } catch (error) {
      console.error('❌ SettingsPage: Error in externalAvailableCities reactive statement:', error)
      externalAvailableCities = []
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

  $: {
    try {
      if (externalCountry && externalCity && !externalAvailableCities.find(c => c.name === externalCity)) {
        externalCity = ''
      }
    } catch (error) {
      console.error('❌ SettingsPage: Error in external city reset reactive statement:', error)
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
    currency = user?.currency || resolveCurrencyFromCountry(user?.country) || 'USD'
    deleteCode = user?.deleteCode || ''
    
    // Load template settings
    if (user?.templateSettings && user.templateSettings.templateType) {
      templateType = user.templateSettings.templateType
      headerSize = user.templateSettings.headerSize || 300
      headerText = user.templateSettings.headerText || ''
      templatePreview = user.templateSettings.templatePreview || null
      uploadedHeader = user.templateSettings.uploadedHeader || null
      excludePharmacyDrugs = user.templateSettings.excludePharmacyDrugs ?? false
    } else {
      templateType = 'printed'
      excludePharmacyDrugs = false
    }

    procedurePricing = normalizeProcedurePricing(user?.templateSettings?.procedurePricing)
  }

  const handleCountryChange = (event) => {
    country = event.target.value
    const resolvedCurrency = resolveCurrencyFromCountry(country)
    currency = resolvedCurrency || 'USD'
  }

  const handleCurrencyChange = (event) => {
    currency = event.target.value
  }

  const loadDeleteCode = async () => {
    try {
      if (!user?.email) return
      const doctor = await firebaseStorage.getDoctorByEmail(user.email)
      deleteCode = doctor?.deleteCode || ''
    } catch (error) {
      console.error('❌ SettingsPage: Error loading delete code:', error)
      deleteCode = ''
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
    if (!user?.email) {
      return user?.id || user?.uid || null
    }

    try {
      const firebaseModule = await import('../services/firebaseStorage.js')
      const firebaseStorage = firebaseModule.default
      const doctor = await firebaseStorage.getDoctorByEmail(user.email)
      return doctor?.id || user?.id || user?.uid || user.email
    } catch (error) {
      console.warn('⚠️ Failed to resolve doctor ID for backup:', error)
      return user?.id || user?.uid || user?.email || null
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
      notifyError(backupError)
    } finally {
      backupLoading = false
    }
  }

  const handleCreateExternalDoctor = async () => {
    externalError = ''
    externalSuccess = ''

    if (!externalFirstName.trim() || !externalLastName.trim()) {
      externalError = 'First name and last name are required.'
      return
    }

    if (!externalUsername.trim()) {
      externalError = 'Username is required.'
      return
    }

    if (!externalPassword.trim()) {
      externalError = 'Password is required.'
      return
    }

    if (externalPassword.trim().length < 6) {
      externalError = 'Password must be at least 6 characters.'
      return
    }

    if (externalPassword !== externalPasswordConfirm) {
      externalError = 'Passwords do not match.'
      return
    }

    const username = externalUsername.trim().toLowerCase()
    if (!/^[a-z0-9._-]{3,30}$/.test(username)) {
      externalError = 'Username must be 3-30 characters (letters, numbers, dot, underscore, hyphen).'
      return
    }

    externalLoading = true

    try {
      const doctorId = await resolveDoctorId()
      if (!doctorId) {
        throw new Error('Unable to link external doctor to your account.')
      }

      const syntheticEmail = `${username}@external.local`
      const ownerDeviceId = firebaseAuthService.getOrCreateDeviceId()
      const payload = {
        firstName: externalFirstName.trim(),
        lastName: externalLastName.trim(),
        name: `${externalFirstName.trim()} ${externalLastName.trim()}`.trim(),
        email: syntheticEmail,
        username: username,
        phone: externalPhone.trim(),
        specialization: externalSpecialization.trim(),
        country: externalCountry.trim(),
        city: externalCity.trim(),
        role: 'doctor',
        isAdmin: false,
        permissions: ['view_patients', 'write_prescriptions'],
        accessLevel: 'external_minimal',
        externalDoctor: true,
        invitedByDoctorId: doctorId,
        allowedDeviceId: ownerDeviceId,
        connectedPharmacists: []
      }

      const existingDoctor = await firebaseStorage.getDoctorByEmail(payload.email)
      if (existingDoctor) {
        throw new Error('This username is already taken.')
      }

      await firebaseAuthService.createExternalDoctorAccount(payload.email, externalPassword, {
        ...payload,
        permissions: ['view_patients', 'write_prescriptions'],
        accessLevel: 'external_minimal',
        invitedByDoctorId: doctorId
      })

      externalSuccess = 'External doctor added. Share the username and password with them for login.'
      externalFirstName = ''
      externalLastName = ''
      externalUsername = ''
      externalPassword = ''
      externalPasswordConfirm = ''
      externalPhone = ''
      externalSpecialization = ''
      externalCountry = ''
      externalCity = ''
    } catch (error) {
      externalError = error.message || 'Failed to add external doctor.'
      notifyError(externalError)
    } finally {
      externalLoading = false
    }
  }

  const handleResetExternalDeviceAccess = async () => {
    resetExternalDeviceLoading = true
    resetExternalDeviceMessage = ''
    try {
      const doctorId = await resolveDoctorId()
      if (!doctorId) {
        throw new Error('Unable to identify the owner doctor.')
      }
      const ownerDeviceId = firebaseAuthService.getOrCreateDeviceId()
      const externalDoctors = await firebaseStorage.getExternalDoctorsByOwnerId(doctorId)
      if (!externalDoctors.length) {
        resetExternalDeviceMessage = 'No external doctors found for this account.'
        notifyError(resetExternalDeviceMessage)
        resetExternalDeviceModal = false
        return
      }
      await Promise.all(
        externalDoctors.map((doctor) =>
          firebaseStorage.updateDoctor({ ...doctor, allowedDeviceId: ownerDeviceId })
        )
      )
      resetExternalDeviceMessage = 'External doctor access was reset to this device.'
      notifySuccess(resetExternalDeviceMessage)
    } catch (error) {
      resetExternalDeviceMessage = error?.message || 'Failed to reset external device access.'
      notifyError(resetExternalDeviceMessage)
    } finally {
      resetExternalDeviceLoading = false
      resetExternalDeviceModal = false
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
      notifyError(restoreError)
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
      notifySuccess(restoreSuccess)
    } catch (error) {
      restoreError = error.message || 'Failed to restore backup.'
      notifyError(restoreError)
    } finally {
      restoreLoading = false
    }
  }

  // Initialize form when user changes (but only once per user ID)
  let lastUserId = null
  $: if (user && user.id && user.id !== lastUserId && !isSaving) {
    try {
      initializeForm()
      lastUserId = user.id
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

  // Initialize system template when templateType becomes 'system'
  $: if (templateType === 'system' && !templatePreview) {
    generateSystemHeader()
    
    // Initialize headerText with default content if empty
    if (!headerText || headerText.trim() === '') {
      headerText = `<h5 style="font-weight: bold; margin: 10px 0; text-align: center;">Dr. ${user?.name || '[Your Name]'}</h5>
<p style="font-weight: 600; margin: 5px 0; text-align: center;">${user?.firstName || ''} ${user?.lastName || ''} Medical Practice</p>
<p style="font-size: 0.875rem; margin: 5px 0; text-align: center;">${user?.city || 'City'}, ${user?.country || 'Country'}</p>
<p style="font-size: 0.875rem; margin: 5px 0; text-align: center;">Tel: +1 (555) 123-4567 | Email: ${user?.email || 'doctor@example.com'}</p>
<hr style="margin: 10px 0; border: 1px solid #ccc;">
<p style="font-weight: bold; margin: 5px 0; text-align: center;">PRESCRIPTION</p>`
      console.log('🔧 Auto-initialized headerText with default content')
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
      
      // Import firebaseStorage service to get correct doctor ID
      const firebaseModule = await import('../services/firebaseStorage.js')
      const firebaseStorage = firebaseModule.default
      
      // Get the doctor from Firebase using email to ensure we have the correct ID
      let doctor = await firebaseStorage.getDoctorByEmail(user.email)
      if (!doctor) {
        console.warn('⚠️ Profile update: Doctor not found in Firebase, using user object directly')
        doctor = user
      }
      
      // Update user data with correct ID
      const updatedUser = {
        ...doctor, // Use doctor data from Firebase
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        country: country.trim(),
        city: city.trim(),
        consultationCharge: String(consultationCharge || '').trim(),
        hospitalCharge: String(hospitalCharge || '').trim(),
        currency: currency,
        name: `${firstName.trim()} ${lastName.trim()}`,
        id: doctor.id // Ensure we use the correct Firebase ID
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
  const selectTemplateType = (type) => {
    templateType = type
    uploadedHeader = null
    
    // Clear conflicting data based on template type
    if (type === 'system') {
      uploadedHeader = null
      // Initialize system template preview
      generateSystemHeader()
      
      // Also initialize headerText with default content if empty
      if (!headerText || headerText.trim() === '') {
        headerText = `<h5 style="font-weight: bold; margin: 10px 0; text-align: center;">Dr. ${user?.name || '[Your Name]'}</h5>
<p style="font-weight: 600; margin: 5px 0; text-align: center;">${user?.firstName || ''} ${user?.lastName || ''} Medical Practice</p>
<p style="font-size: 0.875rem; margin: 5px 0; text-align: center;">${user?.city || 'City'}, ${user?.country || 'Country'}</p>
<p style="font-size: 0.875rem; margin: 5px 0; text-align: center;">Tel: +1 (555) 123-4567 | Email: ${user?.email || 'doctor@example.com'}</p>
<hr style="margin: 10px 0; border: 1px solid #ccc;">
<p style="font-weight: bold; margin: 5px 0; text-align: center;">PRESCRIPTION</p>`
      }
    } else if (type === 'upload') {
      templatePreview = null
      headerText = ''
    } else {
      templatePreview = null
      headerText = ''
      uploadedHeader = null
    }
  }

  // Handle third option click specifically
  const handleThirdOptionClick = () => {
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
    
    
    // Load saved header content if available
    const savedHeader = localStorage.getItem('prescriptionHeader')
    
    if (savedHeader) {
      headerText = savedHeader
      templatePreview.formattedHeader = savedHeader
    } else {
      // Initialize with default content
      updateHeaderText()
    }
    
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
  $: if (templateType && !isSaving) {
    generatePrescriptionPreview()
  }

  // Watch for uploaded header changes to update preview
  $: if (uploadedHeader && templateType === 'upload' && !isSaving) {
    generatePrescriptionPreview()
  }

  // Save template settings
  const saveTemplateSettings = async () => {
    isSaving = true
    try {
      if (!user?.email) {
        notifyError('User not authenticated')
        return
      }
      
      // Import firebaseStorage service (default export)
      const firebaseModule = await import('../services/firebaseStorage.js')
      const firebaseStorage = firebaseModule.default
      
      // Get the doctor from Firebase using email to ensure we have the correct ID
      let doctor = await firebaseStorage.getDoctorByEmail(user.email)
      if (!doctor) {
        console.warn('⚠️ Template settings: Doctor not found in Firebase, using user object directly')
        if (!user || !user.id) {
          notifyError('Doctor profile not found. Please try logging in again.')
          return
        }
        doctor = user
      }
      
      const previewWidthPx = templateType === 'system' ? previewElement?.offsetWidth || null : null
      const templatePreviewSnapshot = templatePreview
        ? { ...templatePreview, previewWidthPx }
        : templatePreview

      // Prepare template settings object
      const templateSettings = {
        doctorId: doctor.id,
        templateType: templateType,
        headerSize: headerSize,
        headerText: headerText || '',
        templatePreview: templatePreviewSnapshot,
        uploadedHeader: uploadedHeader,
        excludePharmacyDrugs: excludePharmacyDrugs,
        procedurePricing: normalizeProcedurePricingForSave(procedurePricing),
        updatedAt: new Date().toISOString()
      }
      
      // Persist via dedicated API that handles serialization
      await firebaseStorage.saveDoctorTemplateSettings(doctor.id, templateSettings)
      
      // Update the user object in memory to reflect the new template settings
      if (user) {
        user.templateSettings = templateSettings
        
        // Dispatch event to update App component's user object
        dispatch('user-updated', { user })
      }
      
      notifySuccess('Template settings saved successfully!')
      
    } catch (error) {
      console.error('Error saving template settings:', error)
      notifyError(`Failed to save template settings: ${error.message}`)
    } finally {
      isSaving = false
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

<style>
  .system-header-preview {
    text-align: center;
    line-height: 1.4;
    color: #111827;
  }

  .system-header-preview .ql-editor {
    padding: 0;
  }
</style>
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
          <button 
            class="py-4 px-1 border-b-2 font-medium text-sm {activeTab === 'external-doctor' ? 'border-teal-500 text-teal-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}"
            on:click={() => switchTab('external-doctor')}
          >
            <i class="fas fa-user-md mr-2"></i>
            External Doctor
          </button>
          <button 
            class="py-4 px-1 border-b-2 font-medium text-sm {activeTab === 'procedures' ? 'border-teal-500 text-teal-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}"
            on:click={() => switchTab('procedures')}
          >
            <i class="fas fa-list-check mr-2"></i>
            Procedures
          </button>
          <button 
            class="py-4 px-1 border-b-2 font-medium text-sm {activeTab === 'backup-restore' ? 'border-teal-500 text-teal-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}"
            on:click={() => switchTab('backup-restore')}
          >
            <i class="fas fa-database mr-2"></i>
            Backup
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
                  on:change={handleCountryChange}
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

              <div>
                <label for="deleteCode" class="block text-sm font-medium text-red-600 mb-2">Delete Code</label>
                <div class="flex items-center gap-2">
                  <input
                    type="text"
                    id="deleteCode"
                    value={deleteCode || 'Not assigned'}
                    class="w-full px-3 py-2 border border-red-300 rounded-lg text-sm bg-red-50 text-red-700"
                    disabled
                    readonly
                  />
                  <button
                    type="button"
                    class="inline-flex items-center px-3 py-2 border border-red-500 text-red-600 hover:bg-red-50 rounded-lg text-xs font-medium transition-colors duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
                    on:click={handleRenewDeleteCode}
                    disabled={renewingDeleteCode}
                  >
                    {#if renewingDeleteCode}
                      Renewing...
                    {:else}
                      Renew
                    {/if}
                  </button>
                </div>
                <div class="text-xs text-red-600 mt-1">Use this code to confirm deletions.</div>
              </div>
              
              <!-- Currency Selection -->
              <div>
                <label for="currency" class="block text-sm font-medium text-gray-700 mb-2">Currency *</label>
                <select 
                  id="currency"
                  value={currency}
                  on:change={handleCurrencyChange}
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

            <!-- Prescription Rules -->
            <div class="mt-8 border-t border-gray-200 pt-6">
              <h3 class="text-lg font-semibold text-gray-900 mb-2">Prescription Rules</h3>
              <p class="text-gray-600 mb-4">
                Control how prescriptions behave when pharmacy inventory is missing.
              </p>
              <div class="flex flex-col gap-3">
                <div class="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <div>
                    <p class="text-sm font-medium text-gray-900">Exclude own pharmacy drugs</p>
                    <p class="text-sm text-gray-500">
                      When enabled, only medications not found in connected pharmacy inventory can be added.
                    </p>
                  </div>
                  <label class="inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      class="sr-only peer"
                      bind:checked={excludePharmacyDrugs}
                    />
                    <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-teal-300 rounded-full peer peer-checked:bg-teal-600 relative">
                      <div class="absolute top-0.5 left-0.5 h-5 w-5 bg-white rounded-full transition-transform peer-checked:translate-x-5"></div>
                    </div>
                  </label>
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
                  <div class="text-sm text-gray-500 mb-3">
                    <i class="fas fa-info-circle mr-1"></i>
                    Supported formats: JPG, PNG, GIF. Recommended size: 800x200 pixels.
                  </div>
                  
                </div>
                {/if}
              </div>
            </button>
            
            <!-- Option 3: System Header -->
            <div class="w-full text-left bg-white border-2 rounded-lg shadow-sm {templateType === 'system' ? 'border-teal-500' : 'border-gray-200'} cursor-pointer" style="display: block !important;" on:click={(e) => { handleThirdOptionClick(); }} on:keydown={(e) => (e.key === 'Enter' || e.key === ' ') && handleThirdOptionClick()}>
              <div class="p-4">
                <div class="flex items-center">
                  <!-- Visual indicator instead of radio button -->
                  <div class="w-4 h-4 rounded-full border-2 mr-3 {templateType === 'system' ? 'bg-teal-600 border-teal-600' : 'border-gray-300'}" style="position: relative;">
                    {#if templateType === 'system'}
                      <div class="w-2 h-2 bg-white rounded-full" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);"></div>
                    {/if}
                  </div>
                  <div class="w-full">
                    <div class="flex items-center">
                      <div class="flex-shrink-0 mr-3">
                        <i class="fas fa-cog text-2xl text-teal-600"></i>
                      </div>
                      <div class="flex-1">
                        <h6 class="text-sm font-semibold text-gray-900 mb-1">I want system to add header for template</h6>
                        <p class="text-gray-500 text-sm mb-0">Use a system-generated header with your practice information.</p>
                      </div>
                    </div>
                  </div>
                </div>
                
                {#if templateType === 'system'}
                <div class="mt-3">
                  
                  
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
        </div>
        {/if}

      </div>
    </div>
  </div>
          

          <!-- Prescription Preview Section -->
          {#if templateType && templatePreview}
          <div class="mt-8">
            <h3 class="text-lg font-semibold text-gray-900 mb-4">Prescription Preview</h3>
            <div class="bg-white border-2 border-gray-200 rounded-lg p-6">
              <div class="max-w-2xl mx-auto">
                <!-- Prescription Header -->
                {#if templatePreview.type === 'printed'}
                  <div id="prescription-header-preview-printed" class="text-center mb-6" style="height: {templatePreview.headerSpace}px; border: 2px dashed #d1d5db; display: flex; align-items: center; justify-content: center;">
                    <div class="text-gray-500 text-sm">
                      <i class="fas fa-print text-2xl mb-2"></i>
                      <p>Printed Letterhead Space</p>
                      <p class="text-xs">{templatePreview.headerSpace}px height</p>
                    </div>
                  </div>
                {:else if templatePreview.type === 'upload' && templatePreview.headerImage}
                  <div id="prescription-header-preview-upload" class="text-center mb-6" style="background: white; padding: 10px;">
                    <img src={templatePreview.headerImage} alt="Header Preview" class="max-w-full h-auto mx-auto rounded" style="max-height: 200px;">
                  </div>
                {:else if templateType === 'system'}
                  <div id="prescription-header-preview-system" class="text-center mb-6 bg-white p-4 rounded-lg">
                    {#if headerText && headerText.trim()}
                      <div class="system-header-preview ql-snow">
                        <div class="ql-editor" bind:this={previewElement}>
                          {@html headerText}
                        </div>
                      </div>
                    {:else}
                      <h4 class="font-bold text-lg mb-2">Dr. {user?.name || '[Your Name]'}</h4>
                      <p class="font-semibold mb-1">{user?.firstName || ''} {user?.lastName || ''} Medical Practice</p>
                      <p class="text-sm mb-1">{user?.city || 'City'}, {user?.country || 'Country'}</p>
                      <p class="text-sm">Tel: +1 (555) 123-4567 | Email: {user?.email || 'doctor@example.com'}</p>
                      <hr class="my-3 border-gray-300">
                      <p class="font-bold text-teal-600">PRESCRIPTION</p>
                    {/if}
                  </div>
                {/if}
                
              </div>
            </div>
          </div>
          {/if}
        </div>
        {/if}

        {#if activeTab === 'backup-restore'}
        <div>
          <h2 class="text-lg font-semibold text-gray-900 mb-4">Backup & Restore</h2>
          <p class="text-sm text-gray-600 mb-6">
            Download a backup of your patients and prescriptions, then restore it if data is deleted.
          </p>

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

  {#if activeTab === 'external-doctor'}
        <div>
          <h2 class="text-lg font-semibold text-gray-900 mb-4">External Doctor Access</h2>
          <p class="text-sm text-gray-600">
            Add an outside doctor for temporary coverage. This profile is created with minimum access and can log in only from the owner doctor's device.
          </p>
          <div class="flex flex-wrap items-center gap-2 mt-3 mb-6">
            <span class="text-xs text-gray-500">Replaced this device?</span>
            <button
              type="button"
              class="inline-flex items-center px-3 py-1.5 border border-teal-500 text-teal-600 hover:bg-teal-50 rounded-lg text-xs font-medium transition-colors duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
              on:click={() => (resetExternalDeviceModal = true)}
              disabled={resetExternalDeviceLoading}
            >
              Reset External Device Access
            </button>
          </div>

          <div class="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">First Name *</label>
                <input
                  type="text"
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                  bind:value={externalFirstName}
                />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Last Name *</label>
                <input
                  type="text"
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                  bind:value={externalLastName}
                />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Username *</label>
                <input
                  type="text"
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                  bind:value={externalUsername}
                  placeholder="e.g., dr.username"
                />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Password *</label>
                <input
                  type="password"
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                  bind:value={externalPassword}
                />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Confirm Password *</label>
                <input
                  type="password"
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                  bind:value={externalPasswordConfirm}
                />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Phone</label>
                <input
                  type="text"
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                  bind:value={externalPhone}
                />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Specialization</label>
                <input
                  type="text"
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                  bind:value={externalSpecialization}
                />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Country</label>
                <select
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                  bind:value={externalCountry}
                >
                  <option value="">Select Country</option>
                  {#each countries as countryOption}
                    <option value={countryOption.name}>{countryOption.name}</option>
                  {/each}
                </select>
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">City</label>
                <select
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                  bind:value={externalCity}
                  disabled={!externalCountry}
                >
                  <option value="">Select City</option>
                  {#each externalAvailableCities as cityOption}
                    <option value={cityOption.name}>{cityOption.name}</option>
                  {/each}
                </select>
              </div>
            </div>

            <div class="mt-4 text-xs text-gray-500">
              Access level: <span class="font-medium text-gray-700">Minimal</span> (view patients, write prescriptions).
            </div>

            <button
              type="button"
              class="mt-4 inline-flex items-center px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 transition-colors duration-200 disabled:bg-gray-400 disabled:cursor-not-allowed"
              on:click={handleCreateExternalDoctor}
              disabled={externalLoading}
            >
              <i class="fas fa-user-plus mr-2"></i>
              {externalLoading ? 'Adding...' : 'Add External Doctor'}
            </button>

            {#if externalError}
              <div class="mt-3 text-xs text-red-600">{externalError}</div>
            {/if}
            {#if externalSuccess}
              <div class="mt-3 text-xs text-green-600">{externalSuccess}</div>
            {/if}
          </div>
  </div>
  {/if}

  <ConfirmationModal
    visible={resetExternalDeviceModal}
    title="Reset External Device Access"
    message="This will update all external doctors to log in only from this device. Continue?"
    confirmText="Reset"
    cancelText="Cancel"
    type="warning"
    on:confirm={handleResetExternalDeviceAccess}
    on:cancel={() => (resetExternalDeviceModal = false)}
  />

        {#if activeTab === 'procedures'}
        <div>
          <h2 class="text-lg font-semibold text-gray-900 mb-4">Procedures Pricing</h2>
          <p class="text-sm text-gray-600 mb-6">
            Set default prices for procedures. These prices will be available when preparing prescriptions.
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
                  />
                </div>
              </div>
            {/each}
          </div>
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
          {:else if activeTab === 'procedures'}
            <button 
              type="button" 
              class="px-4 py-2 text-sm bg-teal-600 hover:bg-teal-700 text-white rounded-lg flex items-center transition-colors duration-200"
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
</div>
