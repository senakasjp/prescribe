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
<div class="modal fade show d-block" style="background-color: rgba(var(--bs-dark-rgb), 0.5);" tabindex="-1">
  <div class="modal-dialog modal-lg">
    <div class="modal-content">
      <div class="modal-header bg-primary text-white">
        <h6 class="modal-title">
          <i class="fas fa-cog me-2 fa-sm"></i>
          Settings
        </h6>
        <div class="d-flex gap-2">
          <button type="button" class="btn btn-sm btn-outline-light" on:click={initializeForm} title="Reload current values">
            <i class="fas fa-sync-alt fa-sm"></i>
          </button>
          <button type="button" class="btn-close btn-close-white" on:click={handleCancel}></button>
        </div>
      </div>
      
      <!-- Tab Navigation -->
      <div class="modal-body p-0">
        <ul class="nav nav-tabs nav-fill" id="settingsTabs" role="tablist">
          <li class="nav-item" role="presentation">
            <button 
              class="nav-link {activeTab === 'edit-profile' ? 'active' : ''} btn-sm" 
              id="edit-profile-tab" 
              type="button" 
              role="tab" 
              aria-controls="edit-profile" 
              aria-selected={activeTab === 'edit-profile'}
              on:click={() => switchTab('edit-profile')}
            >
              <i class="fas fa-user-edit me-2 fa-sm"></i>
              Edit Profile
            </button>
          </li>
          <li class="nav-item" role="presentation">
            <button 
              class="nav-link {activeTab === 'prescription-template' ? 'active' : ''} btn-sm" 
              id="prescription-template-tab" 
              type="button" 
              role="tab" 
              aria-controls="prescription-template" 
              aria-selected={activeTab === 'prescription-template'}
              on:click={() => switchTab('prescription-template')}
            >
              <i class="fas fa-file-medical me-2 fa-sm"></i>
              Prescription Template
            </button>
          </li>
        </ul>
        
        <!-- Tab Content -->
        <div class="tab-content p-3" id="settingsTabContent">
          <!-- Edit Profile Tab -->
          {#if activeTab === 'edit-profile'}
          <div class="tab-pane fade show active" id="edit-profile" role="tabpanel" aria-labelledby="edit-profile-tab">
            <form on:submit={handleSubmit}>
              <div class="row mb-3">
            <div class="col-md-6">
              <label for="editFirstName" class="form-label">
                First Name <span class="text-danger">*</span>
              </label>
              <input 
                type="text" 
                class="form-control form-control-sm" 
                id="editFirstName" 
                bind:value={firstName}
                placeholder="Enter your first name"
                required
                disabled={loading}
              >
            </div>
            <div class="col-md-6">
              <label for="editLastName" class="form-label">
                Last Name <span class="text-danger">*</span>
              </label>
              <input 
                type="text" 
                class="form-control form-control-sm" 
                id="editLastName" 
                bind:value={lastName}
                placeholder="Enter your last name"
                required
                disabled={loading}
              >
            </div>
          </div>
          
          <div class="mb-3">
            <label for="editEmail" class="form-label">Email Address</label>
            <input 
              type="email" 
              class="form-control form-control-sm" 
              id="editEmail" 
              value={email}
              disabled
              readonly
            >
            <div class="form-text">
              <i class="fas fa-info-circle me-1"></i>
              Email cannot be changed for security reasons
            </div>
          </div>
          
          <div class="mb-3">
            <label for="editCountry" class="form-label">
              Country <span class="text-danger">*</span>
            </label>
            <select 
              class="form-select form-select-sm" 
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
            <label for="editCity" class="form-label">
              City <span class="text-danger">*</span>
            </label>
            <select 
              class="form-select form-select-sm" 
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
              <div class="form-text text-warning">
                <i class="fas fa-exclamation-triangle me-1"></i>
                No cities available for the selected country. Please contact support.
              </div>
            {/if}
          </div>
          
          {#if error}
            <div class="alert alert-danger" role="alert">
              <i class="fas fa-exclamation-triangle me-2"></i>{error}
            </div>
          {/if}
            </form>
          </div>
          {/if}
          
          <!-- Prescription Template Tab -->
          {#if activeTab === 'prescription-template'}
          <div class="tab-pane fade" id="prescription-template" role="tabpanel" aria-labelledby="prescription-template-tab">
            <div class="text-center py-4">
              <i class="fas fa-file-medical fa-3x text-muted mb-3"></i>
              <h6 class="text-muted">Prescription Template Settings</h6>
              <p class="text-muted small">Configure default prescription templates and formatting options.</p>
              <button type="button" class="btn btn-outline-primary btn-sm">
                <i class="fas fa-plus me-2"></i>
                Add Template
              </button>
            </div>
          </div>
          {/if}
        </div>
      </div>
        
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary btn-sm" on:click={handleCancel} disabled={loading}>
            <i class="fas fa-times me-1 fa-sm"></i>
            Cancel
          </button>
          <button 
            type="submit" 
            class="btn btn-primary btn-sm"
            disabled={loading}
          >
            {#if loading}
              <span class="spinner-border spinner-border-sm me-2" role="status"></span>
            {/if}
            <i class="fas fa-save me-1 fa-sm"></i>
            Save Changes
          </button>
        </div>
    </div>
  </div>
</div>
