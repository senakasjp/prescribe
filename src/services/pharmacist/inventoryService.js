// Sophisticated Drug Inventory Management Service
// Implements pharmaceutical industry best practices for inventory management

import { 
  collection, 
  doc, 
  addDoc, 
  getDoc, 
  getDocs, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  limit,
  onSnapshot,
  writeBatch,
  increment,
  arrayUnion,
  arrayRemove
} from 'firebase/firestore'
import { db } from '../../firebase-config.js'

class InventoryService {
  constructor() {
    this.collections = {
      inventory: 'pharmacistInventory',
      suppliers: 'pharmacistSuppliers',
      purchaseOrders: 'pharmacistPurchaseOrders',
      stockMovements: 'pharmacistStockMovements',
      alerts: 'pharmacistAlerts',
      categories: 'drugCategories',
      drugDatabase: 'pharmaceuticalDatabase'
    }
    
    // Inventory status constants
    this.STOCK_STATUS = {
      IN_STOCK: 'in_stock',
      LOW_STOCK: 'low_stock',
      OUT_OF_STOCK: 'out_of_stock',
      EXPIRED: 'expired',
      EXPIRING_SOON: 'expiring_soon',
      QUARANTINE: 'quarantine'
    }
    
    // Movement types
    this.MOVEMENT_TYPES = {
      PURCHASE: 'purchase',
      SALE: 'sale',
      DISPATCH: 'dispatch',
      ADJUSTMENT: 'adjustment',
      TRANSFER: 'transfer',
      EXPIRED: 'expired',
      DAMAGED: 'damaged',
      RETURN: 'return'
    }
    
    // Alert types
    this.ALERT_TYPES = {
      LOW_STOCK: 'low_stock',
      EXPIRING: 'expiring',
      EXPIRED: 'expired',
      OVERSTOCK: 'overstock',
      PRICE_CHANGE: 'price_change',
      SUPPLIER_ISSUE: 'supplier_issue'
    }
  }

  // ==================== INVENTORY ITEM MANAGEMENT ====================

