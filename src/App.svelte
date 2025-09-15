<script>
  import { onMount, onDestroy } from 'svelte'
  import authService from './services/authService.js'
  import adminAuthService from './services/adminAuthService.js'
  import aiTokenTracker from './services/aiTokenTracker.js'
  import DoctorAuth from './components/DoctorAuth.svelte'
  import PharmacistAuth from './components/PharmacistAuth.svelte'
  import PharmacistDashboard from './components/PharmacistDashboard.svelte'
  import PatientManagement from './components/PatientManagement.svelte'
  import AdminPanel from './components/AdminPanel.svelte'
  import NotificationContainer from './components/NotificationContainer.svelte'
  
  let user = null
  let loading = true
  let showAdminPanel = false
  let doctorUsageStats = null
  let refreshInterval = null
  let authMode = 'doctor' // 'doctor' or 'pharmacist'
  
  onMount(() => {
    try {
      // Get current user from auth service
      user = authService.getCurrentUser()
      console.log('Current user in App:', user)
      console.log('User ID:', user?.id)
      console.log('User UID:', user?.uid)
      console.log('User email:', user?.email)
      console.log('User role:', user?.role)
      
      // Load doctor's AI usage stats
      if (user?.id) {
        doctorUsageStats = aiTokenTracker.getDoctorUsageStats(user.id)
      }
      
      console.log('Setting loading to false')
      loading = false
    } catch (error) {
      console.error('Error in onMount:', error)
      loading = false
    }
    
    // Fallback timeout to ensure loading is set to false
    setTimeout(() => {
      if (loading) {
        console.log('Fallback: Setting loading to false')
        loading = false
      }
    }, 2000)
  })
  
  // Handle user authentication events
  const handleUserAuthenticated = (event) => {
    user = event.detail
  }
  
  // Handle doctor logout
  const handleLogout = async () => {
    try {
      // Clear refresh interval
      if (refreshInterval) {
        clearInterval(refreshInterval)
        refreshInterval = null
      }
      
      await authService.signOut()
      user = null
      doctorUsageStats = null
    } catch (error) {
      console.error('Error signing out:', error)
    }
  }
  
  // Handle admin panel access
  const handleAdminAccess = () => {
    showAdminPanel = true
  }
  
  // Handle back from admin panel
  const handleBackFromAdmin = () => {
    showAdminPanel = false
  }
  
  const handlePharmacistLogin = (pharmacistData) => {
    console.log('Pharmacist login:', pharmacistData)
    user = pharmacistData
    loading = false
  }
  
  const handleSwitchToDoctor = () => {
    authMode = 'doctor'
  }
  
  const handleSwitchToPharmacist = () => {
    authMode = 'pharmacist'
  }
  
  // Refresh doctor's AI usage stats (immediate refresh)
  const refreshDoctorUsageStats = () => {
    if (user?.id) {
      doctorUsageStats = aiTokenTracker.getDoctorUsageStats(user.id)
      console.log('🔄 Doctor usage stats refreshed:', doctorUsageStats)
    }
  }

  // Reactive statement to update stats when user changes
  $: if (user?.id) {
    doctorUsageStats = aiTokenTracker.getDoctorUsageStats(user.id)
    
    // Clear existing interval and set up new one
    if (refreshInterval) {
      clearInterval(refreshInterval)
    }
    
    refreshInterval = setInterval(() => {
      if (user?.id) {
        doctorUsageStats = aiTokenTracker.getDoctorUsageStats(user.id)
      }
    }, 5000)
  }

  // Cleanup on destroy
  onDestroy(() => {
    if (refreshInterval) {
      clearInterval(refreshInterval)
    }
  })
</script>

