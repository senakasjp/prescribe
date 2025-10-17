<script>
  import { createEventDispatcher } from 'svelte'
  import { formatDate, sortByDate } from '../../utils/dataProcessing.js'
  import { getIconClass, getButtonClasses, getBadgeClasses } from '../../utils/uiHelpers.js'
  import { PRESCRIPTION_STATUS, MEDICATION_FREQUENCIES } from '../../utils/constants.js'
  
  const dispatch = createEventDispatcher()
  
  export let prescriptions = []
  export let selectedPatient
  export let doctorId
  export let showPrescriptionForm = false
  export const currentPrescription = null
  export let currentMedications = []
  export let prescriptionNotes = ''
  export let prescriptionDiscount = 0 // New discount field
  export const prescriptionsFinalized = false
  
  // Sort prescriptions by date (newest first)
  $: sortedPrescriptions = sortByDate(prescriptions, 'createdAt')
  
  // Handle add prescription
  function addPrescription() {
    showPrescriptionForm = true
    dispatch('add-prescription')
  }
  
  // Handle edit prescription
  function editPrescription(prescription) {
    dispatch('edit-prescription', prescription)
  }
  
  // Handle delete prescription
  function deletePrescription(prescription) {
    dispatch('delete-prescription', prescription)
  }
  
  // Handle print prescription
  function printPrescription(prescription) {
    dispatch('print-prescription', prescription)
  }
  
  // Handle finalize prescription
  function finalizePrescription() {
    dispatch('finalize-prescription', {
      medications: currentMedications,
      notes: prescriptionNotes,
      discount: prescriptionDiscount
    })
  }
  
  // Handle add medication to current prescription
  function addMedication() {
    dispatch('add-medication')
  }
  
  // Handle edit medication
  function editMedication(medication) {
    dispatch('edit-medication', medication)
  }
  
  // Handle delete medication
  function deleteMedication(medication) {
    dispatch('delete-medication', medication)
  }
  
  // Get prescription status color
  function getStatusColor(status) {
    const colorMap = {
      [PRESCRIPTION_STATUS.DRAFT]: 'warning',
      [PRESCRIPTION_STATUS.SAVED]: 'info',
      [PRESCRIPTION_STATUS.PRINTED]: 'success',
      [PRESCRIPTION_STATUS.SENT]: 'success',
      [PRESCRIPTION_STATUS.CANCELLED]: 'danger'
    }
    return colorMap[status] || 'default'
  }
  
  // Get prescription status label
  function getStatusLabel(status) {
    const labelMap = {
      [PRESCRIPTION_STATUS.DRAFT]: 'Draft',
      [PRESCRIPTION_STATUS.SAVED]: 'Saved',
      [PRESCRIPTION_STATUS.PRINTED]: 'Printed',
      [PRESCRIPTION_STATUS.SENT]: 'Sent',
      [PRESCRIPTION_STATUS.CANCELLED]: 'Cancelled'
    }
    return labelMap[status] || status
  }
  
  // Get frequency label
  function getFrequencyLabel(frequency) {
    return MEDICATION_FREQUENCIES.find(f => f === frequency) || frequency
  }
</script>

