<script>
  import { createEventDispatcher } from 'svelte'
  import firebaseAuthService from '../services/firebaseAuth.js'
  import { countries } from '../data/countries.js'
  
  const dispatch = createEventDispatcher()
  export let allowRegister = true
  export let registerOnly = false
  
  let firstName = ''
  let lastName = ''
  let email = ''
  let password = ''
  let confirmPassword = ''
  let showPassword = false
  let showConfirmPassword = false
  let country = ''
  let isRegistering = false
  let error = ''
  let loading = false
  let googleLoading = false
  let referralId = ''

  const readReferralId = () => {
    if (typeof window === 'undefined') return ''
    const params = new URLSearchParams(window.location.search)
    return params.get('ref') || ''
  }

  const readRegisterMode = () => {
    if (typeof window === 'undefined') return false
    const params = new URLSearchParams(window.location.search)
    return params.get('register') === '1'
  }
  
  // Toggle between login and register modes
  const toggleMode = () => {
    if (!allowRegister) {
      return
    }
    isRegistering = !isRegistering
    error = ''
    firstName = ''
    lastName = ''
    email = ''
    password = ''
    confirmPassword = ''
    country = ''
  }

  referralId = readReferralId()
  isRegistering = registerOnly || (allowRegister && readRegisterMode())

  $: if (registerOnly && !isRegistering) {
    isRegistering = true
  }

  $: if (!allowRegister && isRegistering) {
    isRegistering = false
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
        
        const user = await firebaseAuthService.registerDoctorWithEmailPassword(email, password, { firstName, lastName, country, referredByDoctorId: referralId })
        console.log('Doctor registered successfully')
        
        // Dispatch event to parent to refresh user state
        dispatch('user-authenticated', user)
      } else {
        // Sign in existing doctor
        const user = await firebaseAuthService.signInWithEmailPassword(email, password)
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
      if (typeof window !== 'undefined' && referralId) {
        localStorage.setItem('pendingReferralId', referralId)
      }
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

<form on:submit={handleSubmit} class="space-y-4">
  <div class="space-y-3">
    <button
      type="button"
      class="w-full bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200 disabled:bg-gray-100 disabled:cursor-not-allowed flex items-center justify-center"
      on:click={handleGoogleLogin}
      disabled={loading || googleLoading}
    >
      {#if googleLoading}
        <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-gray-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      {:else}
        <i class="fab fa-google text-red-500 mr-2"></i>
      {/if}
      <span class="hidden sm:inline">{isRegistering ? 'Register with Google' : 'Login with Google'}</span>
      <span class="sm:hidden">Google</span>
    </button>

    <div class="flex items-center gap-3 py-4">
      <div class="h-px flex-1 bg-gray-200"></div>
      <span class="text-xs font-bold text-gray-600">OR</span>
      <div class="h-px flex-1 bg-gray-200"></div>
    </div>
  </div>

  {#if isRegistering}
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div>
        <label for="firstName" class="block text-sm font-medium text-gray-700 mb-1">First Name</label>
        <input 
          type="text" 
          class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed" 
          id="firstName" 
          bind:value={firstName}
          placeholder="Enter first name"
          required
          disabled={loading}
        >
      </div>
      <div>
        <label for="lastName" class="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
        <input 
          type="text" 
          class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed" 
          id="lastName" 
          bind:value={lastName}
          placeholder="Enter last name"
          required
          disabled={loading}
        >
      </div>
    </div>
  {/if}
  
  <div>
    <label for="email" class="block text-sm font-medium text-gray-700 mb-1">
      {#if isRegistering}
        Email Address
      {:else}
        Email or Username
      {/if}
    </label>
    {#if isRegistering}
      <input 
        type="email"
        class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed" 
        id="email" 
        bind:value={email}
        placeholder="Enter email address"
        required
        disabled={loading}
      >
    {:else}
      <input 
        type="text"
        class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed" 
        id="email" 
        bind:value={email}
        placeholder="Enter email or username"
        required
        disabled={loading}
      >
    {/if}
  </div>
  
  {#if isRegistering}
    <div>
      <label for="country" class="block text-sm font-medium text-gray-700 mb-1">
        Country <span class="text-red-500">*</span>
      </label>
      <select 
        class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed" 
        id="country" 
        bind:value={country}
        required
        disabled={loading}
      >
        <option value="">Select country</option>
        {#each countries as countryOption}
          <option value={countryOption.name}>{countryOption.name}</option>
        {/each}
      </select>
    </div>
  {/if}
  
  <div>
    <label for="password" class="block text-sm font-medium text-gray-700 mb-1">Password</label>
    <div class="relative">
      {#if showPassword}
        <input 
          type="text" 
          class="w-full pr-10 px-3 py-2 border border-gray-300 rounded-lg text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed" 
          id="password" 
          bind:value={password}
          placeholder="Enter password"
          minlength="8"
          required
          disabled={loading}
        >
      {:else}
        <input 
          type="password" 
          class="w-full pr-10 px-3 py-2 border border-gray-300 rounded-lg text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed" 
          id="password" 
          bind:value={password}
          placeholder="Enter password"
          minlength="8"
          required
          disabled={loading}
        >
      {/if}
      <button
        type="button"
        class="absolute inset-y-0 right-0 px-3 text-gray-500 hover:text-gray-700"
        on:click={() => (showPassword = !showPassword)}
        aria-label={showPassword ? 'Hide password' : 'Show password'}
        aria-pressed={showPassword}
        disabled={loading}
      >
        <i class={showPassword ? 'fas fa-eye-slash' : 'fas fa-eye'}></i>
      </button>
    </div>
    {#if isRegistering}
      <div class="mt-1 text-xs text-gray-600">
        <i class="fas fa-shield-alt mr-1"></i>
        Password must be at least 8 characters with uppercase, lowercase, number, and special character
      </div>
    {/if}
  </div>
  
  {#if isRegistering}
    <div>
      <label for="confirmPassword" class="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
      <div class="relative">
        {#if showConfirmPassword}
          <input 
            type="text" 
            class="w-full pr-10 px-3 py-2 border border-gray-300 rounded-lg text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed" 
            id="confirmPassword" 
            bind:value={confirmPassword}
            placeholder="Confirm password"
            required
            disabled={loading}
          >
        {:else}
          <input 
            type="password" 
            class="w-full pr-10 px-3 py-2 border border-gray-300 rounded-lg text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed" 
            id="confirmPassword" 
            bind:value={confirmPassword}
            placeholder="Confirm password"
            required
            disabled={loading}
          >
        {/if}
        <button
          type="button"
          class="absolute inset-y-0 right-0 px-3 text-gray-500 hover:text-gray-700"
          on:click={() => (showConfirmPassword = !showConfirmPassword)}
          aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
          aria-pressed={showConfirmPassword}
          disabled={loading}
        >
          <i class={showConfirmPassword ? 'fas fa-eye-slash' : 'fas fa-eye'}></i>
        </button>
      </div>
    </div>
  {/if}
  
  {#if error}
    <div class="bg-red-50 border border-red-200 rounded-lg p-3" role="alert">
      <i class="fas fa-exclamation-triangle text-red-500 mr-2"></i>
      <span class="text-sm text-red-700">{error}</span>
    </div>
  {/if}
  
  <div class="space-y-3">
    <button 
      type="submit" 
      class="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center" 
      disabled={loading || googleLoading}
    >
      {#if loading}
        <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      {/if}
      {isRegistering ? 'Register' : 'Login'}
    </button>
  </div>
  
  <div class="text-center pt-3">
    {#if allowRegister && !registerOnly}
      <button 
        type="button" 
        class="text-blue-600 hover:text-blue-800 text-sm font-medium transition-colors duration-200 disabled:text-gray-400" 
        on:click={toggleMode}
        disabled={loading}
      >
        {isRegistering ? 'Already have an account? Login' : 'Need an account? Register'}
      </button>
    {:else}
      <a class="text-blue-600 hover:text-blue-800 text-sm font-medium transition-colors duration-200" href="/?register=1#signin">
        {isRegistering ? 'Already have an account? Login' : 'Need an account? Register'}
      </a>
    {/if}
  </div>
</form>
