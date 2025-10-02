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
  
  // Flowbite button classes
  function getButtonClasses(tab) {
    const isEnabled = isTabEnabled(tab)
    const isActive = activeTab === tab
    
    console.log(`🎨 Button classes for ${tab}: enabled=${isEnabled}, active=${isActive}`)
    console.log(`🎨 Comparison: activeTab="${activeTab}" === tab="${tab}" = ${activeTab === tab}`)
    
    // Base Flowbite button classes
    const baseClasses = 'px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-offset-2'
    
    if (!isEnabled) {
      return `${baseClasses} text-gray-400 bg-gray-100 border border-gray-200 cursor-not-allowed opacity-50`
    }
    if (isActive) {
      console.log(`🎨 Returning ACTIVE classes for ${tab}: Flowbite red primary`)
      return `${baseClasses} text-white bg-red-600 hover:bg-red-700 focus:ring-red-300 dark:bg-red-600 dark:hover:bg-red-700 dark:focus:ring-red-800`
    }
    console.log(`🎨 Returning ENABLED classes for ${tab}: Flowbite red outline`)
    return `${baseClasses} text-red-600 bg-white border border-red-600 hover:bg-red-50 focus:ring-red-300 dark:bg-gray-800 dark:text-red-500 dark:border-red-500 dark:hover:bg-gray-700 dark:hover:bg-red-600/10`
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

<div class="flex flex-wrap gap-2 mb-4 p-4 border border-gray-300 rounded-lg shadow-sm bg-white">
  <button 
    class={overviewClasses}
    on:click={() => isTabEnabled('overview') && onTabChange('overview')}
    role="tab"
    disabled={!isTabEnabled('overview')}
    title={isTabEnabled('overview') ? 'View patient overview' : 'Complete previous steps to unlock'}
  >
    <i class="fas fa-user mr-2"></i>Overview
  </button>
  <button 
    class={symptomsClasses}
    on:click={() => isTabEnabled('symptoms') && onTabChange('symptoms')}
    role="tab"
    disabled={!isTabEnabled('symptoms')}
    title={isTabEnabled('symptoms') ? 'Document patient symptoms' : 'Complete previous steps to unlock'}
  >
    <i class="fas fa-thermometer-half mr-2"></i>Symptoms
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
