<script>
  import { createEventDispatcher } from 'svelte'
  
  const dispatch = createEventDispatcher()
  
  export let selectedPatient
  export let illnesses = []
  export let prescriptions = []
  export let symptoms = []
  export let activeMedicalTab = 'prescriptions'
  export let showSymptomsNotes = false
  export let showIllnessesNotes = false
  export let showPrescriptionsNotes = false
  export let addToPrescription
  export let hasNotes
  export let toggleSymptomsNotes
  export let toggleIllnessesNotes
  export let togglePrescriptionsNotes
  export let groupByDate

  // Reactive tab counts
  $: symptomsCount = symptoms?.length || 0
  $: illnessesCount = illnesses?.length || 0
  $: prescriptionsCount = prescriptions?.length || 0
  
  // Extract all medications from prescriptions and group by drug name
  $: groupedMedications = prescriptions?.flatMap(prescription => 
    prescription.medications?.map(medication => ({
      ...medication,
      prescriptionId: prescription.id,
      prescriptionDate: prescription.createdAt,
      daysAgo: medication.createdAt ? Math.floor((new Date() - new Date(medication.createdAt)) / (1000 * 60 * 60 * 24)) : null
    })) || []
  ).reduce((groups, medication) => {
    const drugName = medication.name || 'Unknown medication'
    if (!groups[drugName]) {
      groups[drugName] = []
    }
    groups[drugName].push(medication)
    return groups
  }, {}) || {}
  
  // Convert grouped medications to array and sort by most recent dose
  $: allMedications = Object.entries(groupedMedications).map(([drugName, doses]) => ({
    drugName,
    doses: doses.sort((a, b) => new Date(b.createdAt || b.prescriptionDate || 0) - new Date(a.createdAt || a.prescriptionDate || 0))
  })).sort((a, b) => new Date(b.doses[0].createdAt || b.doses[0].prescriptionDate || 0) - new Date(a.doses[0].createdAt || a.doses[0].prescriptionDate || 0))
  
  // Handle tab change
  const handleTabChange = (tab) => {
    dispatch('tabChange', { tab })
  }
</script>

