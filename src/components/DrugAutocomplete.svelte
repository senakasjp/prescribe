<script>
  import drugDatabase from '../services/drugDatabase.js'
  import { notifyInfo, notifySuccess } from '../stores/notifications.js'
  
  export let value = ''
  export let placeholder = 'e.g., Metformin, Lisinopril'
  export let doctorId = null
  export let onDrugSelect = null
  export let disabled = false
  
  let searchResults = []
  let showDropdown = false
  let selectedIndex = -1
  let searchTimeout = null
  
  // Search drugs when value changes
  $: if (value && value.length >= 2 && doctorId) {
    console.log('Searching for:', value, 'Doctor ID:', doctorId)
    clearTimeout(searchTimeout)
    searchTimeout = setTimeout(() => {
      searchDrugs()
    }, 300) // Debounce search
  } else {
    searchResults = []
    showDropdown = false
  }
  
  // Search drugs in database
  const searchDrugs = () => {
    if (!doctorId || !value.trim()) {
      console.log('Search cancelled - no doctorId or value:', { doctorId, value })
      searchResults = []
      showDropdown = false
      return
    }
    
    console.log('Searching drugs for doctor:', doctorId, 'query:', value)
    searchResults = drugDatabase.searchDrugs(doctorId, value)
    console.log('Search results:', searchResults)
    showDropdown = searchResults.length > 0
    selectedIndex = -1
  }
  
  // Handle input changes
  function handleInput() {
    // The reactive statement will handle the search
    console.log('Input changed:', value)
  }

  // Handle input focus
  const handleFocus = () => {
    if (value && value.length >= 2) {
      searchDrugs()
    }
  }
  
  // Handle input blur (with delay to allow click on dropdown)
  const handleBlur = () => {
    setTimeout(() => {
      showDropdown = false
      selectedIndex = -1
    }, 200)
  }
  
  // Handle keydown for navigation
  const handleKeydown = (e) => {
    if (!showDropdown) return
    
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        selectedIndex = Math.min(selectedIndex + 1, searchResults.length - 1)
        break
      case 'ArrowUp':
        e.preventDefault()
        selectedIndex = Math.max(selectedIndex - 1, -1)
        break
      case 'Enter':
        e.preventDefault()
        if (selectedIndex >= 0 && selectedIndex < searchResults.length) {
          selectDrug(searchResults[selectedIndex])
        }
        break
      case 'Escape':
        showDropdown = false
        selectedIndex = -1
        break
    }
  }
  
  // Select a drug from dropdown
  const selectDrug = (drug) => {
    value = drug.displayName
    showDropdown = false
    selectedIndex = -1
    
    if (onDrugSelect) {
      onDrugSelect(drug)
    }
  }
  
  // Clear search
  const clearSearch = () => {
    value = ''
    searchResults = []
    showDropdown = false
    selectedIndex = -1
  }
</script>