  /**
   * Create a new inventory item with comprehensive data
   */
  async createInventoryItem(pharmacistId, itemData) {
    try {
      console.log('📦 InventoryService: Creating inventory item')
      
      // Validate required fields
      this.validateInventoryItem(itemData)
      
      // Clean undefined values
      itemData = this.cleanUndefinedValues(itemData)
      
      // Generate unique identifiers
      const itemId = this.generateId()
      const barcode = itemData.barcode || this.generateBarcode()
      
      const inventoryItem = {
        id: itemId,
        pharmacistId,
        barcode,
        
        // Basic Information
        drugName: itemData.drugName,
        genericName: itemData.genericName,
        brandName: itemData.brandName,
        manufacturer: itemData.manufacturer,
        category: itemData.category || 'prescription',
        subcategory: itemData.subcategory || '',
        
        // Pharmaceutical Details
        strength: itemData.strength,
        strengthUnit: itemData.strengthUnit,
        dosageForm: itemData.dosageForm, // tablet, capsule, liquid, etc.
        route: itemData.route || 'oral', // oral, topical, injection, etc.
        packSize: itemData.packSize,
        packUnit: itemData.packUnit,
        
        // Regulatory Information
        ndcNumber: itemData.ndcNumber || '',
        rxNumber: itemData.rxNumber || '',
        controlledSubstance: itemData.controlledSubstance || false,
        schedule: itemData.schedule || '', // I, II, III, IV, V
        requiresPrescription: itemData.requiresPrescription !== false,
        
        // Inventory Details
        currentStock: parseInt(itemData.initialStock) || 0,
        minimumStock: parseInt(itemData.minimumStock) || 10,
        maximumStock: parseInt(itemData.maximumStock) || 1000,
        reorderPoint: parseInt(itemData.reorderPoint) || 20,
        reorderQuantity: parseInt(itemData.reorderQuantity) || 100,
        
        // Financial Information
        costPrice: parseFloat(itemData.costPrice) || 0,
        sellingPrice: parseFloat(itemData.sellingPrice) || 0,
        margin: parseFloat(itemData.margin) || 0,
        taxRate: parseFloat(itemData.taxRate) || 0,
        
        // Supplier Information
        primarySupplier: itemData.primarySupplier || '',
        secondarySuppliers: itemData.secondarySuppliers || [],
        supplierPartNumber: itemData.supplierPartNumber || '',
        
        // Storage Information
        storageLocation: itemData.storageLocation || '',
        storageConditions: itemData.storageConditions || 'room temperature', // room temp, refrigerated, etc.
        storageNotes: itemData.storageNotes || '',
        
        // Batch Information
        batches: itemData.batches || [],
        
        // Status and Tracking
        status: this.STOCK_STATUS.IN_STOCK,
        isActive: true,
        lastUpdated: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        createdBy: pharmacistId,
        
        // Analytics
        totalSold: 0,
        totalPurchased: 0,
        averageMonthlySales: 0,
        lastSaleDate: null,
        lastPurchaseDate: null,
        
        // Additional Data
        description: itemData.description || '',
        sideEffects: itemData.sideEffects || '',
        contraindications: itemData.contraindications || '',
        interactions: itemData.interactions || '',
        notes: itemData.notes || ''
      }
      
      const docRef = await addDoc(collection(db, this.collections.inventory), inventoryItem)
      
      // Create initial stock movement record
      await this.createStockMovement(pharmacistId, {
        itemId: docRef.id,
        type: this.MOVEMENT_TYPES.PURCHASE,
        quantity: inventoryItem.currentStock,
        unitCost: inventoryItem.costPrice,
        reference: 'Initial Stock',
        referenceId: '',
        notes: 'Initial inventory setup'
      })
      
      console.log('📦 InventoryService: Inventory item created successfully')
      return { id: docRef.id, ...inventoryItem }
      
    } catch (error) {
      console.error('❌ InventoryService: Error creating inventory item:', error)
      throw error
    }
  }

  /**
   * Get all inventory items for a pharmacist with advanced filtering
   */
  async getInventoryItems(pharmacistId, filters = {}) {
    try {
      console.log('📦 InventoryService: Getting inventory items with filters:', filters)
      
      let q = query(
        collection(db, this.collections.inventory),
        where('pharmacistId', '==', pharmacistId)
      )
      
      // No server-side sorting to avoid composite index requirements
      // All sorting will be done client-side
      
      // Apply limit
      if (filters.limit) {
        q = query(q, limit(filters.limit))
      }
      
      const querySnapshot = await getDocs(q)
      const items = []
      
      querySnapshot.forEach((doc) => {
        const item = { id: doc.id, ...doc.data() }
        
        // Filter out inactive items in memory (to avoid composite index requirement)
        if (item.isActive === false) {
          return
        }
        
        // Apply client-side filtering (to avoid composite index requirements)
        if (filters.category && item.category !== filters.category) {
          return
        }
        
        if (filters.status && item.status !== filters.status) {
          return
        }
        
        if (filters.lowStock && item.currentStock > filters.lowStock) {
          return
        }
        
        if (filters.expiring) {
          const expiringDate = new Date()
          expiringDate.setDate(expiringDate.getDate() + 30) // 30 days from now
          if (item.expiryDate && new Date(item.expiryDate) > expiringDate) {
            return
          }
        }
        
        // Calculate additional metrics
        item.stockValue = item.currentStock * item.costPrice
        item.salesValue = item.currentStock * item.sellingPrice
        item.stockTurnover = this.calculateStockTurnover(item)
        item.daysToExpiry = this.calculateDaysToExpiry(item)
        
        items.push(item)
      })
      
      // Apply client-side sorting (to avoid composite index requirements)
      if (filters.sortBy) {
        items.sort((a, b) => {
          const aVal = a[filters.sortBy] || ''
          const bVal = b[filters.sortBy] || ''
          
          // Handle different data types
          if (typeof aVal === 'number' && typeof bVal === 'number') {
            return filters.sortOrder === 'desc' ? bVal - aVal : aVal - bVal
          }
          
          // Handle string comparison
          if (filters.sortOrder === 'desc') {
            return String(bVal).localeCompare(String(aVal))
          }
          return String(aVal).localeCompare(String(bVal))
        })
      } else {
        // Default sort by drug name
        items.sort((a, b) => String(a.drugName || '').localeCompare(String(b.drugName || '')))
      }
      
      console.log('📦 InventoryService: Found', items.length, 'inventory items')
      return items
      
    } catch (error) {
      console.error('❌ InventoryService: Error getting inventory items:', error)
      throw error
    }
  }

