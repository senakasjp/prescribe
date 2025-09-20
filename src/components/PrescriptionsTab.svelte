<script>
  import { onMount } from 'svelte'
  import PatientForms from './PatientForms.svelte'
  import firebaseStorage from '../services/firebaseStorage.js'
  
  export let selectedPatient
  export let showMedicationForm
  export let editingMedication
  export let doctorId
  export let currentMedications
  export let prescriptionsFinalized
  export let showAIDrugSuggestions
  export let aiDrugSuggestions
  export let currentPrescription
  export let onMedicationAdded
  export let onCancelMedication
  export let onEditPrescription
  export let onDeletePrescription
  export let onDeleteMedicationByIndex
  export let onFinalizePrescription
  export let onShowPharmacyModal
  export let onGoToPreviousTab
  export let onGenerateAIDrugSuggestions
  export let onAddAISuggestedDrug
  export let onRemoveAISuggestedDrug
  export let loadingAIDrugSuggestions
  export let symptoms
  export let openaiService
  export let onNewPrescription
  export let onAddDrug
  export let onPrintPrescriptions
  
  // Debug AI suggestions
  $: console.log('🔍 PrescriptionsTab - showAIDrugSuggestions:', showAIDrugSuggestions)
  $: console.log('🔍 PrescriptionsTab - aiDrugSuggestions:', aiDrugSuggestions)
  $: console.log('🔍 PrescriptionsTab - aiDrugSuggestions.length:', aiDrugSuggestions?.length)
  
  // Pharmacy stock availability
  let pharmacyStock = []
  let stockLoading = false
  
  // Load pharmacy stock for availability checking
  const loadPharmacyStock = async () => {
    if (!doctorId) return
    
    try {
      stockLoading = true
      console.log('📦 Loading pharmacy stock for doctor:', doctorId)
      
      // Get doctor's connected pharmacists
      const doctor = await firebaseStorage.getDoctorById(doctorId)
      console.log('👨‍⚕️ Doctor data:', doctor)
      
      if (!doctor || !doctor.connectedPharmacists || doctor.connectedPharmacists.length === 0) {
        console.log('⚠️ No connected pharmacists found for doctor')
        pharmacyStock = []
        return
      }
      
      console.log('🏥 Connected pharmacists:', doctor.connectedPharmacists)
      
      // Get stock from all connected pharmacists
      let allStock = []
      for (const pharmacistId of doctor.connectedPharmacists) {
        console.log('📦 Loading stock for pharmacist:', pharmacistId)
        const stockData = await firebaseStorage.getPharmacistDrugStock(pharmacistId)
        if (stockData && stockData.length > 0) {
          allStock = allStock.concat(stockData)
          console.log('📦 Added', stockData.length, 'items from pharmacist', pharmacistId)
        }
      }
      
      pharmacyStock = allStock
      console.log('📦 Total loaded pharmacy stock:', pharmacyStock.length, 'items from', doctor.connectedPharmacists.length, 'pharmacists')
      
    } catch (error) {
      console.error('❌ Error loading pharmacy stock:', error)
      pharmacyStock = []
    } finally {
      stockLoading = false
    }
  }
  
  // Check if a medication is available in pharmacy stock
  const isMedicationAvailable = (medication) => {
    if (!medication || !pharmacyStock.length) return null
    
    console.log('🔍 ===== STARTING AVAILABILITY CHECK =====')
    console.log('🔍 Medication to check:', JSON.stringify(medication, null, 2))
    console.log('📦 Pharmacy stock array length:', pharmacyStock.length)
    console.log('📦 All pharmacy stock:', JSON.stringify(pharmacyStock, null, 2))
    
    // Parse medication dosage to extract strength and unit
    console.log('🔍 Dosage string:', medication.dosage)
    const dosageMatch = medication.dosage?.match(/^(\d+(?:\.\d+)?)([a-zA-Z]+)$/)
    console.log('🔍 Dosage match result:', dosageMatch)
    
    if (!dosageMatch) {
      console.log('⚠️ Could not parse dosage:', medication.dosage, '- trying name-only match')
      
      // Try to match by name only if dosage parsing fails
      const matchingStock = pharmacyStock.find(stock => {
        const stockName = stock.drugName?.toLowerCase().trim() || ''
        const medName = medication.name?.toLowerCase().trim() || ''
        const nameMatch = stockName && medName && stockName.includes(medName)
        
        console.log('🔍 Name-only comparison:', stockName, 'vs', medName, 'match:', nameMatch)
        return nameMatch
      })
      
      if (matchingStock) {
        const quantity = parseInt(matchingStock.quantity) || 0
        console.log('✅ Found name-only match:', matchingStock, 'quantity:', quantity)
        return {
          available: quantity > 0,
          quantity: quantity,
          stockItem: matchingStock
        }
      }
      
      return null
    }
    
    const [, strength, unit] = dosageMatch
    console.log('🔍 Parsed strength:', strength, 'unit:', unit)
    
    // Find matching stock item with more flexible matching
    const matchingStock = pharmacyStock.find(stock => {
      // Check drug name match (case insensitive, partial match)
      const stockName = stock.drugName?.toLowerCase().trim() || ''
      const medName = medication.name?.toLowerCase().trim() || ''
      const nameMatch = stockName && medName && stockName.includes(medName)
      
      console.log('🔍 Name comparison:', stockName, 'vs', medName, 'match:', nameMatch)
      
      // Check strength match (flexible)
      const stockStrength = stock.strength || ''
      const strengthMatch = stockStrength === strength || stockStrength.includes(strength)
      
      console.log('🔍 Strength comparison:', stockStrength, 'vs', strength, 'match:', strengthMatch)
      
      // Check unit match (flexible)
      const stockUnit = stock.strengthUnit || ''
      const unitMatch = !stockUnit || stockUnit === unit || stockUnit.includes(unit)
      
      console.log('🔍 Unit comparison:', stockUnit, 'vs', unit, 'match:', unitMatch)
      
      const isMatch = nameMatch && strengthMatch && unitMatch
      console.log('🔍 Overall match for stock item:', stock.drugName, ':', isMatch)
      
      return isMatch
    })
    
    if (matchingStock) {
      // Check if quantity is available
      const quantity = parseInt(matchingStock.quantity) || 0
      console.log('✅ Found matching stock:', matchingStock, 'quantity:', quantity)
      return {
        available: quantity > 0,
        quantity: quantity,
        stockItem: matchingStock
      }
    }
    
    console.log('❌ No matching stock found for:', medication.name)
    return { available: false, quantity: 0, stockItem: null }
  }
  
  // Load stock when component mounts or doctorId changes
  $: if (doctorId) {
    loadPharmacyStock()
  }
  
  onMount(() => {
    if (doctorId) {
      loadPharmacyStock()
    }
  })