{#if selectedPatient}
  <div class="card border-2 border-info mt-3 shadow-sm">
    <div class="card-header bg-light">
      <div class="d-flex justify-content-between align-items-center">
        <h6 class="mb-0">
          <i class="fas fa-chart-pie me-2"></i>Medical Summary
        </h6>
        <button 
          class="btn btn-outline-secondary btn-sm" 
          on:click={() => selectedPatient = null}
          title="Back to patient list"
        >
          <i class="fas fa-arrow-left me-1"></i>Back
        </button>
      </div>
    </div>
    <div class="card-body p-0">
      <!-- Medical Summary Tabs -->
      <ul class="nav nav-tabs nav-fill" role="tablist">
        <li class="nav-item" role="presentation">
          <button 
            class="nav-link {activeMedicalTab === 'symptoms' ? 'active' : ''}" 
            on:click={() => handleTabChange('symptoms')}
            role="tab"
          >
            <i class="fas fa-thermometer-half me-1"></i>Symptoms
            <span class="badge bg-warning text-dark ms-1 small">{symptomsCount}</span>
          </button>
        </li>
        <li class="nav-item" role="presentation">
          <button 
            class="nav-link {activeMedicalTab === 'illnesses' ? 'active' : ''}" 
            on:click={() => handleTabChange('illnesses')}
            role="tab"
          >
            <i class="fas fa-heartbeat me-1"></i>Illnesses
            <span class="badge bg-danger ms-1 small">{illnessesCount}</span>
          </button>
        </li>
        <li class="nav-item" role="presentation">
          <button 
            class="nav-link {activeMedicalTab === 'prescriptions' ? 'active' : ''}" 
            on:click={() => handleTabChange('prescriptions')}
            role="tab"
          >
            <i class="fas fa-pills me-1"></i>Prescriptions
            <span class="badge bg-success ms-1 small">{prescriptionsCount}</span>
          </button>
        </li>
      </ul>
      
      <!-- Tab Content -->
      <div class="tab-content p-3">
        <!-- Symptoms Tab -->
        {#if activeMedicalTab === 'symptoms'}
          <div class="tab-pane active">
            {#if symptoms && symptoms.length > 0}
              <div class="mb-2">
                <small class="text-muted">Recent:</small>
                <div class="mt-2">
                  {#each groupByDate(symptoms).slice(0, 2) as group}
                    <div class="mb-2">
                      <small class="text-muted fw-bold small">
                        <i class="fas fa-calendar me-1"></i>{group.date}
                      </small>
                      {#each group.items.slice(0, 3) as symptom}
                        <div class="d-flex justify-content-between align-items-center mb-1 mt-1">
                          <div class="flex-grow-1">
                            <span class="small">
                              {#if symptom.description}
                                {symptom.description.length > 20 ? symptom.description.substring(0, 20) + '...' : symptom.description}
                              {:else}
                                <small class="text-muted">No description</small>
                              {/if}
                            </span>
                          </div>
                          <span class="badge bg-{symptom.severity === 'mild' ? 'success' : symptom.severity === 'moderate' ? 'warning' : symptom.severity === 'severe' ? 'danger' : 'dark'} text-capitalize small">
                            {symptom.severity || 'unknown'}
                          </span>
                        </div>
                      {/each}
                      {#if group.items.length > 3}
                        <small class="text-muted small">+{group.items.length - 3} more on this date</small>
                      {/if}
                    </div>
                  {/each}
                  {#if groupByDate(symptoms).length > 2}
                    <small class="text-muted small">+{groupByDate(symptoms).length - 2} more days</small>
                  {/if}
                </div>
              </div>
              
              <!-- Show Notes Button -->
              {#if hasNotes(symptoms, 'notes')}
                <div class="mt-2">
                  <button 
                    class="btn btn-outline-warning btn-sm small"
                    on:click={toggleSymptomsNotes}
                  >
                    <i class="fas fa-sticky-note me-1"></i>
                    {showSymptomsNotes ? 'Hide Notes' : 'Show Notes'}
                  </button>
                </div>
              {/if}
              
              <!-- Notes Display -->
              {#if showSymptomsNotes && hasNotes(symptoms, 'notes')}
                <div class="mt-2">
                  <small class="text-muted fw-bold">Notes:</small>
                  <div class="mt-1">
                    {#each symptoms.filter(s => s.notes && s.notes.trim()).sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)) as symptom}
                      <div class="mb-1 p-2 bg-warning bg-opacity-10 rounded small">
                        <div class="fw-bold">{symptom.description || 'Symptom'}</div>
                        <div class="text-muted">{symptom.notes}</div>
                        <small class="text-muted">
                          <i class="fas fa-calendar me-1"></i>{symptom.createdAt ? new Date(symptom.createdAt).toLocaleDateString() : 'No date'}
                        </small>
                      </div>
                    {/each}
                  </div>
                </div>
              {/if}
            {:else}
              <p class="text-muted mb-0 small">
                <i class="fas fa-info-circle me-1"></i>No symptoms
              </p>
            {/if}
          </div>
        {/if}

        <!-- Illnesses Tab -->
        {#if activeMedicalTab === 'illnesses'}
          <div class="tab-pane active">
            {#if illnesses && illnesses.length > 0}
              <div class="mb-2">
                <small class="text-muted">Recent:</small>
                <div class="mt-2">
                  {#each groupByDate(illnesses).slice(0, 2) as group}
                    <div class="mb-2">
                      <small class="text-muted fw-bold small">
                        <i class="fas fa-calendar me-1"></i>{group.date}
                      </small>
                      {#each group.items.slice(0, 3) as illness}
                        <div class="d-flex justify-content-between align-items-center mb-1 mt-1">
                          <div class="flex-grow-1">
                            <span class="small fw-bold small">
                              {#if illness.name}
                                {illness.name.length > 20 ? illness.name.substring(0, 20) + '...' : illness.name}
                              {:else}
                                <small class="text-muted">Unknown illness</small>
                              {/if}
                            </span>
                          </div>
                          <span class="badge bg-{illness.status === 'active' ? 'danger' : illness.status === 'chronic' ? 'warning' : illness.status === 'resolved' ? 'success' : 'secondary'} text-capitalize small">
                            {illness.status || 'unknown'}
                          </span>
                        </div>
                      {/each}
                      {#if group.items.length > 3}
                        <small class="text-muted small">+{group.items.length - 3} more on this date</small>
                      {/if}
                    </div>
                  {/each}
                  {#if groupByDate(illnesses).length > 2}
                    <small class="text-muted small">+{groupByDate(illnesses).length - 2} more days</small>
                  {/if}
                </div>
              </div>
              
              <!-- Show Notes Button -->
              {#if hasNotes(illnesses, 'notes')}
                <div class="mt-2">
                  <button 
                    class="btn btn-outline-danger btn-sm small"
                    on:click={toggleIllnessesNotes}
                  >
                    <i class="fas fa-sticky-note me-1"></i>
                    {showIllnessesNotes ? 'Hide Notes' : 'Show Notes'}
                  </button>
                </div>
              {/if}
              
              <!-- Notes Display -->
              {#if showIllnessesNotes && hasNotes(illnesses, 'notes')}
                <div class="mt-2">
                  <small class="text-muted fw-bold">Notes:</small>
                  <div class="mt-1">
                    {#each illnesses.filter(i => i.notes && i.notes.trim()).sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)) as illness}
                      <div class="mb-1 p-2 bg-danger bg-opacity-10 rounded small">
                        <div class="fw-bold">{illness.name || 'Illness'}</div>
                        <div class="text-muted">{illness.notes}</div>
                        <small class="text-muted">
                          <i class="fas fa-calendar me-1"></i>{illness.createdAt ? new Date(illness.createdAt).toLocaleDateString() : 'No date'}
                        </small>
                      </div>
                    {/each}
                  </div>
                </div>
              {/if}
            {:else}
              <p class="text-muted mb-0 small">
                <i class="fas fa-info-circle me-1"></i>No illnesses
              </p>
            {/if}
          </div>
        {/if}

        <!-- Prescriptions Tab -->
        {#if activeMedicalTab === 'prescriptions'}
          <div class="tab-pane active">
            {#if allMedications && allMedications.length > 0}
              <div class="mb-2">
                <small class="text-muted">Medications by drug name (latest first):</small>
                <div class="mt-2">
                  {#each allMedications.slice(0, 10) as drugGroup}
                    <div class="mb-3 p-2 border rounded">
                      <div class="d-flex align-items-center mb-2">
                        <h6 class="mb-0 fw-bold text-primary me-2">
                          {drugGroup.drugName}
                        </h6>
                        <span class="badge bg-secondary small">{drugGroup.doses.length} dose{drugGroup.doses.length !== 1 ? 's' : ''}</span>
                      </div>
                     <div class="ms-3">
                       {#each drugGroup.doses as dose}
                         <div class="d-flex justify-content-between align-items-center mb-1 p-1 border-bottom">
                           <div class="flex-grow-1">
                             <div class="d-flex align-items-center">
                               <span class="badge bg-primary small me-2">{dose.dosage || 'No dosage'}</span>
                               <small class="text-muted me-3">
                                 <i class="fas fa-clock me-1"></i>{dose.duration || 'No duration'}
                               </small>
                               <small class="text-muted">
                                 <i class="fas fa-calendar me-1"></i>
                                 {#if dose.daysAgo !== null}
                                   {dose.daysAgo === 0 ? 'Today' : dose.daysAgo === 1 ? '1 day ago' : `${dose.daysAgo} days ago`}
                                 {:else}
                                   {dose.createdAt ? new Date(dose.createdAt).toLocaleDateString() : 'No date'}
                                 {/if}
                               </small>
                             </div>
                           </div>
                           <button 
                             class="btn btn-outline-success btn-sm"
                             on:click={() => addToPrescription(dose)}
                             title="Add to today's prescription"
                           >
                             <i class="fas fa-plus me-1"></i>
                             Add
                           </button>
                         </div>
                       {/each}
                     </div>
                    </div>
                  {/each}
                  {#if allMedications.length > 10}
                    <small class="text-muted small">+{allMedications.length - 10} more drug groups</small>
                  {/if}
                </div>
              </div>
              
              <!-- Show Notes Button -->
              {#if allMedications.some(drugGroup => drugGroup.doses.some(dose => dose.notes && dose.notes.trim()))}
                <div class="mt-2">
                  <button 
                    class="btn btn-outline-success btn-sm small"
                    on:click={togglePrescriptionsNotes}
                  >
                    <i class="fas fa-sticky-note me-1"></i>
                    {showPrescriptionsNotes ? 'Hide Notes' : 'Show Notes'}
                  </button>
                </div>
              {/if}
              
              <!-- Notes Display -->
              {#if showPrescriptionsNotes && allMedications.some(drugGroup => drugGroup.doses.some(dose => dose.notes && dose.notes.trim()))}
                <div class="mt-2">
                  <small class="text-muted fw-bold">Notes:</small>
                  <div class="mt-1">
                    {#each allMedications.filter(drugGroup => drugGroup.doses.some(dose => dose.notes && dose.notes.trim())) as drugGroup}
                      {#each drugGroup.doses.filter(dose => dose.notes && dose.notes.trim()).sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)) as dose}
                        <div class="mb-1 p-2 bg-success bg-opacity-10 rounded small">
                          <div class="fw-bold fs-5">{drugGroup.drugName}</div>
                          <div class="text-muted">{dose.notes}</div>
                          <small class="text-muted">
                            <i class="fas fa-calendar me-1"></i>{dose.createdAt ? new Date(dose.createdAt).toLocaleDateString() : 'No date'}
                          </small>
                        </div>
                      {/each}
                    {/each}
                  </div>
                </div>
              {/if}
            {:else}
              <p class="text-muted mb-0 small">
                <i class="fas fa-info-circle me-1"></i>No prescriptions
              </p>
            {/if}
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}
