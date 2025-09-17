<script>
  import { onMount } from 'svelte'
  import authService from '../services/authService.js'
  import firebaseStorage from '../services/firebaseStorage.js'
  import { notifySuccess, notifyError } from '../stores/notifications.js'
  
  export let pharmacist
  
  let prescriptions = []
  let connectedDoctors = []
  let loading = true
  let selectedPrescription = null
  let showPrescriptionDetails = false
  
  // Load pharmacist data
  const loadPharmacistData = async () => {
    try {
      loading = true
      
      // Get prescriptions from connected doctors using Firebase
      prescriptions = await firebaseStorage.getPharmacistPrescriptions(pharmacist.id)
      
      console.log('🔍 PharmacistDashboard: Loaded prescriptions:', prescriptions.length)
      console.log('🔍 PharmacistDashboard: Prescription data:', prescriptions)
      
      // Count total prescriptions across all prescription objects
      let totalPrescriptions = 0
      prescriptions.forEach(prescription => {
        if (prescription.prescriptions && Array.isArray(prescription.prescriptions)) {
          totalPrescriptions += prescription.prescriptions.length
          console.log(`🔍 Prescription ${prescription.id} has ${prescription.prescriptions.length} sub-prescriptions`)
        } else {
          totalPrescriptions += 1
          console.log(`🔍 Prescription ${prescription.id} is a single prescription`)
        }
      })
      console.log('🔍 Total prescriptions count:', totalPrescriptions)
      
      // Load connected doctors info from Firebase
      connectedDoctors = []
      for (const doctorId of pharmacist.connectedDoctors) {
        const doctor = await firebaseStorage.getDoctorById(doctorId)
        if (doctor) {
          connectedDoctors.push(doctor)
        }
      }
      
      // Sort prescriptions by date (newest first)
      prescriptions.sort((a, b) => new Date(b.createdAt || b.dateCreated) - new Date(a.createdAt || a.dateCreated))
      
    } catch (error) {
      console.error('Error loading pharmacist data:', error)
      notifyError('Failed to load prescriptions')
    } finally {
      loading = false
    }
  }
  
  // View prescription details
  const viewPrescription = (prescription) => {
    selectedPrescription = prescription
    showPrescriptionDetails = true
  }
  
  // Close prescription details
  const closePrescriptionDetails = () => {
    showPrescriptionDetails = false
    selectedPrescription = null
  }

  // Clear all prescriptions (for testing/cleanup)
  const clearAllPrescriptions = async () => {
    if (confirm('Are you sure you want to clear all prescriptions? This action cannot be undone.')) {
      try {
        await firebaseStorage.clearPharmacistPrescriptions(pharmacist.id)
        notifySuccess('All prescriptions cleared successfully')
        // Reload the data
        await loadPharmacistData()
      } catch (error) {
        console.error('Error clearing prescriptions:', error)
        notifyError('Failed to clear prescriptions')
      }
    }
  }
  
  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return 'Unknown'
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }
  
  // Get doctor name by ID
  const getDoctorName = (doctorId) => {
    const doctor = connectedDoctors.find(d => d.id === doctorId)
    return doctor ? (doctor.name || `${doctor.firstName} ${doctor.lastName}` || doctor.email) : 'Unknown Doctor'
  }
  
  // Sign out
  const handleSignOut = async () => {
    try {
      await authService.signOut()
      notifySuccess('Signed out successfully')
      // Redirect will be handled by parent component
    } catch (error) {
      notifyError('Sign out failed')
    }
  }
  
  onMount(() => {
    loadPharmacistData()
  })
</script>