</script>

<div class="prescriptions-responsive-container">
  <!-- Full Width Layout -->
  <div class="row">
    <!-- Main Prescription Column - Full Width -->
    <div class="col-12 mb-3">
      <!-- Prescription Card -->
      <div class="card border-2 border-info shadow-sm">
        <div class="card-header">
          <div class="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center">
            <h5 class="card-title mb-2 mb-md-0">
              <i class="fas fa-prescription-bottle-alt me-2"></i>Prescription
            </h5>
            <div class="d-flex flex-wrap gap-2">
              <!-- New Prescription Button -->
              <button 
                class="btn btn-success btn-sm" 
                on:click={onNewPrescription}
                title="Create a new prescription"
              >
                <i class="fas fa-plus me-1"></i>New Prescription
              </button>
              
              <!-- Add Drug Button -->
              <button 
                  class="btn btn-primary btn-sm" 
                  on:click={onAddDrug}
                  disabled={showMedicationForm || !currentPrescription}
                  title={!currentPrescription ? "Click 'New Prescription' first" : "Add medication to current prescription"}
              >
                <i class="fas fa-plus me-1"></i>Add Drug
              </button>
              
              <!-- AI Drug Suggestions Button -->
              <button 
                  class="btn btn-info btn-sm" 
                  on:click={onGenerateAIDrugSuggestions}
                  disabled={loadingAIDrugSuggestions || !symptoms || symptoms.length === 0 || !openaiService.isConfigured()}
                  title={!symptoms || symptoms.length === 0 ? "Add symptoms first" : "Get AI-assisted drug suggestions"}
              >
                {#if loadingAIDrugSuggestions}
                  <i class="fas fa-spinner fa-spin me-1"></i>Generating...
                {:else}
                  <i class="fas fa-brain me-1"></i>AI Suggestions
                {/if}
              </button>
            </div>
          </div>
        </div>
        <div class="card-body">
          <!-- Patient Forms -->
          <PatientForms 
            {showMedicationForm}
            {selectedPatient}
            {editingMedication}
            {doctorId}
            onMedicationAdded={onMedicationAdded}
            onCancelMedication={onCancelMedication}
          />
          
          <!-- Current Prescriptions List -->
          {#if currentMedications && currentMedications.length > 0}
            <div class="medication-list">
              {#each currentMedications as medication, index}
                <div class="medication-item d-flex justify-content-between align-items-center py-2 border-bottom">
                  <div class="flex-grow-1">
                    <div class="fw-bold fs-6">
                      {medication.name}
                      {#if medication.aiSuggested}
                        <span class="badge bg-info ms-2">
                          <i class="fas fa-brain me-1"></i>AI Suggested
                        </span>
                      {/if}
                      <!-- Availability Badge -->
                      {#if !stockLoading}
                        {@const availability = isMedicationAvailable(medication)}
                        {#if availability !== null && availability.available}
                          {@const isLowStock = availability.stockItem && availability.stockItem.initialQuantity && availability.quantity <= (availability.stockItem.initialQuantity * 0.1)}
                          <span class="badge {isLowStock ? 'bg-danger' : 'bg-warning'} ms-2">
                            <i class="fas fa-check-circle me-1"></i>In Stock
                          </span>
                        {/if}
                      {:else}
                        <span class="badge bg-secondary ms-2">
                          <i class="fas fa-spinner fa-spin me-1"></i>Checking...
                        </span>
                      {/if}
                    </div>
                    <small class="text-muted">
                      {medication.dosage} • {medication.frequency} • {medication.duration}
                    </small>
                    {#if medication.instructions}
                      <div class="mt-1">
                        <small class="text-muted">{medication.instructions}</small>
                      </div>
                    {/if}
                    {#if medication.aiReason}
                      <div class="mt-1">
                        <small class="text-info">
                          <i class="fas fa-lightbulb me-1"></i>
                          <strong>AI Reason:</strong> {medication.aiReason}
                        </small>
                      </div>
                    {/if}
                  </div>
                  {#if !prescriptionsFinalized}
                    <div class="btn-group btn-group-sm">
                      <button 
                        class="btn btn-outline-primary btn-sm"
                        on:click={() => onEditPrescription(medication, index)}
                        title="Edit medication"
                      >
                        <i class="fas fa-edit"></i>
                      </button>
                      <button 
                        class="btn btn-outline-danger btn-sm"
                        on:click={() => {
                          if (medication.id) {
                            onDeletePrescription(medication.id, index)
                          } else {
                            console.warn('⚠️ Medication missing ID, attempting to delete by index:', medication)
                            onDeleteMedicationByIndex(index)
                          }
                        }}
                        title="Delete medication"
                      >
                        <i class="fas fa-trash"></i>
                      </button>
                    </div>
                  {:else}
                    <div class="text-muted">
                      <small><i class="fas fa-check-circle me-1"></i>Finalized</small>
                    </div>
                  {/if}
                </div>
              {/each}
            </div>
            
            <!-- AI Suggestions Section - Inside Prescription Card -->
            {#if showAIDrugSuggestions && aiDrugSuggestions.length > 0}
              <div class="mt-4 border-top pt-3">
                <div class="d-flex justify-content-between align-items-center mb-3">
                  <h6 class="text-info mb-0">
                    <i class="fas fa-brain me-2"></i>
                    AI Drug Suggestions ({aiDrugSuggestions.length})
                  </h6>
                </div>
                <div class="row">
                  {#each aiDrugSuggestions as suggestion, index}
                    <div class="col-12 col-md-6 col-lg-4 mb-3">
                      <div class="card border-info">
                        <div class="card-body p-2">
                          <div class="d-flex justify-content-between align-items-start mb-1">
                            <h6 class="card-title mb-0 text-primary">{suggestion.name}</h6>
                            <div class="btn-group btn-group-sm">
                              <button 
                                class="btn btn-success btn-sm"
                                on:click={() => onAddAISuggestedDrug(suggestion, index)}
                                disabled={!currentPrescription}
                                title="Add to prescription"
                              >
                                <i class="fas fa-plus"></i>
                              </button>
                              <button 
                                class="btn btn-outline-danger btn-sm"
                                on:click={() => onRemoveAISuggestedDrug(index)}
                                title="Remove suggestion"
                              >
                                <i class="fas fa-times"></i>
                              </button>
                            </div>
                          </div>
                          <div class="small text-muted mb-1">
                            <strong>Dosage:</strong> {suggestion.dosage} • <strong>Frequency:</strong> {suggestion.frequency}
                          </div>
                          {#if suggestion.reason}
                            <div class="small text-info">
                              <i class="fas fa-lightbulb me-1"></i>
                              <strong>Reason:</strong> {suggestion.reason}
                            </div>
                          {/if}
                        </div>
                      </div>
                    </div>
                  {/each}
                </div>
              </div>
            {/if}
            
            <!-- Prescription Actions -->
            <div class="mt-3 d-flex gap-2 justify-content-center">
              {#if !prescriptionsFinalized}
                <button 
                  class="btn btn-success btn-sm"
                  on:click={onFinalizePrescription}
                  disabled={currentMedications.length === 0}
                  title="Finalize this prescription"
                >
                  <i class="fas fa-check me-1"></i>Finalize Prescription
                </button>
              {:else}
                <button 
                  class="btn btn-warning btn-sm"
                  on:click={onShowPharmacyModal}
                  title="Send to pharmacy"
                >
                  <i class="fas fa-paper-plane me-1"></i>Send to Pharmacy
                </button>
              {/if}
              
              <!-- Print/PDF Button - Only available after finalizing -->
              {#if prescriptionsFinalized && currentMedications.length > 0}
                <button 
                  class="btn btn-info btn-sm"
                  on:click={onPrintPrescriptions}
                  title="Generate and download prescription PDF"
                >
                  <i class="fas fa-file-pdf me-1"></i>Print PDF
                </button>
              {/if}
            </div>
          {:else}
            <div class="text-center text-muted py-3">
              <i class="fas fa-pills fa-2x mb-2"></i>
              <p>No current prescriptions for today</p>
            </div>
          {/if}
          
          <!-- AI Suggestions Section - Show even when no prescriptions -->
          {#if showAIDrugSuggestions && aiDrugSuggestions.length > 0}
            <div class="mt-4 border-top pt-3">
              <div class="d-flex justify-content-between align-items-center mb-3">
                <h6 class="text-info mb-0">
                  <i class="fas fa-brain me-2"></i>
                  AI Drug Suggestions ({aiDrugSuggestions.length})
                </h6>
              </div>
              <div class="row">
                {#each aiDrugSuggestions as suggestion, index}
                  <div class="col-12 col-md-6 col-lg-4 mb-3">
                    <div class="card border-info">
                      <div class="card-body p-2">
                        <div class="d-flex justify-content-between align-items-start mb-1">
                          <h6 class="card-title mb-0 text-primary">{suggestion.name}</h6>
                          <div class="btn-group btn-group-sm">
                            <button 
                              class="btn btn-success btn-sm"
                              on:click={() => onAddAISuggestedDrug(suggestion, index)}
                              disabled={!currentPrescription}
                              title="Add to prescription"
                            >
                              <i class="fas fa-plus"></i>
                            </button>
                            <button 
                              class="btn btn-outline-danger btn-sm"
                              on:click={() => onRemoveAISuggestedDrug(index)}
                              title="Remove suggestion"
                            >
                              <i class="fas fa-times"></i>
                            </button>
                          </div>
                        </div>
                        <div class="small text-muted mb-1">
                          <strong>Dosage:</strong> {suggestion.dosage} • <strong>Frequency:</strong> {suggestion.frequency}
                        </div>
                        {#if suggestion.reason}
                          <div class="small text-info">
                            <i class="fas fa-lightbulb me-1"></i>
                            <strong>Reason:</strong> {suggestion.reason}
                          </div>
                        {/if}
                      </div>
                    </div>
                  </div>
                {/each}
              </div>
            </div>
          {/if}
        </div>
      </div>
    </div>
  </div>
  
  <!-- Navigation Buttons -->
  <div class="row mt-3">
    <div class="col-12 text-center">
      <button 
        class="btn btn-outline-secondary btn-sm"
        on:click={onGoToPreviousTab}
        title="Go back to Diagnoses tab"
      >
        <i class="fas fa-arrow-left me-2"></i>Back
      </button>
    </div>
  </div>
</div>

<style>
  /* Component-specific styles - main responsive styles are in PatientDetails.svelte */
</style>
