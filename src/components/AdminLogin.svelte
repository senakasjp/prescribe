<script>
  import { createEventDispatcher } from 'svelte'
  import adminAuthService from '../services/adminAuthService.js'
  
  const dispatch = createEventDispatcher()
  
  let email = ''
  let password = ''
  let loading = false
  let error = ''
  
  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault()
    error = ''
    loading = true
    
    try {
      // Validate email format
      if (!email || !email.includes('@')) {
        throw new Error('Please enter a valid email address')
      }
      
      // Validate password
      if (!password || password.length < 6) {
        throw new Error('Password must be at least 6 characters')
      }
      
      // Attempt admin sign in
      const admin = await adminAuthService.signInAdmin(email, password)
      console.log('✅ Admin signed in successfully:', admin)
      
      // Dispatch success event
      dispatch('admin-signed-in', admin)
      
    } catch (err) {
      console.error('❌ Admin sign in error:', err)
      error = err.message
    } finally {
      loading = false
    }
  }
  
  // Handle demo login (for development)
  const handleDemoLogin = () => {
    email = 'senakahks@gmail.com'
    password = 'admin123'
  }
</script>

<div class="min-h-screen bg-gray-50">
  <div class="flex items-center justify-center h-screen px-4">
    <div class="w-full max-w-md">
      <div class="bg-white rounded-lg shadow-xl border border-gray-200">
        <div class="bg-red-600 text-white text-center py-6 rounded-t-lg">
          <div class="mb-3">
            <i class="fas fa-shield-alt text-4xl"></i>
          </div>
          <h4 class="text-xl font-bold mb-0">
            <i class="fas fa-user-shield mr-2"></i>
            Admin Panel
          </h4>
          <p class="text-sm mt-2 opacity-90">System Administration</p>
        </div>
        
        <div class="p-6">
          <!-- Error Message -->
          {#if error}
            <div class="bg-red-50 border border-red-200 rounded-lg p-3 mb-4" role="alert">
              <div class="flex items-center justify-between">
                <div class="flex items-center">
                  <i class="fas fa-exclamation-triangle text-red-500 mr-2"></i>
                  <span class="text-sm text-red-700">{error}</span>
                </div>
                <button type="button" class="text-red-500 hover:text-red-700 focus:outline-none focus:ring-4 focus:ring-red-300 rounded-lg transition-all duration-200" on:click={() => error = ''}>
                  <i class="fas fa-times"></i>
                </button>
              </div>
            </div>
          {/if}
            
          <!-- Login Form -->
          <form on:submit={handleSubmit} class="space-y-4">
            <div>
              <label for="admin-email" class="block text-sm font-medium text-gray-700 mb-1">
                <i class="fas fa-envelope mr-2"></i>Admin Email
              </label>
              <input
                type="email"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                id="admin-email"
                bind:value={email}
                placeholder="Enter admin email"
                required
                disabled={loading}
              />
            </div>
            
            <div>
              <label for="admin-password" class="block text-sm font-medium text-gray-700 mb-1">
                <i class="fas fa-lock mr-2"></i>Password
              </label>
              <input
                type="password"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                id="admin-password"
                bind:value={password}
                placeholder="Enter admin password"
                required
                disabled={loading}
              />
            </div>
            
            <div>
              <button
                type="submit"
                class="w-full bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center"
                disabled={loading}
              >
                {#if loading}
                  <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Signing In...
                {:else}
                  <i class="fas fa-sign-in-alt mr-2"></i>
                  Sign In to Admin Panel
                {/if}
              </button>
            </div>
          </form>
            
          <!-- Demo Login Button (for development) -->
          <div class="mt-4 text-center">
            <button
              type="button"
              class="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200 disabled:bg-gray-100 disabled:cursor-not-allowed"
              on:click={handleDemoLogin}
              disabled={loading}
            >
              <i class="fas fa-flask mr-2"></i>
              Demo Login
            </button>
          </div>
        </div>
        
        <div class="bg-gray-50 text-center py-3 rounded-b-lg">
          <small class="text-gray-500">
            <i class="fas fa-info-circle mr-1"></i>
            Authorized personnel only
          </small>
        </div>
      </div>
    </div>
  </div>
</div>

<!-- Flowbite styling -->
