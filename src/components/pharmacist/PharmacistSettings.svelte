<!-- Pharmacist Settings Component - Dedicated settings for pharmacist profile -->
<script>
  import { createEventDispatcher, onMount } from 'svelte'
  import pharmacistAuthService from '../../services/pharmacist/pharmacistAuthService.js'
  import { notifySuccess, notifyError } from '../../stores/notifications.js'
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
  $: availableCities = (country && typeof country === 'string' && country.trim()) ? getCitiesByCountry(country.trim()) : []
  
  // Reset city when country changes
  $: if (country && city && availableCities && !availableCities.find(c => c && c.name === city)) {
    city = ''
  }
  
  // Initialize form with pharmacist data
  const initializeForm = () => {
    try {
      businessName = pharmacist?.businessName || ''
      email = pharmacist?.email || ''
      country = pharmacist?.country || ''
      city = pharmacist?.city || ''
      currency = pharmacist?.currency || 'USD'
    } catch (error) {
      console.error('Error initializing form:', error)
      // Set default values if initialization fails
      businessName = ''
      email = ''
      country = ''
      city = ''
      currency = 'USD'
    }
  }
  
  // Initialize form when pharmacist changes
  $: if (pharmacist) {
    initializeForm()
  }
  
  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault()
    
    error = ''
    loading = true
    
    try {
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
    </nav>
  </div>
  
  <!-- Tab Content -->
  <div class="p-6">
    {#if activeTab === 'edit-profile'}
      <div id="edit-profile" role="tabpanel" aria-labelledby="edit-profile-tab">
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
                  disabled={loading}
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
                  disabled={loading}
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
                  disabled={loading}
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
            </div>
          </div>
          
          <!-- Currency Selection -->
          <div class="mb-6">
            <h6 class="text-sm font-semibold text-gray-700 mb-4">
              <i class="fas fa-dollar-sign mr-2"></i>
              Currency Settings
            </h6>
            <div class="max-w-md">
              <label for="currency" class="block text-sm font-medium text-gray-700 mb-2">
                Default Currency <span class="text-red-600">*</span>
              </label>
              <select 
                class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
                id="currency" 
                bind:value={currency}
                required
                disabled={loading}
              >
                {#each currencies as currencyOption}
                  <option value={currencyOption.code}>{currencyOption.symbol} {currencyOption.name} ({currencyOption.code})</option>
                {/each}
              </select>
              <div class="text-xs text-gray-500 mt-1">
                <i class="fas fa-info-circle mr-1"></i>
                This currency will be used for pricing and billing in your pharmacy
              </div>
            </div>
          </div>
          
          {#if error}
            <div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4" role="alert">
              <i class="fas fa-exclamation-triangle mr-2"></i>{error}
            </div>
          {/if}
          
          <!-- Submit Button -->
          <div class="flex justify-end space-x-3">
            <button 
              type="button"
              class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
              on:click={handleBack}
              disabled={loading}
            >
              Cancel
            </button>
            <button 
              type="submit"
              class="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
              disabled={loading}
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
    {/if}
  </div>
</div>
