<script>
  import { createEventDispatcher, onMount } from 'svelte'
  import adminAuthService from '../services/adminAuthService.js'
  import firebaseStorage from '../services/firebaseStorage.js'
  import LoadingSpinner from './LoadingSpinner.svelte'
  import aiTokenTracker from '../services/aiTokenTracker.js'
  import AIPromptLogs from './AIPromptLogs.svelte'
  import ConfirmationModal from './ConfirmationModal.svelte'
  
  const dispatch = createEventDispatcher()
  
  // Accept admin data as prop from AdminPanel
  export let currentAdmin = null
  let statistics = {
    totalDoctors: 0,
    totalPatients: 0,
    totalPrescriptions: 0,
    totalSymptoms: 0,
    totalIllnesses: 0
  }
  let aiUsageStats = null
  let doctors = []
  // Removed patients array and doctorPatientCounts for HIPAA compliance
  // Admins should not have access to patient PHI data
  let loading = true
  let activeTab = 'overview'
  
  // Quota management variables
  let showQuotaModal = false
  let selectedDoctorId = ''
  let quotaInput = 0
  
  // Confirmation modal state
  let showConfirmationModal = false
  let confirmationConfig = {
    title: 'Confirm Action',
    message: 'Are you sure you want to proceed?',
    confirmText: 'Confirm',
    cancelText: 'Cancel',
    type: 'warning'
  }
  let pendingAction = null
  
  // Confirmation modal helper functions
  function showConfirmation(title, message, confirmText = 'Confirm', cancelText = 'Cancel', type = 'warning') {
    confirmationConfig = { title, message, confirmText, cancelText, type }
    showConfirmationModal = true
  }
  
  function handleConfirmationConfirm() {
    if (pendingAction) {
      pendingAction()
      pendingAction = null
    }
    showConfirmationModal = false
  }
  
  function handleConfirmationCancel() {
    pendingAction = null
    showConfirmationModal = false
  }
  
  // Configuration variables
  let defaultQuotaInput = 0
  let tokenPriceInput = 0
  
  // Reactive statement to reload data when currentAdmin changes
  $: if (currentAdmin) {
    console.log('🔄 AdminDashboard: currentAdmin changed, reloading...')
    loadAdminData()
  }
  
  // Load admin data and initialize Flowbite components on mount
  onMount(async () => {
    console.log('🚀 AdminDashboard component mounted')
    
    // Initialize Flowbite dropdowns
    if (typeof window !== 'undefined' && window.Flowbite && typeof window.Flowbite.initDropdowns === 'function') {
      window.Flowbite.initDropdowns()
    }
    
    await loadAdminData()
  })
  
  // Load admin data and statistics
  const loadAdminData = async () => {
    try {
      console.log('🔍 Starting loadAdminData...')
      loading = true
      
      if (!currentAdmin) {
        console.log('❌ No current admin found, dispatching sign-out')
        dispatch('admin-signed-out')
        return
      }
      
      console.log('✅ Admin found:', currentAdmin.email)
      
      // Load statistics
      console.log('🔍 Loading statistics...')
      await loadStatistics()
      console.log('✅ Statistics loaded')
      
      // Load AI usage statistics
      console.log('🔍 Loading AI usage stats...')
      loadAIUsageStats()
      console.log('✅ AI usage stats loaded')
      
      // Load doctors data only (no patient data for HIPAA compliance)
      console.log('🔍 Loading doctors...')
      await loadDoctors()
      console.log('✅ Doctors loaded')
      
      console.log('🎉 All admin data loaded successfully')
      
    } catch (error) {
      console.error('❌ Error loading admin data:', error)
      console.error('❌ Error details:', error.message, error.stack)
    } finally {
      loading = false
      console.log('🔍 Loading set to false')
    }
  }
  
  // Load system statistics (HIPAA compliant - aggregated data only)
  const loadStatistics = async () => {
    try {
      console.log('📊 Loading system statistics...')
      
      // Get all doctors
      const allDoctors = await firebaseStorage.getAllDoctors()
      console.log('📊 Found doctors:', allDoctors.length)
      statistics.totalDoctors = allDoctors.length
      
      // Get aggregated counts without accessing individual patient data
      let totalPatients = 0
      let totalPrescriptions = 0
      let totalSymptoms = 0
      let totalIllnesses = 0
      
      for (const doctor of allDoctors) {
        console.log(`📊 Processing doctor: ${doctor.name || doctor.email} (${doctor.id})`)
        
        try {
          // Get patient count only (aggregated data)
          const doctorPatients = await firebaseStorage.getPatientsByDoctorId(doctor.id)
          console.log(`📊 Doctor has ${doctorPatients.length} patients`)
          totalPatients += doctorPatients.length
          
          // Get aggregated counts for medical data (without accessing individual patient details)
          // Note: This still accesses patient data but only for counting - consider implementing
          // separate aggregation functions in firebaseStorage for full HIPAA compliance
          for (const patient of doctorPatients) {
            try {
              const prescriptions = await firebaseStorage.getPrescriptionsByPatientId(patient.id)
              const symptoms = await firebaseStorage.getSymptomsByPatientId(patient.id)
              const illnesses = await firebaseStorage.getIllnessesByPatientId(patient.id)
              
              totalPrescriptions += prescriptions.length
              totalSymptoms += symptoms.length
              totalIllnesses += illnesses.length
            } catch (error) {
              console.error(`❌ Error loading medical data for patient ${patient.id}:`, error)
              // Continue with other patients
            }
          }
        } catch (error) {
          console.error(`❌ Error loading data for doctor ${doctor.id}:`, error)
          // Continue with other doctors
        }
      }
      
      statistics.totalPatients = totalPatients
      statistics.totalPrescriptions = totalPrescriptions
      statistics.totalSymptoms = totalSymptoms
      statistics.totalIllnesses = totalIllnesses
      
      console.log('📊 Final statistics (aggregated):', statistics)
      
    } catch (error) {
      console.error('❌ Error loading statistics:', error)
      console.error('❌ Error details:', error.message, error.stack)
    }
  }
  
  // Load AI usage statistics
  const loadAIUsageStats = () => {
    try {
      console.log('📊 Loading AI usage stats...')
      aiUsageStats = aiTokenTracker.getUsageStats()
      console.log('📊 AI usage stats loaded:', aiUsageStats)
      
      // If no usage data exists, initialize with zero values
      if (!aiUsageStats || !aiUsageStats.total) {
        aiUsageStats = {
          total: { tokens: 0, cost: 0, requests: 0 },
          today: { tokens: 0, cost: 0, requests: 0 },
          thisMonth: { tokens: 0, cost: 0, requests: 0 },
          lastUpdated: null
        }
      }
      
      // Run migration to fix any missing doctorId values
      const migratedCount = aiTokenTracker.migrateRequestsWithMissingDoctorId()
      if (migratedCount > 0) {
        console.log(`🔄 Fixed ${migratedCount} AI usage records with missing doctorId`)
        // Reload stats after migration
        aiUsageStats = aiTokenTracker.getUsageStats()
      }
    } catch (error) {
      console.error('❌ Error loading AI usage stats:', error)
      aiUsageStats = {
        total: { tokens: 0, cost: 0, requests: 0 },
        today: { tokens: 0, cost: 0, requests: 0 },
        thisMonth: { tokens: 0, cost: 0, requests: 0 },
        lastUpdated: null
      }
    }
  }
  
  // Load doctors data only (HIPAA compliant - no patient data access)
  const loadDoctors = async () => {
    try {
      console.log('🔍 Loading doctors...')
      doctors = await firebaseStorage.getAllDoctors()
      
      console.log(`🔍 Found ${doctors.length} doctors`)
      
      // Get patient counts and token usage for each doctor (aggregated data only)
      for (const doctor of doctors) {
        try {
          console.log(`🔍 Getting patient count for doctor: ${doctor.email}`)
          const doctorPatients = await firebaseStorage.getPatientsByDoctorId(doctor.id)
          console.log(`🔍 Doctor ${doctor.email} has ${doctorPatients.length} patients`)
          
          // Add patient count to doctor object for display (aggregated data only)
          doctor.patientCount = doctorPatients.length
          
          // Get token usage stats for this doctor
          // Try multiple ID formats to match token usage data
          let tokenStats = aiTokenTracker.getDoctorUsageStats(doctor.id)
          console.log(`📊 Token stats for doctor.id (${doctor.id}):`, tokenStats)
          
          // If no stats found with Firebase ID, try with UID
          if (!tokenStats && doctor.uid) {
            tokenStats = aiTokenTracker.getDoctorUsageStats(doctor.uid)
            console.log(`📊 Token stats for doctor.uid (${doctor.uid}):`, tokenStats)
          }
          
          // If still no stats found, try with email as fallback
          if (!tokenStats) {
            tokenStats = aiTokenTracker.getDoctorUsageStats(doctor.email)
            console.log(`📊 Token stats for doctor.email (${doctor.email}):`, tokenStats)
          }
          
          // Check for unknown-doctor entries that might belong to this doctor
          const unknownDoctorStats = aiTokenTracker.getDoctorUsageStats('unknown-doctor')
          if (unknownDoctorStats && unknownDoctorStats.total.requests > 0) {
            console.log(`📊 Found unknown-doctor entries with ${unknownDoctorStats.total.requests} requests`)
          }
          
          doctor.tokenUsage = tokenStats || {
            total: { tokens: 0, cost: 0, requests: 0 },
            today: { tokens: 0, cost: 0, requests: 0 }
          }
          
        } catch (error) {
          console.error(`❌ Error loading data for doctor ${doctor.id}:`, error)
          doctor.patientCount = 0
          doctor.tokenUsage = {
            total: { tokens: 0, cost: 0, requests: 0 },
            today: { tokens: 0, cost: 0, requests: 0 }
          }
        }
      }
      
    } catch (error) {
      console.error('❌ Error loading doctors:', error)
    }
  }
  
  // Handle admin sign out
  const handleSignOut = async () => {
    try {
      await adminAuthService.signOut()
      dispatch('admin-signed-out')
    } catch (error) {
      console.error('❌ Error signing out admin:', error)
    }
  }
  
  // Handle tab change
  const handleTabChange = (tab) => {
    activeTab = tab
  }
  
  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A'
    return new Date(dateString).toLocaleDateString()
  }
  
  // Refresh data
  const refreshData = async () => {
    await loadAdminData()
  }

  // Quota Management Functions
  
  // Get doctor name by ID
  const getDoctorName = (doctorId) => {
    const doctor = doctors.find(d => d.id === doctorId || d.uid === doctorId)
    if (doctor) {
      return doctor.name || `${doctor.firstName || ''} ${doctor.lastName || ''}`.trim() || doctor.email || 'Unknown Doctor'
    }
    return 'Unknown Doctor'
  }
  
  // Open quota modal
  const openQuotaModal = (doctorId, currentQuota = 0) => {
    selectedDoctorId = doctorId
    quotaInput = currentQuota
    showQuotaModal = true
  }
  
  // Close quota modal
  const closeQuotaModal = () => {
    showQuotaModal = false
    selectedDoctorId = ''
    quotaInput = 0
  }
  
  // Save quota
  const saveQuota = () => {
    if (!selectedDoctorId || quotaInput < 0) return
    
    try {
      aiTokenTracker.setDoctorQuota(selectedDoctorId, parseInt(quotaInput))
      
      // Show success notification
      console.log(`✅ Quota set for doctor ${selectedDoctorId}: ${quotaInput} tokens`)
      
      // Close modal
      closeQuotaModal()
      
      // Refresh the page to show updated data
      setTimeout(() => {
        loadAIUsageStats()
      }, 100)
      
    } catch (error) {
      console.error('❌ Error setting quota:', error)
    }
  }

  // Configuration Management Functions
  
  // Save default quota
  const saveDefaultQuota = () => {
    if (!defaultQuotaInput || defaultQuotaInput < 0) return
    
    try {
      aiTokenTracker.setDefaultQuota(defaultQuotaInput)
      console.log(`✅ Default quota saved: ${defaultQuotaInput} tokens`)
      
      // Clear input
      defaultQuotaInput = 0
      
      // Refresh the page to show updated data
      setTimeout(() => {
        loadAIUsageStats()
      }, 100)
      
    } catch (error) {
      console.error('❌ Error saving default quota:', error)
    }
  }
  
  // Apply default quota to all doctors
  const applyDefaultQuotaToAll = () => {
    try {
      const appliedCount = aiTokenTracker.applyDefaultQuotaToAllDoctors()
      console.log(`✅ Applied default quota to ${appliedCount} doctors`)
      
      // Refresh the page to show updated data
      setTimeout(() => {
        loadAIUsageStats()
      }, 100)
      
    } catch (error) {
      console.error('❌ Error applying default quota:', error)
    }
  }
  
  // Save token price
  const saveTokenPrice = () => {
    if (!tokenPriceInput || tokenPriceInput < 0) return
    
    try {
      aiTokenTracker.setTokenPricePerMillion(tokenPriceInput)
      console.log(`✅ Token price saved: $${tokenPriceInput} per 1M tokens`)
      
      // Clear input
      tokenPriceInput = 0
      
      // Refresh the page to show updated data
      setTimeout(() => {
        loadAIUsageStats()
      }, 100)
      
    } catch (error) {
      console.error('❌ Error saving token price:', error)
    }
  }
  
  // Refresh cost estimates
  const refreshCostEstimates = () => {
    try {
      console.log('🔄 Refreshing cost estimates...')
      
      // Refresh the page to show updated data
      loadAIUsageStats()
      
    } catch (error) {
      console.error('❌ Error refreshing cost estimates:', error)
    }
  }

  // Delete doctor
  const deleteDoctor = async (doctor) => {
    pendingAction = async () => {
      try {
      // Show loading state
      const deleteButton = document.querySelector(`[data-doctor-id="${doctor.id}"]`)
      if (deleteButton) {
        deleteButton.disabled = true
          deleteButton.innerHTML = '<svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>Deleting...'
      }
      
      console.log('🗑️ Admin: Deleting doctor:', doctor.email)
      
      // Call the delete function
      await firebaseStorage.deleteDoctor(doctor.id)
      
      // Remove doctor from local array
      doctors = doctors.filter(d => d.id !== doctor.id)
      
      // Update statistics
      statistics.totalDoctors = doctors.length
      
      // Recalculate patient counts
      await loadDoctorsAndPatients()
      
      console.log('✅ Admin: Doctor deleted successfully')
        
        // Show success message
        showConfirmation(
          'Success',
          `Doctor "${doctor.name || doctor.email}" has been deleted successfully.`,
          'OK',
          '',
          'success'
        )
      
    } catch (error) {
      console.error('❌ Admin: Error deleting doctor:', error)
        
        // Show error message
        showConfirmation(
          'Error',
          'Error deleting doctor. Please try again.',
          'OK',
          '',
          'danger'
        )
      
      // Reset button state
      const deleteButton = document.querySelector(`[data-doctor-id="${doctor.id}"]`)
      if (deleteButton) {
        deleteButton.disabled = false
          deleteButton.innerHTML = '<i class="fas fa-trash mr-2"></i>Delete'
        }
      }
    }
    
    showConfirmation(
      'Delete Doctor',
      `Are you sure you want to delete doctor "${doctor.name || doctor.email}"?\n\nThis will permanently delete:\n• The doctor account\n• All patients belonging to this doctor\n• All prescriptions, symptoms, and illnesses\n• All drug database entries\n\nThis action cannot be undone!`,
      'Delete',
      'Cancel',
      'danger'
    )
  }
