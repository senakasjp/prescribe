<script>
  import { onMount } from 'svelte'
  import authService from './services/authService.js'
  import adminAuthService from './services/adminAuthService.js'
  import DoctorAuth from './components/DoctorAuth.svelte'
  import PatientManagement from './components/PatientManagement.svelte'
  import AdminPanel from './components/AdminPanel.svelte'
  import NotificationContainer from './components/NotificationContainer.svelte'
  
  let user = null
  let loading = true
  let showAdminPanel = false
  
  onMount(() => {
    // Get current user from auth service
    user = authService.getCurrentUser()
    console.log('Current user in App:', user)
    console.log('User ID:', user?.id)
    console.log('User UID:', user?.uid)
    console.log('User email:', user?.email)
    loading = false
  })
  
  // Handle user authentication events
  const handleUserAuthenticated = (event) => {
    user = event.detail
  }
  
  // Handle doctor logout
  const handleLogout = async () => {
    try {
      await authService.signOut()
      user = null
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
</script>

<main class="container-fluid">
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
    <!-- Doctor is logged in - Show patient management -->
    <nav class="navbar navbar-expand-lg navbar-dark bg-primary">
      <div class="container-fluid">
        <span class="navbar-brand">
          <i class="fas fa-user-md me-2"></i>Prescribe
        </span>
        <div class="navbar-nav ms-auto">
          <span class="navbar-text me-3">
            <i class="fas fa-user me-1"></i>Dr. {user.email}
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
      <PatientManagement {user} />
    </div>
  {:else}
    <!-- Doctor is not logged in - Show authentication -->
    <div class="row justify-content-center">
      <div class="col-12 col-sm-10 col-md-8 col-lg-6 col-xl-4">
        <div class="card shadow">
          <div class="card-body p-4">
            <h2 class="card-title text-center mb-4">
              <i class="fas fa-user-md text-primary me-2"></i>Doctor Login
            </h2>
            <DoctorAuth on:user-authenticated={handleUserAuthenticated} />
            
            <!-- Admin Access Button -->
            <div class="text-center mt-4">
              <button 
                class="btn btn-outline-secondary btn-sm" 
                on:click={handleAdminAccess}
                title="Access Admin Panel"
              >
                <i class="fas fa-shield-alt me-2"></i>
                Admin Panel
              </button>
            </div>
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
</style>
