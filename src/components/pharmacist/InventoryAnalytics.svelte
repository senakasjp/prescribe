<!-- Inventory Analytics Component -->
<!-- Provides comprehensive analytics and reporting for pharmaceutical inventory -->

<script>
  import { onMount } from 'svelte'
  import inventoryService from '../../services/pharmacist/inventoryService.js'
  import { notifyError } from '../../stores/notifications.js'
  
  export let pharmacist
  let pharmacyId = null
  $: pharmacyId = pharmacist?.pharmacyId || pharmacist?.id || null
  
  // State management
  let loading = true
  let analytics = null
  let inventoryItems = []
  let selectedPeriod = '30d' // 7d, 30d, 90d, 1y
  let selectedCategory = 'all'
  
  // Chart data
  let chartData = {
    stockValue: [],
    categoryBreakdown: [],
    topSelling: [],
    expiryTrends: []
  }
  
  // Load analytics on mount
  onMount(async () => {
    await loadAnalytics()
  })
  
  // Load analytics data
  const loadAnalytics = async () => {
    try {
      loading = true
      if (!pharmacyId) {
        throw new Error('Pharmacy information not available')
      }
      analytics = await inventoryService.getInventoryAnalytics(pharmacyId, selectedPeriod)
      inventoryItems = await inventoryService.getInventoryItems(pharmacyId)
      
      // Process chart data
      processChartData()
      
    } catch (error) {
      console.error('Error loading analytics:', error)
      notifyError('Failed to load analytics data')
    } finally {
      loading = false
    }
  }
  
  // Process data for charts
  const processChartData = () => {
    if (!analytics || !inventoryItems) return
    
    // Stock value by category
    chartData.stockValue = Object.entries(analytics.categoryBreakdown).map(([category, count]) => ({
      category,
      value: inventoryItems
        .filter(item => item.category === category)
        .reduce((sum, item) => sum + (item.stockValue || 0), 0)
    }))
    
    // Category breakdown
    chartData.categoryBreakdown = Object.entries(analytics.categoryBreakdown).map(([category, count]) => ({
      category,
      count
    }))
    
    // Top selling items
    chartData.topSelling = analytics.topSellingItems.slice(0, 10).map(item => ({
      name: item.drugName,
      sold: item.totalSold || 0,
      value: (item.totalSold || 0) * (item.sellingPrice || 0)
    }))
    
    // Expiry trends (mock data for now)
    chartData.expiryTrends = [
      { month: 'Jan', expiring: 5, expired: 2 },
      { month: 'Feb', expiring: 8, expired: 1 },
      { month: 'Mar', expiring: 12, expired: 3 },
      { month: 'Apr', expiring: 7, expired: 2 },
      { month: 'May', expiring: 15, expired: 4 },
      { month: 'Jun', expiring: 9, expired: 1 }
    ]
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
  
  // Format percentage
  const formatPercentage = (value) => {
    return `${value.toFixed(1)}%`
  }
  
  // Get category color
  const getCategoryColor = (category) => {
    const colors = {
      'prescription': 'bg-blue-500',
      'otc': 'bg-green-500',
      'controlled': 'bg-red-500',
      'medical': 'bg-purple-500'
    }
    return colors[category] || 'bg-gray-500'
  }
  
  // Reactive statements
  $: if (selectedPeriod || selectedCategory) {
    loadAnalytics()
  }
</script>

<div class="space-y-6">
  <!-- Header -->
  <div class="flex justify-between items-center">
    <div>
      <h2 class="text-2xl font-bold text-gray-900">Inventory Analytics</h2>
      <p class="text-gray-600">Comprehensive insights into your pharmaceutical inventory</p>
    </div>
    
    <!-- Filters -->
    <div class="flex space-x-4">
      <select 
        bind:value={selectedPeriod}
        class="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value="7d">Last 7 Days</option>
        <option value="30d">Last 30 Days</option>
        <option value="90d">Last 90 Days</option>
        <option value="1y">Last Year</option>
      </select>
      
      <select 
        bind:value={selectedCategory}
        class="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value="all">All Categories</option>
        <option value="prescription">Prescription</option>
        <option value="otc">Over-the-Counter</option>
        <option value="controlled">Controlled Substance</option>
        <option value="medical">Medical Device</option>
      </select>
    </div>
  </div>
  
  {#if loading}
    <div class="text-center py-12">
      <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
      <p class="text-gray-500 mt-4">Loading analytics...</p>
    </div>
  {:else}
    <!-- Key Metrics -->
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
            <p class="text-xs sm:text-sm font-medium text-gray-500">Stock Turnover</p>
            <div class="flex flex-col">
              <i class="fas fa-chart-line text-sm sm:text-base md:text-lg text-purple-600"></i>
              <p class="text-sm sm:text-base md:text-lg font-semibold text-gray-900 -mt-1">{analytics?.stockTurnover?.toFixed(2) || 0}</p>
            </div>
          </div>
        </div>
      </div>
      
      <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-3 sm:p-4 md:p-6">
        <div class="flex items-center">
          <div class="ml-2 sm:ml-4">
            <p class="text-xs sm:text-sm font-medium text-gray-500">Avg Margin</p>
            <div class="flex flex-col">
              <i class="fas fa-percentage text-sm sm:text-base md:text-lg text-orange-600"></i>
              <p class="text-sm sm:text-base md:text-lg font-semibold text-gray-900 -mt-1">{formatPercentage(analytics?.averageMargin || 0)}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Charts Row 1 -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <!-- Stock Value by Category -->
      <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 class="text-lg font-semibold text-gray-900 mb-4">Stock Value by Category</h3>
        <div class="space-y-4">
          {#each chartData.stockValue as item}
            <div class="flex items-center justify-between">
              <div class="flex items-center">
                <div class="w-4 h-4 rounded-full {getCategoryColor(item.category)} mr-3"></div>
                <span class="text-sm font-medium text-gray-900 capitalize">{item.category}</span>
              </div>
              <span class="text-sm font-semibold text-gray-900">{formatCurrency(item.value)}</span>
            </div>
          {/each}
        </div>
      </div>
      
      <!-- Category Breakdown -->
      <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 class="text-lg font-semibold text-gray-900 mb-4">Items by Category</h3>
        <div class="space-y-4">
          {#each chartData.categoryBreakdown as item}
            <div class="flex items-center justify-between">
              <div class="flex items-center">
                <div class="w-4 h-4 rounded-full {getCategoryColor(item.category)} mr-3"></div>
                <span class="text-sm font-medium text-gray-900 capitalize">{item.category}</span>
              </div>
              <span class="text-sm font-semibold text-gray-900">{item.count} items</span>
            </div>
          {/each}
        </div>
      </div>
    </div>
    
    <!-- Charts Row 2 -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <!-- Top Selling Items -->
      <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 class="text-lg font-semibold text-gray-900 mb-4">Top Selling Items</h3>
        <div class="space-y-3">
          {#each chartData.topSelling as item, index}
            <div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div class="flex items-center">
                <span class="w-6 h-6 bg-blue-100 text-blue-800 text-xs font-bold rounded-full flex items-center justify-center mr-3">
                  {index + 1}
                </span>
                <span class="text-sm font-medium text-gray-900">{item.name}</span>
              </div>
              <div class="text-right">
                <div class="text-sm font-semibold text-gray-900">{item.sold} sold</div>
                <div class="text-xs text-gray-500">{formatCurrency(item.value)}</div>
              </div>
            </div>
          {/each}
        </div>
      </div>
      
      <!-- Stock Status Overview -->
      <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 class="text-lg font-semibold text-gray-900 mb-4">Stock Status Overview</h3>
        <div class="space-y-4">
          <div class="flex items-center justify-between">
            <div class="flex items-center">
              <div class="w-4 h-4 rounded-full bg-green-500 mr-3"></div>
              <span class="text-sm font-medium text-gray-900">In Stock</span>
            </div>
            <span class="text-sm font-semibold text-gray-900">
              {analytics?.totalItems - (analytics?.lowStockItems || 0) - (analytics?.outOfStockItems || 0)} items
            </span>
          </div>
          
          <div class="flex items-center justify-between">
            <div class="flex items-center">
              <div class="w-4 h-4 rounded-full bg-yellow-500 mr-3"></div>
              <span class="text-sm font-medium text-gray-900">Low Stock</span>
            </div>
            <span class="text-sm font-semibold text-gray-900">{analytics?.lowStockItems || 0} items</span>
          </div>
          
          <div class="flex items-center justify-between">
            <div class="flex items-center">
              <div class="w-4 h-4 rounded-full bg-red-500 mr-3"></div>
              <span class="text-sm font-medium text-gray-900">Out of Stock</span>
            </div>
            <span class="text-sm font-semibold text-gray-900">{analytics?.outOfStockItems || 0} items</span>
          </div>
          
          <div class="flex items-center justify-between">
            <div class="flex items-center">
              <div class="w-4 h-4 rounded-full bg-orange-500 mr-3"></div>
              <span class="text-sm font-medium text-gray-900">Expiring Soon</span>
            </div>
            <span class="text-sm font-semibold text-gray-900">{analytics?.expiringItems || 0} items</span>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Performance Metrics -->
    <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h3 class="text-lg font-semibold text-gray-900 mb-4">Performance Metrics</h3>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div class="text-center">
          <div class="text-3xl font-bold text-blue-600">{analytics?.stockTurnover?.toFixed(2) || 0}</div>
          <div class="text-sm text-gray-500">Stock Turnover Ratio</div>
          <div class="text-xs text-gray-400 mt-1">Higher is better</div>
        </div>
        
        <div class="text-center">
          <div class="text-3xl font-bold text-green-600">{formatPercentage(analytics?.averageMargin || 0)}</div>
          <div class="text-sm text-gray-500">Average Margin</div>
          <div class="text-xs text-gray-400 mt-1">Profit percentage</div>
        </div>
        
        <div class="text-center">
          <div class="text-3xl font-bold text-purple-600">
            {analytics?.totalItems > 0 ? Math.round(((analytics?.totalItems - (analytics?.lowStockItems || 0) - (analytics?.outOfStockItems || 0)) / analytics?.totalItems) * 100) : 0}%
          </div>
          <div class="text-sm text-gray-500">Stock Availability</div>
          <div class="text-xs text-gray-400 mt-1">Items in stock</div>
        </div>
      </div>
    </div>
    
    <!-- Recommendations -->
    <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h3 class="text-lg font-semibold text-gray-900 mb-4">Recommendations</h3>
      <div class="space-y-4">
        {#if analytics?.lowStockItems > 0}
          <div class="flex items-start p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <i class="fas fa-exclamation-triangle text-yellow-600 mt-1 mr-3"></i>
            <div>
              <h4 class="font-medium text-yellow-800">Low Stock Alert</h4>
              <p class="text-sm text-yellow-700 mt-1">
                You have {analytics.lowStockItems} items with low stock. Consider reordering to avoid stockouts.
              </p>
            </div>
          </div>
        {/if}
        
        {#if analytics?.expiringItems > 0}
          <div class="flex items-start p-4 bg-orange-50 border border-orange-200 rounded-lg">
            <i class="fas fa-clock text-orange-600 mt-1 mr-3"></i>
            <div>
              <h4 class="font-medium text-orange-800">Expiring Items</h4>
              <p class="text-sm text-orange-700 mt-1">
                {analytics.expiringItems} items are expiring within 30 days. Consider promotional pricing or priority sales.
              </p>
            </div>
          </div>
        {/if}
        
        {#if analytics?.stockTurnover < 2}
          <div class="flex items-start p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <i class="fas fa-info-circle text-blue-600 mt-1 mr-3"></i>
            <div>
              <h4 class="font-medium text-blue-800">Low Stock Turnover</h4>
              <p class="text-sm text-blue-700 mt-1">
                Your stock turnover ratio is {analytics?.stockTurnover?.toFixed(2) || 0}. Consider reviewing slow-moving items and adjusting inventory levels.
              </p>
            </div>
          </div>
        {/if}
        
        {#if analytics?.averageMargin < 20}
          <div class="flex items-start p-4 bg-red-50 border border-red-200 rounded-lg">
            <i class="fas fa-chart-line text-red-600 mt-1 mr-3"></i>
            <div>
              <h4 class="font-medium text-red-800">Low Profit Margin</h4>
              <p class="text-sm text-red-700 mt-1">
                Your average margin is {formatPercentage(analytics?.averageMargin || 0)}. Consider reviewing pricing strategies and supplier negotiations.
              </p>
            </div>
          </div>
        {/if}
      </div>
    </div>
  {/if}
</div>
