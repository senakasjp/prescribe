// Charge Calculation Service for Pharmacy Portal
// Handles calculation of total prescription charges including doctor fees and drug costs

import firebaseStorage from '../firebaseStorage.js'
import pharmacistStorageService from './pharmacistStorageService.js'
import inventoryService from './inventoryService.js'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { db } from '../../firebase-config.js'

class ChargeCalculationService {
  toPositiveInteger(value) {
    const parsed = this.extractNumericValue(value)
    if (!parsed || parsed <= 0) return null
    const normalized = Math.trunc(parsed)
    return normalized > 0 ? normalized : null
  }

  isQtsMedication(medication) {
    if (!medication) return false
    if (this.isLiquidMedication(medication)) return false
    const dosageForm = String(medication.dosageForm || medication.form || '').trim().toLowerCase()
    if (!dosageForm) return false
    return !(
      dosageForm.includes('tablet') ||
      dosageForm.includes('tab') ||
      dosageForm.includes('capsule') ||
      dosageForm.includes('cap') ||
      dosageForm.includes('syrup') ||
      dosageForm.includes('liquid')
    )
  }

  resolveRequestedQuantity(medication) {
    if (!medication) return 0
    const enteredCount = this.toPositiveInteger(medication.qts)

    if (this.isMeasuredLiquidMedication(medication)) {
      const measuredLiquidAmount = this.calculateMeasuredLiquidAmount(medication)
      if (measuredLiquidAmount > 0) return measuredLiquidAmount
    }

    if (this.isQtsMedication(medication)) {
      const qtsQuantity = this.toPositiveInteger(medication.qts)
      if (qtsQuantity) {
        return qtsQuantity
      }
    }

    const parsedQuantity = this.parseMedicationQuantity(medication.amount)
    const isLiquid = this.isLiquidMedication(medication)
    const liquidAmount = isLiquid ? this.calculateLiquidAmount(medication) : 0

    if (liquidAmount > 0) return liquidAmount
    if (parsedQuantity !== null && parsedQuantity > 0) return parsedQuantity
    if (enteredCount) return enteredCount
    return 0
  }

  isLiquidMedication(medication) {
    if (!medication) return false
    const unit = String(medication.strengthUnit || '').trim().toLowerCase()
    const dosageForm = String(medication.dosageForm || medication.form || '').trim().toLowerCase()
    const strengthText = String(medication.strength || '').trim().toLowerCase()
    return (
      unit === 'ml' ||
      unit === 'l' ||
      dosageForm.includes('liquid') ||
      strengthText.includes('ml') ||
      strengthText.includes(' l')
    )
  }

  isMeasuredLiquidMedication(medication) {
    if (!medication) return false
    const dosageForm = String(medication.dosageForm || medication.form || '').trim().toLowerCase()
    return dosageForm === 'liquid (measured)'
  }

  resolveStrengthToMl(value, unitHint = '') {
    if (value === null || value === undefined || value === '') return null
    const normalized = String(value).trim().toLowerCase()
    const match = normalized.match(/(\d+(?:\.\d+)?)\s*(ml|l)\b/)
    if (match) {
      const amount = parseFloat(match[1])
      if (!Number.isFinite(amount)) return null
      return match[2] === 'l' ? amount * 1000 : amount
    }

    const unit = String(unitHint || '').trim().toLowerCase()
    const numeric = parseFloat(normalized.replace(/[^\d.]/g, ''))
    if (!Number.isFinite(numeric)) return null
    if (unit === 'l') return numeric * 1000
    if (unit === 'ml') return numeric
    return null
  }

