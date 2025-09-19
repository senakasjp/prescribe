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
  
  // Drug stock management
  let drugStock = []
  let showStockModal = false
  let showAddStockModal = false
  let newStockItem = {
    drugName: '',
    genericName: '',
    manufacturer: '',
    quantity: '',
    unit: 'tablets',
    expiryDate: '',
    batchNumber: '',
    price: '',
    category: 'prescription'
  }
  let editingStockItem = null
  let stockLoading = false
  let activeTab = 'prescriptions' // 'prescriptions' or 'stock'
  let formData = {} // For modal form binding
  
  // Load pharmacist data
  const loadPharmacistData = async () => {
    try {
      loading = true
      
      console.log('🔍 PharmacistDashboard: Starting loadPharmacistData')
      console.log('🔍 PharmacistDashboard: pharmacist object:', pharmacist)
      console.log('🔍 PharmacistDashboard: pharmacist.id:', pharmacist?.id)
      console.log('🔍 PharmacistDashboard: pharmacist.connectedDoctors:', pharmacist?.connectedDoctors)
      
      // Check if pharmacist data is valid
      if (!pharmacist || !pharmacist.id) {
        console.error('❌ PharmacistDashboard: Invalid pharmacist data - missing ID')
        notifyError('Invalid pharmacist data. Please log in again.')
        return
      }
      
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
      if (pharmacist.connectedDoctors && Array.isArray(pharmacist.connectedDoctors)) {
        for (const doctorId of pharmacist.connectedDoctors) {
          const doctor = await firebaseStorage.getDoctorById(doctorId)
          if (doctor) {
            connectedDoctors.push(doctor)
          }
        }
      } else {
        console.log('🔍 PharmacistDashboard: No connected doctors found or connectedDoctors is not an array')
      }
      
      // Sort prescriptions by date (newest first)
      prescriptions.sort((a, b) => new Date(b.createdAt || b.dateCreated) - new Date(a.createdAt || a.dateCreated))
      
      console.log('✅ PharmacistDashboard: Data loaded successfully')
      
    } catch (error) {
      console.error('❌ PharmacistDashboard: Error loading pharmacist data:', error)
      console.error('❌ PharmacistDashboard: Error stack:', error.stack)
      notifyError('Failed to load prescriptions: ' + error.message)
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
  
  // Drug stock management functions
  const loadDrugStock = async () => {
    try {
      stockLoading = true
      console.log('📦 Loading drug stock for pharmacist:', pharmacist.id)
      
      // Get drug stock from Firebase
      const stockData = await firebaseStorage.getPharmacistDrugStock(pharmacist.id)
      drugStock = stockData || []
      
      console.log('📦 Loaded drug stock:', drugStock.length, 'items')
      
    } catch (error) {
      console.error('❌ Error loading drug stock:', error)
      notifyError('Failed to load drug stock: ' + error.message)
    } finally {
      stockLoading = false
    }
  }
  
  const addStockItem = async () => {
    try {
      if (!formData.drugName || !formData.quantity) {
        notifyError('Please fill in required fields (Drug Name and Quantity)')
        return
      }
      
      const stockItem = {
        ...formData,
        id: Date.now().toString(),
        pharmacistId: pharmacist.id,
        addedAt: new Date().toISOString(),
        quantity: parseInt(formData.quantity),
        initialQuantity: parseInt(formData.quantity), // Store initial quantity for low stock calculation
        price: parseFloat(formData.price) || 0
      }
      
      await firebaseStorage.addPharmacistStockItem(pharmacist.id, stockItem)
      
      // Refresh stock list
      await loadDrugStock()
      
      closeStockModal()
      notifySuccess('Drug stock item added successfully')
      
    } catch (error) {
      console.error('❌ Error adding stock item:', error)
      notifyError('Failed to add stock item: ' + error.message)
    }
  }
  
  const updateStockItem = async () => {
    try {
      const stockItem = {
        ...formData,
        id: editingStockItem.id,
        pharmacistId: pharmacist.id,
        quantity: parseInt(formData.quantity),
        initialQuantity: editingStockItem.initialQuantity || parseInt(formData.quantity), // Preserve initial quantity
        price: parseFloat(formData.price) || 0
      }
      
      await firebaseStorage.updatePharmacistStockItem(pharmacist.id, stockItem.id, stockItem)
      await loadDrugStock()
      closeStockModal()
      notifySuccess('Stock item updated successfully')
      
    } catch (error) {
      console.error('❌ Error updating stock item:', error)
      notifyError('Failed to update stock item: ' + error.message)
    }
  }
  
  const deleteStockItem = async (stockItemId) => {
    if (confirm('Are you sure you want to delete this stock item?')) {
      try {
        await firebaseStorage.deletePharmacistStockItem(pharmacist.id, stockItemId)
        await loadDrugStock()
        notifySuccess('Stock item deleted successfully')
        
      } catch (error) {
        console.error('❌ Error deleting stock item:', error)
        notifyError('Failed to delete stock item: ' + error.message)
      }
    }
  }
  
  const openEditStockModal = (stockItem) => {
    editingStockItem = { ...stockItem }
    formData = { ...stockItem }
    showAddStockModal = true
  }
  
  const openAddStockModal = () => {
    editingStockItem = null
    formData = {
      drugName: '',
      genericName: '',
      manufacturer: '',
      quantity: '',
      strength: '',
      strengthUnit: 'mg',
      expiryDate: '',
      batchNumber: '',
      price: '',
      category: 'prescription'
    }
    showAddStockModal = true
  }
  
  const closeStockModal = () => {
    showAddStockModal = false
    editingStockItem = null
    formData = {}
  }
  
  const getStockStatus = (quantity, expiryDate) => {
    if (quantity <= 0) return { status: 'out-of-stock', text: 'Out of Stock', class: 'danger' }
    if (quantity <= 10) return { status: 'low-stock', text: 'Low Stock', class: 'warning' }
    
    if (expiryDate) {
      const expiry = new Date(expiryDate)
      const today = new Date()
      const daysUntilExpiry = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24))
      
      if (daysUntilExpiry <= 0) return { status: 'expired', text: 'Expired', class: 'danger' }
      if (daysUntilExpiry <= 30) return { status: 'expiring-soon', text: 'Expiring Soon', class: 'warning' }
    }
    
    return { status: 'in-stock', text: 'In Stock', class: 'success' }
  }

  onMount(() => {
    console.log('🔍 PharmacistDashboard: Received pharmacist data:', pharmacist)
    console.log('🔍 PharmacistDashboard: businessName:', pharmacist?.businessName)
    console.log('🔍 PharmacistDashboard: pharmacistNumber:', pharmacist?.pharmacistNumber)
    console.log('🔍 PharmacistDashboard: All pharmacist fields:', Object.keys(pharmacist || {}))
    loadPharmacistData()
    loadDrugStock()
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
        <button class="btn btn-link dropdown-toggle d-flex align-items-center p-0 text-decoration-none" type="button" data-bs-toggle="dropdown">
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
            <p class="mb-0">{pharmacist.businessName || pharmacist.name || 'Not specified'}</p>
          </div>
          <div class="mb-3">
            <label class="form-label fw-bold">Pharmacist ID:</label>
            <p class="mb-0 text-primary fw-bold">{pharmacist.pharmacistNumber || pharmacist.id || 'Not specified'}</p>
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
    
    <!-- Main Content with Tabs -->
    <div class="col-lg-9">
      <div class="card border-0 shadow-sm">
        <div class="card-header bg-white border-bottom">
          <div class="d-flex justify-content-between align-items-center">
            <ul class="nav nav-tabs card-header-tabs" role="tablist">
              <li class="nav-item" role="presentation">
                <button 
                  class="nav-link {activeTab === 'prescriptions' ? 'active' : ''}" 
                  on:click={() => activeTab = 'prescriptions'}
                  type="button"
                >
                  <i class="fas fa-prescription me-2"></i>
                  Prescriptions
                </button>
              </li>
              <li class="nav-item" role="presentation">
                <button 
                  class="nav-link {activeTab === 'stock' ? 'active' : ''}" 
                  on:click={() => activeTab = 'stock'}
                  type="button"
                >
                  <i class="fas fa-boxes me-2"></i>
                  Drug Stock
                </button>
              </li>
            </ul>
            <div class="btn-group" role="group">
              {#if activeTab === 'prescriptions'}
                <button class="btn btn-outline-primary btn-sm" on:click={loadPharmacistData}>
                  <i class="fas fa-sync-alt me-1"></i>
                  Refresh
                </button>
                <button class="btn btn-outline-danger btn-sm" on:click={clearAllPrescriptions}>
                  <i class="fas fa-trash me-1"></i>
                  Clear All
                </button>
              {:else if activeTab === 'stock'}
                <button class="btn btn-outline-primary btn-sm" on:click={loadDrugStock}>
                  <i class="fas fa-sync-alt me-1"></i>
                  Refresh
                </button>
                <button class="btn btn-success btn-sm" on:click={openAddStockModal}>
                  <i class="fas fa-plus me-1"></i>
                  Add Stock
                </button>
              {/if}
            </div>
          </div>
        </div>
        
        <div class="card-body">
          {#if activeTab === 'prescriptions'}
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
          {:else if activeTab === 'stock'}
            {#if stockLoading}
              <div class="text-center py-4">
                <div class="spinner-border text-primary" role="status">
                  <span class="visually-hidden">Loading...</span>
                </div>
                <p class="mt-2 text-muted">Loading drug stock...</p>
              </div>
            {:else if drugStock.length === 0}
              <div class="text-center py-5">
                <i class="fas fa-boxes fa-3x text-muted mb-3"></i>
                <h5 class="text-muted">No Drug Stock Available</h5>
                <p class="text-muted">Add your drug inventory to manage stock levels.</p>
                <button class="btn btn-primary btn-sm" on:click={openAddStockModal}>
                  <i class="fas fa-plus me-1"></i>
                  Add First Stock Item
                </button>
              </div>
            {:else}
              <div class="table-responsive">
                <table class="table table-hover">
                  <thead class="table-light">
                    <tr>
                      <th>Drug Name</th>
                      <th>Generic Name</th>
                      <th>Manufacturer</th>
                      <th>Quantity</th>
                      <th>Strength</th>
                      <th>Expiry Date</th>
                      <th>Price</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {#each drugStock as stockItem}
                      {@const status = getStockStatus(stockItem.quantity, stockItem.expiryDate)}
                      <tr>
                        <td>
                          <div class="fw-bold">{stockItem.drugName}</div>
                          <small class="text-muted">Batch: {stockItem.batchNumber || 'N/A'}</small>
                        </td>
                        <td>{stockItem.genericName || 'N/A'}</td>
                        <td>{stockItem.manufacturer || 'N/A'}</td>
                        <td>
                          <span class="fw-bold">{stockItem.quantity}</span>
                        </td>
                        <td>
                          {#if stockItem.strength && stockItem.strengthUnit}
                            <span class="badge bg-info">{stockItem.strength}{stockItem.strengthUnit}</span>
                          {:else if stockItem.strength}
                            <span class="badge bg-info">{stockItem.strength}</span>
                          {:else}
                            <small class="text-muted">N/A</small>
                          {/if}
                        </td>
                        <td>
                          {#if stockItem.expiryDate}
                            <small>{new Date(stockItem.expiryDate).toLocaleDateString()}</small>
                          {:else}
                            <small class="text-muted">N/A</small>
                          {/if}
                        </td>
                        <td>
                          {#if stockItem.price > 0}
                            <span class="fw-bold">${stockItem.price.toFixed(2)}</span>
                          {:else}
                            <small class="text-muted">N/A</small>
                          {/if}
                        </td>
                        <td>
                          <span class="badge bg-{status.class}">{status.text}</span>
                        </td>
                        <td>
                          <div class="btn-group" role="group">
                            <button 
                              class="btn btn-outline-primary btn-sm"
                              on:click={() => openEditStockModal(stockItem)}
                              title="Edit"
                            >
                              <i class="fas fa-edit"></i>
                            </button>
                            <button 
                              class="btn btn-outline-danger btn-sm"
                              on:click={() => deleteStockItem(stockItem.id)}
                              title="Delete"
                            >
                              <i class="fas fa-trash"></i>
                            </button>
                          </div>
                        </td>
                      </tr>
                    {/each}
                  </tbody>
                </table>
              </div>
            {/if}
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
          <button type="button" class="btn btn-secondary btn-sm" on:click={closePrescriptionDetails}>
            <i class="fas fa-times me-1"></i>
            Close
          </button>
          <button type="button" class="btn btn-success btn-sm">
            <i class="fas fa-check me-1"></i>
            Mark as Dispensed
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}

<!-- Add/Edit Stock Item Modal -->
{#if showAddStockModal}
  <div class="modal fade show d-block" style="background-color: rgba(var(--bs-dark-rgb), 0.5);" tabindex="-1">
    <div class="modal-dialog modal-lg">
      <div class="modal-content">
        <div class="modal-header bg-success text-white">
          <h5 class="modal-title">
            <i class="fas fa-plus me-2"></i>
            {editingStockItem ? 'Edit Stock Item' : 'Add New Stock Item'}
          </h5>
          <button type="button" class="btn-close btn-close-white" on:click={closeStockModal}></button>
        </div>
        <div class="modal-body">
          <form on:submit|preventDefault={editingStockItem ? updateStockItem : addStockItem}>
            <div class="row">
              <div class="col-md-6 mb-3">
                <label for="drugName" class="form-label">Drug Name *</label>
                <input 
                  type="text" 
                  class="form-control" 
                  id="drugName"
                  bind:value={formData.drugName}
                  required
                >
              </div>
              <div class="col-md-6 mb-3">
                <label for="genericName" class="form-label">Generic Name</label>
                <input 
                  type="text" 
                  class="form-control" 
                  id="genericName"
                  bind:value={formData.genericName}
                >
              </div>
            </div>
            
            <div class="row">
              <div class="col-md-6 mb-3">
                <label for="manufacturer" class="form-label">Manufacturer</label>
                <input 
                  type="text" 
                  class="form-control" 
                  id="manufacturer"
                  bind:value={formData.manufacturer}
                >
              </div>
              <div class="col-md-6 mb-3">
                <label for="category" class="form-label">Category</label>
                <select 
                  class="form-select" 
                  id="category"
                  bind:value={formData.category}
                >
                  <option value="prescription">Prescription</option>
                  <option value="over-the-counter">Over the Counter</option>
                  <option value="controlled">Controlled Substance</option>
                  <option value="vitamin">Vitamin/Supplement</option>
                </select>
              </div>
            </div>
            
            <div class="row">
              <div class="col-md-4 mb-3">
                <label for="quantity" class="form-label">Quantity *</label>
                <input 
                  type="number" 
                  class="form-control" 
                  id="quantity"
                  bind:value={formData.quantity}
                  min="0"
                  placeholder="1000"
                  required
                >
              </div>
              <div class="col-md-4 mb-3">
                <label for="strength" class="form-label">Strength/Type</label>
                <div class="input-group">
                  <input 
                    type="text" 
                    class="form-control" 
                    id="strength"
                    bind:value={formData.strength}
                    placeholder="50"
                  >
                  <select 
                    class="form-select" 
                    id="strengthUnit"
                    bind:value={formData.strengthUnit}
                  >
                    <option value="mg">mg</option>
                    <option value="g">g</option>
                    <option value="ml">ml</option>
                    <option value="l">l</option>
                    <option value="units">units</option>
                    <option value="mcg">mcg</option>
                    <option value="tablets">tablets</option>
                    <option value="pills">pills</option>
                    <option value="capsules">capsules</option>
                    <option value="drops">drops</option>
                    <option value="patches">patches</option>
                    <option value="injections">injections</option>
                    <option value="sachets">sachets</option>
                  </select>
                </div>
              </div>
              <div class="col-md-4 mb-3">
                <label for="price" class="form-label">Price ($)</label>
                <input 
                  type="number" 
                  class="form-control" 
                  id="price"
                  bind:value={formData.price}
                  min="0"
                  step="0.01"
                >
              </div>
            </div>
            
            <div class="row">
              <div class="col-md-6 mb-3">
                <label for="expiryDate" class="form-label">Expiry Date</label>
                <input 
                  type="date" 
                  class="form-control" 
                  id="expiryDate"
                  bind:value={formData.expiryDate}
                >
              </div>
              <div class="col-md-6 mb-3">
                <label for="batchNumber" class="form-label">Batch Number</label>
                <input 
                  type="text" 
                  class="form-control" 
                  id="batchNumber"
                  bind:value={formData.batchNumber}
                >
              </div>
            </div>
            
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary btn-sm" on:click={closeStockModal}>
                <i class="fas fa-times me-1"></i>
                Cancel
              </button>
              <button type="submit" class="btn btn-success btn-sm">
                <i class="fas fa-save me-1"></i>
                {editingStockItem ? 'Update Stock Item' : 'Add Stock Item'}
              </button>
            </div>
          </form>
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
