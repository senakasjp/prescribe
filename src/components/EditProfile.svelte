<script>
  import { createEventDispatcher } from 'svelte'
  import authService from '../services/authService.js'
  import { notifySuccess, notifyError } from '../stores/notifications.js'
  import { countries } from '../data/countries.js'
  
  const dispatch = createEventDispatcher()
  export let user
  
  let firstName = user?.firstName || ''
  let lastName = user?.lastName || ''
  let email = user?.email || ''
  let country = user?.country || ''
  let loading = false
  let error = ''
  
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
      
      // Update user data
      const updatedUser = {
        ...user,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        country: country.trim(),
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
        <button type="button" class="btn-close btn-close-white" on:click={handleCancel}></button>
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