  resolveDailyFrequency(frequency = '') {
    const value = String(frequency).toLowerCase()
    if (value.includes('once daily') || value.includes('(od)') || value.includes('mane') || value.includes('nocte') || value.includes('noon') || value.includes('vesper')) return 1
    if (value.includes('twice daily') || value.includes('(bd)')) return 2
    if (value.includes('three times daily') || value.includes('(tds)')) return 3
    if (value.includes('four times daily') || value.includes('(qds)')) return 4
    if (value.includes('every 4 hours') || value.includes('(q4h)')) return 6
    if (value.includes('every 6 hours') || value.includes('(q6h)')) return 4
    if (value.includes('every 8 hours') || value.includes('(q8h)')) return 3
    if (value.includes('every 12 hours') || value.includes('(q12h)')) return 2
    if (value.includes('every other day') || value.includes('(eod)')) return 0.5
    if (value.includes('weekly')) return 1 / 7
    if (value.includes('monthly')) return 1 / 30
    if (value.includes('stat')) return 1
    return 0
  }

  resolveDurationDays(duration = '') {
    const match = String(duration || '').match(/(\d+)\s*days?/i)
    if (!match) return 0
    const days = parseInt(match[1], 10)
    return Number.isFinite(days) ? days : 0
  }

  calculateLiquidAmount(medication) {
    const strengthMl = this.resolveStrengthToMl(
      medication?.strength,
      medication?.strengthUnit,
    )
    if (!strengthMl) return 0
    const days = this.resolveDurationDays(medication?.duration)
    if (!days) return 0
    const dailyFrequency = this.resolveDailyFrequency(medication?.frequency)
    if (!dailyFrequency) return 0
    return strengthMl * dailyFrequency * days
  }

  calculateMeasuredLiquidAmount(medication) {
    const strengthMl = this.resolveStrengthToMl(
      medication?.strength,
      medication?.strengthUnit,
    )
    if (!strengthMl) return 0
    const days = this.resolveDurationDays(medication?.duration)
    if (!days) return 0
    const dailyFrequency = this.resolveDailyFrequency(medication?.frequency)
    if (!dailyFrequency) return 0
    return strengthMl * dailyFrequency * days
  }
  constructor() {
    this.collections = {
      doctors: 'doctors',
      pharmacistInventory: 'pharmacistInventory'
    }
  }

  /**
   * Calculate total charge for a prescription
   * Formula: Charge = (Consultation charge + Hospital charge) * (1 - discount/100) + Drug charge
   * 
   * @param {Object} prescription - The prescription object
   * @param {Object} pharmacist - The pharmacist object
   * @returns {Promise<Object>} Charge breakdown and total
   */
  async calculatePrescriptionCharge(prescription, pharmacist) {
    try {
      console.log('💰 Calculating prescription charge for:', prescription.id)
      console.log('💰 Prescription object:', prescription)

      // Get doctor ID from prescription
      const doctorId = prescription.doctorId || prescription.doctor?.id

      if (!doctorId) {
        console.error('❌ Doctor ID is missing from prescription:', prescription)
        throw new Error('Doctor ID is required to calculate charges. Please ensure the prescription has a valid doctor ID.')
      }

      console.log('💰 Fetching doctor information for ID:', doctorId)

      // Get doctor information to fetch consultation and hospital charges
      const doctor = await this.getDoctorById(doctorId)
      if (!doctor) {
        throw new Error(`Doctor with ID ${doctorId} not found`)
      }

      const doctorCharges = this.calculateDoctorCharges(prescription, doctor)

      // Calculate drug charges for dispensed medications
      const drugCharges = await this.calculateDrugCharges(prescription, pharmacist)

      // Calculate total charge before rounding
      const totalChargeBeforeRounding = doctorCharges.totalAfterDiscount + drugCharges.totalCost

      // Get rounding preference from doctor settings (default: 'none')
      const roundingPreference = doctor?.roundingPreference || 'none'
      const roundedTotal = this.roundTotalCharge(totalChargeBeforeRounding, roundingPreference)
      const roundingAdjustment = roundedTotal - totalChargeBeforeRounding

      const chargeBreakdown = {
        doctorCharges,
        drugCharges: drugCharges,
        totalBeforeRounding: totalChargeBeforeRounding,
        roundingPreference: roundingPreference,
        roundingAdjustment: roundingAdjustment,
        totalCharge: roundedTotal,
        currency: pharmacist.currency || 'USD'
      }

      console.log('💰 Charge calculation completed:', chargeBreakdown)
      return chargeBreakdown

    } catch (error) {
      console.error('❌ Error calculating prescription charge:', error)
      throw error
    }
  }

