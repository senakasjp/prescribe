<script>
  import { onMount } from 'svelte'
  import firebaseStorage from '../services/firebaseStorage.js'
  import chargeCalculationService from '../services/pharmacist/chargeCalculationService.js'
  import { formatPrescriptionId } from '../utils/idFormat.js'
  import { formatDate } from '../utils/dataProcessing.js'
  import { formatCurrency as formatCurrencyByLocale } from '../utils/formatting.js'
  
  export let prescriptions = []
  export let selectedPatient = null
  export let patients = []
  export let currency = 'USD'
  
  // Pagination state
  let currentPage = 1
  let itemsPerPage = 5 // Show 5 prescriptions per page
  let expectedPharmacist = null
  let chargeTotals = {}
  let chargesLoading = false
  let chargesRequestId = 0
  let patientCache = {}
  let patientRequestId = 0
  let doctorCache = {}
  let doctorRequestId = 0
  
  // Helper function to get all prescriptions (including those without medications)
  const getAllPrescriptions = () => {
    const allPrescriptions = prescriptions
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
    
    console.log('🔍 PrescriptionList: Total prescriptions:', prescriptions.length)
    console.log('🔍 PrescriptionList: Prescriptions with medications:', prescriptions.filter(p => p.medications && p.medications.length > 0).length)
    console.log('🔍 PrescriptionList: Prescriptions without medications:', prescriptions.filter(p => !p.medications || p.medications.length === 0).length)
    console.log('🔍 PrescriptionList: Prescription data:', prescriptions)
    
    return allPrescriptions
  }
  
  let allPrescriptions = []
  $: allPrescriptions = getAllPrescriptions()
  $: if (allPrescriptions.length > 0) {
    loadMissingPatients()
    loadMissingDoctors()
  }
  
  // Pagination calculations
  $: totalPages = Math.ceil(allPrescriptions.length / itemsPerPage)
  $: startIndex = (currentPage - 1) * itemsPerPage
  $: endIndex = startIndex + itemsPerPage
  $: paginatedPrescriptions = allPrescriptions.slice(startIndex, endIndex)
  
  // Reset to first page when prescriptions change
  $: if (allPrescriptions.length > 0) {
    currentPage = 1
  }
  
  // Helper function to format prescription date
  const formatPrescriptionDate = (dateString) => {
    if (!dateString) return 'Unknown date'
    return formatDate(dateString)
  }

  const getMedicationDosageDisplay = (medication) => {
    const strength = String(medication?.strength || '').trim()
    const strengthUnit = String(medication?.strengthUnit || '').trim()
    const dosage = String(medication?.dosage || '').trim()
    if (!strength && !dosage) return 'Not specified'
    if (!strength) return dosage || 'Not specified'
    const strengthText = strengthUnit ? `${strength} ${strengthUnit}` : strength
    return dosage ? `${strengthText} ${dosage}` : strengthText
  }

  const getDoctorIdForPrescription = (prescription) => {
    const createdBy = prescription?.createdBy || null
    if (createdBy && String(createdBy).includes('@')) {
      return (
        prescription?.doctorId ||
        prescription?.doctor?.id ||
        null
      )
    }
    return (
      prescription?.doctorId ||
      prescription?.doctor?.id ||
      createdBy ||
      null
    )
  }

  const getDoctorEmailForPrescription = (prescription) => {
    const createdBy = prescription?.createdBy || ''
    const createdByEmail = String(createdBy).includes('@') ? createdBy : null
    return prescription?.doctorEmail || prescription?.doctor?.email || createdByEmail || null
  }

  const resolveDoctorName = (prescription) => {
    const resolvedDoctor = resolveDoctorForPrescription(prescription)
    if (resolvedDoctor) {
      return (
        resolvedDoctor.name ||
        `${resolvedDoctor.firstName || ''} ${resolvedDoctor.lastName || ''}`.trim() ||
        resolvedDoctor.email ||
        'Doctor'
      )
    }
    if (selectedPatient) {
      const patientDoctorName = selectedPatient.doctorName
        || selectedPatient.doctor?.name
        || `${selectedPatient.doctor?.firstName || ''} ${selectedPatient.doctor?.lastName || ''}`.trim()
      if (patientDoctorName) return patientDoctorName
    }
    return (
      prescription?.doctorName ||
      prescription?.doctor?.name ||
      `${prescription?.doctor?.firstName || ''} ${prescription?.doctor?.lastName || ''}`.trim() ||
      prescription?.createdByName ||
      prescription?.createdByEmail ||
      prescription?.createdByName ||
      'Doctor'
    )
  }

  const getPatientIdForPrescription = (prescription) => {
    return (
      prescription?.patientId ||
      prescription?.patientID ||
      prescription?.patient_id ||
      prescription?.patient?.id ||
      null
    )
  }

  const resolvePatientForPrescription = (prescription) => {
    if (selectedPatient) return selectedPatient
    if (prescription?.patient && typeof prescription.patient === 'object') {
      return prescription.patient
    }
    const patientId = getPatientIdForPrescription(prescription)
    if (!patientId) return null
    if (Array.isArray(patients)) {
      const matched = patients.find((patient) => patient.id === patientId)
      if (matched) return matched
    }
    return patientCache[patientId] || null
  }

  const resolveDoctorForPrescription = (prescription) => {
    if (prescription?.doctor && typeof prescription.doctor === 'object') {
      return prescription.doctor
    }
    const doctorId = getDoctorIdForPrescription(prescription)
    if (doctorId && doctorCache[doctorId]) return doctorCache[doctorId]
    const doctorEmail = getDoctorEmailForPrescription(prescription)
    if (doctorEmail && doctorCache[doctorEmail]) return doctorCache[doctorEmail]
    return null
  }

  const loadMissingPatients = async () => {
    const requestId = ++patientRequestId
    const ids = Array.from(new Set(
      allPrescriptions
        .map((prescription) => getPatientIdForPrescription(prescription))
        .filter(Boolean)
    ))

    if (!ids.length) {
      return
    }

    const missingIds = ids.filter((id) => {
      if (patientCache[id]) return false
      if (Array.isArray(patients) && patients.some((patient) => patient.id === id)) {
        return false
      }
      return true
    })

    if (!missingIds.length) {
      return
    }

    try {
      const results = await Promise.all(
        missingIds.map((id) => firebaseStorage.getPatientById(id))
      )
      if (requestId !== patientRequestId) return
      const nextCache = { ...patientCache }
      results.forEach((patient, index) => {
        if (patient) {
          nextCache[missingIds[index]] = patient
        }
      })
      patientCache = nextCache
    } catch (error) {
      console.error('❌ Error loading patients for prescriptions:', error)
    }
  }

  const loadMissingDoctors = async () => {
    const requestId = ++doctorRequestId
    const ids = Array.from(new Set(
      allPrescriptions
        .map((prescription) => getDoctorIdForPrescription(prescription))
        .filter(Boolean)
    ))
    const emails = Array.from(new Set(
      allPrescriptions
        .map((prescription) => getDoctorEmailForPrescription(prescription))
        .filter(Boolean)
    ))

    const missingIds = ids.filter((id) => !doctorCache[id])
    const missingEmails = emails.filter((email) => !doctorCache[email])

    if (!missingIds.length && !missingEmails.length) {
      return
    }

    try {
      const idResults = await Promise.all(
        missingIds.map((id) => firebaseStorage.getDoctorById(id).catch(() => null))
      )
      const emailResults = await Promise.all(
        missingEmails.map((email) => firebaseStorage.getDoctorByEmail(email).catch(() => null))
      )
      if (requestId !== doctorRequestId) return
      const nextCache = { ...doctorCache }
      idResults.forEach((doctor, index) => {
        if (doctor) {
          nextCache[missingIds[index]] = doctor
        }
      })
      emailResults.forEach((doctor, index) => {
        if (doctor) {
          nextCache[missingEmails[index]] = doctor
        }
      })
      doctorCache = nextCache
    } catch (error) {
      console.error('❌ Error loading doctors for prescriptions:', error)
    }
  }

  const calculateMedicationQuantity = (medication) => {
    const frequency = medication?.frequency || ''
    const duration = medication?.duration || ''
    const numericMatch = duration.match(/(\d+)/)
    if (!numericMatch) return 0
    const days = parseInt(numericMatch[1], 10)
    if (Number.isNaN(days) || days <= 0) return 0

    let dailyFrequency = 1
    if (frequency.includes('Once')) {
      dailyFrequency = 1
    } else if (frequency.includes('Twice')) {
      dailyFrequency = 2
    } else if (frequency.includes('Three')) {
      dailyFrequency = 3
    } else if (frequency.includes('Four')) {
      dailyFrequency = 4
    } else if (frequency.includes('Every 6 hours')) {
      dailyFrequency = 4
    } else if (frequency.includes('Every 8 hours')) {
      dailyFrequency = 3
    } else if (frequency.includes('Every 12 hours')) {
      dailyFrequency = 2
    } else if (frequency.includes('Weekly')) {
      dailyFrequency = 1 / 7
    } else if (frequency.includes('Monthly')) {
      dailyFrequency = 1 / 30
    } else if (frequency.includes('Before meals') || frequency.includes('(AC)')) {
      dailyFrequency = 3
    } else if (frequency.includes('After meals') || frequency.includes('(PC)')) {
      dailyFrequency = 3
    } else if (frequency.includes('At bedtime') || frequency.includes('(HS)')) {
      dailyFrequency = 1
    }

    const totalAmount = Math.ceil(dailyFrequency * days)
    return totalAmount > 0 ? totalAmount : 0
  }

  const getProcedureList = (prescription) => {
    const directProcedures = Array.isArray(prescription?.procedures) ? prescription.procedures : []
    if (directProcedures.length > 0) {
      return directProcedures
    }
    if (Array.isArray(prescription?.prescriptions)) {
      const nested = prescription.prescriptions
        .map((entry) => entry?.procedures || [])
        .flat()
        .filter(Boolean)
      return Array.from(new Set(nested))
    }
    return []
  }

  const formatCurrencyDisplay = (amount, currencyCode = 'USD') =>
    formatCurrencyByLocale(amount, { currency: currencyCode })

  const buildChargePayload = (prescription) => {
    const medications = Array.isArray(prescription?.medications) ? prescription.medications : []
    const medicationsForCharge = medications.map((medication) => ({
      ...medication,
      amount: medication.amount || calculateMedicationQuantity(medication),
      isDispensed: true
    }))
    const procedures = getProcedureList(prescription)
    const resolvedDiscount = Number.isFinite(Number(prescription?.discount)) ? Number(prescription.discount) : 0
    const excludeConsultationCharge = !!prescription?.excludeConsultationCharge
    const doctorIdentifier = prescription?.doctorId || null

    return {
      id: prescription?.id,
      doctorId: doctorIdentifier,
      discount: resolvedDiscount,
      procedures: procedures,
      excludeConsultationCharge: excludeConsultationCharge,
      prescriptions: [
        {
          id: prescription?.id,
          medications: medicationsForCharge,
          procedures: procedures,
          discount: resolvedDiscount,
          excludeConsultationCharge: excludeConsultationCharge
        }
      ]
    }
  }

  const loadExpectedPharmacist = async () => {
    const doctorIdentifier = allPrescriptions.find((item) => item?.doctorId)?.doctorId
    if (!doctorIdentifier) {
      expectedPharmacist = null
      return
    }
    const doctor = await firebaseStorage.getDoctorById(doctorIdentifier)
    if (!doctor) {
      expectedPharmacist = null
      return
    }
    const allPharmacists = await firebaseStorage.getAllPharmacists()
    const connectedPharmacists = allPharmacists.filter((pharmacist) => {
      const pharmacistHasDoctor = pharmacist.connectedDoctors && pharmacist.connectedDoctors.includes(doctor.id)
      const doctorHasPharmacist = doctor.connectedPharmacists && doctor.connectedPharmacists.includes(pharmacist.id)
      return pharmacistHasDoctor || doctorHasPharmacist
    })
    expectedPharmacist = connectedPharmacists[0] || null
  }

  const refreshChargeTotals = async () => {
    if (!allPrescriptions.length) {
      chargeTotals = {}
      return
    }
    const requestId = ++chargesRequestId
    chargesLoading = true
    try {
      await loadExpectedPharmacist()
      if (requestId !== chargesRequestId) return
      if (!expectedPharmacist) {
        chargeTotals = {}
        return
      }
      const totals = {}
      for (const prescription of allPrescriptions) {
        const payload = buildChargePayload(prescription)
        if (!payload?.doctorId) {
          continue
        }
        const breakdown = await chargeCalculationService.calculatePrescriptionCharge(payload, expectedPharmacist)
        totals[prescription.id] = breakdown?.totalCharge ?? null
      }
      if (requestId === chargesRequestId) {
        chargeTotals = totals
      }
    } catch (error) {
      console.error('❌ Error calculating prescription totals:', error)
    } finally {
      if (requestId === chargesRequestId) {
        chargesLoading = false
      }
    }
  }

  $: if (allPrescriptions.length > 0) {
    refreshChargeTotals()
  }

  $: if (allPrescriptions.length > 0) {
    loadMissingPatients()
  }
  
  // Pagination functions
  const goToPage = (page) => {
    if (page >= 1 && page <= totalPages) {
      currentPage = page
    }
  }
  
  const goToPreviousPage = () => {
    if (currentPage > 1) {
      currentPage--
    }
  }
  
  const goToNextPage = () => {
    if (currentPage < totalPages) {
      currentPage++
    }
  }
