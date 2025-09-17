<script>
  import { onMount, onDestroy } from 'svelte'
  import authService from './services/authService.js'
  import firebaseAuthService from './services/firebaseAuth.js'
  import adminAuthService from './services/adminAuthService.js'
  import aiTokenTracker from './services/aiTokenTracker.js'
  import firebaseStorage from './services/firebaseStorage.js'
  import DoctorAuth from './components/DoctorAuth.svelte'
  import PharmacistAuth from './components/PharmacistAuth.svelte'
  import PharmacistDashboard from './components/PharmacistDashboard.svelte'
  import PatientManagement from './components/PatientManagement.svelte'
  import AdminPanel from './components/AdminPanel.svelte'
  import EditProfile from './components/EditProfile.svelte'
  import NotificationContainer from './components/NotificationContainer.svelte'
  
  let user = null
  let loading = true
  let showAdminPanel = false
  let showEditProfileModal = false
  let doctorUsageStats = null
  let refreshInterval = null
  let authMode = 'doctor' // 'doctor' or 'pharmacist'
  let userJustUpdated = false // Flag to prevent Firebase from overriding recent updates
  
  onMount(() => {
    try {
      // Check for super admin auto-login first
      const superAdminEmail = 'senakahks@gmail.com'
      const urlParams = new URLSearchParams(window.location.search)
      const autoLogin = urlParams.get('auto-login')
      
      // Auto-login super admin if requested or if accessing from specific URL
      if (autoLogin === 'admin' || window.location.hash === '#admin') {
        console.log('🔐 Auto-logging in super admin:', superAdminEmail)
        this.autoLoginSuperAdmin(superAdminEmail)
        return
      }
      
      // Set up Firebase auth state listener
      const unsubscribe = firebaseAuthService.onAuthStateChanged(async (firebaseUser) => {
        console.log('🔥 FIREBASE AUTH LISTENER TRIGGERED!')
        console.log('Firebase auth state changed:', firebaseUser)
        console.log('User just updated flag:', userJustUpdated)
        
        // Don't override user data if it was just updated
        if (userJustUpdated) {
          console.log('Skipping Firebase auth update - user was just updated')
          userJustUpdated = false // Reset the flag
          return
        }
        
        if (firebaseUser) {
          console.log('✅ Received processed user from Firebase auth service:', firebaseUser.email)
          
          // Check if this is the super admin
          if (firebaseUser.email === superAdminEmail) {
            // Super admin should be treated as doctor with admin privileges
            user = {
              ...firebaseUser,
              role: 'doctor',
              isAdmin: true,
              firstName: firebaseUser.displayName?.split(' ')[0] || 'Super',
              lastName: firebaseUser.displayName?.split(' ').slice(1).join(' ') || 'Admin',
              name: firebaseUser.displayName || 'Super Admin',
              country: firebaseUser.country || 'Global',
              city: firebaseUser.city || 'System'
            }
            console.log('Super admin logged in as doctor with admin privileges:', user)
          } else if (firebaseUser.role === 'admin' && !firebaseUser.isAdmin) {
            // Handle regular admin user - check admin auth service
            const adminUser = adminAuthService.getCurrentAdmin()
            if (adminUser && adminUser.email === firebaseUser.email) {
              user = { ...firebaseUser, ...adminUser }
              console.log('Merged Firebase admin user:', user)
            } else {
              user = firebaseUser
              console.log('Using Firebase admin user:', firebaseUser)
            }
            // Don't automatically show admin panel - let user click admin button
          } else {
            // Regular user - preserve any local updates
            const localUser = authService.getCurrentUser()
            if (localUser && localUser.email === firebaseUser.email) {
              // Merge Firebase data with local user data to preserve updates
              // Prioritize local data for profile fields to prevent overwriting
              user = { 
                ...firebaseUser, 
                ...localUser,
                // Ensure profile data is preserved from local storage
                firstName: localUser.firstName || firebaseUser.firstName,
                lastName: localUser.lastName || firebaseUser.lastName,
                country: localUser.country || firebaseUser.country,
                city: localUser.city || firebaseUser.city,
                name: localUser.name || firebaseUser.name
              }
              console.log('Merged Firebase and local user data:', user)
              console.log('Preserved profile data - country:', user.country, 'city:', user.city)
            } else {
              user = firebaseUser
              console.log('Using Firebase user:', firebaseUser)
              
              // If Firebase user doesn't have complete profile data, fetch from database
              if (!firebaseUser.country || !firebaseUser.city || !firebaseUser.firstName) {
                console.log('Firebase user missing profile data, fetching from database...')
                try {
                  const doctorData = await firebaseStorage.getDoctorByEmail(firebaseUser.email)
                  if (doctorData) {
                    user = { ...firebaseUser, ...doctorData }
                    console.log('Updated user with database profile data:', user)
                  }
                } catch (error) {
                  console.error('Error fetching doctor profile data:', error)
                }
              }
            }
          }
        } else if (!user) {
          // No Firebase user, check local auth service
    user = authService.getCurrentUser()
    console.log('Current user in App:', user)
    console.log('User ID:', user?.id)
    console.log('User UID:', user?.uid)
    console.log('User email:', user?.email)
          console.log('User role:', user?.role)
          console.log('User country:', user?.country)
        }
      })
      
      // Store unsubscribe function for cleanup
      window.firebaseUnsubscribe = unsubscribe
      
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
  
  // Cleanup Firebase auth listener on destroy
  onDestroy(() => {
    if (window.firebaseUnsubscribe) {
      window.firebaseUnsubscribe()
      window.firebaseUnsubscribe = null
    }
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
      
      // Sign out from all services
      await authService.signOut()
      await firebaseAuthService.signOut()
      await adminAuthService.signOut()
      user = null
      doctorUsageStats = null
      showAdminPanel = false
    } catch (error) {
      console.error('Error signing out:', error)
    }
  }
  
  // Handle edit profile
  const handleEditProfile = async () => {
    console.log('App: Opening edit profile modal for user:', user)
    console.log('App: User firstName:', user?.firstName)
    console.log('App: User lastName:', user?.lastName)
    console.log('App: User country:', user?.country)
    console.log('App: User name:', user?.name)
    console.log('App: User displayName:', user?.displayName)
    console.log('App: User email:', user?.email)
    
    // If user doesn't have profile data, fetch it from database
    if (!user?.firstName || !user?.lastName || !user?.country) {
      console.log('App: User missing profile data, fetching from database...')
      try {
        const doctorData = await firebaseStorage.getDoctorByEmail(user.email)
        console.log('App: Retrieved doctor data from database:', doctorData)
        
        if (doctorData) {
          // Merge database data with current user - create new object reference
          user = {
            ...user,
            ...doctorData
          }
          console.log('App: Merged user data:', user)
          console.log('App: User firstName after merge:', user.firstName)
          console.log('App: User lastName after merge:', user.lastName)
          console.log('App: User country after merge:', user.country)
        }
      } catch (error) {
        console.error('App: Error fetching doctor data:', error)
      }
    }
    
    showEditProfileModal = true
  }
  
  // Handle close edit profile modal
  const handleCloseEditProfile = () => {
    showEditProfileModal = false
  }
  
  // Handle profile update
  const handleProfileUpdate = (event) => {
    const updatedUser = event.detail
    console.log('App: Profile updated, new user data:', updatedUser)
    console.log('App: Updated user firstName:', updatedUser.firstName)
    console.log('App: Updated user lastName:', updatedUser.lastName)
    console.log('App: Updated user name:', updatedUser.name)
    console.log('App: Updated user country:', updatedUser.country)
    
    // Force reactive update by creating a new object reference
    user = { ...updatedUser }
    
    // Ensure authService also has the updated user
    authService.saveCurrentUser(updatedUser)
    
    // Set flag to prevent Firebase from overriding this update
    userJustUpdated = true
    
    // Close modal after a small delay to ensure UI updates
    setTimeout(() => {
      showEditProfileModal = false
    }, 100)
    
    console.log('App: Profile update complete, user firstName:', user.firstName)
    console.log('App: Profile update complete, user lastName:', user.lastName)
    console.log('App: Profile update complete, user name:', user.name)
    console.log('App: Profile update complete, user country:', user.country)
    console.log('App: Profile update complete, full user object:', user)
  }
  
  // Auto-login super admin
  const autoLoginSuperAdmin = async (email) => {
    try {
      console.log('🔐 Auto-logging in super admin:', email)
      
      // Create super admin user object
      const superAdminUser = {
        id: 'super-admin-001',
        email: email,
        role: 'doctor', // Super admin is treated as doctor
        isAdmin: true, // But has admin privileges
        firstName: 'Super',
        lastName: 'Admin',
        name: 'Super Admin',
        displayName: 'Super Admin',
        uid: 'super-admin-uid',
        provider: 'auto-login',
        country: 'Global',
        city: 'System',
        permissions: ['read_all', 'write_all', 'delete_all', 'manage_users', 'view_analytics'],
        createdAt: new Date().toISOString()
      }
      
      // Save to auth service
      authService.saveCurrentUser(superAdminUser)
      
      // Set user
      user = superAdminUser
      loading = false
      
      console.log('✅ Super admin auto-logged in:', superAdminUser)
    } catch (error) {
      console.error('❌ Error auto-logging in super admin:', error)
      loading = false
    }
  }

  // Handle admin panel access
  const handleAdminAccess = () => {
    console.log('🔍 Admin button clicked!')
    console.log('🔍 Current user:', user)
    console.log('🔍 User email:', user?.email)
    console.log('🔍 User isAdmin:', user?.isAdmin)
    console.log('🔍 User role:', user?.role)
    showAdminPanel = true
    console.log('🔍 showAdminPanel set to:', showAdminPanel)
  }
  
  // Handle back from admin panel
  const handleBackFromAdmin = () => {
    showAdminPanel = false
  }
  
  const handlePharmacistLogin = (pharmacistData) => {
    console.log('Pharmacist login event:', pharmacistData)
    console.log('Pharmacist login detail:', pharmacistData.detail)
    
    // Extract the actual pharmacist data from the event detail
    const pharmacist = pharmacistData.detail
    console.log('Extracted pharmacist data:', pharmacist)
    
    // Ensure the pharmacist data has the correct role
    user = {
      ...pharmacist,
      role: 'pharmacist'
    }
    console.log('Final user object:', user)
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
  $: if (user) {
    const userId = user?.id || user?.uid || user?.email || 'default-user'
    doctorUsageStats = aiTokenTracker.getDoctorUsageStats(userId)
    
    // Clear existing interval and set up new one
    if (refreshInterval) {
      clearInterval(refreshInterval)
    }
    
    refreshInterval = setInterval(() => {
      if (user) {
        const currentUserId = user?.id || user?.uid || user?.email || 'default-user'
        doctorUsageStats = aiTokenTracker.getDoctorUsageStats(currentUserId)
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
        <p class="text-muted">Loading M-Prescribe...</p>
      </div>
    </div>
  {:else if user}
    {#if showAdminPanel}
      <!-- Admin Panel (for super admin and regular admin users) -->
      <AdminPanel {user} on:back-to-app={handleBackFromAdmin} />
    {:else if user.role === 'pharmacist'}
      <!-- Pharmacist Dashboard -->
        <PharmacistDashboard pharmacist={user} />
    {:else}
    <!-- Doctor is logged in - Show patient management -->
    <nav class="navbar navbar-expand-lg navbar-dark bg-primary">
        <div class="container-fluid px-2 px-md-3">
        <span class="navbar-brand">
            <i class="fas fa-user-md me-1 me-md-2"></i>
            <span class="d-none d-sm-inline">M-Prescribe</span>
            <span class="d-sm-none">M-P</span>
          </span>
          
          <!-- Mobile Toggle Button -->
          <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav" aria-controls="navbarNav" aria-expanded="false" aria-label="Toggle navigation">
            <span class="navbar-toggler-icon"></span>
          </button>
          
          <!-- Navbar Content -->
          <div class="collapse navbar-collapse" id="navbarNav">
            <!-- Desktop Layout -->
            <div class="d-none d-lg-flex align-items-center ms-auto">
              <!-- User Info -->
              <div class="navbar-text me-3 d-flex align-items-center">
                <i class="fas fa-user me-2"></i>
                <span class="me-3">Dr. {user?.firstName && user?.lastName ? `${user.firstName} ${user.lastName}` : user?.firstName || user?.name || user?.email || 'Doctor'}</span>
                
                <!-- AI Health Bar - Progress Bar -->
                <div class="d-flex align-items-center me-3">
                  <i class="fas fa-robot me-2 text-white"></i>
                  <div class="progress bg-danger border border-light" style="width: 120px; height: 20px;" title="AI Token Usage: {doctorUsageStats?.today?.tokens?.toLocaleString() || '0'} / 100,000 tokens">
                    <div class="progress-bar bg-white progress-bar-striped progress-bar-animated" 
                         role="progressbar" 
                         style="width: {Math.min((doctorUsageStats?.today?.tokens || 0) / 100000 * 100, 100)}%"
                         aria-valuenow="{doctorUsageStats?.today?.tokens || 0}" 
                         aria-valuemin="0" 
                         aria-valuemax="100000">
                      <span class="text-dark fw-bold" style="font-size: 0.7rem;">
                        {Math.round((doctorUsageStats?.today?.tokens || 0) / 100000 * 100)}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              
              <!-- Action Buttons -->
              <button class="btn btn-outline-light btn-sm me-2" on:click={handleEditProfile}>
                <i class="fas fa-user-edit me-1"></i>
                Edit Profile
              </button>
              {#if user.isAdmin || user.email === 'senakahks@gmail.com'}
                <button class="btn btn-outline-light btn-sm me-2" on:click={handleAdminAccess}>
                  <i class="fas fa-shield-alt me-1"></i>
                  Admin
                </button>
              {/if}
              <button class="btn btn-outline-light btn-sm" on:click={handleLogout}>
                <i class="fas fa-sign-out-alt me-1"></i>
                Logout
              </button>
            </div>
            
            <!-- Mobile Layout -->
            <div class="d-lg-none mt-2">
              <!-- User Info Row -->
              <div class="d-flex align-items-center mb-2">
                <i class="fas fa-user me-2"></i>
                <span class="text-light">Dr. {user?.firstName && user?.lastName ? `${user.firstName} ${user.lastName}` : user?.firstName || user?.name || user?.email || 'Doctor'}</span>
              </div>
              
              <!-- AI Health Bar Row -->
              <div class="d-flex align-items-center mb-3">
                <i class="fas fa-robot me-2 text-white"></i>
                <div class="progress bg-danger border border-light flex-grow-1" style="height: 18px;" title="AI Token Usage: {doctorUsageStats?.today?.tokens?.toLocaleString() || '0'} / 100,000 tokens">
                  <div class="progress-bar bg-white progress-bar-striped progress-bar-animated" 
                       role="progressbar" 
                       style="width: {Math.min((doctorUsageStats?.today?.tokens || 0) / 100000 * 100, 100)}%"
                       aria-valuenow="{doctorUsageStats?.today?.tokens || 0}" 
                       aria-valuemin="0" 
                       aria-valuemax="100000">
                    <span class="text-dark fw-bold" style="font-size: 0.65rem;">
                      {Math.round((doctorUsageStats?.today?.tokens || 0) / 100000 * 100)}%
                    </span>
                  </div>
                </div>
              </div>
              
              <!-- Action Buttons Row -->
              <div class="d-flex gap-2">
                <button class="btn btn-outline-light btn-sm flex-fill" on:click={handleEditProfile}>
                  <i class="fas fa-user-edit me-1"></i>
                  Edit
                </button>
                {#if user.isAdmin || user.email === 'senakahks@gmail.com'}
                  <button class="btn btn-outline-light btn-sm flex-fill" on:click={handleAdminAccess}>
                    <i class="fas fa-shield-alt me-1"></i>
                    Admin
                  </button>
                {/if}
                <button class="btn btn-outline-light btn-sm flex-fill" on:click={handleLogout}>
                  <i class="fas fa-sign-out-alt me-1"></i>
                  Exit
                </button>
              </div>
            </div>
          </div>
      </div>
    </nav>
    
    <div class="container-fluid mt-3 mt-md-4 px-3 px-md-4">
        <PatientManagement {user} key={user?.firstName && user?.lastName ? `${user.firstName}-${user.lastName}-${user.country}` : user?.email || 'default'} on:ai-usage-updated={refreshDoctorUsageStats} />
    </div>
    {/if}
  {:else}
    <!-- User is not logged in - Show Bootstrap 5 authentication -->
    <div class="min-vh-100 d-flex align-items-start justify-content-center bg-primary bg-gradient px-2 px-sm-3 px-md-4" style="padding-top: 2rem;">
      <div class="container-fluid">
    <div class="row justify-content-center">
          <div class="col-12 col-sm-11 col-md-10 col-lg-8 col-xl-6 col-xxl-5">
            <!-- Main Auth Card -->
            <div class="card shadow-lg border-0 rounded-3 rounded-md-4 overflow-hidden">
              <!-- Card Header -->
              <div class="card-header bg-white border-0 py-3 py-md-4">
                <div class="text-center">
                  <div class="mb-2 mb-md-3">
                    <div class="bg-primary bg-opacity-10 rounded-circle d-inline-flex align-items-center justify-content-center" style="width: 60px; height: 60px;">
                      <i class="fas fa-stethoscope fa-lg text-primary"></i>
                    </div>
                  </div>
                  <h1 class="card-title fw-bold text-dark mb-1 mb-md-2 fs-3 fs-md-2">M-Prescribe</h1>
                  <p class="text-muted mb-0 small d-none d-sm-block">AI-Powered Medical Prescription System</p>
                  <p class="text-muted mb-0 d-sm-none" style="font-size: 0.75rem;">AI-Powered Medical System</p>
                </div>
              </div>
              
              <!-- Card Body -->
              <div class="card-body p-3 p-md-4">
                <!-- Auth Mode Toggle -->
                <div class="mb-3 mb-md-4">
                  <div class="btn-group w-100" role="group" aria-label="Authentication mode">
                    <button 
                      type="button" 
                      class="btn {authMode === 'doctor' ? 'btn-primary' : 'btn-outline-primary'} flex-fill btn-sm btn-md"
                      on:click={handleSwitchToDoctor}
                    >
                      <i class="fas fa-user-md me-1 me-md-2"></i>
                      <span class="d-none d-sm-inline">Doctor</span>
                      <span class="d-sm-none">Dr.</span>
                    </button>
                    <button 
                      type="button" 
                      class="btn {authMode === 'pharmacist' ? 'btn-primary' : 'btn-outline-primary'} flex-fill btn-sm btn-md"
                      on:click={handleSwitchToPharmacist}
                    >
                      <i class="fas fa-pills me-1 me-md-2"></i>
                      <span class="d-none d-sm-inline">Pharmacist</span>
                      <span class="d-sm-none">Pharm.</span>
                    </button>
                  </div>
                </div>
                
                <!-- Auth Forms -->
                <div class="bg-light rounded-2 rounded-md-3 p-3 p-md-4">
                  {#if authMode === 'doctor'}
                    <div class="text-center mb-3 mb-md-4">
                      <h4 class="fw-semibold text-dark mb-0 fs-5 fs-md-4">
                        <i class="fas fa-user-md text-primary me-1 me-md-2"></i>
                        <span class="d-none d-sm-inline">Doctor Portal</span>
                        <span class="d-sm-none">Doctor</span>
                      </h4>
                    </div>
            <DoctorAuth on:user-authenticated={handleUserAuthenticated} />
                  {:else}
                    <div class="text-center mb-3 mb-md-4">
                      <h4 class="fw-semibold text-dark mb-0 fs-5 fs-md-4">
                        <i class="fas fa-pills text-primary me-1 me-md-2"></i>
                        <span class="d-none d-sm-inline">Pharmacist Portal</span>
                        <span class="d-sm-none">Pharmacist</span>
                      </h4>
                    </div>
                    <PharmacistAuth 
                      on:pharmacist-login={handlePharmacistLogin}
                      on:switch-to-doctor={handleSwitchToDoctor}
                    />
                  {/if}
                </div>
              </div>
              
              <!-- Card Footer -->
              <div class="card-footer bg-light border-0 py-2 py-md-3">
                <div class="text-center">
                  <small class="text-muted">
                    <i class="fas fa-shield-alt me-1"></i>
                    <span class="d-none d-sm-inline">Secure • HIPAA Compliant • AI-Enhanced</span>
                    <span class="d-sm-none">Secure • HIPAA • AI</span>
                  </small>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  {/if}
  
  <!-- Edit Profile Modal -->
  {#if showEditProfileModal}
    <EditProfile 
      {user} 
      on:profile-updated={handleProfileUpdate}
      on:profile-cancelled={handleCloseEditProfile}
    />
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
    background-color: var(--bs-primary) !important;
    display: flex !important;
    align-items: center !important;
  }
  
  nav .navbar-brand {
    font-size: 1.1rem !important;
    font-weight: 600 !important;
    color: var(--bs-white) !important;
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
  
  /* Bootstrap 5 styling only */
  
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