<main class="container-fluid">
  <!-- Debug info -->
  <div class="position-fixed top-0 end-0 p-2 bg-light border rounded" style="z-index: 9999; font-size: 12px;">
    <div>Loading: {loading}</div>
    <div>User: {user ? 'Yes' : 'No'}</div>
    <div>Role: {user?.role || 'None'}</div>
    <div>Admin: {showAdminPanel ? 'Yes' : 'No'}</div>
  </div>
  
  {#if showAdminPanel}
    <!-- Admin Panel -->
    <AdminPanel on:back-to-app={handleBackFromAdmin} />
  {:else if loading}
    <div class="d-flex justify-content-center align-items-center vh-100">
      <div class="text-center">
        <i class="fas fa-spinner fa-spin fa-2x text-primary mb-3"></i>
        <p class="text-muted">Loading Prescribe...</p>
      </div>
    </div>
  {:else if user}
    {#if user.role === 'pharmacist'}
      <!-- Pharmacist Dashboard -->
        <PharmacistDashboard pharmacist={user} />
    {:else}
      <!-- Doctor is logged in - Show patient management -->
      <nav class="navbar navbar-expand-lg navbar-dark bg-primary">
        <div class="container-fluid">
          <span class="navbar-brand">
            <i class="fas fa-user-md me-2"></i>Prescribe
          </span>
          <div class="navbar-nav ms-auto">
            <span class="navbar-text me-4">
              <i class="fas fa-user me-1"></i>Dr. {user.name || (user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : user.firstName) || user.email}
              {#if doctorUsageStats}
                <span class="badge {doctorUsageStats.today.tokens > 0 ? 'bg-warning text-dark' : 'bg-secondary text-white'} me-3" 
                      title={doctorUsageStats.today.tokens > 0 ? "Today's AI Token Usage" : "AI Usage - No tokens used today"}>
                  <i class="fas fa-robot me-1"></i>
                  {doctorUsageStats.today.tokens.toLocaleString()} tokens
                </span>
              {/if}
            </span>
            <button class="btn btn-outline-light btn-sm me-2" on:click={handleAdminAccess}>
              <i class="fas fa-shield-alt me-1"></i>Admin
            </button>
            <button class="btn btn-outline-light btn-sm" on:click={handleLogout}>
              <i class="fas fa-sign-out-alt me-1"></i>Logout
            </button>
          </div>
        </div>
      </nav>
      
      <div class="container-fluid mt-3 mt-md-4 px-3 px-md-4">
        <PatientManagement {user} on:ai-usage-updated={refreshDoctorUsageStats} />
      </div>
    {/if}
  {:else}
    <!-- User is not logged in - Show authentication -->
    <div class="row justify-content-center">
      <div class="col-12 col-sm-10 col-md-8 col-lg-6 col-xl-4">
        <div class="card shadow">
          <div class="card-body p-4">
            <!-- Auth Mode Toggle -->
            <div class="text-center mb-4">
              <div class="btn-group w-100" role="group">
                <button 
                  type="button" 
                  class="btn {authMode === 'doctor' ? 'btn-primary' : 'btn-outline-primary'} flex-fill"
                  on:click={handleSwitchToDoctor}
                >
                  <i class="fas fa-user-md me-2"></i>Doctor
                </button>
                <button 
                  type="button" 
                  class="btn {authMode === 'pharmacist' ? 'btn-primary' : 'btn-outline-primary'} flex-fill"
                  on:click={handleSwitchToPharmacist}
                >
                  <i class="fas fa-pills me-2"></i>Pharmacist
                </button>
              </div>
            </div>
            
            {#if authMode === 'doctor'}
              <h2 class="card-title text-center mb-4">
                <i class="fas fa-user-md text-primary me-2"></i>Doctor Login
              </h2>
              <DoctorAuth on:user-authenticated={handleUserAuthenticated} />
            {:else}
              <h2 class="card-title text-center mb-4">
                <i class="fas fa-pills text-primary me-2"></i>Pharmacist Login
              </h2>
              <PharmacistAuth 
                on:pharmacist-login={handlePharmacistLogin}
                on:switch-to-doctor={handleSwitchToDoctor}
              />
            {/if}
            
          </div>
        </div>
      </div>
    </div>
  {/if}
  
  <!-- Notification Container -->
  <NotificationContainer />
</main>

<style>
  :global(.container-fluid) {
    min-height: 100vh;
  }
  
  /* Force navbar height with important declarations */
  nav {
    height: 50px !important;
    min-height: 50px !important;
    max-height: 50px !important;
    padding: 0.25rem 1rem !important;
    background-color: #0d6efd !important;
    display: flex !important;
    align-items: center !important;
  }
  
  nav .navbar-brand {
    font-size: 1.1rem !important;
    font-weight: 600 !important;
    color: #fff !important;
    padding: 0.25rem 0 !important;
    margin: 0 !important;
  }
  
  nav .navbar-nav {
    display: flex !important;
    flex-direction: row !important;
    align-items: center !important;
    margin: 0 !important;
    padding: 0 !important;
  }
  
  nav .navbar-text {
    color: rgba(255, 255, 255, 0.75) !important;
    font-size: 0.85rem !important;
    padding: 0.25rem 0 !important;
    margin: 0 !important;
  }
  
  nav .btn {
    padding: 0.25rem 0.5rem !important;
    font-size: 0.8rem !important;
  }
  
  /* Override Bootstrap primary color to dark blue */
  :global(.bg-primary) {
    background-color: #0d6efd !important; /* Dark blue */
  }
  
  :global(.text-primary) {
    color: #0d6efd !important; /* Dark blue */
  }
  
  :global(.border-primary) {
    border-color: #0d6efd !important; /* Dark blue */
  }
  
  :global(.btn-primary) {
    background-color: #0d6efd !important; /* Dark blue */
    border-color: #0d6efd !important; /* Dark blue */
  }
  
  :global(.btn-primary:hover) {
    background-color: #0b5ed7 !important; /* Darker blue on hover */
    border-color: #0b5ed7 !important; /* Darker blue on hover */
  }
  
  :global(.btn-outline-primary) {
    color: #0d6efd !important; /* Dark blue */
    border-color: #0d6efd !important; /* Dark blue */
  }
  
  :global(.btn-outline-primary:hover) {
    background-color: #0d6efd !important; /* Dark blue */
    border-color: #0d6efd !important; /* Dark blue */
    color: white !important;
  }
  
  :global(.navbar-dark .navbar-nav .nav-link) {
    color: rgba(255, 255, 255, 0.9) !important;
  }
  
  :global(.navbar-dark .navbar-nav .nav-link:hover) {
    color: rgba(255, 255, 255, 1) !important;
  }
  
  /* Override Bootstrap info color to dark blue */
  :global(.bg-info) {
    background-color: #0d6efd !important; /* Dark blue */
  }
  
  :global(.text-info) {
    color: #0d6efd !important; /* Dark blue */
  }
  
  :global(.border-info) {
    border-color: #0d6efd !important; /* Dark blue */
  }
  
  :global(.btn-info) {
    background-color: #0d6efd !important; /* Dark blue */
    border-color: #0d6efd !important; /* Dark blue */
  }
  
  :global(.btn-info:hover) {
    background-color: #0b5ed7 !important; /* Darker blue on hover */
    border-color: #0b5ed7 !important; /* Darker blue on hover */
  }
  
  :global(.btn-outline-info) {
    color: #0d6efd !important; /* Dark blue */
    border-color: #0d6efd !important; /* Dark blue */
  }
  
  :global(.btn-outline-info:hover) {
    background-color: #0d6efd !important; /* Dark blue */
    border-color: #0d6efd !important; /* Dark blue */
    color: white !important;
  }
  
</style>
