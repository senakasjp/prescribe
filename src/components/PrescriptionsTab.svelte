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

<div class="space-y-4">
  <!-- Prescription Card -->
  <div class="bg-white border-2 border-gray-200 rounded-lg shadow-sm">
    <div class="bg-gray-100 text-gray-800 px-4 py-3 rounded-t-lg">
      <div class="flex flex-col md:flex-row justify-between items-start md:items-center">
        <h5 class="text-lg font-semibold mb-2 md:mb-0">
          <i class="fas fa-prescription-bottle-alt mr-2"></i>Prescription
        </h5>
        <div class="flex flex-wrap gap-2">
          <!-- New Prescription Button -->
          <button 
            class="bg-teal-600 hover:bg-teal-700 text-white px-3 py-1 rounded text-sm font-medium transition-colors duration-200" 
            on:click={onNewPrescription}
            title="Create a new prescription"
          >
            <i class="fas fa-plus mr-1"></i>New Prescription
          </button>
          
          <!-- Add Drug Button -->
          <button 
              class="bg-teal-600 hover:bg-teal-700 text-white px-3 py-1 rounded text-sm font-medium transition-colors duration-200 disabled:bg-gray-400 disabled:cursor-not-allowed" 
              on:click={onAddDrug}
              disabled={showMedicationForm || !currentPrescription}
              title={!currentPrescription ? "Click 'New Prescription' first" : "Add medication to current prescription"}
          >
            <i class="fas fa-plus mr-1"></i>Add Drug
          </button>
          
          <!-- AI Drug Suggestions Button -->
          <button 
              class="bg-teal-500 hover:bg-teal-600 text-white px-3 py-1 rounded text-sm font-medium transition-colors duration-200 disabled:bg-gray-400 disabled:cursor-not-allowed" 
              on:click={onGenerateAIDrugSuggestions}
              disabled={loadingAIDrugSuggestions || !symptoms || symptoms.length === 0 || !openaiService.isConfigured() || !currentPrescription || (currentPrescription && (!currentPrescription.medications || currentPrescription.medications.length === 0))}
              title={!currentPrescription ? "Create a prescription first" : (!symptoms || symptoms.length === 0) ? "Add symptoms first" : (currentPrescription && (!currentPrescription.medications || currentPrescription.medications.length === 0)) ? "Add at least one drug first" : "Get AI-assisted drug suggestions"}
          >
            {#if loadingAIDrugSuggestions}
              <svg class="animate-spin -ml-1 mr-1 h-3 w-3 text-white inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Generating...
            {:else}
              <i class="fas fa-brain mr-1 text-red-600"></i>AI Suggestions
            {/if}
          </button>
        </div>
      </div>
    </div>
    <div class="p-4">
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
                <div class="flex justify-between items-center py-3 border-b border-gray-200 last:border-b-0">
                  <div class="flex-1">
                    <div class="font-semibold text-gray-900">
                      {medication.name}
                      {#if medication.aiSuggested}
                        <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 ml-2">
                          <i class="fas fa-brain mr-1 text-red-600"></i>AI Suggested
                        </span>
                      {/if}
                      <!-- Availability Badge -->
                      {#if !stockLoading}
                        {@const availability = isMedicationAvailable(medication)}
                        {#if availability !== null && availability.available}
                          {@const isLowStock = availability.stockItem && availability.stockItem.initialQuantity && availability.quantity <= (availability.stockItem.initialQuantity * 0.1)}
                          <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium {isLowStock ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'} ml-2">
                            <i class="fas fa-check-circle mr-1"></i>In Stock
                          </span>
                        {/if}
                      {:else}
                        <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 ml-2">
                          <i class="fas fa-spinner fa-spin mr-1"></i>Checking...
                        </span>
                      {/if}
                    </div>
                    <div class="text-gray-500 text-sm">
                      {medication.dosage} • {medication.frequency} • {medication.duration}
                    </div>
                    {#if medication.instructions}
                      <div class="mt-1">
                        <div class="text-gray-500 text-sm">{medication.instructions}</div>
                      </div>
                    {/if}
                    {#if medication.aiReason}
                      <div class="mt-1">
                        <div class="text-gray-700 text-sm">
                          <i class="fas fa-lightbulb mr-1"></i>
                          <span class="font-medium">AI Reason:</span> {medication.aiReason}
                        </div>
                      </div>
                    {/if}
                  </div>
                  {#if !prescriptionsFinalized}
                    <div class="flex gap-2">
                      <button 
                        class="inline-flex items-center px-2 py-1 border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 text-xs font-medium rounded focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 transition-colors duration-200"
                        on:click={() => onEditPrescription(medication, index)}
                        title="Edit medication"
                      >
                        <i class="fas fa-edit"></i>
                      </button>
                      <button 
                        class="inline-flex items-center px-2 py-1 border border-red-300 text-red-700 bg-white hover:bg-red-50 text-xs font-medium rounded focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors duration-200"
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
                    <div class="text-gray-500">
                      <div class="text-sm"><i class="fas fa-check-circle mr-1"></i>Finalized</div>
                    </div>
                  {/if}
                </div>
              {/each}
            </div>
            
            <!-- AI Suggestions Section - Inside Prescription Card -->
            {#if showAIDrugSuggestions && aiDrugSuggestions.length > 0}
              <div class="mt-4 border-t border-gray-200 pt-4">
                <div class="flex justify-between items-center mb-4">
                  <h6 class="text-lg font-semibold text-gray-700 mb-0">
                    <i class="fas fa-brain mr-2 text-red-600"></i>
                    AI Drug Suggestions ({aiDrugSuggestions.length})
                  </h6>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {#each aiDrugSuggestions as suggestion, index}
                    <div class="bg-white border border-gray-200 rounded-lg shadow-sm">
                      <div class="p-3">
                        <div class="flex justify-between items-start mb-2">
                          <h6 class="text-sm font-semibold text-gray-700 mb-0">{suggestion.name}</h6>
                          <div class="flex gap-1">
                            <button 
                              class="inline-flex items-center px-2 py-1 bg-teal-600 hover:bg-teal-700 text-white text-xs font-medium rounded focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 transition-colors duration-200 disabled:bg-gray-400 disabled:cursor-not-allowed"
                              on:click={() => onAddAISuggestedDrug(suggestion, index)}
                              disabled={!currentPrescription}
                              title="Add to prescription"
                            >
                              <i class="fas fa-plus"></i>
                            </button>
                            <button 
                              class="inline-flex items-center px-2 py-1 border border-red-300 text-red-700 bg-white hover:bg-red-50 text-xs font-medium rounded focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors duration-200"
                              on:click={() => onRemoveAISuggestedDrug(index)}
                              title="Remove suggestion"
                            >
                              <i class="fas fa-times"></i>
                            </button>
                          </div>
                        </div>
                        <div class="text-gray-500 text-sm mb-2">
                          <span class="font-medium">Dosage:</span> {suggestion.dosage} • <span class="font-medium">Frequency:</span> {suggestion.frequency}
                        </div>
                        {#if suggestion.reason}
                          <div class="text-gray-700 text-sm">
                            <i class="fas fa-lightbulb mr-1"></i>
                            <span class="font-medium">Reason:</span> {suggestion.reason}
                          </div>
                        {/if}
                      </div>
                    </div>
                  {/each}
                </div>
              </div>
            {/if}
            
            <!-- Prescription Actions -->
            <div class="mt-4 flex gap-3 justify-center">
              {#if !prescriptionsFinalized}
                <button 
                  class="inline-flex items-center px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 transition-colors duration-200 disabled:bg-gray-400 disabled:cursor-not-allowed"
                  on:click={onFinalizePrescription}
                  disabled={currentMedications.length === 0}
                  title="Finalize this prescription"
                >
                  <i class="fas fa-check mr-1"></i>Finalize Prescription
                </button>
              {:else}
                <button 
                  class="inline-flex items-center px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white text-sm font-medium rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2 transition-colors duration-200"
                  on:click={onShowPharmacyModal}
                  title="Send to pharmacy"
                >
                  <i class="fas fa-paper-plane mr-1"></i>Send to Pharmacy
                </button>
              {/if}
              
              <!-- Print/PDF Button - Only available after finalizing -->
              {#if prescriptionsFinalized && currentMedications.length > 0}
                <button 
                  class="inline-flex items-center px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 transition-colors duration-200"
                  on:click={onPrintPrescriptions}
                  title="Generate and download prescription PDF"
                >
                  <i class="fas fa-file-pdf mr-1"></i>Print PDF
                </button>
              {/if}
            </div>
          {:else}
            <div class="text-center text-gray-500 py-8">
              <i class="fas fa-pills text-4xl mb-3"></i>
              <p class="mb-2">No current prescriptions for today</p>
              <p class="text-sm text-gray-400 mb-1">Click the <span class="font-medium text-teal-600">"+ Add Drug"</span> button to start adding medications to this prescription.</p>
              <p class="text-sm text-gray-400">Or you can use <span class="font-medium text-teal-600">AI suggestions</span> to get AI recommendations based on symptoms.</p>
            </div>
          {/if}
          
        </div>
      </div>
    </div>
  
  <!-- Navigation Buttons -->
  <div class="mt-4 text-center">
    <button 
      class="inline-flex items-center px-4 py-2 border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 text-sm font-medium rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 transition-colors duration-200"
      on:click={onGoToPreviousTab}
      title="Go back to Diagnoses tab"
    >
      <i class="fas fa-arrow-left mr-2"></i>Back
    </button>
  </div>

<style>
  /* Component-specific styles - main responsive styles are in PatientDetails.svelte */
</style>
