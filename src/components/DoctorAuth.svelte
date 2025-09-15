<script>
  import { createEventDispatcher } from 'svelte'
  import authService from '../services/authService.js'
  import firebaseAuthService from '../services/firebaseAuth.js'
  import { countries } from '../data/countries.js'
  
  const dispatch = createEventDispatcher()
  
  let firstName = ''
  let lastName = ''
  let email = ''
  let password = ''
  let confirmPassword = ''
  let country = ''
  let isRegistering = false
  let error = ''
  let loading = false
  let googleLoading = false
  
  // Toggle between login and register modes
  const toggleMode = () => {
    isRegistering = !isRegistering
    error = ''
    firstName = ''
    lastName = ''
    email = ''
    password = ''
    confirmPassword = ''
    country = ''
  }
  
  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault()
    error = ''
    loading = true
    
    try {
      if (isRegistering) {
        // Register new doctor
        if (password !== confirmPassword) {
          throw new Error('Passwords do not match')
        }
        
        if (!firstName.trim() || !lastName.trim()) {
          throw new Error('First name and last name are required')
        }
        
        if (!country.trim()) {
          throw new Error('Country is required')
        }
        
        // Password security validation
        if (password.length < 8) {
          throw new Error('Password must be at least 8 characters long')
        }
        
        if (!/(?=.*[a-z])/.test(password)) {
          throw new Error('Password must contain at least one lowercase letter')
        }
        
        if (!/(?=.*[A-Z])/.test(password)) {
          throw new Error('Password must contain at least one uppercase letter')
        }
        
        if (!/(?=.*\d)/.test(password)) {
          throw new Error('Password must contain at least one number')
        }
        
        if (!/(?=.*[@$!%*?&])/.test(password)) {
          throw new Error('Password must contain at least one special character (@$!%*?&)')
        }
        
        // Check for common weak passwords
        const commonPasswords = ['password', '123456', 'password123', 'admin', 'doctor', 'medical', 'healthcare']
        if (commonPasswords.some(weak => password.toLowerCase().includes(weak))) {
          throw new Error('Password contains common words and is not secure')
        }
        
        // Check for sequential characters
        if (/(.)\1{2,}/.test(password)) {
          throw new Error('Password cannot contain repeated characters')
        }
        
        const user = await authService.registerDoctor(email, password, { firstName, lastName, country })
        console.log('Doctor registered successfully')
        
        // Dispatch event to parent to refresh user state
        dispatch('user-authenticated', user)
      } else {
        // Sign in existing doctor
        const user = await authService.signInDoctor(email, password)
        console.log('Doctor signed in successfully')
        
        // Dispatch event to parent to refresh user state
        dispatch('user-authenticated', user)
      }
    } catch (err) {
      error = err.message
      console.error('Authentication error:', err)
    } finally {
      loading = false
    }
  }

  // Handle Google login
  const handleGoogleLogin = async () => {
    error = ''
    googleLoading = true
    
    try {
      const user = await firebaseAuthService.signInWithGoogle('doctor')
      console.log('Doctor signed in with Google successfully')
      
      // Dispatch event to parent to refresh user state
      dispatch('user-authenticated', user)
    } catch (err) {
      error = err.message || 'Failed to sign in with Google'
      console.error('Google authentication error:', err)
    } finally {
      googleLoading = false
    }
  }
</script>

<form on:submit={handleSubmit}>
  {#if isRegistering}
    <div class="row mb-3">
      <div class="col-md-6">
        <label for="firstName" class="form-label">First Name</label>
        <input 
          type="text" 
          class="form-control" 
          id="firstName" 
          bind:value={firstName}
          placeholder="Enter your first name"
          required
          disabled={loading}
        >
      </div>
      <div class="col-md-6">
        <label for="lastName" class="form-label">Last Name</label>
        <input 
          type="text" 
          class="form-control" 
          id="lastName" 
          bind:value={lastName}
          placeholder="Enter your last name"
          required
          disabled={loading}
        >
      </div>
    </div>
  {/if}
  
  <div class="mb-3">
    <label for="email" class="form-label">Email Address</label>
    <input 
      type="email" 
      class="form-control" 
      id="email" 
      bind:value={email}
      placeholder="Enter your email address"
      required
      disabled={loading}
    >
  </div>
  
  {#if isRegistering}
    <div class="mb-3">
      <label for="country" class="form-label">
        Country <span class="text-danger">*</span>
      </label>
      <select 
        class="form-select" 
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
  {/if}
  
  <div class="mb-3">
    <label for="password" class="form-label">Password</label>
    <input 
      type="password" 
      class="form-control" 
      id="password" 
      bind:value={password}
      placeholder="Enter your password"
      minlength="8"
      required
      disabled={loading}
    >
    {#if isRegistering}
      <div class="form-text">
        <i class="fas fa-shield-alt me-1"></i>
        Password must be at least 8 characters with uppercase, lowercase, number, and special character
      </div>
    {/if}
  </div>
  
  {#if isRegistering}
    <div class="mb-3">
      <label for="confirmPassword" class="form-label">Confirm Password</label>
      <input 
        type="password" 
        class="form-control" 
        id="confirmPassword" 
        bind:value={confirmPassword}
        placeholder="Confirm your password"
        required
        disabled={loading}
      >
    </div>
  {/if}
  
  {#if error}
    <div class="alert alert-danger" role="alert">
      <i class="fas fa-exclamation-triangle me-2"></i>{error}
    </div>
  {/if}
  
  <div class="d-grid mb-3">
    <button 
      type="submit" 
      class="btn btn-primary" 
      disabled={loading || googleLoading}
    >
      {#if loading}
        <span class="spinner-border spinner-border-sm me-2" role="status"></span>
      {/if}
      {isRegistering ? 'Register' : 'Login'}
    </button>
  </div>
  
  <!-- Google Login Button -->
  <div class="d-grid mb-3">
    <button 
      type="button" 
      class="btn btn-outline-danger" 
      on:click={handleGoogleLogin}
      disabled={loading || googleLoading}
    >
      {#if googleLoading}
        <span class="spinner-border spinner-border-sm me-2" role="status"></span>
      {:else}
        <i class="fab fa-google me-2"></i>
      {/if}
      Continue with Google
    </button>
  </div>
  
  <div class="text-center mt-3">
    <button 
      type="button" 
      class="btn btn-link" 
      on:click={toggleMode}
      disabled={loading}
    >
      {isRegistering ? 'Already have an account? Login' : 'Need an account? Register'}
    </button>
  </div>
</form>
