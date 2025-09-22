<script>
  import { createEventDispatcher, onMount } from 'svelte'
  import authService from '../services/authService.js'
  import { notifySuccess, notifyError } from '../stores/notifications.js'
  import { countries } from '../data/countries.js'
  import { cities, getCitiesByCountry } from '../data/cities.js'
  
  
  const dispatch = createEventDispatcher()
  export let user
  
  let firstName = ''
  let lastName = ''
  let email = ''
  let country = ''
  let city = ''
  let loading = false
  let error = ''
  
  // Prescription template variables
  let prescriptionTemplates = []
  let newTemplateName = ''
  let newTemplateContent = ''
  
  // Tab management
  let activeTab = 'edit-profile'
  
  // Reactive variable for cities based on selected country
  $: availableCities = country ? getCitiesByCountry(country) : []
  
  
  // Reset city when country changes
  $: if (country && city && !availableCities.find(c => c.name === city)) {
    city = ''
  }
  
  // Function to initialize form fields
  const initializeForm = () => {
    if (user) {
      firstName = user.firstName || ''
      lastName = user.lastName || ''
      email = user.email || ''
      country = user.country || ''
      city = user.city || ''
    }
  }
  
  // Initialize form fields when component mounts
  onMount(() => {
    initializeForm()
  })
  
  // Initialize form fields when user data changes
  $: if (user) {
    initializeForm()
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
  
  // Handle cancel
  const handleCancel = () => {
    dispatch('profile-cancelled')
  }
  
  // Handle tab switching
  const switchTab = (tabName) => {
    activeTab = tabName
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
          <button type="button" class="px-3 py-1 text-sm border border-gray-300 rounded text-gray-700 bg-white hover:bg-gray-50" on:click={initializeForm} title="Reload current values">
            <i class="fas fa-sync-alt fa-sm"></i>
          </button>
          <button type="button" class="text-white hover:text-gray-200 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 rounded-md p-1" on:click={handleCancel}>
            <i class="fas fa-times"></i>
          </button>
          </div>
        </div>
      </div>
      
      <!-- Tab Navigation with explicit width control -->
      <div class="border-b border-gray-200">
        <div class="tab-container">
          <button 
            class="tab-button px-4 py-3 text-sm font-medium text-center border-b-2 transition-colors duration-200 {activeTab === 'edit-profile' ? 'text-teal-600 border-teal-600' : 'text-gray-500 border-gray-100 hover:text-gray-600 hover:border-gray-300'}" 
            id="edit-profile-tab" 
            type="button" 
            role="tab" 
            aria-controls="edit-profile" 
            aria-selected={activeTab === 'edit-profile'}
            on:click={() => switchTab('edit-profile')}
          >
            <i class="fas fa-user-edit mr-2"></i>
            Edit Profile
          </button>
          <button 
            class="tab-button px-4 py-3 text-sm font-medium text-center border-b-2 transition-colors duration-200 {activeTab === 'prescription-template' ? 'text-teal-600 border-teal-600' : 'text-gray-500 border-gray-100 hover:text-gray-600 hover:border-gray-300'}" 
            id="prescription-template-tab" 
            type="button" 
            role="tab" 
            aria-controls="prescription-template" 
            aria-selected={activeTab === 'prescription-template'}
            on:click={() => switchTab('prescription-template')}
          >
            <i class="fas fa-file-medical mr-2"></i>
            Prescription Template
          </button>
        </div>
      </div>
      
      <!-- Debug Message -->
      <div class="text-xs text-gray-400 text-center py-1 border-b border-gray-100">
        Tab Layout Test - Loaded at: {new Date().toLocaleTimeString()}
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
            <div class="text-center py-8">
              <i class="fas fa-file-medical text-6xl text-gray-400 mb-4"></i>
              <h6 class="text-gray-600 mb-2">Prescription Template Settings</h6>
              <p class="text-gray-500 text-sm mb-4">Configure default prescription templates and formatting options.</p>
              <button type="button" class="px-3 py-1 text-sm border border-teal-500 text-teal-500 bg-white hover:bg-teal-50 rounded">
                <i class="fas fa-plus mr-2"></i>
                Add Template
              </button>
            </div>
          </div>
          {/if}
      </div>
        
      <!-- Modal Footer -->
      <div class="bg-gray-50 px-4 py-3 rounded-b-lg flex justify-end gap-3">
        <button type="button" class="px-4 py-2 text-sm bg-gray-600 hover:bg-gray-700 text-white rounded-lg" on:click={handleCancel} disabled={loading}>
          <i class="fas fa-times mr-1 fa-sm"></i>
          Cancel
        </button>
          <button 
            type="submit" 
            form="edit-profile-form"
            class="px-4 py-2 text-sm bg-teal-600 hover:bg-teal-700 text-white rounded-lg flex items-center"
            disabled={loading}
          >
          {#if loading}
            <span class="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2" role="status"></span>
          {/if}
          <i class="fas fa-save mr-1 fa-sm"></i>
          Save Changes
        </button>
      </div>
    </div>
  </div>
</div>

<style>
  /* Force tab layout to prevent overlap */
  .tab-container {
    display: flex !important;
    width: 100% !important;
  }
  
  .tab-button {
    flex: 1 !important;
    max-width: 50% !important;
    box-sizing: border-box !important;
  }
</style>
