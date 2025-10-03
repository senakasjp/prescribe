<script>
  import { onMount } from 'svelte'
  import { doc, updateDoc, getDoc, setDoc } from 'firebase/firestore'
  import { db } from '../firebase-config.js'
  import authService from '../services/authService.js'
  import firebaseStorage from '../services/firebaseStorage.js'
  import { notifySuccess, notifyError } from '../stores/notifications.js'
  import ConfirmationModal from './ConfirmationModal.svelte'
  import InventoryDashboard from './pharmacist/InventoryDashboard.svelte'
  import inventoryService from '../services/pharmacist/inventoryService.js'
  
  export let pharmacist
  
  let prescriptions = []
  let connectedDoctors = []
  let loading = true
  let selectedPrescription = null
  let showPrescriptionDetails = false
  
  // Individual medication dispatch tracking
  let dispensedMedications = new Set()
  let permanentlyDispensedMedications = new Set() // Track medications that have been permanently dispensed
  
  // Load permanently dispensed medications from localStorage on component mount
  onMount(() => {
    try {
      const stored = localStorage.getItem('permanentlyDispensedMedications')
      if (stored) {
        permanentlyDispensedMedications = new Set(JSON.parse(stored))
        console.log('📦 Loaded permanently dispensed medications from localStorage:', permanentlyDispensedMedications.size)
      }
    } catch (error) {
      console.error('❌ Error loading permanently dispensed medications:', error)
    }
  })
  
  // Pagination for prescriptions
  let currentPrescriptionPage = 1
  let prescriptionsPerPage = 10
  
  let activeTab = 'prescriptions' // 'prescriptions' or 'inventory'
  
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
    console.log('🔍 handleConfirmationConfirm called')
    console.log('🔍 pendingAction:', pendingAction)
    if (pendingAction) {
      console.log('🔍 Executing pending action')
      pendingAction()
      pendingAction = null
    }
    showConfirmationModal = false
  }
  
  function handleConfirmationCancel() {
    pendingAction = null
    showConfirmationModal = false
  }
  
  // Individual medication dispatch functions
  function toggleMedicationDispatch(prescriptionId, medicationId) {
    // Don't allow toggling if medication is already dispensed
    if (isMedicationAlreadyDispensed(prescriptionId, medicationId)) {
      return
    }
    
    const key = `${prescriptionId}-${medicationId}`
    if (dispensedMedications.has(key)) {
      dispensedMedications.delete(key)
    } else {
      dispensedMedications.add(key)
    }
    dispensedMedications = new Set(dispensedMedications) // Trigger reactivity
  }
  
  function isMedicationDispensed(prescriptionId, medicationId) {
    const key = `${prescriptionId}-${medicationId}`
    return dispensedMedications.has(key)
  }
  
  function isMedicationAlreadyDispensed(prescriptionId, medicationId) {
    const key = `${prescriptionId}-${medicationId}`
    
    // Check if it's in the current session's dispensed medications
    if (dispensedMedications.has(key)) {
      return true
    }
    
    // Check if it's in the permanently dispensed medications
    if (permanentlyDispensedMedications.has(key)) {
      return true
    }
    
    return false
  }
  
  function getDispensedCount() {
    return dispensedMedications.size
  }
  
  function markSelectedAsDispensed() {
    console.log('🔍 markSelectedAsDispensed called')
    console.log('🔍 dispensedMedications.size:', dispensedMedications.size)
    console.log('🔍 selectedPrescription:', selectedPrescription)
    
    const totalMedications = selectedPrescription.prescriptions.reduce((count, prescription) => {
      return count + (prescription.medications ? prescription.medications.length : 0)
    }, 0)
    
    console.log('🔍 totalMedications:', totalMedications)
    
    if (dispensedMedications.size === 0) {
      console.log('⚠️ No medications selected')
      notifyError('⚠️ No medications selected! Please check the boxes next to the medications you want to mark as dispensed.')
      return
    }
    
    if (dispensedMedications.size === totalMedications) {
      console.log('🔍 Showing confirmation for all medications')
      showConfirmation(
        'Mark All as Dispensed',
        `Are you sure you want to mark all ${totalMedications} medications as dispensed? This will reduce inventory stock.`,
        'Mark as Dispensed',
        'Cancel',
        'success'
      )
      pendingAction = () => {
        console.log('🔍 Pending action set to handleDispensedMedications')
        handleDispensedMedications()
      }
    } else {
      console.log('🔍 Showing confirmation for selected medications')
      showConfirmation(
        'Mark Selected as Dispensed',
        `Are you sure you want to mark ${dispensedMedications.size} of ${totalMedications} medications as dispensed? This will reduce inventory stock.`,
        'Mark as Dispensed',
        'Cancel',
        'warning'
      )
      pendingAction = () => {
        console.log('🔍 Pending action set to handleDispensedMedications')
        handleDispensedMedications()
      }
    }
  }
  
  // Handle the actual dispensing and inventory reduction
  async function handleDispensedMedications() {
    console.log('🔍 handleDispensedMedications called')
    console.log('🔍 pharmacist:', pharmacist)
    console.log('🔍 dispensedMedications:', dispensedMedications)
    
    try {
      if (!pharmacist?.id) {
        console.log('❌ No pharmacist ID available')
        notifyError('Pharmacist information not available')
        return
      }
      
      console.log('✅ Pharmacist ID available:', pharmacist.id)
      
      let inventoryReductions = []
      let inventoryErrors = []
      
      // Process each dispensed medication
      for (const dispensedKey of dispensedMedications) {
        const [prescriptionId, medicationId] = dispensedKey.split('-')
        
        // Find the medication details
        let medication = null
        for (const prescription of selectedPrescription.prescriptions) {
          if (prescription.id === prescriptionId) {
            medication = prescription.medications?.find(med => 
              (med.id || med.name) === medicationId
            )
            if (medication) break
          }
        }
        
        if (!medication) {
          console.warn('Medication not found:', medicationId)
          continue
        }
        
        try {
          // Find the inventory item by drug name
          const inventoryItems = await inventoryService.getInventoryItems(pharmacist.id)
          console.log('🔍 Available inventory items:', inventoryItems.map(item => ({
            id: item.id,
            drugName: item.drugName,
            genericName: item.genericName,
            brandName: item.brandName
          })))
          
          let inventoryItem = inventoryItems.find(item => 
            item.drugName.toLowerCase() === medication.name.toLowerCase() ||
            item.genericName?.toLowerCase() === medication.name.toLowerCase() ||
            item.brandName?.toLowerCase() === medication.name.toLowerCase()
          )
          
          // Verify the inventory item exists and has a valid ID
          if (inventoryItem && inventoryItem.id) {
            try {
              // Test if the document actually exists by trying to get it
              const itemRef = doc(db, 'pharmacistInventory', inventoryItem.id)
              const itemDoc = await getDoc(itemRef)
              if (!itemDoc.exists()) {
                console.warn(`⚠️ Inventory item ${inventoryItem.id} not found in database, will create new one`)
                inventoryItem = null // Force creation of new item
              } else {
                console.log(`✅ Inventory item ${inventoryItem.id} verified and exists`)
              }
            } catch (error) {
              console.warn(`⚠️ Error verifying inventory item ${inventoryItem.id}:`, error)
              inventoryItem = null // Force creation of new item
            }
          } else {
            console.log(`⚠️ No inventory item found for ${medication.name}`)
          }
          
          if (inventoryItem) {
            // Calculate quantity to reduce (default to 1 if not specified)
            let quantity = medication.quantity || medication.dosage || 1
            // Ensure quantity is a valid number
            quantity = parseInt(quantity) || 1
            console.log(`🔍 Using quantity: ${quantity} for ${medication.name}`)
            
            console.log('🔍 Inventory item found:', {
              id: inventoryItem.id,
              drugName: inventoryItem.drugName,
              currentStock: inventoryItem.currentStock
            })
            
            // Verify the document exists before trying to update
            try {
              // Create stock movement for dispatch
              await inventoryService.createStockMovement(pharmacist.id, {
                itemId: inventoryItem.id, // This should be the Firestore document ID
                type: 'dispatch', // Using 'dispatch' for dispensed medications
                quantity: -Math.abs(quantity), // Negative quantity for reduction
                unitCost: inventoryItem.costPrice || 0,
                reference: 'prescription_dispatch',
                referenceId: prescriptionId,
                notes: `Dispensed for prescription ${prescriptionId} - ${medication.name}`,
                batchNumber: '',
                expiryDate: ''
              })
              
              inventoryReductions.push({
                drugName: medication.name,
                quantity: quantity,
                inventoryItem: inventoryItem.drugName
              })
              
              console.log(`✅ Reduced inventory for ${medication.name}: -${quantity}`)
            } catch (inventoryError) {
              console.error(`❌ Failed to update inventory for ${medication.name}:`, inventoryError)
              inventoryErrors.push({
                drugName: medication.name,
                error: `Inventory update failed: ${inventoryError.message}`
              })
            }
          } else {
            // Try to create a basic inventory item for this medication
            console.log(`⚠️ Inventory item not found for: ${medication.name}, attempting to create basic record`)
            try {
              const newInventoryItem = await inventoryService.createInventoryItem(pharmacist.id, {
                drugName: medication.name,
                genericName: medication.name,
                brandName: medication.name,
                manufacturer: 'Unknown',
                category: 'prescription',
                strength: medication.dosage || 'Unknown',
                strengthUnit: 'mg',
                dosageForm: 'tablet',
                packSize: '1',
                packUnit: 'box',
                initialStock: 0, // Start with 0 stock
                minimumStock: 10,
                maximumStock: 1000,
                costPrice: 0,
                sellingPrice: 0,
                storageLocation: 'Main Storage',
                storageConditions: 'room_temperature',
                description: `Auto-created for dispensed medication: ${medication.name}`
              })
              
              console.log(`✅ Created basic inventory item for ${medication.name}:`, newInventoryItem.id)
              
              // Calculate quantity for tracking
              let quantity = medication.quantity || medication.dosage || 1
              quantity = parseInt(quantity) || 1
              
              // Try to create stock movement, but don't fail if inventory item doesn't exist
              try {
                await inventoryService.createStockMovement(pharmacist.id, {
                  itemId: newInventoryItem.id,
                  type: 'dispatch',
                  quantity: -Math.abs(quantity),
                  unitCost: 0,
                  reference: 'prescription_dispatch',
                  referenceId: prescriptionId,
                  notes: `Dispensed for prescription ${prescriptionId} - ${medication.name} (auto-created inventory)`,
                  batchNumber: '',
                  expiryDate: ''
                })
                
                inventoryReductions.push({
                  drugName: medication.name,
                  quantity: quantity,
                  inventoryItem: 'Auto-created'
                })
                
                console.log(`✅ Created inventory item and reduced stock for ${medication.name}: -${quantity}`)
                
              } catch (stockMovementError) {
                console.warn(`⚠️ Could not create stock movement for ${medication.name}, but continuing with dispensing:`, stockMovementError.message)
                
                // Still track the dispensing even if inventory update fails
                inventoryReductions.push({
                  drugName: medication.name,
                  quantity: quantity,
                  inventoryItem: 'Auto-created (inventory tracking failed)'
                })
                
                inventoryErrors.push({
                  drugName: medication.name,
                  error: `Inventory item created but stock movement failed: ${stockMovementError.message}`
                })
              }
              
            } catch (createError) {
              console.error(`❌ Failed to create inventory item for ${medication.name}:`, createError)
              
              // Still track the dispensing even if inventory creation fails
              let quantity = medication.quantity || medication.dosage || 1
              quantity = parseInt(quantity) || 1
              
              inventoryReductions.push({
                drugName: medication.name,
                quantity: quantity,
                inventoryItem: 'Inventory creation failed'
              })
              
              inventoryErrors.push({
                drugName: medication.name,
                error: `Could not create inventory item: ${createError.message}`
              })
            }
          }
        } catch (error) {
          inventoryErrors.push({
            drugName: medication.name,
            error: error.message
          })
          console.error(`❌ Error reducing inventory for ${medication.name}:`, error)
          
          // Continue with dispensing even if inventory update fails
          // This ensures the prescription can still be marked as dispensed
          console.log(`⚠️ Continuing with dispensing ${medication.name} despite inventory error`)
          
          // Add to dispensed medications even if inventory failed
          let fallbackQuantity = medication.quantity || medication.dosage || 1
          fallbackQuantity = parseInt(fallbackQuantity) || 1
          inventoryReductions.push({
            drugName: medication.name,
            quantity: fallbackQuantity,
            inventoryItem: 'Inventory tracking failed'
          })
        }
      }
      
      // Show results
      if (inventoryReductions.length > 0) {
        const reductionSummary = inventoryReductions.map(r => 
          `${r.drugName} (-${r.quantity})`
        ).join(', ')
        
        notifySuccess(
          `✅ Marked ${dispensedMedications.size} medications as dispensed. ` +
          `Inventory reduced: ${reductionSummary}`
        )
      }
      
      if (inventoryErrors.length > 0) {
        const errorSummary = inventoryErrors.map(e => 
          `${e.drugName}: ${e.error}`
        ).join(', ')
        
        notifyError(
          `⚠️ Some medications couldn't be reduced from inventory: ${errorSummary}`
        )
      }
      
      // Mark prescription as dispensed in pharmacist records
      try {
        await markPrescriptionAsDispensed()
        console.log('✅ Prescription marked as dispensed in pharmacist records')
      } catch (error) {
        console.error('❌ Error marking prescription as dispensed:', error)
        notifyError('Prescription dispensed but failed to update records: ' + error.message)
      }
      
      // Add dispensed medications to permanently dispensed set
      for (const dispensedKey of dispensedMedications) {
        permanentlyDispensedMedications.add(dispensedKey)
      }
      permanentlyDispensedMedications = new Set(permanentlyDispensedMedications) // Trigger reactivity
      
      // Save to localStorage for persistence across page refreshes
      try {
        localStorage.setItem('permanentlyDispensedMedications', JSON.stringify(Array.from(permanentlyDispensedMedications)))
        console.log('💾 Saved permanently dispensed medications to localStorage:', permanentlyDispensedMedications.size)
      } catch (error) {
        console.error('❌ Error saving permanently dispensed medications to localStorage:', error)
      }
      
      // Clear dispensed medications and close modal
      dispensedMedications.clear()
      dispensedMedications = new Set(dispensedMedications)
      closePrescriptionDetails()
      
    } catch (error) {
      console.error('❌ Error handling dispensed medications:', error)
      notifyError('Error processing dispensed medications: ' + error.message)
    }
  }
  
  // Mark prescription as dispensed in pharmacist records
  async function markPrescriptionAsDispensed() {
    try {
      if (!selectedPrescription || !pharmacist?.id) {
        throw new Error('Missing prescription or pharmacist data')
      }
      
      console.log('🔍 Attempting to mark prescription as dispensed:', {
        prescriptionId: selectedPrescription.id,
        pharmacistId: pharmacist.id,
        dispensedMedications: Array.from(dispensedMedications)
      })
      
      // First, check if the prescription document exists
      const prescriptionRef = doc(db, 'pharmacistPrescriptions', selectedPrescription.id)
      const prescriptionDoc = await getDoc(prescriptionRef)
      
      if (!prescriptionDoc.exists()) {
        console.warn('⚠️ Prescription document does not exist, creating new record')
        
        // Create a new prescription record with all fields properly defined
        const newPrescriptionData = {
          id: selectedPrescription.id || '',
          pharmacistId: pharmacist.id || '',
          doctorId: selectedPrescription.doctorId || '',
          patientId: selectedPrescription.patientId || '',
          patientName: selectedPrescription.patientName || 'Unknown Patient',
          patientEmail: selectedPrescription.patientEmail || '',
          doctorName: selectedPrescription.doctorName || 'Unknown Doctor',
          prescriptions: selectedPrescription.prescriptions || [],
          status: 'dispensed',
          dispensedAt: new Date().toISOString(),
          dispensedBy: pharmacist.id || '',
          dispensedMedications: Array.from(dispensedMedications).map(key => {
            const [prescriptionId, medicationId] = key.split('-')
            return { prescriptionId: prescriptionId || '', medicationId: medicationId || '', isDispensed: true }
          }),
          receivedAt: selectedPrescription.receivedAt || new Date().toISOString(),
          notes: selectedPrescription.notes || '',
          sentAt: selectedPrescription.sentAt || new Date().toISOString(),
          createdAt: new Date().toISOString()
        }
        
        await setDoc(prescriptionRef, newPrescriptionData)
        console.log('✅ Created new prescription record and marked as dispensed')
      } else {
        // Update existing prescription
        await updateDoc(prescriptionRef, {
          status: 'dispensed',
          dispensedAt: new Date().toISOString(),
          dispensedBy: pharmacist.id,
          dispensedMedications: Array.from(dispensedMedications).map(key => {
            const [prescriptionId, medicationId] = key.split('-')
            return { prescriptionId, medicationId, isDispensed: true }
          })
        })
        console.log('✅ Updated existing prescription record as dispensed')
      }
      
    } catch (error) {
      console.error('❌ Error marking prescription as dispensed:', error)
      throw error
    }
  }
  
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
    dispensedMedications.clear()
    dispensedMedications = new Set(dispensedMedications)
  }

  // Pagination calculations for prescriptions
  $: totalPrescriptionPages = Math.ceil(prescriptions.length / prescriptionsPerPage)
  $: prescriptionStartIndex = (currentPrescriptionPage - 1) * prescriptionsPerPage
  $: prescriptionEndIndex = prescriptionStartIndex + prescriptionsPerPage
  $: paginatedPrescriptions = prescriptions.slice(prescriptionStartIndex, prescriptionEndIndex)
  
  // Reset to first page when prescriptions change
  $: if (prescriptions.length > 0) {
    currentPrescriptionPage = 1
  }
  
  // Pagination functions for prescriptions
  const goToPrescriptionPage = (page) => {
    if (page >= 1 && page <= totalPrescriptionPages) {
      currentPrescriptionPage = page
    }
  }
  
  const goToPreviousPrescriptionPage = () => {
    if (currentPrescriptionPage > 1) {
      currentPrescriptionPage--
    }
  }
  
  const goToNextPrescriptionPage = () => {
    if (currentPrescriptionPage < totalPrescriptionPages) {
      currentPrescriptionPage++
    }
  }

  // Clear all prescriptions (for testing/cleanup)
  const clearAllPrescriptions = async () => {
    pendingAction = async () => {
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
    
    showConfirmation(
      'Clear All Prescriptions',
      'Are you sure you want to clear all prescriptions? This action cannot be undone.',
      'Clear All',
      'Cancel',
      'danger'
    )
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
    console.log('🔍 PharmacistDashboard: Received pharmacist data:', pharmacist)
    console.log('🔍 PharmacistDashboard: businessName:', pharmacist?.businessName)
    console.log('🔍 PharmacistDashboard: pharmacistNumber:', pharmacist?.pharmacistNumber)
    console.log('🔍 PharmacistDashboard: All pharmacist fields:', Object.keys(pharmacist || {}))
    loadPharmacistData()
  })