</script>

{#if paginatedPrescriptions && paginatedPrescriptions.length > 0}
  <div class="space-y-4">
    {#each paginatedPrescriptions as prescription, prescriptionIndex}
      <div class="bg-white rounded-lg shadow-sm border {prescriptionIndex % 2 === 0 ? 'border-teal-200' : 'border-teal-200'}">
        <!-- Prescription Header -->
        <div class="bg-gradient-to-r from-teal-600 to-emerald-600 text-white px-4 py-3 rounded-t-lg">
          <div class="flex flex-wrap items-start justify-between gap-2">
            <div class="flex items-center gap-3">
              <span class="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/15">
                <i class="fas fa-prescription-bottle-alt text-sm"></i>
              </span>
              <div>
                <h6 class="text-base font-semibold leading-tight">
                  Prescription #{prescriptionIndex + 1}
                </h6>
                <p class="text-xs text-white/80">
                  {formatPrescriptionDate(prescription.createdAt)} • {resolveDoctorName(prescription)}
                </p>
              </div>
            </div>
            <div class="flex flex-wrap items-center gap-2 text-xs font-semibold">
              <span class="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1">
                <i class="fas fa-user-md"></i>
                {resolveDoctorName(prescription)}
              </span>
              <span class="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1">
                <i class="fas fa-hashtag"></i>
                {formatPrescriptionId(prescription.id)}
              </span>
            </div>
          </div>
          {#if prescription.notes}
            <div class="mt-2 flex items-start gap-2 text-xs text-white/90">
              <i class="fas fa-sticky-note mt-0.5 text-white/80"></i>
              <span>{prescription.notes}</span>
            </div>
          {/if}
        </div>
        
        <!-- Medications List -->
        <div class="divide-y divide-gray-200">
          <div class="p-3 bg-gray-50 border-b border-gray-200">
            <div class="grid grid-cols-1 lg:grid-cols-3 gap-3 text-xs text-gray-700">
              <div class="lg:col-span-2 bg-white border border-gray-200 rounded-lg p-3">
                <div class="flex items-center gap-2 text-teal-700 font-semibold mb-2 text-sm">
                  <i class="fas fa-user"></i>
                  <span>Patient Details</span>
                </div>
                {#if resolvePatientForPrescription(prescription)}
                  {@const patient = resolvePatientForPrescription(prescription)}
                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
                    <div class="flex items-center gap-2">
                      <span class="font-medium text-gray-600">Name:</span>
                      <span>{patient.firstName} {patient.lastName}</span>
                    </div>
                    <div class="flex items-center gap-2">
                      <span class="font-medium text-gray-600">ID:</span>
                      <span>{patient.idNumber || 'N/A'}</span>
                    </div>
                    <div class="flex items-center gap-2">
                      <span class="font-medium text-gray-600">Gender:</span>
                      <span>{patient.gender || 'N/A'}</span>
                    </div>
                    <div class="flex items-center gap-2">
                      <span class="font-medium text-gray-600">Age:</span>
                      <span>{patient.age || 'N/A'}</span>
                    </div>
                    <div class="flex items-center gap-2">
                      <span class="font-medium text-gray-600">Blood Group:</span>
                      <span>{patient.bloodGroup || 'N/A'}</span>
                    </div>
                    <div class="flex items-center gap-2">
                      <span class="font-medium text-gray-600">Phone:</span>
                      <span>{patient.phone || 'N/A'}</span>
                    </div>
                    <div class="flex items-center gap-2">
                      <span class="font-medium text-gray-600">Email:</span>
                      <span>{patient.email || 'N/A'}</span>
                    </div>
                    <div class="flex items-center gap-2 sm:col-span-2">
                      <span class="font-medium text-gray-600">Address:</span>
                      <span>{patient.address || 'N/A'}</span>
                    </div>
                  </div>
                {:else}
                  <div class="text-gray-500">Patient details not available.</div>
                {/if}
              </div>

              <div class="bg-white border border-gray-200 rounded-lg p-3 space-y-2">
                <div>
                  <div class="flex items-center gap-2 text-teal-700 font-semibold mb-2 text-sm">
                    <i class="fas fa-notes-medical"></i>
                    <span>Procedures</span>
                  </div>
                  <div class="text-gray-700 text-xs">
                    {getProcedureList(prescription).length > 0 ? getProcedureList(prescription).join(', ') : 'None'}
                  </div>
                </div>
                <div class="border-t border-gray-200 pt-2">
                  <div class="flex items-center gap-2 text-teal-700 font-semibold mb-1 text-sm">
                    <i class="fas fa-receipt"></i>
                    <span>Total (rounded)</span>
                  </div>
                  <div class="text-gray-700 font-medium text-xs">
                    {#if chargesLoading}
                      Calculating...
                    {:else if chargeTotals[prescription.id] !== undefined && expectedPharmacist}
                      {#if currency === 'LKR'}
                        Rs {formatCurrencyDisplay(chargeTotals[prescription.id], currency)}
                      {:else}
                        {formatCurrencyDisplay(chargeTotals[prescription.id], currency)}
                      {/if}
                    {:else}
                      N/A
                    {/if}
                  </div>
                </div>
              </div>
            </div>
          </div>
          {#if prescription.medications && prescription.medications.length > 0}
            {#each prescription.medications as medication, medicationIndex}
            <div class="p-3 {medicationIndex === prescription.medications.length - 1 ? '' : 'border-b border-gray-200'} text-xs text-gray-700">
              <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                <div class="col-span-full">
                  <h6 class="text-sm font-semibold text-teal-600 mb-1">
                    <i class="fas fa-pills mr-2"></i>
                    {medication.name || 'Unknown Medication'}{#if medication.genericName && medication.genericName !== medication.name} ({medication.genericName}){/if}
                  </h6>
                </div>
                <div>
                  <div class="text-[10px] text-gray-500 uppercase tracking-wide mb-1">Dosage</div>
                  <div class="font-medium text-gray-900">{getMedicationDosageDisplay(medication)}</div>
                </div>
                <div>
                  <div class="text-[10px] text-gray-500 uppercase tracking-wide mb-1">Duration</div>
                  <div class="font-medium text-gray-900">{medication.duration || 'Not specified'}</div>
                </div>
                <div>
                  <div class="text-[10px] text-gray-500 uppercase tracking-wide mb-1">Frequency</div>
                  <div class="font-medium text-gray-900">{medication.frequency || 'Not specified'}</div>
                </div>
                <div>
                  <div class="text-[10px] text-gray-500 uppercase tracking-wide mb-1">Added</div>
                  <div class="text-gray-600 font-medium">
                    <i class="fas fa-calendar mr-1"></i>
                    {formatPrescriptionDate(prescription.createdAt)}
                  </div>
                </div>
                <div class="col-span-full">
                  <div class="text-[10px] text-gray-500 uppercase tracking-wide mb-1">Instructions</div>
                  <p class="text-gray-700">{medication.instructions || 'No instructions provided'}</p>
                </div>
                {#if medication.notes}
                  <div class="col-span-full">
                    <div class="text-[10px] text-gray-500 uppercase tracking-wide mb-1">Notes</div>
                    <p class="text-teal-600">{medication.notes}</p>
                  </div>
                {/if}
              </div>
            </div>
            {/each}
          {:else}
            <div class="p-4 text-center text-gray-500">
              <i class="fas fa-exclamation-triangle mr-2"></i>
              No medications in this prescription
            </div>
          {/if}
        </div>
      </div>
    {/each}
    
    <!-- Pagination Controls -->
    {#if totalPages > 1}
      <div class="flex items-center justify-between mt-6 px-4 py-3 bg-gray-50 rounded-lg">
        <div class="flex items-center text-sm text-gray-700">
          <span>Showing {startIndex + 1} to {Math.min(endIndex, allPrescriptions.length)} of {allPrescriptions.length} prescriptions</span>
        </div>
        
        <div class="flex items-center space-x-2">
          <!-- Previous Button -->
          <button 
            class="inline-flex items-center px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            on:click={goToPreviousPage}
            disabled={currentPage === 1}
          >
            <i class="fas fa-chevron-left mr-1"></i>
            Previous
          </button>
          
          <!-- Page Numbers -->
          <div class="flex items-center space-x-1">
            {#each Array.from({length: Math.min(5, totalPages)}, (_, i) => {
              const startPage = Math.max(1, currentPage - 2)
              const endPage = Math.min(totalPages, startPage + 4)
              const page = startPage + i
              return page <= endPage ? page : null
            }).filter(Boolean) as page}
              <button 
                class="inline-flex items-center px-3 py-2 text-sm font-medium rounded-lg {currentPage === page ? 'text-white bg-teal-600 border-teal-600' : 'text-gray-500 bg-white border border-gray-300 hover:bg-gray-50 hover:text-gray-700'}"
                on:click={() => goToPage(page)}
              >
                {page}
              </button>
            {/each}
          </div>
          
          <!-- Next Button -->
          <button 
            class="inline-flex items-center px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            on:click={goToNextPage}
            disabled={currentPage === totalPages}
          >
            Next
            <i class="fas fa-chevron-right ml-1"></i>
          </button>
        </div>
      </div>
    {/if}
  </div>
{:else}
  <div class="text-center py-8">
    <i class="fas fa-pills text-4xl text-gray-400 mb-3"></i>
    <p class="text-gray-500">No prescriptions found for this patient.</p>
  </div>
{/if}