  /**
   * Update inventory item
   */
  async updateInventoryItem(itemId, updateData) {
    try {
      console.log('📦 InventoryService: Updating inventory item:', itemId)
      
      const itemRef = doc(db, this.collections.inventory, itemId)
      const updatePayload = {
        ...updateData,
        lastUpdated: new Date().toISOString()
      }
      
      await updateDoc(itemRef, updatePayload)
      
      console.log('📦 InventoryService: Inventory item updated successfully')
      return true
      
    } catch (error) {
      console.error('❌ InventoryService: Error updating inventory item:', error)
      throw error
    }
  }

  // ==================== STOCK MOVEMENT MANAGEMENT ====================

  /**
   * Create a stock movement record
   */
  async createStockMovement(pharmacistId, movementData) {
    try {
      console.log('📦 InventoryService: Creating stock movement')
      
      const movement = {
        id: this.generateId(),
        pharmacistId,
        itemId: movementData.itemId,
        type: movementData.type,
        quantity: parseInt(movementData.quantity),
        unitCost: parseFloat(movementData.unitCost) || 0,
        totalCost: parseInt(movementData.quantity) * (parseFloat(movementData.unitCost) || 0),
        reference: movementData.reference || '',
        referenceId: movementData.referenceId || '',
        notes: movementData.notes || '',
        batchNumber: movementData.batchNumber || '',
        expiryDate: movementData.expiryDate || '',
        createdAt: new Date().toISOString(),
        createdBy: pharmacistId
      }
      
      const docRef = await addDoc(collection(db, this.collections.stockMovements), movement)
      
      // Update inventory item stock
      await this.updateStockLevel(movementData.itemId, movementData.quantity, movementData.type)
      
      console.log('📦 InventoryService: Stock movement created successfully')
      return { id: docRef.id, ...movement }
      
    } catch (error) {
      console.error('❌ InventoryService: Error creating stock movement:', error)
      throw error
    }
  }

  /**
   * Update stock level for an item
   */
  async updateStockLevel(itemId, quantity, type) {
    try {
      const itemRef = doc(db, this.collections.inventory, itemId)
      
      let stockChange = parseInt(quantity)
      if (type === this.MOVEMENT_TYPES.SALE || type === this.MOVEMENT_TYPES.EXPIRED || type === this.MOVEMENT_TYPES.DAMAGED) {
        stockChange = -stockChange
      }
      
      await updateDoc(itemRef, {
        currentStock: increment(stockChange),
        lastUpdated: new Date().toISOString()
      })
      
      // Check if stock level triggers alerts
      await this.checkStockAlerts(itemId)
      
    } catch (error) {
      console.error('❌ InventoryService: Error updating stock level:', error)
      throw error
    }
  }

  // ==================== BATCH MANAGEMENT ====================

