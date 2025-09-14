<script>
  import { createEventDispatcher } from 'svelte'
  
  const dispatch = createEventDispatcher()
  
  let firstName = ''
  let lastName = ''
  let email = ''
  let phone = ''
  let dateOfBirth = ''
  let idNumber = ''
  let address = ''
  let emergencyContact = ''
  let emergencyPhone = ''
  let error = ''
  let loading = false
  
  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault()
    error = ''
    loading = true
    
    try {
      // Validate required fields
      if (!firstName || !lastName || !email || !dateOfBirth || !idNumber) {
        throw new Error('Please fill in all required fields')
      }
      
      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(email)) {
        throw new Error('Please enter a valid email address')
      }
      
      // Validate date of birth
      const birthDate = new Date(dateOfBirth)
      const today = new Date()
      if (birthDate >= today) {
        throw new Error('Date of birth must be in the past')
      }
      
      const patientData = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        dateOfBirth,
        idNumber: idNumber.trim(),
        address: address.trim(),
        emergencyContact: emergencyContact.trim(),
        emergencyPhone: emergencyPhone.trim()
      }
      
      dispatch('patient-added', patientData)
      
      // Reset form
      firstName = ''
      lastName = ''
      email = ''
      phone = ''
      dateOfBirth = ''
      idNumber = ''
      address = ''
      emergencyContact = ''
      emergencyPhone = ''
      
    } catch (err) {
      error = err.message
      console.error('Form validation error:', err)
    } finally {
      loading = false
    }
  }
  
  // Handle cancel
  const handleCancel = () => {
    dispatch('cancel')
  }
</script>

<div class="card">
  <div class="card-header">
    <h5 class="mb-0">
      <i class="fas fa-user-plus me-2"></i>Add New Patient
    </h5>
  </div>
  <div class="card-body">
    <form on:submit={handleSubmit}>
      <div class="row g-3">
        <div class="col-12 col-md-6">
          <div class="mb-3">
            <label for="firstName" class="form-label">
              <i class="fas fa-user me-1"></i>First Name *
            </label>
            <input 
              type="text" 
              class="form-control" 
              id="firstName" 
              bind:value={firstName}
              required
              disabled={loading}
            >
          </div>
        </div>
        <div class="col-12 col-md-6">
          <div class="mb-3">
            <label for="lastName" class="form-label">Last Name *</label>
            <input 
              type="text" 
              class="form-control" 
              id="lastName" 
              bind:value={lastName}
              required
              disabled={loading}
            >
          </div>
        </div>
      </div>
      
      <div class="row g-3">
        <div class="col-12 col-md-6">
          <div class="mb-3">
            <label for="email" class="form-label">
              <i class="fas fa-envelope me-1"></i>Email Address *
            </label>
            <input 
              type="email" 
              class="form-control" 
              id="email" 
              bind:value={email}
              required
              disabled={loading}
            >
          </div>
        </div>
        <div class="col-12 col-md-6">
          <div class="mb-3">
            <label for="phone" class="form-label">Phone Number</label>
            <input 
              type="tel" 
              class="form-control" 
              id="phone" 
              bind:value={phone}
              disabled={loading}
            >
          </div>
        </div>
      </div>
      
      <div class="row g-3">
        <div class="col-12 col-md-6">
          <div class="mb-3">
            <label for="dateOfBirth" class="form-label">
              <i class="fas fa-calendar me-1"></i>Date of Birth *
            </label>
            <input 
              type="date" 
              class="form-control" 
              id="dateOfBirth" 
              bind:value={dateOfBirth}
              required
              disabled={loading}
            >
          </div>
        </div>
        <div class="col-12 col-md-6">
          <div class="mb-3">
            <label for="idNumber" class="form-label">ID Number *</label>
            <input 
              type="text" 
              class="form-control" 
              id="idNumber" 
              bind:value={idNumber}
              required
              disabled={loading}
            >
          </div>
        </div>
      </div>
      
      <div class="mb-3">
        <label for="address" class="form-label">Address</label>
        <textarea 
          class="form-control" 
          id="address" 
          rows="3" 
          bind:value={address}
          disabled={loading}
        ></textarea>
      </div>
      
      <div class="row g-3">
        <div class="col-12 col-md-6">
          <div class="mb-3">
            <label for="emergencyContact" class="form-label">Emergency Contact</label>
            <input 
              type="text" 
              class="form-control" 
              id="emergencyContact" 
              bind:value={emergencyContact}
              disabled={loading}
            >
          </div>
        </div>
        <div class="col-12 col-md-6">
          <div class="mb-3">
            <label for="emergencyPhone" class="form-label">Emergency Phone</label>
            <input 
              type="tel" 
              class="form-control" 
              id="emergencyPhone" 
              bind:value={emergencyPhone}
              disabled={loading}
            >
          </div>
        </div>
      </div>
      
      {#if error}
        <div class="alert alert-danger" role="alert">
          <i class="fas fa-exclamation-triangle me-2"></i>{error}
        </div>
      {/if}
      
      <div class="d-flex flex-column flex-sm-row gap-2">
        <button 
          type="submit" 
          class="btn btn-primary flex-fill" 
          disabled={loading}
        >
          {#if loading}
            <span class="spinner-border spinner-border-sm me-2" role="status"></span>
          {/if}
          <i class="fas fa-save me-1"></i>Save Patient
        </button>
        <button 
          type="button" 
          class="btn btn-secondary flex-fill" 
          on:click={handleCancel}
          disabled={loading}
        >
          <i class="fas fa-times me-1"></i>Cancel
        </button>
      </div>
    </form>
  </div>
</div>
