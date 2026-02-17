<script>
  import { createEventDispatcher } from 'svelte'
  import authService from '../services/authService.js'
  import firebaseAuthService from '../services/firebaseAuth.js'
  import firebaseStorage from '../services/firebaseStorage.js'
  import { notifySuccess, notifyError } from '../stores/notifications.js'
  
  const dispatch = createEventDispatcher()
  export let allowRegister = true
  export let registerOnly = false
  
  let isLogin = true
  let loading = false
  let googleLoading = false
  let error = ''
  
  // Login form
  let loginEmail = ''
  let loginPassword = ''
  let showLoginPassword = false
  
  // Registration form
  let regEmail = ''
  let regPassword = ''
  let regBusinessName = ''
  let regConfirmPassword = ''
  let showRegPassword = false
  let showRegConfirmPassword = false
  
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

  const readRegisterMode = () => {
    if (typeof window === 'undefined') return false
    const params = new URLSearchParams(window.location.search)
    return params.get('register') === '1'
  }

  isLogin = !(registerOnly || (allowRegister && readRegisterMode()))

  $: if (registerOnly && isLogin) {
    isLogin = false
  }

  $: if (!allowRegister && !isLogin) {
    isLogin = true
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
        const message = result.message || 'Login failed'
        if (/pharmacist not found/i.test(message)) {
          try {
            const doctor = await firebaseAuthService.signInWithEmailPassword(loginEmail, loginPassword)
            if (doctor?.role !== 'doctor') {
              throw new Error('Only active doctor accounts can access the pharmacy portal.')
            }
            let pharmacist = await firebaseStorage.getPharmacistByEmail(doctor.email)
            if (!pharmacist) {
              pharmacist = await firebaseStorage.createPharmacist({
                email: doctor.email,
                password: `doctor-${Date.now()}`,
                role: 'pharmacist',
                businessName: doctor.name || doctor.displayName || 'Doctor Pharmacy',
                pharmacistNumber: generatePharmacistNumber()
              })
            }
            notifySuccess('Doctor access granted to pharmacy portal.')
            dispatch('pharmacist-login', pharmacist)
          } catch (doctorError) {
            error = doctorError.message || message
          }
        } else {
          error = message
        }
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

  // Handle Google login
  const handleGoogleLogin = async () => {
    error = ''
    googleLoading = true
    
    try {
      const pharmacist = await firebaseAuthService.signInWithGoogle('pharmacist')
      console.log('Pharmacist signed in with Google successfully')
      
      notifySuccess('Google login successful!')
      dispatch('pharmacist-login', pharmacist)
    } catch (err) {
      error = err.message || 'Failed to sign in with Google'
      notifyError(error)
      console.error('Google authentication error:', err)
    } finally {
      googleLoading = false
    }
  }
  
  const toggleMode = () => {
    if (!allowRegister) {
      return
    }
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
  <div class="bg-teal-50 border border-teal-200 rounded-lg p-3 mb-4">
    <i class="fas fa-check-circle text-teal-500 mr-2"></i>
    <span class="text-sm text-teal-700">Account created! Your pharmacist number: <strong>{generatedNumber}</strong></span>
  </div>
{/if}

<!-- Login Form -->
{#if isLogin}
  <form on:submit|preventDefault={handleLogin} class="space-y-4">
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
        <span class="hidden sm:inline">Login with Google</span>
        <span class="sm:hidden">Google</span>
      </button>

      <div class="flex items-center gap-3 py-4">
        <div class="h-px flex-1 bg-gray-200"></div>
        <span class="text-xs font-bold text-gray-600">OR</span>
        <div class="h-px flex-1 bg-gray-200"></div>
      </div>
    </div>
    <div>
      <label for="loginEmail" class="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
      <input
        type="email"
        id="loginEmail"
        class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
        bind:value={loginEmail}
        placeholder="Enter email address"
        required
        disabled={loading}
      />
    </div>
    
    <div>
      <label for="loginPassword" class="block text-sm font-medium text-gray-700 mb-1">Password</label>
      <div class="relative">
        {#if showLoginPassword}
          <input
            type="text"
            id="loginPassword"
            class="w-full pr-10 px-3 py-2 border border-gray-300 rounded-lg text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
            bind:value={loginPassword}
            placeholder="Enter password"
            required
            disabled={loading}
          />
        {:else}
          <input
            type="password"
            id="loginPassword"
            class="w-full pr-10 px-3 py-2 border border-gray-300 rounded-lg text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
            bind:value={loginPassword}
            placeholder="Enter password"
            required
            disabled={loading}
          />
        {/if}
        <button
          type="button"
          class="absolute inset-y-0 right-0 px-3 text-gray-500 hover:text-gray-700"
          on:click={() => (showLoginPassword = !showLoginPassword)}
          aria-label={showLoginPassword ? 'Hide password' : 'Show password'}
          aria-pressed={showLoginPassword}
          disabled={loading}
        >
          <i class={showLoginPassword ? 'fas fa-eye-slash' : 'fas fa-eye'}></i>
        </button>
      </div>
    </div>
    
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
        Login
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
          Need an account? Register
        </button>
      {:else}
        <a class="text-blue-600 hover:text-blue-800 text-sm font-medium transition-colors duration-200" href="/?register=1#signin">
          Need an account? Register
        </a>
      {/if}
    </div>
  </form>
{:else}
  <!-- Registration Form -->
  <form on:submit|preventDefault={handleRegister} class="space-y-4">
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
        <span class="hidden sm:inline">Register with Google</span>
        <span class="sm:hidden">Google</span>
      </button>

      <div class="flex items-center gap-3 py-4">
        <div class="h-px flex-1 bg-gray-200"></div>
        <span class="text-xs font-bold text-gray-600">OR</span>
        <div class="h-px flex-1 bg-gray-200"></div>
      </div>
    </div>

    <div>
      <label for="regBusinessName" class="block text-sm font-medium text-gray-700 mb-1">Pharmacy Name</label>
      <input
        type="text"
        id="regBusinessName"
        class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
        bind:value={regBusinessName}
        placeholder="Enter your pharmacy name"
        required
        disabled={loading}
      />
    </div>
    
    <div>
      <label for="regEmail" class="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
      <input
        type="email"
        id="regEmail"
        class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
        bind:value={regEmail}
        placeholder="Enter your email address"
        required
        disabled={loading}
      />
    </div>
    
    <div>
      <label for="regPassword" class="block text-sm font-medium text-gray-700 mb-1">Password</label>
      <div class="relative">
        {#if showRegPassword}
          <input
            type="text"
            id="regPassword"
            class="w-full pr-10 px-3 py-2 border border-gray-300 rounded-lg text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
            bind:value={regPassword}
            placeholder="Create a secure password"
            required
            minlength="6"
            disabled={loading}
          />
        {:else}
          <input
            type="password"
            id="regPassword"
            class="w-full pr-10 px-3 py-2 border border-gray-300 rounded-lg text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
            bind:value={regPassword}
            placeholder="Create a secure password"
            required
            minlength="6"
            disabled={loading}
          />
        {/if}
        <button
          type="button"
          class="absolute inset-y-0 right-0 px-3 text-gray-500 hover:text-gray-700"
          on:click={() => (showRegPassword = !showRegPassword)}
          aria-label={showRegPassword ? 'Hide password' : 'Show password'}
          aria-pressed={showRegPassword}
          disabled={loading}
        >
          <i class={showRegPassword ? 'fas fa-eye-slash' : 'fas fa-eye'}></i>
        </button>
      </div>
    </div>
    
    <div>
      <label for="regConfirmPassword" class="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
      <div class="relative">
        {#if showRegConfirmPassword}
          <input
            type="text"
            id="regConfirmPassword"
            class="w-full pr-10 px-3 py-2 border border-gray-300 rounded-lg text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
            bind:value={regConfirmPassword}
            placeholder="Confirm your password"
            required
            disabled={loading}
          />
        {:else}
          <input
            type="password"
            id="regConfirmPassword"
            class="w-full pr-10 px-3 py-2 border border-gray-300 rounded-lg text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
            bind:value={regConfirmPassword}
            placeholder="Confirm your password"
            required
            disabled={loading}
          />
        {/if}
        <button
          type="button"
          class="absolute inset-y-0 right-0 px-3 text-gray-500 hover:text-gray-700"
          on:click={() => (showRegConfirmPassword = !showRegConfirmPassword)}
          aria-label={showRegConfirmPassword ? 'Hide password' : 'Show password'}
          aria-pressed={showRegConfirmPassword}
          disabled={loading}
        >
          <i class={showRegConfirmPassword ? 'fas fa-eye-slash' : 'fas fa-eye'}></i>
        </button>
      </div>
    </div>
    
    {#if error}
      <div class="bg-red-50 border border-red-200 rounded-lg p-3" role="alert">
        <i class="fas fa-exclamation-triangle text-red-500 mr-2"></i>
        <span class="text-sm text-red-700">{error}</span>
      </div>
    {/if}
    
    <div>
      <button
        type="submit"
        class="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center"
        disabled={loading}
      >
        {#if loading}
          <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        {/if}
        Register
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
          Already have an account? Login
        </button>
      {:else}
        <a class="text-blue-600 hover:text-blue-800 text-sm font-medium transition-colors duration-200" href="/#signin">
          Already have an account? Login
        </a>
      {/if}
    </div>
  </form>
{/if}