<div class="container-fluid">
  <!-- Compact Header -->
  <div class="bg-white shadow-sm mb-3 py-2">
    <div class="d-flex justify-content-between align-items-center px-3 w-100">
      <div class="d-flex align-items-center">
        <i class="fas fa-pills text-primary me-2"></i>
        <span class="fw-bold text-primary">M-Prescribe - Pharmacist Portal</span>
      </div>
      <div class="dropdown">
        <button class="btn btn-link dropdown-toggle d-flex align-items-center p-0" type="button" data-bs-toggle="dropdown">
          <i class="fas fa-user-circle me-2"></i>
          <span class="d-none d-md-inline">{pharmacist.businessName}</span>
        </button>
        <ul class="dropdown-menu dropdown-menu-end">
          <li><h6 class="dropdown-header">{pharmacist.businessName}</h6></li>
          <li><span class="dropdown-item-text small text-muted">ID: {pharmacist.pharmacistNumber}</span></li>
          <li><hr class="dropdown-divider"></li>
          <li><button class="dropdown-item" on:click={handleSignOut}>
            <i class="fas fa-sign-out-alt me-2"></i>Sign Out
          </button></li>
        </ul>
      </div>
    </div>
  </div>
  
  <!-- Main Content -->
  <div class="row">
    <!-- Sidebar -->
    <div class="col-lg-3 mb-4">
      <div class="card border-2 border-info shadow-sm">
        <div class="card-header bg-primary text-white">
          <h6 class="card-title mb-0">
            <i class="fas fa-info-circle me-2"></i>
            Pharmacy Information
          </h6>
        </div>
        <div class="card-body">
          <div class="mb-3">
            <label class="form-label fw-bold">Business Name:</label>
            <p class="mb-0">{pharmacist.businessName}</p>
          </div>
          <div class="mb-3">
            <label class="form-label fw-bold">Pharmacist ID:</label>
            <p class="mb-0 text-primary fw-bold">{pharmacist.pharmacistNumber}</p>
          </div>
          <div class="mb-3">
            <label class="form-label fw-bold">Connected Doctors:</label>
            <p class="mb-0">{connectedDoctors.length}</p>
          </div>
          <div class="mb-0">
            <label class="form-label fw-bold">Total Prescriptions:</label>
            <p class="mb-0">{prescriptions.length}</p>
          </div>
        </div>
      </div>
      
      <!-- Connected Doctors -->
      {#if connectedDoctors.length > 0}
        <div class="card border-2 border-info shadow-sm mt-3">
          <div class="card-header bg-info text-white">
            <h6 class="card-title mb-0">
              <i class="fas fa-user-md me-2"></i>
              Connected Doctors
            </h6>
          </div>
          <div class="card-body">
            {#each connectedDoctors as doctor}
              <div class="d-flex align-items-center mb-2">
                <i class="fas fa-user-md text-primary me-2"></i>
                <div>
                  <div class="fw-bold">{doctor.name || `${doctor.firstName} ${doctor.lastName}` || doctor.email}</div>
                  <small class="text-muted">{doctor.email}</small>
                </div>
              </div>
            {/each}
          </div>
        </div>
      {/if}
    </div>
    
    <!-- Prescriptions List -->
    <div class="col-lg-9">
      <div class="card border-0 shadow-sm">
        <div class="card-header bg-white border-bottom">
          <div class="d-flex justify-content-between align-items-center">
            <h5 class="card-title mb-0">
              <i class="fas fa-prescription me-2 text-primary"></i>
              Prescriptions
            </h5>
            <div class="btn-group" role="group">
              <button class="btn btn-outline-primary btn-sm" on:click={loadPharmacistData}>
                <i class="fas fa-sync-alt me-1"></i>
                Refresh
              </button>
              <button class="btn btn-outline-danger btn-sm" on:click={clearAllPrescriptions}>
                <i class="fas fa-trash me-1"></i>
                Clear All
              </button>
            </div>
          </div>
        </div>
        
        <div class="card-body">
          {#if loading}
            <div class="text-center py-4">
              <div class="spinner-border text-primary" role="status">
                <span class="visually-hidden">Loading...</span>
              </div>
              <p class="mt-2 text-muted">Loading prescriptions...</p>
            </div>
          {:else if prescriptions.length === 0}
            <div class="text-center py-5">
              <i class="fas fa-prescription fa-3x text-muted mb-3"></i>
              <h5 class="text-muted">No Prescriptions Available</h5>
              <p class="text-muted">Prescriptions from connected doctors will appear here.</p>
            </div>
          {:else}
            <div class="table-responsive">
              <table class="table table-hover">
                <thead class="table-light">
                  <tr>
                    <th>Patient</th>
                    <th>Doctor</th>
                    <th>Medications</th>
                    <th>Date</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {#each prescriptions as prescription}
                    <tr>
                      <td>
                        <div class="fw-bold">{prescription.patientName || 'Unknown Patient'}</div>
                        <small class="text-muted">{prescription.patientEmail || 'No email'}</small>
                      </td>
                      <td>
                        <div class="fw-bold">{prescription.doctorName || getDoctorName(prescription.doctorId)}</div>
                        <small class="text-muted">ID: {prescription.doctorId}</small>
                      </td>
                      <td>
                        <span class="badge bg-primary">
                          {prescription.prescriptions ? prescription.prescriptions.reduce((total, p) => total + (p.medications ? p.medications.length : 0), 0) : 0} medication(s)
                        </span>
                      </td>
                      <td>
                        <small>{formatDate(prescription.receivedAt || prescription.sentAt || prescription.createdAt)}</small>
                      </td>
                      <td>
                        <span class="badge bg-warning text-dark">{prescription.status || 'Pending'}</span>
                      </td>
                      <td>
                        <button 
                          class="btn btn-outline-primary btn-sm"
                          on:click={() => viewPrescription(prescription)}
                        >
                          <i class="fas fa-eye me-1"></i>
                          View
                        </button>
                      </td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          {/if}
        </div>
      </div>
    </div>
  </div>
</div>

<!-- Prescription Details Modal -->
{#if showPrescriptionDetails && selectedPrescription}
  <div class="modal fade show d-block" style="background-color: rgba(var(--bs-dark-rgb), 0.5);" tabindex="-1">
    <div class="modal-dialog modal-lg">
      <div class="modal-content">
        <div class="modal-header bg-primary text-white">
          <h5 class="modal-title">
            <i class="fas fa-prescription me-2"></i>
            Prescription Details
          </h5>
          <button type="button" class="btn-close btn-close-white" on:click={closePrescriptionDetails}></button>
        </div>
        <div class="modal-body">
          <!-- Patient Information -->
          <div class="row mb-4">
            <div class="col-md-6">
              <h6 class="fw-bold text-primary">Patient Information</h6>
              <p><strong>Name:</strong> {selectedPrescription.patientName || 'Unknown Patient'}</p>
              <p><strong>Email:</strong> {selectedPrescription.patientEmail || 'No email'}</p>
              {#if selectedPrescription.patientAge}
                <p><strong>Age:</strong> {selectedPrescription.patientAge}</p>
              {/if}
            </div>
            <div class="col-md-6">
              <h6 class="fw-bold text-primary">Prescription Information</h6>
              <p><strong>Doctor:</strong> {selectedPrescription.doctorName || getDoctorName(selectedPrescription.doctorId)}</p>
              <p><strong>Date:</strong> {formatDate(selectedPrescription.receivedAt || selectedPrescription.sentAt || selectedPrescription.createdAt)}</p>
              <p><strong>Status:</strong> <span class="badge bg-warning text-dark">{selectedPrescription.status || 'Pending'}</span></p>
            </div>
          </div>
          
          <!-- Prescriptions -->
          <div class="mb-4">
            <h6 class="fw-bold text-primary">Prescriptions</h6>
            {#if selectedPrescription.prescriptions && selectedPrescription.prescriptions.length > 0}
              {#each selectedPrescription.prescriptions as prescription}
                <div class="card mb-3">
                  <div class="card-header">
                    <h6 class="mb-0">Prescription ID: {prescription.id}</h6>
                  </div>
                  <div class="card-body">
                    <!-- Medications for this prescription -->
                    {#if prescription.medications && prescription.medications.length > 0}
                      <div class="table-responsive">
                        <table class="table table-bordered">
                          <thead class="table-light">
                            <tr>
                              <th>Medication</th>
                              <th>Dosage</th>
                              <th>Frequency</th>
                              <th>Duration</th>
                              <th>Instructions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {#each prescription.medications as medication}
                              <tr>
                                <td class="fw-bold">{medication.name}</td>
                                <td>{medication.dosage}</td>
                                <td>{medication.frequency}</td>
                                <td>{medication.duration}</td>
                                <td>{medication.instructions}</td>
                              </tr>
                            {/each}
                          </tbody>
                        </table>
                      </div>
                    {:else}
                      <div class="alert alert-info">
                        <i class="fas fa-info-circle me-2"></i>
                        No medications found in this prescription.
                      </div>
                    {/if}
                  </div>
                </div>
              {/each}
            {:else}
              <div class="alert alert-info">
                <i class="fas fa-info-circle me-2"></i>
                No prescriptions found.
              </div>
            {/if}
          </div>
          
          <!-- Notes -->
          {#if selectedPrescription.notes}
            <div class="mb-4">
              <h6 class="fw-bold text-primary">Doctor's Notes</h6>
              <div class="alert alert-light">
                {selectedPrescription.notes}
              </div>
            </div>
          {/if}
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" on:click={closePrescriptionDetails}>
            <i class="fas fa-times me-1"></i>
            Close
          </button>
          <button type="button" class="btn btn-success">
            <i class="fas fa-check me-1"></i>
            Mark as Dispensed
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  .card {
    border-radius: 10px;
  }
  
  .btn {
    border-radius: 6px;
  }
  
  .table th {
    border-top: none;
    font-weight: 600;
  }
  
  .badge {
    font-size: 0.75em;
  }
  
  .modal-content {
    border-radius: 10px;
  }
  
  .modal-header {
    border-radius: 10px 10px 0 0;
  }
  
  /* Compact header styles - using Bootstrap 5 utility classes */
  
</style>
