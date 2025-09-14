<script>
  export let activeTab = 'overview'
  export let onTabChange
</script>

<ul class="nav nav-tabs" role="tablist">
  <li class="nav-item" role="presentation">
    <button 
      class="nav-link {activeTab === 'overview' ? 'active' : ''}" 
      on:click={() => onTabChange('overview')}
      role="tab"
    >
      <i class="fas fa-user me-2"></i>Overview
    </button>
  </li>
  <li class="nav-item" role="presentation">
    <button 
      class="nav-link {activeTab === 'prescriptions' ? 'active' : ''}" 
      on:click={() => onTabChange('prescriptions')}
      role="tab"
    >
      <i class="fas fa-pills me-2"></i>Prescriptions
    </button>
  </li>
  <li class="nav-item" role="presentation">
    <button 
      class="nav-link {activeTab === 'symptoms' ? 'active' : ''}" 
      on:click={() => onTabChange('symptoms')}
      role="tab"
    >
      <i class="fas fa-thermometer-half me-2"></i>Symptoms
    </button>
  </li>
  <li class="nav-item" role="presentation">
    <button 
      class="nav-link {activeTab === 'illnesses' ? 'active' : ''}" 
      on:click={() => onTabChange('illnesses')}
      role="tab"
    >
      <i class="fas fa-heartbeat me-2"></i>Illnesses
    </button>
  </li>
  <li class="nav-item" role="presentation">
    <button 
      class="nav-link {activeTab === 'history' ? 'active' : ''}" 
      on:click={() => onTabChange('history')}
      role="tab"
    >
      <i class="fas fa-history me-2"></i>History
    </button>
  </li>
</ul>