</script>

<div class="min-h-screen bg-gray-50">
  {#if loading}
    <LoadingSpinner 
      size="large" 
      color="red" 
      text="Loading admin dashboard..." 
      fullScreen={true}
    />
  {:else}
    <!-- Admin Header -->
    <nav class="bg-gray-900 border-gray-200 dark:bg-gray-900" style="height: 50px; min-height: 50px; max-height: 50px;">
      <div class="max-w-screen-xl flex flex-wrap items-center justify-between mx-auto px-4 py-1">
        <span class="text-lg font-semibold text-white">
          <i class="fas fa-shield-alt mr-2"></i>
          Admin Panel
        </span>
        
        <div class="flex items-center">
          <div class="relative">
            <button 
              class="text-white hover:text-gray-300 border-0 bg-transparent py-1 px-2 text-sm flex items-center transition-colors duration-200" 
              type="button" 
              data-dropdown-toggle="adminDropdown"
              data-dropdown-placement="bottom-end"
              aria-expanded="false"
            >
              <i class="fas fa-user-shield mr-2"></i>
              {currentAdmin?.name || 'Admin'}
              <svg class="w-2.5 h-2.5 ml-2.5" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 10 6">
                <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m1 1 4 4 4-4"/>
              </svg>
            </button>
            <div 
              id="adminDropdown" 
              class="z-10 hidden bg-white divide-y divide-gray-100 rounded-lg shadow w-44 dark:bg-gray-700"
            >
              <div class="px-4 py-3 text-sm text-gray-900 dark:text-white">
                <div class="font-medium">Admin Account</div>
                <div class="truncate">{currentAdmin?.email}</div>
              </div>
              <ul class="py-2 text-sm text-gray-700 dark:text-gray-200">
                <li>
                  <button 
                    type="button"
                    class="block w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-600 dark:hover:text-white transition-colors duration-200" 
                    on:click={handleSignOut}
                  >
                    <i class="fas fa-sign-out-alt mr-2"></i>Sign Out
                </button>
              </li>
            </ul>
            </div>
          </div>
        </div>
      </div>
    </nav>
    
    <!-- Main Content -->
    <div class="max-w-screen-xl mx-auto px-4 py-6">
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <!-- Sidebar -->
        <div class="lg:col-span-3">
          <div class="bg-white rounded-lg shadow-sm border border-gray-200">
            <div class="p-4">
              <nav class="space-y-2">
            <button
                  class="w-full flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors duration-200 {activeTab === 'overview' ? 'bg-red-50 text-red-700 border border-red-200' : 'text-gray-700 hover:bg-gray-50'}"
              on:click={() => handleTabChange('overview')}
            >
                  <i class="fas fa-chart-bar mr-3"></i>Overview
            </button>
            <button
                  class="w-full flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors duration-200 {activeTab === 'doctors' ? 'bg-red-50 text-red-700 border border-red-200' : 'text-gray-700 hover:bg-gray-50'}"
              on:click={() => handleTabChange('doctors')}
            >
                  <i class="fas fa-user-md mr-3"></i>Doctors
            </button>
            <!-- Patients tab removed for HIPAA compliance - admins should not access patient PHI data -->
            <button
                  class="w-full flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors duration-200 {activeTab === 'ai-usage' ? 'bg-red-50 text-red-700 border border-red-200' : 'text-gray-700 hover:bg-gray-50'}"
              on:click={() => handleTabChange('ai-usage')}
            >
                  <i class="fas fa-brain mr-3 text-red-500"></i>AI Usage
            </button>
            <button
                  class="w-full flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors duration-200 {activeTab === 'ai-logs' ? 'bg-red-50 text-red-700 border border-red-200' : 'text-gray-700 hover:bg-gray-50'}"
              on:click={() => handleTabChange('ai-logs')}
            >
                  <i class="fas fa-brain mr-3 text-red-500"></i>AI Logs
            </button>
            <button
                  class="w-full flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors duration-200 {activeTab === 'system' ? 'bg-red-50 text-red-700 border border-red-200' : 'text-gray-700 hover:bg-gray-50'}"
              on:click={() => handleTabChange('system')}
            >
                  <i class="fas fa-cog mr-3"></i>System
            </button>
              </nav>
            </div>
          </div>
        </div>
        
        <!-- Main Content Area -->
        <div class="lg:col-span-9">
          {#if activeTab === 'overview'}
            <!-- Overview Tab -->
            <div class="flex justify-between items-center mb-6">
              <h2 class="text-2xl font-bold text-gray-900"><i class="fas fa-chart-bar mr-2 text-red-500"></i>System Overview</h2>
              <button class="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200 flex items-center" on:click={refreshData}>
                <i class="fas fa-sync-alt mr-2"></i>Refresh
              </button>
            </div>
            
            <!-- HIPAA Compliance Notice -->
            <div class="bg-blue-50 border border-teal-200 rounded-lg p-4 mb-6" role="alert">
              <i class="fas fa-shield-alt text-blue-500 mr-2"></i>
              <span class="text-sm text-blue-700">
              <strong>HIPAA Compliance:</strong> This admin panel displays only aggregated system statistics. 
              Individual patient data is not accessible to administrators to maintain HIPAA compliance and patient privacy.
              </span>
            </div>
            
            <!-- Statistics Cards -->
            <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
              <div class="bg-white border-2 border-teal-200 rounded-lg shadow-sm p-4 text-center">
                <i class="fas fa-user-md text-2xl text-blue-500 mb-2"></i>
                <h3 class="text-xl font-bold text-gray-900">{statistics.totalDoctors}</h3>
                <p class="text-sm text-gray-500">Total Doctors</p>
              </div>
              
              <div class="bg-white border-2 border-teal-200 rounded-lg shadow-sm p-4 text-center">
                <i class="fas fa-users text-2xl text-teal-500 mb-2"></i>
                <h3 class="text-xl font-bold text-gray-900">{statistics.totalPatients}</h3>
                <p class="text-sm text-gray-500">Total Patients <small>(Aggregated)</small></p>
              </div>
              
              <div class="bg-white border-2 border-yellow-200 rounded-lg shadow-sm p-4 text-center">
                <i class="fas fa-pills text-2xl text-yellow-600 mb-2"></i>
                <h3 class="text-xl font-bold text-gray-900">{statistics.totalPrescriptions}</h3>
                <p class="text-sm text-gray-500">Total Prescriptions <small>(Aggregated)</small></p>
              </div>
              
              <div class="bg-white border-2 border-teal-200 rounded-lg shadow-sm p-4 text-center">
                <i class="fas fa-heartbeat text-2xl text-teal-600 mb-2"></i>
                <h3 class="text-xl font-bold text-gray-900">{statistics.totalSymptoms}</h3>
                <p class="text-sm text-gray-500">Total Symptoms <small>(Aggregated)</small></p>
              </div>
              
              <div class="bg-white border-2 border-red-200 rounded-lg shadow-sm p-4 text-center">
                <i class="fas fa-brain text-2xl text-red-600 mb-2"></i>
                <h3 class="text-xl font-bold text-gray-900">
                      {#if aiUsageStats}
                        ${aiUsageStats.total.cost.toFixed(3)}
                      {:else}
                        $0.000
                      {/if}
                </h3>
                <p class="text-sm text-gray-500">AI Cost <small>(Est.)</small></p>
              </div>
            </div>
            
            <!-- Recent Activity -->
            <div class="bg-white border-2 border-teal-200 rounded-lg shadow-sm">
              <div class="bg-gray-50 px-4 py-3 border-b border-gray-200">
                <h5 class="text-lg font-semibold text-gray-900 mb-0"><i class="fas fa-clock mr-2"></i>Recent Activity</h5>
              </div>
              <div class="p-4">
                <p class="text-gray-500">Recent system activity will be displayed here.</p>
              </div>
            </div>
            
          {:else if activeTab === 'doctors'}
            <!-- Doctors Tab -->
            <div class="flex justify-between items-center mb-6">
              <h2 class="text-2xl font-bold text-gray-900"><i class="fas fa-user-md mr-2 text-red-600"></i>Doctors Management</h2>
              <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-teal-100 text-teal-800">{doctors.length} Doctors</span>
            </div>
            
            <div class="bg-white border-2 border-teal-200 rounded-lg shadow-sm">
              <div class="bg-gray-50 px-4 py-3 border-b border-gray-200">
                <h5 class="text-lg font-semibold text-gray-900 mb-0">All Registered Doctors</h5>
              </div>
              <div class="p-4">
                {#if doctors.length > 0}
                  <!-- Desktop Table View -->
                  <div class="hidden lg:block overflow-x-auto">
                    <table class="min-w-full divide-y divide-gray-200">
                      <thead class="bg-gray-50">
                        <tr>
                          <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                          <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                          <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                          <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                          <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Patients</th>
                          <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Token Usage</th>
                          <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                      </thead>
                      <tbody class="bg-white divide-y divide-gray-200">
                        {#each doctors as doctor}
                          <tr class="hover:bg-gray-50">
                            <td class="px-4 py-4 text-sm text-gray-900 break-words max-w-xs">
                              <div class="truncate" title={doctor.email}>{doctor.email}</div>
                            </td>
                            <td class="px-4 py-4 text-sm text-gray-900 break-words max-w-xs">
                              <div class="truncate" title={doctor.name || `${doctor.firstName || ''} ${doctor.lastName || ''}`.trim() || doctor.email || 'Unknown Doctor'}>
                                {doctor.name || `${doctor.firstName || ''} ${doctor.lastName || ''}`.trim() || doctor.email || 'Unknown Doctor'}
                              </div>
                            </td>
                            <td class="px-4 py-4 text-sm text-gray-900">
                              <div class="flex flex-wrap gap-1">
                                <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-teal-100 text-teal-800">{doctor.role}</span>
                              {#if doctor.isAdmin}
                                  <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">Admin</span>
                              {/if}
                              </div>
                            </td>
                            <td class="px-4 py-4 text-sm text-gray-900">{formatDate(doctor.createdAt)}</td>
                            <td class="px-4 py-4 text-sm text-gray-900 text-center">{doctor.patientCount || 0}</td>
                            <td class="px-4 py-4 text-sm text-gray-900 min-w-0">
                              <div class="space-y-1">
                                <div class="flex items-center">
                                  <i class="fas fa-coins text-yellow-600 mr-1 flex-shrink-0"></i>
                                  <span class="font-medium truncate">${(doctor.tokenUsage?.total?.cost || 0).toFixed(4)}</span>
                                </div>
                                <div class="flex items-center text-xs text-gray-500">
                                  <i class="fas fa-hashtag text-blue-600 mr-1 flex-shrink-0"></i>
                                  <span class="truncate">{(doctor.tokenUsage?.total?.tokens || 0).toLocaleString()} tokens</span>
                                </div>
                                <div class="flex items-center text-xs text-gray-500">
                                  <i class="fas fa-bolt text-green-600 mr-1 flex-shrink-0"></i>
                                  <span class="truncate">{doctor.tokenUsage?.total?.requests || 0} requests</span>
                                </div>
                              </div>
                            </td>
                            <td class="px-4 py-4 text-sm text-gray-900">
                              {#if doctor.email !== 'senakahks@gmail.com'}
                                <button 
                                  class="inline-flex items-center px-2 py-1 border border-red-300 text-red-700 bg-white hover:bg-red-50 text-xs font-medium rounded-lg"
                                  data-doctor-id={doctor.id}
                                  on:click={() => deleteDoctor(doctor)}
                                  title="Delete doctor and all related data"
                                >
                                  <i class="fas fa-trash mr-1"></i>Delete
                                </button>
                              {:else}
                                <span class="text-gray-500 text-xs">
                                  <i class="fas fa-shield-alt mr-1"></i>Super Admin
                                </span>
                              {/if}
                            </td>
                          </tr>
                        {/each}
                      </tbody>
                    </table>
                  </div>
                  
                  <!-- Mobile Card View -->
                  <div class="lg:hidden space-y-4">
                    {#each doctors as doctor}
                      <div class="bg-white border border-gray-200 rounded-lg shadow-sm p-4">
                        <div class="flex flex-col space-y-3">
                          <!-- Header Row -->
                          <div class="flex justify-between items-start">
                            <div class="flex-1 min-w-0">
                              <h3 class="text-sm font-medium text-gray-900 truncate" title={doctor.email}>{doctor.email}</h3>
                              <p class="text-xs text-gray-500 truncate" title={doctor.name || `${doctor.firstName || ''} ${doctor.lastName || ''}`.trim() || doctor.email || 'Unknown Doctor'}>
                                {doctor.name || `${doctor.firstName || ''} ${doctor.lastName || ''}`.trim() || doctor.email || 'Unknown Doctor'}
                              </p>
                            </div>
                            <div class="flex flex-wrap gap-1 ml-2">
                              <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-teal-100 text-teal-800">{doctor.role}</span>
                              {#if doctor.isAdmin}
                                <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">Admin</span>
                {/if}
              </div>
            </div>
            
                          <!-- Details Grid -->
                          <div class="grid grid-cols-2 gap-3 text-xs">
                            <div>
                              <span class="text-gray-500">Created:</span>
                              <div class="font-medium text-gray-900">{formatDate(doctor.createdAt)}</div>
            </div>
                            <div>
                              <span class="text-gray-500">Patients:</span>
                              <div class="font-medium text-gray-900">{doctor.patientCount || 0}</div>
                            </div>
              </div>
              
                          <!-- Token Usage -->
                          <div class="border-t pt-3">
                            <div class="text-xs text-gray-500 mb-2">Token Usage:</div>
                            <div class="space-y-1">
                              <div class="flex items-center justify-between">
                                <div class="flex items-center">
                                  <i class="fas fa-coins text-yellow-600 mr-1"></i>
                                  <span class="text-gray-500">Cost:</span>
                    </div>
                                <span class="font-medium text-gray-900">${(doctor.tokenUsage?.total?.cost || 0).toFixed(4)}</span>
                  </div>
                              <div class="flex items-center justify-between">
                                <div class="flex items-center">
                                  <i class="fas fa-hashtag text-blue-600 mr-1"></i>
                                  <span class="text-gray-500">Tokens:</span>
                </div>
                                <span class="font-medium text-gray-900">{(doctor.tokenUsage?.total?.tokens || 0).toLocaleString()}</span>
                    </div>
                              <div class="flex items-center justify-between">
                                <div class="flex items-center">
                                  <i class="fas fa-bolt text-green-600 mr-1"></i>
                                  <span class="text-gray-500">Requests:</span>
                  </div>
                                <span class="font-medium text-gray-900">{doctor.tokenUsage?.total?.requests || 0}</span>
                </div>
                    </div>
                  </div>
                          
                          <!-- Actions -->
                          <div class="border-t pt-3">
                            {#if doctor.email !== 'senakahks@gmail.com'}
                              <button 
                                class="w-full inline-flex items-center justify-center px-3 py-2 border border-red-300 text-red-700 bg-white hover:bg-red-50 text-sm font-medium rounded-lg"
                                data-doctor-id={doctor.id}
                                on:click={() => deleteDoctor(doctor)}
                                title="Delete doctor and all related data"
                              >
                                <i class="fas fa-trash mr-2"></i>Delete Doctor
                              </button>
                            {:else}
                              <div class="text-center text-gray-500 text-sm">
                                <i class="fas fa-shield-alt mr-1"></i>Super Admin - Protected
                </div>
                            {/if}
                    </div>
                  </div>
                      </div>
                    {/each}
                  </div>
                {:else}
                  <p class="text-gray-500 text-center py-8">No doctors registered yet.</p>
                {/if}
                </div>
              </div>
              
          <!-- Patients tab removed for HIPAA compliance -->
          <!-- Admins should not have access to patient PHI data -->
          <!-- Patient data access is restricted to individual doctors only -->
          {:else if activeTab === 'ai-usage'}
            <!-- AI Usage Tab -->
            <div class="flex justify-between items-center mb-6">
              <h2 class="text-2xl font-bold text-gray-900"><i class="fas fa-brain mr-2 text-red-600"></i>AI Usage Analytics</h2>
              <button class="inline-flex items-center px-3 py-2 border border-red-300 text-red-700 bg-white hover:bg-red-50 text-sm font-medium rounded-lg" on:click={loadAIUsageStats}>
                <i class="fas fa-sync-alt mr-2"></i>Refresh
              </button>
                    </div>
            
            {#if aiUsageStats}
              <!-- Cost Disclaimer -->
              <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6" role="alert">
                <i class="fas fa-exclamation-triangle mr-2 text-yellow-600"></i>
                <strong class="text-yellow-800">Cost Disclaimer:</strong> <span class="text-yellow-700">These cost estimates are approximate and may not reflect actual OpenAI billing. 
                Actual costs may be higher due to taxes, fees, or pricing changes. 
                Check your <a href="https://platform.openai.com/usage" target="_blank" class="text-yellow-600 hover:text-yellow-800 underline">OpenAI dashboard</a> for exact billing amounts.</span>
                  </div>
              
              <!-- Usage Overview Cards -->
              <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
                <div class="bg-white border-2 border-teal-200 rounded-lg shadow-sm p-4 text-center">
                  <h6 class="text-teal-600 font-semibold mb-2">
                    <i class="fas fa-coins mr-1"></i>Total Cost
                  </h6>
                  <h5 class="text-teal-600 text-xl font-bold mb-1">${aiUsageStats.total.cost.toFixed(4)}</h5>
                  <small class="text-gray-500">All Time</small>
                </div>
                <div class="bg-white border-2 border-teal-200 rounded-lg shadow-sm p-4 text-center">
                  <h6 class="text-teal-600 font-semibold mb-2">
                    <i class="fas fa-hashtag mr-1"></i>Total Tokens
                  </h6>
                  <h5 class="text-teal-600 text-xl font-bold mb-1">{aiUsageStats.total.tokens.toLocaleString()}</h5>
                  <small class="text-gray-500">All Time</small>
                    </div>
                <div class="bg-white border-2 border-teal-200 rounded-lg shadow-sm p-4 text-center">
                  <h6 class="text-teal-600 font-semibold mb-2">
                    <i class="fas fa-bolt mr-1"></i>Total Requests
                  </h6>
                  <h5 class="text-teal-600 text-xl font-bold mb-1">{aiUsageStats.total.requests}</h5>
                  <small class="text-gray-500">All Time</small>
                  </div>
                <div class="bg-white border-2 border-yellow-200 rounded-lg shadow-sm p-4 text-center">
                  <h6 class="text-yellow-600 font-semibold mb-2">
                    <i class="fas fa-calendar-day mr-1"></i>Today
                  </h6>
                  <h5 class="text-yellow-600 text-xl font-bold mb-1">${aiUsageStats.today.cost.toFixed(4)}</h5>
                  <small class="text-gray-500">{aiUsageStats.today.requests} requests</small>
                </div>
                <div class="bg-white border-2 border-teal-200 rounded-lg shadow-sm p-4 text-center">
                  <h6 class="text-teal-600 font-semibold mb-2">
                    <i class="fas fa-calendar-alt mr-1"></i>This Month
                  </h6>
                  <h5 class="text-teal-600 text-xl font-bold mb-1">${aiUsageStats.thisMonth.cost.toFixed(4)}</h5>
                  <small class="text-gray-500">{aiUsageStats.thisMonth.requests} requests</small>
                    </div>
                <div class="bg-white border-2 border-teal-200 rounded-lg shadow-sm p-4 text-center">
                  <h6 class="text-teal-600 font-semibold mb-2">
                    <i class="fas fa-percentage mr-1"></i>Avg Cost/Request
                  </h6>
                  <h5 class="text-teal-600 text-xl font-bold mb-1">${aiUsageStats.total.requests > 0 ? (aiUsageStats.total.cost / aiUsageStats.total.requests).toFixed(4) : '0.0000'}</h5>
                  <small class="text-gray-500">All Time Average</small>
                  </div>
              </div>
              
              <!-- Last Updated Card -->
              <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div class="bg-white border-2 border-teal-200 rounded-lg shadow-sm p-4 text-center">
                  <h6 class="text-teal-600 font-semibold mb-2">
                    <i class="fas fa-clock mr-1"></i>Last Updated
                  </h6>
                  <h6 class="text-teal-600 text-lg font-bold mb-1">{aiUsageStats.lastUpdated ? new Date(aiUsageStats.lastUpdated).toLocaleString() : 'Never'}</h6>
                  <small class="text-gray-500">Usage Data</small>
              </div>
              
              <!-- Daily Usage Chart -->
              <div class="mb-6">
                <div class="bg-white border border-gray-200 rounded-lg shadow-sm">
                  <div class="bg-gray-50 px-4 py-3 border-b border-gray-200">
                    <h5 class="text-lg font-semibold text-gray-900 mb-0">
                      <i class="fas fa-chart-line mr-2"></i>Daily Usage (Last 7 Days)
                      </h5>
                    </div>
                  <div class="p-4">
                      <div class="overflow-x-auto">
                        <table class="min-w-full divide-y divide-gray-200">
                          <thead class="bg-gray-50">
                            <tr>
                              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Requests</th>
                              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tokens</th>
                              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cost</th>
                            </tr>
                          </thead>
                          <tbody class="bg-white divide-y divide-gray-200">
                            {#each aiTokenTracker.getWeeklyUsage() as day}
                              <tr class="hover:bg-gray-50">
                                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{new Date(day.date).toLocaleDateString()}</td>
                                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{day.requests || 0}</td>
                                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{(day.tokens || 0).toLocaleString()}</td>
                                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${(day.cost || 0).toFixed(4)}</td>
                              </tr>
                            {/each}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              <!-- Monthly Usage Chart -->
              <div class="mb-6">
                <div class="bg-white border border-gray-200 rounded-lg shadow-sm">
                  <div class="bg-gray-50 px-4 py-3 border-b border-gray-200">
                    <h5 class="text-lg font-semibold text-gray-900 mb-0">
                      <i class="fas fa-chart-bar mr-2"></i>Monthly Usage (Last 6 Months)
                      </h5>
                    </div>
                  <div class="p-4">
                    <div class="overflow-x-auto">
                      <table class="min-w-full divide-y divide-gray-200">
                        <thead class="bg-gray-50">
                          <tr>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Month</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Requests</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tokens</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cost</th>
                            </tr>
                          </thead>
                        <tbody class="bg-white divide-y divide-gray-200">
                            {#each aiTokenTracker.getMonthlyUsage() as month}
                            <tr class="hover:bg-gray-50">
                              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{new Date(month.month + '-01').toLocaleDateString('en-US', { year: 'numeric', month: 'long' })}</td>
                              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{month.requests || 0}</td>
                              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{(month.tokens || 0).toLocaleString()}</td>
                              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${(month.cost || 0).toFixed(4)}</td>
                              </tr>
                            {/each}
                          </tbody>
                        </table>
                    </div>
                  </div>
                </div>
              </div>
              
              <!-- Recent Requests -->
              <div class="mb-6">
                <div class="bg-white border border-gray-200 rounded-lg shadow-sm">
                  <div class="bg-gray-50 px-4 py-3 border-b border-gray-200">
                    <h5 class="text-lg font-semibold text-gray-900 mb-0">
                      <i class="fas fa-history mr-2 text-red-600"></i>Recent AI Requests
                      </h5>
                    </div>
                  <div class="p-4">
                    <div class="overflow-x-auto">
                      <table class="min-w-full divide-y divide-gray-200">
                        <thead class="bg-gray-50">
                          <tr>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tokens</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cost</th>
                            </tr>
                          </thead>
                        <tbody class="bg-white divide-y divide-gray-200">
                            {#each aiTokenTracker.getRecentRequests(10) as request}
                            <tr class="hover:bg-gray-50">
                              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{new Date(request.timestamp).toLocaleString()}</td>
                              <td class="px-6 py-4 whitespace-nowrap">
                                <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-teal-100 text-teal-800">
                                    {request.type.replace('generate', '').replace('check', '')}
                                  </span>
                                </td>
                              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{request.totalTokens.toLocaleString()}</td>
                              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${request.cost.toFixed(4)}</td>
                              </tr>
                            {:else}
                              <tr>
                              <td colspan="4" class="px-6 py-4 text-center text-gray-500">
                                <i class="fas fa-info-circle mr-2"></i>
                                  No recent AI requests found
                                </td>
                              </tr>
                            {/each}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
              
              <!-- AI Configuration Section -->
              <div class="mb-6">
                <div class="bg-white border border-gray-200 rounded-lg shadow-sm">
                  <div class="bg-gray-50 px-4 py-3 border-b border-gray-200">
                    <h5 class="text-lg font-semibold text-gray-900 mb-0">
                      <i class="fas fa-cog mr-2 text-red-600"></i>AI Configuration
                    </h5>
              </div>
                  <div class="p-4">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <!-- Default Quota Configuration -->
                      <div class="bg-gray-50 border border-gray-200 rounded-lg p-4">
                        <h6 class="text-lg font-semibold text-gray-900 mb-3">
                          <i class="fas fa-users mr-2 text-teal-600"></i>Default Quota
                        </h6>
                        <p class="text-sm text-gray-600 mb-4">
                          Set the default monthly token quota for all doctors. This will be applied to new doctors and can be used to update existing doctors.
                        </p>
                        <div class="space-y-3">
                          <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">
                              Monthly Token Quota:
                            </label>
                            <input
                              type="number"
                              bind:value={defaultQuotaInput}
                              placeholder="Enter default quota"
                              class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                              min="0"
                              step="1000"
                            />
                            <p class="text-xs text-gray-500 mt-1">
                              Current: {aiTokenTracker.getDefaultQuota().toLocaleString()} tokens
                            </p>
            </div>
                          <div class="flex space-x-2">
                            <button
                              class="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors duration-200"
                              on:click={saveDefaultQuota}
                              disabled={!defaultQuotaInput || defaultQuotaInput < 0}
                            >
                              <i class="fas fa-save mr-1"></i>Save Default
                            </button>
                            <button
                              class="px-4 py-2 text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 rounded-lg transition-colors duration-200"
                              on:click={applyDefaultQuotaToAll}
                            >
                              <i class="fas fa-user-plus mr-1"></i>Apply to All
                            </button>
                          </div>
                        </div>
                      </div>
                      
                      <!-- Token Pricing Configuration -->
                      <div class="bg-gray-50 border border-gray-200 rounded-lg p-4">
                        <h6 class="text-lg font-semibold text-gray-900 mb-3">
                          <i class="fas fa-dollar-sign mr-2 text-teal-600"></i>Token Pricing
                        </h6>
                        <p class="text-sm text-gray-600 mb-4">
                          Set the cost per 1 million tokens. This affects cost calculations and estimates throughout the system.
                        </p>
                        <div class="space-y-3">
                          <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">
                              Price per 1M Tokens (USD):
                            </label>
                            <input
                              type="number"
                              bind:value={tokenPriceInput}
                              placeholder="Enter price per million tokens"
                              class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                              min="0"
                              step="0.01"
                            />
                            <p class="text-xs text-gray-500 mt-1">
                              Current: ${aiTokenTracker.getTokenPricePerMillion().toFixed(2)} per 1M tokens
                            </p>
                          </div>
                          <div class="flex space-x-2">
                            <button
                              class="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors duration-200"
                              on:click={saveTokenPrice}
                              disabled={!tokenPriceInput || tokenPriceInput < 0}
                            >
                              <i class="fas fa-save mr-1"></i>Save Price
                            </button>
                            <button
                              class="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors duration-200"
                              on:click={refreshCostEstimates}
                            >
                              <i class="fas fa-sync-alt mr-1"></i>Refresh Costs
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              <!-- Doctor Token Quotas Section -->
              <div class="mb-6">
                <div class="bg-white border border-gray-200 rounded-lg shadow-sm">
                  <div class="bg-gray-50 px-4 py-3 border-b border-gray-200">
                    <h5 class="text-lg font-semibold text-gray-900 mb-0">
                      <i class="fas fa-user-md mr-2 text-red-600"></i>Doctor Token Quotas
                    </h5>
                  </div>
                  <div class="p-4">
                    <!-- Desktop Table View -->
                    <div class="hidden lg:block overflow-x-auto">
                      <table class="min-w-full divide-y divide-gray-200">
                        <thead class="bg-gray-50">
                          <tr>
                            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Doctor Name</th>
                            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Monthly Quota</th>
                            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Used This Month</th>
                            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Remaining</th>
                            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                          </tr>
                        </thead>
                        <tbody class="bg-white divide-y divide-gray-200">
                          {#each aiTokenTracker.getAllDoctorsWithQuotas() as doctor}
                            <tr class="hover:bg-gray-50">
                              <td class="px-4 py-4 text-sm text-gray-900 break-words max-w-xs">
                                <div class="font-medium text-gray-900 truncate" title={getDoctorName(doctor.doctorId)}>{getDoctorName(doctor.doctorId)}</div>
                                <div class="text-xs text-gray-500 truncate" title={doctor.doctorId}>ID: {doctor.doctorId}</div>
                              </td>
                              <td class="px-4 py-4 text-sm text-gray-900">
                                {#if doctor.quota}
                                  <div class="truncate">{doctor.quota.monthlyTokens.toLocaleString()} tokens</div>
                                {:else}
                                  <span class="text-gray-400">No quota set</span>
                                {/if}
                              </td>
                              <td class="px-4 py-4 text-sm text-gray-900">
                                <div class="truncate">{doctor.monthlyUsage.tokens.toLocaleString()} tokens</div>
                                <div class="text-xs text-gray-500 truncate">${doctor.monthlyUsage.cost.toFixed(4)}</div>
                              </td>
                              <td class="px-4 py-4 text-sm text-gray-900">
                                {#if doctor.quotaStatus.hasQuota}
                                  <div class="truncate">{doctor.quotaStatus.remainingTokens.toLocaleString()} tokens</div>
                                {:else}
                                  <span class="text-gray-400">-</span>
                                {/if}
                              </td>
                              <td class="px-4 py-4 text-sm text-gray-900">
                                <div class="flex flex-col space-y-1">
                                  {#if doctor.quotaStatus.hasQuota}
                                    {#if doctor.quotaStatus.isExceeded}
                                      <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                        <i class="fas fa-exclamation-triangle mr-1"></i>Exceeded
                                      </span>
                                    {:else if doctor.quotaStatus.percentageUsed > 80}
                                      <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                                        <i class="fas fa-exclamation-circle mr-1"></i>Warning
                                      </span>
                                    {:else}
                                      <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                        <i class="fas fa-check-circle mr-1"></i>Good
                                      </span>
                                    {/if}
                                    <div class="text-xs text-gray-500">{doctor.quotaStatus.percentageUsed.toFixed(1)}% used</div>
                                  {:else}
                                    <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                      No Quota
                                    </span>
                                  {/if}
                                </div>
                              </td>
                              <td class="px-4 py-4 text-sm text-gray-900">
                                <button 
                                  class="text-red-600 hover:text-red-900 font-medium text-xs"
                                  on:click={() => openQuotaModal(doctor.doctorId, doctor.quota?.monthlyTokens || 0)}
                                >
                                  <i class="fas fa-edit mr-1"></i>Set Quota
                                </button>
                              </td>
                            </tr>
                          {:else}
                            <tr>
                              <td colspan="6" class="px-6 py-4 text-center text-gray-500">
                                <i class="fas fa-info-circle mr-2"></i>
                                No doctors with AI usage found
                              </td>
                            </tr>
                          {/each}
                        </tbody>
                      </table>
                    </div>
                    
                    <!-- Mobile Card View -->
                    <div class="lg:hidden space-y-4">
                      {#each aiTokenTracker.getAllDoctorsWithQuotas() as doctor}
                        <div class="bg-white border border-gray-200 rounded-lg shadow-sm p-4">
                          <div class="flex flex-col space-y-3">
                            <!-- Header Row -->
                            <div class="flex justify-between items-start">
                              <div class="flex-1 min-w-0">
                                <h3 class="text-sm font-medium text-gray-900 truncate" title={getDoctorName(doctor.doctorId)}>{getDoctorName(doctor.doctorId)}</h3>
                                <p class="text-xs text-gray-500 truncate" title={doctor.doctorId}>ID: {doctor.doctorId}</p>
                              </div>
                              <div class="ml-2">
                                {#if doctor.quotaStatus.hasQuota}
                                  {#if doctor.quotaStatus.isExceeded}
                                    <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                      <i class="fas fa-exclamation-triangle mr-1"></i>Exceeded
                                    </span>
                                  {:else if doctor.quotaStatus.percentageUsed > 80}
                                    <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                                      <i class="fas fa-exclamation-circle mr-1"></i>Warning
                                    </span>
                                  {:else}
                                    <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                      <i class="fas fa-check-circle mr-1"></i>Good
                                    </span>
                                  {/if}
                                {:else}
                                  <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                    No Quota
                                  </span>
                                {/if}
                              </div>
                            </div>
                            
                            <!-- Quota Details -->
                            <div class="grid grid-cols-2 gap-3 text-xs">
                              <div>
                                <span class="text-gray-500">Monthly Quota:</span>
                                <div class="font-medium text-gray-900">
                                  {#if doctor.quota}
                                    {doctor.quota.monthlyTokens.toLocaleString()} tokens
                                  {:else}
                                    <span class="text-gray-400">No quota set</span>
                                  {/if}
                                </div>
                              </div>
                              <div>
                                <span class="text-gray-500">Used This Month:</span>
                                <div class="font-medium text-gray-900">{doctor.monthlyUsage.tokens.toLocaleString()} tokens</div>
                                <div class="text-gray-500">${doctor.monthlyUsage.cost.toFixed(4)}</div>
                              </div>
                            </div>
                            
                            <!-- Remaining and Percentage -->
                            <div class="grid grid-cols-2 gap-3 text-xs">
                              <div>
                                <span class="text-gray-500">Remaining:</span>
                                <div class="font-medium text-gray-900">
                                  {#if doctor.quotaStatus.hasQuota}
                                    {doctor.quotaStatus.remainingTokens.toLocaleString()} tokens
                                  {:else}
                                    <span class="text-gray-400">-</span>
                                  {/if}
                                </div>
                              </div>
                              <div>
                                <span class="text-gray-500">Usage:</span>
                                <div class="font-medium text-gray-900">
                                  {#if doctor.quotaStatus.hasQuota}
                                    {doctor.quotaStatus.percentageUsed.toFixed(1)}% used
                                  {:else}
                                    <span class="text-gray-400">-</span>
                                  {/if}
                                </div>
                              </div>
                            </div>
                            
                            <!-- Actions -->
                            <div class="border-t pt-3">
                              <button 
                                class="w-full inline-flex items-center justify-center px-3 py-2 border border-red-300 text-red-700 bg-white hover:bg-red-50 text-sm font-medium rounded-lg"
                                on:click={() => openQuotaModal(doctor.doctorId, doctor.quota?.monthlyTokens || 0)}
                              >
                                <i class="fas fa-edit mr-2"></i>Set Quota
                              </button>
                            </div>
                          </div>
                        </div>
                      {:else}
                        <div class="text-center py-8 text-gray-500">
                          <i class="fas fa-info-circle mr-2"></i>
                          No doctors with AI usage found
                        </div>
                      {/each}
                    </div>
                  </div>
                </div>
              </div>
            {:else}
              <div class="bg-white border border-gray-200 rounded-lg shadow-sm">
                <div class="text-center py-8">
                  <i class="fas fa-brain text-4xl text-gray-400 mb-3"></i>
                  <h5 class="text-gray-500">No AI Usage Data Available</h5>
                  <p class="text-gray-500 mb-6">AI usage statistics will appear here once AI features are used.</p>
                  <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <i class="fas fa-info-circle mr-2 text-blue-600"></i>
                    <strong class="text-blue-800">Getting Started:</strong> <span class="text-blue-700">AI usage tracking begins when doctors use AI features like:</span>
                    <ul class="list-disc list-inside mt-2 text-sm text-blue-700">
                      <li><i class="fas fa-check text-teal-600 mr-1"></i> AI Medical Analysis</li>
                      <li><i class="fas fa-check text-teal-600 mr-1"></i> AI Drug Suggestions</li>
                      <li><i class="fas fa-check text-teal-600 mr-1"></i> AI Chat Assistant</li>
                    </ul>
                  </div>
                </div>
              </div>
            {/if}
            
          {:else if activeTab === 'ai-logs'}
            <!-- AI Logs Tab -->
            <div class="flex justify-between items-center mb-6">
              <h2 class="text-2xl font-bold text-gray-900"><i class="fas fa-brain mr-2 text-red-600"></i>AI Prompt Logs</h2>
            </div>
            
            <AIPromptLogs />
            
          {:else if activeTab === 'system'}
            <!-- System Tab -->
            <div class="flex justify-between items-center mb-6">
              <h2 class="text-2xl font-bold text-gray-900"><i class="fas fa-cog mr-2 text-red-600"></i>System Settings</h2>
            </div>
            
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div class="bg-white border border-gray-200 rounded-lg shadow-sm">
                <div class="bg-gray-50 px-4 py-3 border-b border-gray-200">
                  <h5 class="text-lg font-semibold text-gray-900 mb-0">System Information</h5>
                  </div>
                <div class="p-4">
                    <dl class="grid grid-cols-1 gap-4">
                      <div class="flex justify-between">
                        <dt class="text-sm font-medium text-gray-500">Version:</dt>
                        <dd class="text-sm text-gray-900">1.0.0</dd>
                      </div>
                      
                      <div class="flex justify-between">
                        <dt class="text-sm font-medium text-gray-500">Last Updated:</dt>
                        <dd class="text-sm text-gray-900">{new Date().toLocaleDateString()}</dd>
                      </div>
                      
                      <div class="flex justify-between">
                        <dt class="text-sm font-medium text-gray-500">Admin Email:</dt>
                        <dd class="text-sm text-gray-900">senakahks@gmail.com</dd>
                      </div>
                    </dl>
                  </div>
                </div>
              </div>
              
              <div class="bg-white border border-gray-200 rounded-lg shadow-sm">
                <div class="bg-gray-50 px-4 py-3 border-b border-gray-200">
                  <h5 class="text-lg font-semibold text-gray-900 mb-0">Quick Actions</h5>
                  </div>
                <div class="p-4">
                  <div class="space-y-3">
                    <button class="w-full inline-flex items-center justify-center px-4 py-2 border border-blue-300 text-blue-700 bg-white hover:bg-blue-50 text-sm font-medium rounded-lg">
                      <i class="fas fa-download mr-2"></i>Export Data
                      </button>
                    <button class="w-full inline-flex items-center justify-center px-4 py-2 border border-yellow-300 text-yellow-700 bg-white hover:bg-yellow-50 text-sm font-medium rounded-lg">
                      <i class="fas fa-backup mr-2"></i>Backup System
                      </button>
                    <button class="w-full inline-flex items-center justify-center px-4 py-2 border border-blue-300 text-blue-700 bg-white hover:bg-blue-50 text-sm font-medium rounded-lg" on:click={refreshData}>
                      <i class="fas fa-sync-alt mr-2"></i>Refresh Data
                      </button>
                    </div>
                  </div>
              </div>
          {/if}
                </div>
              </div>
            </div>
          {/if}
        </div>

<!-- Quota Management Modal -->
{#if showQuotaModal}
  <div 
    id="quotaModal" 
    tabindex="-1" 
    aria-hidden="true" 
    class="fixed top-0 left-0 right-0 z-50 w-full p-4 overflow-x-hidden overflow-y-auto md:inset-0 h-[calc(100%-1rem)] max-h-full bg-gray-900 bg-opacity-50"
    on:click={closeQuotaModal}
    on:keydown={(e) => { if (e.key === 'Escape') closeQuotaModal() }}
    role="dialog"
    aria-modal="true"
    aria-labelledby="quota-modal-title"
  >
    <div class="relative w-full max-w-md max-h-full mx-auto flex items-center justify-center min-h-screen">
      <div 
        class="relative bg-white rounded-lg shadow-xl dark:bg-gray-700 transform transition-all duration-300 ease-out scale-100"
        on:click|stopPropagation
      >
        <div class="flex items-center justify-between p-4 md:p-5 border-b rounded-t-lg dark:border-gray-600">
          <h3 id="quota-modal-title" class="text-xl font-semibold text-gray-900 dark:text-white flex items-center">
            <i class="fas fa-user-md mr-2 text-red-600"></i>
            Set Token Quota
          </h3>
          <button 
            type="button" 
            class="text-gray-400 bg-transparent hover:bg-gray-200 hover:text-gray-900 rounded-lg text-sm w-8 h-8 ms-auto inline-flex justify-center items-center dark:hover:bg-gray-600 dark:hover:text-white transition-colors duration-200" 
            data-modal-hide="quotaModal"
            on:click={closeQuotaModal}
          >
            <svg class="w-3 h-3" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 14 14">
              <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m1 1 6 6m0 0 6 6M7 7l6-6M7 7l-6 6"/>
            </svg>
            <span class="sr-only">Close modal</span>
          </button>
        </div>
        
        <!-- Flowbite Modal Body -->
        <div class="p-4 md:p-5 space-y-4">
          <div class="space-y-3">
            <div class="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
              <label class="block text-sm font-medium text-gray-900 dark:text-white mb-1">
                Doctor: <span class="font-semibold text-red-600">{getDoctorName(selectedDoctorId)}</span>
              </label>
              <span class="text-xs text-gray-500 dark:text-gray-400">ID: {selectedDoctorId}</span>
            </div>
            
            <div>
              <label for="quotaInput" class="block text-sm font-medium text-gray-900 dark:text-white mb-2">
                Monthly Token Quota:
              </label>
              <input
                type="number"
                id="quotaInput"
                bind:value={quotaInput}
                placeholder="Enter monthly token quota"
                class="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-red-500 focus:border-red-500 block w-full p-2.5 dark:bg-gray-600 dark:border-gray-500 dark:placeholder-gray-400 dark:text-white transition-colors duration-200"
                min="0"
                step="1000"
              />
              <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Set the maximum number of tokens this doctor can use per month
              </p>
            </div>
          </div>
        </div>

        <!-- Flowbite Modal Footer -->
        <div class="flex items-center justify-end p-4 md:p-5 border-t border-gray-200 rounded-b-lg dark:border-gray-600 space-x-3">
          <button
            type="button"
            class="py-2.5 px-5 text-sm font-medium text-gray-900 focus:outline-none bg-white rounded-lg border border-gray-200 hover:bg-gray-100 hover:text-blue-700 focus:z-10 focus:ring-4 focus:ring-gray-100 dark:focus:ring-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-600 dark:hover:text-white dark:hover:bg-gray-700 transition-colors duration-200"
            on:click={closeQuotaModal}
          >
            Cancel
          </button>
          <button
            type="button"
            class="text-white bg-red-600 hover:bg-red-700 focus:ring-4 focus:outline-none focus:ring-red-300 font-medium rounded-lg text-sm px-5 py-2.5 text-center dark:bg-red-500 dark:hover:bg-red-600 dark:focus:ring-red-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
            on:click={saveQuota}
            disabled={!quotaInput || quotaInput < 0}
          >
            <i class="fas fa-save mr-1"></i>
            Save Quota
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}

<!-- Confirmation Modal -->
<ConfirmationModal
  visible={showConfirmationModal}
  title={confirmationConfig.title}
  message={confirmationConfig.message}
  confirmText={confirmationConfig.confirmText}
  cancelText={confirmationConfig.cancelText}
  type={confirmationConfig.type}
  on:confirm={handleConfirmationConfirm}
  on:cancel={handleConfirmationCancel}
  on:close={handleConfirmationCancel}
/>

<!-- Flowbite styling -->
