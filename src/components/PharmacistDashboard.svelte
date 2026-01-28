<script>
  import { onMount } from 'svelte'
  import { doc, updateDoc, getDoc, setDoc } from 'firebase/firestore'
  import { db } from '../firebase-config.js'
  import authService from '../services/authService.js'
  import pharmacistAuthService from '../services/pharmacist/pharmacistAuthService.js'
  import firebaseAuthService from '../services/firebaseAuth.js'
  import { createEventDispatcher } from 'svelte'
  import firebaseStorage from '../services/firebaseStorage.js'
  import { notifySuccess, notifyError } from '../stores/notifications.js'
  import chargeCalculationService from '../services/pharmacist/chargeCalculationService.js'
  import ConfirmationModal from './ConfirmationModal.svelte'
  import InventoryDashboard from './pharmacist/InventoryDashboard.svelte'
  import PharmacistSettings from './pharmacist/PharmacistSettings.svelte'
  import inventoryService from '../services/pharmacist/inventoryService.js'
  import { formatDoctorId, formatPrescriptionId, formatPharmacyId } from '../utils/idFormat.js'
  
  export let pharmacist
  let pharmacyId = null
  $: pharmacyId = pharmacist?.pharmacyId || pharmacist?.id || null
  
  let prescriptions = []
  let connectedDoctors = []
  let loading = true
  let selectedPrescription = null
  let showPrescriptionDetails = false
  
  // Individual medication dispatch tracking
  let dispensedMedications = new Set()
  let permanentlyDispensedMedications = new Set() // Track medications that have been permanently dispensed
  
  // Load permanently dispensed medications from localStorage on component mount
  onMount(() => {
    try {
      const stored = localStorage.getItem('permanentlyDispensedMedications')
      if (stored) {
        permanentlyDispensedMedications = new Set(JSON.parse(stored))
        console.log('📦 Loaded permanently dispensed medications from localStorage:', permanentlyDispensedMedications.size)
      }
    } catch (error) {
      console.error('❌ Error loading permanently dispensed medications:', error)
    }
  })

  let doctorOwnerProfile = null
  let displayCurrency = 'USD'

  const loadDoctorDeleteCode = async () => {
    try {
      if (!pharmacist?.email) return
      const doctorData = await firebaseStorage.getDoctorByEmail(pharmacist.email)
      isDoctorOwnedPharmacy = !!doctorData
      doctorOwnerProfile = doctorData || null
      doctorDeleteCode = doctorData?.deleteCode || ''
    } catch (error) {
      console.error('❌ Error loading doctor delete code:', error)
      doctorDeleteCode = ''
      isDoctorOwnedPharmacy = false
      doctorOwnerProfile = null
    }
  }

  $: if (pharmacist?.email) {
    loadDoctorDeleteCode()
  }

  $: displayCurrency = (isDoctorOwnedPharmacy ? doctorOwnerProfile?.currency : pharmacist?.currency) || pharmacist?.currency || 'USD'
  
  // Pagination for prescriptions
  let currentPrescriptionPage = 1
  let prescriptionsPerPage = 10
  
  let activeTab = 'prescriptions' // 'prescriptions' or 'inventory'
  
  // Charge calculation state
  let chargeBreakdown = null
  let calculatingCharges = false
  let chargeCalculationError = null
  let showProfileSettings = false
  let chargeRecalculationTimeout = null
  
  // Track editable amounts for each medication
  let editableAmounts = new Map() // prescriptionId-medicationId -> amount
  
  // Track inventory data for each medication
  let medicationInventoryData = {} // prescriptionId-medicationId -> inventoryData snapshot
  let medicationInventoryVersion = 0 // forces reactivity when inventory data changes
  let cachedInventoryItems = [] // pharmacist inventory snapshot used for matching
  let medicationAllocationPreviews = {} // prescriptionId-medicationId -> allocation preview data
  let allocationVersion = 0 // trigger reactivity for allocation previews
  
  let inventoryMigrationDone = false

  const migrateLegacyInventoryIfNeeded = async () => {
    if (!pharmacyId || inventoryMigrationDone) return
    const migrationKey = `prescribe-migrated-drugStock-${pharmacyId}`
    if (localStorage.getItem(migrationKey)) {
      inventoryMigrationDone = true
      return
    }

    try {
      const result = await inventoryService.migrateDrugStockToInventory(pharmacyId)
      localStorage.setItem(migrationKey, new Date().toISOString())
      inventoryMigrationDone = true
      if (result?.migrated) {
        console.log(`✅ Migrated ${result.migrated} legacy inventory items`)
      }
    } catch (error) {
      console.warn('⚠️ Inventory migration failed:', error)
    }
  }

  $: if (pharmacyId) {
    migrateLegacyInventoryIfNeeded()
  }

  // Initialize editable amounts and fetch inventory data when prescription is selected
  // Function to load prescription data when selected
  const loadPrescriptionData = async () => {
    if (!selectedPrescription) return
    if (!pharmacyId) {
      console.warn('⚠️ Pharmacist data not ready, skipping inventory load')
      return
    }
    
    console.log('🔄 Loading prescription data for:', selectedPrescription.id)
    console.log('📋 Prescription structure:', {
      prescriptions: selectedPrescription.prescriptions?.length,
      medications: selectedPrescription.prescriptions?.flatMap(p => p.medications?.length || 0)
    })
    
    // Reset cached state
    editableAmounts.clear()
    medicationInventoryData = {}
    medicationInventoryVersion += 1
    medicationAllocationPreviews = {}
    
    // Fetch pharmacist inventory once for matching
    cachedInventoryItems = await inventoryService.getInventoryItems(pharmacyId)
    console.log('📦 Retrieved inventory items for pharmacist:', cachedInventoryItems.length)

    // Process inventory mapping for each medication
    const fetchPromises = []
    
    selectedPrescription.prescriptions.forEach((prescription, presIndex) => {
      console.log(`📝 Processing prescription ${presIndex + 1}:`, prescription.id)
      if (prescription.medications) {
        prescription.medications.forEach((medication, medIndex) => {
          console.log(`💊 Processing medication ${medIndex + 1}:`, {
            id: medication.id,
            name: medication.name,
            genericName: medication.genericName
          })
          const key = `${prescription.id}-${medication.id || medication.name}`
          const calculatedAmount = calculateMedicationAmount(medication)
          editableAmounts.set(key, calculatedAmount)
          
          // Collect all fetch promises
          fetchPromises.push(fetchMedicationInventoryData(medication, key, cachedInventoryItems))
        })
      } else {
        console.log(`⚠️ Prescription ${presIndex + 1} has no medications`)
      }
    })
    
    console.log(`🚀 Starting ${fetchPromises.length} inventory fetch operations`)
    
    // Wait for all inventory data to be fetched
    await Promise.all(fetchPromises)
    console.log('🔑 Medication inventory keys after update:', Object.keys(medicationInventoryData))
    console.log('✅ All inventory data loaded')

    if (showPrescriptionDetails) {
      console.log('🔄 Recalculating charges after inventory load')
      await calculatePrescriptionCharges()
    }
  }
  
  // Watch for prescription or pharmacist changes
  $: if (selectedPrescription && pharmacyId) {
    loadPrescriptionData()
  }
  
  // Get editable amount for a medication
  const getEditableAmount = (prescriptionId, medication) => {
    const key = `${prescriptionId}-${medication.id || medication.name}`
    const storedAmount = editableAmounts.get(key)
    if (storedAmount !== undefined && storedAmount !== null && storedAmount !== '') {
      return storedAmount
    }
    const inventoryData = medicationInventoryData[key]
    if (inventoryData?.found) {
      const remaining = parseFloat(inventoryData.currentStock)
      if (Number.isFinite(remaining) && remaining > 0) {
        return remaining.toString()
      }
    }
    return calculateMedicationAmount(medication)
  }
  
  // Update editable amount
  const updateEditableAmount = (prescriptionId, medicationId, newAmount) => {
    const key = `${prescriptionId}-${medicationId}`
    editableAmounts.set(key, newAmount)
    editableAmounts = new Map(editableAmounts) // Trigger reactivity
    refreshAllocationPreview(prescriptionId, medicationId)
    scheduleChargeRecalculation()
  }
  
  // Fetch inventory data for a medication
  const fetchMedicationInventoryData = async (medication, key, inventoryItems = []) => {
    try {
      if (!pharmacyId) return
      
      const itemsToUse = Array.isArray(inventoryItems) && inventoryItems.length > 0
        ? inventoryItems
        : cachedInventoryItems
      
      console.log('📦 Matching medication against inventory set with', itemsToUse.length, 'items')
      
      // Find matching inventory items
      const matchingItems = findMatchingInventoryItems(medication, itemsToUse)
      console.log('📦 Matching results for', medication.name, matchingItems)
      
      if (matchingItems.length > 0) {
        console.log('✅ Found matching inventory items for:', medication.name, 'Key:', key, 'Matches:', matchingItems.length)

        const batchEntries = []

        const pushBatchEntry = (item, batch = null) => {
          const quantityRaw = batch ? (batch.quantity ?? batch.currentStock) : item.currentStock
          const quantity = parseFloat(quantityRaw)
          if (!Number.isFinite(quantity)) return

          batchEntries.push({
            id: batch?.id ? `${item.id}|${batch.id}` : item.id,
            inventoryItemId: item.id,
            batchId: batch?.id || null,
            batchNumber: batch?.batchNumber || '',
            currentStock: quantity,
            sellingPrice: (batch?.sellingPrice ?? item.sellingPrice),
            expiryDate: batch?.expiryDate ?? item.expiryDate,
            packUnit: batch?.packUnit ?? item.packUnit ?? item.unit ?? '',
            brandName: item.brandName,
            genericName: item.genericName
          })
        }

        for (const item of matchingItems) {
          let enrichedItem = item
          if ((!item.batches || item.batches.length === 0) && item.id) {
            try {
              const detailed = await inventoryService.getInventoryItemById(item.id)
              if (detailed) {
                enrichedItem = { ...item, ...detailed }
              }
            } catch (error) {
              console.error('❌ Error fetching detailed inventory item:', item.id, error)
            }
          }

          if (Array.isArray(enrichedItem.batches) && enrichedItem.batches.length > 0) {
            const activeBatches = enrichedItem.batches.filter(batch => (batch.status || 'active') === 'active')
            if (activeBatches.length > 0) {
              activeBatches.forEach(batch => pushBatchEntry(enrichedItem, batch))
              continue
            }
          }
          pushBatchEntry(enrichedItem)
        }

        const sortedEntries = batchEntries
          .map(entry => ({
            ...entry,
            expiryTime: entry.expiryDate ? new Date(entry.expiryDate).getTime() : Infinity
          }))
          .sort((a, b) => a.expiryTime - b.expiryTime)
          .map(({ expiryTime, ...rest }) => rest)

        const aggregatedStock = sortedEntries.reduce((sum, entry) => {
          return sum + (Number.isFinite(entry.currentStock) ? entry.currentStock : 0)
        }, 0)

        const earliestEntry = sortedEntries[0] || {}
        const effectiveEntries = earliestEntry.id ? [earliestEntry] : []
        const effectiveStock = Number.isFinite(earliestEntry.currentStock) ? earliestEntry.currentStock : aggregatedStock
        const earliestExpiry = earliestEntry.expiryDate || null
        const packUnit = earliestEntry.packUnit || ''

        medicationInventoryData = {
          ...medicationInventoryData,
          [key]: {
            expiryDate: earliestExpiry,
            currentStock: effectiveStock,
            packUnit,
            sellingPrice: earliestEntry.sellingPrice,
            brandName: earliestEntry.brandName,
            genericName: earliestEntry.genericName,
            inventoryItemId: earliestEntry.inventoryItemId || null,
            matches: effectiveEntries,
            found: true
          }
        }

        const existingAmountValue = editableAmounts.get(key)
        const existingNumeric = parseFloat(existingAmountValue)
        const requestedAmount = Number.isFinite(existingNumeric) && existingNumeric > 0 ? existingNumeric : effectiveStock

        const allocation = determineDefaultAllocationAmount(effectiveEntries, effectiveStock, requestedAmount)
        if (allocation !== null) {
          const shouldOverride = (
            existingAmountValue === undefined || existingAmountValue === null || existingAmountValue === '' ||
            (!Number.isFinite(existingNumeric)) || existingNumeric > effectiveStock
          )
          if (shouldOverride) {
            editableAmounts.set(key, allocation)
            editableAmounts = new Map(editableAmounts)
            refreshAllocationPreview(prescriptionIdFromKey(key), medicationIdFromKey(key))
          }
        }
        console.log('💾 Stored inventory data with key:', key, 'Data:', {
          expiryDate: earliestExpiry,
          currentStock: aggregatedStock,
          packUnit,
          found: true,
          matches: sortedEntries
        })
        refreshAllocationPreview(prescriptionIdFromKey(key), medicationIdFromKey(key), sortedEntries)
      } else {
        console.log('❌ No matching inventory item for:', medication.name, 'Key:', key)
        console.log('🔍 Available inventory items for comparison:', inventoryItems.map(item => ({
          brandName: item.brandName,
          genericName: item.genericName,
          expiryDate: item.expiryDate
        })))
        medicationInventoryData = {
          ...medicationInventoryData,
          [key]: {
            expiryDate: null,
            currentStock: 0,
            packUnit: '',
            sellingPrice: null,
            brandName: null,
            genericName: null,
            inventoryItemId: null,
            matches: [],
            found: false
          }
        }
        delete medicationAllocationPreviews[key]
      }
      
      medicationInventoryVersion += 1
    } catch (error) {
      console.error('Error fetching inventory data for medication:', medication.name, error)
      medicationInventoryData = {
        ...medicationInventoryData,
        [key]: {
          expiryDate: null,
          currentStock: 0,
          packUnit: '',
          sellingPrice: null,
          brandName: null,
          genericName: null,
          inventoryItemId: null,
          matches: [],
          found: false
        }
      }
      medicationInventoryVersion += 1
    }
  }
  
  // Normalize medication name for reliable comparisons
  const normalizeName = (value) => {
    return (value || '')
      .toLowerCase()
      .replace(/[\u3000\s]+/g, ' ') // collapse whitespace (including full-width space)
      .replace(/[\(\)（）]/g, '') // remove parentheses that often wrap generic names
      .trim()
  }
  
  const normalizeKeyPart = (value) => {
    return (value || '')
      .toString()
      .toLowerCase()
      .replace(/[\u3000\s]+/g, ' ')
      .replace(/[^\w\s]/g, '')
      .trim()
  }

  const parseStrengthParts = (value, fallbackUnit = '') => {
    if (!value) {
      return { strength: '', unit: fallbackUnit || '' }
    }

    if (typeof value === 'number') {
      return { strength: String(value), unit: fallbackUnit || '' }
    }

    const normalized = String(value).trim()
    const match = normalized.match(/^(\d+(?:\.\d+)?)([a-zA-Z%]+)?$/)
    if (match) {
      return { strength: match[1], unit: match[2] || fallbackUnit || '' }
    }

    return { strength: normalized, unit: fallbackUnit || '' }
  }

  const buildMedicationKey = (medication) => {
    if (!medication) return ''
    const dosageForm = medication.dosageForm || medication.form || ''
    const { strength, unit } = parseStrengthParts(
      medication.strength ?? medication.dosage,
      medication.strengthUnit ?? medication.dosageUnit ?? ''
    )

    const parts = [
      normalizeKeyPart(medication.name || ''),
      normalizeKeyPart(medication.genericName || ''),
      normalizeKeyPart(strength),
      normalizeKeyPart(unit),
      normalizeKeyPart(dosageForm)
    ].filter(Boolean)

    return parts.join('|')
  }

  const buildInventoryKey = (item) => {
    if (!item) return ''

    const dosageForm = item.dosageForm || item.packUnit || item.unit || ''
    const parts = [
      normalizeKeyPart(item.brandName || item.drugName || ''),
      normalizeKeyPart(item.genericName || ''),
      normalizeKeyPart(item.strength || ''),
      normalizeKeyPart(item.strengthUnit || ''),
      normalizeKeyPart(dosageForm)
    ].filter(Boolean)

    return parts.join('|')
  }

  const buildMedicationNameSet = (medication) => {
    const names = new Set()
    const medicationName = medication.name || ''
    const genericName = medication.genericName || ''

    // Raw values
    names.add(normalizeName(medicationName))
    names.add(normalizeName(genericName))

    // Extracted brand/generic parts from combined names like "Lexipro(Escitalopram)"
    const brandFromName = medicationName.split(/[\(（]/)[0]?.trim()
    const genericFromName = medicationName.includes('(') || medicationName.includes('（')
      ? medicationName.split(/[\(（]/)[1]?.replace(/[\)）]/, '').trim()
      : ''

    names.add(normalizeName(brandFromName))
    names.add(normalizeName(genericFromName))

    // Remove falsy/empty strings
    names.delete('')

    return names
  }

  const buildInventoryNameSet = (item) => {
    const names = new Set()

    const brandName = item.brandName || ''
    const genericName = item.genericName || ''
    const drugName = item.drugName || ''

    names.add(normalizeName(brandName))
    names.add(normalizeName(genericName))
    names.add(normalizeName(drugName))

    // Handle stored brand names that already contain generic names
    if (brandName) {
      names.add(normalizeName(brandName.split(/[\(（]/)[0]))
    }

    names.delete('')

    return names
  }

  // Find matching inventory items for a medication using flexible name matching
  const findMatchingInventoryItems = (medication, inventoryItems) => {
    if (!medication || !inventoryItems || inventoryItems.length === 0) {
      console.log('❌ No medication or inventory items:', { medication, inventoryItemsLength: inventoryItems?.length })
      return []
    }

    const medicationNames = buildMedicationNameSet(medication)
    const medicationKey = medication.medicationKey || buildMedicationKey(medication)
    console.log('🔍 Matching medication using names:', Array.from(medicationNames))

    const matches = []

    for (const item of inventoryItems) {
      const itemNames = buildInventoryNameSet(item)
      const itemKey = buildInventoryKey(item)
      const keyMatch = medicationKey && itemKey && medicationKey === itemKey

      const hasNameMatch = Array.from(medicationNames).some(medName => 
        Array.from(itemNames).some(invName => invName && (invName === medName || invName.includes(medName) || medName.includes(invName)))
      )

      const shouldMatchByName = !medicationKey

      if (keyMatch || (shouldMatchByName && hasNameMatch)) {
        console.log('✅ Found matching inventory item:', {
          medicationNames: Array.from(medicationNames),
          medicationKey,
          inventoryKey: itemKey,
          inventoryNames: Array.from(itemNames),
          expiryDate: item.expiryDate
        })
        matches.push(item)
      }
    }

    if (matches.length === 0) {
      console.log('❌ No match found. Inventory items:', inventoryItems.map(item => ({
        brandName: item.brandName,
        genericName: item.genericName,
        drugName: item.drugName,
        expiryDate: item.expiryDate
      })))
    }
    
    return matches.sort((a, b) => {
      const dateA = a.expiryDate ? new Date(a.expiryDate).getTime() : Infinity
      const dateB = b.expiryDate ? new Date(b.expiryDate).getTime() : Infinity
      return dateA - dateB
    })
  }

  const determineDefaultAllocationAmount = (matchingItems, aggregatedStock, requestedAmount) => {
    if (!matchingItems || matchingItems.length === 0) return null

    const sortedByExpiry = matchingItems
      .map(item => ({
        item,
        expiry: item.expiryDate ? new Date(item.expiryDate).getTime() : Infinity
      }))
      .sort((a, b) => a.expiry - b.expiry)

    for (const { item } of sortedByExpiry) {
      const stock = parseFloat(item.currentStock)
      if (Number.isFinite(stock) && stock > 0) {
        const target = Number.isFinite(requestedAmount) && requestedAmount > 0 ? requestedAmount : aggregatedStock
        const capped = Number.isFinite(target) ? Math.min(stock, target) : stock
        return capped.toString()
      }
    }

    const fallback = Number.isFinite(requestedAmount) && requestedAmount > 0
      ? Math.min(requestedAmount, aggregatedStock)
      : aggregatedStock
    return Number.isFinite(fallback) && fallback > 0 ? fallback.toString() : null
  }

  const getInventoryMatches = (prescriptionId, medicationId) => {
    const key = `${prescriptionId}-${medicationId}`
    return medicationInventoryData[key]?.matches || []
  }

  const prescriptionIdFromKey = (key) => key.split('-')[0]
  const medicationIdFromKey = (key) => key.substring(key.indexOf('-') + 1)

  const refreshAllocationPreview = (prescriptionId, medicationId, matchesOverride = null) => {
    const key = `${prescriptionId}-${medicationId}`
    const matches = matchesOverride || getInventoryMatches(prescriptionId, medicationId)
    if (!matches || matches.length === 0) {
      delete medicationAllocationPreviews[key]
      allocationVersion += 1
      return
    }

    const matcher = matches
      .map(match => ({
        ...match,
        available: parseFloat(match.currentStock) || 0,
        expiryTime: match.expiryDate ? new Date(match.expiryDate).getTime() : Infinity
      }))
      .sort((a, b) => a.expiryTime - b.expiryTime)

    const requestedValue = parseFloat(editableAmounts.get(key))
    const requested = Number.isFinite(requestedValue) && requestedValue > 0 ? requestedValue : 0
    let remaining = requested

    const allocations = matcher.map(match => {
      const quantity = remaining > 0 ? Math.min(remaining, Math.max(match.available, 0)) : 0
      remaining = Math.max(remaining - quantity, 0)
      return {
        ...match,
        allocated: quantity
      }
    })

    medicationAllocationPreviews = {
      ...medicationAllocationPreviews,
      [key]: {
        orderedMatches: allocations,
        requested,
        remaining
      }
    }
    allocationVersion += 1
  }

  const getAllocationPreview = (prescriptionId, medication) => {
    const key = `${prescriptionId}-${medication.id || medication.name}`
    return medicationAllocationPreviews[key] || { orderedMatches: [], requested: 0, remaining: 0 }
  }

  $: if (showPrescriptionDetails && selectedPrescription) {
    // Recalculate charges when amounts, inventory, or dispensed selection changes
    editableAmounts
    dispensedMedications
    medicationInventoryVersion
    scheduleChargeRecalculation()
  }
  
  // Get inventory data for a medication
  const getMedicationInventoryData = (prescriptionId, medicationId, version) => {
    const key = `${prescriptionId}-${medicationId}`
    const data = medicationInventoryData[key] || {
      expiryDate: null,
      currentStock: 0,
      packUnit: '',
      sellingPrice: null,
      brandName: null,
      genericName: null,
      inventoryItemId: null,
      matches: [],
      found: false
    }
    
    console.log('🔍 Getting inventory data for:', medicationId, 'Key:', key, 'Data:', data, 'version:', version)
    console.log('🔍 Available keys in medicationInventoryData:', Object.keys(medicationInventoryData))
    return data
  }
  
  // Confirmation modal state
  let showConfirmationModal = false
  let confirmationConfig = {
    title: 'Confirm Action',
    message: 'Are you sure you want to proceed?',
    confirmText: 'Confirm',
    cancelText: 'Cancel',
    type: 'warning',
    requireCode: false
  }
  let pendingAction = null
  let doctorDeleteCode = ''
  let isDoctorOwnedPharmacy = false
  
  // Confirmation modal helper functions
  function showConfirmation(title, message, confirmText = 'Confirm', cancelText = 'Cancel', type = 'warning') {
    const normalizedConfirm = String(confirmText || '').toLowerCase()
    const isDestructive = type === 'danger' && /delete|clear|remove/.test(normalizedConfirm)
    confirmationConfig = { title, message, confirmText, cancelText, type, requireCode: isDestructive && isDoctorOwnedPharmacy }
    showConfirmationModal = true
  }
  
  function handleConfirmationConfirm() {
    console.log('🔍 handleConfirmationConfirm called')
    console.log('🔍 pendingAction:', pendingAction)
    if (pendingAction) {
      console.log('🔍 Executing pending action')
      pendingAction()
      pendingAction = null
    }
    showConfirmationModal = false
  }
  
  function handleConfirmationCancel() {
    pendingAction = null
    showConfirmationModal = false
  }
  
  // Individual medication dispatch functions
  function toggleMedicationDispatch(prescriptionId, medicationId) {
    // Don't allow toggling if medication is already dispensed
    if (isMedicationAlreadyDispensed(prescriptionId, medicationId)) {
      return
    }

    const key = `${prescriptionId}-${medicationId}`
    if (dispensedMedications.has(key)) {
      dispensedMedications.delete(key)
    } else {
      dispensedMedications.add(key)
    }
    dispensedMedications = new Set(dispensedMedications) // Trigger reactivity

    // Recalculate charges when medication selection changes
    scheduleChargeRecalculation()
  }
  
  function isMedicationDispensed(prescriptionId, medicationId) {
    const key = `${prescriptionId}-${medicationId}`
    return dispensedMedications.has(key)
  }
  
  function isMedicationAlreadyDispensed(prescriptionId, medicationId) {
    const key = `${prescriptionId}-${medicationId}`
    
    // Check if it's in the current session's dispensed medications
    if (dispensedMedications.has(key)) {
      return true
    }
    
    // Check if it's in the permanently dispensed medications
    if (permanentlyDispensedMedications.has(key)) {
      return true
    }
    
    return false
  }
  
  function getDispensedCount() {
    return dispensedMedications.size
  }
  
  function markSelectedAsDispensed() {
    console.log('🔍 markSelectedAsDispensed called')
    console.log('🔍 dispensedMedications.size:', dispensedMedications.size)
    console.log('🔍 selectedPrescription:', selectedPrescription)
    
    const totalMedications = selectedPrescription.prescriptions.reduce((count, prescription) => {
      return count + (prescription.medications ? prescription.medications.length : 0)
    }, 0)
    
    console.log('🔍 totalMedications:', totalMedications)
    
    if (dispensedMedications.size === 0) {
      console.log('⚠️ No medications selected')
      notifyError('⚠️ No medications selected! Please check the boxes next to the medications you want to mark as dispensed.')
      return
    }
    
    if (dispensedMedications.size === totalMedications) {
      console.log('🔍 Showing confirmation for all medications')
      showConfirmation(
        'Mark All as Dispensed',
        `Are you sure you want to mark all ${totalMedications} medications as dispensed? This will reduce inventory stock.`,
        'Mark as Dispensed',
        'Cancel',
        'success'
      )
      pendingAction = () => {
        console.log('🔍 Pending action set to handleDispensedMedications')
        handleDispensedMedications()
      }
    } else {
      console.log('🔍 Showing confirmation for selected medications')
      showConfirmation(
        'Mark Selected as Dispensed',
        `Are you sure you want to mark ${dispensedMedications.size} of ${totalMedications} medications as dispensed? This will reduce inventory stock.`,
        'Mark as Dispensed',
        'Cancel',
        'warning'
      )
      pendingAction = () => {
        console.log('🔍 Pending action set to handleDispensedMedications')
        handleDispensedMedications()
      }
    }
  }
  
  // Handle the actual dispensing and inventory reduction
  async function handleDispensedMedications() {
    console.log('🔍 handleDispensedMedications called')
    console.log('🔍 pharmacist:', pharmacist)
    console.log('🔍 dispensedMedications:', dispensedMedications)
    
    try {
      if (!pharmacyId) {
        console.log('❌ No pharmacy ID available')
        notifyError('Pharmacist information not available')
        return
      }
      
      console.log('✅ Pharmacy ID available:', pharmacyId)
      
      let inventoryReductions = []
      let inventoryErrors = []
      
      // Process each dispensed medication
      for (const dispensedKey of dispensedMedications) {
        const [prescriptionId, medicationId] = dispensedKey.split('-')
        
        // Find the medication details
        let medication = null
        for (const prescription of selectedPrescription.prescriptions) {
          if (prescription.id === prescriptionId) {
            medication = prescription.medications?.find(med => 
              (med.id || med.name) === medicationId
            )
            if (medication) break
          }
        }
        
        if (!medication) {
          console.warn('Medication not found:', medicationId)
          continue
        }
        
        try {
          // Find the inventory item by drug name
          const inventoryItems = await inventoryService.getInventoryItems(pharmacyId)
          console.log('🔍 Available inventory items:', inventoryItems.map(item => ({
            id: item.id,
            drugName: item.drugName,
            genericName: item.genericName,
            brandName: item.brandName
          })))
          
          const medicationName = String(medication?.name || '').toLowerCase()
          let inventoryItem = inventoryItems.find(item => 
            String(item.drugName || '').toLowerCase() === medicationName ||
            String(item.genericName || '').toLowerCase() === medicationName ||
            String(item.brandName || '').toLowerCase() === medicationName
          )
          
          // Verify the inventory item exists and has a valid ID
          if (inventoryItem && inventoryItem.id) {
            try {
              // Test if the document actually exists by trying to get it
              const itemRef = doc(db, 'pharmacistInventory', inventoryItem.id)
              const itemDoc = await getDoc(itemRef)
              if (!itemDoc.exists()) {
                console.warn(`⚠️ Inventory item ${inventoryItem.id} not found in database, will create new one`)
                inventoryItem = null // Force creation of new item
              } else {
                console.log(`✅ Inventory item ${inventoryItem.id} verified and exists`)
              }
            } catch (error) {
              console.warn(`⚠️ Error verifying inventory item ${inventoryItem.id}:`, error)
              inventoryItem = null // Force creation of new item
            }
          } else {
            console.log(`⚠️ No inventory item found for ${medication.name}`)
          }
          
          if (inventoryItem) {
            // Calculate quantity to reduce (default to 1 if not specified)
            let quantity = medication.quantity || medication.dosage || 1
            // Ensure quantity is a valid number
            quantity = parseInt(quantity) || 1
            console.log(`🔍 Using quantity: ${quantity} for ${medication.name}`)
            
            console.log('🔍 Inventory item found:', {
              id: inventoryItem.id,
              drugName: inventoryItem.drugName,
              currentStock: inventoryItem.currentStock
            })
            
            // Verify the document exists before trying to update
            try {
              // Create stock movement for dispatch
              await inventoryService.createStockMovement(pharmacyId, {
                itemId: inventoryItem.id, // This should be the Firestore document ID
                type: 'dispatch', // Using 'dispatch' for dispensed medications
                quantity: -Math.abs(quantity), // Negative quantity for reduction
                unitCost: inventoryItem.costPrice || 0,
                reference: 'prescription_dispatch',
                referenceId: prescriptionId,
                notes: `Dispensed for prescription ${prescriptionId} - ${medication.name}`,
                batchNumber: '',
                expiryDate: ''
              })
              
              inventoryReductions.push({
                drugName: medication.name,
                quantity: quantity,
                inventoryItem: inventoryItem.drugName
              })
              
              console.log(`✅ Reduced inventory for ${medication.name}: -${quantity}`)
            } catch (inventoryError) {
              console.error(`❌ Failed to update inventory for ${medication.name}:`, inventoryError)
              inventoryErrors.push({
                drugName: medication.name,
                error: `Inventory update failed: ${inventoryError.message}`
              })
            }
          } else {
            // Try to create a basic inventory item for this medication
            console.log(`⚠️ Inventory item not found for: ${medication.name}, attempting to create basic record`)
            try {
              const newInventoryItem = await inventoryService.createInventoryItem(pharmacyId, {
                drugName: medication.name,
                genericName: medication.name,
                brandName: medication.name,
                manufacturer: 'Unknown',
                category: 'prescription',
                strength: medication.dosage || 'Unknown',
                strengthUnit: 'mg',
                dosageForm: 'tablet',
                packSize: '1',
                packUnit: 'box',
                initialStock: 0, // Start with 0 stock
                minimumStock: 10,
                maximumStock: 1000,
                costPrice: 0,
                sellingPrice: 0,
                storageLocation: 'Main Storage',
                storageConditions: 'room_temperature',
                expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                description: `Auto-created for dispensed medication: ${medication.name}`
              })
              
              console.log(`✅ Created basic inventory item for ${medication.name}:`, newInventoryItem.id)
              
              // Calculate quantity for tracking
              let quantity = medication.quantity || medication.dosage || 1
              quantity = parseInt(quantity) || 1
              
              // Try to create stock movement, but don't fail if inventory item doesn't exist
              try {
                await inventoryService.createStockMovement(pharmacyId, {
                  itemId: newInventoryItem.id,
                  type: 'dispatch',
                  quantity: -Math.abs(quantity),
                  unitCost: 0,
                  reference: 'prescription_dispatch',
                  referenceId: prescriptionId,
                  notes: `Dispensed for prescription ${prescriptionId} - ${medication.name} (auto-created inventory)`,
                  batchNumber: '',
                  expiryDate: ''
                })
                
                inventoryReductions.push({
                  drugName: medication.name,
                  quantity: quantity,
                  inventoryItem: 'Auto-created'
                })
                
                console.log(`✅ Created inventory item and reduced stock for ${medication.name}: -${quantity}`)
                
              } catch (stockMovementError) {
                console.warn(`⚠️ Could not create stock movement for ${medication.name}, but continuing with dispensing:`, stockMovementError.message)
                
                // Still track the dispensing even if inventory update fails
                inventoryReductions.push({
                  drugName: medication.name,
                  quantity: quantity,
                  inventoryItem: 'Auto-created (inventory tracking failed)'
                })
                
                inventoryErrors.push({
                  drugName: medication.name,
                  error: `Inventory item created but stock movement failed: ${stockMovementError.message}`
                })
              }
              
            } catch (createError) {
              console.error(`❌ Failed to create inventory item for ${medication.name}:`, createError)
              
              // Still track the dispensing even if inventory creation fails
              let quantity = medication.quantity || medication.dosage || 1
              quantity = parseInt(quantity) || 1
              
              inventoryReductions.push({
                drugName: medication.name,
                quantity: quantity,
                inventoryItem: 'Inventory creation failed'
              })
              
              inventoryErrors.push({
                drugName: medication.name,
                error: `Could not create inventory item: ${createError.message}`
              })
            }
          }
        } catch (error) {
          inventoryErrors.push({
            drugName: medication.name,
            error: error.message
          })
          console.error(`❌ Error reducing inventory for ${medication.name}:`, error)
          
          // Continue with dispensing even if inventory update fails
          // This ensures the prescription can still be marked as dispensed
          console.log(`⚠️ Continuing with dispensing ${medication.name} despite inventory error`)
          
          // Add to dispensed medications even if inventory failed
          let fallbackQuantity = medication.quantity || medication.dosage || 1
          fallbackQuantity = parseInt(fallbackQuantity) || 1
          inventoryReductions.push({
            drugName: medication.name,
            quantity: fallbackQuantity,
            inventoryItem: 'Inventory tracking failed'
          })
        }
      }
      
      // Show results
      if (inventoryReductions.length > 0) {
        const reductionSummary = inventoryReductions.map(r => 
          `${r.drugName} (-${r.quantity})`
        ).join(', ')
        
        notifySuccess(
          `✅ Marked ${dispensedMedications.size} medications as dispensed. ` +
          `Inventory reduced: ${reductionSummary}`
        )
      }
      
      if (inventoryErrors.length > 0) {
        const errorSummary = inventoryErrors.map(e => 
          `${e.drugName}: ${e.error}`
        ).join(', ')
        
        notifyError(
          `⚠️ Some medications couldn't be reduced from inventory: ${errorSummary}`
        )
      }
      
      // Mark prescription as dispensed in pharmacist records
      try {
        await markPrescriptionAsDispensed()
        console.log('✅ Prescription marked as dispensed in pharmacist records')
        if (selectedPrescription) {
          selectedPrescription.status = 'dispensed'
          selectedPrescription.dispensedAt = new Date().toISOString()
        }
        prescriptions = prescriptions.map((entry) =>
          entry.id === selectedPrescription?.id
            ? { ...entry, status: 'dispensed', dispensedAt: selectedPrescription?.dispensedAt }
            : entry
        )
      } catch (error) {
        console.error('❌ Error marking prescription as dispensed:', error)
        notifyError('Prescription dispensed but failed to update records: ' + error.message)
      }
      
      // Add dispensed medications to permanently dispensed set
      for (const dispensedKey of dispensedMedications) {
        permanentlyDispensedMedications.add(dispensedKey)
      }
      permanentlyDispensedMedications = new Set(permanentlyDispensedMedications) // Trigger reactivity
      
      // Save to localStorage for persistence across page refreshes
      try {
        localStorage.setItem('permanentlyDispensedMedications', JSON.stringify(Array.from(permanentlyDispensedMedications)))
        console.log('💾 Saved permanently dispensed medications to localStorage:', permanentlyDispensedMedications.size)
      } catch (error) {
        console.error('❌ Error saving permanently dispensed medications to localStorage:', error)
      }
      
      // Clear dispensed medications and close modal
      dispensedMedications.clear()
      dispensedMedications = new Set(dispensedMedications)
      closePrescriptionDetails()
      
    } catch (error) {
      console.error('❌ Error handling dispensed medications:', error)
      notifyError('Error processing dispensed medications: ' + error.message)
    }
  }
  
  // Mark prescription as dispensed in pharmacist records
  async function markPrescriptionAsDispensed() {
    try {
      if (!selectedPrescription || !pharmacyId) {
        throw new Error('Missing prescription or pharmacist data')
      }
      
      console.log('🔍 Attempting to mark prescription as dispensed:', {
        prescriptionId: selectedPrescription.id,
        pharmacistId: pharmacyId,
        dispensedMedications: Array.from(dispensedMedications)
      })
      
      // First, check if the prescription document exists
      const prescriptionRef = doc(db, 'pharmacistPrescriptions', selectedPrescription.id)
      const prescriptionDoc = await getDoc(prescriptionRef)
      
      if (!prescriptionDoc.exists()) {
        console.warn('⚠️ Prescription document does not exist, creating new record')
        
        // Create a new prescription record with all fields properly defined
        const newPrescriptionData = {
          id: selectedPrescription.id || '',
          pharmacistId: pharmacyId || '',
          doctorId: selectedPrescription.doctorId || '',
          patientId: selectedPrescription.patientId || '',
          patientName: selectedPrescription.patientName || 'Unknown Patient',
          patientEmail: selectedPrescription.patientEmail || '',
          doctorName: selectedPrescription.doctorName || 'Unknown Doctor',
          prescriptions: selectedPrescription.prescriptions || [],
          status: 'dispensed',
          dispensedAt: new Date().toISOString(),
          dispensedBy: pharmacist.id || '',
          dispensedMedications: Array.from(dispensedMedications).map(key => {
            const [prescriptionId, medicationId] = key.split('-')
            return { prescriptionId: prescriptionId || '', medicationId: medicationId || '', isDispensed: true }
          }),
          receivedAt: selectedPrescription.receivedAt || new Date().toISOString(),
          notes: selectedPrescription.notes || '',
          sentAt: selectedPrescription.sentAt || new Date().toISOString(),
          createdAt: new Date().toISOString()
        }
        
        await setDoc(prescriptionRef, newPrescriptionData)
        console.log('✅ Created new prescription record and marked as dispensed')
      } else {
        // Update existing prescription
        await updateDoc(prescriptionRef, {
          status: 'dispensed',
          dispensedAt: new Date().toISOString(),
          dispensedBy: pharmacist.id,
          dispensedMedications: Array.from(dispensedMedications).map(key => {
            const [prescriptionId, medicationId] = key.split('-')
            return { prescriptionId, medicationId, isDispensed: true }
          })
        })
        console.log('✅ Updated existing prescription record as dispensed')
      }
      
    } catch (error) {
      console.error('❌ Error marking prescription as dispensed:', error)
      throw error
    }
  }
  
  // Load pharmacist data
  const loadPharmacistData = async () => {
    try {
      loading = true
      
      console.log('🔍 PharmacistDashboard: Starting loadPharmacistData')
      console.log('🔍 PharmacistDashboard: pharmacist object:', pharmacist)
      console.log('🔍 PharmacistDashboard: pharmacyId:', pharmacyId)
      console.log('🔍 PharmacistDashboard: pharmacist.connectedDoctors:', pharmacist?.connectedDoctors)
      
      // Check if pharmacist data is valid
      if (!pharmacyId) {
        console.error('❌ PharmacistDashboard: Invalid pharmacist data - missing ID')
        notifyError('Invalid pharmacist data. Please log in again.')
        return
      }
      
      // Get prescriptions from connected doctors using Firebase
      prescriptions = await firebaseStorage.getPharmacistPrescriptions(pharmacyId)
      
      console.log('🔍 PharmacistDashboard: Loaded prescriptions:', prescriptions.length)
      console.log('🔍 PharmacistDashboard: Prescription data:', prescriptions)
      
      // Count total prescriptions across all prescription objects
      let totalPrescriptions = 0
      prescriptions.forEach(prescription => {
        if (prescription.prescriptions && Array.isArray(prescription.prescriptions)) {
          totalPrescriptions += prescription.prescriptions.length
          console.log(`🔍 Prescription ${prescription.id} has ${prescription.prescriptions.length} sub-prescriptions`)
        } else {
          totalPrescriptions += 1
          console.log(`🔍 Prescription ${prescription.id} is a single prescription`)
        }
      })
      console.log('🔍 Total prescriptions count:', totalPrescriptions)
      
      // Load connected doctors info from Firebase
      connectedDoctors = []
      if (pharmacist.connectedDoctors && Array.isArray(pharmacist.connectedDoctors)) {
        for (const doctorId of pharmacist.connectedDoctors) {
          const doctor = await firebaseStorage.getDoctorById(doctorId)
          if (doctor) {
            connectedDoctors.push(doctor)
          }
        }
      } else {
        console.log('🔍 PharmacistDashboard: No connected doctors found or connectedDoctors is not an array')
      }
      
      // Sort prescriptions by date (newest first)
      prescriptions.sort((a, b) => getPrescriptionDateTime(b) - getPrescriptionDateTime(a))
      
      console.log('✅ PharmacistDashboard: Data loaded successfully')
      
    } catch (error) {
      console.error('❌ PharmacistDashboard: Error loading pharmacist data:', error)
      console.error('❌ PharmacistDashboard: Error stack:', error.stack)
      notifyError('Failed to load prescriptions: ' + error.message)
    } finally {
      loading = false
    }
  }
  
  // View prescription details
  const viewPrescription = (prescription) => {
    selectedPrescription = prescription
    showPrescriptionDetails = true
  }
  
  // Close prescription details
  const closePrescriptionDetails = () => {
    if (chargeRecalculationTimeout) {
      clearTimeout(chargeRecalculationTimeout)
      chargeRecalculationTimeout = null
    }
    showPrescriptionDetails = false
    selectedPrescription = null
    dispensedMedications.clear()
    dispensedMedications = new Set(dispensedMedications)
  }

  // Pagination calculations for prescriptions
  $: totalPrescriptionPages = Math.ceil(prescriptions.length / prescriptionsPerPage)
  $: prescriptionStartIndex = (currentPrescriptionPage - 1) * prescriptionsPerPage
  $: prescriptionEndIndex = prescriptionStartIndex + prescriptionsPerPage
  $: paginatedPrescriptions = prescriptions.slice(prescriptionStartIndex, prescriptionEndIndex)
  
  // Reset to first page when prescriptions change
  $: if (prescriptions.length > 0) {
    currentPrescriptionPage = 1
  }
  
  // Automatically calculate charges when a prescription is selected
  $: if (selectedPrescription && pharmacist && showPrescriptionDetails) {
    calculatePrescriptionCharges()
  }
  
  // Pagination functions for prescriptions
  const goToPrescriptionPage = (page) => {
    if (page >= 1 && page <= totalPrescriptionPages) {
      currentPrescriptionPage = page
    }
  }
  
  const goToPreviousPrescriptionPage = () => {
    if (currentPrescriptionPage > 1) {
      currentPrescriptionPage--
    }
  }
  
  const goToNextPrescriptionPage = () => {
    if (currentPrescriptionPage < totalPrescriptionPages) {
      currentPrescriptionPage++
    }
  }

  // Clear all prescriptions (for testing/cleanup)
  const clearAllPrescriptions = async () => {
    pendingAction = async () => {
      try {
        await firebaseStorage.clearPharmacistPrescriptions(pharmacyId)
        notifySuccess('All prescriptions cleared successfully')
        // Reload the data
        await loadPharmacistData()
      } catch (error) {
        console.error('Error clearing prescriptions:', error)
        notifyError('Failed to clear prescriptions')
      }
    }
    
    showConfirmation(
      'Clear All Prescriptions',
      'Are you sure you want to clear all prescriptions? This action cannot be undone.',
      'Clear All',
      'Cancel',
      'danger'
    )
  }
  
  const toDate = (value) => {
    if (!value) return null
    if (value instanceof Date) return value
    if (typeof value === 'string' || typeof value === 'number') {
      const parsed = new Date(value)
      return isNaN(parsed) ? null : parsed
    }
    if (typeof value === 'object') {
      if (typeof value.toDate === 'function') {
        const parsed = value.toDate()
        return isNaN(parsed) ? null : parsed
      }
      if (typeof value.seconds === 'number') {
        const parsed = new Date(value.seconds * 1000)
        return isNaN(parsed) ? null : parsed
      }
    }
    return null
  }

  const countryTimeZoneMap = {
    'Sri Lanka': 'Asia/Colombo',
    'India': 'Asia/Kolkata',
    'United States': 'America/New_York',
    'United States of America': 'America/New_York',
    'USA': 'America/New_York',
    'United Kingdom': 'Europe/London',
    'Ireland': 'Europe/Dublin',
    'Australia': 'Australia/Sydney',
    'Canada': 'America/Toronto',
    'New Zealand': 'Pacific/Auckland',
    'Singapore': 'Asia/Singapore',
    'Malaysia': 'Asia/Kuala_Lumpur',
    'United Arab Emirates': 'Asia/Dubai',
    'Saudi Arabia': 'Asia/Riyadh',
    'Qatar': 'Asia/Qatar',
    'Kuwait': 'Asia/Kuwait',
    'Bahrain': 'Asia/Bahrain',
    'Pakistan': 'Asia/Karachi',
    'Bangladesh': 'Asia/Dhaka',
    'Nepal': 'Asia/Kathmandu'
  }

  const getDoctorTimeZone = (prescription) => {
    const doctorId = prescription?.doctorId
    if (!doctorId || !connectedDoctors?.length) return null
    const doctor = connectedDoctors.find(d => d.id === doctorId)
    const countryName = doctor?.country || doctor?.countryName || ''
    return countryTimeZoneMap[countryName] || null
  }

  const resolvePrescriptionDate = (prescription) => {
    const nested = Array.isArray(prescription?.prescriptions) && prescription.prescriptions.length > 0
      ? prescription.prescriptions[0]
      : null
    return prescription?.sentAt ||
      prescription?.receivedAt ||
      nested?.sentAt ||
      nested?.createdAt ||
      prescription?.createdAt ||
      prescription?.dateCreated ||
      null
  }

  const getPrescriptionDateTime = (prescription) => {
    const dateValue = resolvePrescriptionDate(prescription)
    const parsed = toDate(dateValue)
    return parsed ? parsed.getTime() : 0
  }

  // Format date
  const formatDate = (dateValue, timeZone = null) => {
    const parsed = toDate(dateValue)
    if (!parsed) return 'Unknown'
    return parsed.toLocaleDateString('en-GB', {
      timeZone: timeZone || undefined,
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
  }

  const formatTime = (dateValue, timeZone = null) => {
    const parsed = toDate(dateValue)
    if (!parsed) return ''
    return parsed.toLocaleTimeString('en-GB', {
      timeZone: timeZone || undefined,
      hour: '2-digit',
      minute: '2-digit'
    })
  }
  
  // Get doctor name by ID
  const getDoctorName = (doctorId) => {
    const doctor = connectedDoctors.find(d => d.id === doctorId)
    return doctor ? (doctor.name || `${doctor.firstName} ${doctor.lastName}` || doctor.email) : 'Unknown Doctor'
  }

  // Calculate total amount based on frequency and duration
  const calculateMedicationAmount = (medication) => {
    console.log('🧮 Calculating amount for medication:', medication)
    if (medication.amount !== undefined && medication.amount !== null && medication.amount !== '') {
      return medication.amount
    }

    if (!medication.frequency || !medication.duration) {
      return 'N/A'
    }

    // Extract duration in days
    const durationMatch = medication.duration.match(/(\d+)\s*days?/i)
    if (!durationMatch) {
      return 'N/A'
    }
    const days = parseInt(durationMatch[1])

    // Calculate daily frequency based on frequency string
    let dailyFrequency = 0
    
    if (medication.frequency.includes('Once daily') || medication.frequency.includes('(OD)')) {
      dailyFrequency = 1
    } else if (medication.frequency.includes('Twice daily') || medication.frequency.includes('(BD)')) {
      dailyFrequency = 2
    } else if (medication.frequency.includes('Three times daily') || medication.frequency.includes('(TDS)')) {
      dailyFrequency = 3
    } else if (medication.frequency.includes('Four times daily') || medication.frequency.includes('(QDS)')) {
      dailyFrequency = 4
    } else if (medication.frequency.includes('Every 4 hours') || medication.frequency.includes('(Q4H)')) {
      dailyFrequency = 6 // 24/4 = 6 times per day
    } else if (medication.frequency.includes('Every 6 hours') || medication.frequency.includes('(Q6H)')) {
      dailyFrequency = 4 // 24/6 = 4 times per day
    } else if (medication.frequency.includes('Every 8 hours') || medication.frequency.includes('(Q8H)')) {
      dailyFrequency = 3 // 24/8 = 3 times per day
    } else if (medication.frequency.includes('Every 12 hours') || medication.frequency.includes('(Q12H)')) {
      dailyFrequency = 2 // 24/12 = 2 times per day
    } else if (medication.frequency.includes('As needed') || medication.frequency.includes('(PRN)')) {
      // For PRN medications, use the prnAmount directly if available, otherwise show "As needed"
      return medication.prnAmount ? `${medication.prnAmount}` : 'As needed'
    } else if (medication.frequency.includes('Weekly')) {
      dailyFrequency = 1/7 // Once per week = 1/7 per day
    } else if (medication.frequency.includes('Monthly')) {
      dailyFrequency = 1/30 // Once per month = 1/30 per day
    } else if (medication.frequency.includes('Before meals') || medication.frequency.includes('(AC)')) {
      dailyFrequency = 3 // Assuming 3 meals per day
    } else if (medication.frequency.includes('After meals') || medication.frequency.includes('(PC)')) {
      dailyFrequency = 3 // Assuming 3 meals per day
    } else if (medication.frequency.includes('At bedtime') || medication.frequency.includes('(HS)')) {
      dailyFrequency = 1
    }

    // Calculate total amount
    const totalAmount = Math.ceil(dailyFrequency * days)
    
    return totalAmount > 0 ? `${totalAmount}` : 'N/A'
  }
  
  // Handle profile settings
  const handleProfileSettings = () => {
    showProfileSettings = true
  }
  
  // Handle profile update
  const handleProfileUpdate = (updatedPharmacist) => {
    pharmacist = updatedPharmacist
    showProfileSettings = false
    notifySuccess('Profile updated successfully!')
  }
  
  // Handle back to dashboard
  const handleBackToDashboard = () => {
    showProfileSettings = false
  }

  const dispatch = createEventDispatcher()

  // Sign out
  const handleSignOut = async () => {
    try {
      await pharmacistAuthService.signOutPharmacist()
      await firebaseAuthService.signOut()
      await authService.signOut()
      notifySuccess('Signed out successfully')
      dispatch('logout')
      // Redirect will be handled by parent component
    } catch (error) {
      notifyError('Sign out failed')
    }
  }
  
  
  // Charge calculation functions
  const buildPrescriptionWithEditableAmounts = () => {
    if (!selectedPrescription) return null

    const transformMedications = (prescriptionId, medications = []) => {
      return (medications || []).map(medication => {
        const key = `${prescriptionId}-${medication.id || medication.name}`
        const override = editableAmounts.get(key)
        const amountValue = (override !== undefined && override !== null && override !== '')
          ? override
          : medication.amount

        const inventoryData = medicationInventoryData[key]

        // Check if medication is selected/dispensed
        const isDispensed = dispensedMedications.has(key) || permanentlyDispensedMedications.has(key)

        return {
          ...medication,
          amount: amountValue,
          isDispensed: isDispensed, // Add dispensed status
          inventoryMatch: inventoryData ? {
            found: inventoryData.found,
            sellingPrice: inventoryData.sellingPrice,
            brandName: inventoryData.brandName,
            genericName: inventoryData.genericName,
            inventoryItemId: inventoryData.inventoryItemId,
            matches: inventoryData.matches || []
          } : undefined
        }
      })
    }

    const transformedPrescriptions = (selectedPrescription.prescriptions || []).map(prescription => ({
      ...prescription,
      medications: transformMedications(prescription.id, prescription.medications)
    }))

    const derivedDiscount = selectedPrescription.discount ?? selectedPrescription.prescriptions?.[0]?.discount ?? 0

    return {
      ...selectedPrescription,
      discount: derivedDiscount,
      prescriptions: transformedPrescriptions
    }
  }

  const calculatePrescriptionCharges = async () => {
    if (!selectedPrescription || !pharmacist) {
      console.warn('⚠️ Cannot calculate charges: missing prescription or pharmacist data')
      return
    }
    
    calculatingCharges = true
    chargeCalculationError = null
    chargeBreakdown = null
    
    try {
      console.log('💰 Starting charge calculation for prescription:', selectedPrescription.id)
      const prescriptionForCharge = buildPrescriptionWithEditableAmounts()
      const effectivePharmacist = {
        ...pharmacist,
        currency: displayCurrency
      }
      chargeBreakdown = await chargeCalculationService.calculatePrescriptionCharge(prescriptionForCharge, effectivePharmacist)
      console.log('✅ Charge calculation completed:', chargeBreakdown)
    } catch (error) {
      console.error('❌ Error calculating prescription charges:', error)
      chargeCalculationError = error.message
      notifyError(`Failed to calculate charges: ${error.message}`)
    } finally {
      calculatingCharges = false
    }
  }

  const scheduleChargeRecalculation = () => {
    if (!showPrescriptionDetails) return
    if (chargeRecalculationTimeout) {
      clearTimeout(chargeRecalculationTimeout)
    }
    chargeRecalculationTimeout = setTimeout(async () => {
      chargeRecalculationTimeout = null
      await calculatePrescriptionCharges()
    }, 300)
  }
  
  // Format currency for display
  const formatCurrencyDisplay = (amount, currency = 'USD') => {
    try {
      if (currency === 'LKR') {
        // For LKR, return just the number without symbol
        return new Intl.NumberFormat('en-US', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        }).format(amount)
      } else {
        // For other currencies, use standard formatting
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: currency
        }).format(amount)
      }
    } catch (error) {
      console.error('❌ Error formatting currency:', error)
      return amount.toFixed(2)
    }
  }

  onMount(() => {
    console.log('🔍 PharmacistDashboard: Received pharmacist data:', pharmacist)
    console.log('🔍 PharmacistDashboard: businessName:', pharmacist?.businessName)
    console.log('🔍 PharmacistDashboard: pharmacistNumber:', pharmacist?.pharmacistNumber)
    console.log('🔍 PharmacistDashboard: All pharmacist fields:', Object.keys(pharmacist || {}))
    loadPharmacistData()
  })
</script>

<div class="min-h-screen bg-gray-50">
  <!-- Mobile-First Header -->
  <div class="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-40">
    <div class="px-3 py-3 sm:px-4">
      <div class="flex justify-between items-center">
        <div class="flex items-center min-w-0 flex-1">
          <i class="fas fa-pills text-blue-600 mr-2 text-lg"></i>
          <div class="min-w-0 flex-1">
            <h1 class="text-sm sm:text-base font-bold text-blue-600 truncate">M-Prescribe <span class="text-xs bg-blue-100 text-blue-800 px-1 py-0.5 rounded ml-1">v2.2.24</span></h1>
            <p class="text-xs text-gray-500 truncate">Pharmacist Portal</p>
      </div>
        </div>
        <div class="ml-2 flex items-center gap-2">
          <button
            type="button"
            class="inline-flex items-center gap-2 rounded-full bg-white px-3 py-2 text-sm font-semibold text-gray-700 border border-gray-200 hover:bg-gray-50 transition-colors duration-200"
            on:click={handleProfileSettings}
          >
            <span class="inline-flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-700">
              <i class="fas fa-cog"></i>
            </span>
            Settings
          </button>
          <button
            type="button"
            class="inline-flex items-center gap-2 rounded-full bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100 transition-colors duration-200"
            on:click={handleSignOut}
          >
            <span class="inline-flex h-8 w-8 items-center justify-center rounded-full bg-red-100 text-red-700">
              <i class="fas fa-sign-out-alt"></i>
            </span>
            Logout
          </button>
        </div>
      </div>
    </div>
  </div>
  
  <!-- Profile Settings Modal -->
  {#if showProfileSettings}
    <div class="fixed inset-0 z-50 overflow-y-auto">
      <div class="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" on:click={handleBackToDashboard}></div>
        <div class="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
          <PharmacistSettings 
            {pharmacist}
            on:profile-updated={handleProfileUpdate}
            on:back-to-dashboard={handleBackToDashboard}
          />
        </div>
      </div>
    </div>
  {/if}

  <!-- Main Content -->
  <div class="px-3 py-4 sm:px-4 sm:py-6">
    <!-- Mobile Stats Cards -->
    <div class="grid grid-cols-2 gap-3 mb-4 sm:hidden">
      <div class="bg-white rounded-lg p-3 shadow-sm border border-gray-200">
        <div class="flex items-center">
          <div class="p-2 bg-blue-100 rounded-lg mr-3">
            <i class="fas fa-prescription text-blue-600"></i>
          </div>
          <div>
            <p class="text-xs text-gray-500">Prescriptions</p>
            <p class="text-lg font-semibold text-gray-900">{prescriptions.length}</p>
          </div>
        </div>
      </div>
      <div class="bg-white rounded-lg p-3 shadow-sm border border-gray-200">
        <div class="flex items-center">
          <div class="p-2 bg-green-100 rounded-lg mr-3">
            <i class="fas fa-user-md text-green-600"></i>
          </div>
          <div>
            <p class="text-xs text-gray-500">Doctors</p>
            <p class="text-lg font-semibold text-gray-900">{connectedDoctors.length}</p>
          </div>
        </div>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6">
      <!-- Sidebar - Hidden on mobile, visible on desktop -->
      <div class="hidden lg:block lg:col-span-3">
      <div class="bg-white border-2 border-blue-200 rounded-lg shadow-sm">
        <div class="bg-blue-600 text-white px-4 py-3 rounded-t-lg">
          <h6 class="text-lg font-semibold mb-0">
            <i class="fas fa-info-circle mr-2"></i>
            Pharmacy Information
          </h6>
        </div>
        <div class="p-4">
          <div class="mb-3">
            <label class="block text-sm font-medium text-gray-700 mb-1">Business Name:</label>
            <p class="text-gray-900">{pharmacist.businessName || pharmacist.name || 'Not specified'}</p>
          </div>
          <div class="mb-3">
            <label class="block text-sm font-medium text-gray-700 mb-1">Pharmacist ID:</label>
            <p class="text-blue-600 font-semibold">
              {pharmacist.pharmacistNumber || formatPharmacyId(pharmacyId || pharmacist.id) || 'Not specified'}
            </p>
          </div>
          <div class="mb-3">
            <label class="block text-sm font-medium text-gray-700 mb-1">Connected Doctors:</label>
            <p class="text-gray-900">{connectedDoctors.length}</p>
          </div>
          <div class="mb-0">
            <label class="block text-sm font-medium text-gray-700 mb-1">Total Prescriptions:</label>
            <p class="mb-0">{prescriptions.length}</p>
          </div>
        </div>
      </div>
      
      <!-- Connected Doctors -->
      {#if connectedDoctors.length > 0}
        <div class="bg-white border-2 border-blue-200 rounded-lg shadow-sm mt-4">
          <div class="bg-blue-500 text-white px-4 py-3 rounded-t-lg">
            <h6 class="text-lg font-semibold mb-0">
              <i class="fas fa-user-md mr-2"></i>
              Connected Doctors
            </h6>
          </div>
          <div class="p-4">
            {#each connectedDoctors as doctor}
              <div class="flex items-center mb-3">
                <i class="fas fa-user-md text-blue-600 mr-2"></i>
                <div>
                  <div class="font-semibold text-gray-900">{doctor.name || `${doctor.firstName} ${doctor.lastName}` || doctor.email}</div>
                  <small class="text-gray-500">{doctor.email}</small>
                </div>
              </div>
            {/each}
          </div>
        </div>
      {/if}
    </div>
    
    <!-- Main Content with Tabs -->
    <div class="lg:col-span-9">
      <div class="bg-white rounded-lg shadow-sm border border-gray-200">
          <!-- Mobile Tab Navigation -->
          <div class="bg-white border-b border-gray-200 px-3 py-3 sm:px-4">
            <div class="flex flex-col space-y-3 sm:space-y-0 sm:flex-row sm:justify-between sm:items-center">
              <!-- Tab Buttons -->
            <div class="flex space-x-1" role="tablist">
              <button 
                  class="flex-1 sm:flex-none px-3 py-2 text-xs sm:text-sm font-medium rounded-lg transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-offset-2 {activeTab === 'prescriptions' ? 'text-white bg-blue-600 hover:bg-blue-700 focus:ring-blue-300 dark:bg-blue-600 dark:hover:bg-blue-700 dark:focus:ring-blue-800' : 'text-gray-500 bg-white border border-gray-200 hover:bg-gray-50 hover:text-gray-700 focus:ring-gray-300 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-600 dark:hover:bg-gray-700 dark:hover:text-white'}" 
                on:click={() => activeTab = 'prescriptions'}
                type="button"
                role="tab"
              >
                  <i class="fas fa-prescription mr-1 sm:mr-2"></i>
                  <span class="hidden xs:inline">Prescriptions</span>
                  <span class="xs:hidden">Rx</span>
              </button>
              <button 
                  class="flex-1 sm:flex-none px-3 py-2 text-xs sm:text-sm font-medium rounded-lg transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-offset-2 {activeTab === 'inventory' ? 'text-white bg-blue-600 hover:bg-blue-700 focus:ring-blue-300 dark:bg-blue-600 dark:hover:bg-blue-700 dark:focus:ring-blue-800' : 'text-gray-500 bg-white border border-gray-200 hover:bg-gray-50 hover:text-gray-700 focus:ring-gray-300 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-600 dark:hover:bg-gray-700 dark:hover:text-white'}" 
                  on:click={() => activeTab = 'inventory'}
                type="button"
                role="tab"
              >
                  <i class="fas fa-warehouse mr-1 sm:mr-2"></i>
                  <span class="hidden xs:inline">Inventory</span>
                  <span class="xs:hidden">Stock</span>
              </button>
            </div>
              
              <!-- Action Buttons -->
            <div class="flex space-x-2" role="group">
              {#if activeTab === 'prescriptions'}
                  <button class="text-blue-700 bg-blue-100 hover:bg-blue-200 focus:ring-4 focus:outline-none focus:ring-blue-300 font-medium rounded-lg text-xs sm:text-sm px-2 sm:px-3 py-1 text-center dark:bg-blue-800 dark:text-blue-200 dark:hover:bg-blue-700 dark:focus:ring-blue-800 transition-all duration-200" on:click={loadPharmacistData}>
                  <i class="fas fa-sync-alt mr-1"></i>
                    <span class="hidden sm:inline">Refresh</span>
                </button>
                  <button class="text-red-700 bg-red-100 hover:bg-red-200 focus:ring-4 focus:outline-none focus:ring-red-300 font-medium rounded-lg text-xs sm:text-sm px-2 sm:px-3 py-1 text-center dark:bg-red-800 dark:text-red-200 dark:hover:bg-red-700 dark:focus:ring-red-800 transition-all duration-200" on:click={clearAllPrescriptions}>
                  <i class="fas fa-trash mr-1"></i>
                    <span class="hidden sm:inline">Clear All</span>
                </button>
                {:else if activeTab === 'inventory'}
                  <button class="text-blue-700 bg-blue-100 hover:bg-blue-200 focus:ring-4 focus:outline-none focus:ring-blue-300 font-medium rounded-lg text-xs sm:text-sm px-2 sm:px-3 py-1 text-center dark:bg-blue-800 dark:text-blue-200 dark:hover:bg-blue-700 dark:focus:ring-blue-800 transition-all duration-200" on:click={loadPharmacistData}>
                  <i class="fas fa-sync-alt mr-1"></i>
                    <span class="hidden sm:inline">Refresh</span>
                </button>
              {/if}
            </div>
          </div>
        </div>
        
        <div class="p-4">
          {#if activeTab === 'prescriptions'}
            {#if loading}
              <div class="text-center py-4">
                <svg class="animate-spin h-8 w-8 text-blue-600 mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <p class="mt-2 text-gray-500">Loading prescriptions...</p>
              </div>
            {:else if prescriptions.length === 0}
              <div class="text-center py-8">
                <i class="fas fa-prescription text-4xl text-gray-400 mb-3"></i>
                <h5 class="text-gray-500">No Prescriptions Available</h5>
                <p class="text-gray-500">Prescriptions from connected doctors will appear here.</p>
              </div>
            {:else}
              <!-- Desktop Table View -->
              <div class="hidden md:block">
                <div class="overflow-x-auto">
                  <table class="w-full divide-y divide-gray-200" style="table-layout: auto; width: max-content; min-width: 100%;">
                    <thead class="bg-gray-50">
                      <tr>
                        <th class="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Patient</th>
                        <th class="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Doctor</th>
                        <th class="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Medications</th>
                        <th class="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                        <th class="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                        <th class="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                  <tbody class="bg-white divide-y divide-gray-200">
                    {#each paginatedPrescriptions as prescription}
                      <tr class="hover:bg-gray-50">
                        <td class="px-3 sm:px-6 py-4 align-top" style="white-space: normal; word-wrap: break-word; max-width: 200px;">
                          <div class="font-semibold text-gray-900 text-xs sm:text-sm">{prescription.patientName || 'Unknown Patient'}</div>
                          <div class="text-xs sm:text-sm text-gray-500">{prescription.patientEmail || 'No email'}</div>
                        </td>
                        <td class="px-3 sm:px-6 py-4 align-top" style="white-space: normal; word-wrap: break-word; max-width: 300px;">
                          <div class="font-semibold text-gray-900 text-xs sm:text-sm">{prescription.doctorName || getDoctorName(prescription.doctorId)}</div>
                          <div class="text-xs sm:text-sm text-gray-500" style="word-break: break-all;">ID: {formatDoctorId(prescription.doctorId)}</div>
                        </td>
                        <td class="px-3 sm:px-6 py-4 align-top" style="white-space: normal; word-wrap: break-word;">
                          <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            {prescription.prescriptions ? prescription.prescriptions.reduce((total, p) => total + (p.medications ? p.medications.length : 0), 0) : 0} medication(s)
                          </span>
                        </td>
                        <td class="px-3 sm:px-6 py-4 align-top text-xs sm:text-sm text-gray-500" style="white-space: normal; word-wrap: break-word;">
                          <div>{formatDate(resolvePrescriptionDate(prescription))}</div>
                          <div class="text-xs text-gray-500">{formatTime(resolvePrescriptionDate(prescription))}</div>
                        </td>
                        <td class="px-3 sm:px-6 py-4 align-top" style="white-space: normal; word-wrap: break-word;">
                          <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                            {prescription.status || 'Pending'}
                          </span>
                        </td>
                        <td class="px-3 sm:px-6 py-4 align-top text-xs sm:text-sm font-medium" style="white-space: normal; word-wrap: break-word;">
                          <button 
                            class="text-blue-600 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 px-2 sm:px-3 py-1 rounded text-xs sm:text-sm font-medium transition-colors duration-200"
                            on:click={() => viewPrescription(prescription)}
                          >
                            <i class="fas fa-eye mr-1"></i>
                            View
                          </button>
                        </td>
                      </tr>
                    {/each}
                  </tbody>
                  </table>
                </div>
              </div>

              <!-- Mobile Card View -->
              <div class="md:hidden space-y-3">
                {#each paginatedPrescriptions as prescription}
                  <div class="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                    <div class="flex justify-between items-start mb-3">
                      <div class="flex-1">
                        <h3 class="font-semibold text-gray-900 text-sm">{prescription.patientName || 'Unknown Patient'}</h3>
                        <p class="text-xs text-gray-500">{prescription.patientEmail || 'No email'}</p>
              </div>
                      <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                        {prescription.status || 'Pending'}
                      </span>
                    </div>
                    
                    <div class="space-y-2 mb-3">
                      <div class="flex items-center text-xs">
                        <i class="fas fa-user-md text-blue-600 mr-2 w-3"></i>
                        <span class="text-gray-600">{prescription.doctorName || getDoctorName(prescription.doctorId)}</span>
                      </div>
                      <div class="flex items-center text-xs">
                        <i class="fas fa-pills text-blue-600 mr-2 w-3"></i>
                        <span class="text-gray-600">
                          {prescription.prescriptions ? prescription.prescriptions.reduce((total, p) => total + (p.medications ? p.medications.length : 0), 0) : 0} medication(s)
                        </span>
                      </div>
                      <div class="flex items-center text-xs">
                        <i class="fas fa-calendar text-blue-600 mr-2 w-3"></i>
                        <div class="text-gray-600">
                          <div>{formatDate(resolvePrescriptionDate(prescription), getDoctorTimeZone(prescription))}</div>
                          <div class="text-xs text-gray-500">{formatTime(resolvePrescriptionDate(prescription), getDoctorTimeZone(prescription))}</div>
                        </div>
                      </div>
                    </div>
                    
                    <button 
                      class="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2 px-3 rounded-lg transition-colors duration-200"
                      on:click={() => viewPrescription(prescription)}
                    >
                      <i class="fas fa-eye mr-1"></i>
                      View Details
                </button>
              </div>
                {/each}
              </div>
                
                <!-- Pagination Controls -->
                {#if totalPrescriptionPages > 1}
                  <div class="mt-4 sm:mt-6 bg-gray-50 rounded-lg p-3 sm:p-4">
                    <!-- Mobile Pagination -->
                    <div class="sm:hidden">
                      <div class="text-center text-xs text-gray-600 mb-3">
                        Page {currentPrescriptionPage} of {totalPrescriptionPages}
                      </div>
                      <div class="flex justify-between items-center">
                            <button 
                          class="inline-flex items-center px-3 py-2 text-xs font-medium text-gray-500 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                          on:click={goToPreviousPrescriptionPage}
                          disabled={currentPrescriptionPage === 1}
                        >
                          <i class="fas fa-chevron-left mr-1"></i>
                          Prev
                            </button>
                        
                        <div class="flex items-center space-x-1">
                          {#each Array.from({length: Math.min(3, totalPrescriptionPages)}, (_, i) => {
                            const startPage = Math.max(1, currentPrescriptionPage - 1)
                            const endPage = Math.min(totalPrescriptionPages, startPage + 2)
                            const page = startPage + i
                            return page <= endPage ? page : null
                          }).filter(Boolean) as page}
                            <button 
                              class="inline-flex items-center px-2 py-1 text-xs font-medium rounded {currentPrescriptionPage === page ? 'text-white bg-blue-600' : 'text-gray-500 bg-white border border-gray-300 hover:bg-gray-50 hover:text-gray-700'}"
                              on:click={() => goToPrescriptionPage(page)}
                            >
                              {page}
                            </button>
                          {/each}
                          </div>
                        
                        <button 
                          class="inline-flex items-center px-3 py-2 text-xs font-medium text-gray-500 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                          on:click={goToNextPrescriptionPage}
                          disabled={currentPrescriptionPage === totalPrescriptionPages}
                        >
                          Next
                          <i class="fas fa-chevron-right ml-1"></i>
                        </button>
                      </div>
                    </div>
                    
                    <!-- Desktop Pagination -->
                    <div class="hidden sm:flex items-center justify-between">
                      <div class="flex items-center text-sm text-gray-700">
                        <span>Showing {prescriptionStartIndex + 1} to {Math.min(prescriptionEndIndex, prescriptions.length)} of {prescriptions.length} prescriptions</span>
                      </div>
                      
                      <div class="flex items-center space-x-2">
                        <!-- Previous Button -->
                        <button 
                          class="inline-flex items-center px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                          on:click={goToPreviousPrescriptionPage}
                          disabled={currentPrescriptionPage === 1}
                        >
                          <i class="fas fa-chevron-left mr-1"></i>
                          Previous
                        </button>
                        
                        <!-- Page Numbers -->
                        <div class="flex items-center space-x-1">
                          {#each Array.from({length: Math.min(5, totalPrescriptionPages)}, (_, i) => {
                            const startPage = Math.max(1, currentPrescriptionPage - 2)
                            const endPage = Math.min(totalPrescriptionPages, startPage + 4)
                            const page = startPage + i
                            return page <= endPage ? page : null
                          }).filter(Boolean) as page}
                            <button 
                              class="inline-flex items-center px-3 py-2 text-sm font-medium rounded-lg {currentPrescriptionPage === page ? 'text-white bg-blue-600 border-blue-600' : 'text-gray-500 bg-white border border-gray-300 hover:bg-gray-50 hover:text-gray-700'}"
                              on:click={() => goToPrescriptionPage(page)}
                            >
                              {page}
                            </button>
                    {/each}
                        </div>
                        
                        <!-- Next Button -->
                        <button 
                          class="inline-flex items-center px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                          on:click={goToNextPrescriptionPage}
                          disabled={currentPrescriptionPage === totalPrescriptionPages}
                        >
                          Next
                          <i class="fas fa-chevron-right ml-1"></i>
                        </button>
                      </div>
                    </div>
              </div>
            {/if}
            {/if}
          {:else if activeTab === 'inventory'}
            <!-- Advanced Inventory System -->
            <InventoryDashboard {pharmacist} />
          {/if}
        </div>
      </div>
    </div>
  </div>
</div>

<!-- Confirmation Modal -->
<ConfirmationModal
  visible={showConfirmationModal}
  title={confirmationConfig.title}
  message={confirmationConfig.message}
  confirmText={confirmationConfig.confirmText}
  cancelText={confirmationConfig.cancelText}
  type={confirmationConfig.type}
  requireCode={confirmationConfig.requireCode}
  expectedCode={doctorDeleteCode}
  codeLabel="Delete Code"
  codePlaceholder="Enter 6-digit delete code"
  on:confirm={handleConfirmationConfirm}
  on:cancel={handleConfirmationCancel}
  on:close={handleConfirmationCancel}
/>

<!-- Prescription Details Modal -->
{#if showPrescriptionDetails && selectedPrescription}
  <div id="prescriptionModal" tabindex="-1" aria-hidden="true" class="fixed inset-0 z-50 w-full p-2 sm:p-4 overflow-x-hidden overflow-y-auto md:inset-0 h-full max-h-full bg-black bg-opacity-50 backdrop-blur-sm">
    <div class="relative w-full max-w-4xl max-h-full mx-auto">
      <div class="relative bg-white rounded-lg shadow dark:bg-gray-700 h-full max-h-full flex flex-col border border-white">
        <!-- Mobile Header -->
        <div class="flex items-center justify-between p-3 sm:p-5 border-b rounded-t dark:border-gray-600 bg-blue-600 text-white sm:bg-white sm:text-gray-900">
          <h3 class="text-lg sm:text-xl font-medium">
            <i class="fas fa-prescription mr-2"></i>
            <span class="hidden sm:inline">Prescription Details</span>
            <span class="sm:hidden">Details</span>
          </h3>
          <button 
            type="button" 
            class="text-white sm:text-gray-400 bg-transparent hover:bg-white/20 sm:hover:bg-gray-200 hover:text-white sm:hover:text-gray-900 rounded-lg text-sm p-1.5 ml-auto inline-flex items-center dark:hover:bg-gray-600 dark:hover:text-white" 
            data-modal-hide="prescriptionModal"
            on:click={closePrescriptionDetails}
          >
            <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
              <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"></path>
            </svg>
            <span class="sr-only">Close modal</span>
          </button>
        </div>
        <div class="p-3 sm:p-6 overflow-y-auto flex-1">
          <!-- Patient Information -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 mb-4 sm:mb-6">
            <div class="bg-gray-50 rounded-lg p-3 sm:p-4">
              <h6 class="font-semibold text-blue-600 text-sm sm:text-base mb-2">Patient Information</h6>
              <div class="space-y-1 text-xs sm:text-sm">
                <p><strong>Name:</strong> {selectedPrescription.patientName || 'Unknown Patient'}</p>
                <p><strong>Email:</strong> {selectedPrescription.patientEmail || 'No email'}</p>
                <div class="flex gap-4">
                  {#if selectedPrescription.patientAge}
                    <p><strong>Age:</strong> {selectedPrescription.patientAge}</p>
                  {/if}
                  {#if selectedPrescription.patientSex || selectedPrescription.patientGender}
                    <p><strong>Sex:</strong> {selectedPrescription.patientSex || selectedPrescription.patientGender}</p>
                  {/if}
                </div>
              </div>
            </div>
            <div class="bg-gray-50 rounded-lg p-3 sm:p-4">
              <h6 class="font-semibold text-blue-600 text-sm sm:text-base mb-2">Prescription Information</h6>
              <div class="space-y-1 text-xs sm:text-sm">
              <p><strong>Doctor:</strong> {selectedPrescription.doctorName || getDoctorName(selectedPrescription.doctorId)}</p>
              <p><strong>Date:</strong> {formatDate(resolvePrescriptionDate(selectedPrescription), getDoctorTimeZone(selectedPrescription))} <span class="text-xs text-gray-500">{formatTime(resolvePrescriptionDate(selectedPrescription), getDoctorTimeZone(selectedPrescription))}</span></p>
                <p><strong>Status:</strong> <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">{selectedPrescription.status || 'Pending'}</span></p>
              </div>
            </div>
          </div>
          
          <!-- Prescriptions -->
          <div class="mb-4">
            <h6 class="font-semibold text-white text-sm sm:text-base mb-3">Prescriptions</h6>
            {#if selectedPrescription.prescriptions && selectedPrescription.prescriptions.length > 0}
              {#each selectedPrescription.prescriptions as prescription}
                <div class="bg-white border border-gray-200 rounded-lg shadow-sm mb-4">
                  <div class="bg-gray-50 px-3 sm:px-4 py-3 border-b border-gray-200">
                    <h6 class="text-xs sm:text-sm font-semibold mb-0">Prescription ID: {formatPrescriptionId(prescription.id)}</h6>
                  </div>
                  <div class="p-3 sm:p-4">
                    <!-- Medications for this prescription -->
                    {#if prescription.medications && prescription.medications.length > 0}
                      <!-- Desktop Multiline View -->
                      <div class="hidden sm:block overflow-x-auto">
                        <div class="space-y-6">
                          {#each prescription.medications as medication}
                            {@const inventoryMatches = getInventoryMatches(prescription.id, medication.id || medication.name)}
                            {@const allocationPreview = getAllocationPreview(prescription.id, medication)}

                            <!-- Medication Card -->
                            <div class="border border-gray-300 rounded-lg overflow-hidden bg-white">
                              <!-- Header Row with checkbox and medication name -->
                              <div class="bg-gray-50 px-4 py-3 border-b border-gray-300">
                                <div class="flex items-center gap-3">
                                  <input
                                    type="checkbox"
                                    class="w-5 h-5 text-teal-600 bg-gray-100 border-gray-300 rounded focus:ring-teal-500 dark:focus:ring-teal-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                                    checked={isMedicationDispensed(prescription.id, medication.id || medication.name) || isMedicationAlreadyDispensed(prescription.id, medication.id || medication.name)}
                                    disabled={isMedicationAlreadyDispensed(prescription.id, medication.id || medication.name)}
                                    on:change={() => !isMedicationAlreadyDispensed(prescription.id, medication.id || medication.name) && toggleMedicationDispatch(prescription.id, medication.id || medication.name)}
                                  />
                                  <span class="text-base font-semibold text-gray-900">
                                    {medication.name}{#if medication.genericName && medication.genericName !== medication.name} ({medication.genericName}){/if}
                                  </span>
                                </div>
                              </div>

                              <!-- Main Info Grid -->
                              <div class="p-4">
                                <div class="grid grid-cols-8 gap-4 text-sm">
                                  <!-- Column Headers -->
                                  <div class="col-span-1">
                                    <div class="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Dosage</div>
                                    <div class="text-gray-900">{medication.dosage}</div>
                                  </div>

                                  <div class="col-span-1">
                                    <div class="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Frequency</div>
                                    <div class="text-gray-900">{medication.frequency}</div>
                                  </div>

                                  <div class="col-span-1">
                                    <div class="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Duration</div>
                                    <div class="text-gray-900">{medication.duration}</div>
                                  </div>

                                  <div class="col-span-1">
                                    <div class="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Amount</div>
                                    <input
                                      type="text"
                                      class="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-center font-semibold text-blue-600"
                                      value={getEditableAmount(prescription.id, medication)}
                                      on:input={(e) => updateEditableAmount(prescription.id, medication.id || medication.name, e.target.value)}
                                      placeholder="0"
                                    />
                                  </div>

                                  <div class="col-span-1">
                                    <div class="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Expiry Date</div>
                                    <div>
                                      {#if getMedicationInventoryData(prescription.id, medication.id || medication.name, medicationInventoryVersion).found}
                                        <span class="text-green-600 font-medium">
                                          {getMedicationInventoryData(prescription.id, medication.id || medication.name, medicationInventoryVersion).expiryDate ?
                                            new Date(getMedicationInventoryData(prescription.id, medication.id || medication.name, medicationInventoryVersion).expiryDate).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }) :
                                            'N/A'
                                          }
                                        </span>
                                      {:else}
                                        <span class="text-red-500 text-xs">Not in inventory</span>
                                      {/if}
                                    </div>
                                  </div>

                                  <div class="col-span-2">
                                    <div class="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Remaining</div>
                                    {#if inventoryMatches.length > 0}
                                      <div class="space-y-2">
                                        {#each allocationPreview.orderedMatches as batch, index}
                                          <div class="border border-gray-200 rounded px-2 py-1.5 bg-gray-50 text-xs">
                                            <div class="flex justify-between items-center mb-1">
                                              <span class="font-medium text-gray-700">Batch {index + 1}</span>
                                              <span class="text-gray-900">{batch.available} {batch.packUnit || 'tablets'}</span>
                                            </div>
                                            <div class="text-gray-500 text-xs mb-1">
                                              {batch.expiryDate ? formatDate(batch.expiryDate) : 'Expiry N/A'}
                                            </div>
                                            {#if batch.allocated > 0}
                                              <div class="text-teal-600 font-semibold text-xs">
                                                Alloc {batch.allocated}
                                              </div>
                                            {/if}
                                          </div>
                                        {/each}
                                        {#if allocationPreview.remaining > 0}
                                          <div class="text-xs text-red-500 mt-1">Short {allocationPreview.remaining} units</div>
                                        {/if}
                                      </div>
                                    {:else}
                                      <div>
                                        {#if getMedicationInventoryData(prescription.id, medication.id || medication.name, medicationInventoryVersion).found}
                                          <span class="text-blue-600 font-medium">
                                            {getMedicationInventoryData(prescription.id, medication.id || medication.name, medicationInventoryVersion).currentStock} {getMedicationInventoryData(prescription.id, medication.id || medication.name, medicationInventoryVersion).packUnit}
                                          </span>
                                        {:else}
                                          <span class="text-red-500">0</span>
                                        {/if}
                                      </div>
                                    {/if}
                                  </div>

                                  <div class="col-span-1">
                                    <div class="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Instructions</div>
                                    <div class="text-gray-900">{medication.instructions}</div>
                                  </div>
                                </div>
                              </div>

                              <!-- Allocation Summary Footer -->
                              {#if inventoryMatches.length > 0 && allocationPreview.orderedMatches.length > 0}
                                <div class="bg-gray-50 px-4 py-3 border-t border-gray-200">
                                  <div class="flex flex-wrap gap-x-6 gap-y-2 text-xs text-gray-600">
                                    {#each allocationPreview.orderedMatches as batch, index}
                                      <div class="flex items-center gap-2">
                                        <span class="font-medium text-gray-700">Batch {index + 1}</span>
                                        <span class="text-gray-500">{batch.expiryDate ? formatDate(batch.expiryDate) : 'Expiry N/A'}</span>
                                        <span class="text-gray-700">{batch.available} {batch.packUnit || 'tablets'} available</span>
                                        {#if batch.allocated > 0}
                                          <span class="text-teal-600 font-semibold">Allocating {batch.allocated}</span>
                                        {/if}
                                      </div>
                                    {/each}
                                  </div>
                                  {#if allocationPreview.remaining > 0}
                                    <div class="mt-2 text-xs text-red-500">Short {allocationPreview.remaining} units with current inventory.</div>
                                  {/if}
                                </div>
                              {/if}
                            </div>
                          {/each}
                        </div>
                      </div>

                      <!-- Mobile Card View -->
                      <div class="sm:hidden space-y-3">
                        {#each prescription.medications as medication}
                          {@const inventoryMatchesMobile = getInventoryMatches(prescription.id, medication.id || medication.name)}
                          {@const allocationPreviewMobile = getAllocationPreview(prescription.id, medication)}
                          <div class="bg-gray-50 border border-gray-200 rounded-lg p-3">
                            <div class="flex items-center justify-between mb-2">
                              <div class="flex items-center gap-2">
                                <h4 class="font-semibold text-gray-900 text-sm">{medication.name}{#if medication.genericName && medication.genericName !== medication.name} ({medication.genericName}){/if}</h4>
                              </div>
                              <label class="flex items-center space-x-2 {isMedicationAlreadyDispensed(prescription.id, medication.id || medication.name) ? 'cursor-not-allowed' : 'cursor-pointer'}">
                                <input 
                                  type="checkbox" 
                                  class="w-4 h-4 text-teal-600 bg-gray-100 border-gray-300 rounded focus:ring-teal-500 dark:focus:ring-teal-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                                  checked={isMedicationDispensed(prescription.id, medication.id || medication.name) || isMedicationAlreadyDispensed(prescription.id, medication.id || medication.name)}
                                  disabled={isMedicationAlreadyDispensed(prescription.id, medication.id || medication.name)}
                                  on:change={() => !isMedicationAlreadyDispensed(prescription.id, medication.id || medication.name) && toggleMedicationDispatch(prescription.id, medication.id || medication.name)}
                                />
                                <span class="text-xs {isMedicationAlreadyDispensed(prescription.id, medication.id || medication.name) ? 'text-gray-400' : 'text-gray-600'}">Dispensed</span>
                              </label>
                            </div>
                            <div class="space-y-1 text-xs">
                              <div class="flex justify-between">
                                <span class="text-gray-600">Dosage:</span>
                                <span class="text-gray-900">{medication.dosage}</span>
                              </div>
                              <div class="flex justify-between">
                                <span class="text-gray-600">Frequency:</span>
                                <span class="text-gray-900">{medication.frequency}</span>
                              </div>
                              <div class="flex justify-between">
                                <span class="text-gray-600">Duration:</span>
                                <span class="text-gray-900">{medication.duration}</span>
                              </div>
                              <div class="flex justify-between">
                                <span class="text-gray-600">Amount:</span>
                                <!-- All medications - show as editable input -->
                                <input 
                                  type="text" 
                                  class="w-16 px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-center font-semibold text-blue-600"
                                  value={getEditableAmount(prescription.id, medication)}
                                  on:input={(e) => updateEditableAmount(prescription.id, medication.id || medication.name, e.target.value)}
                                  placeholder="0"
                                />
                              </div>
                              <div class="flex justify-between">
                                <span class="text-gray-600">Expiry Date:</span>
                                {#if getMedicationInventoryData(prescription.id, medication.id || medication.name, medicationInventoryVersion).found}
                                  <span class="text-green-600 font-medium text-xs">
                                    {getMedicationInventoryData(prescription.id, medication.id || medication.name, medicationInventoryVersion).expiryDate ? 
                                      new Date(getMedicationInventoryData(prescription.id, medication.id || medication.name, medicationInventoryVersion).expiryDate).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }) : 
                                      'N/A'
                                    }
                                  </span>
                                {:else}
                                  <span class="text-red-500 text-xs">Not in inventory</span>
                                {/if}
                              </div>
                              <div class="flex justify-between">
                                <span class="text-gray-600">Remaining:</span>
                                {#if inventoryMatchesMobile.length > 0}
                                  <span class="text-blue-600 font-medium text-xs">
                                    {allocationPreviewMobile.orderedMatches[0]?.available || getMedicationInventoryData(prescription.id, medication.id || medication.name, medicationInventoryVersion).currentStock}
                                    {allocationPreviewMobile.orderedMatches[0]?.packUnit || getMedicationInventoryData(prescription.id, medication.id || medication.name, medicationInventoryVersion).packUnit}
                                  </span>
                                {:else if getMedicationInventoryData(prescription.id, medication.id || medication.name, medicationInventoryVersion).found}
                                  <span class="text-blue-600 font-medium text-xs">
                                    {getMedicationInventoryData(prescription.id, medication.id || medication.name, medicationInventoryVersion).currentStock} {getMedicationInventoryData(prescription.id, medication.id || medication.name, medicationInventoryVersion).packUnit}
                                  </span>
                                {:else}
                                  <span class="text-red-500 text-xs">0</span>
                                {/if}
                              </div>
                              {#if inventoryMatchesMobile.length > 0}
                                <div class="pt-2 mt-2 border-t border-gray-200 space-y-1">
                                  <div class="text-[10px] uppercase text-gray-400 tracking-wide">Inventory Batches</div>
                                  {#each allocationPreviewMobile.orderedMatches as batch, index}
                                    <div class="flex justify-between text-xs text-gray-600">
                                      <span>Batch {index + 1}{#if batch.expiryDate} · {formatDate(batch.expiryDate)}{/if}</span>
                                      <span class="text-gray-700">
                                        {batch.available} {batch.packUnit || 'units'}
                                        {#if batch.allocated > 0}
                                          <span class="text-teal-600 font-semibold ml-1">→ {batch.allocated}</span>
                                        {/if}
                                      </span>
                                    </div>
                                  {/each}
                                  {#if allocationPreviewMobile.remaining > 0}
                                    <div class="text-xs text-red-500">Short {allocationPreviewMobile.remaining} units with current inventory.</div>
                                  {/if}
                                </div>
                              {/if}
                              <div class="mt-2">
                                <span class="text-gray-600 text-xs">Instructions:</span>
                                <p class="text-gray-900 text-xs mt-1">{medication.instructions}</p>
                              </div>
                            </div>
                          </div>
                        {/each}
                      </div>
                    {:else}
                      <div class="bg-blue-50 border border-blue-200 rounded-lg p-3">
                        <i class="fas fa-info-circle mr-2 text-blue-600"></i>
                        <span class="text-blue-700 text-sm">No medications found in this prescription.</span>
                      </div>
                    {/if}
                  </div>
                </div>
              {/each}
            {:else}
              <div class="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <i class="fas fa-info-circle mr-2 text-blue-600"></i>
                <span class="text-blue-700 text-sm">No prescriptions found.</span>
              </div>
            {/if}
          </div>
          
          <!-- Notes -->
          {#if selectedPrescription.notes}
            <div class="mb-4">
              <h6 class="font-semibold text-blue-600 text-sm sm:text-base mb-2">Doctor's Notes</h6>
              <div class="bg-gray-50 border border-gray-200 rounded-lg p-3">
                <span class="text-gray-700 text-xs sm:text-sm">{selectedPrescription.notes}</span>
              </div>
            </div>
          {/if}
          
          <!-- Charge Calculation Section -->
          <div class="mb-4">
            <h6 class="font-semibold text-white text-sm sm:text-base mb-2">
              <i class="fas fa-calculator mr-2"></i>
              Prescription Charges
            </h6>
            
            {#if calculatingCharges}
              <div class="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <div class="flex items-center">
                  <i class="fas fa-spinner fa-spin text-blue-600 mr-2"></i>
                  <span class="text-blue-700 text-sm">Calculating charges...</span>
                </div>
              </div>
            {:else if chargeCalculationError}
              <div class="bg-red-50 border border-red-200 rounded-lg p-3">
                <div class="flex items-center">
                  <i class="fas fa-exclamation-triangle text-red-600 mr-2"></i>
                  <span class="text-red-700 text-sm">Error calculating charges: {chargeCalculationError}</span>
                </div>
                <button 
                  class="mt-2 text-xs text-red-600 hover:text-red-800 underline"
                  on:click={calculatePrescriptionCharges}
                >
                  Try again
                </button>
              </div>
            {:else if chargeBreakdown}
              <div class="bg-white border border-gray-200 rounded-lg p-3 sm:p-4">
                <!-- Doctor Charges -->
                <div class="mb-3">
                  <h7 class="font-semibold text-gray-700 text-xs sm:text-sm mb-2">Doctor Charges</h7>
                  <div class="space-y-1 text-xs sm:text-sm">
                    <div class="flex justify-between">
                      <span class="text-gray-600">Consultation Charge:</span>
                      <span class="text-gray-900">
                      {#if displayCurrency === 'LKR'}
                        Rs {formatCurrencyDisplay(chargeBreakdown.doctorCharges.consultationCharge, displayCurrency)}
                      {:else}
                        {formatCurrencyDisplay(chargeBreakdown.doctorCharges.consultationCharge, displayCurrency)}
                      {/if}
                      </span>
                    </div>
                    {#if chargeBreakdown.doctorCharges.excludeConsultationCharge}
                      <div class="flex justify-between text-xs text-gray-500">
                        <span>Consultation charge excluded</span>
                        <span>
                        {#if displayCurrency === 'LKR'}
                          Rs {formatCurrencyDisplay(chargeBreakdown.doctorCharges.baseConsultationCharge, displayCurrency)}
                        {:else}
                          {formatCurrencyDisplay(chargeBreakdown.doctorCharges.baseConsultationCharge, displayCurrency)}
                        {/if}
                        </span>
                      </div>
                    {/if}
                    <div class="flex justify-between">
                      <span class="text-gray-600">Hospital Charge:</span>
                      <span class="text-gray-900">
                      {#if displayCurrency === 'LKR'}
                        Rs {formatCurrencyDisplay(chargeBreakdown.doctorCharges.hospitalCharge, displayCurrency)}
                      {:else}
                        {formatCurrencyDisplay(chargeBreakdown.doctorCharges.hospitalCharge, displayCurrency)}
                      {/if}
                      </span>
                    </div>
                    {#if chargeBreakdown.doctorCharges.procedureCharges?.breakdown?.length}
                      <div class="border-t pt-1">
                        <div class="text-xs font-semibold text-gray-700 mb-1">Procedures</div>
                        {#each chargeBreakdown.doctorCharges.procedureCharges.breakdown as procedure}
                          <div class="flex justify-between">
                            <span class="text-gray-600">{procedure.name}</span>
                            <span class="text-gray-900">
                          {#if displayCurrency === 'LKR'}
                            Rs {formatCurrencyDisplay(procedure.price, displayCurrency)}
                          {:else}
                            {formatCurrencyDisplay(procedure.price, displayCurrency)}
                          {/if}
                            </span>
                          </div>
                        {/each}
                      </div>
                    {/if}
                  </div>
                </div>
                
                <!-- Drug Charges -->
                <div class="mb-3">
                  <h7 class="font-semibold text-gray-700 text-xs sm:text-sm mb-2">Drug Charges</h7>
                  <div class="space-y-1 text-xs sm:text-sm">
                    {#each chargeBreakdown.drugCharges.medicationBreakdown as medication}
                      <div class="flex justify-between">
                        <span class="text-gray-600">{medication.medicationName}</span>
                        <span class="text-gray-900">
                          {#if medication.found}
                        {#if displayCurrency === 'LKR'}
                          Rs {formatCurrencyDisplay(medication.totalCost, displayCurrency)}
                        {:else}
                          {formatCurrencyDisplay(medication.totalCost, displayCurrency)}
                        {/if}
                          {:else}
                            <span class="text-gray-400 italic">Not available</span>
                          {/if}
                        </span>
                      </div>
                    {/each}
                    <div class="flex justify-between border-t pt-1">
                      <span class="text-gray-600 font-medium">Total Drug Cost:</span>
                      <span class="text-gray-900 font-medium">
                      {#if displayCurrency === 'LKR'}
                        Rs {formatCurrencyDisplay(chargeBreakdown.drugCharges.totalCost, displayCurrency)}
                      {:else}
                        {formatCurrencyDisplay(chargeBreakdown.drugCharges.totalCost, displayCurrency)}
                      {/if}
                      </span>
                    </div>
                  </div>
                </div>

                <!-- Summary Section -->
                <div class="mb-3">
                  <div class="space-y-1 text-xs sm:text-sm">
                    {#if chargeBreakdown.doctorCharges.discountPercentage > 0}
                      <div class="flex justify-between items-center">
                        <span class="text-gray-600">
                          Discount ({chargeBreakdown.doctorCharges.discountPercentage}%):
                          <span class="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-teal-100 text-teal-700">
                            {chargeBreakdown.doctorCharges.discountScope === 'consultation_hospital' ? 'Consultation + Hospital' : 'Consultation only'}
                          </span>
                        </span>
                        <span class="text-green-600">
                        -{#if displayCurrency === 'LKR'}
                          Rs {formatCurrencyDisplay(chargeBreakdown.doctorCharges.discountAmount, displayCurrency)}
                        {:else}
                          {formatCurrencyDisplay(chargeBreakdown.doctorCharges.discountAmount, displayCurrency)}
                        {/if}
                        </span>
                      </div>
                    {/if}
                    <div class="flex justify-between">
                      <span class="text-gray-600">Subtotal:</span>
                      <span class="text-gray-900">
                      {#if displayCurrency === 'LKR'}
                        Rs {formatCurrencyDisplay(chargeBreakdown.totalBeforeRounding, displayCurrency)}
                      {:else}
                        {formatCurrencyDisplay(chargeBreakdown.totalBeforeRounding, displayCurrency)}
                      {/if}
                      </span>
                    </div>
                    {#if chargeBreakdown.roundingAdjustment !== 0}
                      <div class="flex justify-between">
                        <span class="text-gray-600">
                          Rounding
                          {#if chargeBreakdown.roundingPreference === 'nearest50'}
                            (to nearest 50)
                          {:else if chargeBreakdown.roundingPreference === 'nearest100'}
                            (to nearest 100)
                          {/if}:
                        </span>
                        <span class="{chargeBreakdown.roundingAdjustment >= 0 ? 'text-blue-600' : 'text-red-600'}">
                      {chargeBreakdown.roundingAdjustment >= 0 ? '+' : ''}{#if displayCurrency === 'LKR'}
                        Rs {formatCurrencyDisplay(Math.abs(chargeBreakdown.roundingAdjustment), displayCurrency)}
                      {:else}
                        {formatCurrencyDisplay(chargeBreakdown.roundingAdjustment, displayCurrency)}
                      {/if}
                        </span>
                      </div>
                    {/if}
                  </div>
                </div>

                <!-- Total Charge -->
                <div class="border-t pt-3">
                  <div class="flex justify-between items-center">
                    <span class="font-bold text-gray-900 text-sm sm:text-base">Total Charge:</span>
                    <span class="font-bold text-blue-600 text-sm sm:text-base">
                    {#if displayCurrency === 'LKR'}
                      Rs {formatCurrencyDisplay(chargeBreakdown.totalCharge, displayCurrency)}
                    {:else}
                      {formatCurrencyDisplay(chargeBreakdown.totalCharge, displayCurrency)}
                    {/if}
                    </span>
                  </div>
                </div>
              </div>
            {:else}
              <div class="bg-gray-50 border border-gray-200 rounded-lg p-3">
                <div class="flex items-center">
                  <i class="fas fa-info-circle text-gray-600 mr-2"></i>
                  <span class="text-gray-700 text-sm">Click "Calculate Charges" to view prescription cost breakdown</span>
                </div>
                <button 
                  class="mt-2 text-xs text-blue-600 hover:text-blue-800 underline"
                  on:click={calculatePrescriptionCharges}
                >
                  Calculate Charges
                </button>
              </div>
            {/if}
          </div>
        </div>
        
        <!-- Mobile Footer -->
        <div class="flex flex-col sm:flex-row items-center p-3 sm:p-6 space-y-2 sm:space-y-0 sm:space-x-2 border-t border-gray-200 rounded-b dark:border-gray-600 bg-gray-50 sm:bg-white">
          <button 
            type="button" 
            class="w-full sm:w-auto text-gray-500 bg-white hover:bg-gray-100 focus:ring-4 focus:outline-none focus:ring-gray-200 rounded-lg border border-gray-200 text-sm font-medium px-4 py-2.5 hover:text-gray-900 focus:z-10 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-500 dark:hover:text-white dark:hover:bg-gray-600 dark:focus:ring-gray-600 transition-colors duration-200"
            on:click={closePrescriptionDetails}
          >
            <i class="fas fa-times mr-1"></i>
            Close
          </button>
          <button 
            type="button" 
            class="w-full sm:w-auto text-white bg-teal-700 hover:bg-teal-800 focus:ring-4 focus:outline-none focus:ring-teal-300 font-medium rounded-lg text-sm px-4 py-2.5 text-center dark:bg-teal-600 dark:hover:bg-teal-700 dark:focus:ring-teal-800 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            on:click={markSelectedAsDispensed}
            disabled={dispensedMedications.size === 0}
          >
            <i class="fas fa-check mr-1"></i>
            {dispensedMedications.size > 0 ? `Mark ${dispensedMedications.size} as Dispensed` : 'Mark as Dispensed'}
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}

            </div>

<style>
  /* Custom styles for enhanced UI */
</style>
