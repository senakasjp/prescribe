<script>
  import { createEventDispatcher, onMount } from 'svelte'
  import adminAuthService from '../services/adminAuthService.js'
  import jsonStorage from '../services/jsonStorage.js'
  import aiTokenTracker from '../services/aiTokenTracker.js'
  
  const dispatch = createEventDispatcher()
  
  let currentAdmin = null
  let statistics = {
    totalDoctors: 0,
    totalPatients: 0,
    totalPrescriptions: 0,
    totalSymptoms: 0,
    totalIllnesses: 0
  }
  let aiUsageStats = null
  let doctors = []
  let patients = []
  let loading = true
  let activeTab = 'overview'
  
  // Load admin data on component mount
  onMount(() => {
    loadAdminData()
  })
  
  // Load admin data and statistics
  const loadAdminData = async () => {
    try {
      loading = true
      currentAdmin = adminAuthService.getCurrentAdmin()
      
      if (!currentAdmin) {
        dispatch('admin-signed-out')
        return
      }
      
      // Load statistics
      await loadStatistics()
      
      // Load AI usage statistics
      loadAIUsageStats()
      
      // Load doctors and patients data
      await loadDoctorsAndPatients()
      
    } catch (error) {
      console.error('❌ Error loading admin data:', error)
    } finally {
      loading = false
    }
  }
  
  // Load system statistics
  const loadStatistics = async () => {
    try {
      // Get all doctors
      const allDoctors = jsonStorage.getAllDoctors()
      statistics.totalDoctors = allDoctors.length
      
      // Get all patients across all doctors
      let totalPatients = 0
      let totalPrescriptions = 0
      let totalSymptoms = 0
      let totalIllnesses = 0
      
      for (const doctor of allDoctors) {
        const doctorPatients = jsonStorage.getPatients(doctor.id)
        totalPatients += doctorPatients.length
        
        for (const patient of doctorPatients) {
          const prescriptions = jsonStorage.getPrescriptions(patient.id, doctor.id)
          const symptoms = jsonStorage.getSymptoms(patient.id, doctor.id)
          const illnesses = jsonStorage.getIllnesses(patient.id, doctor.id)
          
          totalPrescriptions += prescriptions.length
          totalSymptoms += symptoms.length
          totalIllnesses += illnesses.length
        }
      }
      
      statistics.totalPatients = totalPatients
      statistics.totalPrescriptions = totalPrescriptions
      statistics.totalSymptoms = totalSymptoms
      statistics.totalIllnesses = totalIllnesses
      
    } catch (error) {
      console.error('❌ Error loading statistics:', error)
    }
  }
  
  // Load AI usage statistics
  const loadAIUsageStats = () => {
    try {
      aiUsageStats = aiTokenTracker.getUsageStats()
      console.log('📊 AI usage stats loaded:', aiUsageStats)
    } catch (error) {
      console.error('❌ Error loading AI usage stats:', error)
      aiUsageStats = null
    }
  }
  
  // Load doctors and patients data
  const loadDoctorsAndPatients = async () => {
    try {
      doctors = jsonStorage.getAllDoctors()
      patients = []
      
      // Get patients from all doctors
      for (const doctor of doctors) {
        const doctorPatients = jsonStorage.getPatients(doctor.id)
        for (const patient of doctorPatients) {
          patients.push({
            ...patient,
            doctorEmail: doctor.email,
            doctorName: doctor.name || 'Unknown Doctor'
          })
        }
      }
      
    } catch (error) {
      console.error('❌ Error loading doctors and patients:', error)
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
      <div class="row">
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
            <button
              class="list-group-item list-group-item-action {activeTab === 'patients' ? 'active' : ''}"
              on:click={() => handleTabChange('patients')}
            >
              <i class="fas fa-users me-2"></i>Patients
            </button>
            <button
              class="list-group-item list-group-item-action {activeTab === 'ai-usage' ? 'active' : ''}"
              on:click={() => handleTabChange('ai-usage')}
            >
              <i class="fas fa-robot me-2"></i>AI Usage
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
                    <p class="card-text text-muted">Total Patients</p>
                  </div>
                </div>
              </div>
              
              <div class="col-md-6 col-lg-2 mb-3">
                <div class="card border-warning">
                  <div class="card-body text-center">
                    <i class="fas fa-pills fa-2x text-warning mb-2"></i>
                    <h5 class="card-title">{statistics.totalPrescriptions}</h5>
                    <p class="card-text text-muted">Total Prescriptions</p>
                  </div>
                </div>
              </div>
              
              <div class="col-md-6 col-lg-2 mb-3">
                <div class="card border-info">
                  <div class="card-body text-center">
                    <i class="fas fa-heartbeat fa-2x text-info mb-2"></i>
                    <h5 class="card-title">{statistics.totalSymptoms}</h5>
                    <p class="card-text text-muted">Total Symptoms</p>
                  </div>
                </div>
              </div>
              
              <div class="col-md-6 col-lg-2 mb-3">
                <div class="card border-danger">
                  <div class="card-body text-center">
                    <i class="fas fa-robot fa-2x text-danger mb-2"></i>
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
            <div class="card">
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
            
            <div class="card">
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
                        </tr>
                      </thead>
                      <tbody>
                        {#each doctors as doctor}
                          <tr>
                            <td>{doctor.email}</td>
                            <td>{doctor.name || 'N/A'}</td>
                            <td><span class="badge bg-primary">{doctor.role}</span></td>
                            <td>{formatDate(doctor.createdAt)}</td>
                            <td>{jsonStorage.getPatients(doctor.id).length}</td>
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
            
          {:else if activeTab === 'patients'}
            <!-- Patients Tab -->
            <div class="d-flex justify-content-between align-items-center mb-4">
              <h2><i class="fas fa-users me-2 text-danger"></i>Patients Management</h2>
              <span class="badge bg-success fs-6">{patients.length} Patients</span>
            </div>
            
            <div class="card">
              <div class="card-header">
                <h5 class="mb-0">All Patients</h5>
              </div>
              <div class="card-body">
                {#if patients.length > 0}
                  <div class="table-responsive">
                    <table class="table table-hover">
                      <thead>
                        <tr>
                          <th>Name</th>
                          <th>Email</th>
                          <th>Phone</th>
                          <th>Doctor</th>
                          <th>Created</th>
                        </tr>
                      </thead>
                      <tbody>
                        {#each patients as patient}
                          <tr>
                            <td>{patient.firstName} {patient.lastName}</td>
                            <td>{patient.email || 'N/A'}</td>
                            <td>{patient.phone || 'N/A'}</td>
                            <td>{patient.doctorEmail}</td>
                            <td>{formatDate(patient.createdAt)}</td>
                          </tr>
                        {/each}
                      </tbody>
                    </table>
                  </div>
                {:else}
                  <p class="text-muted text-center py-4">No patients registered yet.</p>
                {/if}
              </div>
            </div>
            
          {:else if activeTab === 'ai-usage'}
            <!-- AI Usage Tab -->
            <div class="d-flex justify-content-between align-items-center mb-4">
              <h2><i class="fas fa-robot me-2 text-danger"></i>AI Usage Analytics</h2>
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
                  <div class="card text-center">
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
                  <div class="card text-center">
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
                  <div class="card text-center">
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
                  <div class="card text-center">
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
                                <td>{day.requests}</td>
                                <td>{day.tokens.toLocaleString()}</td>
                                <td>${day.cost.toFixed(4)}</td>
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
                        <i class="fas fa-history me-2"></i>Recent AI Requests
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
                            {/each}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            {:else}
              <div class="card">
                <div class="card-body text-center py-5">
                  <i class="fas fa-robot fa-3x text-muted mb-3"></i>
                  <h5 class="text-muted">No AI Usage Data Available</h5>
                  <p class="text-muted">AI usage statistics will appear here once AI features are used.</p>
                </div>
              </div>
            {/if}
            
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
