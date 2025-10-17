<script>
  import drugDatabase from '../services/drugDatabase.js'
  import { pharmacyMedicationService } from '../services/pharmacyMedicationService.js'
  import { pharmacyInventoryIntegration } from '../services/pharmacyInventoryIntegration.js'
  import { notifyInfo, notifySuccess, notifyError } from '../stores/notifications.js'
  
  export let value = ''
  export let placeholder = 'e.g., Metformin, Lisinopril'
  export let doctorId = null
  export let onDrugSelect = null
  export let disabled = false
  
  // Brand and generic name inputs
  let brandName = ''
  let genericName = ''
  
  let searchResults = []
  let showDropdown = false
  let selectedIndex = -1
  let searchTimeout = null
  let matchTimeout = null

  // Helper function to create display name
  const createDisplayName = (brandName, genericName) => {
    if (brandName && genericName) {
      return `${brandName} (${genericName})`
    } else if (brandName) {
      return brandName
    } else if (genericName) {
      return genericName
    }
    return 'Unknown Drug'
  }
  
  // Search drugs when brandName or genericName changes
  $: if ((brandName && brandName.length >= 2) || (genericName && genericName.length >= 2)) {
    if (doctorId) {
      console.log('Searching for:', { brandName, genericName }, 'Doctor ID:', doctorId)
      clearTimeout(searchTimeout)
      searchTimeout = setTimeout(async () => {
        await searchDrugs()
      }, 300) // Debounce search
    }
  } else {
    searchResults = []
    showDropdown = false
  }
  
  // Search drugs in database and pharmacy inventories with enhanced autofill
  const searchDrugs = async () => {
    const searchTerm = brandName.trim() || genericName.trim()
    if (!doctorId || !searchTerm) {
      console.log('Search cancelled - no doctorId or search term:', { doctorId, brandName, genericName })
      searchResults = []
      showDropdown = false
      return
    }
    
    console.log('Searching drugs for doctor:', doctorId, 'brandName:', brandName, 'genericName:', genericName)
    
    try {
      // Search in doctor's local database
      const localDrugs = drugDatabase.searchDrugs(doctorId, searchTerm)
      
      // Search in connected pharmacy inventories with expanded results for autofill
      const pharmacyDrugs = await pharmacyMedicationService.searchMedicationsFromPharmacies(doctorId, searchTerm, 20) // Increased limit for better autofill
      
      // Process local drugs with enhanced display names
      const processedLocalDrugs = localDrugs.map(drug => ({
        ...drug,
        source: 'local',
        displayName: drug.displayName || createDisplayName(drug.brandName, drug.genericName),
        strength: drug.strength || '',
        dosageForm: drug.dosageForm || ''
      }))
      
      // Process pharmacy drugs with enhanced information
      const processedPharmacyDrugs = pharmacyDrugs.map(drug => ({
        ...drug,
        source: 'pharmacy',
        displayName: createDisplayName(drug.brandName, drug.genericName),
        // Ensure all required fields are present
        brandName: drug.brandName || '',
        genericName: drug.genericName || '',
        strength: drug.strength || '',
        dosageForm: drug.dosageForm || 'Tablet',
        currentStock: drug.currentStock || 0,
        packUnit: drug.packUnit || '',
        expiryDate: drug.expiryDate || ''
      }))
      
      // Combine results (local drugs first, then pharmacy drugs)
      const combinedResults = [
        ...processedLocalDrugs,
        ...processedPharmacyDrugs.filter(pharmacyDrug => 
          // Avoid duplicates - check if pharmacy drug already exists in local results
          !processedLocalDrugs.find(localDrug => 
            localDrug.brandName?.toLowerCase() === pharmacyDrug.brandName?.toLowerCase() &&
            localDrug.genericName?.toLowerCase() === pharmacyDrug.genericName?.toLowerCase()
          )
        )
      ]
      
      // Sort results by relevance (exact matches first, then partial matches)
      combinedResults.sort((a, b) => {
        const aExact = (a.brandName?.toLowerCase() === searchTerm.toLowerCase()) || 
                      (a.genericName?.toLowerCase() === searchTerm.toLowerCase())
        const bExact = (b.brandName?.toLowerCase() === searchTerm.toLowerCase()) || 
                      (b.genericName?.toLowerCase() === searchTerm.toLowerCase())
        
        if (aExact && !bExact) return -1
        if (!aExact && bExact) return 1
        
        // Then by source (local first)
        if (a.source === 'local' && b.source === 'pharmacy') return -1
        if (a.source === 'pharmacy' && b.source === 'local') return 1
        
        return a.displayName.localeCompare(b.displayName)
      })
      
      searchResults = combinedResults
      console.log('Enhanced autofill search results:', { 
        local: processedLocalDrugs.length, 
        pharmacy: processedPharmacyDrugs.length, 
        combined: combinedResults.length 
      })
      showDropdown = searchResults.length > 0
      selectedIndex = -1
      
    } catch (error) {
      console.error('Error searching drugs:', error)
      // Fallback to local search only
      searchResults = drugDatabase.searchDrugs(doctorId, searchTerm).map(drug => ({
        ...drug,
        source: 'local',
        displayName: drug.displayName || createDisplayName(drug.brandName, drug.genericName)
      }))
      showDropdown = searchResults.length > 0
      selectedIndex = -1
    }
  }
  
  // Check for exact match and populate the other field (debounced)
  const checkAndPopulateOtherField = (inputField, inputValue) => {
    clearTimeout(matchTimeout)
    matchTimeout = setTimeout(() => {
      if (!doctorId || !inputValue.trim()) return
      
      const allDrugs = drugDatabase.getDoctorDrugs(doctorId)
      const exactMatch = allDrugs.find(drug => {
        if (inputField === 'brand' && drug.brandName) {
          return drug.brandName.toLowerCase() === inputValue.toLowerCase().trim()
        } else if (inputField === 'generic' && drug.genericName) {
          return drug.genericName.toLowerCase() === inputValue.toLowerCase().trim()
        }
        return false
      })
      
      if (exactMatch) {
        if (inputField === 'brand' && exactMatch.genericName && genericName !== exactMatch.genericName) {
          genericName = exactMatch.genericName
          console.log('Found matching generic name:', exactMatch.genericName)
        } else if (inputField === 'generic' && exactMatch.brandName && brandName !== exactMatch.brandName) {
          brandName = exactMatch.brandName
          console.log('Found matching brand name:', exactMatch.brandName)
        }
      }
    }, 500) // Debounce for 500ms
  }

  // Handle input focus
  const handleFocus = async () => {
    const searchTerm = brandName.trim() || genericName.trim()
    if (searchTerm && searchTerm.length >= 2) {
      await searchDrugs()
    }
  }

  // Handle keyboard navigation
  const handleKeydown = (event) => {
    if (!showDropdown || searchResults.length === 0) return

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault()
        selectedIndex = Math.min(selectedIndex + 1, searchResults.length - 1)
        break
      case 'ArrowUp':
        event.preventDefault()
        selectedIndex = Math.max(selectedIndex - 1, -1)
        break
      case 'Enter':
        event.preventDefault()
        if (selectedIndex >= 0 && selectedIndex < searchResults.length) {
          selectDrug(searchResults[selectedIndex])
        }
        break
      case 'Escape':
        event.preventDefault()
        showDropdown = false
        selectedIndex = -1
        break
    }
  }
  
  // Handle input blur (with delay to allow click on dropdown)
  const handleBlur = () => {
    setTimeout(() => {
      showDropdown = false
      selectedIndex = -1
    }, 200)
  }
  
  // Select a drug from dropdown
  const selectDrug = (drug) => {
    // Populate brand and generic name fields
    brandName = drug.brandName || ''
    genericName = drug.genericName || drug.name || ''
    value = drug.displayName
    showDropdown = false
    selectedIndex = -1
    
    if (onDrugSelect) {
      onDrugSelect(drug)
    }
  }
  
  // Clear search
  const clearSearch = () => {
    brandName = ''
    genericName = ''
    value = ''
    searchResults = []
    showDropdown = false
    selectedIndex = -1
    clearTimeout(searchTimeout)
    clearTimeout(matchTimeout)
  }
