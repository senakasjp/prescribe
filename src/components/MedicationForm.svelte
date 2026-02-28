<script>
  import { createEventDispatcher, onMount } from 'svelte'
  import { pharmacyMedicationService } from '../services/pharmacyMedicationService.js'
  import { MEDICATION_FREQUENCIES } from '../utils/constants.js'
  import {
    STRENGTH_UNITS,
    DOSAGE_FORM_OPTIONS,
    normalizeDosageFormValue
  } from '../utils/medicationOptions.js'
  import {
    supportsStrengthForDosageForm,
    isInventoryLockedStrengthDosageForm
  } from '../utils/prescriptionMedicationSemantics.js'
  import openaiService from '../services/openaiService.js'
  import authService from '../services/doctor/doctorAuthService.js'
  import DateInput from './DateInput.svelte'

  export let visible = true
  export let editingMedication = null
  export let doctorId = null
  export let allowNonPharmacyDrugs = true
  export let excludePharmacyDrugs = false
  export let savingMedication = false

  const dispatch = createEventDispatcher()

  let name = ''
  let genericName = '' // Generic name for display
  let dosage = ''
  let dosageUnit = ''
  const TABLET_DOSAGE_OPTIONS = ['1/4', '1/3', '1/2', '3/4', '1', '1 1/4', '1 1/2', '2', '3', '4', '5', '6', '7', '8']
  const NON_TABLET_DOSAGE_OPTIONS = ['1', '2', '3', '4', '5', '6', '7', '8']
  let dosageForm = ''
  let strength = ''
  let strengthUnit = ''
  let route = 'PO'
  let instructions = ''
  let frequency = ''
  let prnAmount = '' // Amount for PRN medications
  let qts = ''
  let liquidDosePerFrequencyMl = ''
  let totalVolume = ''
  let volumeUnit = 'ml'
  let inventoryStrengthText = ''
  let requiresDosageInput = false
  let timing = ''
  const TIMING_OPTIONS = [
    'Before meals (AC)',
    'After meals (PC)',
    'At bedtime (HS)',
    'As needed (PRN-SOS)',
    'Mane',
    'Vesper'
  ]
  const TIMING_EXCLUSIONS = [
    'Before meals (AC)',
    'After meals (PC)',
    'At bedtime (HS)'
  ]
  $: frequencyOptions = MEDICATION_FREQUENCIES.filter(
    (freq) => !TIMING_EXCLUSIONS.includes(freq),
  )
  let duration = ''
  let startDate = ''
  let endDate = ''
  let notes = ''
  let error = ''
  let loading = false
  let improvingBrandName = false
  let brandNameImproved = false
  let lastImprovedName = ''
  let improvingInstructions = false
  let instructionsImproved = false
  let lastImprovedInstructions = ''
  let improvingNotes = false
  let notesImproved = false
  let lastImprovedNotes = ''

  const focusField = (id) => {
    const el = document.getElementById(id)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      el.focus()
    }
  }

  // Mapping for routes to their full display names
  const routeDisplayMap = {
    'IM': 'Intramuscular (IM)',
    'IV': 'Intravenous (IV)',
    'SC': 'Subcutaneous (SC)',
    'PO': 'Oral (PO)',
    'Topical': 'Topical',
    'Inhalation': 'Inhalation',
    'Rectal': 'Rectal',
    'Vaginal': 'Vaginal',
    'Otic': 'Ear (Otic)',
    'Ophthalmic': 'Eye (Ophthalmic)',
    'Nasal': 'Nasal',
    'Transdermal': 'Transdermal'
  }

  // Reactive statement to get the display value for the right input
  $: routeDisplay = route ? routeDisplayMap[route] || route : ''

  // Autofill suggestions state (inventory + local database)
  let nameSuggestions = []
  let showNameSuggestions = false
  let nameSelectedIndex = -1
  let nameSearchTimeout = null
  let isInventoryDrug = false
  let selectedInventoryItemId = ''
  let selectedInventoryPharmacyId = ''
  let selectedInventoryCurrentStock = null
  let selectedInventoryStorageLocation = ''
  let lastClearedDoctorId = ''
  const clearPharmacyMedicationCache = (resolvedDoctorId) => {
    if (!resolvedDoctorId) return
    const clearCacheFn = pharmacyMedicationService?.clearCache
    if (typeof clearCacheFn === 'function') {
      clearCacheFn.call(pharmacyMedicationService, resolvedDoctorId)
    }
  }
  const resolveLiquidUnitFromStrength = (value) => {
    const raw = String(value || '').trim().toLowerCase()
    if (!raw) return ''
    const match = raw.match(/(\d+(?:\.\d+)?)\s*(ml|l)\b/)
    return match ? match[2] : ''
  }

  $: isLiquidStrengthUnit = ['ml', 'l'].includes(String(strengthUnit || '').trim().toLowerCase()) ||
    Boolean(resolveLiquidUnitFromStrength(strength))
  const isCountExcludedDispenseForm = (value) => {
    const form = normalizeDosageFormValue(value).toLowerCase()
    return form === 'tablet' || form === 'capsule' || form === 'liquid (measured)'
  }
  const isLiquidDispenseForm = (value) => {
    const form = String(value || '').trim().toLowerCase()
    return form === 'liquid (bottles)' || form === 'liquid (measured)'
  }
  const isDosageRequiredDispenseForm = (value) => {
    const form = String(value || '').trim().toLowerCase()
    return form.includes('tablet') || form.includes('capsule')
  }
  const isTabletDispenseForm = (value) => normalizeDosageFormValue(value).toLowerCase() === 'tablet'
  const isStrengthBasedDispenseForm = (value) => supportsStrengthForDosageForm(value)
  const parseStrengthParts = (rawStrength, rawUnit = '') => {
    const strengthValue = String(rawStrength || '').trim()
    const explicitUnit = String(rawUnit || '').trim()
    if (!strengthValue) {
      return { value: '', unit: '' }
    }
    if (explicitUnit) {
      return { value: strengthValue, unit: explicitUnit }
    }
    const joinedMatch = strengthValue.match(/^(\d+(?:\.\d+)?)\s*([a-zA-Z%]+)$/)
    if (joinedMatch) {
      return {
        value: joinedMatch[1],
        unit: joinedMatch[2]
      }
    }
    return { value: strengthValue, unit: '' }
  }
  const isVolumeUnit = (value) => ['ml', 'l'].includes(String(value || '').trim().toLowerCase())
  const getSuggestionStrengthText = (suggestion) => {
    const dosage = normalizeDosageFormValue(suggestion?.dosageForm || suggestion?.form || '')
    const parsed = parseStrengthParts(suggestion?.strength, suggestion?.strengthUnit || suggestion?.unit || '')
    if (!parsed.value) return ''
    // Non-strength forms should not surface right-side strength labels in prescription flows.
    if (!isStrengthBasedDispenseForm(dosage)) return ''
    return [parsed.value, parsed.unit].filter(Boolean).join(' ')
  }
  const getSuggestionVolumeText = (suggestion) => {
    const containerSize = String(suggestion?.containerSize ?? '').trim()
    const containerUnit = String(suggestion?.containerUnit || '').trim()
    if (containerSize) {
      return [containerSize, containerUnit].filter(Boolean).join(' ')
    }

    const dosage = normalizeDosageFormValue(suggestion?.dosageForm || suggestion?.form || '')
    const parsed = parseStrengthParts(suggestion?.strength, suggestion?.strengthUnit || suggestion?.unit || '')
    if (!isStrengthBasedDispenseForm(dosage) && parsed.value && isVolumeUnit(parsed.unit)) {
      return [parsed.value, parsed.unit].filter(Boolean).join(' ')
    }
    return ''
  }
  const getSuggestionStockUnitLabel = (suggestion) => {
    const packUnit = String(suggestion?.packUnit || '').trim()
    const dosage = normalizeDosageFormValue(suggestion?.dosageForm || suggestion?.form || '')
    if (!packUnit) {
      return dosage || 'units'
    }
    const normalizedPack = packUnit.toLowerCase()
    if (!isStrengthBasedDispenseForm(dosage) && (normalizedPack === 'tablet' || normalizedPack === 'tablets')) {
      return dosage || 'units'
    }
    return packUnit
  }
  const isMeasuredLiquidDispenseForm = (value) => String(value || '').trim().toLowerCase() === 'liquid (measured)'
  const isLiquidBottlesDispenseForm = (value) => String(value || '').trim().toLowerCase() === 'liquid (bottles)'
  const parseVolumeFromText = (value) => {
    const match = String(value || '').trim().match(/(\d+(?:\.\d+)?)\s*(ml|l)\b/i)
    if (!match) return { value: '', unit: '' }
    return { value: match[1], unit: match[2].toLowerCase() }
  }
  const parseAmountWithUnit = (value) => {
    const match = String(value || '').trim().match(/(\d+(?:\.\d+)?)\s*([a-zA-Z%]+)\b/i)
    if (!match) return { value: '', unit: '' }
    return { value: match[1], unit: match[2] }
  }
  const moveVolumeFromStrengthForInventoryLiquidBottles = () => {
    if (!isInventoryDrug || !isLiquidBottlesDispenseForm(dosageForm)) return
    if (String(totalVolume || '').trim()) return

    const parsedDirect = parseVolumeFromText(`${strength || ''} ${strengthUnit || ''}`)
    const parsedFallback = parseVolumeFromText(inventoryStrengthText || '')
    const parsed = parsedDirect.value ? parsedDirect : parsedFallback
    if (!parsed.value) return

    totalVolume = parsed.value
    volumeUnit = parsed.unit || volumeUnit || 'ml'
    strength = ''
    strengthUnit = ''
  }
  const shouldUseTotalVolumeLabel = (formValue, unitValue) => {
    const normalizedForm = normalizeDosageFormValue(formValue).toLowerCase()
    const rawForm = String(formValue || '').trim().toLowerCase()
    const form = normalizedForm || rawForm

    if (form) {
      return !supportsStrengthForDosageForm(form)
    }

    // Fallback when form isn't selected yet: infer from explicit volume unit.
    const unit = String(unitValue || '').trim().toLowerCase()
    return unit === 'ml' || unit === 'l'
  }
  $: isInventoryVolumeLocked = Boolean(
    isInventoryDrug &&
    shouldUseTotalVolumeLabel(dosageForm, strengthUnit) &&
    !isLiquidBottlesDispenseForm(dosageForm)
  )
  $: supportsStrengthInput = supportsStrengthForDosageForm(dosageForm)
  $: isInventoryStrengthLocked = isInventoryDrug && isInventoryLockedStrengthDosageForm(dosageForm)
  $: showEditableStrengthInput = supportsStrengthInput && (!isInventoryDrug || !isInventoryStrengthLocked)
  $: requiresDosageInput = isDosageRequiredDispenseForm(dosageForm)
  $: dosageOptions = isTabletDispenseForm(dosageForm) ? TABLET_DOSAGE_OPTIONS : NON_TABLET_DOSAGE_OPTIONS
  $: requiresQts = Boolean(String(dosageForm || '').trim()) && !isCountExcludedDispenseForm(dosageForm)
  $: qtsDisplayUnit = isInventoryDrug && requiresQts
    ? (String(dosageForm || '').trim() || 'ml')
    : 'ml'
  const getCountExampleUnit = (value) => {
    const raw = String(value || '').trim()
    if (!raw) return 'units'
    const lower = raw.toLowerCase()
    if (lower === 'liquid (measured)') return 'ml'
    const match = raw.match(/\(([^)]+)\)/)
    if (match?.[1]) return match[1].trim().toLowerCase()
    return lower
  }
  $: countPlaceholder = requiresQts
    ? `e.g., 2 ${getCountExampleUnit(dosageForm)}`
    : (isLiquidDispenseForm(dosageForm) ? 'Amount' : 'Qunatity')
  const parsePositiveInteger = (value) => {
    const raw = String(value ?? '').trim()
    if (!/^\d+$/.test(raw)) return null
    const parsed = Number(raw)
    if (!Number.isFinite(parsed) || parsed <= 0) return null
    return parsed
  }
  const deriveGenericNameFromBrand = (value = '') => {
    const raw = String(value || '').trim()
    if (!raw || !raw.includes('-')) return ''
    const [prefix] = raw.split('-')
    let candidate = String(prefix || '').replace(/\s+/g, ' ').trim()
    if (!candidate) return ''
    candidate = candidate.replace(/\b(?:tablet|capsule|syrup|cream|ointment|gel|suppository|inhaler|spray|shampoo|packet|roll|injection|liquid)\b$/i, '').trim()
    if (!candidate || candidate.length < 3) return ''
    if (candidate.toLowerCase() === raw.toLowerCase()) return ''
    return candidate
  }
  $: if (!requiresDosageInput && dosage) {
    dosage = ''
  }
  $: if (requiresDosageInput && !dosage) {
    dosage = '1'
  }
  $: if (requiresDosageInput && !isTabletDispenseForm(dosageForm) && String(dosage || '').includes('/')) {
    dosage = '1'
  }
  $: if (!requiresQts && qts) {
    qts = ''
    liquidDosePerFrequencyMl = ''
  }
  $: if (!isLiquidBottlesDispenseForm(dosageForm) && supportsStrengthInput) {
    totalVolume = ''
  }
  
  // Reset loading state when form is hidden
  $: if (!visible) {
    loading = false
    improvingBrandName = false
    brandNameImproved = false
    improvingInstructions = false
    instructionsImproved = false
    improvingNotes = false
    notesImproved = false
  }

  // Reset improved state only when the user edits after a successful correction
  $: if (!improvingBrandName && brandNameImproved && name !== lastImprovedName) {
    brandNameImproved = false
  }

  $: if (!improvingInstructions && instructionsImproved && instructions !== lastImprovedInstructions) {
    instructionsImproved = false
  }

  $: if (!improvingNotes && notesImproved && notes !== lastImprovedNotes) {
    notesImproved = false
  }
  
  // Track if form has been initialized for editing
  let formInitialized = false
  let formKey = 0
  
  // Function to reset form to empty state
  const resetForm = () => {
    console.log('🔄 Resetting MedicationForm to empty state')
    // Force reset all variables to empty strings
    name = ''
    genericName = ''
    dosage = ''
    dosageUnit = ''
    dosageForm = ''
    strength = ''
    strengthUnit = ''
    isInventoryDrug = false
    selectedInventoryItemId = ''
    selectedInventoryPharmacyId = ''
    selectedInventoryCurrentStock = null
    selectedInventoryStorageLocation = ''
    route = 'PO' // Set default route
    instructions = ''
    frequency = ''
    prnAmount = ''
    qts = ''
    liquidDosePerFrequencyMl = ''
    totalVolume = ''
    volumeUnit = 'ml'
    inventoryStrengthText = ''
    timing = ''
    duration = ''
    startDate = ''
    endDate = ''
    notes = ''
    timing = ''
    error = ''
    formInitialized = false
    formKey++ // Increment key to force DrugAutocomplete reset
    
    // Force a small delay to ensure state updates
    setTimeout(() => {
      console.log('✅ MedicationForm reset complete - final state:', {
        name, genericName, dosage, dosageForm, instructions, frequency, duration, startDate, endDate, notes
      })
    }, 10)
  }
  
  // Populate form when editing (only once)
  $: if (editingMedication && !formInitialized) {
    name = editingMedication.name || ''
    genericName = editingMedication.genericName || ''
    dosageForm = normalizeDosageFormValue(
      editingMedication.dosageForm ||
      editingMedication.form ||
      editingMedication.packUnit ||
      editingMedication.unit ||
      ''
    )
    strength = editingMedication.strength || ''
    strengthUnit = editingMedication.strengthUnit || ''
    
    // Parse dosage if it exists
    if (isDosageRequiredDispenseForm(dosageForm) && editingMedication.dosage) {
      const rawDosage = String(editingMedication.dosage || '').trim()
      dosage = rawDosage.replace(/[a-zA-Z]+/g, '').trim() || rawDosage
      dosageUnit = ''
    } else {
      dosage = isDosageRequiredDispenseForm(dosageForm) ? '1' : ''
      dosageUnit = ''
    }
    
    route = editingMedication.route || ''
    instructions = editingMedication.instructions || ''
    timing = editingMedication.timing || ''
    frequency = editingMedication.frequency || ''
    prnAmount = editingMedication.prnAmount || ''
    qts = editingMedication.qts || ''
    if (isLiquidDispenseForm(dosageForm) && !qts) {
      qts = editingMedication.liquidAmountMl || editingMedication.amountMl || ''
    }
    liquidDosePerFrequencyMl = editingMedication.liquidDosePerFrequencyMl || editingMedication.perFrequencyMl || ''
    totalVolume = String(
      editingMedication.totalVolume ??
      editingMedication.volume ??
      editingMedication.containerSize ??
      ''
    ).trim()
    volumeUnit = String(
      editingMedication.volumeUnit ||
      editingMedication.containerUnit ||
      volumeUnit ||
      'ml'
    ).trim() || 'ml'
    inventoryStrengthText = editingMedication.inventoryStrengthText || [editingMedication.strength || '', editingMedication.strengthUnit || ''].filter(Boolean).join(' ')
    // Remove 'days' suffix if present for editing
    duration = editingMedication.duration ? editingMedication.duration.replace(/\s*days?$/i, '') : ''
    startDate = editingMedication.startDate || ''
    endDate = editingMedication.endDate || ''
    notes = editingMedication.notes || ''
    isInventoryDrug = editingMedication?.source === 'inventory'
    selectedInventoryItemId = editingMedication?.inventoryItemId || ''
    selectedInventoryPharmacyId = editingMedication?.inventoryPharmacyId || editingMedication?.pharmacyId || ''
    selectedInventoryCurrentStock = Number.isFinite(Number(editingMedication?.selectedInventoryCurrentStock))
      ? Number(editingMedication.selectedInventoryCurrentStock)
      : null
    selectedInventoryStorageLocation = String(
      editingMedication?.selectedInventoryStorageLocation || editingMedication?.storageLocation || ''
    ).trim()
    moveVolumeFromStrengthForInventoryLiquidBottles()
    formInitialized = true
  }
  
  // No reactive reset - only reset on mount to avoid conflicts

  // Debounced search for brand name suggestions (local + connected pharmacies)
  const searchNameSuggestions = async () => {
    const query = String(name ?? '').trim()
    if (!doctorId || !query || query.length < 2) {
      nameSuggestions = []
      showNameSuggestions = false
      nameSelectedIndex = -1
      return
    }

    console.log('🔎 Drug search:', { doctorId, query })

    // Inventory drugs
    const inventory = await pharmacyMedicationService.searchMedicationsFromPharmacies(doctorId, query, 20)
    const formatSuggestionDisplayName = (drug) => {
      const brand = String(drug?.brandName || drug?.drugName || '').trim()
      const generic = String(drug?.genericName || '').trim()
      if (brand && generic && brand.toLowerCase() !== generic.toLowerCase()) {
        return `${brand} (${generic})`
      }
      return brand || generic || String(drug?.displayName || '').trim()
    }

    const inventoryMapped = inventory.map(d => ({
      displayName: formatSuggestionDisplayName(d),
      brandName: d.brandName || '',
      genericName: d.genericName || '',
      strength: d.strength || '',
      strengthUnit: d.strengthUnit || d.unit || '',
      containerSize: d.containerSize ?? '',
      containerUnit: d.containerUnit || '',
      totalVolume: d.totalVolume ?? d.containerSize ?? '',
      volumeUnit: d.volumeUnit || d.containerUnit || '',
      source: 'inventory',
      currentStock: d.currentStock || 0,
      packUnit: d.packUnit || '',
      dosageForm: d.dosageForm || d.packUnit || d.unit || '',
      storageLocation: d.storageLocation || '',
      expiryDate: d.expiryDate || ''
    }))
    console.log('🔎 Drug search inventory results:', inventoryMapped.length)

    if (inventoryMapped.length === 0) {
      console.warn('⚠️ Drug search returned 0 results', { doctorId, query })
    }

    // Sort: exact startsWith first, then alpha
    const q = query.toLowerCase()
    inventoryMapped.sort((a, b) => {
      const aExact = (a.brandName || '').toLowerCase().startsWith(q) || (a.genericName || '').toLowerCase().startsWith(q) ? 1 : 0
      const bExact = (b.brandName || '').toLowerCase().startsWith(q) || (b.genericName || '').toLowerCase().startsWith(q) ? 1 : 0
      if (aExact !== bExact) return bExact - aExact
      return (a.displayName || '').localeCompare(b.displayName || '')
    })

    nameSuggestions = inventoryMapped.slice(0, 20)
    showNameSuggestions = nameSuggestions.length > 0
    nameSelectedIndex = -1
  }

  const handleNameInput = () => {
    isInventoryDrug = false
    inventoryStrengthText = ''
    selectedInventoryItemId = ''
    selectedInventoryPharmacyId = ''
    selectedInventoryCurrentStock = null
    selectedInventoryStorageLocation = ''
    clearTimeout(nameSearchTimeout)
    nameSearchTimeout = setTimeout(searchNameSuggestions, 250)
  }

  const handleNameKeydown = (event) => {
    if (!showNameSuggestions || nameSuggestions.length === 0) return
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault()
        nameSelectedIndex = Math.min(nameSelectedIndex + 1, nameSuggestions.length - 1)
        break
      case 'ArrowUp':
        event.preventDefault()
        nameSelectedIndex = Math.max(nameSelectedIndex - 1, -1)
        break
      case 'Enter':
        if (nameSelectedIndex >= 0) {
          event.preventDefault()
          selectNameSuggestion(nameSuggestions[nameSelectedIndex])
        }
        break
      case 'Escape':
        showNameSuggestions = false
        nameSelectedIndex = -1
        break
    }
  }

  const selectNameSuggestion = (s) => {
    // Always use brandName if available, otherwise extract from displayName
    if (s.brandName) {
      name = s.brandName
    } else if (s.displayName) {
      // Extract brand name from displayName format "BrandName (GenericName)"
      const match = s.displayName.match(/^([^(]+)\s*\(/)
      name = match ? match[1].trim() : s.displayName
    } else {
      name = ''
    }
    
    // Set generic name, dosage form, and strength from selected drug
    genericName = s.genericName || ''
    const selectedDosageForm = normalizeDosageFormValue(s.dosageForm || s.form || s.packUnit || s.unit || '')
    dosageForm = selectedDosageForm
    strength = s.strength || ''
    strengthUnit = s.strengthUnit || ''
    totalVolume = String(s.totalVolume ?? s.containerSize ?? '').trim()
    volumeUnit = String(s.volumeUnit || s.containerUnit || volumeUnit || 'ml').trim() || 'ml'
    isInventoryDrug = s.source === 'inventory'
    selectedInventoryItemId = s.id || ''
    selectedInventoryPharmacyId = s.pharmacyId || ''
    selectedInventoryCurrentStock = Number.isFinite(Number(s.currentStock)) ? Number(s.currentStock) : null
    selectedInventoryStorageLocation = String(s.storageLocation || '').trim()
    const suggestionVolumeText = [String(s.totalVolume ?? s.containerSize ?? '').trim(), String(s.volumeUnit || s.containerUnit || '').trim()]
      .filter(Boolean)
      .join(' ')
    inventoryStrengthText = isInventoryDrug
      ? (
        suggestionVolumeText
        || [String(s.strength || '').trim(), String(s.strengthUnit || '').trim()].filter(Boolean).join(' ')
      )
      : ''

    if ((!strength || !strengthUnit) && s.strength) {
      const strengthMatch = String(s.strength).trim().match(/^(\d+(?:\.\d+)?)([a-zA-Z%]+)?$/)
      if (strengthMatch) {
        strength = strengthMatch[1]
        strengthUnit = strengthMatch[2] || strengthUnit || ''
      }
    }
    if (isLiquidBottlesDispenseForm(selectedDosageForm) && !totalVolume) {
      const parsedVolume = parseVolumeFromText(inventoryStrengthText || `${s.strength || ''} ${s.strengthUnit || ''}`)
      if (parsedVolume.value) {
        totalVolume = parsedVolume.value
        volumeUnit = parsedVolume.unit || volumeUnit || 'ml'
      }
    }
    if (!supportsStrengthForDosageForm(selectedDosageForm) && !totalVolume) {
      const parsedAmount = parseAmountWithUnit(`${s.strength || ''} ${s.strengthUnit || ''}`)
      if (parsedAmount.value) {
        totalVolume = parsedAmount.value
        volumeUnit = parsedAmount.unit || volumeUnit
      }
    }
    moveVolumeFromStrengthForInventoryLiquidBottles()

    // If the suggestion has a numeric strength like "500 mg", try to prefill dosage
    if (s.strength && !dosage && isDosageRequiredDispenseForm(selectedDosageForm)) {
      const m = String(s.strength).match(/(\d+(?:\.\d+)?)/)
      if (m) {
        dosage = m[1]
      }
    }
    showNameSuggestions = false
    nameSelectedIndex = -1
  }
  
  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault()
    error = ''
    loading = true
    
    try {
      // Validate required fields
      if (!name || (requiresDosageInput && !dosage) || (!requiresQts && !frequency) || (!requiresQts && !duration)) {
        if (!name) focusField('brandName')
        else if (requiresDosageInput && !dosage) focusField('medicationDosage')
        else if (!requiresQts && !frequency) focusField('medicationFrequency')
        else if (!requiresQts && !duration) focusField('medicationDuration')
        throw new Error('Please fill in all required fields')
      }
      const hasStrengthInput = Boolean(String(strength || '').trim())
      const requiresExplicitStrengthInput = supportsStrengthInput
      const hasInventoryStrengthFallback = Boolean(
        isInventoryDrug &&
        supportsStrengthInput &&
        String(inventoryStrengthText || '').trim()
      )
      if (requiresExplicitStrengthInput && !hasStrengthInput && !hasInventoryStrengthFallback) {
        focusField('medicationStrength')
        throw new Error('Please enter the strength for this medication')
      }
      if (!requiresQts && frequency && frequency.includes('PRN') && !String(prnAmount || '').trim()) {
        focusField('prnAmount')
        throw new Error('Please enter the PRN amount')
      }
      const parsedQts = requiresQts ? parsePositiveInteger(qts) : null
      if (requiresQts && !parsedQts) {
        focusField('medicationQts')
        throw new Error(isLiquidDispenseForm(dosageForm)
          ? 'Please enter Amount in ml as a positive integer'
          : 'Please enter Qts as a positive integer')
      }
      const parsedLiquidDosePerFrequencyMl = isLiquidDispenseForm(dosageForm) && String(liquidDosePerFrequencyMl || '').trim()
        ? parsePositiveInteger(liquidDosePerFrequencyMl)
        : null
      if (isLiquidDispenseForm(dosageForm) && String(liquidDosePerFrequencyMl || '').trim() && !parsedLiquidDosePerFrequencyMl) {
        focusField('liquidDosePerFrequencyMl')
        throw new Error('Please enter ml value as a positive integer')
      }
      const parsedDurationDays = !requiresQts ? parsePositiveInteger(duration) : null
      if (!requiresQts && !parsedDurationDays) {
        focusField('medicationDuration')
        throw new Error('Please enter duration as a positive integer')
      }
      if (!requiresQts && !timing) {
        focusField('medicationTiming')
        throw new Error('Please select when to take')
      }

      const enforcePharmacyOnly = !allowNonPharmacyDrugs
      const enforceNonPharmacyOnly = excludePharmacyDrugs

      const findMatchingStockItem = (pharmacyStock = []) => {
        const normalizedMedName = String(name ?? '').toLowerCase().trim()
        const normalizedMedNames = Array.from(new Set([
          normalizedMedName,
          normalizedMedName.split('(')[0]?.trim() || '',
          normalizedMedName.replace(/\(.*\)/, '').trim()
        ])).filter(Boolean)

        return pharmacyStock.find(stock => {
          const stockName = stock.drugName?.toLowerCase().trim() || ''
          const stockGeneric = stock.genericName?.toLowerCase().trim() || ''
          const stockNames = [stockName, stockGeneric].filter(Boolean)
          return normalizedMedNames.some(medName =>
            stockNames.some(stockValue => stockValue && (stockValue.includes(medName) || medName.includes(stockValue)))
          )
        }) || null
      }

      if (enforcePharmacyOnly || enforceNonPharmacyOnly) {
        if (!doctorId) {
          throw new Error('Doctor information is missing. Update prescription settings to continue.')
        }

        const pharmacyStock = await pharmacyMedicationService.getPharmacyStock(doctorId)
        if (!pharmacyStock || pharmacyStock.length === 0) {
          throw new Error('No connected pharmacy inventory found. Update prescription settings to continue.')
        }

        const dosageText = String(dosage ?? '').trim() + String(dosageUnit ?? '').trim()
        const dosageMatch = dosageText.match(/^(\d+(?:\.\d+)?)([a-zA-Z]+)$/)

        const matchingStock = pharmacyStock.find(stock => {
          const nameMatch = Boolean(findMatchingStockItem([stock]))

          if (!dosageMatch) {
            return nameMatch
          }

          const [, strength, unit] = dosageMatch
          const stockStrength = String(stock.strength || '')
          const stockUnit = String(stock.strengthUnit || '')
          const strengthMatch = stockStrength === strength || stockStrength.includes(strength)
          const unitMatch = !stockUnit || stockUnit === unit || stockUnit.includes(unit)

          return nameMatch && strengthMatch && unitMatch
        })

        const availableUnits = parseInt(matchingStock?.quantity ?? matchingStock?.currentStock ?? 0, 10)
        const isAvailable = !!(matchingStock && availableUnits > 0)

        if (enforcePharmacyOnly && !isAvailable) {
          throw new Error('This drug is not available in connected pharmacy inventory. Update prescription settings to continue.')
        }

        if (enforceNonPharmacyOnly && isAvailable) {
          throw new Error('This drug is available in connected pharmacy inventory. Uncheck "Exclude own pharmacy drugs" to continue.')
        }
      }
      
      // Validate dates
      const startDateObj = startDate ? new Date(startDate) : new Date() // Default to today if no start date
      
      if (endDate) {
        const endDateObj = new Date(endDate)
        if (endDateObj <= startDateObj) {
          throw new Error('End date must be after start date')
        }
      }
      
      const storesVolumeInLineTwo = shouldUseTotalVolumeLabel(dosageForm, strengthUnit)
      const enteredVolumeValue = String(totalVolume ?? '').trim() || String(strength ?? '').trim()
      const enteredVolumeUnit = String(volumeUnit ?? '').trim() || String(strengthUnit ?? '').trim()
      const parsedVolumeFromInventoryText = parseAmountWithUnit(inventoryStrengthText)
      const resolvedVolumeValue = enteredVolumeValue || parsedVolumeFromInventoryText.value
      const resolvedVolumeUnit = enteredVolumeUnit || parsedVolumeFromInventoryText.unit

      const medicationData = {
        source: isInventoryDrug ? 'inventory' : 'manual',
        name: String(name ?? '').trim(),
        genericName: (() => {
          const explicitGeneric = String(genericName ?? '').trim()
          if (explicitGeneric) return explicitGeneric
          return deriveGenericNameFromBrand(name)
        })(),
        dosage: requiresDosageInput ? String(dosage ?? '').trim() : '',
        dosageUnit: '',
        dosageForm: String(dosageForm ?? '').trim(),
        strength: (() => {
          if (storesVolumeInLineTwo) return ''
          const normalizedStrength = String(strength ?? '').trim()
          if (normalizedStrength) return normalizedStrength
          if (!supportsStrengthInput) return ''
          if (isLiquidBottlesDispenseForm(dosageForm)) return normalizedStrength
          if (!isInventoryDrug || !inventoryStrengthText) return normalizedStrength
          const match = inventoryStrengthText.match(/^\s*(\d+(?:\.\d+)?)\s*([a-zA-Z%]+)?\s*$/)
          return match?.[1] || normalizedStrength
        })(),
        strengthUnit: (() => {
          if (storesVolumeInLineTwo) return ''
          const normalizedUnit = String(strengthUnit ?? '').trim()
          if (!supportsStrengthInput) return ''
          if (normalizedUnit) return normalizedUnit
          if (isLiquidBottlesDispenseForm(dosageForm)) return normalizedUnit
          if (!isInventoryDrug || !inventoryStrengthText) return normalizedUnit
          const match = inventoryStrengthText.match(/^\s*(\d+(?:\.\d+)?)\s*([a-zA-Z%]+)?\s*$/)
          return match?.[2] || normalizedUnit
        })(),
        totalVolume: storesVolumeInLineTwo ? resolvedVolumeValue : '',
        volumeUnit: storesVolumeInLineTwo ? resolvedVolumeUnit : '',
        containerSize: storesVolumeInLineTwo ? resolvedVolumeValue : '',
        containerUnit: storesVolumeInLineTwo ? resolvedVolumeUnit : '',
        inventoryStrengthText: isInventoryDrug ? String(inventoryStrengthText || '').trim() : '',
        inventoryItemId: isInventoryDrug ? String(selectedInventoryItemId || '').trim() : '',
        inventoryPharmacyId: isInventoryDrug ? String(selectedInventoryPharmacyId || '').trim() : '',
        selectedInventoryCurrentStock: isInventoryDrug && Number.isFinite(Number(selectedInventoryCurrentStock))
          ? Number(selectedInventoryCurrentStock)
          : null,
        selectedInventoryStorageLocation: isInventoryDrug ? String(selectedInventoryStorageLocation || '').trim() : '',
        storageLocation: isInventoryDrug ? String(selectedInventoryStorageLocation || '').trim() : '',
        route: String(route ?? '').trim(),
        instructions: String(instructions ?? '').trim(),
        frequency,
        timing,
        prnAmount: !requiresQts && frequency.includes('PRN') ? String(prnAmount ?? '').trim() : '', // Include PRN amount if frequency is PRN
        qts: requiresQts ? String(parsedQts) : '',
        liquidAmountMl: isLiquidDispenseForm(dosageForm) && parsedQts ? String(parsedQts) : '',
        liquidDosePerFrequencyMl: isLiquidDispenseForm(dosageForm) && parsedLiquidDosePerFrequencyMl
          ? String(parsedLiquidDosePerFrequencyMl)
          : '',
        liquidDoseUnit: isLiquidDispenseForm(dosageForm) ? qtsDisplayUnit : '',
        duration: !requiresQts ? `${parsedDurationDays} days` : String(duration ?? '').trim() + ' days',
        startDate: startDate || new Date().toISOString().split('T')[0], // Default to today if not provided
        endDate: endDate || null,
        notes: String(notes ?? '').trim()
      }
      
      // Add editing information if in edit mode
      if (editingMedication) {
        medicationData.id = editingMedication.id
        medicationData.isEdit = true
      }
      
      // No local drug database persistence (inventory-only)
      
      dispatch('medication-added', medicationData)
      
      // Reset form
      name = ''
      genericName = ''
      dosage = ''
      dosageUnit = ''
      dosageForm = ''
      strength = ''
      strengthUnit = ''
      isInventoryDrug = false
      selectedInventoryItemId = ''
      selectedInventoryPharmacyId = ''
      selectedInventoryCurrentStock = null
      selectedInventoryStorageLocation = ''
      route = 'PO' // Set default route
      instructions = ''
      frequency = ''
      prnAmount = ''
      qts = ''
      liquidDosePerFrequencyMl = ''
      totalVolume = ''
      volumeUnit = 'ml'
      duration = ''
      startDate = ''
      endDate = ''
      notes = ''
      
    } catch (err) {
      error = err.message
      console.error('Form validation error:', err)
    } finally {
      loading = false
    }
  }
  
  
  // Handle cancel
  const handleCancel = () => {
    dispatch('cancel')
  }

  const getDoctorIdForImprove = () => {
    const currentDoctor = authService.getCurrentDoctor()
    return doctorId || currentDoctor?.id || currentDoctor?.uid || 'default-user'
  }

  // Improve brand name with AI
  const improveBrandName = async () => {
    if (!name || !name.trim()) {
      error = 'Please enter a brand name to improve'
      return
    }

    try {
      improvingBrandName = true
      error = ''
      const originalName = name

      // Get doctor information for token tracking
      const resolvedDoctorId = getDoctorIdForImprove()

      // Call OpenAI service to improve text
      const result = await openaiService.improveText(name, resolvedDoctorId, { context: 'medication-name' })

      // Update the brand name with improved text
      name = result.improvedText

      // Mark as improved to show visual feedback
      const normalizedOriginal = String(originalName ?? '').trim()
      const normalizedImproved = String(name ?? '').trim()
      brandNameImproved = normalizedImproved !== '' && normalizedImproved !== normalizedOriginal
      lastImprovedName = brandNameImproved ? normalizedImproved : ''

      // Dispatch event for token tracking
      dispatch('ai-usage-updated', {
        tokensUsed: result.tokensUsed,
        type: 'improveText'
      })

      console.log('✅ Brand name improved successfully')

    } catch (err) {
      console.error('❌ Error improving brand name:', err)
      error = err.message || 'Failed to improve brand name. Please try again.'
    } finally {
      improvingBrandName = false
    }
  }

  const improveInstructions = async () => {
    if (!instructions || !instructions.trim()) {
      error = 'Please enter instructions to improve'
      return
    }

    try {
      improvingInstructions = true
      error = ''
      const originalInstructions = instructions
      const resolvedDoctorId = getDoctorIdForImprove()

      const result = await openaiService.improveText(instructions, resolvedDoctorId, { context: 'medication-instructions' })
      instructions = result.improvedText

      const normalizedOriginal = String(originalInstructions ?? '').trim()
      const normalizedImproved = String(instructions ?? '').trim()
      instructionsImproved = normalizedImproved !== '' && normalizedImproved !== normalizedOriginal
      lastImprovedInstructions = instructionsImproved ? normalizedImproved : ''

      dispatch('ai-usage-updated', {
        tokensUsed: result.tokensUsed,
        type: 'improveText'
      })
    } catch (err) {
      console.error('❌ Error improving instructions:', err)
      error = err.message || 'Failed to improve text. Please try again.'
    } finally {
      improvingInstructions = false
    }
  }

  const improveNotes = async () => {
    if (!notes || !notes.trim()) {
      error = 'Please enter notes to improve'
      return
    }

    try {
      improvingNotes = true
      error = ''
      const originalNotes = notes
      const resolvedDoctorId = getDoctorIdForImprove()

      const result = await openaiService.improveText(notes, resolvedDoctorId, { context: 'medication-notes' })
      notes = result.improvedText

      const normalizedOriginal = String(originalNotes ?? '').trim()
      const normalizedImproved = String(notes ?? '').trim()
      notesImproved = normalizedImproved !== '' && normalizedImproved !== normalizedOriginal
      lastImprovedNotes = notesImproved ? normalizedImproved : ''

      dispatch('ai-usage-updated', {
        tokensUsed: result.tokensUsed,
        type: 'improveText'
      })
    } catch (err) {
      console.error('❌ Error improving notes:', err)
      error = err.message || 'Failed to improve text. Please try again.'
    } finally {
      improvingNotes = false
    }
  }

  // Reset form when component mounts if not editing
  onMount(() => {
    console.log('🚀 MedicationForm mounted - checking if reset needed')
    if (doctorId) {
      clearPharmacyMedicationCache(doctorId)
      lastClearedDoctorId = String(doctorId)
    }
    if (!editingMedication) {
      console.log('🔄 New prescription - resetting to empty state')
      resetForm()
    } else {
      console.log('📝 Editing existing prescription - keeping data')
    }
  })

  // Ensure inventory suggestions are refreshed when Add Drug becomes visible.
  $: if (visible && doctorId && String(doctorId) !== lastClearedDoctorId) {
    clearPharmacyMedicationCache(doctorId)
    lastClearedDoctorId = String(doctorId)
  }
</script>

<div class="bg-white border-2 border-cyan-200 rounded-lg shadow-sm mx-2 sm:mx-0 dark:bg-slate-900 dark:border-cyan-300/60">
  <div class="bg-cyan-700 text-white px-3 sm:px-4 py-3 rounded-t-lg">
    <div class="flex items-center justify-between gap-3">
      <h6 class="text-base sm:text-lg font-semibold mb-0">
        <i class="fas fa-pills mr-2"></i>{editingMedication ? 'Edit Medication' : 'Add New Medication'}
      </h6>
      <button
        type="button"
        class="inline-flex items-center justify-center h-8 w-8 rounded-md border border-cyan-300/70 text-white hover:bg-cyan-600 focus:outline-none focus:ring-2 focus:ring-cyan-200 focus:ring-offset-1 focus:ring-offset-cyan-700 transition-colors"
        aria-label="Close medication form"
        title="Close"
        on:click={handleCancel}
      >
        <i class="fas fa-times text-sm"></i>
      </button>
    </div>
  </div>
  <div class="p-3 sm:p-4">
    <form on:submit={handleSubmit} class="space-y-3 sm:space-y-4" autocomplete="off">
      <div>
        <label for="brandName" class="block text-xs sm:text-sm font-medium text-gray-700 dark:text-slate-200 mb-1">
          Brand Name <span class="text-red-500">*</span>
          {#if brandNameImproved}
            <span class="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
              <i class="fas fa-check-circle mr-1"></i>
              AI Corrected
            </span>
          {/if}
        </label>
        <div class="relative">
          <input
            type="text"
            class="w-full px-2 sm:px-3 py-2 pr-28 border rounded-lg text-xs sm:text-sm placeholder-gray-500 focus:outline-none focus:ring-2 disabled:cursor-not-allowed transition-all duration-300 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100 dark:placeholder-slate-400 {brandNameImproved ? 'bg-green-50 border-green-300 text-green-700 focus:ring-green-500 focus:border-green-500 dark:bg-green-900/30 dark:border-green-700 dark:text-green-200' : 'border-gray-300 focus:ring-cyan-500 focus:border-cyan-500'} {loading || improvingBrandName ? 'bg-gray-100 dark:bg-slate-700' : ''}"
            id="brandName"
            name="brandNameNoAutofill"
            bind:value={name}
            required
            disabled={loading || improvingBrandName}
            placeholder="e.g., Glucophage, Prinivil"
            autocomplete="off"
            autocorrect="off"
            autocapitalize="off"
            spellcheck="false"
            on:input={handleNameInput}
            on:keydown={handleNameKeydown}
            on:focus={searchNameSuggestions}
          />
          <button
            type="button"
            class="absolute top-1.5 right-1.5 inline-flex items-center px-2 py-1 text-xs font-medium text-white bg-cyan-700 border border-transparent rounded-lg hover:bg-cyan-800 focus:ring-4 focus:outline-none focus:ring-cyan-300 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors duration-200"
            on:click={improveBrandName}
            disabled={loading || improvingBrandName || !name}
            title="Correct spelling with AI"
          >
            {#if improvingBrandName}
              <svg class="animate-spin h-3 w-3 mr-1 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Fixing...
            {:else}
              <i class="fas fa-sparkles mr-1"></i>
              Fix Spelling
            {/if}
          </button>
        </div>
        {#if showNameSuggestions && nameSuggestions.length > 0}
          <div class="relative">
            <div class="absolute top-1 left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-56 overflow-y-auto dark:bg-slate-800 dark:border-slate-700">
              {#each nameSuggestions as s, idx}
                <button
                  type="button"
                  class="w-full px-3 py-2 text-left text-xs sm:text-sm hover:bg-cyan-50 focus:bg-cyan-50 border-b last:border-b-0 dark:border-slate-700 dark:hover:bg-slate-700 dark:focus:bg-slate-700 {nameSelectedIndex === idx ? 'bg-cyan-50 dark:bg-slate-700' : ''}"
                  on:click={() => selectNameSuggestion(s)}
                  on:mouseenter={() => nameSelectedIndex = idx}
                >
                  <div class="flex items-center justify-between">
                    <div class="text-gray-900 dark:text-slate-100 font-medium truncate">
                      {s.displayName}
                      {#if String(s.containerSize ?? '').trim() !== ''}
                        <span class="text-gray-600 dark:text-slate-300"> {s.containerSize}{#if s.containerUnit} {s.containerUnit}{/if}</span>
                      {/if}
                    </div>
                    <span class="ml-3 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-100 text-emerald-800">
                      <i class="fas fa-store mr-1"></i>Inventory
                    </span>
                  </div>
                  {#if getSuggestionStrengthText(s) || getSuggestionVolumeText(s) || s.dosageForm}
                    <div class="text-[11px] text-gray-500 dark:text-slate-300 mt-1">
                      {#if getSuggestionStrengthText(s)}Strength: {getSuggestionStrengthText(s)}{/if}
                      {#if s.dosageForm}{#if getSuggestionStrengthText(s)} • {/if}Form: {s.dosageForm}{/if}
                      {#if s.source === 'inventory' && s.currentStock !== undefined}
                        <span class="ml-1 text-blue-600 font-medium">({s.currentStock} {getSuggestionStockUnitLabel(s)})</span>
                      {/if}
                    </div>
                    {#if getSuggestionVolumeText(s)}
                      <div class="text-[11px] text-gray-500 dark:text-slate-300">Total volume: {getSuggestionVolumeText(s)}</div>
                    {/if}
                  {/if}
                </button>
              {/each}
            </div>
          </div>
        {/if}
        {#if genericName && String(genericName).trim() && String(genericName).trim().toLowerCase() !== String(name || '').trim().toLowerCase()}
          <p class="mt-1 text-xs text-gray-600 dark:text-slate-300">
            Selected: {name} ({genericName})
          </p>
        {/if}
      </div>
      
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
        <div>
          <label for={requiresDosageInput ? 'medicationDosage' : 'medicationStrength'} class="block text-xs sm:text-sm font-medium text-gray-700 dark:text-slate-200 mb-1">
            {shouldUseTotalVolumeLabel(dosageForm, strengthUnit) ? 'Total volume' : 'Dosage Strength'}
            {#if requiresDosageInput}
              <span class="text-red-500">*</span>
            {/if}
          </label>
          <div class="space-y-2">
            <div class="flex flex-col sm:flex-row gap-2">
              {#if requiresDosageInput}
                {#if isLiquidStrengthUnit}
                  <div
                    class="w-full sm:w-32 px-2 sm:px-3 py-2 border border-gray-300 rounded-lg text-xs sm:text-sm bg-gray-100 text-gray-700 flex items-center justify-between dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200"
                    id="medicationDosage"
                  >
                    <span>1</span>
                    <span class="text-[10px] uppercase tracking-wide text-gray-500 dark:text-slate-400">fixed</span>
                  </div>
                {:else}
                  <select
                    class="w-full sm:w-32 px-2 sm:px-3 py-2 border border-gray-300 rounded-lg text-xs sm:text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 disabled:bg-gray-100 disabled:cursor-not-allowed dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100 dark:placeholder-slate-400 dark:disabled:bg-slate-700"
                    id="medicationDosage"
                    bind:value={dosage}
                    required
                    disabled={loading}
                  >
                    <option value="">Select dosage</option>
                    {#each dosageOptions as option}
                      <option value={option}>{option}</option>
                    {/each}
                  </select>
                {/if}
              {/if}

              {#if showEditableStrengthInput}
                <input
                  id="medicationStrength"
                  type="number"
                  class="w-full sm:flex-1 px-2 sm:px-3 py-2 border border-gray-300 rounded-lg text-xs sm:text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 disabled:bg-gray-100 disabled:cursor-not-allowed dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100 dark:placeholder-slate-400 dark:disabled:bg-slate-700"
                  bind:value={strength}
                  placeholder="Strength"
                  disabled={loading || isInventoryVolumeLocked}
                  required={showEditableStrengthInput}
                  min="0"
                  step="0.01"
                  inputmode="decimal"
                />
                <select
                  id="medicationStrengthUnit"
                  class="w-full sm:w-24 px-2 sm:px-3 py-2 border border-gray-300 rounded-lg text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 disabled:bg-gray-100 disabled:cursor-not-allowed dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100 dark:disabled:bg-slate-700"
                  bind:value={strengthUnit}
                  disabled={loading || isInventoryVolumeLocked}
                >
                  <option value="">Unit</option>
                  {#each STRENGTH_UNITS as unit}
                    <option value={unit}>{unit}</option>
                  {/each}
                </select>
              {:else if supportsStrengthInput && strength}
                <div class="flex items-center text-xs sm:text-sm text-gray-700 dark:text-slate-200 px-2">
                  <span class="font-medium">Strength:</span>
                  <span class="ml-1">{strength}{#if strengthUnit} {strengthUnit}{/if}</span>
                </div>
              {/if}
            </div>
            {#if isInventoryVolumeLocked}
              <p class="mt-1 text-xs text-gray-500 dark:text-slate-400">Total volume is locked from inventory record.</p>
            {/if}

            {#if isLiquidBottlesDispenseForm(dosageForm)}
              <div>
                <p class="block text-xs sm:text-sm font-medium text-gray-700 dark:text-slate-200 mb-1">Total volume</p>
                <div class="flex flex-col sm:flex-row gap-2">
                  <input
                    id="medicationTotalVolume"
                    type="number"
                    class="w-full sm:flex-1 px-2 sm:px-3 py-2 border border-gray-300 rounded-lg text-xs sm:text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 disabled:bg-gray-100 disabled:cursor-not-allowed dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100 dark:placeholder-slate-400 dark:disabled:bg-slate-700"
                    bind:value={totalVolume}
                    placeholder="e.g., 100"
                    disabled={loading || isInventoryDrug}
                    min="0"
                    step="0.01"
                    inputmode="decimal"
                  />
                  <select
                    id="medicationVolumeUnit"
                    class="w-full sm:w-24 px-2 sm:px-3 py-2 border border-gray-300 rounded-lg text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 disabled:bg-gray-100 disabled:cursor-not-allowed dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100 dark:disabled:bg-slate-700"
                    bind:value={volumeUnit}
                    disabled={loading || isInventoryDrug}
                  >
                    <option value="ml">ml</option>
                    <option value="l">l</option>
                    <option value="mcg">mcg</option>
                  </select>
                </div>
                {#if isInventoryDrug}
                  <p class="mt-1 text-xs text-gray-500 dark:text-slate-400">Total volume is locked from inventory record.</p>
                {/if}
              </div>
            {/if}

            {#if requiresQts}
              <p class="block text-xs sm:text-sm font-medium text-gray-700 dark:text-slate-200 mb-1">Count</p>
              <div class="flex flex-col sm:flex-row gap-2">
                <div class="w-full sm:w-24">
                  <input
                    type="text"
                    class="w-full px-2 sm:px-3 py-2 border border-gray-300 rounded-lg text-xs sm:text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 disabled:bg-gray-100 disabled:cursor-not-allowed dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100 dark:placeholder-slate-400 dark:disabled:bg-slate-700"
                    id="medicationQts"
                    bind:value={qts}
                    required={requiresQts}
                    aria-required={requiresQts}
                    inputmode="numeric"
                    pattern="[0-9]*"
                    disabled={loading}
                    placeholder={countPlaceholder}
                    aria-label={isLiquidDispenseForm(dosageForm) ? 'Amount (ml)' : 'Qunatity'}
                  >
                </div>
                {#if isLiquidDispenseForm(dosageForm)}
                  {#if isInventoryDrug}
                    <div class="w-full sm:w-36 px-2 sm:px-3 py-2 border border-gray-300 rounded-lg text-xs sm:text-sm bg-gray-100 text-gray-700 flex items-center dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200">
                      {qtsDisplayUnit}
                    </div>
                  {:else}
                    <div class="w-full sm:w-36">
                      <input
                        type="text"
                        id="liquidDosePerFrequencyMl"
                        class="w-full px-2 sm:px-3 py-2 border border-gray-300 rounded-lg text-xs sm:text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 disabled:bg-gray-100 disabled:cursor-not-allowed dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100 dark:placeholder-slate-400 dark:disabled:bg-slate-700"
                        bind:value={liquidDosePerFrequencyMl}
                        inputmode="numeric"
                        pattern="[0-9]*"
                        disabled={loading}
                        placeholder={qtsDisplayUnit}
                        aria-label={`${qtsDisplayUnit} (PDF only)`}
                      >
                    </div>
                  {/if}
                {/if}
              </div>
            {/if}
          </div>
          {#if requiresQts && isLiquidDispenseForm(dosageForm)}
            <p class="mt-1 text-xs text-gray-500 dark:text-slate-400">For PDF only: this {qtsDisplayUnit} value prints near the drug name and does not affect calculations.</p>
          {/if}
        </div>
        <div>
          <label for="medicationRoute" class="block text-xs sm:text-sm font-medium text-gray-700 dark:text-slate-200 mb-1">Route of Administration</label>
          <div class="flex w-full min-w-0">
            <select 
              class="w-0 min-w-0 flex-1 px-2 sm:px-3 py-2 border border-gray-300 rounded-l-lg text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 disabled:bg-gray-100 disabled:cursor-not-allowed dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100 dark:disabled:bg-slate-700" 
              id="medicationRoute" 
              on:change={(e) => {
                if (e.target.value) {
                  route = e.target.value;
                }
              }}
              disabled={loading}
            >
              <option value="">Select route</option>
              <option value="IM">Intramuscular (IM)</option>
              <option value="IV">Intravenous (IV)</option>
              <option value="SC">Subcutaneous (SC)</option>
              <option value="PO">Oral (PO)</option>
              <option value="Topical">Topical</option>
              <option value="Inhalation">Inhalation</option>
              <option value="Rectal">Rectal</option>
              <option value="Vaginal">Vaginal</option>
              <option value="Otic">Ear (Otic)</option>
              <option value="Ophthalmic">Eye (Ophthalmic)</option>
              <option value="Nasal">Nasal</option>
              <option value="Transdermal">Transdermal</option>
            </select>
            <input 
              type="text" 
              class="w-0 min-w-0 flex-1 px-2 sm:px-3 py-2 border border-gray-300 border-l-0 rounded-r-lg text-xs sm:text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 disabled:bg-gray-100 disabled:cursor-not-allowed dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100 dark:placeholder-slate-400 dark:disabled:bg-slate-700" 
              placeholder="Or enter custom route"
              bind:value={routeDisplay}
              disabled={loading}
            >
          </div>
        </div>
        <div>
          <label for="medicationDosageForm" class="block text-xs sm:text-sm font-medium text-gray-700 dark:text-slate-200 mb-1">Dispense Form</label>
          <select
            class="w-full px-2 sm:px-3 py-2 border border-gray-300 rounded-lg text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100 dark:disabled:bg-slate-700 dark:disabled:text-slate-400"
            id="medicationDosageForm"
            bind:value={dosageForm}
            disabled={loading || isInventoryDrug}
          >
            <option value="">Select dispense form</option>
            {#each DOSAGE_FORM_OPTIONS as option}
              <option value={option}>{option}</option>
            {/each}
          </select>
          {#if isInventoryDrug}
            <p class="mt-1 text-xs text-gray-500 dark:text-slate-400">Dispense Form is locked from inventory record.</p>
          {/if}
        </div>
        <div>
        <label for="medicationFrequency" class="block text-xs sm:text-sm font-medium text-gray-700 dark:text-slate-200 mb-1">
          Frequency
          {#if !requiresQts}
            <span class="text-red-500">*</span>
          {/if}
        </label>
        <div class="flex gap-2">
            <select 
              class="flex-1 px-2 sm:px-3 py-2 border border-gray-300 rounded-lg text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 disabled:bg-gray-100 disabled:cursor-not-allowed dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100 dark:disabled:bg-slate-700" 
              id="medicationFrequency" 
              bind:value={frequency}
              required={!requiresQts}
              disabled={loading}
            >
              <option value="">Select frequency</option>
              {#each frequencyOptions as freq}
                <option value={freq}>{freq}</option>
              {/each}
            </select>
            {#if !requiresQts && frequency && frequency.includes('PRN')}
              <div class="w-24">
                <label for="prnAmount" class="block text-[10px] sm:text-xs font-medium text-gray-700 dark:text-slate-200 mb-1">
                  Amount <span class="text-red-500">*</span>
                </label>
                <input 
                  id="prnAmount"
                  type="number" 
                  class="w-full px-2 sm:px-3 py-2 border border-gray-300 rounded-lg text-xs sm:text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 disabled:bg-gray-100 disabled:cursor-not-allowed dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100 dark:placeholder-slate-400 dark:disabled:bg-slate-700" 
                  placeholder="Amount"
                  bind:value={prnAmount}
                  required
                  aria-required="true"
                  disabled={loading}
                  min="0"
                  step="0.01"
                  inputmode="decimal"
                >
              </div>
            {/if}
          </div>
        </div>
      </div>
      
      {#if !requiresQts}
        <div>
          <label for="medicationTiming" class="block text-xs sm:text-sm font-medium text-gray-700 dark:text-slate-200 mb-1">
            When to take <span class="text-red-500">*</span>
          </label>
          <select
            id="medicationTiming"
            bind:value={timing}
            class="w-full px-2 sm:px-3 py-2 border border-gray-300 rounded-lg text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 disabled:bg-gray-100 disabled:cursor-not-allowed dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100 dark:disabled:bg-slate-700"
            required
            disabled={loading}
          >
            <option value="">Select timing</option>
            {#each TIMING_OPTIONS as option}
              <option value={option}>{option}</option>
            {/each}
          </select>
        </div>
      {/if}

      <div>
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-1">
          <label for="medicationInstructions" class="text-xs sm:text-sm font-medium text-gray-700 dark:text-slate-200">
            Instructions
            {#if instructionsImproved}
              <span class="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                <i class="fas fa-check-circle mr-1"></i>
                AI Improved
              </span>
            {/if}
          </label>
          <button
            type="button"
            class="inline-flex items-center px-3 py-1.5 text-xs font-medium text-white bg-cyan-700 border border-transparent rounded-lg hover:bg-cyan-800 focus:ring-4 focus:outline-none focus:ring-cyan-300 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors duration-200"
            on:click={improveInstructions}
            disabled={loading || improvingInstructions || instructionsImproved || !instructions}
            title="Fix spelling and grammar with AI"
          >
            {#if improvingInstructions}
              <svg class="animate-spin h-3 w-3 mr-1.5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Improving...
            {:else}
              <i class="fas fa-sparkles mr-1.5"></i>
              Improve English
            {/if}
          </button>
        </div>
        <textarea 
          class="w-full px-2 sm:px-3 py-2 border rounded-lg text-xs sm:text-sm placeholder-gray-500 focus:outline-none focus:ring-2 disabled:bg-gray-100 disabled:cursor-not-allowed transition-all duration-300 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100 dark:placeholder-slate-400 {instructionsImproved ? 'bg-green-50 border-green-300 text-green-700 focus:ring-green-500 focus:border-green-500 dark:bg-green-900/30 dark:border-green-700 dark:text-green-200' : 'bg-white border-gray-300 focus:ring-cyan-500 focus:border-cyan-500'} {loading || improvingInstructions ? 'bg-gray-100 dark:bg-slate-700' : ''}"
          id="medicationInstructions" 
          rows="2" 
          bind:value={instructions}
          disabled={loading || improvingInstructions}
          placeholder="e.g., Take with food, Take before bedtime"
        ></textarea>
      </div>
      
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div>
          <label for="medicationDuration" class="block text-xs sm:text-sm font-medium text-gray-700 dark:text-slate-200 mb-1">
            Duration in days
            {#if !requiresQts}
              <span class="text-red-500">*</span>
            {/if}
          </label>
          <input 
            type="number" 
            class="w-full px-2 sm:px-3 py-2 border border-gray-300 rounded-lg text-xs sm:text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 disabled:bg-gray-100 disabled:cursor-not-allowed dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100 dark:placeholder-slate-400 dark:disabled:bg-slate-700" 
            id="medicationDuration" 
            bind:value={duration}
            min="1"
            required={!requiresQts}
            disabled={loading}
            placeholder="e.g., 30"
          >
        </div>
        <div>
          <label for="medicationStartDate" class="block text-xs sm:text-sm font-medium text-gray-700 dark:text-slate-200 mb-1">Start Date <span class="text-gray-500 dark:text-slate-400 text-xs">(Optional)</span></label>
          <DateInput type="date" lang="en-GB" placeholder="dd/mm/yyyy" 
            class="w-full px-2 sm:px-3 py-2 border border-gray-300 rounded-lg text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 disabled:bg-gray-100 disabled:cursor-not-allowed dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100 dark:disabled:bg-slate-700" 
            id="medicationStartDate" 
            bind:value={startDate}
            disabled={loading} />
        </div>
        <div>
          <label for="medicationEndDate" class="block text-xs sm:text-sm font-medium text-gray-700 dark:text-slate-200 mb-1">End Date</label>
          <DateInput type="date" lang="en-GB" placeholder="dd/mm/yyyy" 
            class="w-full px-2 sm:px-3 py-2 border border-gray-300 rounded-lg text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 disabled:bg-gray-100 disabled:cursor-not-allowed dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100 dark:disabled:bg-slate-700" 
            id="medicationEndDate" 
            bind:value={endDate}
            disabled={loading} />
        </div>
      </div>
      
      <div>
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-1">
          <label for="medicationNotes" class="text-xs sm:text-sm font-medium text-gray-700 dark:text-slate-200">
            Additional Notes
            {#if notesImproved}
              <span class="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                <i class="fas fa-check-circle mr-1"></i>
                AI Improved
              </span>
            {/if}
          </label>
          <button
            type="button"
            class="inline-flex items-center px-3 py-1.5 text-xs font-medium text-white bg-cyan-700 border border-transparent rounded-lg hover:bg-cyan-800 focus:ring-4 focus:outline-none focus:ring-cyan-300 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors duration-200"
            on:click={improveNotes}
            disabled={loading || improvingNotes || notesImproved || !notes}
            title="Fix spelling and grammar with AI"
          >
            {#if improvingNotes}
              <svg class="animate-spin h-3 w-3 mr-1.5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Improving...
            {:else}
              <i class="fas fa-sparkles mr-1.5"></i>
              Improve English
            {/if}
          </button>
        </div>
        <textarea 
          class="w-full px-2 sm:px-3 py-2 border rounded-lg text-xs sm:text-sm placeholder-gray-500 focus:outline-none focus:ring-2 disabled:bg-gray-100 disabled:cursor-not-allowed transition-all duration-300 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100 dark:placeholder-slate-400 {notesImproved ? 'bg-green-50 border-green-300 text-green-700 focus:ring-green-500 focus:border-green-500 dark:bg-green-900/30 dark:border-green-700 dark:text-green-200' : 'bg-white border-gray-300 focus:ring-cyan-500 focus:border-cyan-500'} {loading || improvingNotes ? 'bg-gray-100 dark:bg-slate-700' : ''}"
          id="medicationNotes" 
          rows="2" 
          bind:value={notes}
          disabled={loading || improvingNotes}
          placeholder="Any additional notes about the medication"
        ></textarea>
      </div>
      
      {#if error}
        <div class="bg-red-50 border border-red-200 rounded-lg p-2 sm:p-3 dark:bg-red-950/30 dark:border-red-800" role="alert">
          <i class="fas fa-exclamation-triangle text-red-500 mr-2"></i>
          <span class="text-xs sm:text-sm text-red-700 dark:text-red-300">{error}</span>
        </div>
      {/if}
      
      <div class="action-buttons">
        <button 
          type="submit" 
          class="inline-flex items-center justify-center px-5 py-2.5 text-sm font-medium text-white bg-cyan-700 border border-transparent rounded-lg hover:bg-cyan-800 focus:ring-4 focus:outline-none focus:ring-cyan-300 disabled:opacity-50 disabled:cursor-not-allowed" 
          disabled={loading || savingMedication}
        >
          {#if loading || savingMedication}
            <svg class="animate-spin -ml-1 mr-2 h-3 w-3 sm:h-4 sm:w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Saving...
          {:else}
            <i class="fas fa-save mr-1"></i>Save Medication
          {/if}
        </button>
        <button 
          type="button" 
          class="inline-flex items-center justify-center px-5 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-100 focus:ring-4 focus:outline-none focus:ring-gray-200 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100 dark:hover:bg-slate-700 dark:focus:ring-slate-500/50" 
          on:click={handleCancel}
          disabled={loading}
        >
          <i class="fas fa-times mr-1"></i>Cancel
        </button>
      </div>
    </form>
  </div>
</div>

<style>
  /* Minimal custom styles for MedicationForm component */
  /* All styling is now handled by Tailwind CSS utility classes */
</style>
