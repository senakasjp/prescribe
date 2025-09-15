<script>
  import { createEventDispatcher } from 'svelte'
  import authService from '../services/authService.js'
  
  const dispatch = createEventDispatcher()
  
  let firstName = ''
  let lastName = ''
  let email = ''
  let password = ''
  let confirmPassword = ''
  let isRegistering = false
  let error = ''
  let loading = false
  
  // Toggle between login and register modes
  const toggleMode = () => {
    isRegistering = !isRegistering
    error = ''
    firstName = ''
    lastName = ''
    email = ''
    password = ''
    confirmPassword = ''
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
        
        const user = await authService.registerDoctor(email, password, { firstName, lastName })
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
      required
      disabled={loading}
    >
  </div>
  
  <div class="mb-3">
    <label for="password" class="form-label">Password</label>
    <input 
      type="password" 
      class="form-control" 
      id="password" 
      bind:value={password}
      required
      disabled={loading}
    >
  </div>
  
  {#if isRegistering}
    <div class="mb-3">
      <label for="confirmPassword" class="form-label">Confirm Password</label>
      <input 
        type="password" 
        class="form-control" 
        id="confirmPassword" 
        bind:value={confirmPassword}
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
  
  <div class="d-grid">
    <button 
      type="submit" 
      class="btn btn-primary" 
      disabled={loading}
    >
      {#if loading}
        <span class="spinner-border spinner-border-sm me-2" role="status"></span>
      {/if}
      {isRegistering ? 'Register' : 'Login'}
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
