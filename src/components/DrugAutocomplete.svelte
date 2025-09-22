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

<div class="relative">
  <div class="flex">
    <input 
      type="text" 
      class="flex-1 px-3 py-2 border border-gray-300 rounded-l-lg text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed" 
      bind:value={value}
      {placeholder}
      {disabled}
      on:input={handleInput}
      on:focus={handleFocus}
      on:blur={handleBlur}
      on:keydown={handleKeydown}
    >
    <button 
      class="hidden sm:inline-flex items-center px-3 py-2 border border-gray-300 border-l-0 text-sm font-medium text-blue-600 bg-white hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed" 
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
      <i class="fas fa-database mr-1"></i><span class="hidden md:inline">To database</span>
    </button>
    {#if value}
      <button 
        class="inline-flex items-center px-3 py-2 border border-gray-300 border-l-0 text-sm font-medium text-gray-600 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed" 
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
    <div class="block sm:hidden mt-2">
      <button 
        class="w-full inline-flex items-center justify-center px-3 py-2 border border-blue-300 text-sm font-medium text-blue-600 bg-white hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed rounded-lg" 
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
        <i class="fas fa-database mr-1"></i>Add to Database
      </button>
    </div>
  {/if}
  
  <!-- Dropdown Results -->
  {#if showDropdown && searchResults.length > 0}
    <div class="absolute top-full left-0 w-full bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-60 overflow-y-auto">
      {#each searchResults as drug, index}
        <button 
          class="w-full px-4 py-3 text-left hover:bg-blue-50 focus:bg-blue-50 focus:outline-none border-b border-gray-100 last:border-b-0 {selectedIndex === index ? 'bg-blue-50' : ''}" 
          type="button"
          on:click={() => selectDrug(drug)}
          on:mouseenter={() => selectedIndex = index}
        >
          <div class="flex justify-between items-center">
            <div>
              <div class="font-semibold text-gray-900">{drug.displayName}</div>
              {#if drug.dosage}
                <div class="text-sm text-gray-500 mt-1">Dosage: {drug.dosage}</div>
              {/if}
            </div>
            <div class="text-gray-400">
              <i class="fas fa-pills"></i>
            </div>
          </div>
        </button>
      {/each}
    </div>
  {/if}
</div>

<style>
  /* Minimal custom styles for DrugAutocomplete component */
  .relative {
    position: relative;
  }
  
  /* Ensure dropdown appears above other elements */
  .absolute {
    position: absolute;
  }
  
  /* Custom scrollbar for dropdown */
  .overflow-y-auto::-webkit-scrollbar {
    width: 6px;
  }
  
  .overflow-y-auto::-webkit-scrollbar-track {
    background: #f1f1f1;
    border-radius: 3px;
  }
  
  .overflow-y-auto::-webkit-scrollbar-thumb {
    background: #c1c1c1;
    border-radius: 3px;
  }
  
  .overflow-y-auto::-webkit-scrollbar-thumb:hover {
    background: #a8a8a8;
  }
</style>