  calculateDoctorCharges(prescription, doctor) {
    const baseConsultationCharge = parseFloat(doctor?.consultationCharge || 0)
    const excludeConsultationCharge = !!prescription?.excludeConsultationCharge
    const consultationCharge = excludeConsultationCharge ? 0 : baseConsultationCharge
    const hospitalCharge = parseFloat(doctor?.hospitalCharge || 0)

    const procedurePricingList = doctor?.templateSettings?.procedurePricing || []
    const procedurePricingMap = {}
    if (Array.isArray(procedurePricingList)) {
      procedurePricingList.forEach((item) => {
        if (item && item.name) {
          const parsed = Number(item.price)
          procedurePricingMap[item.name] = Number.isFinite(parsed) ? parsed : 0
        }
      })
    }

    let selectedProcedures = Array.isArray(prescription?.procedures) ? prescription.procedures : []
    if ((!selectedProcedures || selectedProcedures.length === 0) && Array.isArray(prescription?.prescriptions)) {
      const nestedProcedures = prescription.prescriptions
        .map((entry) => entry?.procedures || [])
        .flat()
        .filter(Boolean)
      selectedProcedures = Array.from(new Set(nestedProcedures))
    }

    const otherProcedurePrice = Number(prescription?.otherProcedurePrice)
    const procedureChargesBreakdown = selectedProcedures.map((name) => {
      const price = name === 'Other' && Number.isFinite(otherProcedurePrice)
        ? otherProcedurePrice
        : (procedurePricingMap[name] ?? 0)
      return {
        name,
        price: Number.isFinite(price) ? price : 0
      }
    })
    const totalProcedureCharges = procedureChargesBreakdown.reduce((sum, item) => sum + (item.price || 0), 0)

    const totalDoctorCharges = consultationCharge + hospitalCharge + totalProcedureCharges

    const discountPercentage = prescription?.discount || 0
    const discountScope = prescription?.discountScope || 'consultation'
    const discountBase = discountScope === 'consultation_hospital'
      ? (consultationCharge + hospitalCharge)
      : consultationCharge
    const discountAmount = discountBase * (discountPercentage / 100)
    const discountedDoctorCharges = totalDoctorCharges - discountAmount

    return {
      baseConsultationCharge: baseConsultationCharge,
      consultationCharge: consultationCharge,
      excludeConsultationCharge: excludeConsultationCharge,
      hospitalCharge: hospitalCharge,
      procedureCharges: {
        total: totalProcedureCharges,
        breakdown: procedureChargesBreakdown
      },
      totalBeforeDiscount: totalDoctorCharges,
      discountPercentage: discountPercentage,
      discountScope: discountScope,
      discountAmount: discountAmount,
      totalAfterDiscount: discountedDoctorCharges
    }
  }

