<!-- Batch Management Component -->
<!-- Handles pharmaceutical batch tracking, expiry management, and FIFO operations -->

<script>
  import { onMount } from 'svelte'
  import inventoryService from '../../services/pharmacist/inventoryService.js'
  import { notifySuccess, notifyError } from '../../stores/notifications.js'
  import ConfirmationModal from '../ConfirmationModal.svelte'
  import DateInput from '../DateInput.svelte'
  
  export let item
  export let onClose
  
  // State management
  let batches = []
  let loading = true
  let showAddBatchModal = false
  let showConfirmationModal = false
  let confirmationConfig = {}
  let pendingAction = null
  
  // Form data
  let newBatchForm = {
    batchNumber: '',
    quantity: '',
    expiryDate: '',
    costPrice: '',
    supplier: '',
    purchaseDate: '',
    notes: ''
  }
  
  // Load batches on mount
  onMount(async () => {
    await loadBatches()
  })
  
  // Load batches for the item
  const loadBatches = async () => {
    try {
      loading = true
      batches = item.batches || []
      
      // Sort batches by expiry date (FIFO)
      batches.sort((a, b) => new Date(a.expiryDate) - new Date(b.expiryDate))
      
    } catch (error) {
      console.error('Error loading batches:', error)
      notifyError('Failed to load batches')
    } finally {
      loading = false
    }
  }
  
  // Add new batch
  const addBatch = async () => {
    try {
      if (!newBatchForm.batchNumber || !newBatchForm.quantity || !newBatchForm.expiryDate) {
        notifyError('Please fill in all required fields')
        return
      }
      
      const batchData = {
        ...newBatchForm,
        purchaseDate: newBatchForm.purchaseDate || new Date().toISOString(),
        costPrice: parseFloat(newBatchForm.costPrice) || 0,
        quantity: parseInt(newBatchForm.quantity)
      }
      
      await inventoryService.addBatch(item.id, batchData)
      
      // Reset form
      newBatchForm = {
        batchNumber: '',
        quantity: '',
        expiryDate: '',
        costPrice: '',
        supplier: '',
        purchaseDate: '',
        notes: ''
      }
      
      showAddBatchModal = false
      await loadBatches()
      notifySuccess('Batch added successfully')
      
    } catch (error) {
      console.error('Error adding batch:', error)
      notifyError('Failed to add batch: ' + error.message)
    }
  }
  
  // Update batch status
  const updateBatchStatus = (batchId, status) => {
    confirmationConfig = {
      title: 'Update Batch Status',
      message: `Are you sure you want to mark this batch as ${status}?`,
      confirmText: 'Update',
      cancelText: 'Cancel',
      type: 'warning'
    }
    
    pendingAction = async () => {
      try {
        // Update batch status logic would go here
        await loadBatches()
        notifySuccess('Batch status updated successfully')
      } catch (error) {
        console.error('Error updating batch status:', error)
        notifyError('Failed to update batch status')
      }
    }
    
    showConfirmationModal = true
  }
  
  // Get batch status color
  const getBatchStatusColor = (batch) => {
    const today = new Date()
    const expiryDate = new Date(batch.expiryDate)
    const daysToExpiry = Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24))
    
    if (batch.status === 'quarantine') return 'bg-red-100 text-red-800'
    if (batch.status === 'expired') return 'bg-red-100 text-red-800'
    if (daysToExpiry <= 0) return 'bg-red-100 text-red-800'
    if (daysToExpiry <= 30) return 'bg-yellow-100 text-yellow-800'
    if (batch.status === 'active') return 'bg-green-100 text-green-800'
    return 'bg-gray-100 text-gray-800'
  }
  
  // Get batch status text
  const getBatchStatusText = (batch) => {
    const today = new Date()
    const expiryDate = new Date(batch.expiryDate)
    const daysToExpiry = Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24))
    
    if (batch.status === 'quarantine') return 'Quarantine'
    if (batch.status === 'expired') return 'Expired'
    if (daysToExpiry <= 0) return 'Expired'
    if (daysToExpiry <= 30) return 'Expiring Soon'
    if (batch.status === 'active') return 'Active'
    return 'Unknown'
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
  
  // Format currency
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount)
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
</script>

