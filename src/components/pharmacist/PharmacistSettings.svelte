<!-- Pharmacist Settings Component - Dedicated settings for pharmacist profile -->
<script>
  import { createEventDispatcher, onMount } from 'svelte'
  import pharmacistAuthService from '../../services/pharmacist/pharmacistAuthService.js'
  import firebaseStorage from '../../services/firebaseStorage.js'
  import { notifySuccess, notifyError } from '../../stores/notifications.js'
  import backupService from '../../services/backupService.js'
  import { countries } from '../../data/countries.js'
  import { cities, getCitiesByCountry } from '../../data/cities.js'
  
  const dispatch = createEventDispatcher()
  export let pharmacist
  
  // Profile form data
  let businessName = ''
  let email = ''
  let country = ''
  let city = ''
  let currency = 'USD' // Default currency
  let loading = false
  let error = ''
  let pharmacyId = null
  let isPrimaryPharmacy = false
  let canEditProfile = false
  let doctorDeleteCode = ''
  let isDoctorOwnedPharmacy = false
  let availableCities = []
  let cityOptions = []
  
  // Tab management
  let activeTab = 'edit-profile'
  
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
  $: availableCities = (country && typeof country === 'string' && country.trim())
    ? getCitiesByCountry(country.trim())
    : []

  $: cityOptions = (city && !availableCities.find(c => c && c.name === city))
    ? [...availableCities, { name: city }]
    : availableCities
  
  // Keep saved city values even when they are not in the curated list.
  
  // Initialize form with pharmacist data
  const initializeForm = () => {
    try {
      businessName = pharmacist?.businessName || ''
      email = pharmacist?.email || ''
      country = pharmacist?.country || ''
      city = pharmacist?.city || ''
      currency = pharmacist?.currency || 'USD'
      doctorDeleteCode = ''
      isDoctorOwnedPharmacy = false
    } catch (error) {
      console.error('Error initializing form:', error)
      // Set default values if initialization fails
      businessName = ''
      email = ''
      country = ''
      city = ''
      currency = 'USD'
      doctorDeleteCode = ''
      isDoctorOwnedPharmacy = false
    }
  }

  const loadDoctorDeleteCode = async () => {
    try {
      if (!pharmacist?.email) return
      const doctorData = await firebaseStorage.getDoctorByEmail(pharmacist.email)
      isDoctorOwnedPharmacy = !!doctorData
      doctorDeleteCode = doctorData?.deleteCode || ''
    } catch (error) {
      console.error('❌ Error loading doctor delete code:', error)
      doctorDeleteCode = ''
      isDoctorOwnedPharmacy = false
    }
  }

  $: pharmacyId = pharmacist?.pharmacyId || pharmacist?.id || null
  $: isPrimaryPharmacy = !!(pharmacist?.id && pharmacyId === pharmacist.id)
  $: canEditProfile = isPrimaryPharmacy

  // Team management state
  let teamFirstName = ''
  let teamLastName = ''
  let teamEmail = ''
  let teamPassword = ''
  let teamConfirmPassword = ''
  let teamMembers = []
  let teamLoading = false
  let teamError = ''
  let teamLoadedFor = null

  // Backup/restore state
  let backupLoading = false
  let backupError = ''
  let backupSuccess = ''
  let restoreLoading = false
  let restoreError = ''
  let restoreSuccess = ''
  let restoreFile = null
  let restoreSummary = null
  
  // Initialize form when pharmacist changes
  $: if (pharmacist) {
    initializeForm()
  }

  $: if (pharmacist?.email) {
    loadDoctorDeleteCode()
  }

  $: if (activeTab === 'team' && pharmacyId && teamLoadedFor !== pharmacyId) {
    loadTeamMembers()
  }

  const loadTeamMembers = async () => {
    if (!isPrimaryPharmacy || !pharmacyId) return
    try {
      teamLoading = true
      teamError = ''
      teamMembers = await firebaseStorage.getPharmacyUsersByPharmacyId(pharmacyId)
      teamLoadedFor = pharmacyId
    } catch (err) {
      teamError = err.message
      notifyError(teamError)
    } finally {
      teamLoading = false
    }
  }

  const handleAddTeamMember = async (event) => {
    event.preventDefault()
    teamError = ''
    teamLoading = true

    try {
      if (!isPrimaryPharmacy) {
        throw new Error('Only the primary pharmacy account can add users')
      }
      if (!teamFirstName.trim() || !teamLastName.trim()) {
        throw new Error('First and last name are required')
      }
      if (!teamEmail.trim()) {
        throw new Error('Email is required')
      }
      if (!teamPassword.trim()) {
        throw new Error('Password is required')
      }
      if (teamPassword !== teamConfirmPassword) {
        throw new Error('Passwords do not match')
      }

      await firebaseStorage.createPharmacyUser({
        pharmacyId: pharmacyId,
        pharmacyName: pharmacist?.businessName || businessName,
        pharmacistNumber: pharmacist?.pharmacistNumber || '',
        firstName: teamFirstName.trim(),
        lastName: teamLastName.trim(),
        email: teamEmail.trim(),
        password: teamPassword,
        createdBy: pharmacist?.id || ''
      })

      notifySuccess('Team member added successfully')

      teamFirstName = ''
      teamLastName = ''
      teamEmail = ''
      teamPassword = ''
      teamConfirmPassword = ''

      await loadTeamMembers()
    } catch (err) {
      teamError = err.message
      notifyError(teamError)
    } finally {
      teamLoading = false
    }
  }
  
  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault()
    
    error = ''
    loading = true
    
    try {
      if (!isPrimaryPharmacy) {
        throw new Error('Only the primary pharmacy account can edit the profile')
      }
      // Debug: Log the original pharmacist object
      console.log('PharmacistSettings: Original pharmacist object:', pharmacist)
      console.log('PharmacistSettings: Pharmacist ID:', pharmacist?.id)
      console.log('PharmacistSettings: Pharmacist pharmacistNumber:', pharmacist?.pharmacistNumber)
      console.log('PharmacistSettings: All pharmacist fields:', Object.keys(pharmacist || {}))
      
      // Try to get the ID from different possible fields
      let pharmacistId = pharmacist?.id || pharmacist?.uid || pharmacist?.pharmacistNumber
      
      if (!pharmacistId) {
        throw new Error('Pharmacist ID is missing from the pharmacist object. Available fields: ' + Object.keys(pharmacist || {}).join(', '))
      }
      
      console.log('PharmacistSettings: Using pharmacist ID:', pharmacistId)
      
      // Basic validation
      if (!businessName.trim()) {
        throw new Error('Business name is required')
      }
      if (!email.trim()) {
        throw new Error('Email is required')
      }
      if (!country.trim()) {
        throw new Error('Country is required')
      }
      if (!city.trim()) {
        throw new Error('City is required')
      }
      
      // Update pharmacist data with proper validation
      const updatedPharmacist = {
        ...pharmacist,
        businessName: businessName ? businessName.trim() : '',
        email: email ? email.trim() : '',
        country: country ? country.trim() : '',
        city: city ? city.trim() : '',
        currency: currency || 'USD',
        name: businessName ? businessName.trim() : '',
        // Ensure all required fields are present
        id: pharmacistId, // Use the resolved pharmacist ID
        pharmacistNumber: pharmacist?.pharmacistNumber || '',
        role: pharmacist?.role || 'pharmacist'
      }
      
      // Debug: Log the data being sent
      console.log('PharmacistSettings: Sending data to update:', updatedPharmacist)
      
      // Validate required fields before sending
      if (!updatedPharmacist.id) {
        throw new Error('Pharmacist ID is required')
      }
      if (!updatedPharmacist.pharmacistNumber) {
        throw new Error('Pharmacist number is required')
      }
      
      // Update in auth service
      await pharmacistAuthService.updatePharmacist(updatedPharmacist)
      notifySuccess('Profile updated successfully!')
      dispatch('profile-updated', updatedPharmacist)
      
    } catch (err) {
      error = err.message
      notifyError(error)
    } finally {
      loading = false
    }
  }
  
  // Handle back to dashboard
  const handleBack = () => {
    dispatch('back-to-dashboard')
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

  const handlePharmacyBackupDownload = async () => {
    try {
      backupLoading = true
      backupError = ''
      backupSuccess = ''

      if (!pharmacyId) {
        throw new Error('Pharmacy ID is not available for backup')
      }

      const backup = await backupService.exportPharmacistBackup(pharmacyId)
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      downloadJsonFile(backup, `pharmacy-backup-${pharmacyId}-${timestamp}.json`)

      backupSuccess = 'Backup downloaded successfully.'
    } catch (err) {
      backupError = err.message || 'Failed to create backup.'
      notifyError(backupError)
    } finally {
      backupLoading = false
    }
  }

  const handlePharmacyRestoreFile = (event) => {
    restoreFile = event.target.files?.[0] || null
    restoreError = ''
    restoreSuccess = ''
    restoreSummary = null
  }

  const handlePharmacyRestore = async () => {
    if (!restoreFile) {
      restoreError = 'Please select a backup file to restore.'
      notifyError(restoreError)
      return
    }
    if (!pharmacyId) {
      restoreError = 'Pharmacy ID is not available for restore.'
      notifyError(restoreError)
      return
    }
    if (!isPrimaryPharmacy) {
      restoreError = 'Only the primary pharmacy account can restore data.'
      notifyError(restoreError)
      return
    }
    if (!confirm('Restore backup? This will merge backup data into your pharmacy and may overwrite records with the same IDs.')) {
      return
    }

    try {
      restoreLoading = true
      restoreError = ''
      restoreSuccess = ''
      restoreSummary = null

      const fileText = await restoreFile.text()
      const backup = JSON.parse(fileText)
      if (backup.type !== 'pharmacist') {
        throw new Error('Selected backup file is not a pharmacy backup.')
      }

      const summary = await backupService.restorePharmacistBackup(pharmacyId, backup)
      restoreSummary = summary
      restoreSuccess = 'Backup restored successfully.'
      notifySuccess(restoreSuccess)
    } catch (err) {
      restoreError = err.message || 'Failed to restore backup.'
      notifyError(restoreError)
    } finally {
      restoreLoading = false
    }
  }
</script>

<div class="bg-white rounded-lg shadow-sm border border-gray-200">
  <!-- Header -->
  <div class="bg-blue-600 text-white px-6 py-4 rounded-t-lg">
    <div class="flex items-center justify-between">
      <h2 class="text-lg font-semibold mb-0">
        <i class="fas fa-cog mr-2"></i>
        Pharmacist Settings
      </h2>
      <button 
        class="text-white hover:text-gray-200 transition-colors duration-200"
        on:click={handleBack}
      >
        <i class="fas fa-arrow-left mr-1"></i>
        Back to Dashboard
      </button>
    </div>
  </div>
  
  <!-- Navigation Tabs -->
  <div class="border-b border-gray-200">
    <nav class="flex space-x-8 px-6" aria-label="Tabs">
      <button 
        class="py-4 px-1 border-b-2 font-medium text-sm transition-colors duration-200 {activeTab === 'edit-profile' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}"
        on:click={() => activeTab = 'edit-profile'}
      >
        <i class="fas fa-user-edit mr-2"></i>
        Edit Profile
      </button>
      <button 
        class="py-4 px-1 border-b-2 font-medium text-sm transition-colors duration-200 {activeTab === 'team' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'} {isPrimaryPharmacy ? '' : 'opacity-60 cursor-not-allowed'}"
        on:click={() => {
          if (isPrimaryPharmacy) activeTab = 'team'
        }}
        disabled={!isPrimaryPharmacy}
      >
        <i class="fas fa-user-plus mr-2"></i>
        Team
      </button>
      <button 
        class="py-4 px-1 border-b-2 font-medium text-sm transition-colors duration-200 {activeTab === 'backup-restore' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}"
        on:click={() => activeTab = 'backup-restore'}
      >
        <i class="fas fa-database mr-2"></i>
        Backup & Restore
      </button>
    </nav>
  </div>
  
  <!-- Tab Content -->
  <div class="p-6">
    {#if activeTab === 'edit-profile'}
      <div id="edit-profile" role="tabpanel" aria-labelledby="edit-profile-tab">
        {#if !canEditProfile}
          <div class="bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded-lg mb-4" role="alert">
            <i class="fas fa-exclamation-triangle mr-2"></i>
            Only the primary pharmacy account can edit this profile.
          </div>
        {/if}
        <form id="edit-profile-form" on:submit={handleSubmit}>
          <!-- Business Information -->
          <div class="mb-6">
            <h6 class="text-sm font-semibold text-gray-700 mb-4">
              <i class="fas fa-store mr-2"></i>
              Business Information
            </h6>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label for="businessName" class="block text-sm font-medium text-gray-700 mb-2">
                  Business Name <span class="text-red-600">*</span>
                </label>
                <input 
                  type="text" 
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
                  id="businessName" 
                  bind:value={businessName}
                  placeholder="Enter your pharmacy business name"
                  required
                  disabled={loading || !canEditProfile}
                />
              </div>
              
              <div>
                <label for="email" class="block text-sm font-medium text-gray-700 mb-2">
                  Email <span class="text-red-600">*</span>
                </label>
                <input 
                  type="email" 
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
                  id="email" 
                  bind:value={email}
                  placeholder="Enter your email address"
                  required
                  disabled={loading || !canEditProfile}
                />
              </div>
            </div>
          </div>
          
          <!-- Location Information -->
          <div class="mb-6">
            <h6 class="text-sm font-semibold text-gray-700 mb-4">
              <i class="fas fa-map-marker-alt mr-2"></i>
              Location Information
            </h6>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label for="country" class="block text-sm font-medium text-gray-700 mb-2">
                  Country <span class="text-red-600">*</span>
                </label>
                <select 
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
                  id="country" 
                  bind:value={country}
                  required
                  disabled={loading || !canEditProfile}
                >
                  <option value="">Select your country</option>
                  {#each countries as countryOption}
                    <option value={countryOption.name}>{countryOption.name}</option>
                  {/each}
                </select>
              </div>
              
              <div>
                <label for="city" class="block text-sm font-medium text-gray-700 mb-2">
                  City <span class="text-red-600">*</span>
                </label>
                <select 
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
                  id="city" 
                  bind:value={city}
                  required
                  disabled={loading || !country || !canEditProfile}
                >
                  <option value="">Select your city</option>
                  {#each cityOptions as cityOption}
                    <option value={cityOption.name}>{cityOption.name}</option>
                  {/each}
                </select>
                {#if country && cityOptions.length === 0}
                  <div class="text-sm text-gray-500 mt-1 text-yellow-600">
                    <i class="fas fa-exclamation-triangle mr-1"></i>
                    No cities available for the selected country. Please contact support.
                  </div>
                {/if}
              </div>
            </div>
          </div>
          
          <!-- Currency Settings -->
          <div class="mb-6">
            <h6 class="text-sm font-semibold text-gray-700 mb-4">
              <i class="fas fa-dollar-sign mr-2"></i>
              Currency & Billing Settings
            </h6>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label for="currency" class="block text-sm font-medium text-gray-700 mb-2">
                  Default Currency <span class="text-red-600">*</span>
                </label>
                <select
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  id="currency"
                  bind:value={currency}
                  required
                  disabled={loading || !canEditProfile}
                >
                  {#each currencies as currencyOption}
                    <option value={currencyOption.code}>{currencyOption.symbol} {currencyOption.name} ({currencyOption.code})</option>
                  {/each}
                </select>
                <div class="text-xs text-gray-500 mt-1">
                  <i class="fas fa-info-circle mr-1"></i>
                  This currency will be used for pricing and billing
                </div>
              </div>
            </div>
          </div>
          
          {#if error}
            <div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4" role="alert">
              <i class="fas fa-exclamation-triangle mr-2"></i>{error}
            </div>
          {/if}
          
          <!-- Submit Button -->
          <div class="action-buttons">
            <button 
              type="button"
              class="action-button action-button-secondary disabled:opacity-50 disabled:cursor-not-allowed"
              on:click={handleBack}
              disabled={loading || !canEditProfile}
            >
              Cancel
            </button>
            <button 
              type="submit"
              class="action-button action-button-primary disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={loading || !canEditProfile}
            >
              {#if loading}
                <i class="fas fa-spinner fa-spin mr-2"></i>
                Saving...
              {:else}
                <i class="fas fa-save mr-2"></i>
                Save Changes
              {/if}
            </button>
          </div>
        </form>
      </div>
    {:else if activeTab === 'team'}
      <div id="team" role="tabpanel" aria-labelledby="team-tab">
        <div class="mb-6">
          <h6 class="text-sm font-semibold text-gray-700 mb-2">
            <i class="fas fa-users mr-2"></i>
            Add Pharmacy Team Member
          </h6>
          <p class="text-sm text-gray-500">
            Create additional logins that share this pharmacy account and inventory.
          </p>
        </div>

        <form class="space-y-4" on:submit={handleAddTeamMember}>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2" for="teamFirstName">
                First Name <span class="text-red-600">*</span>
              </label>
              <input
                id="teamFirstName"
                type="text"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                bind:value={teamFirstName}
                placeholder="Enter first name"
                required
                disabled={teamLoading}
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2" for="teamLastName">
                Last Name <span class="text-red-600">*</span>
              </label>
              <input
                id="teamLastName"
                type="text"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                bind:value={teamLastName}
                placeholder="Enter last name"
                required
                disabled={teamLoading}
              />
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2" for="teamEmail">
                Email <span class="text-red-600">*</span>
              </label>
              <input
                id="teamEmail"
                type="email"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                bind:value={teamEmail}
                placeholder="name@pharmacy.com"
                required
                disabled={teamLoading}
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2" for="teamPassword">
                Temporary Password <span class="text-red-600">*</span>
              </label>
              <input
                id="teamPassword"
                type="password"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                bind:value={teamPassword}
                placeholder="Create a password"
                required
                disabled={teamLoading}
              />
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2" for="teamConfirmPassword">
                Confirm Password <span class="text-red-600">*</span>
              </label>
              <input
                id="teamConfirmPassword"
                type="password"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                bind:value={teamConfirmPassword}
                placeholder="Confirm password"
                required
                disabled={teamLoading}
              />
            </div>
          </div>

          {#if teamError}
            <div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg" role="alert">
              <i class="fas fa-exclamation-triangle mr-2"></i>{teamError}
            </div>
          {/if}

          <div class="flex justify-end">
            <button
              type="submit"
              class="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
              disabled={teamLoading}
            >
              {#if teamLoading}
                <i class="fas fa-spinner fa-spin mr-2"></i>
                Adding...
              {:else}
                <i class="fas fa-user-plus mr-2"></i>
                Add Team Member
              {/if}
            </button>
          </div>
        </form>

        <div class="mt-8">
          <h6 class="text-sm font-semibold text-gray-700 mb-3">
            <i class="fas fa-id-badge mr-2"></i>
            Team Members
          </h6>
          {#if teamLoading}
            <div class="text-sm text-gray-500">
              <i class="fas fa-spinner fa-spin mr-2"></i>
              Loading team members...
            </div>
          {:else if teamMembers.length === 0}
            <div class="text-sm text-gray-500">
              No additional users yet.
            </div>
          {:else}
            <div class="overflow-x-auto border border-gray-200 rounded-lg">
              <table class="min-w-full text-sm text-left">
                <thead class="bg-gray-50 text-gray-600 uppercase text-xs">
                  <tr>
                    <th class="px-4 py-2">Name</th>
                    <th class="px-4 py-2">Email</th>
                    <th class="px-4 py-2">Status</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-200">
                  {#each teamMembers as member}
                    <tr>
                      <td class="px-4 py-2 text-gray-900">
                        {member.firstName} {member.lastName}
                      </td>
                      <td class="px-4 py-2 text-gray-700">{member.email}</td>
                      <td class="px-4 py-2 text-gray-600">{member.status || 'active'}</td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          {/if}
        </div>
      </div>
    {:else if activeTab === 'backup-restore'}
      <div id="backup-restore" role="tabpanel" aria-labelledby="backup-restore-tab">
        <div class="mb-4">
          <h6 class="text-sm font-semibold text-gray-800 mb-2">
            <i class="fas fa-database mr-2"></i>
            Backup & Restore
          </h6>
          <p class="text-xs text-gray-500">
            Export inventory, received prescriptions, and team users. Restore them if data is deleted.
          </p>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <h6 class="text-sm font-semibold text-gray-800 mb-2">Create Backup</h6>
            <p class="text-xs text-gray-500 mb-3">
              Includes inventory, received prescriptions, and pharmacy team users.
            </p>
            <button
              type="button"
              class="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors duration-200 disabled:bg-gray-400 disabled:cursor-not-allowed"
              on:click={handlePharmacyBackupDownload}
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
              class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              on:change={handlePharmacyRestoreFile}
            />
            <button
              type="button"
              class="mt-3 inline-flex items-center px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors duration-200 disabled:bg-gray-400 disabled:cursor-not-allowed"
              on:click={handlePharmacyRestore}
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
                Restored: {restoreSummary.inventoryItems} inventory items, {restoreSummary.receivedPrescriptions} prescriptions.
              </div>
            {/if}
          </div>
        </div>
      </div>
    {/if}
  </div>
</div>
