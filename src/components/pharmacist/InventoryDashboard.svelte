<!-- Sophisticated Drug Inventory Dashboard -->
<!-- Implements pharmaceutical industry best practices -->

<script>
  import { onMount } from 'svelte'
  import inventoryService from '../../services/pharmacist/inventoryService.js'
  import { notifySuccess, notifyError } from '../../stores/notifications.js'
  import ConfirmationModal from '../ConfirmationModal.svelte'
  
  export let pharmacist
  let pharmacyId = null
  $: pharmacyId = pharmacist?.pharmacyId || pharmacist?.id || null
  
  // State management
  let loading = true
  let activeTab = 'overview' // overview, items, analytics, alerts, suppliers
  let inventoryItems = []
  let analytics = null
  let alerts = []
  let suppliers = []
  
  // Filters and search
  let searchQuery = ''
  let categoryFilter = 'all'
  let statusFilter = 'all'
  let sortBy = 'drugName'
  let sortOrder = 'asc'
  
  // Pagination
  let currentPage = 1
  let itemsPerPage = 20
  let totalPages = 1
  
  // Modals
  let showAddItemModal = false
  let showEditItemModal = false
  let showBatchModal = false
  let showConfirmationModal = false
  let selectedItem = null
  let confirmationConfig = {}
  let pendingAction = null
  let lastPharmacistId = null
  
  // Form data
  let newItemForm = {
    brandName: '',
    genericName: '',
    manufacturer: '',
    category: 'prescription',
    strength: '',
    strengthUnit: 'mg',
    dosageForm: 'tablet',
    packSize: '',
    packUnit: 'tablets',
    initialStock: '',
    minimumStock: '10',
    maximumStock: '1000',
    costPrice: '',
    sellingPrice: '',
    expiryDate: '',
    batchNumber: '',
    storageLocation: '',
    storageConditions: 'room temperature',
    description: '',
    notes: ''
  }
  
  // Load data on mount
  onMount(async () => {
    if (pharmacyId) {
      lastPharmacistId = pharmacyId
      await loadDashboardData()
    }
  })
  
  // Load all dashboard data
  const loadDashboardData = async () => {
    try {
      loading = true
      await Promise.all([
        loadInventoryItems(),
        loadAnalytics(),
        loadAlerts(),
        loadSuppliers()
      ])
    } catch (error) {
      console.error('Error loading dashboard data:', error)
      notifyError('Failed to load dashboard data')
    } finally {
      loading = false
    }
  }
  
  // Load inventory items
  const loadInventoryItems = async () => {
    try {
      console.log('📦 Loading inventory items for pharmacy:', pharmacyId)
      
      if (!pharmacyId) {
        console.error('❌ No pharmacist ID available')
        notifyError('Pharmacist information not available')
        return
      }
      
      const filters = {
        category: categoryFilter !== 'all' ? categoryFilter : undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        sortBy,
        sortOrder
      }
      
      inventoryItems = await inventoryService.getInventoryItems(pharmacyId, filters)
      
      console.log('📦 Loaded inventory items:', inventoryItems.length)
      
      // Apply search filter
      if (searchQuery) {
        inventoryItems = inventoryItems.filter(item => 
          (item.brandName || item.drugName)?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.genericName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.manufacturer?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.strength?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          `${item.brandName || item.drugName} ${item.strength} ${item.expiryDate}`.toLowerCase().includes(searchQuery.toLowerCase())
        )
      }
      
      // Calculate pagination
      totalPages = Math.ceil(inventoryItems.length / itemsPerPage)
      currentPage = 1
      
    } catch (error) {
      console.error('❌ Error loading inventory items:', error)
      notifyError('Failed to load inventory items: ' + error.message)
      
      // Initialize with empty array if no items found
      inventoryItems = []
      totalPages = 1
      currentPage = 1
    }
  }
  
  // Load analytics
  const loadAnalytics = async () => {
    try {
      if (!pharmacyId) return
      analytics = await inventoryService.getInventoryAnalytics(pharmacyId)
    } catch (error) {
      console.error('Error loading analytics:', error)
      // Don't show error for analytics as it's not critical
      analytics = null
    }
  }
  
  // Load alerts
  const loadAlerts = async () => {
    try {
      if (!pharmacyId) return
      // This would be implemented in the inventory service
      alerts = []
    } catch (error) {
      console.error('Error loading alerts:', error)
      alerts = []
    }
  }
  
  // Load suppliers
  const loadSuppliers = async () => {
    try {
      if (!pharmacyId) return
      // This would be implemented in the inventory service
      suppliers = []
    } catch (error) {
      console.error('Error loading suppliers:', error)
      suppliers = []
    }
  }
  
  // Add new inventory item
  const addInventoryItem = async () => {
    try {
      if (!pharmacyId) {
        notifyError('Pharmacist information not available')
        return
      }
      
      if (!newItemForm.brandName || !newItemForm.genericName || !newItemForm.strength || !newItemForm.strengthUnit || !newItemForm.initialStock || !newItemForm.minimumStock || !newItemForm.sellingPrice || !newItemForm.expiryDate || !newItemForm.storageConditions) {
        notifyError('Please fill in all required fields including brand name, strength, strength unit, and expiry date')
        return
      }
      
      await inventoryService.createInventoryItem(pharmacyId, newItemForm)
      
      notifySuccess('Inventory item added successfully!')
      
      // Reset form
      newItemForm = {
        brandName: '',
        genericName: '',
        manufacturer: '',
        category: 'prescription',
        strength: '',
        strengthUnit: 'mg',
        dosageForm: 'tablet',
        packSize: '',
        packUnit: 'tablets',
        initialStock: '',
        minimumStock: '10',
        maximumStock: '1000',
        costPrice: '',
        sellingPrice: '',
        storageLocation: '',
        storageConditions: 'room temperature',
        description: '',
        notes: ''
      }
      
      showAddItemModal = false
      await loadDashboardData()
      notifySuccess('Inventory item added successfully')
      
    } catch (error) {
      console.error('Error adding inventory item:', error)
      notifyError('Failed to add inventory item: ' + error.message)
    }
  }

  // Edit inventory item
  const editInventoryItem = async () => {
    try {
      if (!pharmacist?.id) {
        notifyError('Pharmacist information not available')
        return
      }
      
      if (!editItemForm.brandName || !editItemForm.genericName || !editItemForm.strength || !editItemForm.strengthUnit || !editItemForm.currentStock || !editItemForm.minimumStock || !editItemForm.sellingPrice || !editItemForm.expiryDate || !editItemForm.storageConditions) {
        notifyError('Please fill in all required fields including brand name, strength, strength unit, and expiry date')
        return
      }
      
      await inventoryService.updateInventoryItem(editingItem.id, pharmacyId, editItemForm)
      
      notifySuccess('Inventory item updated successfully!')
      
      // Close modal and reset form
      showEditModal = false
      editItemForm = {}
      editingItem = null
      
      // Reload items
      await loadInventoryItems()
      
    } catch (error) {
      console.error('❌ Error updating inventory item:', error)
      notifyError('Failed to update inventory item: ' + error.message)
    }
  }
  
  // Delete inventory item
  const deleteInventoryItem = (itemId) => {
    confirmationConfig = {
      title: 'Delete Inventory Item',
      message: 'Are you sure you want to delete this inventory item? This action cannot be undone.',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      type: 'danger'
    }
    
    pendingAction = async () => {
      try {
        await inventoryService.deleteInventoryItem(itemId)
        await loadDashboardData()
        notifySuccess('Inventory item deleted successfully')
      } catch (error) {
        console.error('Error deleting inventory item:', error)
        notifyError('Failed to delete inventory item')
      }
    }
    
    showConfirmationModal = true
  }
  
  // Get stock status color
  const getStatusColor = (status) => {
    const colors = {
      'in_stock': 'bg-green-100 text-green-800',
      'low_stock': 'bg-yellow-100 text-yellow-800',
      'out_of_stock': 'bg-red-100 text-red-800',
      'expired': 'bg-red-100 text-red-800',
      'expiring_soon': 'bg-orange-100 text-orange-800',
      'quarantine': 'bg-gray-100 text-gray-800'
    }
    return colors[status] || 'bg-gray-100 text-gray-800'
  }
  
  // Get status text
  const getStatusText = (status) => {
    const texts = {
      'in_stock': 'In Stock',
      'low_stock': 'Low Stock',
      'out_of_stock': 'Out of Stock',
      'expired': 'Expired',
      'expiring_soon': 'Expiring Soon',
      'quarantine': 'Quarantine'
    }
    return texts[status] || 'Unknown'
  }
  
  // Format currency
  const formatCurrency = (amount) => {
    const currency = pharmacist?.currency || 'USD'
    
    if (currency === 'LKR') {
      // Format the number without currency style (icon shows currency)
      const numberFormatted = new Intl.NumberFormat('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).format(amount)
      return numberFormatted
    } else {
      // For other currencies, use the standard currency formatting
      const formatted = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency
      }).format(amount)
      
      if (currency === 'USD') {
        return formatted.replace('$', 'USD $')
      } else if (currency === 'EUR') {
        return formatted.replace('€', 'EUR €')
      } else if (currency === 'GBP') {
        return formatted.replace('£', 'GBP £')
      }
      
      return formatted
    }
  }
  
  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A'
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
  }
  
  // Handle confirmation
  const handleConfirmation = () => {
    if (pendingAction) {
      pendingAction()
      pendingAction = null
    }
    showConfirmationModal = false
  }
  
  // Handle cancellation
  const handleCancellation = () => {
    pendingAction = null
    showConfirmationModal = false
  }
  
  // Handle edit item
  const handleEditItem = async () => {
    try {
      if (!selectedItem || !pharmacyId) {
        notifyError('Unable to update item: Missing data')
        return
      }

      // Map selectedItem data to the format expected by validation
      const itemDataForUpdate = {
        ...selectedItem,
        // Map currentStock to initialStock for validation
        initialStock: selectedItem.currentStock,
        // Ensure brandName is present (it should be readonly in the form)
        brandName: selectedItem.brandName || selectedItem.drugName
      }

      // Update the item using the inventory service
      const updatedItem = await inventoryService.updateInventoryItem(selectedItem.id, pharmacyId, itemDataForUpdate)
      
      if (updatedItem) {
        // Update the local inventory items array
        const index = inventoryItems.findIndex(item => item.id === selectedItem.id)
        if (index !== -1) {
          inventoryItems[index] = { ...selectedItem, ...updatedItem }
        }
        
        notifySuccess('Inventory item updated successfully')
        showEditItemModal = false
        selectedItem = null
      } else {
        notifyError('Failed to update inventory item')
      }
    } catch (error) {
      console.error('Error updating inventory item:', error)
      notifyError('Error updating inventory item: ' + error.message)
    }
  }
  
  // Reactive statements
  $: filteredItems = inventoryItems.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
  $: if (pharmacyId && (searchQuery || categoryFilter || statusFilter || sortBy || sortOrder)) {
    loadInventoryItems()
  }
  $: if (pharmacyId && pharmacyId !== lastPharmacistId) {
    lastPharmacistId = pharmacyId
    loadDashboardData()
  }
