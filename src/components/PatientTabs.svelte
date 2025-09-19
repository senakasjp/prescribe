<script>
  export let activeTab = 'overview'
  export let onTabChange
  export let enabledTabs = ['overview'] // Default: only overview enabled
  
  // Debug: Log when props change
  $: console.log('🔍 PatientTabs props:', { activeTab, enabledTabs })
  
  // Define tab order for progressive workflow
  const tabOrder = ['overview', 'symptoms', 'reports', 'diagnoses', 'prescriptions']
  
  // Check if a tab is enabled
  function isTabEnabled(tab) {
    const result = enabledTabs.includes(tab)
    console.log(`🔍 Tab ${tab} enabled:`, result, 'enabledTabs:', enabledTabs)
    return result
  }
  
  // Simple function to get button classes
  function getButtonClasses(tab) {
    const isEnabled = isTabEnabled(tab)
    const isActive = activeTab === tab
    
    console.log(`🎨 Button classes for ${tab}: enabled=${isEnabled}, active=${isActive}`)
    console.log(`🎨 Comparison: activeTab="${activeTab}" === tab="${tab}" = ${activeTab === tab}`)
    
    if (!isEnabled) {
      return 'btn btn-outline-secondary btn-sm disabled'
    }
    if (isActive) {
      console.log(`🎨 Returning ACTIVE classes for ${tab}: btn btn-danger btn-sm`)
      return 'btn btn-danger btn-sm'
    }
    console.log(`🎨 Returning ENABLED classes for ${tab}: btn btn-outline-danger btn-sm`)
    return 'btn btn-outline-danger btn-sm'
  }
  
  // Declare button class variables
  let overviewClasses, symptomsClasses, reportsClasses, diagnosesClasses, prescriptionsClasses
  
  // Force reactivity by creating a reactive block that explicitly depends on props
  $: {
    console.log('🔄 Reactive block triggered - recalculating all button classes')
    console.log('🔄 Current activeTab:', activeTab, 'enabledTabs:', enabledTabs)
    overviewClasses = getButtonClasses('overview')
    symptomsClasses = getButtonClasses('symptoms')
    reportsClasses = getButtonClasses('reports')
    diagnosesClasses = getButtonClasses('diagnoses')
    prescriptionsClasses = getButtonClasses('prescriptions')
  }
</script>

<div class="d-flex flex-wrap gap-2 mb-3 p-3 border border-dark rounded shadow-sm">
  <button 
    class={overviewClasses}
    on:click={() => isTabEnabled('overview') && onTabChange('overview')}
    role="tab"
    disabled={!isTabEnabled('overview')}
    title={isTabEnabled('overview') ? 'View patient overview' : 'Complete previous steps to unlock'}
    style="background-color: {activeTab === 'overview' ? '#dc3545' : 'transparent'} !important; color: {activeTab === 'overview' ? 'white' : 'inherit'} !important;"
  >
    <i class="fas fa-user me-2"></i>Overview
  </button>
  <button 
    class={symptomsClasses}
    on:click={() => isTabEnabled('symptoms') && onTabChange('symptoms')}
    role="tab"
    disabled={!isTabEnabled('symptoms')}
    title={isTabEnabled('symptoms') ? 'Document patient symptoms' : 'Complete previous steps to unlock'}
    style="background-color: {activeTab === 'symptoms' ? '#dc3545' : 'transparent'} !important; color: {activeTab === 'symptoms' ? 'white' : 'inherit'} !important;"
  >
    <i class="fas fa-thermometer-half me-2"></i>Symptoms
  </button>
  <button 
    class={reportsClasses}
    on:click={() => isTabEnabled('reports') && onTabChange('reports')}
    role="tab"
    disabled={!isTabEnabled('reports')}
    title={isTabEnabled('reports') ? 'View medical reports' : 'Complete previous steps to unlock'}
  >
    <i class="fas fa-file-medical me-2"></i>Reports
  </button>
  <button 
    class={diagnosesClasses}
    on:click={() => isTabEnabled('diagnoses') && onTabChange('diagnoses')}
    role="tab"
    disabled={!isTabEnabled('diagnoses')}
    title={isTabEnabled('diagnoses') ? 'View diagnoses' : 'Complete previous steps to unlock'}
  >
    <i class="fas fa-stethoscope me-2"></i>Diagnoses
  </button>
  <button 
    class={prescriptionsClasses}
    on:click={() => isTabEnabled('prescriptions') && onTabChange('prescriptions')}
    role="tab"
    disabled={!isTabEnabled('prescriptions')}
    title={isTabEnabled('prescriptions') ? 'Manage prescriptions' : 'Complete previous steps to unlock'}
  >
    <i class="fas fa-pills me-2"></i>Prescriptions
  </button>
</div>
