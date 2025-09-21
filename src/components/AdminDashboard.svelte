<script>
  import { createEventDispatcher, onMount } from 'svelte'
  import adminAuthService from '../services/adminAuthService.js'
  import firebaseStorage from '../services/firebaseStorage.js'
  import aiTokenTracker from '../services/aiTokenTracker.js'
  import AIPromptLogs from './AIPromptLogs.svelte'
  
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
  
  // Reactive statement to reload data when currentAdmin changes
  $: if (currentAdmin) {
    console.log('🔄 AdminDashboard: currentAdmin changed, reloading...')
    loadAdminData()
  }
  
  // Load admin data on component mount
  onMount(async () => {
    console.log('🚀 AdminDashboard component mounted')
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
      
      // Get patient counts for each doctor (aggregated data only)
      for (const doctor of doctors) {
        try {
          console.log(`🔍 Getting patient count for doctor: ${doctor.email}`)
          const doctorPatients = await firebaseStorage.getPatientsByDoctorId(doctor.id)
          console.log(`🔍 Doctor ${doctor.email} has ${doctorPatients.length} patients`)
          
          // Add patient count to doctor object for display (aggregated data only)
          doctor.patientCount = doctorPatients.length
        } catch (error) {
          console.error(`❌ Error loading patient count for doctor ${doctor.id}:`, error)
          doctor.patientCount = 0
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

  // Delete doctor
  const deleteDoctor = async (doctor) => {
    try {
      // Show confirmation dialog
      const confirmed = confirm(
        `Are you sure you want to delete doctor "${doctor.name || doctor.email}"?\n\n` +
        `This will permanently delete:\n` +
        `• The doctor account\n` +
        `• All patients belonging to this doctor\n` +
        `• All prescriptions, symptoms, and illnesses\n` +
        `• All drug database entries\n\n` +
        `This action cannot be undone!`
      )
      
      if (!confirmed) {
        return
      }
      
      // Show loading state
      const deleteButton = document.querySelector(`[data-doctor-id="${doctor.id}"]`)
      if (deleteButton) {
        deleteButton.disabled = true
        deleteButton.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Deleting...'
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
      alert(`Doctor "${doctor.name || doctor.email}" has been deleted successfully.`)
      
    } catch (error) {
      console.error('❌ Admin: Error deleting doctor:', error)
      alert('Error deleting doctor. Please try again.')
      
      // Reset button state
      const deleteButton = document.querySelector(`[data-doctor-id="${doctor.id}"]`)
      if (deleteButton) {
        deleteButton.disabled = false
        deleteButton.innerHTML = '<i class="fas fa-trash me-2"></i>Delete'
      }
    }
  }
</script>

<div class="min-vh-100 bg-light">
  {#if loading}
    <div class="d-flex justify-content-center align-items-center vh-100">
      <div class="text-center">
        <div class="spinner-border text-danger mb-3" role="status">
          <span class="visually-hidden">Loading...</span>
        </div>
        <p class="text-muted">Loading admin dashboard...</p>
      </div>
    </div>
  {:else}
    <!-- Admin Header -->
    <nav class="navbar navbar-expand-lg navbar-dark bg-dark" style="height: 50px; min-height: 50px; max-height: 50px; padding: 0.25rem 1rem;">
      <div class="container-fluid">
        <span class="navbar-brand fs-5 fw-semibold text-white py-1 my-0">
          <i class="fas fa-shield-alt me-2"></i>
          Admin Panel
        </span>
        
        <div class="navbar-nav ms-auto d-flex flex-row align-items-center m-0 p-0">
          <div class="nav-item dropdown">
            <button class="nav-link dropdown-toggle text-white border-0 bg-transparent py-1 px-2 small" type="button" data-bs-toggle="dropdown">
              <i class="fas fa-user-shield me-2"></i>
              {currentAdmin?.name || 'Admin'}
            </button>
            <ul class="dropdown-menu dropdown-menu-end">
              <li><h6 class="dropdown-header">Admin Account</h6></li>
              <li><span class="dropdown-item-text">{currentAdmin?.email}</span></li>
              <li><hr class="dropdown-divider"></li>
              <li>
                <button class="dropdown-item" on:click={handleSignOut}>
                  <i class="fas fa-sign-out-alt me-2"></i>Sign Out
                </button>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </nav>
    
    <!-- Main Content -->
    <div class="container-fluid mt-4">
      <div class="row mx-2 mx-md-3 mx-lg-4">
        <!-- Sidebar -->
        <div class="col-md-3 col-lg-2">
          <div class="list-group">
            <button
              class="list-group-item list-group-item-action {activeTab === 'overview' ? 'active' : ''}"
              on:click={() => handleTabChange('overview')}
            >
              <i class="fas fa-chart-bar me-2"></i>Overview
            </button>
            <button
              class="list-group-item list-group-item-action {activeTab === 'doctors' ? 'active' : ''}"
              on:click={() => handleTabChange('doctors')}
            >
              <i class="fas fa-user-md me-2"></i>Doctors
            </button>
            <!-- Patients tab removed for HIPAA compliance - admins should not access patient PHI data -->
            <button
              class="list-group-item list-group-item-action {activeTab === 'ai-usage' ? 'active' : ''}"
              on:click={() => handleTabChange('ai-usage')}
            >
              <i class="fas fa-brain me-2 text-danger"></i>AI Usage
            </button>
            <button
              class="list-group-item list-group-item-action {activeTab === 'ai-logs' ? 'active' : ''}"
              on:click={() => handleTabChange('ai-logs')}
            >
              <i class="fas fa-brain me-2 text-danger"></i>AI Logs
            </button>
            <button
              class="list-group-item list-group-item-action {activeTab === 'system' ? 'active' : ''}"
              on:click={() => handleTabChange('system')}
            >
              <i class="fas fa-cog me-2"></i>System
            </button>
          </div>
        </div>
        
        <!-- Main Content Area -->
        <div class="col-md-9 col-lg-10">
          {#if activeTab === 'overview'}
            <!-- Overview Tab -->
            <div class="d-flex justify-content-between align-items-center mb-4">
              <h2><i class="fas fa-chart-bar me-2 text-danger"></i>System Overview</h2>
              <button class="btn btn-outline-primary btn-sm" on:click={refreshData}>
                <i class="fas fa-sync-alt me-2"></i>Refresh
              </button>
            </div>
            
            <!-- HIPAA Compliance Notice -->
            <div class="alert alert-info mb-4" role="alert">
              <i class="fas fa-shield-alt me-2"></i>
              <strong>HIPAA Compliance:</strong> This admin panel displays only aggregated system statistics. 
              Individual patient data is not accessible to administrators to maintain HIPAA compliance and patient privacy.
            </div>
            
            <!-- Statistics Cards -->
            <div class="row mb-4">
              <div class="col-md-6 col-lg-2 mb-3">
                <div class="card border-primary">
                  <div class="card-body text-center">
                    <i class="fas fa-user-md fa-2x text-primary mb-2"></i>
                    <h5 class="card-title">{statistics.totalDoctors}</h5>
                    <p class="card-text text-muted">Total Doctors</p>
                  </div>
                </div>
              </div>
              
              <div class="col-md-6 col-lg-2 mb-3">
                <div class="card border-success">
                  <div class="card-body text-center">
                    <i class="fas fa-users fa-2x text-success mb-2"></i>
                    <h5 class="card-title">{statistics.totalPatients}</h5>
                    <p class="card-text text-muted">Total Patients <small>(Aggregated)</small></p>
                  </div>
                </div>
              </div>
              
              <div class="col-md-6 col-lg-2 mb-3">
                <div class="card border-warning">
                  <div class="card-body text-center">
                    <i class="fas fa-pills fa-2x text-warning mb-2"></i>
                    <h5 class="card-title">{statistics.totalPrescriptions}</h5>
                    <p class="card-text text-muted">Total Prescriptions <small>(Aggregated)</small></p>
                  </div>
                </div>
              </div>
              
              <div class="col-md-6 col-lg-2 mb-3">
                <div class="card border-info">
                  <div class="card-body text-center">
                    <i class="fas fa-heartbeat fa-2x text-info mb-2"></i>
                    <h5 class="card-title">{statistics.totalSymptoms}</h5>
                    <p class="card-text text-muted">Total Symptoms <small>(Aggregated)</small></p>
                  </div>
                </div>
              </div>
              
              <div class="col-md-6 col-lg-2 mb-3">
                <div class="card border-danger">
                  <div class="card-body text-center">
                    <i class="fas fa-brain fa-2x text-danger mb-2"></i>
                    <h5 class="card-title">
                      {#if aiUsageStats}
                        ${aiUsageStats.total.cost.toFixed(3)}
                      {:else}
                        $0.000
                      {/if}
                    </h5>
                    <p class="card-text text-muted">AI Cost <small>(Est.)</small></p>
                  </div>
                </div>
              </div>
            </div>
            
            <!-- Recent Activity -->
            <div class="card border-2 border-info shadow-sm">
              <div class="card-header">
                <h5 class="mb-0"><i class="fas fa-clock me-2"></i>Recent Activity</h5>
              </div>
              <div class="card-body">
                <p class="text-muted">Recent system activity will be displayed here.</p>
              </div>
            </div>
            
          {:else if activeTab === 'doctors'}
            <!-- Doctors Tab -->
            <div class="d-flex justify-content-between align-items-center mb-4">
              <h2><i class="fas fa-user-md me-2 text-danger"></i>Doctors Management</h2>
              <span class="badge bg-primary fs-6">{doctors.length} Doctors</span>
            </div>
            
            <div class="card border-2 border-info shadow-sm">
              <div class="card-header">
                <h5 class="mb-0">All Registered Doctors</h5>
              </div>
              <div class="card-body">
                {#if doctors.length > 0}
                  <div class="table-responsive">
                    <table class="table table-hover">
                      <thead>
                        <tr>
                          <th>Email</th>
                          <th>Name</th>
                          <th>Role</th>
                          <th>Created</th>
                          <th>Patients</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {#each doctors as doctor}
                          <tr>
                            <td>{doctor.email}</td>
                            <td>{doctor.name || 'N/A'}</td>
                            <td>
                              <span class="badge bg-primary">{doctor.role}</span>
                              {#if doctor.isAdmin}
                                <span class="badge bg-danger ms-1">Admin</span>
                              {/if}
                            </td>
                            <td>{formatDate(doctor.createdAt)}</td>
                            <td>{doctor.patientCount || 0}</td>
                            <td>
                              {#if doctor.email !== 'senakahks@gmail.com'}
                                <button 
                                  class="btn btn-outline-danger btn-sm"
                                  data-doctor-id={doctor.id}
                                  on:click={() => deleteDoctor(doctor)}
                                  title="Delete doctor and all related data"
                                >
                                  <i class="fas fa-trash me-2"></i>Delete
                                </button>
                              {:else}
                                <span class="text-muted small">
                                  <i class="fas fa-shield-alt me-1"></i>Super Admin
                                </span>
                              {/if}
                            </td>
                          </tr>
                        {/each}
                      </tbody>
                    </table>
                  </div>
                {:else}
                  <p class="text-muted text-center py-4">No doctors registered yet.</p>
                {/if}
              </div>
            </div>
            
          <!-- Patients tab removed for HIPAA compliance -->
          <!-- Admins should not have access to patient PHI data -->
          <!-- Patient data access is restricted to individual doctors only -->
          {:else if activeTab === 'ai-usage'}
            <!-- AI Usage Tab -->
            <div class="d-flex justify-content-between align-items-center mb-4">
              <h2><i class="fas fa-brain me-2 text-danger"></i>AI Usage Analytics</h2>
              <button class="btn btn-outline-danger btn-sm" on:click={loadAIUsageStats}>
                <i class="fas fa-sync-alt me-1"></i>Refresh
              </button>
            </div>
            
            {#if aiUsageStats}
              <!-- Cost Disclaimer -->
              <div class="alert alert-warning mb-4" role="alert">
                <i class="fas fa-exclamation-triangle me-2"></i>
                <strong>Cost Disclaimer:</strong> These cost estimates are approximate and may not reflect actual OpenAI billing. 
                Actual costs may be higher due to taxes, fees, or pricing changes. 
                Check your <a href="https://platform.openai.com/usage" target="_blank" class="alert-link">OpenAI dashboard</a> for exact billing amounts.
              </div>
              
              <!-- Usage Overview Cards -->
              <div class="row mb-4">
                <div class="col-md-3">
                  <div class="card border-2 border-info text-center shadow-sm">
                    <div class="card-body">
                      <h5 class="card-title text-primary">
                        <i class="fas fa-coins me-2"></i>Total Cost
                      </h5>
                      <h3 class="text-primary">${aiUsageStats.total.cost.toFixed(4)}</h3>
                      <small class="text-muted">All Time</small>
                    </div>
                  </div>
                </div>
                <div class="col-md-3">
                  <div class="card border-2 border-info text-center shadow-sm">
                    <div class="card-body">
                      <h5 class="card-title text-success">
                        <i class="fas fa-hashtag me-2"></i>Total Tokens
                      </h5>
                      <h3 class="text-success">{aiUsageStats.total.tokens.toLocaleString()}</h3>
                      <small class="text-muted">All Time</small>
                    </div>
                  </div>
                </div>
                <div class="col-md-3">
                  <div class="card border-2 border-info text-center shadow-sm">
                    <div class="card-body">
                      <h5 class="card-title text-info">
                        <i class="fas fa-bolt me-2"></i>Total Requests
                      </h5>
                      <h3 class="text-info">{aiUsageStats.total.requests}</h3>
                      <small class="text-muted">All Time</small>
                    </div>
                  </div>
                </div>
                <div class="col-md-3">
                  <div class="card border-2 border-info text-center shadow-sm">
                    <div class="card-body">
                      <h5 class="card-title text-warning">
                        <i class="fas fa-calendar-day me-2"></i>Today
                      </h5>
                      <h3 class="text-warning">${aiUsageStats.today.cost.toFixed(4)}</h3>
                      <small class="text-muted">{aiUsageStats.today.requests} requests</small>
                    </div>
                  </div>
                </div>
              </div>
              
              <!-- Second row of overview cards -->
              <div class="row mb-4">
                <div class="col-md-4">
                  <div class="card border-2 border-success text-center shadow-sm">
                    <div class="card-body">
                      <h5 class="card-title text-success">
                        <i class="fas fa-calendar-alt me-2"></i>This Month
                      </h5>
                      <h3 class="text-success">${aiUsageStats.thisMonth.cost.toFixed(4)}</h3>
                      <small class="text-muted">{aiUsageStats.thisMonth.requests} requests, {(aiUsageStats.thisMonth.tokens || 0).toLocaleString()} tokens</small>
                    </div>
                  </div>
                </div>
                <div class="col-md-4">
                  <div class="card border-2 border-info text-center shadow-sm">
                    <div class="card-body">
                      <h5 class="card-title text-info">
                        <i class="fas fa-percentage me-2"></i>Avg Cost/Request
                      </h5>
                      <h3 class="text-info">${aiUsageStats.total.requests > 0 ? (aiUsageStats.total.cost / aiUsageStats.total.requests).toFixed(4) : '0.0000'}</h3>
                      <small class="text-muted">All Time Average</small>
                    </div>
                  </div>
                </div>
                <div class="col-md-4">
                  <div class="card border-2 border-primary text-center shadow-sm">
                    <div class="card-body">
                      <h5 class="card-title text-primary">
                        <i class="fas fa-clock me-2"></i>Last Updated
                      </h5>
                      <h6 class="text-primary">{aiUsageStats.lastUpdated ? new Date(aiUsageStats.lastUpdated).toLocaleString() : 'Never'}</h6>
                      <small class="text-muted">Usage Data</small>
                    </div>
                  </div>
              </div>
              
              <!-- Daily Usage Chart -->
              <div class="row mb-4">
                <div class="col-12">
                  <div class="card">
                    <div class="card-header">
                      <h5 class="mb-0">
                        <i class="fas fa-chart-line me-2"></i>Daily Usage (Last 7 Days)
                      </h5>
                    </div>
                    <div class="card-body">
                      <div class="table-responsive">
                        <table class="table table-sm table-hover">
                          <thead>
                            <tr>
                              <th>Date</th>
                              <th>Requests</th>
                              <th>Tokens</th>
                              <th>Cost</th>
                            </tr>
                          </thead>
                          <tbody>
                            {#each aiTokenTracker.getWeeklyUsage() as day}
                              <tr>
                                <td>{new Date(day.date).toLocaleDateString()}</td>
                                <td>{day.requests || 0}</td>
                                <td>{(day.tokens || 0).toLocaleString()}</td>
                                <td>${(day.cost || 0).toFixed(4)}</td>
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
              <div class="row mb-4">
                <div class="col-12">
                  <div class="card">
                    <div class="card-header">
                      <h5 class="mb-0">
                        <i class="fas fa-chart-bar me-2"></i>Monthly Usage (Last 6 Months)
                      </h5>
                    </div>
                    <div class="card-body">
                      <div class="table-responsive">
                        <table class="table table-sm table-hover">
                          <thead>
                            <tr>
                              <th>Month</th>
                              <th>Requests</th>
                              <th>Tokens</th>
                              <th>Cost</th>
                            </tr>
                          </thead>
                          <tbody>
                            {#each aiTokenTracker.getMonthlyUsage() as month}
                              <tr>
                                <td>{new Date(month.month + '-01').toLocaleDateString('en-US', { year: 'numeric', month: 'long' })}</td>
                                <td>{month.requests || 0}</td>
                                <td>{(month.tokens || 0).toLocaleString()}</td>
                                <td>${(month.cost || 0).toFixed(4)}</td>
                              </tr>
                            {/each}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              <!-- Recent Requests -->
              <div class="row">
                <div class="col-12">
                  <div class="card">
                    <div class="card-header">
                      <h5 class="mb-0">
                        <i class="fas fa-history me-2 text-danger"></i>Recent AI Requests
                      </h5>
                    </div>
                    <div class="card-body">
                      <div class="table-responsive">
                        <table class="table table-sm table-hover">
                          <thead>
                            <tr>
                              <th>Time</th>
                              <th>Type</th>
                              <th>Tokens</th>
                              <th>Cost</th>
                            </tr>
                          </thead>
                          <tbody>
                            {#each aiTokenTracker.getRecentRequests(10) as request}
                              <tr>
                                <td>{new Date(request.timestamp).toLocaleString()}</td>
                                <td>
                                  <span class="badge bg-primary">
                                    {request.type.replace('generate', '').replace('check', '')}
                                  </span>
                                </td>
                                <td>{request.totalTokens.toLocaleString()}</td>
                                <td>${request.cost.toFixed(4)}</td>
                              </tr>
                            {:else}
                              <tr>
                                <td colspan="4" class="text-center text-muted py-3">
                                  <i class="fas fa-info-circle me-2"></i>
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
              </div>
            </div>
            {:else}
              <div class="card">
                <div class="card-body text-center py-5">
                  <i class="fas fa-brain fa-3x text-muted mb-3"></i>
                  <h5 class="text-muted">No AI Usage Data Available</h5>
                  <p class="text-muted mb-4">AI usage statistics will appear here once AI features are used.</p>
                  <div class="alert alert-info">
                    <i class="fas fa-info-circle me-2"></i>
                    <strong>Getting Started:</strong> AI usage tracking begins when doctors use AI features like:
                    <ul class="list-unstyled mt-2 mb-0">
                      <li><i class="fas fa-check text-success me-1"></i> AI Medical Analysis</li>
                      <li><i class="fas fa-check text-success me-1"></i> AI Drug Suggestions</li>
                      <li><i class="fas fa-check text-success me-1"></i> AI Chat Assistant</li>
                    </ul>
                  </div>
                </div>
              </div>
            {/if}
            
          {:else if activeTab === 'ai-logs'}
            <!-- AI Logs Tab -->
            <div class="d-flex justify-content-between align-items-center mb-4">
              <h2><i class="fas fa-brain me-2 text-danger"></i>AI Prompt Logs</h2>
            </div>
            
            <AIPromptLogs />
            
          {:else if activeTab === 'system'}
            <!-- System Tab -->
            <div class="d-flex justify-content-between align-items-center mb-4">
              <h2><i class="fas fa-cog me-2 text-danger"></i>System Settings</h2>
            </div>
            
            <div class="row">
              <div class="col-md-6">
                <div class="card">
                  <div class="card-header">
                    <h5 class="mb-0">System Information</h5>
                  </div>
                  <div class="card-body">
                    <dl class="row">
                      <dt class="col-sm-4">Version:</dt>
                      <dd class="col-sm-8">1.0.0</dd>
                      
                      <dt class="col-sm-4">Last Updated:</dt>
                      <dd class="col-sm-8">{new Date().toLocaleDateString()}</dd>
                      
                      <dt class="col-sm-4">Admin Email:</dt>
                      <dd class="col-sm-8">senakahks@gmail.com</dd>
                    </dl>
                  </div>
                </div>
              </div>
              
              <div class="col-md-6">
                <div class="card">
                  <div class="card-header">
                    <h5 class="mb-0">Quick Actions</h5>
                  </div>
                  <div class="card-body">
                    <div class="d-grid gap-2">
                      <button class="btn btn-outline-primary btn-sm">
                        <i class="fas fa-download me-2"></i>Export Data
                      </button>
                      <button class="btn btn-outline-warning btn-sm">
                        <i class="fas fa-backup me-2"></i>Backup System
                      </button>
                      <button class="btn btn-outline-info btn-sm" on:click={refreshData}>
                        <i class="fas fa-sync-alt me-2"></i>Refresh Data
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          {/if}
        </div>
      </div>
    </div>
  {/if}
</div>

<!-- Bootstrap 5 styling handled by utility classes -->