</script>

<div class="min-h-screen bg-gray-50">
  <!-- Header -->
  <div class="bg-white shadow-sm border-b border-gray-200">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex flex-col sm:flex-row sm:justify-between sm:items-center py-4 sm:py-6 gap-4">
        <div class="flex-1">
          <h1 class="text-xl sm:text-2xl font-bold text-gray-900">
            <i class="fas fa-boxes mr-2 text-blue-600"></i>
            Drug Inventory Management
          </h1>
          <p class="text-sm sm:text-base text-gray-600 mt-1">Comprehensive pharmaceutical inventory system</p>
        </div>
        <button 
          class="bg-blue-600 hover:bg-blue-700 text-white px-3 sm:px-4 py-2 rounded-lg font-medium transition-colors duration-200 text-sm sm:text-base"
          on:click={() => showAddItemModal = true}
        >
          <i class="fas fa-plus mr-1 sm:mr-2"></i>
          <span class="hidden sm:inline">Add Inventory Item</span>
          <span class="sm:hidden">Add Item</span>
        </button>
      </div>
    </div>
  </div>

  <!-- Navigation Tabs -->
  <div class="bg-white border-b border-gray-200">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <nav class="flex flex-wrap overflow-x-auto space-x-2 sm:space-x-4 lg:space-x-8">
        <button 
          class="py-3 sm:py-4 px-1 sm:px-2 border-b-2 font-medium text-xs sm:text-sm whitespace-nowrap {activeTab === 'overview' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}"
          on:click={() => activeTab = 'overview'}
        >
          <i class="fas fa-chart-pie mr-1 sm:mr-2"></i>
          <span class="hidden sm:inline">Overview</span>
        </button>
        <button 
          class="py-3 sm:py-4 px-1 sm:px-2 border-b-2 font-medium text-xs sm:text-sm whitespace-nowrap {activeTab === 'items' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}"
          on:click={() => activeTab = 'items'}
        >
          <i class="fas fa-boxes mr-1 sm:mr-2"></i>
          <span class="hidden sm:inline">Inventory Items</span>
        </button>
        <button 
          class="py-3 sm:py-4 px-1 sm:px-2 border-b-2 font-medium text-xs sm:text-sm whitespace-nowrap {activeTab === 'analytics' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}"
          on:click={() => activeTab = 'analytics'}
        >
          <i class="fas fa-chart-bar mr-1 sm:mr-2"></i>
          <span class="hidden sm:inline">Analytics</span>
        </button>
        <button 
          class="py-3 sm:py-4 px-1 sm:px-2 border-b-2 font-medium text-xs sm:text-sm whitespace-nowrap {activeTab === 'alerts' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}"
          on:click={() => activeTab = 'alerts'}
        >
          <i class="fas fa-bell mr-1 sm:mr-2"></i>
          <span class="hidden sm:inline">Alerts</span>
          {#if alerts.length > 0}
            <span class="ml-1 sm:ml-2 bg-red-100 text-red-800 text-xs font-medium px-1 sm:px-2 py-0.5 rounded-full">{alerts.length}</span>
          {/if}
        </button>
        <button 
          class="py-3 sm:py-4 px-1 sm:px-2 border-b-2 font-medium text-xs sm:text-sm whitespace-nowrap {activeTab === 'suppliers' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}"
          on:click={() => activeTab = 'suppliers'}
        >
          <i class="fas fa-truck mr-1 sm:mr-2"></i>
          <span class="hidden sm:inline">Suppliers</span>
        </button>
      </nav>
    </div>
  </div>

  <!-- Main Content -->
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8">
    {#if loading}
      <div class="text-center py-12">
        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        <p class="text-gray-500 mt-4">Loading inventory data...</p>
      </div>
    {:else if activeTab === 'overview'}
      <!-- Overview Tab -->
      <div class="space-y-4 sm:space-y-6">
        <!-- Key Metrics Cards -->
        <div class="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 md:gap-6">
          <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-3 sm:p-4 md:p-6">
            <div class="flex items-center">
              <div class="ml-2 sm:ml-4">
                <p class="text-xs sm:text-sm font-medium text-gray-500">Total Items</p>
                <div class="flex flex-col">
                  <i class="fas fa-boxes text-sm sm:text-base md:text-lg text-blue-600"></i>
                  <p class="text-sm sm:text-base md:text-lg font-semibold text-gray-900 -mt-1">{analytics?.totalItems || 0}</p>
                </div>
              </div>
            </div>
          </div>
          
          <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-3 sm:p-4 md:p-6">
            <div class="flex items-center">
              <div class="ml-2 sm:ml-4">
                <p class="text-xs sm:text-sm font-medium text-gray-500">Stock Value</p>
                <div class="flex flex-col">
                  <p class="text-sm sm:text-base md:text-lg font-semibold text-gray-900">Rs</p>
                  <p class="text-sm sm:text-base md:text-lg font-semibold text-gray-900 -mt-1">{formatCurrency(analytics?.totalStockValue || 0)}</p>
                </div>
              </div>
            </div>
          </div>
          
          <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-3 sm:p-4 md:p-6">
            <div class="flex items-center">
              <div class="ml-2 sm:ml-4">
                <p class="text-xs sm:text-sm font-medium text-gray-500">Low Stock Items</p>
                <div class="flex flex-col">
                  <i class="fas fa-exclamation-triangle text-sm sm:text-base md:text-lg text-yellow-600"></i>
                  <p class="text-sm sm:text-base md:text-lg font-semibold text-gray-900 -mt-1">{analytics?.lowStockItems || 0}</p>
                </div>
              </div>
            </div>
          </div>
          
          <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-3 sm:p-4 md:p-6">
            <div class="flex items-center">
              <div class="ml-2 sm:ml-4">
                <p class="text-xs sm:text-sm font-medium text-gray-500">Expiring Items</p>
                <div class="flex flex-col">
                  <i class="fas fa-clock text-sm sm:text-base md:text-lg text-orange-600"></i>
                  <p class="text-sm sm:text-base md:text-lg font-semibold text-gray-900 -mt-1">{analytics?.expiringItems || 0}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Recent Alerts -->
        <div class="bg-white rounded-lg shadow-sm border border-gray-200">
          <div class="px-6 py-4 border-b border-gray-200">
            <h3 class="text-lg font-semibold text-gray-900">Recent Alerts</h3>
          </div>
          <div class="p-6">
            {#if alerts.length > 0}
              <div class="space-y-3">
                {#each alerts.slice(0, 5) as alert}
                  <div class="flex items-center p-3 bg-gray-50 rounded-lg">
                    <i class="fas fa-bell text-yellow-600 mr-3"></i>
                    <div class="flex-1">
                      <p class="text-sm font-medium text-gray-900">{alert.message}</p>
                      <p class="text-xs text-gray-500">{formatDate(alert.createdAt)}</p>
                    </div>
                  </div>
                {/each}
              </div>
            {:else}
              <div class="text-center py-8">
                <i class="fas fa-check-circle text-4xl text-green-500 mb-3"></i>
                <p class="text-gray-500">No alerts at this time</p>
              </div>
            {/if}
          </div>
        </div>
      </div>
      
    {:else if activeTab === 'items'}
      <!-- Inventory Items Tab -->
      <div class="space-y-6">
        <!-- Filters and Search -->
        <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Search</label>
              <input 
                type="text" 
                bind:value={searchQuery}
                placeholder="Search drugs..."
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Category</label>
              <select 
                bind:value={categoryFilter}
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Categories</option>
                <option value="prescription">Prescription</option>
                <option value="otc">Over-the-Counter</option>
                <option value="controlled">Controlled Substance</option>
                <option value="medical">Medical Device</option>
              </select>
            </div>
            
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Status</label>
              <select 
                bind:value={statusFilter}
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Status</option>
                <option value="in_stock">In Stock</option>
                <option value="low_stock">Low Stock</option>
                <option value="out_of_stock">Out of Stock</option>
                <option value="expired">Expired</option>
                <option value="expiring_soon">Expiring Soon</option>
              </select>
            </div>
            
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Sort By</label>
              <select 
                bind:value={sortBy}
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="drugName">Brand Name</option>
                <option value="currentStock">Stock Level</option>
                <option value="costPrice">Cost Price</option>
                <option value="sellingPrice">Selling Price</option>
                <option value="lastUpdated">Last Updated</option>
              </select>
            </div>
          </div>
        </div>
        
        <!-- Inventory Items Table -->
        <div class="bg-white rounded-lg shadow-sm border border-gray-200">
          <!-- Desktop Table View -->
          <div class="hidden md:block overflow-x-auto">
            <table class="min-w-full divide-y divide-gray-200">
              <thead class="bg-gray-50">
                <tr>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-32">Brand Name</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-24">Strength</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-24">Stock</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-24">Pricing</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-24">Status</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-48">Actions</th>
                </tr>
              </thead>
              <tbody class="bg-white divide-y divide-gray-200">
                {#each filteredItems as item}
                  <tr class="hover:bg-gray-50">
                    <td class="px-6 py-4">
                      <div class="min-w-0 flex-1">
                        <div class="font-semibold text-gray-900 break-words">{item.brandName || item.drugName}</div>
                        {#if item.genericName && item.genericName !== (item.brandName || item.drugName)}
                          <div class="text-sm text-gray-500 break-words">Generic: {item.genericName}</div>
                        {/if}
                        {#if item.manufacturer}
                          <div class="text-xs text-gray-400 break-words">Mfg: {item.manufacturer}</div>
                        {/if}
                      </div>
                    </td>
                    <td class="px-6 py-4">
                      <div class="min-w-0 flex-1">
                        {#if item.strength}
                          <div class="font-medium text-gray-900">{item.strength} {item.strengthUnit || ''}</div>
                          <div class="text-xs text-gray-500">{item.dosageForm || 'N/A'}</div>
                        {:else}
                          <div class="text-sm text-gray-400">Not specified</div>
                        {/if}
                      </div>
                    </td>
                    <td class="px-6 py-4">
                      <div class="min-w-0 flex-1">
                        <div class="font-semibold text-gray-900 break-words">{item.currentStock} {item.packUnit}</div>
                        <div class="text-sm text-gray-500">Min: {item.minimumStock}</div>
                      </div>
                    </td>
                    <td class="px-6 py-4">
                      <div class="min-w-0 flex-1">
                        <div class="font-semibold text-gray-900 break-words">{formatCurrency(item.sellingPrice)}</div>
                        <div class="text-sm text-gray-500">Cost: {formatCurrency(item.costPrice)}</div>
                      </div>
                    </td>
                    <td class="px-6 py-4">
                      <div class="min-w-0 flex-1">
                        <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium {getStatusColor(item.status)}">
                          {getStatusText(item.status)}
                        </span>
                      </div>
                    </td>
                    <td class="px-6 py-4 text-sm font-medium">
                      <div class="min-w-0 flex-1">
                        <div class="flex flex-wrap gap-1">
                          <button 
                            class="text-blue-600 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded text-xs font-medium transition-colors duration-200"
                            on:click={() => { selectedItem = item; showEditItemModal = true }}
                          >
                            <i class="fas fa-edit mr-1"></i>
                            Edit
                          </button>
                          <button 
                            class="text-green-600 hover:text-green-900 bg-green-50 hover:bg-green-100 px-2 py-1 rounded text-xs font-medium transition-colors duration-200"
                            on:click={() => { selectedItem = item; showBatchModal = true }}
                          >
                            <i class="fas fa-layer-group mr-1"></i>
                            Batches
                          </button>
                          <button 
                            class="text-red-600 hover:text-red-900 bg-red-50 hover:bg-red-100 px-2 py-1 rounded text-xs font-medium transition-colors duration-200"
                            on:click={() => deleteInventoryItem(item.id)}
                          >
                            <i class="fas fa-trash mr-1"></i>
                            Delete
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>

          <!-- Mobile Card View -->
          <div class="md:hidden space-y-3 p-4">
            {#each filteredItems as item}
              <div class="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <div class="flex justify-between items-start mb-3">
                  <div class="flex-1">
                    <h3 class="font-semibold text-gray-900 text-sm">{item.brandName || item.drugName}</h3>
                    {#if item.strength}
                      <p class="text-xs text-blue-600 font-medium">Strength: {item.strength} {item.strengthUnit || ''}</p>
                    {/if}
                    {#if item.genericName && item.genericName !== (item.brandName || item.drugName)}
                      <p class="text-xs text-gray-500">Generic: {item.genericName}</p>
                    {/if}
                    {#if item.manufacturer}
                      <p class="text-xs text-gray-400">Mfg: {item.manufacturer}</p>
                    {/if}
                  </div>
                  <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium {getStatusColor(item.status)}">
                    {getStatusText(item.status)}
                  </span>
                </div>
                
                <div class="space-y-2 mb-3">
                  <div class="flex items-center text-xs">
                    <i class="fas fa-boxes text-blue-600 mr-2 w-3"></i>
                    <span class="text-gray-600 font-medium">{item.currentStock} {item.packUnit}</span>
                    <span class="text-gray-500 ml-2">Min: {item.minimumStock}</span>
                  </div>
                  <div class="flex items-center text-xs">
                    <i class="fas fa-chart-line text-green-600 mr-2 w-3"></i>
                    <div class="flex flex-col">
                      <span class="text-gray-600 font-medium text-xs">Rs</span>
                      <span class="text-gray-600 font-medium text-xs -mt-1">{formatCurrency(item.sellingPrice)}</span>
                    </div>
                    <div class="flex flex-col ml-2">
                      <span class="text-gray-500 text-xs">Cost:</span>
                      <div class="flex flex-col -mt-1">
                        <span class="text-gray-500 text-xs">Rs</span>
                        <span class="text-gray-500 text-xs -mt-1">{formatCurrency(item.costPrice)}</span>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div class="flex space-x-2">
                  <button 
                    class="flex-1 text-blue-600 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 px-3 py-2 rounded text-xs font-medium transition-colors duration-200"
                    on:click={() => { selectedItem = item; showEditItemModal = true }}
                  >
                    <i class="fas fa-edit mr-1"></i>
                    Edit
                  </button>
                  <button 
                    class="flex-1 text-green-600 hover:text-green-900 bg-green-50 hover:bg-green-100 px-3 py-2 rounded text-xs font-medium transition-colors duration-200"
                    on:click={() => { selectedItem = item; showBatchModal = true }}
                  >
                    <i class="fas fa-layer-group mr-1"></i>
                    Batches
                  </button>
                  <button 
                    class="flex-1 text-red-600 hover:text-red-900 bg-red-50 hover:bg-red-100 px-3 py-2 rounded text-xs font-medium transition-colors duration-200"
                    on:click={() => deleteInventoryItem(item.id)}
                  >
                    <i class="fas fa-trash mr-1"></i>
                    Delete
                  </button>
                </div>
              </div>
            {/each}
          </div>
          
          <!-- Pagination -->
          {#if totalPages > 1}
            <div class="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
              <div class="flex-1 flex justify-between sm:hidden">
                <button 
                  class="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                  on:click={() => currentPage = Math.max(1, currentPage - 1)}
                  disabled={currentPage === 1}
                >
                  Previous
                </button>
                <button 
                  class="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                  on:click={() => currentPage = Math.min(totalPages, currentPage + 1)}
                  disabled={currentPage === totalPages}
                >
                  Next
                </button>
              </div>
              <div class="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                <div>
                  <p class="text-sm text-gray-700">
                    Showing page <span class="font-medium">{currentPage}</span> of <span class="font-medium">{totalPages}</span>
                  </p>
                </div>
                <div>
                  <nav class="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                    <button 
                      class="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                      on:click={() => currentPage = Math.max(1, currentPage - 1)}
                      disabled={currentPage === 1}
                    >
                      <i class="fas fa-chevron-left"></i>
                    </button>
                    {#each Array.from({length: Math.min(5, totalPages)}, (_, i) => {
                      const startPage = Math.max(1, currentPage - 2)
                      const endPage = Math.min(totalPages, startPage + 4)
                      const page = startPage + i
                      return page <= endPage ? page : null
                    }).filter(Boolean) as page}
                      <button 
                        class="relative inline-flex items-center px-4 py-2 border text-sm font-medium {currentPage === page ? 'z-10 bg-blue-50 border-blue-500 text-blue-600' : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'}"
                        on:click={() => currentPage = page}
                      >
                        {page}
                      </button>
                    {/each}
                    <button 
                      class="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                      on:click={() => currentPage = Math.min(totalPages, currentPage + 1)}
                      disabled={currentPage === totalPages}
                    >
                      <i class="fas fa-chevron-right"></i>
                    </button>
                  </nav>
                </div>
              </div>
            </div>
          {/if}
        </div>
      </div>
      
    {:else if activeTab === 'analytics'}
      <!-- Analytics Tab -->
      <div class="space-y-6">
        <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 class="text-lg font-semibold text-gray-900 mb-4">Inventory Analytics</h3>
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div class="text-center">
              <div class="text-3xl font-bold text-blue-600">{analytics?.totalItems || 0}</div>
              <div class="text-sm text-gray-500">Total Items</div>
            </div>
            <div class="text-center">
              <div class="text-3xl font-bold text-green-600">{formatCurrency(analytics?.totalStockValue || 0)}</div>
              <div class="text-sm text-gray-500">Total Stock Value</div>
            </div>
            <div class="text-center">
              <div class="text-3xl font-bold text-purple-600">{analytics?.averageMargin?.toFixed(1) || 0}%</div>
              <div class="text-sm text-gray-500">Average Margin</div>
            </div>
          </div>
        </div>
      </div>
      
    {:else if activeTab === 'alerts'}
      <!-- Alerts Tab -->
      <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 class="text-lg font-semibold text-gray-900 mb-4">Inventory Alerts</h3>
        {#if alerts.length > 0}
          <div class="space-y-3">
            {#each alerts as alert}
              <div class="flex items-center p-4 bg-gray-50 rounded-lg">
                <i class="fas fa-bell text-yellow-600 mr-4"></i>
                <div class="flex-1">
                  <p class="font-medium text-gray-900">{alert.message}</p>
                  <p class="text-sm text-gray-500">{formatDate(alert.createdAt)}</p>
                </div>
                <button class="text-blue-600 hover:text-blue-900 text-sm font-medium">
                  View Details
                </button>
              </div>
            {/each}
          </div>
        {:else}
          <div class="text-center py-8">
            <i class="fas fa-check-circle text-4xl text-green-500 mb-3"></i>
            <p class="text-gray-500">No alerts at this time</p>
          </div>
        {/if}
      </div>
      
    {:else if activeTab === 'suppliers'}
      <!-- Suppliers Tab -->
      <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 class="text-lg font-semibold text-gray-900 mb-4">Suppliers</h3>
        <div class="text-center py-8">
          <i class="fas fa-truck text-4xl text-gray-400 mb-3"></i>
          <p class="text-gray-500">Supplier management coming soon</p>
        </div>
      </div>
    {/if}
  </div>
</div>

<!-- Add Item Modal -->
{#if showAddItemModal}
  <div class="fixed inset-0 z-50 overflow-y-auto">
    <div class="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
      <div class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" on:click={() => showAddItemModal = false}></div>
      
      <div class="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full">
        <div class="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-lg font-semibold text-gray-900">Add Inventory Item</h3>
            <button 
              class="text-gray-400 hover:text-gray-600"
              on:click={() => showAddItemModal = false}
            >
              <i class="fas fa-times"></i>
            </button>
          </div>
          
          <form on:submit|preventDefault={addInventoryItem} class="space-y-6">
            <!-- Basic Information -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Brand Name *</label>
                <input 
                  type="text" 
                  bind:value={newItemForm.brandName}
                  required
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter brand name"
                />
              </div>
              
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Generic Name *</label>
                <input 
                  type="text" 
                  bind:value={newItemForm.genericName}
                  required
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Manufacturer</label>
                <input 
                  type="text" 
                  bind:value={newItemForm.manufacturer}
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Category</label>
                <select 
                  bind:value={newItemForm.category}
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="prescription">Prescription</option>
                  <option value="otc">Over-the-Counter</option>
                  <option value="controlled">Controlled Substance</option>
                  <option value="medical">Medical Device</option>
                </select>
              </div>
            </div>
            
            <!-- Pharmaceutical Details -->
            <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Strength</label>
                <input 
                  type="text" 
                  bind:value={newItemForm.strength}
                  placeholder="e.g., 500"
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Strength Unit</label>
                <select 
                  bind:value={newItemForm.strengthUnit}
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="mg">mg</option>
                  <option value="g">g</option>
                  <option value="ml">ml</option>
                  <option value="mcg">mcg</option>
                  <option value="units">units</option>
                </select>
              </div>
              
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Dosage Form</label>
                <select 
                  bind:value={newItemForm.dosageForm}
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="tablet">Tablet</option>
                  <option value="capsule">Capsule</option>
                  <option value="liquid">Liquid</option>
                  <option value="injection">Injection</option>
                  <option value="cream">Cream</option>
                  <option value="ointment">Ointment</option>
                </select>
              </div>
            </div>
            
            <!-- Stock Information -->
            <div class="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Initial Stock *</label>
                <input 
                  type="number" 
                  bind:value={newItemForm.initialStock}
                  required
                  min="0"
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Minimum Stock *</label>
                <input 
                  type="number" 
                  bind:value={newItemForm.minimumStock}
                  required
                  min="0"
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Cost Price</label>
                <input 
                  type="number" 
                  bind:value={newItemForm.costPrice}
                  min="0"
                  step="0.01"
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Selling Price *</label>
                <input 
                  type="number" 
                  bind:value={newItemForm.sellingPrice}
                  required
                  min="0"
                  step="0.01"
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            
            <!-- Expiry Date -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Expiry Date *</label>
                <input 
                  type="date" 
                  bind:value={newItemForm.expiryDate}
                  required
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p class="text-xs text-gray-500 mt-1">Expiry Date is part of the primary key (Brand + Strength + Unit + Expiry) and cannot be changed after creation</p>
              </div>
              
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Batch Number</label>
                <input 
                  type="text" 
                  bind:value={newItemForm.batchNumber}
                  placeholder="e.g., BATCH001"
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            
            <!-- Additional Information -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Storage Location</label>
                <input 
                  type="text" 
                  bind:value={newItemForm.storageLocation}
                  placeholder="e.g., Shelf A1, Refrigerator"
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Storage Conditions *</label>
                <select 
                  bind:value={newItemForm.storageConditions}
                  required
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select storage condition</option>
                  <option value="room temperature">Room Temperature</option>
                  <option value="refrigerated">Refrigerated (2-8°C)</option>
                  <option value="frozen">Frozen (-20°C)</option>
                  <option value="controlled room">Controlled Room Temperature</option>
                </select>
              </div>
            </div>
            
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Description</label>
              <textarea 
                bind:value={newItemForm.description}
                rows="3"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              ></textarea>
            </div>
            
            <div class="flex justify-end space-x-3">
              <button 
                type="button"
                class="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors duration-200"
                on:click={() => showAddItemModal = false}
              >
                Cancel
              </button>
              <button 
                type="submit"
                class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
              >
                Add Item
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  </div>
{/if}

<!-- Edit Item Modal -->
{#if showEditItemModal && selectedItem}
  <div class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
    <div class="relative top-20 mx-auto p-5 border w-11/12 max-w-4xl shadow-lg rounded-md bg-white">
      <div class="mt-3">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-medium text-gray-900">
            <i class="fas fa-edit mr-2 text-blue-600"></i>
            Edit Inventory Item
          </h3>
          <button 
            class="text-gray-400 hover:text-gray-600"
            on:click={() => showEditItemModal = false}
          >
            <i class="fas fa-times text-xl"></i>
          </button>
        </div>
        
        <form on:submit|preventDefault={handleEditItem}>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <!-- Drug Information -->
            <div class="space-y-4">
              <h4 class="text-md font-medium text-gray-900 border-b pb-2">Drug Information</h4>
              
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Brand Name *</label>
                <input 
                  type="text"
                  value={selectedItem?.brandName || selectedItem?.drugName || ''}
                  required
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 cursor-not-allowed"
                  disabled
                  readonly
                  title="Brand Name cannot be changed (Primary Key)"
                />
                <p class="text-xs text-gray-500 mt-1">Brand Name is part of the primary key (Brand + Strength + Unit + Expiry) and cannot be changed</p>
              </div>
              
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Generic Name *</label>
                <input 
                  type="text"
                  bind:value={selectedItem.genericName}
                  required
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Manufacturer</label>
                <input 
                  type="text"
                  bind:value={selectedItem.manufacturer}
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">Strength *</label>
                  <input 
                    type="text"
                    bind:value={selectedItem.strength}
                    class="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 cursor-not-allowed"
                    disabled
                    title="Strength cannot be changed (Primary Key)"
                  />
                  <p class="text-xs text-gray-500 mt-1">Strength is part of the primary key (Brand + Strength + Unit + Expiry) and cannot be changed</p>
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">Strength Unit *</label>
                  <select 
                    bind:value={selectedItem.strengthUnit}
                    class="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 cursor-not-allowed"
                    disabled
                    title="Strength Unit cannot be changed (Primary Key)"
                  >
                    <option value="mg">mg</option>
                    <option value="g">g</option>
                    <option value="ml">ml</option>
                    <option value="mcg">mcg</option>
                    <option value="units">units</option>
                    <option value="%">%</option>
                  </select>
                  <p class="text-xs text-gray-500 mt-1">Strength Unit is part of the primary key (Brand + Strength + Unit + Expiry) and cannot be changed</p>
                </div>
              </div>
              
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Dosage Form</label>
                <select 
                  bind:value={selectedItem.dosageForm}
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="tablet">Tablet</option>
                  <option value="capsule">Capsule</option>
                  <option value="syrup">Syrup</option>
                  <option value="injection">Injection</option>
                  <option value="cream">Cream</option>
                  <option value="gel">Gel</option>
                  <option value="drops">Drops</option>
                  <option value="spray">Spray</option>
                </select>
              </div>
            </div>
            
            <!-- Stock & Pricing -->
            <div class="space-y-4">
              <h4 class="text-md font-medium text-gray-900 border-b pb-2">Stock & Pricing</h4>
              
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">Pack Size</label>
                  <input 
                    type="text"
                    bind:value={selectedItem.packSize}
                    class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">Pack Unit</label>
                  <select 
                    bind:value={selectedItem.packUnit}
                    class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="tablets">tablets</option>
                    <option value="capsules">capsules</option>
                    <option value="ml">ml</option>
                    <option value="box">box</option>
                    <option value="vial">vial</option>
                    <option value="tube">tube</option>
                    <option value="bottle">bottle</option>
                  </select>
                </div>
              </div>
              
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Current Stock</label>
                <input 
                  type="number"
                  bind:value={selectedItem.currentStock}
                  min="0"
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">Minimum Stock *</label>
                  <input 
                    type="number"
                    bind:value={selectedItem.minimumStock}
                    required
                    min="0"
                    class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">Maximum Stock</label>
                  <input 
                    type="number"
                    bind:value={selectedItem.maximumStock}
                    min="0"
                    class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">Cost Price</label>
                  <input 
                    type="number"
                    bind:value={selectedItem.costPrice}
                    min="0"
                    step="0.01"
                    class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">Selling Price</label>
                  <input 
                    type="number"
                    bind:value={selectedItem.sellingPrice}
                    min="0"
                    step="0.01"
                    class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Storage Location</label>
                <input 
                  type="text"
                  bind:value={selectedItem.storageLocation}
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Storage Conditions *</label>
                <select 
                  bind:value={selectedItem.storageConditions}
                  required
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select storage condition</option>
                  <option value="room temperature">Room Temperature</option>
                  <option value="refrigerated">Refrigerated (2-8°C)</option>
                  <option value="frozen">Frozen (-20°C)</option>
                  <option value="controlled">Controlled Temperature</option>
                </select>
              </div>
              
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Expiry Date *</label>
                <input 
                  type="date"
                  bind:value={selectedItem.expiryDate}
                  required
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 cursor-not-allowed"
                  disabled
                  readonly
                  title="Expiry Date cannot be changed (Primary Key)"
                />
                <p class="text-xs text-gray-500 mt-1">Expiry Date is part of the primary key (Brand + Strength + Unit + Expiry) and cannot be changed</p>
              </div>
              
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Batch Number</label>
                <input 
                  type="text"
                  bind:value={selectedItem.batchNumber}
                  placeholder="e.g., BATCH001"
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea 
                  bind:value={selectedItem.description}
                  rows="3"
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter any additional notes or description"
                ></textarea>
              </div>
              
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea 
                  bind:value={selectedItem.notes}
                  rows="2"
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Internal notes"
                ></textarea>
              </div>
            </div>
          </div>
          
          <div class="flex justify-end space-x-3 mt-6">
            <button 
              type="button"
              class="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors duration-200"
              on:click={() => showEditItemModal = false}
            >
              Cancel
            </button>
            <button 
              type="submit"
              class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
            >
              <i class="fas fa-save mr-2"></i>
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
{/if}

<!-- Confirmation Modal -->
<ConfirmationModal
  visible={showConfirmationModal}
  title={confirmationConfig.title}
  message={confirmationConfig.message}
  confirmText={confirmationConfig.confirmText}
  cancelText={confirmationConfig.cancelText}
  type={confirmationConfig.type}
  on:confirm={handleConfirmation}
  on:cancel={handleCancellation}
/>