  calculateExpectedDrugChargesFromInventory(prescription, inventoryItems, options = {}) {
    let totalCost = 0
    let medicationBreakdown = []
    let totalMedications = 0
    let missingPriceCount = 0
    let missingQuantityCount = 0
    const ignoreAvailability = !!options.ignoreAvailability
    const assumeDispensedForAvailable = !!options.assumeDispensedForAvailable

    const prescriptions = Array.isArray(prescription?.prescriptions) && prescription.prescriptions.length > 0
      ? prescription.prescriptions
      : [{ medications: prescription?.medications || [] }]

    prescriptions.forEach((presc) => {
      const meds = presc?.medications || []
      meds.forEach((medication) => {
        const requestedQuantity = this.resolveRequestedQuantity(medication)
        if (!requestedQuantity || requestedQuantity <= 0) {
          missingQuantityCount += 1
          return
        }

        const pricingSources = this.buildInventoryPricingSources(
          medication,
          inventoryItems || [],
          medication?.inventoryMatch && medication?.inventoryMatch?.found ? medication.inventoryMatch : null
        )

        if (!pricingSources.length) {
          if (!assumeDispensedForAvailable) {
            missingPriceCount += 1
          }
          return
        }

        if (ignoreAvailability) {
          const source = pricingSources[0]
          const unitCost = source.unitCost ?? 0
          if (!unitCost) {
            if (!assumeDispensedForAvailable) {
              missingPriceCount += 1
            }
            return
          }
          const lineCost = requestedQuantity * unitCost
          totalCost += lineCost
          totalMedications += 1
          medicationBreakdown.push({
            medicationName: medication.name,
            dosage: medication.dosage,
            frequency: medication.frequency,
            duration: medication.duration,
            quantity: requestedQuantity,
            pricedQuantity: requestedQuantity,
            unitCost: unitCost,
            totalCost: lineCost,
            found: true,
            allocationDetails: [{
              quantity: requestedQuantity,
              unitCost: unitCost,
              lineCost: lineCost,
              inventoryItemId: source.inventoryItemId,
              expiryDate: source.expiryDate,
              brandName: source.brandName,
              genericName: source.genericName
            }]
          })
          return
        }

        const allocation = this.allocateQuantityAcrossSources(requestedQuantity, pricingSources)
        if (allocation.totalPricedQuantity <= 0) {
          if (!assumeDispensedForAvailable) {
            missingPriceCount += 1
          }
          return
        }

        totalCost += allocation.totalCost
        totalMedications += 1
        medicationBreakdown.push({
          medicationName: medication.name,
          dosage: medication.dosage,
          frequency: medication.frequency,
          duration: medication.duration,
          quantity: requestedQuantity,
          pricedQuantity: allocation.totalPricedQuantity,
          unitCost: allocation.averageUnitCost,
          totalCost: allocation.totalCost,
          found: allocation.remainingQuantity <= 0,
          allocationDetails: allocation.allocations.map(entry => ({
            quantity: entry.quantity,
            unitCost: entry.unitCost,
            lineCost: entry.lineCost,
            inventoryItemId: entry.inventoryItemId,
            expiryDate: entry.expiryDate,
            brandName: entry.brandName,
            genericName: entry.genericName
          }))
        })
      })
    })

    return {
      totalCost,
      totalMedications,
      medicationBreakdown,
      missingPriceCount,
      missingQuantityCount
    }
  }

  calculateExpectedChargeFromStock(prescription, doctor, inventoryItems, options = {}) {
    const doctorCharges = this.calculateDoctorCharges(prescription, doctor || {})
    const drugCharges = this.calculateExpectedDrugChargesFromInventory(
      prescription,
      inventoryItems || [],
      { 
        ignoreAvailability: !!options.ignoreAvailability,
        assumeDispensedForAvailable: !!options.assumeDispensedForAvailable
      }
    )

    const totalChargeBeforeRounding = doctorCharges.totalAfterDiscount + drugCharges.totalCost
    const roundingPreference = options.roundingPreference || 'none'
    const roundedTotal = this.roundTotalCharge(totalChargeBeforeRounding, roundingPreference)
    const roundingAdjustment = roundedTotal - totalChargeBeforeRounding

    return {
      doctorCharges,
      drugCharges,
      totalBeforeRounding: totalChargeBeforeRounding,
      roundingPreference,
      roundingAdjustment,
      totalCharge: roundedTotal,
      currency: options.currency || 'USD'
    }
  }

  /**
   * Get doctor information by ID
   * @param {string} doctorId - Doctor ID
   * @returns {Promise<Object>} Doctor object
   */
  async getDoctorById(doctorId) {
    try {
      let doctor = await firebaseStorage.getDoctorById(doctorId)
      if (!doctor && typeof doctorId === 'string' && doctorId.toUpperCase().startsWith('DR')) {
        doctor = await firebaseStorage.getDoctorByShortId(doctorId)
      }
      return doctor
    } catch (error) {
      console.error('❌ Error getting doctor by ID:', error)
      throw error
    }
  }