</script>

<div class="min-h-screen bg-gray-50">
  <!-- Mobile-First Header -->
  <div class="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-40">
    <div class="px-3 py-3 sm:px-4">
      <div class="flex justify-between items-center">
        <div class="flex items-center min-w-0 flex-1">
          <i class="fas fa-pills text-blue-600 mr-2 text-lg"></i>
          <div class="min-w-0 flex-1">
            <h1 class="text-sm sm:text-base font-bold text-blue-600 truncate">M-Prescribe</h1>
            <p class="text-xs text-gray-500 truncate">Pharmacist Portal</p>
      </div>
        </div>
        <div class="relative ml-2">
        <button 
          id="pharmacistDropdownButton" 
          data-dropdown-toggle="pharmacistDropdown" 
            class="text-gray-700 hover:text-gray-900 flex items-center p-2 rounded-lg hover:bg-gray-100 transition-colors duration-200" 
          type="button"
        >
            <i class="fas fa-user-circle text-lg"></i>
            <svg class="w-3 h-3 ml-1" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 10 6">
            <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m1 1 4 4 4-4"/>
          </svg>
        </button>
          <div id="pharmacistDropdown" class="z-10 hidden bg-white divide-y divide-gray-100 rounded-lg shadow-lg w-48 dark:bg-gray-700 absolute right-0 mt-2">
          <div class="px-4 py-3 text-sm text-gray-900 dark:text-white">
              <div class="font-medium truncate">{pharmacist.businessName}</div>
              <div class="text-xs text-gray-500">ID: {pharmacist.pharmacistNumber}</div>
          </div>
          <ul class="py-2 text-sm text-gray-700 dark:text-gray-200">
            <li>
                <button class="block w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-600 dark:hover:text-white transition-colors duration-200" on:click={handleSignOut}>
                <i class="fas fa-sign-out-alt mr-2"></i>Sign Out
              </button>
            </li>
          </ul>
          </div>
        </div>
      </div>
    </div>
  </div>
  
  <!-- Main Content -->
  <div class="px-3 py-4 sm:px-4 sm:py-6">
    <!-- Mobile Stats Cards -->
    <div class="grid grid-cols-2 gap-3 mb-4 sm:hidden">
      <div class="bg-white rounded-lg p-3 shadow-sm border border-gray-200">
        <div class="flex items-center">
          <div class="p-2 bg-blue-100 rounded-lg mr-3">
            <i class="fas fa-prescription text-blue-600"></i>
          </div>
          <div>
            <p class="text-xs text-gray-500">Prescriptions</p>
            <p class="text-lg font-semibold text-gray-900">{prescriptions.length}</p>
          </div>
        </div>
      </div>
      <div class="bg-white rounded-lg p-3 shadow-sm border border-gray-200">
        <div class="flex items-center">
          <div class="p-2 bg-green-100 rounded-lg mr-3">
            <i class="fas fa-user-md text-green-600"></i>
          </div>
          <div>
            <p class="text-xs text-gray-500">Doctors</p>
            <p class="text-lg font-semibold text-gray-900">{connectedDoctors.length}</p>
          </div>
        </div>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6">
      <!-- Sidebar - Hidden on mobile, visible on desktop -->
      <div class="hidden lg:block lg:col-span-3">
      <div class="bg-white border-2 border-blue-200 rounded-lg shadow-sm">
        <div class="bg-blue-600 text-white px-4 py-3 rounded-t-lg">
          <h6 class="text-lg font-semibold mb-0">
            <i class="fas fa-info-circle mr-2"></i>
            Pharmacy Information
          </h6>
        </div>
        <div class="p-4">
          <div class="mb-3">
            <label class="block text-sm font-medium text-gray-700 mb-1">Business Name:</label>
            <p class="text-gray-900">{pharmacist.businessName || pharmacist.name || 'Not specified'}</p>
          </div>
          <div class="mb-3">
            <label class="block text-sm font-medium text-gray-700 mb-1">Pharmacist ID:</label>
            <p class="text-blue-600 font-semibold">{pharmacist.pharmacistNumber || pharmacist.id || 'Not specified'}</p>
          </div>
          <div class="mb-3">
            <label class="block text-sm font-medium text-gray-700 mb-1">Connected Doctors:</label>
            <p class="text-gray-900">{connectedDoctors.length}</p>
          </div>
          <div class="mb-0">
            <label class="block text-sm font-medium text-gray-700 mb-1">Total Prescriptions:</label>
            <p class="mb-0">{prescriptions.length}</p>
          </div>
        </div>
      </div>
      
      <!-- Connected Doctors -->
      {#if connectedDoctors.length > 0}
        <div class="bg-white border-2 border-blue-200 rounded-lg shadow-sm mt-4">
          <div class="bg-blue-500 text-white px-4 py-3 rounded-t-lg">
            <h6 class="text-lg font-semibold mb-0">
              <i class="fas fa-user-md mr-2"></i>
              Connected Doctors
            </h6>
          </div>
          <div class="p-4">
            {#each connectedDoctors as doctor}
              <div class="flex items-center mb-3">
                <i class="fas fa-user-md text-blue-600 mr-2"></i>
                <div>
                  <div class="font-semibold text-gray-900">{doctor.name || `${doctor.firstName} ${doctor.lastName}` || doctor.email}</div>
                  <small class="text-gray-500">{doctor.email}</small>
                </div>
              </div>
            {/each}
          </div>
        </div>
      {/if}
    </div>
    
    <!-- Main Content with Tabs -->
    <div class="lg:col-span-9">
      <div class="bg-white rounded-lg shadow-sm border border-gray-200">
          <!-- Mobile Tab Navigation -->
          <div class="bg-white border-b border-gray-200 px-3 py-3 sm:px-4">
            <div class="flex flex-col space-y-3 sm:space-y-0 sm:flex-row sm:justify-between sm:items-center">
              <!-- Tab Buttons -->
            <div class="flex space-x-1" role="tablist">
              <button 
                  class="flex-1 sm:flex-none px-3 py-2 text-xs sm:text-sm font-medium rounded-lg transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-offset-2 {activeTab === 'prescriptions' ? 'text-white bg-blue-600 hover:bg-blue-700 focus:ring-blue-300 dark:bg-blue-600 dark:hover:bg-blue-700 dark:focus:ring-blue-800' : 'text-gray-500 bg-white border border-gray-200 hover:bg-gray-50 hover:text-gray-700 focus:ring-gray-300 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-600 dark:hover:bg-gray-700 dark:hover:text-white'}" 
                on:click={() => activeTab = 'prescriptions'}
                type="button"
                role="tab"
              >
                  <i class="fas fa-prescription mr-1 sm:mr-2"></i>
                  <span class="hidden xs:inline">Prescriptions</span>
                  <span class="xs:hidden">Rx</span>
              </button>
              <button 
                  class="flex-1 sm:flex-none px-3 py-2 text-xs sm:text-sm font-medium rounded-lg transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-offset-2 {activeTab === 'inventory' ? 'text-white bg-blue-600 hover:bg-blue-700 focus:ring-blue-300 dark:bg-blue-600 dark:hover:bg-blue-700 dark:focus:ring-blue-800' : 'text-gray-500 bg-white border border-gray-200 hover:bg-gray-50 hover:text-gray-700 focus:ring-gray-300 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-600 dark:hover:bg-gray-700 dark:hover:text-white'}" 
                  on:click={() => activeTab = 'inventory'}
                type="button"
                role="tab"
              >
                  <i class="fas fa-warehouse mr-1 sm:mr-2"></i>
                  <span class="hidden xs:inline">Inventory</span>
                  <span class="xs:hidden">Stock</span>
              </button>
            </div>
              
              <!-- Action Buttons -->
            <div class="flex space-x-2" role="group">
              {#if activeTab === 'prescriptions'}
                  <button class="text-blue-700 bg-blue-100 hover:bg-blue-200 focus:ring-4 focus:outline-none focus:ring-blue-300 font-medium rounded-lg text-xs sm:text-sm px-2 sm:px-3 py-1 text-center dark:bg-blue-800 dark:text-blue-200 dark:hover:bg-blue-700 dark:focus:ring-blue-800 transition-all duration-200" on:click={loadPharmacistData}>
                  <i class="fas fa-sync-alt mr-1"></i>
                    <span class="hidden sm:inline">Refresh</span>
                </button>
                  <button class="text-red-700 bg-red-100 hover:bg-red-200 focus:ring-4 focus:outline-none focus:ring-red-300 font-medium rounded-lg text-xs sm:text-sm px-2 sm:px-3 py-1 text-center dark:bg-red-800 dark:text-red-200 dark:hover:bg-red-700 dark:focus:ring-red-800 transition-all duration-200" on:click={clearAllPrescriptions}>
                  <i class="fas fa-trash mr-1"></i>
                    <span class="hidden sm:inline">Clear All</span>
                </button>
                {:else if activeTab === 'inventory'}
                  <button class="text-blue-700 bg-blue-100 hover:bg-blue-200 focus:ring-4 focus:outline-none focus:ring-blue-300 font-medium rounded-lg text-xs sm:text-sm px-2 sm:px-3 py-1 text-center dark:bg-blue-800 dark:text-blue-200 dark:hover:bg-blue-700 dark:focus:ring-blue-800 transition-all duration-200" on:click={loadPharmacistData}>
                  <i class="fas fa-sync-alt mr-1"></i>
                    <span class="hidden sm:inline">Refresh</span>
                </button>
              {/if}
            </div>
          </div>
        </div>
        
        <div class="p-4">
          {#if activeTab === 'prescriptions'}
            {#if loading}
              <div class="text-center py-4">
                <svg class="animate-spin h-8 w-8 text-blue-600 mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <p class="mt-2 text-gray-500">Loading prescriptions...</p>
              </div>
            {:else if prescriptions.length === 0}
              <div class="text-center py-8">
                <i class="fas fa-prescription text-4xl text-gray-400 mb-3"></i>
                <h5 class="text-gray-500">No Prescriptions Available</h5>
                <p class="text-gray-500">Prescriptions from connected doctors will appear here.</p>
              </div>
            {:else}
              <!-- Desktop Table View -->
              <div class="hidden md:block overflow-x-auto">
                <table class="min-w-full divide-y divide-gray-200">
                  <thead class="bg-gray-50">
                    <tr>
                      <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Patient</th>
                      <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Doctor</th>
                      <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Medications</th>
                      <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                      <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody class="bg-white divide-y divide-gray-200">
                    {#each paginatedPrescriptions as prescription}
                      <tr class="hover:bg-gray-50">
                        <td class="px-6 py-4 whitespace-nowrap">
                          <div class="font-semibold text-gray-900">{prescription.patientName || 'Unknown Patient'}</div>
                          <div class="text-sm text-gray-500">{prescription.patientEmail || 'No email'}</div>
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap">
                          <div class="font-semibold text-gray-900">{prescription.doctorName || getDoctorName(prescription.doctorId)}</div>
                          <div class="text-sm text-gray-500">ID: {prescription.doctorId}</div>
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap">
                          <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            {prescription.prescriptions ? prescription.prescriptions.reduce((total, p) => total + (p.medications ? p.medications.length : 0), 0) : 0} medication(s)
                          </span>
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatDate(prescription.receivedAt || prescription.sentAt || prescription.createdAt)}
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap">
                          <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                            {prescription.status || 'Pending'}
                          </span>
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <button 
                            class="text-blue-600 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 px-3 py-1 rounded text-sm font-medium transition-colors duration-200"
                            on:click={() => viewPrescription(prescription)}
                          >
                            <i class="fas fa-eye mr-1"></i>
                            View
                          </button>
                        </td>
                      </tr>
                    {/each}
                  </tbody>
                </table>
              </div>

              <!-- Mobile Card View -->
              <div class="md:hidden space-y-3">
                {#each paginatedPrescriptions as prescription}
                  <div class="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                    <div class="flex justify-between items-start mb-3">
                      <div class="flex-1">
                        <h3 class="font-semibold text-gray-900 text-sm">{prescription.patientName || 'Unknown Patient'}</h3>
                        <p class="text-xs text-gray-500">{prescription.patientEmail || 'No email'}</p>
              </div>
                      <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                        {prescription.status || 'Pending'}
                      </span>
                    </div>
                    
                    <div class="space-y-2 mb-3">
                      <div class="flex items-center text-xs">
                        <i class="fas fa-user-md text-blue-600 mr-2 w-3"></i>
                        <span class="text-gray-600">{prescription.doctorName || getDoctorName(prescription.doctorId)}</span>
                      </div>
                      <div class="flex items-center text-xs">
                        <i class="fas fa-pills text-blue-600 mr-2 w-3"></i>
                        <span class="text-gray-600">
                          {prescription.prescriptions ? prescription.prescriptions.reduce((total, p) => total + (p.medications ? p.medications.length : 0), 0) : 0} medication(s)
                        </span>
                      </div>
                      <div class="flex items-center text-xs">
                        <i class="fas fa-calendar text-blue-600 mr-2 w-3"></i>
                        <span class="text-gray-600">{formatDate(prescription.receivedAt || prescription.sentAt || prescription.createdAt)}</span>
                      </div>
                    </div>
                    
                    <button 
                      class="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2 px-3 rounded-lg transition-colors duration-200"
                      on:click={() => viewPrescription(prescription)}
                    >
                      <i class="fas fa-eye mr-1"></i>
                      View Details
                </button>
              </div>
                {/each}
              </div>
                
                <!-- Pagination Controls -->
                {#if totalPrescriptionPages > 1}
                  <div class="mt-4 sm:mt-6 bg-gray-50 rounded-lg p-3 sm:p-4">
                    <!-- Mobile Pagination -->
                    <div class="sm:hidden">
                      <div class="text-center text-xs text-gray-600 mb-3">
                        Page {currentPrescriptionPage} of {totalPrescriptionPages}
                      </div>
                      <div class="flex justify-between items-center">
                            <button 
                          class="inline-flex items-center px-3 py-2 text-xs font-medium text-gray-500 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                          on:click={goToPreviousPrescriptionPage}
                          disabled={currentPrescriptionPage === 1}
                        >
                          <i class="fas fa-chevron-left mr-1"></i>
                          Prev
                            </button>
                        
                        <div class="flex items-center space-x-1">
                          {#each Array.from({length: Math.min(3, totalPrescriptionPages)}, (_, i) => {
                            const startPage = Math.max(1, currentPrescriptionPage - 1)
                            const endPage = Math.min(totalPrescriptionPages, startPage + 2)
                            const page = startPage + i
                            return page <= endPage ? page : null
                          }).filter(Boolean) as page}
                            <button 
                              class="inline-flex items-center px-2 py-1 text-xs font-medium rounded {currentPrescriptionPage === page ? 'text-white bg-blue-600' : 'text-gray-500 bg-white border border-gray-300 hover:bg-gray-50 hover:text-gray-700'}"
                              on:click={() => goToPrescriptionPage(page)}
                            >
                              {page}
                            </button>
                          {/each}
                          </div>
                        
                        <button 
                          class="inline-flex items-center px-3 py-2 text-xs font-medium text-gray-500 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                          on:click={goToNextPrescriptionPage}
                          disabled={currentPrescriptionPage === totalPrescriptionPages}
                        >
                          Next
                          <i class="fas fa-chevron-right ml-1"></i>
                        </button>
                      </div>
                    </div>
                    
                    <!-- Desktop Pagination -->
                    <div class="hidden sm:flex items-center justify-between">
                      <div class="flex items-center text-sm text-gray-700">
                        <span>Showing {prescriptionStartIndex + 1} to {Math.min(prescriptionEndIndex, prescriptions.length)} of {prescriptions.length} prescriptions</span>
                      </div>
                      
                      <div class="flex items-center space-x-2">
                        <!-- Previous Button -->
                        <button 
                          class="inline-flex items-center px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                          on:click={goToPreviousPrescriptionPage}
                          disabled={currentPrescriptionPage === 1}
                        >
                          <i class="fas fa-chevron-left mr-1"></i>
                          Previous
                        </button>
                        
                        <!-- Page Numbers -->
                        <div class="flex items-center space-x-1">
                          {#each Array.from({length: Math.min(5, totalPrescriptionPages)}, (_, i) => {
                            const startPage = Math.max(1, currentPrescriptionPage - 2)
                            const endPage = Math.min(totalPrescriptionPages, startPage + 4)
                            const page = startPage + i
                            return page <= endPage ? page : null
                          }).filter(Boolean) as page}
                            <button 
                              class="inline-flex items-center px-3 py-2 text-sm font-medium rounded-lg {currentPrescriptionPage === page ? 'text-white bg-blue-600 border-blue-600' : 'text-gray-500 bg-white border border-gray-300 hover:bg-gray-50 hover:text-gray-700'}"
                              on:click={() => goToPrescriptionPage(page)}
                            >
                              {page}
                            </button>
                    {/each}
                        </div>
                        
                        <!-- Next Button -->
                        <button 
                          class="inline-flex items-center px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                          on:click={goToNextPrescriptionPage}
                          disabled={currentPrescriptionPage === totalPrescriptionPages}
                        >
                          Next
                          <i class="fas fa-chevron-right ml-1"></i>
                        </button>
                      </div>
                    </div>
              </div>
            {/if}
            {/if}
          {:else if activeTab === 'inventory'}
            <!-- Advanced Inventory System -->
            <InventoryDashboard {pharmacist} />
          {/if}
        </div>
      </div>
    </div>
  </div>
</div>

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

<!-- Prescription Details Modal -->
{#if showPrescriptionDetails && selectedPrescription}
  <div id="prescriptionModal" tabindex="-1" aria-hidden="true" class="fixed inset-0 z-50 w-full p-2 sm:p-4 overflow-x-hidden overflow-y-auto md:inset-0 h-full max-h-full">
    <div class="relative w-full max-w-4xl max-h-full mx-auto">
      <div class="relative bg-white rounded-lg shadow dark:bg-gray-700 h-full max-h-full flex flex-col">
        <!-- Mobile Header -->
        <div class="flex items-center justify-between p-3 sm:p-5 border-b rounded-t dark:border-gray-600 bg-blue-600 text-white sm:bg-white sm:text-gray-900">
          <h3 class="text-lg sm:text-xl font-medium">
            <i class="fas fa-prescription mr-2"></i>
            <span class="hidden sm:inline">Prescription Details</span>
            <span class="sm:hidden">Details</span>
          </h3>
          <button 
            type="button" 
            class="text-white sm:text-gray-400 bg-transparent hover:bg-white/20 sm:hover:bg-gray-200 hover:text-white sm:hover:text-gray-900 rounded-lg text-sm p-1.5 ml-auto inline-flex items-center dark:hover:bg-gray-600 dark:hover:text-white" 
            data-modal-hide="prescriptionModal"
            on:click={closePrescriptionDetails}
          >
            <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
              <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"></path>
            </svg>
            <span class="sr-only">Close modal</span>
          </button>
        </div>
        <div class="p-3 sm:p-6 overflow-y-auto flex-1">
          <!-- Patient Information -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 mb-4 sm:mb-6">
            <div class="bg-gray-50 rounded-lg p-3 sm:p-4">
              <h6 class="font-semibold text-blue-600 text-sm sm:text-base mb-2">Patient Information</h6>
              <div class="space-y-1 text-xs sm:text-sm">
              <p><strong>Name:</strong> {selectedPrescription.patientName || 'Unknown Patient'}</p>
              <p><strong>Email:</strong> {selectedPrescription.patientEmail || 'No email'}</p>
              {#if selectedPrescription.patientAge}
                <p><strong>Age:</strong> {selectedPrescription.patientAge}</p>
              {/if}
            </div>
            </div>
            <div class="bg-gray-50 rounded-lg p-3 sm:p-4">
              <h6 class="font-semibold text-blue-600 text-sm sm:text-base mb-2">Prescription Information</h6>
              <div class="space-y-1 text-xs sm:text-sm">
              <p><strong>Doctor:</strong> {selectedPrescription.doctorName || getDoctorName(selectedPrescription.doctorId)}</p>
              <p><strong>Date:</strong> {formatDate(selectedPrescription.receivedAt || selectedPrescription.sentAt || selectedPrescription.createdAt)}</p>
                <p><strong>Status:</strong> <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">{selectedPrescription.status || 'Pending'}</span></p>
              </div>
            </div>
          </div>
          
          <!-- Prescriptions -->
          <div class="mb-4">
            <h6 class="font-semibold text-white text-sm sm:text-base mb-3">Prescriptions</h6>
            {#if selectedPrescription.prescriptions && selectedPrescription.prescriptions.length > 0}
              {#each selectedPrescription.prescriptions as prescription}
                <div class="bg-white border border-gray-200 rounded-lg shadow-sm mb-4">
                  <div class="bg-gray-50 px-3 sm:px-4 py-3 border-b border-gray-200">
                    <h6 class="text-xs sm:text-sm font-semibold mb-0">Prescription ID: {prescription.id}</h6>
                  </div>
                  <div class="p-3 sm:p-4">
                    <!-- Medications for this prescription -->
                    {#if prescription.medications && prescription.medications.length > 0}
                      <!-- Desktop Table View -->
                      <div class="hidden sm:block overflow-x-auto">
                        <table class="min-w-full divide-y divide-gray-200">
                          <thead class="bg-gray-50">
                            <tr>
                              <th class="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Dispensed</th>
                              <th class="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Medication</th>
                              <th class="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Dosage</th>
                              <th class="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Frequency</th>
                              <th class="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Duration</th>
                              <th class="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Instructions</th>
                            </tr>
                          </thead>
                          <tbody class="bg-white divide-y divide-gray-200">
                            {#each prescription.medications as medication}
                              <tr class="hover:bg-gray-50">
                                <td class="px-3 py-4 whitespace-nowrap text-center">
                                  <input 
                                    type="checkbox" 
                                    class="w-4 h-4 text-teal-600 bg-gray-100 border-gray-300 rounded focus:ring-teal-500 dark:focus:ring-teal-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                                    checked={isMedicationDispensed(prescription.id, medication.id || medication.name) || isMedicationAlreadyDispensed(prescription.id, medication.id || medication.name)}
                                    disabled={isMedicationAlreadyDispensed(prescription.id, medication.id || medication.name)}
                                    on:change={() => !isMedicationAlreadyDispensed(prescription.id, medication.id || medication.name) && toggleMedicationDispatch(prescription.id, medication.id || medication.name)}
                                  />
                                </td>
                                <td class="px-3 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                                  <span>{medication.name}</span>
                                </td>
                                <td class="px-3 py-4 whitespace-nowrap text-sm text-gray-900">{medication.dosage}</td>
                                <td class="px-3 py-4 whitespace-nowrap text-sm text-gray-900">{medication.frequency}</td>
                                <td class="px-3 py-4 whitespace-nowrap text-sm text-gray-900">{medication.duration}</td>
                                <td class="px-3 py-4 whitespace-nowrap text-sm text-gray-900">{medication.instructions}</td>
                              </tr>
                            {/each}
                          </tbody>
                        </table>
                      </div>

                      <!-- Mobile Card View -->
                      <div class="sm:hidden space-y-3">
                        {#each prescription.medications as medication}
                          <div class="bg-gray-50 border border-gray-200 rounded-lg p-3">
                            <div class="flex items-center justify-between mb-2">
                              <div class="flex items-center gap-2">
                                <h4 class="font-semibold text-gray-900 text-sm">{medication.name}</h4>
                              </div>
                              <label class="flex items-center space-x-2 {isMedicationAlreadyDispensed(prescription.id, medication.id || medication.name) ? 'cursor-not-allowed' : 'cursor-pointer'}">
                                <input 
                                  type="checkbox" 
                                  class="w-4 h-4 text-teal-600 bg-gray-100 border-gray-300 rounded focus:ring-teal-500 dark:focus:ring-teal-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                                  checked={isMedicationDispensed(prescription.id, medication.id || medication.name) || isMedicationAlreadyDispensed(prescription.id, medication.id || medication.name)}
                                  disabled={isMedicationAlreadyDispensed(prescription.id, medication.id || medication.name)}
                                  on:change={() => !isMedicationAlreadyDispensed(prescription.id, medication.id || medication.name) && toggleMedicationDispatch(prescription.id, medication.id || medication.name)}
                                />
                                <span class="text-xs {isMedicationAlreadyDispensed(prescription.id, medication.id || medication.name) ? 'text-gray-400' : 'text-gray-600'}">Dispensed</span>
                              </label>
                            </div>
                            <div class="space-y-1 text-xs">
                              <div class="flex justify-between">
                                <span class="text-gray-600">Dosage:</span>
                                <span class="text-gray-900">{medication.dosage}</span>
                              </div>
                              <div class="flex justify-between">
                                <span class="text-gray-600">Frequency:</span>
                                <span class="text-gray-900">{medication.frequency}</span>
                              </div>
                              <div class="flex justify-between">
                                <span class="text-gray-600">Duration:</span>
                                <span class="text-gray-900">{medication.duration}</span>
                              </div>
                              <div class="mt-2">
                                <span class="text-gray-600 text-xs">Instructions:</span>
                                <p class="text-gray-900 text-xs mt-1">{medication.instructions}</p>
                              </div>
                            </div>
                          </div>
                        {/each}
                      </div>
                    {:else}
                      <div class="bg-blue-50 border border-blue-200 rounded-lg p-3">
                        <i class="fas fa-info-circle mr-2 text-blue-600"></i>
                        <span class="text-blue-700 text-sm">No medications found in this prescription.</span>
                      </div>
                    {/if}
                  </div>
                </div>
              {/each}
            {:else}
              <div class="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <i class="fas fa-info-circle mr-2 text-blue-600"></i>
                <span class="text-blue-700 text-sm">No prescriptions found.</span>
              </div>
            {/if}
          </div>
          
          <!-- Notes -->
          {#if selectedPrescription.notes}
            <div class="mb-4">
              <h6 class="font-semibold text-blue-600 text-sm sm:text-base mb-2">Doctor's Notes</h6>
              <div class="bg-gray-50 border border-gray-200 rounded-lg p-3">
                <span class="text-gray-700 text-xs sm:text-sm">{selectedPrescription.notes}</span>
              </div>
            </div>
          {/if}
        </div>
        
        <!-- Mobile Footer -->
        <div class="flex flex-col sm:flex-row items-center p-3 sm:p-6 space-y-2 sm:space-y-0 sm:space-x-2 border-t border-gray-200 rounded-b dark:border-gray-600 bg-gray-50 sm:bg-white">
          <button 
            type="button" 
            class="w-full sm:w-auto text-gray-500 bg-white hover:bg-gray-100 focus:ring-4 focus:outline-none focus:ring-gray-200 rounded-lg border border-gray-200 text-sm font-medium px-4 py-2.5 hover:text-gray-900 focus:z-10 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-500 dark:hover:text-white dark:hover:bg-gray-600 dark:focus:ring-gray-600 transition-colors duration-200"
            on:click={closePrescriptionDetails}
          >
            <i class="fas fa-times mr-1"></i>
            Close
          </button>
          <button 
            type="button" 
            class="w-full sm:w-auto text-white bg-teal-700 hover:bg-teal-800 focus:ring-4 focus:outline-none focus:ring-teal-300 font-medium rounded-lg text-sm px-4 py-2.5 text-center dark:bg-teal-600 dark:hover:bg-teal-700 dark:focus:ring-teal-800 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            on:click={markSelectedAsDispensed}
            disabled={dispensedMedications.size === 0}
          >
            <i class="fas fa-check mr-1"></i>
            {dispensedMedications.size > 0 ? `Mark ${dispensedMedications.size} as Dispensed` : 'Mark as Dispensed'}
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}

            </div>

<style>
  /* Custom styles for enhanced UI */
</style>
