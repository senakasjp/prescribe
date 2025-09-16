<script>
  import { createEventDispatcher } from 'svelte'
  
  const dispatch = createEventDispatcher()
  
  let firstName = ''
  let lastName = ''
  let email = ''
  let phone = ''
  let gender = ''
  let dateOfBirth = ''
  let age = ''
  let weight = ''
  let bloodGroup = ''
  let idNumber = ''
  let address = ''
  let allergies = ''
  let emergencyContact = ''
  let emergencyPhone = ''
  let error = ''
  let loading = false
  
  // Calculate age from date of birth
  const calculateAge = (birthDate) => {
    if (!birthDate) return ''
    const today = new Date()
    const birth = new Date(birthDate)
    let age = today.getFullYear() - birth.getFullYear()
    const monthDiff = today.getMonth() - birth.getMonth()
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--
    }
    return age.toString()
  }
  
  // Handle date of birth change to auto-calculate age
  const handleDateOfBirthChange = () => {
    if (dateOfBirth) {
      age = calculateAge(dateOfBirth)
    }
  }
  
  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault()
    error = ''
    loading = true
    
    try {
      // Validate required fields - only first name and age are mandatory
      if (!firstName.trim()) {
        throw new Error('First name is required')
      }
      
      // Calculate age if date of birth is provided
      let calculatedAge = age
      if (dateOfBirth && !age) {
        calculatedAge = calculateAge(dateOfBirth)
      }
      
      if (!calculatedAge || calculatedAge === '') {
        throw new Error('Age is required. Please provide either age or date of birth')
      }
      
      // Validate email format only if email is provided
      if (email && email.trim()) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!emailRegex.test(email)) {
          throw new Error('Please enter a valid email address')
        }
      }
      
      // Validate date of birth only if provided
      if (dateOfBirth) {
        const birthDate = new Date(dateOfBirth)
        const today = new Date()
        if (birthDate >= today) {
          throw new Error('Date of birth must be in the past')
        }
      }
      
      const patientData = {
        firstName: firstName.trim(),
        lastName: lastName.trim() || '',
        email: email.trim() || '',
        phone: phone.trim() || '',
        gender: gender || '',
        dateOfBirth: dateOfBirth || '',
        age: calculatedAge,
        weight: weight.trim() || '',
        bloodGroup: bloodGroup.trim() || '',
        idNumber: idNumber.trim() || '',
        address: address.trim() || '',
        allergies: allergies.trim() || '',
        emergencyContact: emergencyContact.trim() || '',
        emergencyPhone: emergencyPhone.trim() || ''
      }
      
      dispatch('patient-added', patientData)
      
      // Reset form
      firstName = ''
      lastName = ''
      email = ''
      phone = ''
      gender = ''
      dateOfBirth = ''
      age = ''
      weight = ''
      bloodGroup = ''
      idNumber = ''
      address = ''
      allergies = ''
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

<div class="card border-2 border-info shadow-sm">
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
              <i class="fas fa-user me-1"></i>First Name <span class="text-danger">*</span>
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
            <label for="lastName" class="form-label">Last Name</label>
            <input 
              type="text" 
              class="form-control" 
              id="lastName" 
              bind:value={lastName}
              disabled={loading}
            >
          </div>
        </div>
      </div>
      
      <div class="row g-3">
        <div class="col-12 col-md-6">
          <div class="mb-3">
            <label for="email" class="form-label">
              <i class="fas fa-envelope me-1"></i>Email Address
            </label>
            <input 
              type="email" 
              class="form-control" 
              id="email" 
              bind:value={email}
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
            <label for="gender" class="form-label">
              <i class="fas fa-venus-mars me-1"></i>Gender
            </label>
            <select 
              class="form-select" 
              id="gender" 
              bind:value={gender}
              disabled={loading}
            >
              <option value="">Select Gender</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Other">Other</option>
              <option value="Prefer not to say">Prefer not to say</option>
            </select>
          </div>
        </div>
      </div>
      
      <div class="row g-3">
        <div class="col-12 col-md-3">
          <div class="mb-3">
            <label for="dateOfBirth" class="form-label">
              <i class="fas fa-calendar me-1"></i>Date of Birth
            </label>
            <input 
              type="date" 
              class="form-control" 
              id="dateOfBirth" 
              bind:value={dateOfBirth}
              on:change={handleDateOfBirthChange}
              disabled={loading}
            >
          </div>
        </div>
        <div class="col-12 col-md-3">
          <div class="mb-3">
            <label for="age" class="form-label">
              <i class="fas fa-birthday-cake me-1"></i>Age <span class="text-danger">*</span>
            </label>
            <input 
              type="number" 
              class="form-control" 
              id="age" 
              bind:value={age}
              min="0"
              max="150"
              placeholder="Auto-calculated"
              disabled={loading}
            >
            <small class="form-text text-muted">Auto-calculated</small>
          </div>
        </div>
        <div class="col-12 col-md-3">
          <div class="mb-3">
            <label for="weight" class="form-label">
              <i class="fas fa-weight me-1"></i>Weight
            </label>
            <input 
              type="number" 
              class="form-control" 
              id="weight" 
              bind:value={weight}
              min="0"
              max="500"
              step="0.1"
              placeholder="kg"
              disabled={loading}
            >
            <small class="form-text text-muted">Weight in kilograms</small>
          </div>
        </div>
        <div class="col-12 col-md-3">
          <div class="mb-3">
            <label for="bloodGroup" class="form-label">
              <i class="fas fa-tint me-1"></i>Blood Group
            </label>
            <select 
              class="form-control" 
              id="bloodGroup" 
              bind:value={bloodGroup}
              disabled={loading}
            >
              <option value="">Select Blood Group</option>
              <option value="A+">A+</option>
              <option value="A-">A-</option>
              <option value="B+">B+</option>
              <option value="B-">B-</option>
              <option value="AB+">AB+</option>
              <option value="AB-">AB-</option>
              <option value="O+">O+</option>
              <option value="O-">O-</option>
            </select>
            <small class="form-text text-muted">Important for medical procedures</small>
          </div>
        </div>
      </div>
      
      <div class="row g-3">
        <div class="col-12 col-md-6">
          <div class="mb-3">
            <label for="idNumber" class="form-label">ID Number</label>
            <input 
              type="text" 
              class="form-control" 
              id="idNumber" 
              bind:value={idNumber}
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
      
      <div class="mb-3">
        <label for="allergies" class="form-label">
          <i class="fas fa-exclamation-triangle me-1"></i>Allergies
        </label>
        <textarea 
          class="form-control" 
          id="allergies" 
          rows="3" 
          bind:value={allergies}
          placeholder="List any known allergies (e.g., Penicillin, Shellfish, Latex, etc.)"
          disabled={loading}
        ></textarea>
        <small class="form-text text-muted">Important: List all known allergies to medications, foods, or other substances</small>
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