  /**
   * Calculate drug charges for dispensed medications
   * @param {Object} prescription - The prescription object
   * @param {Object} pharmacist - The pharmacist object
   * @returns {Promise<Object>} Drug charges breakdown
   */
  async calculateDrugCharges(prescription, pharmacist) {
    try {
      console.log('💊 Calculating drug charges for prescription:', prescription.id)
      
      const pharmacyId = pharmacist?.pharmacyId || pharmacist?.id || pharmacist?.uid
      if (!pharmacyId) {
        throw new Error('Pharmacy information not available for drug charge calculation')
      }

      let totalCost = 0
      let medicationBreakdown = []
      let totalMedications = 0

      // Get pharmacist's inventory using the new inventory service
      const inventoryItems = await inventoryService.getInventoryItems(pharmacyId)
      console.log('💊 Retrieved inventory items:', inventoryItems.length, 'items')
      
      // Process each prescription in the prescription object
      if (prescription.prescriptions && prescription.prescriptions.length > 0) {
        for (const presc of prescription.prescriptions) {
          if (presc.medications && presc.medications.length > 0) {
            for (const medication of presc.medications) {
              // Only calculate charges for medications that are checked/dispensed
              if (!medication.isDispensed) {
                continue
              }

              const requestedQuantity = this.resolveRequestedQuantity(medication)

              const pricingSources = this.buildInventoryPricingSources(
                medication,
                inventoryItems,
                medication.inventoryMatch && medication.inventoryMatch.found ? medication.inventoryMatch : null
              )

              if (requestedQuantity > 0 && pricingSources.length > 0) {
                const allocation = this.allocateQuantityAcrossSources(requestedQuantity, pricingSources)

                if (allocation.totalPricedQuantity > 0) {
                  totalCost += allocation.totalCost
                  totalMedications++

                  medicationBreakdown.push({
                    medicationName: medication.name,
                    dosage: medication.dosage,
                    frequency: medication.frequency,
                    duration: medication.duration,
                    quantity: requestedQuantity,
                    pricedQuantity: allocation.totalPricedQuantity,
                    unitCost: allocation.averageUnitCost,
                    totalCost: allocation.totalCost,
                    found: allocation.remainingQuantity <= 0,
                    allocationDetails: allocation.allocations.map(entry => ({
                      quantity: entry.quantity,
                      unitCost: entry.unitCost,
                      lineCost: entry.lineCost,
                      inventoryItemId: entry.inventoryItemId,
                      expiryDate: entry.expiryDate,
                      brandName: entry.brandName,
                      genericName: entry.genericName
                    })),
                    note: allocation.remainingQuantity > 0
                      ? `Only priced ${allocation.totalPricedQuantity} of ${requestedQuantity}`
                      : undefined
                  })
                } else {
                  medicationBreakdown.push({
                    medicationName: medication.name,
                    dosage: medication.dosage,
                    frequency: medication.frequency,
                    duration: medication.duration,
                    quantity: requestedQuantity,
                    pricedQuantity: 0,
                    unitCost: 0,
                    totalCost: 0,
                    found: false,
                    note: 'Unable to allocate stock across available batches'
                  })
                }
              } else {
                medicationBreakdown.push({
                  medicationName: medication.name,
                  dosage: medication.dosage,
                  frequency: medication.frequency,
                  duration: medication.duration,
                  quantity: requestedQuantity,
                  pricedQuantity: 0,
                  unitCost: 0,
                  totalCost: 0,
                  found: false,
                  note: requestedQuantity <= 0
                    ? 'No quantity specified'
                    : 'Not available in inventory'
                })
              }
            }
          }
        }
      }

      const drugCharges = {
        totalCost: totalCost,
        totalMedications: totalMedications,
        medicationBreakdown: medicationBreakdown
      }

      console.log('💊 Drug charges calculated:', drugCharges)
      return drugCharges

    } catch (error) {
      console.error('❌ Error calculating drug charges:', error)
      throw error
    }
  }