<div class="position-relative drug-autocomplete-container">
  <div class="input-group input-group-sm">
    <input 
      type="text" 
      class="form-control form-control-sm" 
      bind:value={value}
      {placeholder}
      {disabled}
      on:input={handleInput}
      on:focus={handleFocus}
      on:blur={handleBlur}
      on:keydown={handleKeydown}
    >
    <button 
      class="btn btn-outline-primary btn-sm d-none d-sm-inline-flex" 
      type="button" 
      {disabled}
      on:click={() => {
        console.log('To database clicked for:', value)
        if (value.trim()) {
          // Add the drug to database
          const drugData = {
            name: value.trim(),
            displayName: value.trim(),
            dosage: '',
            instructions: '',
            frequency: '',
            duration: '',
            notes: ''
          }
          
          drugDatabase.addDrug(doctorId, drugData)
          notifySuccess(`"${value.trim()}" added to your drug database`)
          
          // Hide dropdown but keep the input value
          searchResults = []
          showDropdown = false
        } else {
          notifyInfo('Please enter a drug name to add to database')
        }
      }}
      title="Add to database"
    >
      <i class="fas fa-database me-1"></i><span class="d-none d-md-inline">To database</span>
    </button>
    {#if value}
      <button 
        class="btn btn-outline-secondary btn-sm" 
        type="button" 
        {disabled}
        on:click={clearSearch}
        title="Clear search"
      >
        <i class="fas fa-times"></i>
      </button>
    {/if}
  </div>
  
  <!-- Mobile database button (shown on small screens) -->
  {#if value && value.trim()}
    <div class="d-block d-sm-none mt-2">
      <button 
        class="btn btn-outline-primary btn-sm w-100" 
        type="button" 
        {disabled}
        on:click={() => {
          console.log('Mobile database button clicked for:', value)
          if (value.trim()) {
            const drugData = {
              name: value.trim(),
              displayName: value.trim(),
              dosage: '',
              instructions: '',
              frequency: '',
              duration: '',
              notes: ''
            }
            
            drugDatabase.addDrug(doctorId, drugData)
            notifySuccess(`"${value.trim()}" added to your drug database`)
            
            searchResults = []
            showDropdown = false
          } else {
            notifyInfo('Please enter a drug name to add to database')
          }
        }}
      >
        <i class="fas fa-database me-1"></i>Add to Database
      </button>
    </div>
  {/if}
  
  <!-- Dropdown Results -->
  {#if showDropdown && searchResults.length > 0}
    <div class="dropdown-menu show w-100 position-absolute top-100 start-0" style="z-index: 1000;">
      {#each searchResults as drug, index}
        <button 
          class="dropdown-item {selectedIndex === index ? 'active' : ''}" 
          type="button"
          on:click={() => selectDrug(drug)}
          on:mouseenter={() => selectedIndex = index}
        >
          <div class="d-flex justify-content-between align-items-center">
            <div>
              <strong>{drug.displayName}</strong>
              {#if drug.dosage}
                <br><small class="text-muted">Dosage: {drug.dosage}</small>
              {/if}
            </div>
            <small class="text-muted">
              <i class="fas fa-pills"></i>
            </small>
          </div>
        </button>
      {/each}
    </div>
  {/if}
</div>

<style>
  .drug-autocomplete-container {
    width: 100%;
  }
  
  .drug-autocomplete-container .input-group {
    width: 100%;
  }
  
  .dropdown-menu {
    max-height: 200px;
    overflow-y: auto;
    font-size: 0.9rem;
  }
  
  .dropdown-item {
    white-space: normal;
    padding: 0.5rem 1rem;
    font-size: 0.9rem;
    border: none;
    text-align: left;
    width: 100%;
  }
  
  .dropdown-item:hover,
  .dropdown-item.active {
    background-color: var(--bs-primary);
    color: white;
  }
  
  .dropdown-item strong {
    font-weight: 600;
    font-size: 0.9rem;
  }
  
  .dropdown-item small {
    font-size: 0.8rem;
  }
  
  /* Mobile responsive adjustments */
  @media (max-width: 576px) {
    .dropdown-menu {
      font-size: 0.85rem;
      max-height: 150px;
    }
    
    .dropdown-item {
      padding: 0.4rem 0.8rem;
      font-size: 0.85rem;
    }
    
    .dropdown-item strong {
      font-size: 0.85rem;
    }
    
    .dropdown-item small {
      font-size: 0.75rem;
    }
    
    .drug-autocomplete-container .btn {
      font-size: 0.8rem;
      padding: 0.4rem 0.6rem;
    }
  }
  
  /* Tablet adjustments */
  @media (min-width: 577px) and (max-width: 768px) {
    .dropdown-menu {
      font-size: 0.88rem;
    }
    
    .dropdown-item {
      font-size: 0.88rem;
    }
    
    .dropdown-item strong {
      font-size: 0.88rem;
    }
  }
</style>
