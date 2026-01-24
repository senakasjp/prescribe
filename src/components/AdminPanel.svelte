<script>
  import { createEventDispatcher, onMount } from 'svelte'
  import adminAuthService from '../services/adminAuthService.js'
  import AdminLogin from './AdminLogin.svelte'
  import AdminDashboard from './AdminDashboard.svelte'
  import LoadingSpinner from './LoadingSpinner.svelte'
  
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

  const handleBackToApp = () => {
    dispatch('back-to-app')
  }
  
</script>

<div class="admin-panel">
  {#if loading}
    <LoadingSpinner 
      size="large" 
      color="red" 
      text="Loading admin panel..." 
      fullScreen={true}
    />
  {:else if currentAdmin}
    <!-- Admin Dashboard -->
    <AdminDashboard {currentAdmin} on:admin-signed-out={handleAdminSignedOut} {handleBackToApp} />
  {:else}
    <!-- Admin Login -->
    <AdminLogin on:admin-signed-in={handleAdminSignedIn} />
  {/if}
  
</div>

<!-- Flowbite styling -->