  /**
   * Find matching drug in inventory by name (case-insensitive partial match)
   * @param {string} medicationName - Name of the medication
   * @param {Array} inventoryItems - Array of inventory items
   * @returns {Object|null} Matching drug object or null
   */
  findMatchingDrugs(medication, inventoryItems) {
    if (!medication || !inventoryItems || inventoryItems.length === 0) {
      return []
    }

    const medicationNames = this.buildMedicationNameSet(medication)
    const medicationKey = this.buildMedicationKey(medication)
    const matches = []

    for (const item of inventoryItems) {
      const itemNames = this.buildInventoryNameSet(item)
      const itemKey = this.buildInventoryKey(item)

      const keyMatch = medicationKey && itemKey && itemKey === medicationKey

      const hasMatch = Array.from(medicationNames).some(medName =>
        Array.from(itemNames).some(invName =>
          invName &&
          (
            invName === medName ||
            invName.includes(medName) ||
            medName.includes(invName)
          )
        )
      )

      if (keyMatch || hasMatch) {
        matches.push(item)
      }
    }

    return matches.sort((a, b) => {
      const aTime = a.expiryDate ? new Date(a.expiryDate).getTime() : Infinity
      const bTime = b.expiryDate ? new Date(b.expiryDate).getTime() : Infinity
      return aTime - bTime
    })
  }

  buildInventoryPricingSources(medication, inventoryItems, inventoryContext) {
    const isLiquid = this.isLiquidMedication(medication)
    const isMeasuredLiquid = this.isMeasuredLiquidMedication(medication)
    const sources = []
    const inventoryById = new Map()
    inventoryItems.forEach(item => inventoryById.set(item.id, item))

    const addSource = (entry) => {
      if (!entry) return

      if (Array.isArray(entry.batches) && entry.batches.length > 0) {
        entry.batches
          .filter(batch => (batch.status || 'active') === 'active')
          .forEach(batch => addSource({
            inventoryItemId: entry.id,
            batchId: batch.id || batch.batchNumber || null,
            currentStock: batch.quantity ?? batch.currentStock ?? 0,
            sellingPrice: batch.sellingPrice ?? entry.sellingPrice,
            expiryDate: batch.expiryDate ?? entry.expiryDate,
            brandName: entry.brandName,
            genericName: entry.genericName,
            packUnit: batch.packUnit ?? entry.packUnit
          }))
        return
      }

      let available = this.extractNumericValue(entry.currentStock ?? entry.available ?? entry.quantity ?? 0)
      let unitCost = this.parseCurrencyValue(entry.sellingPrice ?? entry.unitCost ?? entry.costPrice)
      if (!available || available <= 0) return
      if (unitCost === null) return

      if (isLiquid) {
        const packMl = this.resolveStrengthToMl(
          entry.strength ?? entry.dosage ?? entry.packSize,
          entry.strengthUnit ?? entry.unit ?? entry.packUnit
        )
        if (packMl && packMl > 0) {
          available *= packMl
          unitCost /= packMl
        } else if (isMeasuredLiquid) {
          // Measured liquid pricing must use unit ml price from inventory.
          return
        }
      }

      sources.push({
        inventoryItemId: entry.inventoryItemId ?? entry.id ?? entry.itemId ?? null,
        batchId: entry.batchId ?? null,
        packUnit: entry.packUnit ?? null,
        available,
        unitCost,
        expiryDate: entry.expiryDate || null,
        brandName: entry.brandName || null,
        genericName: entry.genericName || null,
        strength: entry.strength ?? null,
        strengthUnit: entry.strengthUnit ?? null
      })
    }

    if (inventoryContext && Array.isArray(inventoryContext.matches) && inventoryContext.matches.length > 0) {
      inventoryContext.matches.forEach(match => {
        const resolved = match.inventoryItemId ? inventoryById.get(match.inventoryItemId) : null
        if (resolved && (!resolved.batches || resolved.batches.length === 0)) {
          addSource(resolved)
        }
        addSource({
          inventoryItemId: match.inventoryItemId || resolved?.id || null,
          batchId: match.batchId || null,
          currentStock: match.currentStock ?? resolved?.currentStock,
          sellingPrice: match.sellingPrice ?? resolved?.sellingPrice,
          expiryDate: match.expiryDate ?? resolved?.expiryDate,
          brandName: match.brandName ?? resolved?.brandName,
          genericName: match.genericName ?? resolved?.genericName,
          packUnit: match.packUnit ?? resolved?.packUnit,
          batches: match.batches
        })
      })
    }

    if (sources.length === 0 && inventoryContext?.inventoryItemId) {
      const resolved = inventoryById.get(inventoryContext.inventoryItemId)
      if (resolved) {
        addSource(resolved)
      }
    }

    if (sources.length === 0) {
      const fallbackMatches = this.findMatchingDrugs(medication, inventoryItems)
      fallbackMatches.forEach(addSource)
    }

    return sources.sort((a, b) => {
      const aTime = a.expiryDate ? new Date(a.expiryDate).getTime() : Infinity
      const bTime = b.expiryDate ? new Date(b.expiryDate).getTime() : Infinity
      return aTime - bTime
    })
  }

