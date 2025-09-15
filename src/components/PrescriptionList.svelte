<script>
  export let prescriptions = []
</script>

{#if prescriptions && prescriptions.length > 0}
  <div class="list-group">
    {#each prescriptions as prescription, index}
      <div class="list-group-item">
        <div class="w-100">
          <h6 class="mb-1 fs-5">
            <i class="fas fa-pills me-2"></i>
            {prescription.name || 'Unknown Prescription'}
          </h6>
          <p class="mb-1">
            <strong>Dosage:</strong> {prescription.dosage || 'Not specified'} | 
            <strong>Duration:</strong> {prescription.duration || 'Not specified'}
          </p>
          <p class="mb-1">
            <strong>Instructions:</strong> {prescription.instructions || 'No instructions provided'}
          </p>
          {#if prescription.notes}
            <p class="mb-1">
              <strong>Notes:</strong> {prescription.notes}
            </p>
          {/if}
          <small class="text-muted">
            <i class="fas fa-calendar me-1"></i>
            Prescribed: {prescription.createdAt ? new Date(prescription.createdAt).toLocaleDateString() : 'Unknown date'}
          </small>
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
