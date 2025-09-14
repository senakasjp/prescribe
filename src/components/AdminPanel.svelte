<script>
  import { createEventDispatcher, onMount } from 'svelte'
  import adminAuthService from '../services/adminAuthService.js'
  import AdminLogin from './AdminLogin.svelte'
  import AdminDashboard from './AdminDashboard.svelte'
  
  const dispatch = createEventDispatcher()
  
  let currentAdmin = null
  let loading = true
  
  // Load admin state on component mount
  onMount(() => {
    checkAdminAuth()
  })
  
  // Check if admin is already authenticated
  const checkAdminAuth = () => {
    try {
      currentAdmin = adminAuthService.getCurrentAdmin()
      console.log('🔍 Current admin state:', currentAdmin ? 'Authenticated' : 'Not authenticated')
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
    <div class="d-flex justify-content-center align-items-center vh-100 bg-light">
      <div class="text-center">
        <div class="spinner-border text-danger mb-3" role="status">
          <span class="visually-hidden">Loading...</span>
        </div>
        <p class="text-muted">Loading admin panel...</p>
      </div>
    </div>
  {:else if currentAdmin}
    <!-- Admin Dashboard -->
    <AdminDashboard on:admin-signed-out={handleAdminSignedOut} />
  {:else}
    <!-- Admin Login -->
    <AdminLogin on:admin-signed-in={handleAdminSignedIn} />
  {/if}
  
</div>

<style>
  .admin-panel {
    min-height: 100vh;
  }
  
</style>
