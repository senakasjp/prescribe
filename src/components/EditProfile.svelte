<script>
  import { createEventDispatcher, onMount } from 'svelte'
  import authService from '../services/authService.js'
  import { notifySuccess, notifyError } from '../stores/notifications.js'
  import { countries } from '../data/countries.js'
  
  const dispatch = createEventDispatcher()
  export let user
  
  let firstName = ''
  let lastName = ''
  let email = ''
  let country = ''
  let loading = false
  let error = ''
  
  // Function to initialize form fields
  const initializeForm = () => {
    if (user) {
      console.log('EditProfile: Initializing form with user data:', user)
      firstName = user.firstName || ''
      lastName = user.lastName || ''
      email = user.email || ''
      country = user.country || ''
      console.log('EditProfile: Manually initialized form fields')
      console.log('EditProfile: firstName:', firstName, 'lastName:', lastName, 'country:', country)
    } else {
      console.log('EditProfile: No user data available for initialization')
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
  
  // Debug user data
  $: if (user) {
    console.log('EditProfile: User data received:', user)
    console.log('EditProfile: firstName:', firstName)
    console.log('EditProfile: lastName:', lastName)
    console.log('EditProfile: email:', email)
    console.log('EditProfile: country:', country)
  }
  
  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault()
    console.log('EditProfile: Form submitted')
    console.log('EditProfile: Form data - firstName:', firstName, 'lastName:', lastName, 'country:', country)
    console.log('EditProfile: Form data types - firstName type:', typeof firstName, 'lastName type:', typeof lastName, 'country type:', typeof country)
    console.log('EditProfile: Form data lengths - firstName length:', firstName?.length, 'lastName length:', lastName?.length, 'country length:', country?.length)
    
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
      
      console.log('EditProfile: Validation passed, proceeding with update')
      
      // Update user data
      const updatedUser = {
        ...user,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        country: country.trim(),
        name: `${firstName.trim()} ${lastName.trim()}`
      }
      
      console.log('EditProfile: Form values - firstName:', firstName, 'lastName:', lastName, 'country:', country)
      console.log('EditProfile: Creating updatedUser object:', updatedUser)
      
      // Update in auth service
      console.log('EditProfile: Calling authService.updateDoctor with:', updatedUser)
      await authService.updateDoctor(updatedUser)
      console.log('EditProfile: authService.updateDoctor completed successfully')
      
      console.log('EditProfile: Dispatching profile-updated event with:', updatedUser)
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
</script>

<!-- Edit Profile Modal -->
<div class="modal fade show d-block" style="background-color: rgba(var(--bs-dark-rgb), 0.5);" tabindex="-1">
  <div class="modal-dialog">
    <div class="modal-content">
      <div class="modal-header bg-primary text-white">
        <h5 class="modal-title">
          <i class="fas fa-user-edit me-2"></i>
          Edit Profile
        </h5>
        <div class="d-flex gap-2">
          <button type="button" class="btn btn-sm btn-outline-light" on:click={initializeForm} title="Reload current values">
            <i class="fas fa-sync-alt"></i>
          </button>
          <button type="button" class="btn-close btn-close-white" on:click={handleCancel}></button>
        </div>
      </div>
      
      <form on:submit={handleSubmit}>
        <div class="modal-body">
          <div class="row mb-3">
            <div class="col-md-6">
              <label for="editFirstName" class="form-label">
                First Name <span class="text-danger">*</span>
              </label>
              <input 
                type="text" 
                class="form-control" 
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
                class="form-control" 
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
              class="form-control" 
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
              class="form-select" 
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
          
          {#if error}
            <div class="alert alert-danger" role="alert">
              <i class="fas fa-exclamation-triangle me-2"></i>{error}
            </div>
          {/if}
        </div>
        
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" on:click={handleCancel} disabled={loading}>
            <i class="fas fa-times me-1"></i>
            Cancel
          </button>
          <button 
            type="submit" 
            class="btn btn-primary"
            disabled={loading}
          >
            {#if loading}
              <span class="spinner-border spinner-border-sm me-2" role="status"></span>
            {/if}
            <i class="fas fa-save me-1"></i>
            Save Changes
          </button>
        </div>
      </form>
    </div>
  </div>
</div>
