<script>
  import { createEventDispatcher, onMount } from 'svelte'
  import adminAuthService from '../services/adminAuthService.js'
  import AdminLogin from './AdminLogin.svelte'
  import AdminDashboard from './AdminDashboard.svelte'
  
  const dispatch = createEventDispatcher()
  export let user = null // Accept current user as prop
  
  let currentAdmin = null
  let loading = true
  
  // Load admin state on component mount
  onMount(() => {
    checkAdminAuth()
  })
  
  // Reactive statement to re-check admin auth when user changes
  $: if (user) {
    console.log('🔄 AdminPanel: User changed, re-checking admin auth')
    console.log('🔄 AdminPanel: User email:', user.email)
    console.log('🔄 AdminPanel: User isAdmin:', user.isAdmin)
    checkAdminAuth()
  }
  
  // Check if admin is already authenticated
  const checkAdminAuth = () => {
    try {
      console.log('🔍 AdminPanel: Checking admin auth...')
      console.log('🔍 AdminPanel: User object:', user)
      
      // Check if current user is super admin
      if (user && (user.isAdmin || user.email === 'senakahks@gmail.com')) {
        console.log('🔍 Super admin detected:', user.email)
        currentAdmin = {
          id: user.id || 'super-admin-001',
          email: user.email,
          role: 'admin',
          name: user.name || 'Super Admin',
          permissions: user.permissions || ['read_all', 'write_all', 'delete_all', 'manage_users', 'view_analytics']
        }
        console.log('✅ Super admin authenticated:', currentAdmin.email)
        console.log('✅ AdminPanel: Setting currentAdmin to:', currentAdmin)
      } else {
        // Check regular admin authentication
        currentAdmin = adminAuthService.getCurrentAdmin()
        console.log('🔍 Current admin state:', currentAdmin ? 'Authenticated' : 'Not authenticated')
      }
    } catch (error) {
      console.error('❌ Error checking admin auth:', error)
      currentAdmin = null
    } finally {
      loading = false
    }
  }
  
  // Handle successful admin sign in
  const handleAdminSignedIn = (admin) => {
    currentAdmin = admin
    console.log('✅ Admin signed in successfully:', admin.email)
  }
  
  // Handle admin sign out
  const handleAdminSignedOut = () => {
    currentAdmin = null
    console.log('👋 Admin signed out')
  }
  
</script>

<div class="admin-panel">
  {#if loading}
    <!-- Loading State -->
    <div class="flex items-center justify-center h-screen bg-gray-50">
      <div class="text-center">
        <div class="inline-flex items-center px-4 py-2 font-semibold leading-6 text-sm shadow rounded-md text-red-500 bg-white transition ease-in-out duration-150 cursor-not-allowed">
          <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-red-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Loading admin panel...
        </div>
        <p class="text-gray-500 mt-3">Please wait while we load the admin panel...</p>
      </div>
    </div>
  {:else if currentAdmin}
    <!-- Admin Dashboard -->
    <AdminDashboard {currentAdmin} on:admin-signed-out={handleAdminSignedOut} />
  {:else}
    <!-- Admin Login -->
    <AdminLogin on:admin-signed-in={handleAdminSignedIn} />
  {/if}
  
</div>

<!-- Flowbite styling -->
