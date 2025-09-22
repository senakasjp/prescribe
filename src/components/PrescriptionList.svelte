<script>
  export let prescriptions = []
  
  // Helper function to group medications by prescription
  const getPrescriptionsWithMedications = () => {
    const prescriptionsWithMedications = prescriptions
      .filter(prescription => prescription.medications && prescription.medications.length > 0)
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
    
    console.log('🔍 PrescriptionList: Total prescriptions:', prescriptions.length)
    console.log('🔍 PrescriptionList: Prescriptions with medications:', prescriptionsWithMedications.length)
    console.log('🔍 PrescriptionList: Prescription data:', prescriptions)
    
    return prescriptionsWithMedications
  }
  
  const prescriptionsWithMedications = getPrescriptionsWithMedications()
  
  // Helper function to format prescription date
  const formatPrescriptionDate = (dateString) => {
    if (!dateString) return 'Unknown date'
    return new Date(dateString).toLocaleDateString()
  }
</script>

{#if prescriptionsWithMedications && prescriptionsWithMedications.length > 0}
  <div class="space-y-4">
    {#each prescriptionsWithMedications as prescription, prescriptionIndex}
      <div class="bg-white rounded-lg shadow-sm border-2 {prescriptionIndex % 2 === 0 ? 'border-teal-200' : 'border-teal-200'}">
        <!-- Prescription Header -->
        <div class="bg-teal-600 text-white px-4 py-3 rounded-t-lg">
          <div class="flex items-center">
            <i class="fas fa-prescription-bottle-alt mr-2"></i>
            <h6 class="text-lg font-semibold mb-0">
              Prescription #{prescriptionIndex + 1} on {formatPrescriptionDate(prescription.createdAt)}
            </h6>
          </div>
          {#if prescription.notes}
            <div class="text-sm opacity-90 mt-1">
              <i class="fas fa-sticky-note mr-1"></i>
              {prescription.notes}
            </div>
          {/if}
        </div>
        
        <!-- Medications List -->
        <div class="divide-y divide-gray-200">
          {#each prescription.medications as medication, medicationIndex}
            <div class="p-4 {medicationIndex === prescription.medications.length - 1 ? '' : 'border-b border-gray-200'}">
              <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                <div class="col-span-full">
                  <h6 class="text-lg font-semibold text-teal-600 mb-2">
                    <i class="fas fa-pills mr-2"></i>
                    {medication.name || 'Unknown Medication'}
                  </h6>
                </div>
                <div>
                  <div class="text-xs text-gray-500 uppercase tracking-wide mb-1">Dosage</div>
                  <div class="font-semibold text-gray-900">{medication.dosage || 'Not specified'}</div>
                </div>
                <div>
                  <div class="text-xs text-gray-500 uppercase tracking-wide mb-1">Duration</div>
                  <div class="font-semibold text-gray-900">{medication.duration || 'Not specified'}</div>
                </div>
                <div>
                  <div class="text-xs text-gray-500 uppercase tracking-wide mb-1">Frequency</div>
                  <div class="font-semibold text-gray-900">{medication.frequency || 'Not specified'}</div>
                </div>
                <div>
                  <div class="text-xs text-gray-500 uppercase tracking-wide mb-1">Added</div>
                  <div class="text-gray-600">
                    <i class="fas fa-calendar mr-1"></i>
                    {medication.createdAt ? new Date(medication.createdAt).toLocaleDateString() : 'Unknown date'}
                  </div>
                </div>
                <div class="col-span-full">
                  <div class="text-xs text-gray-500 uppercase tracking-wide mb-1">Instructions</div>
                  <p class="text-gray-700">{medication.instructions || 'No instructions provided'}</p>
                </div>
                {#if medication.notes}
                  <div class="col-span-full">
                    <div class="text-xs text-gray-500 uppercase tracking-wide mb-1">Notes</div>
                    <p class="text-teal-600">{medication.notes}</p>
                  </div>
                {/if}
              </div>
            </div>
          {/each}
        </div>
      </div>
    {/each}
  </div>
{:else}
  <div class="text-center py-8">
    <i class="fas fa-pills text-4xl text-gray-400 mb-3"></i>
    <p class="text-gray-500">No prescriptions found for this patient.</p>
  </div>
{/if}