<div class="bg-white rounded-lg shadow-sm border border-gray-200">
  <div class="px-6 py-4 border-b border-gray-200">
    <div class="flex justify-between items-center">
      <div>
        <h3 class="text-lg font-medium text-gray-900">Prescriptions</h3>
        <p class="text-sm text-gray-500">Patient prescriptions and medications</p>
      </div>
      <button
        on:click={addPrescription}
        class="{getButtonClasses('primary', { size: 'sm' })}"
      >
        <i class="{getIconClass('add')} mr-2"></i>
        New Prescription
      </button>
    </div>
  </div>
  
  <div class="p-6">
    {#if showPrescriptionForm}
      <!-- Prescription Form -->
      <div class="border border-teal-200 rounded-lg p-4 bg-teal-50 mb-6">
        <div class="flex justify-between items-center mb-4">
          <h4 class="text-lg font-medium text-teal-900">New Prescription</h4>
          <button
            on:click={() => showPrescriptionForm = false}
            class="text-teal-600 hover:text-teal-700"
          >
            <i class="{getIconClass('cancel')}"></i>
          </button>
        </div>
        
        <div class="space-y-4">
          <!-- Current Medications -->
          <div>
            <div class="flex justify-between items-center mb-2">
              <h5 class="text-sm font-medium text-gray-700">Medications</h5>
              <button
                on:click={addMedication}
                class="{getButtonClasses('secondary', { size: 'xs' })}"
              >
                <i class="{getIconClass('add')} mr-1"></i>
                Add Medication
              </button>
            </div>
            
            {#if currentMedications.length === 0}
              <div class="text-center py-4 text-gray-500">
                <i class="{getIconClass('medication')} text-2xl mb-2"></i>
                <p>No medications added yet</p>
              </div>
            {:else}
              <div class="space-y-2">
                {#each currentMedications as medication, index (medication.id || index)}
                  <div class="flex items-center justify-between p-3 bg-white rounded-md border">
                    <div class="flex-1">
                      <div class="flex items-center space-x-3">
                        <span class="font-medium text-gray-900">{medication.name}{#if medication.genericName && medication.genericName !== medication.name} ({medication.genericName}){/if}</span>
                        <span class="text-sm text-gray-500">{medication.dosage}</span>
                        <span class="text-sm text-gray-500">{getFrequencyLabel(medication.frequency)}</span>
                        {#if medication.duration}
                          <span class="text-sm text-gray-500">for {medication.duration}</span>
                        {/if}
                      </div>
                      {#if medication.instructions}
                        <p class="text-sm text-gray-600 mt-1">{medication.instructions}</p>
                      {/if}
                    </div>
                    <div class="flex items-center space-x-2">
                      <button
                        on:click={() => editMedication(medication)}
                        class="text-gray-400 hover:text-gray-600"
                        title="Edit medication"
                      >
                        <i class="{getIconClass('edit')}"></i>
                      </button>
                      <button
                        on:click={() => deleteMedication(medication)}
                        class="text-gray-400 hover:text-red-600"
                        title="Remove medication"
                      >
                        <i class="{getIconClass('delete')}"></i>
                      </button>
                    </div>
                  </div>
                {/each}
              </div>
            {/if}
          </div>
          
          <!-- Prescription Notes -->
          <div>
            <label for="prescriptionNotes" class="block text-sm font-medium text-gray-700 mb-1">Prescription Notes</label>
            <textarea
              id="prescriptionNotes"
              bind:value={prescriptionNotes}
              rows="3"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
              placeholder="Additional instructions or notes for the prescription"
            ></textarea>
          </div>
          
          <!-- Discount Field -->
          <div>
            <label for="prescriptionDiscount" class="block text-sm font-medium text-gray-700 mb-1">
              <i class="fas fa-percentage mr-2 text-teal-600"></i>
              Discount (for pharmacy use only)
            </label>
            <select
              id="prescriptionDiscount"
              bind:value={prescriptionDiscount}
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
            >
              <option value={0}>0% - No Discount</option>
              <option value={5}>5%</option>
              <option value={10}>10%</option>
              <option value={15}>15%</option>
              <option value={20}>20%</option>
              <option value={25}>25%</option>
              <option value={30}>30%</option>
              <option value={35}>35%</option>
              <option value={40}>40%</option>
              <option value={45}>45%</option>
              <option value={50}>50%</option>
              <option value={55}>55%</option>
              <option value={60}>60%</option>
              <option value={65}>65%</option>
              <option value={70}>70%</option>
              <option value={75}>75%</option>
              <option value={80}>80%</option>
              <option value={85}>85%</option>
              <option value={90}>90%</option>
              <option value={95}>95%</option>
              <option value={100}>100%</option>
            </select>
            <div class="text-xs text-gray-500 mt-1">
              <i class="fas fa-info-circle mr-1"></i>
              Discount applies only when sending to pharmacy (not included in PDF)
            </div>
          </div>
          
          <!-- Action Buttons -->
          <div class="flex justify-end space-x-3">
            <button
              on:click={() => showPrescriptionForm = false}
              class="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500"
            >
              Cancel
            </button>
            <button
              on:click={finalizePrescription}
              disabled={currentMedications.length === 0}
              class="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <i class="{getIconClass('save')} mr-2"></i>
              Save Prescription
            </button>
          </div>
        </div>
      </div>
    {/if}
    
    {#if sortedPrescriptions.length === 0}
      <div class="text-center py-8">
        <i class="{getIconClass('prescription')} text-4xl text-gray-400 mb-4"></i>
        <h3 class="text-lg font-medium text-gray-900 mb-2">No prescriptions recorded</h3>
        <p class="text-gray-500 mb-4">Start by creating a new prescription for this patient.</p>
        <button
          on:click={addPrescription}
          class="{getButtonClasses('primary')}"
        >
          <i class="{getIconClass('add')} mr-2"></i>
          Create First Prescription
        </button>
      </div>
    {:else}
      <div class="space-y-4">
        {#each sortedPrescriptions as prescription (prescription.id)}
          <div class="border border-gray-200 rounded-lg p-4 hover:shadow-sm transition-shadow duration-200">
            <div class="flex justify-between items-start">
              <div class="flex-1">
                <div class="flex items-center space-x-3 mb-2">
                  <h4 class="text-lg font-medium text-gray-900">
                    Prescription #{prescription.id?.slice(-8) || 'Unknown'}
                  </h4>
                  <span class="{getBadgeClasses(getStatusColor(prescription.status), { size: 'sm' })}">
                    {getStatusLabel(prescription.status)}
                  </span>
                </div>
                
                <div class="flex items-center text-sm text-gray-500 mb-3">
                  <i class="{getIconClass('calendar')} mr-1"></i>
                  {formatDate(prescription.createdAt, { includeTime: true })}
                </div>
                
                {#if prescription.medications && prescription.medications.length > 0}
                  <div class="space-y-2 mb-3">
                    {#each prescription.medications as medication, index}
                      <div class="flex items-center space-x-3 text-sm">
                        <i class="{getIconClass('medication')} text-gray-400"></i>
                        <span class="font-medium text-gray-900">{medication.name}</span>
                        <span class="text-gray-500">{medication.dosage}</span>
                        <span class="text-gray-500">{getFrequencyLabel(medication.frequency)}</span>
                        {#if medication.duration}
                          <span class="text-gray-500">for {medication.duration}</span>
                        {/if}
                      </div>
                    {/each}
                  </div>
                {/if}
                
                {#if prescription.notes}
                  <div class="mt-3 p-3 bg-gray-50 rounded-md">
                    <h5 class="text-sm font-medium text-gray-700 mb-2">Notes:</h5>
                    <p class="text-sm text-gray-600">{prescription.notes}</p>
                  </div>
                {/if}
              </div>
              
              <div class="flex items-center space-x-2 ml-4">
                <button
                  on:click={() => printPrescription(prescription)}
                  class="text-gray-400 hover:text-blue-600 transition-colors duration-200"
                  title="Print prescription"
                >
                  <i class="{getIconClass('print')}"></i>
                </button>
                
                <button
                  on:click={() => editPrescription(prescription)}
                  class="text-gray-400 hover:text-gray-600 transition-colors duration-200"
                  title="Edit prescription"
                >
                  <i class="{getIconClass('edit')}"></i>
                </button>
                
                <button
                  on:click={() => deletePrescription(prescription)}
                  class="text-gray-400 hover:text-red-600 transition-colors duration-200"
                  title="Delete prescription"
                >
                  <i class="{getIconClass('delete')}"></i>
                </button>
              </div>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>
