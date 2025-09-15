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
      // Get current user from auth service only if not already set
      if (!user) {
        user = authService.getCurrentUser()
        console.log('Current user in App:', user)
        console.log('User ID:', user?.id)
        console.log('User UID:', user?.uid)
        console.log('User email:', user?.email)
        console.log('User role:', user?.role)
      }
      
      // Load doctor's AI usage stats only for doctors
      if (user?.id && user?.role === 'doctor') {
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
    // Ensure the pharmacist data has the correct role
    user = {
      ...pharmacistData,
      role: 'pharmacist'
    }
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
    <!-- User is not logged in - Show stylish authentication -->
    <div class="min-vh-100 d-flex align-items-center justify-content-center bg-gradient-primary px-2 px-sm-3 px-md-4">
      <div class="container-fluid">
        <div class="row justify-content-center">
          <div class="col-12 col-sm-11 col-md-10 col-lg-8 col-xl-6 col-xxl-5">
            <!-- Main Auth Card -->
            <div class="card shadow-lg border-0 rounded-4 auth-card">
              <div class="card-body p-3 p-sm-4 p-md-5">
                <!-- App Logo and Title -->
                <div class="text-center mb-4">
                  <div class="mb-3">
                    <div class="bg-primary bg-opacity-10 rounded-circle d-inline-flex align-items-center justify-content-center" style="width: 80px; height: 80px;">
                      <i class="fas fa-stethoscope fa-2x text-primary"></i>
                    </div>
                  </div>
                  <h1 class="card-title fw-bold text-dark mb-2">Prescribe</h1>
                  <p class="text-muted mb-0">AI-Powered Medical Prescription System</p>
                </div>
                
                <!-- Auth Mode Toggle -->
                <div class="text-center mb-4">
                  <div class="single-toggle-button w-100 rounded-3" role="group">
                    <div class="toggle-container">
                      <div 
                        class="toggle-option {authMode === 'doctor' ? 'active' : 'inactive'}"
                        on:click={handleSwitchToDoctor}
                      >
                        <i class="fas fa-user-md me-2"></i>Doctor
                      </div>
                      <div 
                        class="toggle-option {authMode === 'pharmacist' ? 'active' : 'inactive'}"
                        on:click={handleSwitchToPharmacist}
                      >
                        <i class="fas fa-pills me-2"></i>Pharmacist
                      </div>
                    </div>
                  </div>
                </div>
                
                <!-- Auth Forms -->
                {#if authMode === 'doctor'}
                  <div class="auth-form-container">
                    <h3 class="text-center mb-4 fw-semibold text-dark">
                      <i class="fas fa-user-md text-primary me-2"></i>Doctor Portal
                    </h3>
                    <DoctorAuth on:user-authenticated={handleUserAuthenticated} />
                  </div>
                {:else}
                  <div class="auth-form-container">
                    <h3 class="text-center mb-4 fw-semibold text-dark">
                      <i class="fas fa-pills text-primary me-2"></i>Pharmacist Portal
                    </h3>
                    <PharmacistAuth 
                      on:pharmacist-login={handlePharmacistLogin}
                      on:switch-to-doctor={handleSwitchToDoctor}
                    />
                  </div>
                {/if}
                
                <!-- Footer -->
                <div class="text-center mt-4">
                  <small class="text-muted">
                    <i class="fas fa-shield-alt me-1"></i>
                    Secure • HIPAA Compliant • AI-Enhanced
                  </small>
                </div>
              </div>
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
  
  /* Stylish Login Page Styles */
  .bg-gradient-primary {
    background: linear-gradient(135deg, #0d6efd 0%, #0b5ed7 50%, #0a58ca 100%);
    min-height: 100vh;
  }
  
  .auth-card {
    backdrop-filter: blur(10px);
    background-color: rgba(255, 255, 255, 0.95);
    border: 1px solid rgba(255, 255, 255, 0.2);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
  }
  
  .auth-form-container {
    background: rgba(255, 255, 255, 0.5);
    border-radius: 1rem;
    padding: 1.5rem;
    margin: 0.5rem 0;
  }
  
  .btn-primary {
    background: linear-gradient(135deg, #0d6efd 0%, #0b5ed7 100%);
    border: none;
    transition: all 0.3s ease;
  }
  
  .btn-primary:hover {
    background: linear-gradient(135deg, #0b5ed7 0%, #0a58ca 100%);
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(13, 110, 253, 0.3);
  }
  
  .btn-outline-primary {
    border: 2px solid #0d6efd;
    color: #0d6efd;
    transition: all 0.3s ease;
  }
  
  .btn-outline-primary:hover {
    background: #0d6efd;
    border-color: #0d6efd;
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(13, 110, 253, 0.3);
  }
  
  .form-control {
    transition: all 0.3s ease;
    border-radius: 0.5rem;
  }
  
  .form-control:focus {
    border-color: #0d6efd;
    box-shadow: 0 0 0 0.2rem rgba(13, 110, 253, 0.25);
    transform: translateY(-1px);
  }
  
  .rounded-4 {
    border-radius: 1rem !important;
  }
  
  .rounded-3 {
    border-radius: 0.75rem !important;
  }
  
  /* Single Toggle Button Styles */
  .single-toggle-button {
    background: #e9ecef;
    border: 2px solid #dee2e6;
    border-radius: 0.75rem;
    overflow: hidden;
    transition: all 0.3s ease;
  }
  
  .toggle-container {
    display: flex;
    width: 100%;
    height: 100%;
  }
  
  .toggle-option {
    flex: 1;
    padding: 0.75rem 1rem;
    text-align: center;
    cursor: pointer;
    transition: all 0.3s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 500;
    border-radius: 0.5rem;
    margin: 0.125rem;
  }
  
  .toggle-option.active {
    background: linear-gradient(135deg, #0d6efd 0%, #0b5ed7 100%);
    color: white;
    box-shadow: 0 2px 8px rgba(13, 110, 253, 0.3);
    transform: translateY(-1px);
  }
  
  .toggle-option.inactive {
    background: transparent;
    color: #6c757d;
    border: none;
  }
  
  .toggle-option.inactive:hover {
    background: rgba(13, 110, 253, 0.1);
    color: #0d6efd;
  }
  
  .toggle-option i {
    transition: all 0.3s ease;
  }
  
  .toggle-option.active i {
    color: white;
  }
  
  .toggle-option.inactive i {
    color: #6c757d;
  }
  
  .toggle-option.inactive:hover i {
    color: #0d6efd;
  }
  
  /* Responsive adjustments */
  @media (max-width: 1200px) {
    .col-xl-5 {
      max-width: 50%;
    }
  }
  
  @media (max-width: 992px) {
    .col-lg-6 {
      max-width: 60%;
    }
    
    .auth-card .card-body {
      padding: 2rem !important;
    }
  }
  
  @media (max-width: 768px) {
    .col-md-8 {
      max-width: 80%;
    }
    
    .auth-card {
      margin: 0.5rem;
      border-radius: 1rem !important;
    }
    
    .auth-card .card-body {
      padding: 1.5rem !important;
    }
    
    .auth-form-container {
      padding: 1rem;
      margin: 0.25rem 0;
    }
    
    .btn-group .btn {
      font-size: 0.9rem;
      padding: 0.5rem 0.75rem;
    }
    
    .toggle-option {
      padding: 0.6rem 0.8rem;
      font-size: 0.9rem;
    }
    
    .form-control {
      font-size: 0.95rem;
    }
    
    h1 {
      font-size: 1.75rem;
    }
    
    h3 {
      font-size: 1.25rem;
    }
  }
  
  @media (max-width: 576px) {
    .col-sm-10 {
      max-width: 95%;
    }
    
    .auth-card {
      margin: 0.25rem;
      border-radius: 0.75rem !important;
    }
    
    .auth-card .card-body {
      padding: 1rem !important;
    }
    
    .auth-form-container {
      padding: 0.75rem;
      margin: 0.125rem 0;
    }
    
    .btn-group .btn {
      font-size: 0.85rem;
      padding: 0.4rem 0.6rem;
    }
    
    .toggle-option {
      padding: 0.5rem 0.6rem;
      font-size: 0.85rem;
    }
    
    .form-control {
      font-size: 0.9rem;
      padding: 0.5rem 0.75rem;
    }
    
    h1 {
      font-size: 1.5rem;
    }
    
    h3 {
      font-size: 1.1rem;
    }
    
    .bg-primary.bg-opacity-10 {
      width: 60px !important;
      height: 60px !important;
    }
    
    .fa-2x {
      font-size: 1.5rem !important;
    }
    
    .fa-stethoscope {
      font-size: 1.25rem !important;
    }
  }
  
  @media (max-width: 400px) {
    .auth-card .card-body {
      padding: 0.75rem !important;
    }
    
    .auth-form-container {
      padding: 0.5rem;
    }
    
    .btn-group .btn {
      font-size: 0.8rem;
      padding: 0.35rem 0.5rem;
    }
    
    .toggle-option {
      padding: 0.4rem 0.5rem;
      font-size: 0.8rem;
    }
    
    .form-control {
      font-size: 0.85rem;
      padding: 0.4rem 0.6rem;
    }
    
    h1 {
      font-size: 1.25rem;
    }
    
    h3 {
      font-size: 1rem;
    }
    
    .bg-primary.bg-opacity-10 {
      width: 50px !important;
      height: 50px !important;
    }
    
    .fa-stethoscope {
      font-size: 1rem !important;
    }
  }
  
</style>