  allocateQuantityAcrossSources(requestedQuantity, sources) {
    let remaining = requestedQuantity
    const allocations = []
    let totalCost = 0
    let totalPricedQuantity = 0

    for (const source of sources) {
      if (remaining <= 0) break
      const available = source.available || 0
      if (available <= 0) continue

      const quantityFromSource = Math.min(remaining, available)
      if (quantityFromSource <= 0) continue

      const lineCost = quantityFromSource * source.unitCost

      allocations.push({
        inventoryItemId: source.inventoryItemId,
        batchId: source.batchId || null,
        quantity: quantityFromSource,
        unitCost: source.unitCost,
        lineCost,
        expiryDate: source.expiryDate,
        brandName: source.brandName,
        genericName: source.genericName,
        packUnit: source.packUnit || null
      })

      totalCost += lineCost
      totalPricedQuantity += quantityFromSource
      remaining -= quantityFromSource
    }

    const averageUnitCost = totalPricedQuantity > 0 ? totalCost / totalPricedQuantity : 0

    return {
      allocations,
      totalCost,
      totalPricedQuantity,
      remainingQuantity: remaining,
      averageUnitCost
    }
  }

  normalizeName(value) {
    return (value || '')
      .toLowerCase()
      .replace(/[\u3000\s]+/g, ' ')
      .replace(/[\(\)（）]/g, '')
      .trim()
  }

  normalizeKeyPart(value) {
    return (value || '')
      .toString()
      .toLowerCase()
      .replace(/[\u3000\s]+/g, ' ')
      .replace(/[^\w\s]/g, '')
      .trim()
  }

