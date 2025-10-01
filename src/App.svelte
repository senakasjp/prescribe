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
  import LoadingSpinner from './components/LoadingSpinner.svelte'
  import PrivacyPolicyModal from './components/PrivacyPolicyModal.svelte'
  
  let user = null
  let loading = true
  let showAdminPanel = false
  let showEditProfileModal = false
  let doctorUsageStats = null
  let doctorQuotaStatus = null
  let refreshInterval = null
  let authMode = 'doctor' // 'doctor' or 'pharmacist'
  let userJustUpdated = false // Flag to prevent Firebase from overriding recent updates
  let currentView = 'home' // Navigation state: 'home', 'patients', 'prescriptions', 'drugs', 'pharmacies', 'settings'
  let triggerOpenSettings = false // Trigger to open settings modal
  
  // Handle menu navigation
  const handleMenuNavigation = (view) => {
    currentView = view
  }
  
  // Handle settings click from menubar
  const handleSettingsClick = () => {
    triggerOpenSettings = true
  }
  
  // Reset settings trigger when modal is opened
  const handleSettingsOpened = () => {
    triggerOpenSettings = false
  }
  
  onMount(() => {
    try {
      // Initialize Flowbite components
      if (typeof window !== 'undefined' && window.Flowbite && typeof window.Flowbite.initDropdowns === 'function') {
        window.Flowbite.initDropdowns()
      }
      if (typeof window !== 'undefined' && window.Flowbite && typeof window.Flowbite.initCollapses === 'function') {
        window.Flowbite.initCollapses()
      }
      
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
      
      // Check for existing authentication state immediately to prevent login flash
      console.log('🔍 Checking for existing authentication state...')
      const existingUser = authService.getCurrentUser()
      if (existingUser) {
        console.log('✅ Found existing user in localStorage:', existingUser.email)
        console.log('🔍 User auth provider:', existingUser.authProvider)
        
        // For email/password users, prioritize local storage and skip Firebase auth listener
        if (existingUser.authProvider === 'email-password') {
          console.log('✅ Email/password user found, using local storage only')
          user = existingUser
          loading = false
          return // Skip Firebase auth listener for email/password users
        }
        
        // For Google users, still use Firebase auth listener for better sync
        user = existingUser
        loading = false
        console.log('✅ User loaded from localStorage, continuing with Firebase auth listener for sync')
      }
      
      // Set up Firebase auth state listener only if no localStorage user
      const unsubscribe = firebaseAuthService.onAuthStateChanged(async (firebaseUser) => {
        
        // If Firebase user is null, check localStorage as fallback
        if (!firebaseUser) {
          const localStorageUser = authService.getCurrentUser()
          if (localStorageUser) {
            console.log('No Firebase user but localStorage user exists, keeping localStorage user')
            user = localStorageUser
            loading = false
            return
          } else {
            console.log('No Firebase user and no localStorage user, clearing user')
            user = null
            loading = false
          return
          }
        }
        
        if (firebaseUser) {
          console.log('✅ Received processed user from Firebase auth service:', firebaseUser.email)
          
          // If we already have a user with the same email, don't override unless it's a significant update
          if (user && user.email === firebaseUser.email) {
            console.log('User already exists with same email, keeping existing user data')
            loading = false
            return
          }
          
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
          
          // Save the processed user to localStorage for persistence
          if (user) {
            authService.saveCurrentUser(user)
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
      
      // Load doctor's AI usage stats and quota status only for doctors
      if (user?.id && user?.role === 'doctor') {
        doctorUsageStats = aiTokenTracker.getDoctorUsageStats(user.id)
        doctorQuotaStatus = aiTokenTracker.getDoctorQuotaStatus(user.id)
      }
      
      console.log('Setting loading to false')
      loading = false
    } catch (error) {
      console.error('Error in onMount:', error)
      loading = false
    }
    
    // Fallback timeout to ensure loading is set to false (reduced from 2000ms to 1000ms)
    setTimeout(() => {
      if (loading) {
        console.log('Fallback: Setting loading to false')
    loading = false
      }
    }, 1000)
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
    console.log('🔐 handleUserAuthenticated called with:', event.detail)
    const authenticatedUser = event.detail
    
    // Ensure the user has the correct auth provider
    if (!authenticatedUser.authProvider) {
      authenticatedUser.authProvider = 'email-password' // Default for email/password auth
    }
    
    user = authenticatedUser
    loading = false
    
    console.log('✅ User authenticated and set:', user.email, 'Auth provider:', user.authProvider)
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
  
  // Privacy Policy Modal
  let privacyPolicyModal
  
  const openPrivacyPolicy = () => {
    if (privacyPolicyModal) {
      privacyPolicyModal.openModal()
    }
  }
  
  // Refresh doctor's AI usage stats (immediate refresh)
  const refreshDoctorUsageStats = () => {
    if (user?.id) {
      doctorUsageStats = aiTokenTracker.getDoctorUsageStats(user.id)
      doctorQuotaStatus = aiTokenTracker.getDoctorQuotaStatus(user.id)
      console.log('🔄 Doctor usage stats refreshed:', doctorUsageStats)
      console.log('🔄 Doctor quota status refreshed:', doctorQuotaStatus)
    }
  }

  // Reactive statement to update stats when user changes
  $: if (user) {
    const userId = user?.id || user?.uid || user?.email || 'default-user'
    doctorUsageStats = aiTokenTracker.getDoctorUsageStats(userId)
    doctorQuotaStatus = aiTokenTracker.getDoctorQuotaStatus(userId)
    
    // Clear existing interval and set up new one
    if (refreshInterval) {
      clearInterval(refreshInterval)
    }
    
    refreshInterval = setInterval(() => {
      if (user) {
        const currentUserId = user?.id || user?.uid || user?.email || 'default-user'
        doctorUsageStats = aiTokenTracker.getDoctorUsageStats(currentUserId)
        doctorQuotaStatus = aiTokenTracker.getDoctorQuotaStatus(currentUserId)
      }
    }, 30000)
  }


  // Cleanup on destroy
  onDestroy(() => {
    if (refreshInterval) {
      clearInterval(refreshInterval)
    }
  })
</script>

<main class="min-h-screen bg-gray-50">
  
  {#if showAdminPanel}
    <!-- Admin Panel -->
    <AdminPanel {user} on:back-to-app={handleBackFromAdmin} />
  {:else if loading}
    <LoadingSpinner 
      size="large" 
      color="teal" 
      text="Loading M-Prescribe..." 
      fullScreen={true}
    />
  {:else if user}
    {#if user.role === 'pharmacist'}
      <!-- Pharmacist Dashboard -->
      <PharmacistDashboard pharmacist={user} />
    {:else}
    <!-- Doctor is logged in - Show patient management -->
    <nav class="bg-teal-600 border-gray-200 dark:bg-gray-900">
      <div class="max-w-screen-xl flex flex-wrap items-center justify-between mx-auto p-4">
        <a href="/" class="flex items-center space-x-3 rtl:space-x-reverse">
          <i class="fas fa-user-md text-white text-xl"></i>
          <span class="self-center text-xl font-semibold whitespace-nowrap text-white">M-Prescribe</span>
        </a>
          
          <!-- Mobile Toggle Button -->
        <button 
          data-collapse-toggle="navbar-default" 
          type="button" 
          class="inline-flex items-center p-2 w-10 h-10 justify-center text-sm text-gray-500 rounded-lg md:hidden hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-200 dark:text-gray-400 dark:hover:bg-gray-700 dark:focus:ring-gray-600" 
          aria-controls="navbar-default" 
          aria-expanded="false"
        >
          <span class="sr-only">Open main menu</span>
          <svg class="w-5 h-5" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 17 14">
            <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M1 1h15M1 7h15M1 13h15"/>
          </svg>
          </button>
          
          <!-- Navbar Content -->
        <div class="hidden w-full md:block md:w-auto" id="navbar-default">
            <!-- Desktop Layout -->
          <div class="hidden lg:flex items-center space-x-4">
              <!-- User Info -->
            <div class="flex items-center space-x-3 text-white">
              <i class="fas fa-user"></i>
              <span class="text-sm font-medium">Dr. {user?.firstName && user?.lastName ? `${user.firstName} ${user.lastName}` : user?.firstName || user?.name || user?.email || 'Doctor'}</span>
              
              <!-- AI Health Bar - Tailwind Progress Bar -->
              <div class="flex items-center space-x-2">
                <i class="fas fa-brain text-white"></i>
                <div class="w-32 bg-gray-200 rounded-full h-2 dark:bg-gray-700" title="AI Token Usage: {doctorUsageStats?.today?.tokens?.toLocaleString() || '0'} / {doctorQuotaStatus?.quotaTokens?.toLocaleString() || 'No quota'} tokens">
                  <div class="h-2 rounded-full transition-all duration-300 ease-in-out {doctorQuotaStatus?.isExceeded ? 'bg-red-600' : doctorQuotaStatus?.percentageUsed > 80 ? 'bg-yellow-500' : 'bg-teal-500'}" 
                       style="width: {doctorQuotaStatus?.hasQuota ? Math.min(doctorQuotaStatus.percentageUsed, 100) : Math.min((doctorUsageStats?.today?.tokens || 0) / 100000 * 100, 100)}%">
                  </div>
                </div>
                <span class="text-xs text-white font-medium">
                  {doctorQuotaStatus?.hasQuota ? Math.round(doctorQuotaStatus.percentageUsed) : Math.round((doctorUsageStats?.today?.tokens || 0) / 100000 * 100)}%
                </span>
                </div>
              </div>
              
              <!-- Action Buttons -->
            <div class="flex items-center space-x-2">
              {#if user.isAdmin || user.email === 'senakahks@gmail.com'}
                <button 
                  type="button" 
                  class="text-white bg-teal-700 hover:bg-teal-800 focus:ring-4 focus:outline-none focus:ring-teal-300 font-medium rounded-lg text-sm px-3 py-2 text-center dark:bg-teal-600 dark:hover:bg-teal-700 dark:focus:ring-teal-800 transition-colors duration-200" 
                  on:click={handleAdminAccess}
                >
                  <i class="fas fa-shield-alt mr-1"></i>
                  Admin
                </button>
              {/if}
              <button 
                type="button" 
                class="text-white bg-gray-700 hover:bg-gray-800 focus:ring-4 focus:outline-none focus:ring-gray-300 font-medium rounded-lg text-sm px-3 py-2 text-center dark:bg-gray-600 dark:hover:bg-gray-700 dark:focus:ring-gray-800 transition-colors duration-200" 
                on:click={handleLogout}
              >
                <i class="fas fa-sign-out-alt mr-1"></i>
                Logout
              </button>
            </div>
            </div>
            
            <!-- Mobile Layout -->
          <div class="lg:hidden mt-4 space-y-3">
              <!-- User Info Row -->
            <div class="flex items-center space-x-2 text-white">
              <i class="fas fa-user"></i>
              <span class="text-sm">Dr. {user?.firstName && user?.lastName ? `${user.firstName} ${user.lastName}` : user?.firstName || user?.name || user?.email || 'Doctor'}</span>
              </div>
              
              <!-- AI Health Bar Row -->
            <div class="flex items-center space-x-2">
              <i class="fas fa-brain text-white"></i>
              <div class="flex-1 bg-gray-200 rounded-full h-2 dark:bg-gray-700" title="AI Token Usage: {doctorUsageStats?.today?.tokens?.toLocaleString() || '0'} / {doctorQuotaStatus?.quotaTokens?.toLocaleString() || 'No quota'} tokens">
                <div class="h-2 rounded-full transition-all duration-300 ease-in-out {doctorQuotaStatus?.isExceeded ? 'bg-red-600' : doctorQuotaStatus?.percentageUsed > 80 ? 'bg-yellow-500' : 'bg-teal-500'}" 
                     style="width: {doctorQuotaStatus?.hasQuota ? Math.min(doctorQuotaStatus.percentageUsed, 100) : Math.min((doctorUsageStats?.today?.tokens || 0) / 100000 * 100, 100)}%">
                </div>
              </div>
              <span class="text-xs text-white font-medium">
                {doctorQuotaStatus?.hasQuota ? Math.round(doctorQuotaStatus.percentageUsed) : Math.round((doctorUsageStats?.today?.tokens || 0) / 100000 * 100)}%
              </span>
              </div>
              
              <!-- Action Buttons Row -->
            <div class="flex space-x-2">
                {#if user.isAdmin || user.email === 'senakahks@gmail.com'}
                <button 
                  type="button" 
                  class="flex-1 text-white bg-teal-700 hover:bg-teal-800 focus:ring-4 focus:outline-none focus:ring-teal-300 font-medium rounded-lg text-sm px-3 py-2 text-center dark:bg-teal-600 dark:hover:bg-teal-700 dark:focus:ring-teal-800 transition-colors duration-200" 
                  on:click={handleAdminAccess}
                >
                  <i class="fas fa-shield-alt mr-1"></i>
                    Admin
                  </button>
                {/if}
              <button 
                type="button" 
                class="flex-1 text-white bg-gray-700 hover:bg-gray-800 focus:ring-4 focus:outline-none focus:ring-gray-300 font-medium rounded-lg text-sm px-3 py-2 text-center dark:bg-gray-600 dark:hover:bg-gray-700 dark:focus:ring-gray-800 transition-colors duration-200" 
                on:click={handleLogout}
              >
                <i class="fas fa-sign-out-alt mr-1"></i>
                  Exit
                </button>
              </div>
            </div>
          </div>
      </div>
    </nav>
    
    <!-- Menubar under header -->
    <nav class="bg-white border-b border-gray-200 dark:bg-gray-800 dark:border-gray-700">
      <div class="max-w-screen-xl mx-auto px-2 sm:px-4">
        <div class="flex items-center h-12">
          <!-- Menu Items - Responsive -->
          <div class="flex-1 overflow-x-auto">
            <ul class="flex space-x-1 text-sm font-medium whitespace-nowrap">
              <li>
                <button 
                  type="button"
                  class="px-2 sm:px-4 py-2 rounded-lg transition-colors duration-200 {currentView === 'home' ? 'text-teal-600 bg-teal-50 font-semibold dark:text-teal-400 dark:bg-teal-900' : 'text-gray-700 hover:text-teal-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:text-teal-400 dark:hover:bg-gray-700'}"
                  on:click={() => handleMenuNavigation('home')}
                >
                  <i class="fas fa-home mr-1 sm:mr-2"></i>
                  <span class="hidden xs:inline">Home</span>
                </button>
              </li>
              <li>
                <button 
                  type="button"
                  class="px-2 sm:px-4 py-2 rounded-lg transition-colors duration-200 {currentView === 'patients' ? 'text-teal-600 bg-teal-50 font-semibold dark:text-teal-400 dark:bg-teal-900' : 'text-gray-700 hover:text-teal-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:text-teal-400 dark:hover:bg-gray-700'}"
                  on:click={() => handleMenuNavigation('patients')}
                >
                  <i class="fas fa-users mr-1 sm:mr-2"></i>
                  <span class="hidden xs:inline">Patients</span>
                </button>
              </li>
              <li>
                <button 
                  type="button"
                  class="px-2 sm:px-4 py-2 rounded-lg transition-colors duration-200 {currentView === 'prescriptions' ? 'text-teal-600 bg-teal-50 font-semibold dark:text-teal-400 dark:bg-teal-900' : 'text-gray-700 hover:text-teal-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:text-teal-400 dark:hover:bg-gray-700'}"
                  on:click={() => handleMenuNavigation('prescriptions')}
                >
                  <i class="fas fa-prescription-bottle-alt mr-1 sm:mr-2"></i>
                  <span class="hidden sm:inline">Prescriptions</span>
                  <span class="sm:hidden hidden xs:inline">Rx</span>
                </button>
              </li>
              <li>
                <button 
                  type="button"
                  class="px-2 sm:px-4 py-2 rounded-lg transition-colors duration-200 {currentView === 'drugs' ? 'text-teal-600 bg-teal-50 font-semibold dark:text-teal-400 dark:bg-teal-900' : 'text-gray-700 hover:text-teal-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:text-teal-400 dark:hover:bg-gray-700'}"
                  on:click={() => handleMenuNavigation('drugs')}
                >
                  <i class="fas fa-pills mr-1 sm:mr-2"></i>
                  <span class="hidden xs:inline">Drugs</span>
                </button>
              </li>
              <li>
                <button 
                  type="button"
                  class="px-2 sm:px-4 py-2 rounded-lg transition-colors duration-200 {currentView === 'pharmacies' ? 'text-teal-600 bg-teal-50 font-semibold dark:text-teal-400 dark:bg-teal-900' : 'text-gray-700 hover:text-teal-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:text-teal-400 dark:hover:bg-gray-700'}"
                  on:click={() => handleMenuNavigation('pharmacies')}
                >
                  <i class="fas fa-store mr-1 sm:mr-2"></i>
                  <span class="hidden sm:inline">Pharmacies</span>
                  <span class="sm:hidden hidden xs:inline">Pharm</span>
                </button>
              </li>
              <li>
                <button 
                  type="button"
                  class="px-2 sm:px-4 py-2 rounded-lg transition-colors duration-200 text-gray-700 hover:text-teal-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:text-teal-400 dark:hover:bg-gray-700"
                  on:click={handleSettingsClick}
                >
                  <i class="fas fa-user-cog mr-1 sm:mr-2"></i>
                  <span class="hidden xs:inline">Settings</span>
                </button>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </nav>
    
    <div class="p-4">
        <PatientManagement 
          {user} 
          {currentView}
          openSettings={triggerOpenSettings}
          key={user?.firstName && user?.lastName ? `${user.firstName}-${user.lastName}-${user.country}` : user?.email || 'default'} 
          on:ai-usage-updated={refreshDoctorUsageStats} 
          on:profile-updated={handleProfileUpdate}
          on:view-change={(e) => handleMenuNavigation(e.detail)}
          on:settings-opened={handleSettingsOpened}
        />
    </div>
    {/if}
  {:else}
    <!-- User is not logged in - Show Flowbite authentication -->
    <div class="min-h-screen flex items-start justify-center bg-teal-600 px-4 pt-8">
      <div class="w-full max-w-md">
            <!-- Main Auth Card -->
        <div class="bg-white rounded-lg shadow-xl overflow-hidden">
              <!-- Card Header -->
          <div class="bg-white px-6 py-8">
                <div class="text-center">
              <div class="mb-4">
                <div class="inline-flex items-center justify-center w-16 h-16 bg-teal-100 rounded-full">
                  <i class="fas fa-stethoscope text-teal-600 text-xl"></i>
                </div>
              </div>
              <h1 class="text-2xl font-bold text-gray-900 mb-2">M-Prescribe</h1>
              <p class="text-gray-600 text-sm hidden sm:block">AI-Powered Medical Prescription System</p>
              <p class="text-gray-600 text-xs sm:hidden">AI-Powered Medical System</p>
                </div>
              </div>
              
              <!-- Card Body -->
          <div class="px-6 pb-6">
                <!-- Auth Mode Toggle -->
            <div class="mb-6">
              <div class="flex rounded-lg border border-gray-200 bg-gray-100 p-1 w-full" role="group" aria-label="Authentication mode">
                    <button 
                      type="button" 
                  class="flex-1 flex items-center justify-center px-6 py-3 text-sm font-medium rounded-md transition-all duration-200 {authMode === 'doctor' ? 'bg-white text-teal-600 shadow-sm' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}"
                      on:click={handleSwitchToDoctor}
                    >
                  <i class="fas fa-user-md mr-2"></i>
                  <span class="hidden sm:inline">Doctor</span>
                  <span class="sm:hidden">Dr.</span>
                    </button>
                    <button 
                      type="button" 
                  class="flex-1 flex items-center justify-center px-6 py-3 text-sm font-medium rounded-md transition-all duration-200 {authMode === 'pharmacist' ? 'bg-white text-teal-600 shadow-sm' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}"
                      on:click={handleSwitchToPharmacist}
                    >
                  <i class="fas fa-pills mr-2"></i>
                  <span class="hidden sm:inline">Pharmacist</span>
                  <span class="sm:hidden">Pharm.</span>
                    </button>
                  </div>
                </div>
                
                <!-- Auth Forms -->
            <div class="bg-gray-50 rounded-lg p-4">
                  {#if authMode === 'doctor'}
                <div class="text-center mb-4">
                  <h4 class="text-lg font-semibold text-gray-900 mb-0">
                    <i class="fas fa-user-md text-teal-600 mr-2"></i>
                    <span class="hidden sm:inline">Doctor Portal</span>
                    <span class="sm:hidden">Doctor</span>
                      </h4>
                    </div>
            <DoctorAuth on:user-authenticated={handleUserAuthenticated} />
                  {:else}
                <div class="text-center mb-4">
                  <h4 class="text-lg font-semibold text-gray-900 mb-0">
                    <i class="fas fa-pills text-teal-600 mr-2"></i>
                    <span class="hidden sm:inline">Pharmacist Portal</span>
                    <span class="sm:hidden">Pharmacist</span>
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
          <div class="bg-gray-50 px-6 py-3">
            <div class="text-center space-y-2">
              <small class="text-gray-500">
                <i class="fas fa-shield-alt mr-1"></i>
                <span class="hidden sm:inline">Secure • HIPAA Compliant • AI-Enhanced</span>
                <span class="sm:hidden">Secure • HIPAA • AI</span>
              </small>
                <div class="text-center">
                <button 
                  type="button"
                  class="text-xs text-blue-600 hover:text-blue-800 underline focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 rounded"
                  on:click={openPrivacyPolicy}
                >
                  <i class="fas fa-file-shield mr-1"></i>
                  Privacy Policy
                </button>
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
  
  <!-- Privacy Policy Modal -->
  <PrivacyPolicyModal bind:this={privacyPolicyModal} />
</main>

<style>
  /* Custom styles for Flowbite components */
  :global(body) {
    margin: 0;
    padding: 0;
    font-family: 'Inter', system-ui, sans-serif;
  }
  
  
</style>