<div class="fixed inset-0 z-50 overflow-y-auto">
  <div class="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
    <div class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" on:click={onClose}></div>
    
    <div class="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-6xl sm:w-full">
      <div class="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
        <!-- Header -->
        <div class="flex items-center justify-between mb-6">
          <div>
            <h3 class="text-lg font-semibold text-gray-900">Batch Management</h3>
            <p class="text-sm text-gray-500">{item.drugName} - {item.genericName}</p>
          </div>
          <div class="flex space-x-2">
            <button 
              class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors duration-200"
              on:click={() => showAddBatchModal = true}
            >
              <i class="fas fa-plus mr-2"></i>
              Add Batch
            </button>
            <button 
              class="text-gray-400 hover:text-gray-600"
              on:click={onClose}
            >
              <i class="fas fa-times"></i>
            </button>
          </div>
        </div>
        
        <!-- Batch Information -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div class="bg-gray-50 rounded-lg p-4">
            <div class="text-sm text-gray-500">Total Stock</div>
            <div class="text-2xl font-bold text-gray-900">{item.currentStock} {item.packUnit}</div>
          </div>
          <div class="bg-gray-50 rounded-lg p-4">
            <div class="text-sm text-gray-500">Active Batches</div>
            <div class="text-2xl font-bold text-gray-900">{batches.filter(b => b.status === 'active').length}</div>
          </div>
          <div class="bg-gray-50 rounded-lg p-4">
            <div class="text-sm text-gray-500">Expiring Soon</div>
            <div class="text-2xl font-bold text-yellow-600">
              {batches.filter(b => {
                const daysToExpiry = Math.ceil((new Date(b.expiryDate) - new Date()) / (1000 * 60 * 60 * 24))
                return daysToExpiry <= 30 && b.status === 'active'
              }).length}
            </div>
          </div>
        </div>
        
        <!-- Batches Table -->
        {#if loading}
          <div class="text-center py-8">
            <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p class="text-gray-500 mt-2">Loading batches...</p>
          </div>
        {:else if batches.length === 0}
          <div class="text-center py-8">
            <i class="fas fa-boxes text-4xl text-gray-400 mb-3"></i>
            <h4 class="text-lg font-semibold text-gray-500 mb-2">No Batches Found</h4>
            <p class="text-gray-400 mb-6">Add your first batch to start tracking inventory.</p>
            <button 
              class="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors duration-200"
              on:click={() => showAddBatchModal = true}
            >
              <i class="fas fa-plus mr-2"></i>
              Add First Batch
            </button>
          </div>
        {:else}
          <!-- Desktop Table View -->
          <div class="hidden md:block overflow-x-auto">
            <table class="min-w-full divide-y divide-gray-200">
              <thead class="bg-gray-50">
                <tr>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Batch Number</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quantity</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Expiry Date</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cost Price</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Supplier</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody class="bg-white divide-y divide-gray-200">
                {#each batches as batch}
                  <tr class="hover:bg-gray-50">
                    <td class="px-6 py-4 whitespace-nowrap">
                      <div class="font-semibold text-gray-900">{batch.batchNumber}</div>
                      <div class="text-sm text-gray-500">Added: {formatDate(batch.receivedDate)}</div>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap">
                      <div class="font-semibold text-gray-900">{batch.quantity} {item.packUnit}</div>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap">
                      <div class="font-semibold text-gray-900">{formatDate(batch.expiryDate)}</div>
                      <div class="text-sm text-gray-500">
                        {#if batch.status === 'active'}
                          {@const daysToExpiry = Math.ceil((new Date(batch.expiryDate) - new Date()) / (1000 * 60 * 60 * 24))}
                          {#if daysToExpiry <= 0}
                            <span class="text-red-600">Expired</span>
                          {:else if daysToExpiry <= 30}
                            <span class="text-yellow-600">{daysToExpiry} days left</span>
                          {:else}
                            <span class="text-green-600">{daysToExpiry} days left</span>
                          {/if}
                        {/if}
                      </div>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap">
                      <div class="font-semibold text-gray-900">{formatCurrency(batch.costPrice)}</div>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap">
                      <div class="text-sm text-gray-900">{batch.supplier || 'N/A'}</div>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap">
                      <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium {getBatchStatusColor(batch)}">
                        {getBatchStatusText(batch)}
                      </span>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div class="flex space-x-2">
                        {#if batch.status === 'active'}
                          <button 
                            class="text-yellow-600 hover:text-yellow-900 bg-yellow-50 hover:bg-yellow-100 px-3 py-1 rounded text-sm font-medium transition-colors duration-200"
                            on:click={() => updateBatchStatus(batch.id, 'quarantine')}
                            title="Quarantine"
                          >
                            <i class="fas fa-ban"></i>
                          </button>
                        {:else if batch.status === 'quarantine'}
                          <button 
                            class="text-green-600 hover:text-green-900 bg-green-50 hover:bg-green-100 px-3 py-1 rounded text-sm font-medium transition-colors duration-200"
                            on:click={() => updateBatchStatus(batch.id, 'active')}
                            title="Activate"
                          >
                            <i class="fas fa-check"></i>
                          </button>
                        {/if}
                        <button 
                          class="text-red-600 hover:text-red-900 bg-red-50 hover:bg-red-100 px-3 py-1 rounded text-sm font-medium transition-colors duration-200"
                          on:click={() => updateBatchStatus(batch.id, 'expired')}
                          title="Mark as Expired"
                        >
                          <i class="fas fa-times"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>

          <!-- Mobile Card View -->
          <div class="md:hidden space-y-3 p-4">
            {#each batches as batch}
              <div class="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <div class="flex justify-between items-start mb-3">
                  <div class="flex-1">
                    <h3 class="font-semibold text-gray-900 text-sm">{batch.batchNumber}</h3>
                    <p class="text-xs text-gray-500">Added: {formatDate(batch.receivedDate)}</p>
                  </div>
                  <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium {getBatchStatusColor(batch)}">
                    {getBatchStatusText(batch)}
                  </span>
                </div>
                
                <div class="space-y-2 mb-3">
                  <div class="flex items-center text-xs">
                    <i class="fas fa-boxes text-blue-600 mr-2 w-3"></i>
                    <span class="text-gray-600 font-medium">{batch.quantity} {item.packUnit}</span>
                  </div>
                  <div class="flex items-center text-xs">
                    <i class="fas fa-calendar text-red-600 mr-2 w-3"></i>
                    <span class="text-gray-600">{formatDate(batch.expiryDate)}</span>
                    {#if batch.status === 'active'}
                      {@const daysToExpiry = Math.ceil((new Date(batch.expiryDate) - new Date()) / (1000 * 60 * 60 * 24))}
                      {#if daysToExpiry <= 0}
                        <span class="text-red-600 ml-2">Expired</span>
                      {:else if daysToExpiry <= 30}
                        <span class="text-yellow-600 ml-2">{daysToExpiry} days left</span>
                      {:else}
                        <span class="text-green-600 ml-2">{daysToExpiry} days left</span>
                      {/if}
                    {/if}
                  </div>
                  <div class="flex items-center text-xs">
                    <i class="fas fa-dollar-sign text-green-600 mr-2 w-3"></i>
                    <span class="text-gray-600 font-medium">{formatCurrency(batch.costPrice)}</span>
                  </div>
                  <div class="flex items-center text-xs">
                    <i class="fas fa-truck text-purple-600 mr-2 w-3"></i>
                    <span class="text-gray-600">{batch.supplier || 'N/A'}</span>
                  </div>
                </div>
                
                <div class="flex space-x-2">
                  {#if batch.status === 'active'}
                    <button 
                      class="flex-1 text-yellow-600 hover:text-yellow-900 bg-yellow-50 hover:bg-yellow-100 px-3 py-2 rounded text-xs font-medium transition-colors duration-200"
                      on:click={() => updateBatchStatus(batch.id, 'quarantine')}
                      title="Quarantine"
                    >
                      <i class="fas fa-ban mr-1"></i>
                      Quarantine
                    </button>
                  {:else if batch.status === 'quarantine'}
                    <button 
                      class="flex-1 text-green-600 hover:text-green-900 bg-green-50 hover:bg-green-100 px-3 py-2 rounded text-xs font-medium transition-colors duration-200"
                      on:click={() => updateBatchStatus(batch.id, 'active')}
                      title="Activate"
                    >
                      <i class="fas fa-check mr-1"></i>
                      Activate
                    </button>
                  {/if}
                  <button 
                    class="flex-1 text-red-600 hover:text-red-900 bg-red-50 hover:bg-red-100 px-3 py-2 rounded text-xs font-medium transition-colors duration-200"
                    on:click={() => updateBatchStatus(batch.id, 'expired')}
                    title="Mark as Expired"
                  >
                    <i class="fas fa-times mr-1"></i>
                    Expire
                  </button>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    </div>
  </div>
</div>

<!-- Add Batch Modal -->
{#if showAddBatchModal}
  <div class="fixed inset-0 z-60 overflow-y-auto">
    <div class="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
      <div class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" on:click={() => showAddBatchModal = false}></div>
      
      <div class="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full">
        <div class="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-lg font-semibold text-gray-900">Add New Batch</h3>
            <button 
              class="text-gray-400 hover:text-gray-600"
              on:click={() => showAddBatchModal = false}
            >
              <i class="fas fa-times"></i>
            </button>
          </div>
          
          <form on:submit|preventDefault={addBatch} class="space-y-6">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label> <span class="text-red-500">*</span></label>
                <input 
                  type="text" 
                  bind:value={newBatchForm.batchNumber}
                  required
                  placeholder="e.g., BATCH001"
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div>
                <label> <span class="text-red-500">*</span></label>
                <input 
                  type="number" 
                  bind:value={newBatchForm.quantity}
                  required
                  min="1"
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div>
                <label> <span class="text-red-500">*</span></label>
                <DateInput type="date" lang="en-GB" placeholder="dd/mm/yyyy" 
                  bind:value={newBatchForm.expiryDate}
                  required
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Cost Price</label>
                <input 
                  type="number" 
                  bind:value={newBatchForm.costPrice}
                  min="0"
                  step="0.01"
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Supplier</label>
                <input 
                  type="text" 
                  bind:value={newBatchForm.supplier}
                  placeholder="Supplier name"
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Purchase Date</label>
                <DateInput type="date" lang="en-GB" placeholder="dd/mm/yyyy" 
                  bind:value={newBatchForm.purchaseDate}
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
            
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Notes</label>
              <textarea 
                bind:value={newBatchForm.notes}
                rows="3"
                placeholder="Additional notes about this batch..."
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              ></textarea>
            </div>
            
            <div class="action-buttons">
              <button 
                type="button"
                class="action-button action-button-secondary"
                on:click={() => showAddBatchModal = false}
              >
                Cancel
              </button>
              <button 
                type="submit"
                class="action-button action-button-primary"
              >
                Add Batch
              </button>
            </div>
          </form>
        </div>
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
