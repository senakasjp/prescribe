// Sophisticated Drug Inventory Management Service
// Implements pharmaceutical industry best practices for inventory management

import { 
  collection, 
  doc, 
  addDoc, 
  setDoc,
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

  // ==================== MIGRATIONS ====================

  /**
   * One-time migration: copy legacy drugStock items into pharmacistInventory
   */
  async migrateDrugStockToInventory(pharmacistId, legacyId = null) {
    try {
      if (!pharmacistId) return { migrated: 0 }

      const legacyByPharmacist = query(
        collection(db, 'drugStock'),
        where('pharmacistId', '==', pharmacistId)
      )
      const legacyByPharmacy = query(
        collection(db, 'drugStock'),
        where('pharmacyId', '==', pharmacistId)
      )
      const legacyByNumber = legacyId
        ? query(collection(db, 'drugStock'), where('pharmacistNumber', '==', legacyId))
        : null
      const [legacySnapshot, legacyPharmacySnapshot, legacyNumberSnapshot] = await Promise.all([
        getDocs(legacyByPharmacist),
        getDocs(legacyByPharmacy),
        legacyByNumber ? getDocs(legacyByNumber) : Promise.resolve({ empty: true, docs: [] })
      ])

      if (legacySnapshot.empty && legacyPharmacySnapshot.empty && legacyNumberSnapshot.empty) {
        return { migrated: 0 }
      }

      let migrated = 0
      const batch = writeBatch(db)

      const legacyDocs = new Map()
      for (const docSnap of legacySnapshot.docs) {
        legacyDocs.set(docSnap.id, docSnap)
      }
      for (const docSnap of legacyPharmacySnapshot.docs) {
        if (!legacyDocs.has(docSnap.id)) {
          legacyDocs.set(docSnap.id, docSnap)
        }
      }
      for (const docSnap of legacyNumberSnapshot.docs) {
        if (!legacyDocs.has(docSnap.id)) {
          legacyDocs.set(docSnap.id, docSnap)
        }
      }

      for (const docSnap of legacyDocs.values()) {
        const targetRef = doc(db, this.collections.inventory, docSnap.id)
        const targetSnap = await getDoc(targetRef)
        if (!targetSnap.exists()) {
          batch.set(targetRef, {
            ...docSnap.data(),
            pharmacistId,
            pharmacyId: pharmacistId
          })
          migrated += 1
        }
      }

      if (migrated > 0) {
        await batch.commit()
      }

      return { migrated }
    } catch (error) {
      console.error('❌ Error migrating drugStock to pharmacistInventory:', error)
      throw error
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
        pharmacyId: itemData.pharmacyId || pharmacistId,
        pharmacistNumber: itemData.pharmacistNumber || null,
        isTestData: !!itemData.isTestData,
        testTag: itemData.testTag || '',
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
   * Create sample inventory items (admin/testing)
   */
  async createTestInventoryItems(pharmacistId, count = 10, options = {}) {
    const total = Number.isFinite(count) && count > 0 ? count : 10
    const pharmacyId = options.pharmacyId || pharmacistId
    const pharmacistNumber = options.pharmacistNumber || null
    const created = []

    for (let i = 0; i < total; i += 1) {
      const index = i + 1
      const expiryDate = new Date()
      expiryDate.setMonth(expiryDate.getMonth() + 6)
      const costPrice = Math.floor(20 + Math.random() * 180)
      const sellingPrice = costPrice + Math.floor(10 + Math.random() * 90)
      const payload = {
        brandName: `Test Drug ${index}`,
        genericName: `test-generic-${index}`,
        strength: '500',
        strengthUnit: 'mg',
        dosageForm: 'tablet',
        packUnit: 'tablets',
        packSize: '',
        initialStock: 20,
        minimumStock: 5,
        maximumStock: 200,
        costPrice,
        sellingPrice,
        expiryDate: expiryDate.toISOString().slice(0, 10),
        storageConditions: 'room temperature',
        category: 'prescription',
        pharmacyId,
        pharmacistNumber,
        isTestData: true,
        testTag: 'TEST_DATA',
        notes: 'TEST_DATA'
      }
      created.push(await this.createInventoryItem(pharmacistId, payload))
    }

    return created
  }

  /**
   * Remove sample inventory items (admin/testing)
   */
  async deleteTestInventoryItems(pharmacistId) {
    const stockRef = collection(db, this.collections.inventory)
    const q = query(stockRef, where('pharmacistId', '==', pharmacistId))
    const snapshot = await getDocs(q)
    if (snapshot.empty) return { removed: 0 }

    const batch = writeBatch(db)
    let removed = 0
    snapshot.forEach((docSnap) => {
      const data = docSnap.data() || {}
      const isTest =
        data.isTestData === true ||
        data.testTag === 'TEST_DATA' ||
        (typeof data.notes === 'string' && data.notes.includes('TEST_DATA')) ||
        (typeof data.brandName === 'string' && data.brandName.startsWith('Test Drug '))
      if (isTest) {
        batch.delete(docSnap.ref)
        removed += 1
      }
    })

    if (removed > 0) {
      await batch.commit()
    }

    return { removed }
  }

  /**
   * Get all inventory items for a pharmacist with advanced filtering
   */
  async getInventoryItems(pharmacistId, filters = {}) {
    try {
      console.log('📦 InventoryService: Getting inventory items with filters:', filters)
      console.log('📦 InventoryService: Filter status value:', filters.status)
      console.log('📦 InventoryService: Filter status type:', typeof filters.status)
      
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
        
        // Calculate additional metrics FIRST (before filtering)
        item.stockValue = item.currentStock * item.costPrice
        item.salesValue = item.currentStock * item.sellingPrice
        item.stockTurnover = this.calculateStockTurnover(item)
        item.daysToExpiry = this.calculateDaysToExpiry(item)
        
        // Calculate dynamic status based on current stock levels
        item.status = this.getStockStatus(
          item.currentStock, 
          item.minimumStock, 
          item.daysToExpiry
        )
        
        console.log(`📦 Item: ${item.drugName}, Stock: ${item.currentStock}, Status: ${item.status}, Filter: ${filters.status}`)
        
        // Apply client-side filtering (to avoid composite index requirements)
        if (filters.category && item.category !== filters.category) {
          return
        }
        
        if (filters.status && filters.status !== 'all') {
          console.log(`🔍 Filtering item: ${item.drugName}, Item status: ${item.status}, Filter status: ${filters.status}`)
          
          // Special handling for low_stock filter to include out_of_stock items
          if (filters.status === 'low_stock') {
            if (item.status !== 'low_stock' && item.status !== 'out_of_stock') {
              console.log(`❌ Filtered out (low_stock): ${item.drugName}`)
              return
            }
          } else {
            if (item.status !== filters.status) {
              console.log(`❌ Filtered out (status mismatch): ${item.drugName} (${item.status} != ${filters.status})`)
              return
            }
          }
          
          console.log(`✅ Item passed filter: ${item.drugName}`)
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

  async getInventoryItemById(itemId) {
    try {
      const itemRef = doc(db, this.collections.inventory, itemId)
      const itemDoc = await getDoc(itemRef)
      if (!itemDoc.exists()) {
        return null
      }
      return { id: itemDoc.id, ...itemDoc.data() }
    } catch (error) {
      console.error('❌ InventoryService: Error getting inventory item by id:', error)
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
      console.log('📦 InventoryService: Creating stock movement for itemId:', movementData.itemId)
      
      const movement = {
        id: this.generateId(),
        pharmacistId,
        itemId: movementData.itemId,
        type: movementData.type,
        quantity: parseFloat(movementData.quantity),
        unitCost: parseFloat(movementData.unitCost) || 0,
        totalCost: (parseFloat(movementData.quantity) || 0) * (parseFloat(movementData.unitCost) || 0),
        reference: movementData.reference || '',
        referenceId: movementData.referenceId || '',
        notes: movementData.notes || '',
        batchNumber: movementData.batchNumber || '',
        expiryDate: movementData.expiryDate || '',
        createdAt: new Date().toISOString(),
        createdBy: pharmacistId
      }
      
      console.log('📦 InventoryService: Adding stock movement to collection:', this.collections.stockMovements)
      const docRef = await addDoc(collection(db, this.collections.stockMovements), movement)
      console.log('✅ InventoryService: Stock movement document created with ID:', docRef.id)
      
      // Update inventory item stock
      console.log('📦 InventoryService: Updating stock level for item:', movementData.itemId)
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
  normalizeStockChange(quantity, type) {
    const parsed = parseFloat(quantity)
    if (!Number.isFinite(parsed)) return 0
    if (
      type === this.MOVEMENT_TYPES.SALE ||
      type === this.MOVEMENT_TYPES.EXPIRED ||
      type === this.MOVEMENT_TYPES.DAMAGED ||
      type === this.MOVEMENT_TYPES.DISPATCH ||
      type === 'dispatch'
    ) {
      return -Math.abs(parsed)
    }
    return parsed
  }

  async updateStockLevel(itemId, quantity, type) {
    try {
      console.log('🔍 InventoryService: Updating stock level for itemId:', itemId, 'quantity:', quantity, 'type:', type)
      
      const itemRef = doc(db, this.collections.inventory, itemId)
      
      // First, check if the document exists
      const itemDoc = await getDoc(itemRef)
      if (!itemDoc.exists()) {
        console.error('❌ InventoryService: Document does not exist for itemId:', itemId)
        throw new Error(`Inventory item with ID ${itemId} does not exist`)
      }
      
      console.log('✅ InventoryService: Document exists, current stock:', itemDoc.data().currentStock)
      
      const stockChange = this.normalizeStockChange(quantity, type)
      
      console.log('🔍 InventoryService: Stock change to apply:', stockChange)
      
      await updateDoc(itemRef, {
        currentStock: increment(stockChange),
        lastUpdated: new Date().toISOString()
      })
      
      console.log('✅ InventoryService: Stock level updated successfully')
      
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

  // ==================== CORE CRUD OPERATIONS ====================

  /**
   * Create a new inventory item with primary key validation
   */
  async createInventoryItem(pharmacistId, itemData) {
    try {
      console.log('📦 Creating inventory item:', itemData)
      
      // Validate required fields including strength
      this.validateInventoryItem(itemData)
      
      // Check for duplicate primary key (brand name + strength + strength unit + expiry date)
      await this.checkDuplicatePrimaryKey(pharmacistId, itemData.brandName, itemData.strength, itemData.strengthUnit, itemData.expiryDate)
      
      // Prepare the item data
      const inventoryItem = this.prepareInventoryItemData(pharmacistId, itemData)
      
      // Add to Firestore
      const docRef = await addDoc(collection(db, this.collections.inventory), inventoryItem)
      
      console.log('✅ Inventory item created successfully:', docRef.id)
      return { id: docRef.id, ...inventoryItem }
      
    } catch (error) {
      console.error('❌ Error creating inventory item:', error)
      throw error
    }
  }

  /**
   * Update an existing inventory item with primary key validation
   */
  async updateInventoryItem(itemId, pharmacistId, itemData) {
    try {
      console.log('📦 Updating inventory item:', itemId, itemData)
      
      // Validate input parameters
      if (!itemId) {
        throw new Error('Item ID is required for update')
      }
      if (!pharmacistId) {
        throw new Error('Pharmacist ID is required for update')
      }
      if (!itemData || typeof itemData !== 'object') {
        throw new Error('Item data is required and must be an object')
      }
      
      // Validate required fields including strength
      this.validateInventoryItem(itemData)
      
      // Check for duplicate primary key (excluding current item)
      await this.checkDuplicatePrimaryKey(pharmacistId, itemData.brandName, itemData.strength, itemData.strengthUnit, itemData.expiryDate, itemId)
      
      // Prepare the update data
      const updateData = {
        ...itemData,
        pharmacistId,
        lastUpdated: new Date().toISOString(),
        updatedBy: pharmacistId
      }
      
      // Handle stock field mapping for updates
      if (updateData.initialStock !== undefined) {
        // Map initialStock to currentStock for database storage
        updateData.currentStock = parseInt(updateData.initialStock) || 0
        delete updateData.initialStock // Remove initialStock as it's not stored in DB
      }
      
      // Clean undefined values
      const cleanedData = this.cleanUndefinedValues(updateData)
      
      // Update in Firestore
      await updateDoc(doc(db, this.collections.inventory, itemId), cleanedData)
      
      console.log('✅ Inventory item updated successfully:', itemId)
      return { id: itemId, ...cleanedData }
      
    } catch (error) {
      console.error('❌ Error updating inventory item:', error)
      throw error
    }
  }

  /**
   * Delete an inventory item
   */
  async deleteInventoryItem(itemId) {
    try {
      console.log('🗑️ Deleting inventory item:', itemId)
      
      await deleteDoc(doc(db, this.collections.inventory, itemId))
      
      console.log('✅ Inventory item deleted successfully:', itemId)
      return true
      
    } catch (error) {
      console.error('❌ Error deleting inventory item:', error)
      throw error
    }
  }

  /**
   * Get inventory items for a pharmacist with filters
   */
  async getInventoryItems(pharmacistId, filters = {}) {
    try {
      console.log('📦 Getting inventory items for pharmacist:', pharmacistId, filters)
      
      // Use simple query to avoid composite index requirements
      let q = query(
        collection(db, this.collections.inventory),
        where('pharmacistId', '==', pharmacistId)
      )
      
      const querySnapshot = await getDocs(q)
      let items = []
      
      querySnapshot.forEach((doc) => {
        items.push({
          id: doc.id,
          ...doc.data()
        })
      })

      if (items.length === 0) {
        const legacyQueries = [
          query(collection(db, this.collections.inventory), where('pharmacyId', '==', pharmacistId))
        ]
        if (filters.legacyId) {
          legacyQueries.push(query(collection(db, this.collections.inventory), where('pharmacyId', '==', filters.legacyId)))
          legacyQueries.push(query(collection(db, this.collections.inventory), where('pharmacistId', '==', filters.legacyId)))
          legacyQueries.push(query(collection(db, this.collections.inventory), where('pharmacistNumber', '==', filters.legacyId)))
        }

        const snapshots = await Promise.all(legacyQueries.map(qry => getDocs(qry)))
        const legacyMap = new Map()
        snapshots.forEach(snapshot => {
          snapshot.forEach((doc) => {
            legacyMap.set(doc.id, { id: doc.id, ...doc.data() })
          })
        })
        items = Array.from(legacyMap.values())
      }
      
      // Apply filters client-side to avoid composite index requirements
      if (filters.category && filters.category !== 'all') {
        items = items.filter(item => item.category === filters.category)
      }
      
      if (filters.status && filters.status !== 'all') {
        items = items.filter(item => item.status === filters.status)
      }
      
      // Apply sorting client-side
      if (filters.sortBy) {
        const sortOrder = filters.sortOrder === 'desc' ? 'desc' : 'asc'
        items.sort((a, b) => {
          const aVal = a[filters.sortBy] || ''
          const bVal = b[filters.sortBy] || ''
          
          if (sortOrder === 'desc') {
            return bVal > aVal ? 1 : -1
          } else {
            return aVal > bVal ? 1 : -1
          }
        })
      }
      
      console.log('📦 Retrieved inventory items:', items.length)
      return items
      
    } catch (error) {
      console.error('❌ Error getting inventory items:', error)
      throw error
    }
  }

  /**
   * Get inventory analytics for a pharmacist
   */
  async getInventoryAnalytics(pharmacistId) {
    try {
      console.log('📊 Getting inventory analytics for pharmacist:', pharmacistId)
      
      const items = await this.getInventoryItems(pharmacistId)
      
      const analytics = {
        totalItems: items.length,
        totalStockValue: 0,
        lowStockItems: 0,
        expiringItems: 0,
        expiredItems: 0,
        categoryBreakdown: {},
        topItems: []
      }
      
      const today = new Date()
      const thirtyDaysFromNow = new Date(today.getTime() + (30 * 24 * 60 * 60 * 1000))
      
      items.forEach(item => {
        // Calculate stock value
        analytics.totalStockValue += (item.currentStock || 0) * (item.sellingPrice || 0)
        
        // Count low stock items
        if ((item.currentStock || 0) <= (item.minimumStock || 0)) {
          analytics.lowStockItems++
        }
        
        // Count expiring items
        if (item.expiryDate) {
          const expiryDate = new Date(item.expiryDate)
          if (expiryDate <= thirtyDaysFromNow && expiryDate > today) {
            analytics.expiringItems++
          }
          if (expiryDate <= today) {
            analytics.expiredItems++
          }
        }
        
        // Category breakdown
        const category = item.category || 'Other'
        analytics.categoryBreakdown[category] = (analytics.categoryBreakdown[category] || 0) + 1
      })
      
      // Get top items by stock value
      analytics.topItems = items
        .sort((a, b) => (b.currentStock || 0) * (b.sellingPrice || 0) - (a.currentStock || 0) * (a.sellingPrice || 0))
        .slice(0, 10)
      
      console.log('📊 Generated analytics:', analytics)
      return analytics
      
    } catch (error) {
      console.error('❌ Error getting inventory analytics:', error)
      throw error
    }
  }

  // ==================== UTILITY FUNCTIONS ====================

  /**
   * Prepare inventory item data for database storage
   */
  prepareInventoryItemData(pharmacistId, itemData) {
    return {
      // Basic Information
      brandName: itemData.brandName,
      genericName: itemData.genericName,
      manufacturer: itemData.manufacturer || '',
      category: itemData.category || 'prescription',
      subcategory: itemData.subcategory || '',
      
      // Pharmaceutical Details
      strength: itemData.strength,
      strengthUnit: itemData.strengthUnit,
      dosageForm: itemData.dosageForm || 'tablet',
      route: itemData.route || 'oral',
      packSize: itemData.packSize ? parseInt(itemData.packSize) : null,
      packUnit: itemData.packUnit || 'tablets',
      
      // Regulatory Information
      ndcNumber: itemData.ndcNumber || '',
      rxNumber: itemData.rxNumber || '',
      controlledSubstance: itemData.controlledSubstance || false,
      schedule: itemData.schedule || '',
      requiresPrescription: itemData.requiresPrescription !== false,
      
      // Inventory Details
      currentStock: parseInt(itemData.initialStock) || 0,
      minimumStock: parseInt(itemData.minimumStock) || 10,
      maximumStock: parseInt(itemData.maximumStock) || 1000,
      reorderPoint: parseInt(itemData.reorderPoint) || 20,
      reorderQuantity: parseInt(itemData.reorderQuantity) || 100,
      
      // Financial Information
      costPrice: itemData.costPrice ? parseFloat(itemData.costPrice) : null,
      sellingPrice: parseFloat(itemData.sellingPrice) || 0,
      margin: itemData.costPrice ? (parseFloat(itemData.sellingPrice) - parseFloat(itemData.costPrice)) / parseFloat(itemData.sellingPrice) * 100 : 0,
      taxRate: parseFloat(itemData.taxRate) || 0,
      
      // Supplier Information
      primarySupplier: itemData.primarySupplier || '',
      secondarySuppliers: itemData.secondarySuppliers || [],
      supplierPartNumber: itemData.supplierPartNumber || '',
      
      // Storage Information
      storageLocation: itemData.storageLocation || '',
      storageConditions: itemData.storageConditions || 'room temperature',
      storageNotes: itemData.storageNotes || '',
      expiryDate: itemData.expiryDate || '',
      
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
      totalPurchased: parseInt(itemData.initialStock) || 0,
      averageMonthlySales: 0,
      lastSaleDate: null,
      lastPurchaseDate: new Date().toISOString(),
      
      // Additional Data
      description: itemData.description || '',
      sideEffects: itemData.sideEffects || '',
      contraindications: itemData.contraindications || '',
      interactions: itemData.interactions || '',
      notes: itemData.notes || '',
      
      // Additional fields for search and compatibility
      brandNameLower: (itemData.brandName || '').toLowerCase(),
      genericNameLower: (itemData.genericName || '').toLowerCase(),
      pharmacistId: pharmacistId
    }
  }

  /**
   * Validate inventory item data
   */
  validateInventoryItem(itemData) {
    // Check if itemData is provided and is an object
    if (!itemData || typeof itemData !== 'object') {
      throw new Error('Invalid inventory item data: itemData is required and must be an object')
    }

    const required = ['brandName', 'genericName', 'strength', 'strengthUnit', 'initialStock', 'minimumStock', 'sellingPrice', 'expiryDate', 'storageConditions']
    const missing = required.filter(field => {
      const value = itemData[field]
      // Check if field is truly missing (undefined, null, empty string) but allow 0 as valid
      return value === undefined || value === null || value === ''
    })
    
    if (missing.length > 0) {
      throw new Error(`Missing required fields: ${missing.join(', ')}`)
    }
    
    if (parseInt(itemData.initialStock) < 0) {
      throw new Error('Initial stock cannot be negative')
    }
    
    // Only validate costPrice if it's provided
    if (itemData.costPrice !== undefined && itemData.costPrice !== null && itemData.costPrice !== '' && parseFloat(itemData.costPrice) < 0) {
      throw new Error('Cost price cannot be negative')
    }
    
    if (parseFloat(itemData.sellingPrice) < 0) {
      throw new Error('Selling price cannot be negative')
    }
  }

  /**
   * Check if a brand name + strength + strength unit + expiry date combination already exists for a pharmacist
   * This implements the primary key rule: Brand Name + Strength + Strength Unit + Expiry Date
   */
  async checkDuplicatePrimaryKey(pharmacistId, brandName, strength, strengthUnit, expiryDate, excludeId = null) {
    try {
      console.log('🔍 Checking for duplicate primary key:', { pharmacistId, brandName, strength, strengthUnit, expiryDate, excludeId })
      
      // Use simple query to avoid composite index requirements
      const stockRef = collection(db, this.collections.inventory)
      const q = query(stockRef, where('pharmacistId', '==', pharmacistId))
      
      const querySnapshot = await getDocs(q)
      const duplicates = []
      
      querySnapshot.forEach((doc) => {
        if (excludeId && doc.id === excludeId) {
          return // Skip the item being edited
        }
        
        const data = doc.data()
        // Check for duplicate using client-side filtering - composite key: brandName + strength + strengthUnit + expiryDate
        if (data.brandName === brandName && 
            data.strength === strength && 
            data.strengthUnit === strengthUnit &&
            data.expiryDate === expiryDate) {
          duplicates.push({
            id: doc.id,
            ...data
          })
        }
      })
      
      console.log('🔍 Duplicate check result:', duplicates.length, 'duplicates found')
      
      if (duplicates.length > 0) {
        const duplicateItem = duplicates[0]
        throw new Error(`A drug with brand name "${brandName}", strength "${strength} ${strengthUnit}", and expiry date "${expiryDate}" already exists. Each brand name + strength + unit + expiry combination must be unique.`)
      }
      
      return false // No duplicates found
    } catch (error) {
      console.error('❌ Error checking duplicate primary key:', error)
      throw error
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