</script>

            <div class="relative">
              <!-- Brand and Generic Name Input Fields - Side by Side -->
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <!-- Brand Name Input -->
                <div>
                  <label for="brandNameInput" class="block text-sm font-medium text-gray-700 mb-1">
                    Brand Name <span class="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="brandNameInput"
                    class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                    bind:value={brandName}
                    placeholder="e.g., Glucophage, Prinivil"
                    required
                    {disabled}
                    on:input={() => {
                      // Check for exact match and populate generic name
                      checkAndPopulateOtherField('brand', brandName)
                      
                      // Update the main value for search
                      if (brandName.trim() && genericName.trim()) {
                        value = `${brandName.trim()} (${genericName.trim()})`
                      } else if (genericName.trim()) {
                        value = genericName.trim()
                      } else {
                        value = brandName.trim()
                      }
                    }}
                    on:focus={handleFocus}
                    on:blur={handleBlur}
                    on:keydown={handleKeydown}
                  >
                </div>

                <!-- Generic Name Input -->
                <div>
                  <label for="genericNameInput" class="block text-sm font-medium text-gray-700 mb-1">
                    Generic Name <span class="text-red-500">*</span>
                  </label>
                  <div class="flex">
                    <input
                      type="text"
                      id="genericNameInput"
                      class="flex-1 px-3 py-2 border border-gray-300 rounded-l-lg text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                      bind:value={genericName}
                      placeholder="e.g., Metformin, Lisinopril"
                      {disabled}
                      on:input={() => {
                        // Check for exact match and populate brand name
                        checkAndPopulateOtherField('generic', genericName)
                        
                        // Update the main value for search
                        if (brandName.trim() && genericName.trim()) {
                          value = `${brandName.trim()} (${genericName.trim()})`
                        } else if (genericName.trim()) {
                          value = genericName.trim()
                        } else {
                          value = brandName.trim()
                        }
                      }}
                      on:focus={handleFocus}
                      on:blur={handleBlur}
                      on:keydown={handleKeydown}
                    >
        {#if genericName || brandName}
          <button 
            class="inline-flex items-center px-3 py-2 border border-gray-300 border-l-0 text-sm font-medium text-gray-600 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed" 
            type="button" 
            {disabled}
            on:click={() => {
              brandName = ''
              genericName = ''
              value = ''
              searchResults = []
              showDropdown = false
            }}
            title="Clear search"
          >
            <i class="fas fa-times"></i>
          </button>
        {/if}
      </div>
    </div>
  </div>
  
  
  <!-- Enhanced Dropdown Results with Autofill -->
  {#if showDropdown && searchResults.length > 0}
    <div class="absolute top-full left-0 w-full bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-60 overflow-y-auto">
      {#each searchResults as drug, index}
        <button 
          class="w-full px-4 py-3 text-left hover:bg-blue-50 focus:bg-blue-50 focus:outline-none border-b border-gray-100 last:border-b-0 {selectedIndex === index ? 'bg-blue-50' : ''}" 
          type="button"
          on:click={() => selectDrug(drug)}
          on:mouseenter={() => selectedIndex = index}
        >
          <div class="flex justify-between items-start">
            <div class="flex-1">
              <!-- Main drug name -->
              <div class="font-semibold text-gray-900 mb-1">{drug.displayName}</div>
              
              <!-- Drug details -->
              <div class="flex flex-wrap items-center gap-2 text-xs text-gray-600">
                {#if drug.strength}
                  <span class="inline-flex items-center px-2 py-1 rounded bg-gray-100">
                    <i class="fas fa-weight-hanging mr-1"></i>{drug.strength}
                    {#if drug.source === 'pharmacy' && drug.currentStock !== undefined}
                      <span class="ml-1 text-blue-600 font-medium">({drug.currentStock} {drug.packUnit || 'units'})</span>
                    {/if}
                  </span>
                {/if}
                {#if drug.dosageForm}
                  <span class="inline-flex items-center px-2 py-1 rounded bg-gray-100">
                    <i class="fas fa-capsules mr-1"></i>{drug.dosageForm}
                  </span>
                {/if}
                {#if drug.dosage}
                  <span class="inline-flex items-center px-2 py-1 rounded bg-gray-100">
                    <i class="fas fa-prescription-bottle-alt mr-1"></i>Dosage: {drug.dosage}
                  </span>
                {/if}
              </div>
              
              <!-- Brand/Generic breakdown -->
              {#if drug.brandName && drug.genericName}
                <div class="text-xs text-gray-500 mt-1">
                  <span class="font-medium">Brand:</span> {drug.brandName} • 
                  <span class="font-medium">Generic:</span> {drug.genericName}
                </div>
              {/if}
            </div>
            
            <div class="flex flex-col items-end gap-2 ml-3">
              <!-- Source indicator -->
              {#if drug.source === 'pharmacy'}
                <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  <i class="fas fa-store mr-1"></i>Inventory
                </span>
              {:else}
                <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                  <i class="fas fa-database mr-1"></i>Local
                </span>
              {/if}
              
              <!-- Quick action indicator -->
              <div class="text-gray-400 text-xs">
                <i class="fas fa-mouse-pointer"></i> Click to autofill
              </div>
            </div>
          </div>
        </button>
      {/each}
      
      <!-- Footer with search info -->
      <div class="px-4 py-2 bg-gray-50 border-t border-gray-200 text-xs text-gray-500">
        <div class="flex justify-between items-center">
          <span>Found {searchResults.length} medication(s)</span>
          <span>Use ↑↓ arrows to navigate, Enter to select</span>
        </div>
      </div>
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
