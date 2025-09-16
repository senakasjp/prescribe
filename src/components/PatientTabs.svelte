<script>
  export let activeTab = 'overview'
  export let onTabChange
</script>

<div class="d-flex flex-wrap gap-2 mb-3 p-3 border border-dark rounded shadow-sm">
  <button 
    class="btn {activeTab === 'overview' ? 'btn-primary border-0' : 'btn-outline-primary'} btn-sm"
    on:click={() => onTabChange('overview')}
    role="tab"
  >
    <i class="fas fa-user me-2"></i>Overview
  </button>
  <button 
    class="btn {activeTab === 'prescriptions' ? 'btn-success border-0' : 'btn-outline-success'} btn-sm"
    on:click={() => onTabChange('prescriptions')}
    role="tab"
  >
    <i class="fas fa-pills me-2"></i>Prescriptions
  </button>
  <button 
    class="btn {activeTab === 'symptoms' ? 'btn-warning border-0' : 'btn-outline-warning'} btn-sm"
    on:click={() => onTabChange('symptoms')}
    role="tab"
  >
    <i class="fas fa-thermometer-half me-2"></i>Symptoms
  </button>
  <button 
    class="btn {activeTab === 'illnesses' ? 'btn-danger border-0' : 'btn-outline-danger'} btn-sm"
    on:click={() => onTabChange('illnesses')}
    role="tab"
  >
    <i class="fas fa-heartbeat me-2"></i>Illnesses
  </button>
  <button 
    class="btn {activeTab === 'history' ? 'btn-info border-0' : 'btn-outline-info'} btn-sm"
    on:click={() => onTabChange('history')}
    role="tab"
  >
    <i class="fas fa-history me-2"></i>History
  </button>
</div>
