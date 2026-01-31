<script>
  import { onMount, onDestroy } from 'svelte'
  import doctorAuthService from './services/doctor/doctorAuthService.js'
  import pharmacistAuthService from './services/pharmacist/pharmacistAuthService.js'
  import firebaseAuthService from './services/firebaseAuth.js'
  import adminAuthService from './services/adminAuthService.js'
  import aiTokenTracker from './services/aiTokenTracker.js'
  import firebaseStorage from './services/firebaseStorage.js'
  import DoctorAuth from './components/DoctorAuth.svelte'
  import PharmacistAuth from './components/PharmacistAuth.svelte'
  import PharmacistDashboard from './components/PharmacistDashboard.svelte'
  import PatientManagement from './components/PatientManagement.svelte'
  import AdminPanel from './components/AdminPanel.svelte'
  import SettingsPage from './components/SettingsPage.svelte'
  import ReportsDashboard from './components/ReportsDashboard.svelte'
  import DoctorGettingStarted from './components/DoctorGettingStarted.svelte'
  import NotificationContainer from './components/NotificationContainer.svelte'
  import LoadingSpinner from './components/LoadingSpinner.svelte'
  import PrivacyPolicyModal from './components/PrivacyPolicyModal.svelte'
  import BrandName from './components/BrandName.svelte'
  import PrivacyPolicyPage from './components/PrivacyPolicyPage.svelte'
  import ContactPage from './components/ContactPage.svelte'
  import HelpPage from './components/HelpPage.svelte'
  import FaqPage from './components/FaqPage.svelte'
  import PricingPage from './components/PricingPage.svelte'
  import RegisterPage from './components/RegisterPage.svelte'
  import PublicHeader from './components/PublicHeader.svelte'
  import { resolveCurrencyFromCountry } from './utils/currencyByCountry.js'
  
  let user = null
  let loading = true
  let showAdminPanel = false
  const ADMIN_PANEL_STORAGE_KEY = 'prescribe-admin-panel-active'
  let doctorUsageStats = null
  let doctorQuotaStatus = null
  let refreshInterval = null
  let tawkScriptLoaded = false
  let authMode = 'doctor' // 'doctor' or 'pharmacist'
  let authOnly = false
  let privacyOnly = false
  let contactOnly = false
  let helpOnly = false
  let faqOnly = false
  let pricingOnly = false
  let userJustUpdated = false // Flag to prevent Firebase from overriding recent updates
  let currentView = 'home' // Navigation state: 'home', 'patients', 'pharmacies', 'reports', 'settings'
  let settingsDoctor = null
  $: effectiveCurrency = settingsDoctor?.currency
    || user?.currency
    || resolveCurrencyFromCountry(settingsDoctor?.country || user?.country || user?.doctorCountry)
    || 'USD'

  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search)
    authOnly = params.get('register') === '1'
    privacyOnly = params.get('privacy') === '1'
    contactOnly = params.get('contact') === '1'
    helpOnly = params.get('help') === '1'
    faqOnly = params.get('faq') === '1'
    pricingOnly = params.get('pricing') === '1'
  }

  const shouldEnableChat = () => {
    return contactOnly || helpOnly || (user && currentView === 'help')
  }

  const loadTawkScript = () => {
    if (typeof document === 'undefined' || tawkScriptLoaded) {
      return
    }
    const existingScript = document.querySelector('script[src="https://embed.tawk.to/697b33bd435d921c378e9c20/1jg4k483e"]')
    if (existingScript) {
      tawkScriptLoaded = true
      return
    }
    window.Tawk_API = window.Tawk_API || {}
    window.Tawk_LoadStart = new Date()
    const script = document.createElement('script')
    const firstScript = document.getElementsByTagName('script')[0]
    script.async = true
    script.src = 'https://embed.tawk.to/697b33bd435d921c378e9c20/1jg4k483e'
    script.charset = 'UTF-8'
    script.setAttribute('crossorigin', '*')
    script.onload = () => {
      tawkScriptLoaded = true
      if (window.__tawkOpenOnLoad && window.Tawk_API && typeof window.Tawk_API.maximize === 'function') {
        window.Tawk_API.maximize()
        window.__tawkOpenOnLoad = false
      }
    }
    if (firstScript && firstScript.parentNode) {
      firstScript.parentNode.insertBefore(script, firstScript)
    } else {
      document.body.appendChild(script)
    }
  }

  const showChatWidget = () => {
    if (typeof window !== 'undefined' && window.Tawk_API && typeof window.Tawk_API.showWidget === 'function') {
      window.Tawk_API.showWidget()
    }
  }

  const hideChatWidget = () => {
    if (typeof window !== 'undefined' && window.Tawk_API && typeof window.Tawk_API.hideWidget === 'function') {
      window.Tawk_API.hideWidget()
    }
  }
  
  $: isExternalDoctor = user?.role === 'doctor' && user?.externalDoctor && user?.invitedByDoctorId
  $: effectiveUser = isExternalDoctor && settingsDoctor
    ? { ...user, country: settingsDoctor?.country, city: settingsDoctor?.city }
    : user

  const loadSettingsDoctor = async () => {
    try {
      if (!user) {
        settingsDoctor = null
        return
      }

      if (isExternalDoctor) {
        settingsDoctor = await firebaseStorage.getDoctorById(user.invitedByDoctorId)
        return
      }

      if (user?.email) {
        settingsDoctor = await firebaseStorage.getDoctorByEmail(user.email)
        return
      }

      settingsDoctor = user
    } catch (error) {
      console.warn('⚠️ App.svelte: Failed to load settings doctor:', error)
      settingsDoctor = user || null
    }
  }

  $: if (user?.email) {
    loadSettingsDoctor()
  }

  const canAccessAdminPanel = (currentUser) => {
    return !!(currentUser && (currentUser.isAdmin || currentUser.role === 'admin' || currentUser.email === 'senakahks@gmail.com'))
  }

  $: if (user) {
    const storedAdminPanel = localStorage.getItem(ADMIN_PANEL_STORAGE_KEY) === 'true'
    if (storedAdminPanel && canAccessAdminPanel(user) && !showAdminPanel) {
      showAdminPanel = true
    } else if (!canAccessAdminPanel(user) && showAdminPanel) {
      showAdminPanel = false
      localStorage.removeItem(ADMIN_PANEL_STORAGE_KEY)
    }
  }
  
  // Handle menu navigation
  const handleMenuNavigation = async (view) => {
    console.log('🔍 App.svelte: handleMenuNavigation called with view:', view)
    currentView = view === 'prescriptions' ? 'patients' : view
  }
  
  // Handle settings click from menubar
  const handleSettingsClick = () => {
    if (isExternalDoctor) {
      return
    }
    currentView = 'settings'
  }
  
  $: if (currentView === 'settings' && isExternalDoctor) {
    currentView = 'home'
  }

  $: if (currentView === 'reports' && isExternalDoctor) {
    currentView = 'home'
  }
  
  
  // Force cache refresh for v2.2.7 with timestamp
  if (typeof window !== 'undefined') {
    window.appVersion = '2.2.24'
    window.buildTime = new Date().toISOString()
        console.log('🚀 M-Prescribe v2.2.24 loaded with doctor profile save fix!')
    console.log('📅 Build Time:', window.buildTime)
    console.log('🔄 Cache bust timestamp:', Date.now())
  }
  
  onMount(async () => {
    console.log('🚀 App.svelte: onMount called!')
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
      
      // Check decoupled auth services first
      const existingDoctor = doctorAuthService.getCurrentDoctor()
      const existingPharmacist = pharmacistAuthService.getCurrentPharmacist()
      const existingAdmin = adminAuthService.getCurrentAdmin()
      
      let existingUser = null
      if (existingDoctor) {
        existingUser = existingDoctor
        console.log('✅ Found existing doctor in localStorage:', existingUser.email)
      } else if (existingPharmacist) {
        existingUser = existingPharmacist
        console.log('✅ Found existing pharmacist in localStorage:', existingUser.email)
      } else if (existingAdmin) {
        existingUser = existingAdmin
        console.log('✅ Found existing admin in localStorage:', existingUser.email)
      }
      
      if (existingUser) {
        console.log('🔍 User auth provider:', existingUser.authProvider)
        
        // For email/password users, prioritize local storage and skip Firebase auth listener
        if (existingUser.authProvider === 'email-password' && !existingUser.uid) {
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
          // Check decoupled auth services as fallback
          const fallbackDoctor = doctorAuthService.getCurrentDoctor()
          const fallbackPharmacist = pharmacistAuthService.getCurrentPharmacist()
          const fallbackAdmin = adminAuthService.getCurrentAdmin()
          
          let localStorageUser = null
          if (fallbackDoctor) {
            localStorageUser = fallbackDoctor
          } else if (fallbackPharmacist) {
            localStorageUser = fallbackPharmacist
          } else if (fallbackAdmin) {
            localStorageUser = fallbackAdmin
          }
          
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
            // Check decoupled auth services for local user data
            const localDoctor = doctorAuthService.getCurrentDoctor()
            const localPharmacist = pharmacistAuthService.getCurrentPharmacist()
            const localAdmin = adminAuthService.getCurrentAdmin()
            
            let localUser = null
            if (localDoctor && localDoctor.email === firebaseUser.email) {
              localUser = localDoctor
            } else if (localPharmacist && localPharmacist.email === firebaseUser.email) {
              localUser = localPharmacist
            } else if (localAdmin && localAdmin.email === firebaseUser.email) {
              localUser = localAdmin
            }
            
            if (localUser) {
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
            // Save to appropriate decoupled service based on role
            if (user.role === 'doctor') {
              doctorAuthService.saveCurrentDoctor(user)
            } else if (user.role === 'pharmacist') {
              pharmacistAuthService.saveCurrentPharmacist(user)
            } else if (user.role === 'admin') {
              adminAuthService.saveCurrentAdmin(user)
            }
          }
        } else if (!user) {
          // No Firebase user, check decoupled auth services
          const fallbackDoctor = doctorAuthService.getCurrentDoctor()
          const fallbackPharmacist = pharmacistAuthService.getCurrentPharmacist()
          const fallbackAdmin = adminAuthService.getCurrentAdmin()
          
          if (fallbackDoctor) {
            user = fallbackDoctor
          } else if (fallbackPharmacist) {
            user = fallbackPharmacist
          } else if (fallbackAdmin) {
            user = fallbackAdmin
          }
          
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
    
    // Save to appropriate decoupled service based on role
    if (authenticatedUser.role === 'doctor') {
      doctorAuthService.saveCurrentDoctor(authenticatedUser)
    } else if (authenticatedUser.role === 'pharmacist') {
      pharmacistAuthService.saveCurrentPharmacist(authenticatedUser)
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
      
      // Sign out from appropriate decoupled service based on user role
      if (user?.role === 'doctor') {
        await doctorAuthService.signOutDoctor()
      } else if (user?.role === 'pharmacist') {
        await pharmacistAuthService.signOutPharmacist()
      } else {
        // Fallback to original services
        await adminAuthService.signOut()
      }
      // Always sign out of Firebase auth to prevent session restore on refresh
      await firebaseAuthService.signOut()
      await adminAuthService.signOut()
      
      user = null
      doctorUsageStats = null
      showAdminPanel = false
      localStorage.removeItem(ADMIN_PANEL_STORAGE_KEY)
      localStorage.removeItem('prescribe-current-doctor')
      localStorage.removeItem('prescribe-current-pharmacist')
      localStorage.removeItem('prescribe-current-user')
      localStorage.removeItem('prescribe-current-admin')
      if (typeof window !== 'undefined') {
        window.location.href = '/'
      }
    } catch (error) {
      console.error('Error signing out:', error)
    }
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
    
    // Save updated user to appropriate decoupled service
    if (updatedUser.role === 'doctor') {
      doctorAuthService.saveCurrentDoctor(updatedUser)
    } else if (updatedUser.role === 'pharmacist') {
      pharmacistAuthService.saveCurrentPharmacist(updatedUser)
    } else if (updatedUser.role === 'admin') {
      adminAuthService.saveCurrentAdmin(updatedUser)
    }
    
    // Set flag to prevent Firebase from overriding this update
    userJustUpdated = true
    
    console.log('App: Profile update complete, user firstName:', user.firstName)
    console.log('App: Profile update complete, user lastName:', user.lastName)
    console.log('App: Profile update complete, user name:', user.name)
    console.log('App: Profile update complete, user country:', user.country)
    console.log('App: Profile update complete, full user object:', user)
  }

  // Handle user update from SettingsPage
  const handleUserUpdate = (event) => {
    const { user: updatedUser } = event.detail
    
    // Force reactive update by creating a new object reference
    user = { ...updatedUser }
    
    // Save updated user to appropriate decoupled service
    if (updatedUser.role === 'doctor') {
      doctorAuthService.saveCurrentDoctor(updatedUser)
    } else if (updatedUser.role === 'pharmacist') {
      pharmacistAuthService.saveCurrentPharmacist(updatedUser)
    } else if (updatedUser.role === 'admin') {
      adminAuthService.saveCurrentAdmin(updatedUser)
    }
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
      
      // Save to appropriate decoupled service
      doctorAuthService.saveCurrentDoctor(superAdminUser)
      
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
    localStorage.setItem(ADMIN_PANEL_STORAGE_KEY, 'true')
    console.log('🔍 showAdminPanel set to:', showAdminPanel)
  }
  
  // Handle back from admin panel
  const handleBackFromAdmin = () => {
    showAdminPanel = false
    localStorage.removeItem(ADMIN_PANEL_STORAGE_KEY)
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
    
    // Save to decoupled pharmacist service
    pharmacistAuthService.saveCurrentPharmacist(user)
    
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
    if (user) {
      const userId = user?.id || user?.uid || user?.email || 'default-user'
      console.log('🔄 Manual refresh - using user ID:', userId)
      doctorUsageStats = aiTokenTracker.getDoctorUsageStats(userId)
      doctorQuotaStatus = aiTokenTracker.getDoctorQuotaStatus(userId)
      console.log('🔄 Doctor usage stats refreshed:', doctorUsageStats)
      console.log('🔄 Doctor quota status refreshed:', doctorQuotaStatus)
    }
  }

  // Reactive statement to update stats when user changes
  $: if (user) {
    // Use consistent ID determination logic that matches what's used in components
    const userId = user?.id || user?.uid || user?.email || 'default-user'
    console.log('🔄 Updating doctor usage stats for user ID:', userId)
    console.log('🔄 User object:', user)
    
    doctorUsageStats = aiTokenTracker.getDoctorUsageStats(userId)
    doctorQuotaStatus = aiTokenTracker.getDoctorQuotaStatus(userId)
    
    console.log('🔄 Doctor usage stats:', doctorUsageStats)
    console.log('🔄 Doctor quota status:', doctorQuotaStatus)
    
    // Clear existing interval and set up new one
    if (refreshInterval) {
      clearInterval(refreshInterval)
    }
    
    refreshInterval = setInterval(() => {
      if (user) {
        const currentUserId = user?.id || user?.uid || user?.email || 'default-user'
        console.log('🔄 Interval refresh - updating stats for user ID:', currentUserId)
        doctorUsageStats = aiTokenTracker.getDoctorUsageStats(currentUserId)
        doctorQuotaStatus = aiTokenTracker.getDoctorQuotaStatus(currentUserId)
        console.log('🔄 Interval refresh - updated stats:', doctorUsageStats)
      }
    }, 30000)
  }


  // Listen for AI usage updates to refresh stats immediately
  const handleAIUsageUpdate = (event) => {
    console.log('🔄 AI usage updated, refreshing stats immediately')
    refreshDoctorUsageStats()
  }

  // Cleanup on destroy
  onDestroy(() => {
    if (refreshInterval) {
      clearInterval(refreshInterval)
    }
  })

  $: if (typeof window !== 'undefined') {
    if (shouldEnableChat()) {
      loadTawkScript()
      showChatWidget()
    } else {
      hideChatWidget()
    }
  }
</script>

<main class="min-h-screen bg-gray-50" on:ai-usage-updated={handleAIUsageUpdate}>
  
  {#if showAdminPanel}
    <!-- Admin Panel -->
    <AdminPanel {user} on:back-to-app={handleBackFromAdmin} />
  {:else if loading}
    <LoadingSpinner 
      size="large" 
      color="teal" 
        text="Loading M-Prescribe v2.2.24..."
      fullScreen={true}
    />
  {:else if privacyOnly}
    <PrivacyPolicyPage />
  {:else if contactOnly}
    <ContactPage />
  {:else if helpOnly}
    <HelpPage />
  {:else if faqOnly}
    <FaqPage />
  {:else if pricingOnly}
    <PricingPage />
  {:else if user}
    {#if user.role === 'pharmacist'}
      <!-- Pharmacist Dashboard -->
      <PharmacistDashboard pharmacist={user} on:logout={handleLogout} />
    {:else}
    <!-- Doctor is logged in - Show patient management -->
    <nav class="bg-teal-600 border-gray-200 dark:bg-gray-900">
      <div class="max-w-screen-xl flex flex-wrap items-center justify-between mx-auto p-4">
        <a href="/" class="flex items-center space-x-3 rtl:space-x-reverse">
          <span class="self-center text-xl font-semibold whitespace-nowrap text-white font-hero inline-flex items-center gap-2">
            <img src="/favicon-32x32.png" alt="M-Prescribe" class="h-6 w-6" loading="lazy" />
            <BrandName className="text-teal-100" />
            <span class="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded ml-2">v2.2.24</span>
          </span>
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
              <span class="text-sm font-medium">Dr. {user?.firstName && user?.lastName ? `${user.firstName} ${user.lastName}` : user?.firstName || user?.name || user?.email || 'Doctor'}</span>
              
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
              <span class="text-sm">Dr. {user?.firstName && user?.lastName ? `${user.firstName} ${user.lastName}` : user?.firstName || user?.name || user?.email || 'Doctor'}</span>
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
                  data-guide="patients-nav"
                >
                  <i class="fas fa-users mr-1 sm:mr-2"></i>
                  <span class="hidden xs:inline">Patients</span>
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
              {#if !isExternalDoctor}
                <li>
                  <button 
                    type="button"
                    class="px-2 sm:px-4 py-2 rounded-lg transition-colors duration-200 {currentView === 'reports' ? 'text-teal-600 bg-teal-50 font-semibold dark:text-teal-400 dark:bg-teal-900' : 'text-gray-700 hover:text-teal-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:text-teal-400 dark:hover:bg-gray-700'}"
                    on:click={() => handleMenuNavigation('reports')}
                  >
                    <i class="fas fa-chart-bar mr-1 sm:mr-2"></i>
                    <span class="hidden sm:inline">Reports</span>
                    <span class="sm:hidden hidden xs:inline">Reports</span>
                  </button>
                </li>
              {/if}
              {#if !isExternalDoctor}
                <li>
                  <button 
                    type="button"
                    class="px-2 sm:px-4 py-2 rounded-lg transition-colors duration-200 text-gray-700 hover:text-teal-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:text-teal-400 dark:hover:bg-gray-700"
                    on:click={handleSettingsClick}
                    data-guide="settings-nav"
                  >
                    <i class="fas fa-user-cog mr-1 sm:mr-2"></i>
                    <span class="hidden xs:inline">Settings</span>
                  </button>
                </li>
              {/if}
              <li>
                <button 
                  type="button"
                  class="px-2 sm:px-4 py-2 rounded-lg transition-colors duration-200 {currentView === 'help' ? 'text-teal-600 bg-teal-50 font-semibold dark:text-teal-400 dark:bg-teal-900' : 'text-gray-700 hover:text-teal-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:text-teal-400 dark:hover:bg-gray-700'}"
                  on:click={() => handleMenuNavigation('help')}
                >
                  <i class="fas fa-question-circle mr-1 sm:mr-2"></i>
                  <span class="hidden sm:inline">Help</span>
                  <span class="sm:hidden hidden xs:inline">Help</span>
                </button>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </nav>
    
    <div class="p-4">
      {#if currentView === 'settings'}
        <SettingsPage 
          user={effectiveUser}
          on:profile-updated={handleProfileUpdate}
          on:user-updated={handleUserUpdate}
          on:back-to-app={() => currentView = 'home'}
        />
      {:else if currentView === 'reports'}
        <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <ReportsDashboard user={effectiveUser} />
        </div>
      {:else if currentView === 'help'}
        <DoctorGettingStarted {user} />
      {:else}
        <PatientManagement 
            user={effectiveUser} 
            authUser={user}
            {currentView}
            key={effectiveUser?.firstName && effectiveUser?.lastName ? `${effectiveUser.firstName}-${effectiveUser.lastName}-${effectiveUser.country}` : effectiveUser?.email || 'default'} 
            on:ai-usage-updated={refreshDoctorUsageStats} 
            on:profile-updated={handleProfileUpdate}
            on:view-change={(e) => handleMenuNavigation(e.detail)}
          />
      {/if}
    </div>
    {/if}
  {:else}
    <!-- Landing page + login -->
    <div class="min-h-screen bg-[radial-gradient(circle_at_top,_#e2f7f2_0%,_#f9fafb_45%,_#f3f4f6_100%)] px-4 py-4">
      <PublicHeader />
      <div class="mx-auto max-w-6xl pt-4">
        {#if authOnly}
          <RegisterPage />
        {:else}
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          <div class="lg:col-span-7">
            <div class="rounded-3xl border border-teal-100 bg-white/80 backdrop-blur px-6 py-10 shadow-sm relative overflow-hidden h-full flex flex-col">
              <div class="absolute -top-24 -right-16 h-48 w-48 rounded-full bg-teal-200/40"></div>
              <div class="absolute -bottom-24 -left-16 h-48 w-48 rounded-full bg-amber-200/40"></div>
              <div class="relative flex flex-col h-full justify-between">
                <div>
                  <div class="inline-flex items-center gap-2 rounded-full bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-700">
                    <i class="fas fa-shield-alt"></i>
                    HIPAA-ready workflows
                  </div>
                  <h1 class="mt-4 text-2xl sm:text-3xl lg:text-4xl font-semibold text-gray-900 font-hero">
                    <BrandName className="text-teal-600" />
                    <span class="block mt-2">Patient and Pharmacy Management System</span>
                  </h1>
                  <p class="mt-3 text-base text-gray-600 max-w-xl">
                    Patient history management, AI treatment suggestions, drug interaction checks, barcode IDs, prescriptions, inventory tracking, low-stock notifications, appointment reminders, auto billing, and daily/monthly income reports.
                  </p>
                  <div class="mt-5 flex flex-wrap items-center gap-3 text-sm text-gray-600">
                    <span class="inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1 text-amber-700 font-semibold">
                      One month free access for new registrations
                    </span>
                    <a
                      href="/?register=1"
                      class="inline-flex items-center gap-2 rounded-full bg-teal-600 px-4 py-2 text-white font-semibold shadow-sm hover:bg-teal-700 transition-colors duration-200"
                    >
                      <i class="fas fa-user-plus"></i>
                      Register free trial
                    </a>
                  </div>
                  <div class="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div class="rounded-2xl border border-gray-200 bg-white p-4">
                      <div class="flex items-center gap-3">
                        <span class="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-teal-100 text-teal-700">
                          <i class="fas fa-notes-medical"></i>
                        </span>
                        <div>
                          <p class="text-sm font-semibold text-gray-900">Doctor Portal</p>
                          <p class="text-xs text-gray-500">Patients, prescriptions, AI insights</p>
                        </div>
                      </div>
                    </div>
                    <div class="rounded-2xl border border-gray-200 bg-white p-4">
                      <div class="flex items-center gap-3">
                        <span class="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                          <i class="fas fa-pills"></i>
                        </span>
                        <div>
                          <p class="text-sm font-semibold text-gray-900">Pharmacy Portal</p>
                          <p class="text-xs text-gray-500">Inventory, billing, team access</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div class="pt-6">
                  <img
                    src="/hero.png"
                    alt="M-Prescribe overview"
                    class="w-full h-auto rounded-2xl border border-gray-200 bg-white shadow-sm"
                    loading="lazy"
                  />
                  <div class="mt-4 flex flex-wrap items-center gap-3 text-xs text-gray-500">
                    <span class="inline-flex items-center gap-1"><i class="fas fa-lock"></i> Secure access</span>
                    <span class="inline-flex items-center gap-1"><i class="fas fa-bolt"></i> Fast workflows</span>
                    <span class="inline-flex items-center gap-1"><i class="fas fa-chart-line"></i> Usage analytics</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div class="lg:col-span-5">
            <div id="signin" class="bg-white rounded-3xl shadow-xl border border-gray-200 overflow-hidden h-full flex flex-col">
              <div class="px-6 py-6 border-b border-gray-200">
                <div class="flex items-center justify-between">
                  <div>
                    <h2 class="text-xl font-semibold text-gray-900 font-landing">Sign in</h2>
                    <p class="text-xs text-gray-500">Doctor or pharmacy access</p>
                  </div>
                  <div class="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-teal-100 text-teal-700">
                    <i class="fas fa-stethoscope"></i>
                  </div>
                </div>
              </div>
              <div class="px-6 py-6">
                <div class="mb-5">
                  <div class="flex rounded-xl border border-gray-200 bg-gray-100 p-1 w-full" role="group" aria-label="Authentication mode">
                    <button 
                      type="button" 
                      class="flex-1 flex items-center justify-center px-4 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 {authMode === 'doctor' ? 'bg-white text-teal-600 shadow-sm' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}"
                      on:click={handleSwitchToDoctor}
                    >
                      <i class="fas fa-user-md mr-2"></i>
                      <span>Doctor</span>
                    </button>
                    <button 
                      type="button" 
                      class="flex-1 flex items-center justify-center px-4 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 {authMode === 'pharmacist' ? 'bg-white text-teal-600 shadow-sm' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}"
                      on:click={handleSwitchToPharmacist}
                    >
                      <i class="fas fa-pills mr-2"></i>
                      <span>Pharmacy</span>
                    </button>
                  </div>
                </div>
                <div class="rounded-2xl bg-gray-50 p-4">
                  {#if authMode === 'doctor'}
                    <div class="text-center mb-4">
                      <h4 class="text-base font-semibold text-gray-900 mb-0">
                        <i class="fas fa-user-md text-teal-600 mr-2"></i>
                        Doctor Portal
                      </h4>
                    </div>
                    <DoctorAuth allowRegister={false} on:user-authenticated={handleUserAuthenticated} />
                  {:else}
                    <div class="text-center mb-4">
                      <h4 class="text-base font-semibold text-gray-900 mb-0">
                        <i class="fas fa-pills text-teal-600 mr-2"></i>
                        Pharmacy Portal
                      </h4>
                    </div>
                    <PharmacistAuth 
                      on:pharmacist-login={handlePharmacistLogin}
                      on:switch-to-doctor={handleSwitchToDoctor}
                      allowRegister={false}
                    />
                  {/if}
                </div>
              </div>
              <div class="bg-gray-50 px-6 py-4 text-center text-xs text-gray-500 space-y-2 mt-auto">
                <div class="flex flex-wrap justify-center gap-2">
                  <span class="inline-flex items-center gap-1"><i class="fas fa-shield-alt"></i> Secure</span>
                  <span class="inline-flex items-center gap-1"><i class="fas fa-brain"></i> AI-Enhanced</span>
                  <span class="inline-flex items-center gap-1"><i class="fas fa-user-check"></i> Role-based access</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="mt-10">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-lg sm:text-xl font-semibold text-gray-900 font-landing">Facilities for doctors and pharmacists</h3>
            <span class="text-xs text-gray-500">All included in your portal access</span>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div class="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
              <div class="flex flex-col items-center text-center gap-3">
                <span class="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-teal-100 text-teal-700 text-3xl">
                  <i class="fas fa-notes-medical"></i>
                </span>
                <div>
                  <p class="text-base font-semibold text-gray-900">Patient history</p>
                  <p class="text-sm text-gray-500">Search visits, diagnoses, labs, and meds in seconds with unified charts</p>
                </div>
              </div>
            </div>
            <div class="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
              <div class="flex flex-col items-center text-center gap-3">
                <span class="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-100 text-rose-700 text-3xl">
                  <i class="fas fa-bell"></i>
                </span>
                <div>
                  <p class="text-base font-semibold text-gray-900">SMS + email notifications</p>
                  <p class="text-sm text-gray-500">Automatic registration confirmations and next-visit reminders via SMS and email</p>
                </div>
              </div>
            </div>
            <div class="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
              <div class="flex flex-col items-center text-center gap-3">
                <span class="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-700 text-3xl">
                  <i class="fas fa-folder-open"></i>
                </span>
                <div>
                  <p class="text-base font-semibold text-gray-900">Fast account retrieval</p>
                  <p class="text-sm text-gray-500">Locate patient accounts and past prescriptions with smart filters, quick search, and optional barcode retrieval</p>
                </div>
              </div>
            </div>
            <div class="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
              <div class="flex flex-col items-center text-center gap-3">
                <span class="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 text-3xl">
                  <i class="fas fa-brain"></i>
                </span>
                <div>
                  <p class="text-base font-semibold text-gray-900">Optional AI based diagnosis</p>
                  <p class="text-sm text-gray-500">On-demand clinical suggestions to support decisions without replacing judgment</p>
                </div>
              </div>
            </div>
            <div class="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
              <div class="flex flex-col items-center text-center gap-3">
                <span class="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-sky-100 text-sky-700 text-3xl">
                  <i class="fas fa-spell-check"></i>
                </span>
                <div>
                  <p class="text-base font-semibold text-gray-900">AI spelling and grammar corrections</p>
                  <p class="text-sm text-gray-500">Clean medicine names and patient notes with automatic English fixes</p>
                </div>
              </div>
            </div>
            <div class="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
              <div class="flex flex-col items-center text-center gap-3">
                <span class="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-100 text-amber-700 text-3xl">
                  <i class="fas fa-file-prescription"></i>
                </span>
                <div>
                  <p class="text-base font-semibold text-gray-900">Printing prescription</p>
                  <p class="text-sm text-gray-500">Generate clean, branded prescriptions with dosage, notes, and refill details</p>
                </div>
              </div>
            </div>
            <div class="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
              <div class="flex flex-col items-center text-center gap-3">
                <span class="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-100 text-blue-700 text-3xl">
                  <i class="fas fa-capsules"></i>
                </span>
                <div>
                  <p class="text-base font-semibold text-gray-900">Maintain drug inventory</p>
                  <p class="text-sm text-gray-500">Track stock levels, dispensing history, expiries, and low-stock alerts</p>
                </div>
              </div>
            </div>
            <div class="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
              <div class="flex flex-col items-center text-center gap-3">
                <span class="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-100 text-violet-700 text-3xl">
                  <i class="fas fa-calculator"></i>
                </span>
                <div>
                  <p class="text-base font-semibold text-gray-900">Charge calculations</p>
                  <p class="text-sm text-gray-500">Accurate totals with taxes, discounts, and itemized billing in one step</p>
                </div>
              </div>
            </div>
            <div class="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
              <div class="flex flex-col items-center text-center gap-3">
                <span class="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-700 text-3xl">
                  <i class="fas fa-chart-line"></i>
                </span>
                <div>
                  <p class="text-base font-semibold text-gray-900">Daily monthly income reports</p>
                  <p class="text-sm text-gray-500">Daily and monthly revenue snapshots with exports for accounting</p>
                </div>
              </div>
            </div>
          </div>
        </div>
        <footer class="mt-10 border-t border-gray-200 pt-6 text-sm text-gray-500 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <span>© Tronicgate Hardware and Software Services</span>
          <div class="flex items-center gap-4">
            <a href="/?privacy=1" class="text-blue-600 hover:text-blue-800 underline">Privacy Policy</a>
            <a href="/?pricing=1" class="text-blue-600 hover:text-blue-800 underline">Pricing</a>
            <a href="/?faq=1" class="text-blue-600 hover:text-blue-800 underline">FAQ</a>
            <a href="/?help=1" class="text-blue-600 hover:text-blue-800 underline">Help</a>
            <a href="/?contact=1" class="text-blue-600 hover:text-blue-800 underline">Contact us</a>
          </div>
        </footer>
      {/if}
      </div>
    </div>
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

  :global(.font-landing) {
    font-family: 'Space Grotesk', 'Inter', system-ui, sans-serif;
  }

  :global(.font-hero) {
    font-family: 'Merriweather', 'Space Grotesk', 'Inter', system-ui, sans-serif;
  }

</style>
