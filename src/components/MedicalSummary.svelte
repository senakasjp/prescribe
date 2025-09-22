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
  <div class="bg-white border-2 border-blue-200 rounded-lg shadow-sm mt-3">
    <div class="bg-gray-50 px-4 py-3 border-b border-gray-200">
      <div class="flex justify-between items-center">
        <h6 class="text-lg font-semibold text-gray-900 mb-0">
          <i class="fas fa-chart-pie mr-2 text-blue-600"></i>Medical Summary
        </h6>
        <button 
          class="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 rounded-lg transition-colors duration-200" 
          on:click={() => selectedPatient = null}
          title="Back to patient list"
        >
          <i class="fas fa-arrow-left mr-1"></i>Back
        </button>
      </div>
    </div>
    <div class="p-0">
      <!-- Medical Summary Tabs -->
      <div class="flex border-b border-gray-200" role="tablist">
        <button 
          class="flex-1 flex items-center justify-center px-4 py-3 text-sm font-medium border-b-2 transition-colors duration-200 {activeMedicalTab === 'symptoms' ? 'border-yellow-500 text-yellow-600 bg-yellow-50' : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'}" 
          on:click={() => handleTabChange('symptoms')}
          role="tab"
        >
          <i class="fas fa-thermometer-half mr-1"></i>Symptoms
          <span class="ml-1 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">{symptomsCount}</span>
        </button>
        <button 
          class="flex-1 flex items-center justify-center px-4 py-3 text-sm font-medium border-b-2 transition-colors duration-200 {activeMedicalTab === 'illnesses' ? 'border-red-500 text-red-600 bg-red-50' : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'}" 
          on:click={() => handleTabChange('illnesses')}
          role="tab"
        >
          <i class="fas fa-heartbeat mr-1"></i>Illnesses
          <span class="ml-1 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">{illnessesCount}</span>
        </button>
        <button 
          class="flex-1 flex items-center justify-center px-4 py-3 text-sm font-medium border-b-2 transition-colors duration-200 {activeMedicalTab === 'prescriptions' ? 'border-teal-500 text-teal-600 bg-teal-50' : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'}" 
          on:click={() => handleTabChange('prescriptions')}
          role="tab"
        >
          <i class="fas fa-pills mr-1"></i>Prescriptions
          <span class="ml-1 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-teal-100 text-teal-800">{prescriptionsCount}</span>
        </button>
      </div>
      
      <!-- Tab Content -->
      <div class="p-4">
        <!-- Symptoms Tab -->
        {#if activeMedicalTab === 'symptoms'}
          <div>
            {#if symptoms && symptoms.length > 0}
              <div class="mb-3">
                <small class="text-gray-500 text-sm">Recent:</small>
                <div class="mt-2">
                  {#each groupByDate(symptoms).slice(0, 2) as group}
                    <div class="mb-3">
                      <small class="text-gray-600 font-semibold text-sm">
                        <i class="fas fa-calendar mr-1"></i>{group.date}
                      </small>
                      {#each group.items.slice(0, 3) as symptom}
                        <div class="flex justify-between items-center mb-2 mt-2">
                          <div class="flex-1">
                            <span class="text-sm text-gray-900">
                              {#if symptom.description}
                                {symptom.description.length > 20 ? symptom.description.substring(0, 20) + '...' : symptom.description}
                              {:else}
                                <span class="text-gray-500">No description</span>
                              {/if}
                            </span>
                          </div>
                          <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium {symptom.severity === 'mild' ? 'bg-teal-100 text-teal-800' : symptom.severity === 'moderate' ? 'bg-yellow-100 text-yellow-800' : symptom.severity === 'severe' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'}">
                            {symptom.severity || 'unknown'}
                          </span>
                        </div>
                      {/each}
                      {#if group.items.length > 3}
                        <small class="text-gray-500 text-sm">+{group.items.length - 3} more on this date</small>
                      {/if}
                    </div>
                  {/each}
                  {#if groupByDate(symptoms).length > 2}
                    <small class="text-gray-500 text-sm">+{groupByDate(symptoms).length - 2} more days</small>
                  {/if}
                </div>
              </div>
              
              <!-- Show Notes Button -->
              {#if hasNotes(symptoms, 'notes')}
                <div class="mt-3">
                  <button 
                    class="inline-flex items-center px-3 py-2 border border-yellow-300 text-sm font-medium text-yellow-700 bg-white hover:bg-yellow-50 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 rounded-lg transition-colors duration-200"
                    on:click={toggleSymptomsNotes}
                  >
                    <i class="fas fa-sticky-note mr-1"></i>
                    {showSymptomsNotes ? 'Hide Notes' : 'Show Notes'}
                  </button>
                </div>
              {/if}
              
              <!-- Notes Display -->
              {#if showSymptomsNotes && hasNotes(symptoms, 'notes')}
                <div class="mt-3">
                  <small class="text-gray-600 font-semibold text-sm">Notes:</small>
                  <div class="mt-2">
                    {#each symptoms.filter(s => s.notes && s.notes.trim()).sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)) as symptom}
                      <div class="mb-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <div class="font-semibold text-gray-900 text-sm">{symptom.description || 'Symptom'}</div>
                        <div class="text-gray-600 text-sm mt-1">{symptom.notes}</div>
                        <small class="text-gray-500 text-xs mt-1 block">
                          <i class="fas fa-calendar mr-1"></i>{symptom.createdAt ? new Date(symptom.createdAt).toLocaleDateString() : 'No date'}
                        </small>
                      </div>
                    {/each}
                  </div>
                </div>
              {/if}
            {:else}
              <p class="text-gray-500 mb-0 text-sm">
                <i class="fas fa-info-circle mr-1"></i>No symptoms
              </p>
            {/if}
          </div>
        {/if}

        <!-- Illnesses Tab -->
        {#if activeMedicalTab === 'illnesses'}
          <div>
            {#if illnesses && illnesses.length > 0}
              <div class="mb-3">
                <small class="text-gray-500 text-sm">Recent:</small>
                <div class="mt-2">
                  {#each groupByDate(illnesses).slice(0, 2) as group}
                    <div class="mb-3">
                      <small class="text-gray-600 font-semibold text-sm">
                        <i class="fas fa-calendar mr-1"></i>{group.date}
                      </small>
                      {#each group.items.slice(0, 3) as illness}
                        <div class="flex justify-between items-center mb-2 mt-2">
                          <div class="flex-1">
                            <span class="text-sm font-semibold text-gray-900">
                              {#if illness.name}
                                {illness.name.length > 20 ? illness.name.substring(0, 20) + '...' : illness.name}
                              {:else}
                                <span class="text-gray-500">Unknown illness</span>
                              {/if}
                            </span>
                          </div>
                          <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium {illness.status === 'active' ? 'bg-red-100 text-red-800' : illness.status === 'chronic' ? 'bg-yellow-100 text-yellow-800' : illness.status === 'resolved' ? 'bg-teal-100 text-teal-800' : 'bg-gray-100 text-gray-800'}">
                            {illness.status || 'unknown'}
                          </span>
                        </div>
                      {/each}
                      {#if group.items.length > 3}
                        <small class="text-gray-500 text-sm">+{group.items.length - 3} more on this date</small>
                      {/if}
                    </div>
                  {/each}
                  {#if groupByDate(illnesses).length > 2}
                    <small class="text-gray-500 text-sm">+{groupByDate(illnesses).length - 2} more days</small>
                  {/if}
                </div>
              </div>
              
              <!-- Show Notes Button -->
              {#if hasNotes(illnesses, 'notes')}
                <div class="mt-3">
                  <button 
                    class="inline-flex items-center px-3 py-2 border border-red-300 text-sm font-medium text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 rounded-lg transition-colors duration-200"
                    on:click={toggleIllnessesNotes}
                  >
                    <i class="fas fa-sticky-note mr-1"></i>
                    {showIllnessesNotes ? 'Hide Notes' : 'Show Notes'}
                  </button>
                </div>
              {/if}
              
              <!-- Notes Display -->
              {#if showIllnessesNotes && hasNotes(illnesses, 'notes')}
                <div class="mt-3">
                  <small class="text-gray-600 font-semibold text-sm">Notes:</small>
                  <div class="mt-2">
                    {#each illnesses.filter(i => i.notes && i.notes.trim()).sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)) as illness}
                      <div class="mb-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                        <div class="font-semibold text-gray-900 text-sm">{illness.name || 'Illness'}</div>
                        <div class="text-gray-600 text-sm mt-1">{illness.notes}</div>
                        <small class="text-gray-500 text-xs mt-1 block">
                          <i class="fas fa-calendar mr-1"></i>{illness.createdAt ? new Date(illness.createdAt).toLocaleDateString() : 'No date'}
                        </small>
                      </div>
                    {/each}
                  </div>
                </div>
              {/if}
            {:else}
              <p class="text-gray-500 mb-0 text-sm">
                <i class="fas fa-info-circle mr-1"></i>No illnesses
              </p>
            {/if}
          </div>
        {/if}

        <!-- Prescriptions Tab -->
        {#if activeMedicalTab === 'prescriptions'}
          <div>
            {#if allMedications && allMedications.length > 0}
              <div class="mb-3">
                <small class="text-gray-500 text-sm">Medications by drug name (latest first):</small>
                <div class="mt-2">
                  {#each allMedications.slice(0, 10) as drugGroup}
                    <div class="mb-4 p-3 border border-gray-200 rounded-lg bg-gray-50">
                      <div class="flex items-center mb-3">
                        <h6 class="text-lg font-semibold text-blue-600 mr-2 mb-0">
                          {drugGroup.drugName}
                        </h6>
                        <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">{drugGroup.doses.length} dose{drugGroup.doses.length !== 1 ? 's' : ''}</span>
                      </div>
                     <div class="ml-3">
                       {#each drugGroup.doses as dose}
                         <div class="flex justify-between items-center mb-2 p-2 border-b border-gray-200 last:border-b-0">
                           <div class="flex-1">
                             <div class="flex items-center flex-wrap gap-2">
                               <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">{dose.dosage || 'No dosage'}</span>
                               <small class="text-gray-500 text-xs">
                                 <i class="fas fa-clock mr-1"></i>{dose.duration || 'No duration'}
                               </small>
                               <small class="text-gray-500 text-xs">
                                 <i class="fas fa-calendar mr-1"></i>
                                 {#if dose.daysAgo !== null}
                                   {dose.daysAgo === 0 ? 'Today' : dose.daysAgo === 1 ? '1 day ago' : `${dose.daysAgo} days ago`}
                                 {:else}
                                   {dose.createdAt ? new Date(dose.createdAt).toLocaleDateString() : 'No date'}
                                 {/if}
                               </small>
                             </div>
                           </div>
                           <button 
                             class="inline-flex items-center px-3 py-1 border border-teal-300 text-xs font-medium text-teal-700 bg-white hover:bg-teal-50 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 rounded-lg transition-colors duration-200"
                             on:click={() => addToPrescription(dose)}
                             title="Add to today's prescription"
                           >
                             <i class="fas fa-plus mr-1"></i>
                             Add
                           </button>
                         </div>
                       {/each}
                     </div>
                    </div>
                  {/each}
                  {#if allMedications.length > 10}
                    <small class="text-gray-500 text-sm">+{allMedications.length - 10} more drug groups</small>
                  {/if}
                </div>
              </div>
              
              <!-- Show Notes Button -->
              {#if allMedications.some(drugGroup => drugGroup.doses.some(dose => dose.notes && dose.notes.trim()))}
                <div class="mt-3">
                  <button 
                    class="inline-flex items-center px-3 py-2 border border-teal-300 text-sm font-medium text-teal-700 bg-white hover:bg-teal-50 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 rounded-lg transition-colors duration-200"
                    on:click={togglePrescriptionsNotes}
                  >
                    <i class="fas fa-sticky-note mr-1"></i>
                    {showPrescriptionsNotes ? 'Hide Notes' : 'Show Notes'}
                  </button>
                </div>
              {/if}
              
              <!-- Notes Display -->
              {#if showPrescriptionsNotes && allMedications.some(drugGroup => drugGroup.doses.some(dose => dose.notes && dose.notes.trim()))}
                <div class="mt-3">
                  <small class="text-gray-600 font-semibold text-sm">Notes:</small>
                  <div class="mt-2">
                    {#each allMedications.filter(drugGroup => drugGroup.doses.some(dose => dose.notes && dose.notes.trim())) as drugGroup}
                      {#each drugGroup.doses.filter(dose => dose.notes && dose.notes.trim()).sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)) as dose}
                        <div class="mb-2 p-3 bg-teal-50 border border-teal-200 rounded-lg">
                          <div class="font-semibold text-gray-900 text-sm">{drugGroup.drugName}</div>
                          <div class="text-gray-600 text-sm mt-1">{dose.notes}</div>
                          <small class="text-gray-500 text-xs mt-1 block">
                            <i class="fas fa-calendar mr-1"></i>{dose.createdAt ? new Date(dose.createdAt).toLocaleDateString() : 'No date'}
                          </small>
                        </div>
                      {/each}
                    {/each}
                  </div>
                </div>
              {/if}
            {:else}
              <p class="text-gray-500 mb-0 text-sm">
                <i class="fas fa-info-circle mr-1"></i>No prescriptions
              </p>
            {/if}
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}