  /**
   * Add a new batch to an inventory item
   */
  async addBatch(itemId, batchData) {
    try {
      console.log('📦 InventoryService: Adding batch to item:', itemId)
      
      const batch = {
        id: this.generateId(),
        batchNumber: batchData.batchNumber,
        quantity: parseInt(batchData.quantity),
        expiryDate: batchData.expiryDate,
        costPrice: parseFloat(batchData.costPrice),
        supplier: batchData.supplier,
        purchaseDate: batchData.purchaseDate || new Date().toISOString(),
        receivedDate: new Date().toISOString(),
        status: 'active',
        notes: batchData.notes
      }
      
      const itemRef = doc(db, this.collections.inventory, itemId)
      await updateDoc(itemRef, {
        batches: arrayUnion(batch),
        lastUpdated: new Date().toISOString()
      })
      
      console.log('📦 InventoryService: Batch added successfully')
      return batch
      
    } catch (error) {
      console.error('❌ InventoryService: Error adding batch:', error)
      throw error
    }
  }

  // ==================== ALERTS AND NOTIFICATIONS ====================

  /**
   * Check and create stock alerts
   */
  async checkStockAlerts(itemId) {
    try {
      const itemDoc = await getDoc(doc(db, this.collections.inventory, itemId))
      if (!itemDoc.exists()) return
      
      const item = itemDoc.data()
      const alerts = []
      
      // Low stock alert
      if (item.currentStock <= item.minimumStock) {
        alerts.push({
          type: this.ALERT_TYPES.LOW_STOCK,
          severity: 'high',
          message: `${item.drugName} is running low. Current stock: ${item.currentStock}`,
          itemId,
          pharmacistId: item.pharmacistId
        })
      }
      
      // Expiring soon alert
      if (item.batches && item.batches.length > 0) {
        const expiringBatches = item.batches.filter(batch => {
          const expiryDate = new Date(batch.expiryDate)
          const thirtyDaysFromNow = new Date()
          thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30)
          return expiryDate <= thirtyDaysFromNow && batch.status === 'active'
        })
        
        if (expiringBatches.length > 0) {
          alerts.push({
            type: this.ALERT_TYPES.EXPIRING,
            severity: 'medium',
            message: `${item.drugName} has batches expiring within 30 days`,
            itemId,
            pharmacistId: item.pharmacistId,
            details: expiringBatches
          })
        }
      }
      
      // Create alerts
      for (const alert of alerts) {
        await this.createAlert(alert)
      }
      
    } catch (error) {
      console.error('❌ InventoryService: Error checking stock alerts:', error)
    }
  }

  /**
   * Create an alert
   */
  async createAlert(alertData) {
    try {
      const alert = {
        id: this.generateId(),
        ...alertData,
        isRead: false,
        createdAt: new Date().toISOString()
      }
      
      await addDoc(collection(db, this.collections.alerts), alert)
      console.log('📦 InventoryService: Alert created:', alert.type)
      
    } catch (error) {
      console.error('❌ InventoryService: Error creating alert:', error)
    }
  }

  // ==================== ANALYTICS AND REPORTING ====================

  /**
   * Get inventory analytics
   */
  async getInventoryAnalytics(pharmacistId, period = '30d') {
    try {
      console.log('📦 InventoryService: Getting inventory analytics for period:', period)
      
      const items = await this.getInventoryItems(pharmacistId)
      
      const analytics = {
        totalItems: items.length,
        totalStockValue: 0,
        totalSalesValue: 0,
        lowStockItems: 0,
        expiringItems: 0,
        outOfStockItems: 0,
        topSellingItems: [],
        categoryBreakdown: {},
        stockTurnover: 0,
        averageMargin: 0
      }
      
      items.forEach(item => {
        // Calculate totals
        analytics.totalStockValue += item.stockValue || 0
        analytics.totalSalesValue += item.salesValue || 0
        
        // Count status items
        if (item.status === this.STOCK_STATUS.LOW_STOCK) analytics.lowStockItems++
        if (item.status === this.STOCK_STATUS.OUT_OF_STOCK) analytics.outOfStockItems++
        if (item.daysToExpiry <= 30) analytics.expiringItems++
        
        // Category breakdown
        if (!analytics.categoryBreakdown[item.category]) {
          analytics.categoryBreakdown[item.category] = 0
        }
        analytics.categoryBreakdown[item.category]++
        
        // Calculate margin
        if (item.sellingPrice > 0 && item.costPrice > 0) {
          const margin = ((item.sellingPrice - item.costPrice) / item.sellingPrice) * 100
          analytics.averageMargin += margin
        }
      })
      
      // Calculate averages
      analytics.averageMargin = analytics.averageMargin / items.length
      analytics.stockTurnover = this.calculateOverallStockTurnover(items)
      
      // Get top selling items
      analytics.topSellingItems = items
        .sort((a, b) => (b.totalSold || 0) - (a.totalSold || 0))
        .slice(0, 10)
      
      console.log('📦 InventoryService: Analytics calculated successfully')
      return analytics
      
    } catch (error) {
      console.error('❌ InventoryService: Error getting inventory analytics:', error)
      throw error
    }
  }

  // ==================== UTILITY FUNCTIONS ====================

  /**
   * Validate inventory item data
   */
  validateInventoryItem(itemData) {
    const required = ['drugName', 'initialStock', 'costPrice', 'sellingPrice']
    const missing = required.filter(field => !itemData[field])
    
    if (missing.length > 0) {
      throw new Error(`Missing required fields: ${missing.join(', ')}`)
    }
    
    if (parseInt(itemData.initialStock) < 0) {
      throw new Error('Initial stock cannot be negative')
    }
    
    if (parseFloat(itemData.costPrice) < 0) {
      throw new Error('Cost price cannot be negative')
    }
    
    if (parseFloat(itemData.sellingPrice) < 0) {
      throw new Error('Selling price cannot be negative')
    }
  }

  /**
   * Generate unique ID
   */
  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2)
  }

  /**
   * Generate barcode
   */
  generateBarcode() {
    return 'INV' + Date.now().toString().slice(-8)
  }

  /**
   * Calculate stock turnover
   */
  calculateStockTurnover(item) {
    if (!item.averageMonthlySales || item.averageMonthlySales === 0) return 0
    return (item.averageMonthlySales * 12) / (item.currentStock || 1)
  }

  /**
   * Calculate overall stock turnover
   */
  calculateOverallStockTurnover(items) {
    const totalSales = items.reduce((sum, item) => sum + (item.averageMonthlySales || 0), 0)
    const totalStock = items.reduce((sum, item) => sum + (item.currentStock || 0), 0)
    return totalStock > 0 ? (totalSales * 12) / totalStock : 0
  }

  /**
   * Calculate days to expiry
   */
  calculateDaysToExpiry(item) {
    if (!item.batches || item.batches.length === 0) return null
    
    const activeBatches = item.batches.filter(batch => batch.status === 'active')
    if (activeBatches.length === 0) return null
    
    const nearestExpiry = activeBatches.reduce((nearest, batch) => {
      const expiryDate = new Date(batch.expiryDate)
      return !nearest || expiryDate < nearest ? expiryDate : nearest
    }, null)
    
    if (!nearestExpiry) return null
    
    const today = new Date()
    const diffTime = nearestExpiry - today
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  }

  /**
   * Get stock status based on current stock and expiry
   */
  getStockStatus(currentStock, minimumStock, daysToExpiry) {
    if (currentStock <= 0) return this.STOCK_STATUS.OUT_OF_STOCK
    if (daysToExpiry !== null && daysToExpiry <= 0) return this.STOCK_STATUS.EXPIRED
    if (daysToExpiry !== null && daysToExpiry <= 30) return this.STOCK_STATUS.EXPIRING_SOON
    if (currentStock <= minimumStock) return this.STOCK_STATUS.LOW_STOCK
    return this.STOCK_STATUS.IN_STOCK
  }

  /**
   * Clean undefined values from object
   */
  cleanUndefinedValues(obj) {
    const cleaned = {}
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) {
        cleaned[key] = value
      }
    }
    return cleaned
  }
}

export default new InventoryService()
