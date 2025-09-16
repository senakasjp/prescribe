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
  <div class="prescription-history">
    {#each prescriptionsWithMedications as prescription, prescriptionIndex}
      <div class="card mb-3 shadow-sm">
        <!-- Prescription Header -->
        <div class="card-header bg-primary text-white py-2">
          <div class="d-flex align-items-center">
            <i class="fas fa-prescription-bottle-alt me-2"></i>
            <h6 class="mb-0 fw-bold">
              Prescription #{prescriptionIndex + 1} on {formatPrescriptionDate(prescription.createdAt)}
            </h6>
          </div>
          {#if prescription.notes}
            <small class="opacity-75 mt-1 d-block">
              <i class="fas fa-sticky-note me-1"></i>
              {prescription.notes}
            </small>
          {/if}
        </div>
        
        <!-- Medications List -->
        <div class="card-body p-0">
          {#each prescription.medications as medication, medicationIndex}
            <div class="border-bottom p-3 {medicationIndex === prescription.medications.length - 1 ? 'border-bottom-0' : ''}">
              <div class="row g-2">
                <div class="col-12">
                  <h6 class="mb-2 text-primary">
                    <i class="fas fa-pills me-2"></i>
                    {medication.name || 'Unknown Medication'}
                  </h6>
                </div>
                <div class="col-sm-6 col-md-3">
                  <small class="text-muted d-block">Dosage</small>
                  <span class="fw-bold">{medication.dosage || 'Not specified'}</span>
                </div>
                <div class="col-sm-6 col-md-3">
                  <small class="text-muted d-block">Duration</small>
                  <span class="fw-bold">{medication.duration || 'Not specified'}</span>
                </div>
                <div class="col-sm-6 col-md-3">
                  <small class="text-muted d-block">Frequency</small>
                  <span class="fw-bold">{medication.frequency || 'Not specified'}</span>
                </div>
                <div class="col-sm-6 col-md-3">
                  <small class="text-muted d-block">Added</small>
                  <span class="text-muted">
                    <i class="fas fa-calendar me-1"></i>
                    {medication.createdAt ? new Date(medication.createdAt).toLocaleDateString() : 'Unknown date'}
                  </span>
                </div>
                <div class="col-12">
                  <small class="text-muted d-block">Instructions</small>
                  <p class="mb-1">{medication.instructions || 'No instructions provided'}</p>
                </div>
                {#if medication.notes}
                  <div class="col-12">
                    <small class="text-muted d-block">Notes</small>
                    <p class="mb-0 text-info">{medication.notes}</p>
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
  <div class="text-center p-4">
    <i class="fas fa-pills fa-2x text-muted mb-3"></i>
    <p class="text-muted">No prescriptions found for this patient.</p>
  </div>
{/if}