  parseStrength(value, fallbackUnit = '') {
    if (!value) {
      return { strength: '', unit: '' }
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

  buildMedicationKey(medication) {
    if (!medication) return ''

    const name = medication.name || ''
    const genericName = medication.genericName || ''
    const dosageForm = medication.dosageForm || medication.form || ''
    const strengthValue = medication.strength ?? medication.dosage
    const strengthUnit = (medication.strengthUnit ?? medication.dosageUnit) || ''
    const { strength, unit } = this.parseStrength(strengthValue, strengthUnit)

    const parts = [
      this.normalizeKeyPart(name),
      this.normalizeKeyPart(genericName),
      this.normalizeKeyPart(strength),
      this.normalizeKeyPart(unit),
      this.normalizeKeyPart(dosageForm)
    ].filter(Boolean)

    return parts.join('|')
  }

  buildInventoryKey(item) {
    if (!item) return ''

    const dosageForm = item.dosageForm || item.packUnit || item.unit || ''
    const parts = [
      this.normalizeKeyPart(item.brandName || item.drugName || ''),
      this.normalizeKeyPart(item.genericName || ''),
      this.normalizeKeyPart(item.strength || ''),
      this.normalizeKeyPart(item.strengthUnit || ''),
      this.normalizeKeyPart(dosageForm)
    ].filter(Boolean)

    return parts.join('|')
  }

  buildMedicationNameSet(medication) {
    const names = new Set()
    const medicationName = medication.name || ''
    const genericName = medication.genericName || ''

    names.add(this.normalizeName(medicationName))
    names.add(this.normalizeName(genericName))

    const brandFromName = medicationName.split(/[\(（]/)[0]?.trim()
    const genericFromName = medicationName.includes('(') || medicationName.includes('（')
      ? medicationName.split(/[\(（]/)[1]?.replace(/[\)）]/, '').trim()
      : ''

    names.add(this.normalizeName(brandFromName))
    names.add(this.normalizeName(genericFromName))

    names.delete('')
    return names
  }

  buildInventoryNameSet(item) {
    const names = new Set()

    const brandName = item.brandName || ''
    const genericName = item.genericName || ''
    const drugName = item.drugName || ''

    names.add(this.normalizeName(brandName))
    names.add(this.normalizeName(genericName))
    names.add(this.normalizeName(drugName))

    if (brandName) {
      names.add(this.normalizeName(brandName.split(/[\(（]/)[0]))
    }

    names.delete('')
    return names
  }

  /**
   * Parse medication quantity from various prescription amount formats
   * @param {string|number} amount - Prescription amount value
   * @returns {number|null} Parsed quantity or null if unavailable
   */
  parseMedicationQuantity(amount) {
    return this.extractNumericValue(amount)
  }

  /**
   * Parse currency or numeric string values into numbers
   * @param {string|number} value
   * @returns {number|null}
   */
  parseCurrencyValue(value) {
    return this.extractNumericValue(value)
  }

  extractNumericValue(rawValue) {
    if (typeof rawValue === 'number') {
      return Number.isFinite(rawValue) ? rawValue : null
    }

    if (typeof rawValue === 'string') {
      const normalized = rawValue.replace(/,/g, '').trim()
      if (!normalized) {
        return null
      }

      const match = normalized.match(/-?\d+(\.\d+)?/)
      if (match) {
        const parsed = parseFloat(match[0])
        return Number.isFinite(parsed) ? parsed : null
      }
    }

    return null
  }

  /**
   * Round total charge to nearest 50 or 100 based on preference
   * @param {number} amount - Amount to round
   * @param {string} roundingPreference - 'none', 'nearest50', or 'nearest100'
   * @returns {number} Rounded amount
   */
  roundTotalCharge(amount, roundingPreference = 'none') {
    if (!amount || amount <= 0) {
      return amount
    }

    switch (roundingPreference) {
      case 'nearest50':
        // Round to nearest 50
        return Math.round(amount / 50) * 50

      case 'nearest100':
        // Round to nearest 100
        return Math.round(amount / 100) * 100

      case 'none':
      default:
        // No rounding
        return amount
    }
  }

  /**
   * Format currency amount based on pharmacist's currency setting
   * @param {number} amount - Amount to format
   * @param {string} currency - Currency code
   * @returns {string} Formatted currency string
   */
  formatCurrency(amount, currency = 'USD') {
    try {
      const formatted = new Intl.NumberFormat('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).format(amount)
      return `${currency} ${formatted}`
    } catch (error) {
      console.error('❌ Error formatting currency:', error)
      return amount.toFixed(2)
    }
  }
}

// Create singleton instance
const chargeCalculationService = new ChargeCalculationService()
export default chargeCalculationService
