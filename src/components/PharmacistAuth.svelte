<script>
  import { createEventDispatcher } from 'svelte'
  import authService from '../services/authService.js'
  import { notifySuccess, notifyError } from '../stores/notifications.js'
  
  const dispatch = createEventDispatcher()
  
  let isLogin = true
  let loading = false
  let error = ''
  
  // Login form
  let loginEmail = ''
  let loginPassword = ''
  
  // Registration form
  let regEmail = ''
  let regPassword = ''
  let regBusinessName = ''
  let regConfirmPassword = ''
  
  // Generated pharmacist number
  let generatedNumber = ''
  
  // Generate unique 6-digit number
  const generatePharmacistNumber = () => {
    const existingNumbers = JSON.parse(localStorage.getItem('pharmacistNumbers') || '[]')
    let number
    do {
      number = Math.floor(100000 + Math.random() * 900000).toString()
    } while (existingNumbers.includes(number))
    existingNumbers.push(number)
    localStorage.setItem('pharmacistNumbers', JSON.stringify(existingNumbers))
    return number
  }
  
  const handleLogin = async () => {
    loading = true
    error = ''
    try {
      const result = await authService.loginPharmacist(loginEmail, loginPassword)
      if (result.success) {
        notifySuccess('Login successful!')
        dispatch('pharmacist-login', result.pharmacist)
      } else {
        error = result.message || 'Login failed'
      }
    } catch (err) {
      error = 'Login failed: ' + err.message
    } finally {
      loading = false
    }
  }
  
  const handleRegister = async () => {
    loading = true
    error = ''
    try {
      if (regPassword !== regConfirmPassword) {
        error = 'Passwords do not match'
        return
      }
      
      const pharmacistNumber = generatePharmacistNumber()
      const result = await authService.registerPharmacist({
        email: regEmail,
        password: regPassword,
        businessName: regBusinessName,
        pharmacistNumber: pharmacistNumber
      })
      
      if (result.success) {
        generatedNumber = pharmacistNumber
        notifySuccess('Account created successfully!')
        notifySuccess(`Your pharmacist number is: ${pharmacistNumber}`)
        // Switch to login after successful registration
        setTimeout(() => {
          isLogin = true
          regEmail = ''
          regPassword = ''
          regBusinessName = ''
          regConfirmPassword = ''
          generatedNumber = ''
        }, 2000)
      } else {
        error = result.message || 'Registration failed'
      }
    } catch (err) {
      error = 'Registration failed: ' + err.message
    } finally {
      loading = false
    }
  }
  
  const toggleMode = () => {
    isLogin = !isLogin
    error = ''
    // Clear forms when switching
    loginEmail = ''
    loginPassword = ''
    regEmail = ''
    regPassword = ''
    regBusinessName = ''
    regConfirmPassword = ''
    generatedNumber = ''
  }
</script>

<!-- Generated Number Display -->
{#if generatedNumber}
  <div class="alert alert-success mb-3">
    <i class="fas fa-check-circle me-2"></i>
    Account created! Your pharmacist number: <strong>{generatedNumber}</strong>
  </div>
{/if}

<!-- Login Form -->
{#if isLogin}
  <form on:submit|preventDefault={handleLogin}>
    <div class="mb-3">
      <label for="loginEmail" class="form-label">Email Address</label>
      <input
        type="email"
        id="loginEmail"
        class="form-control"
        bind:value={loginEmail}
        placeholder="Enter your email address"
        required
        disabled={loading}
      />
    </div>
    
    <div class="mb-3">
      <label for="loginPassword" class="form-label">Password</label>
      <input
        type="password"
        id="loginPassword"
        class="form-control"
        bind:value={loginPassword}
        placeholder="Enter your password"
        required
        disabled={loading}
      />
    </div>
    
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
        Login
      </button>
    </div>
    
    <div class="text-center mt-3">
      <button
        type="button"
        class="btn btn-link"
        on:click={toggleMode}
        disabled={loading}
      >
        Need an account? Register
      </button>
    </div>
  </form>
{:else}
  <!-- Registration Form -->
  <form on:submit|preventDefault={handleRegister}>
    <div class="mb-3">
      <label for="regBusinessName" class="form-label">Pharmacy Name</label>
      <input
        type="text"
        id="regBusinessName"
        class="form-control"
        bind:value={regBusinessName}
        placeholder="Enter your pharmacy name"
        required
        disabled={loading}
      />
    </div>
    
    <div class="mb-3">
      <label for="regEmail" class="form-label">Email Address</label>
      <input
        type="email"
        id="regEmail"
        class="form-control"
        bind:value={regEmail}
        placeholder="Enter your email address"
        required
        disabled={loading}
      />
    </div>
    
    <div class="mb-3">
      <label for="regPassword" class="form-label">Password</label>
      <input
        type="password"
        id="regPassword"
        class="form-control"
        bind:value={regPassword}
        placeholder="Create a secure password"
        required
        minlength="6"
        disabled={loading}
      />
    </div>
    
    <div class="mb-3">
      <label for="regConfirmPassword" class="form-label">Confirm Password</label>
      <input
        type="password"
        id="regConfirmPassword"
        class="form-control"
        bind:value={regConfirmPassword}
        placeholder="Confirm your password"
        required
        disabled={loading}
      />
    </div>
    
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
        Register
      </button>
    </div>
    
    <div class="text-center mt-3">
      <button
        type="button"
        class="btn btn-link"
        on:click={toggleMode}
        disabled={loading}
      >
        Already have an account? Login
      </button>
    </div>
  </form>
{/if}