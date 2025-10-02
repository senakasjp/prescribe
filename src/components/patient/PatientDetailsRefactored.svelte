<script>
  import { onMount, tick } from 'svelte'
  import { createEventDispatcher } from 'svelte'
  import firebaseStorage from '../../services/firebaseStorage.js'
  import openaiService from '../../services/openaiService.js'
  import authService from '../../services/authService.js'
  import PatientTabs from '../PatientTabs.svelte'
  import PatientForms from '../PatientForms.svelte'
  import PrescriptionList from '../PrescriptionList.svelte'
  import PrescriptionPDF from '../PrescriptionPDF.svelte'
  import LoadingSpinner from '../LoadingSpinner.svelte'
  import AIRecommendations from '../AIRecommendations.svelte'
  import PrescriptionsTab from '../PrescriptionsTab.svelte'
  import ConfirmationModal from '../ConfirmationModal.svelte'
  
  // Import refactored components
  import PatientOverview from './patient/PatientOverview.svelte'
  import PatientSymptoms from './patient/PatientSymptoms.svelte'
  import PatientReports from './patient/PatientReports.svelte'
  import PatientDiagnoses from './patient/PatientDiagnoses.svelte'
  import PatientPrescriptions from './patient/PatientPrescriptions.svelte'
  
  const dispatch = createEventDispatcher()
  
  export let selectedPatient
  export const addToPrescription = null
  export const refreshTrigger = 0
  export let doctorId = null
  export const currentUser = null
  export let initialTab = 'overview'
  
  // State management
  let illnesses = []
  let prescriptions = []
  let symptoms = []
  let reports = []
  let diagnoses = []
  let currentPrescription = null
  let currentMedications = []
  let activeTab = initialTab
  let enabledTabs = [initialTab]
  let isNewPrescriptionSession = false
  let loading = true
  
  // Form states
  let showSymptomsForm = false
  let showReportForm = false
  let showDiagnosisForm = false
  let showPrescriptionForm = false
  let showIllnessForm = false
  let showMedicationForm = false
  let showPrescriptionPDF = false
  
  // Edit states
  let isEditingPatient = false
  let editPatientData = {}
  let editingMedication = null
  let expandedSymptoms = {}
  
  // Prescription state
  let prescriptionNotes = ''
  let prescriptionsFinalized = false
  let printButtonClicked = false
  
  // AI state
  let isShowingAIDiagnostics = false
  let aiDrugSuggestions = []
  let loadingAIDrugSuggestions = false
  let showAIDrugSuggestions = false
  
  // Confirmation modal state
  let showConfirmationModal = false
  let confirmationConfig = {
    title: 'Confirm Action',
    message: 'Are you sure you want to proceed?',
    confirmText: 'Confirm',
    cancelText: 'Cancel',
    type: 'warning'
  }
  let pendingAction = null
  
  // Reactive statements
  $: enabledTabsKey = enabledTabs.join(',')
  
  $: if (selectedPatient) {
    activeTab = initialTab
    enabledTabs = [initialTab]
    loadMedicalData(selectedPatient.id)
  }
  
  // Load medical data for selected patient
  async function loadMedicalData(patientId) {
    if (!patientId) return
    
    loading = true
    try {
      const [symptomsData, illnessesData, prescriptionsData, reportsData, diagnosesData] = await Promise.all([
        firebaseStorage.getSymptomsByPatientId(patientId),
        firebaseStorage.getIllnessesByPatientId(patientId),
        firebaseStorage.getPrescriptionsByPatientId(patientId),
        firebaseStorage.getReportsByPatientId(patientId),
        firebaseStorage.getDiagnosesByPatientId(patientId)
      ])
      
      symptoms = symptomsData || []
      illnesses = illnessesData || []
      prescriptions = prescriptionsData || []
      reports = reportsData || []
      diagnoses = diagnosesData || []
      
      // Enable tabs based on available data
      updateEnabledTabs()
      
    } catch (error) {
      console.error('Error loading medical data:', error)
    } finally {
      loading = false
    }
  }
  
  // Update enabled tabs based on available data
  function updateEnabledTabs() {
    const newEnabledTabs = ['overview']
    
    if (symptoms.length > 0) newEnabledTabs.push('symptoms')
    if (reports.length > 0) newEnabledTabs.push('reports')
    if (diagnoses.length > 0) newEnabledTabs.push('diagnoses')
    if (prescriptions.length > 0) newEnabledTabs.push('prescriptions')
    
    // Always enable prescriptions tab for new prescriptions
    if (!newEnabledTabs.includes('prescriptions')) {
      newEnabledTabs.push('prescriptions')
    }
    
    enabledTabs = newEnabledTabs
  }
  
  // Handle tab change
  function handleTabChange(tab) {
    if (enabledTabs.includes(tab)) {
      activeTab = tab
    }
  }
  
  // Confirmation modal helpers
  function showConfirmation(title, message, confirmText = 'Confirm', cancelText = 'Cancel', type = 'warning') {
    confirmationConfig = { title, message, confirmText, cancelText, type }
    showConfirmationModal = true
  }
  
  function handleConfirmationConfirm() {
    if (pendingAction) {
      pendingAction()
      pendingAction = null
    }
    showConfirmationModal = false
  }
  
  function handleConfirmationCancel() {
    pendingAction = null
    showConfirmationModal = false
  }
  
  // Event handlers for child components
  function handleToggleEdit(event) {
    isEditingPatient = event.detail.isEditing
  }
  
  function handleSavePatient(event) {
    const patientData = event.detail
    // Save patient data logic here
    console.log('Saving patient data:', patientData)
    isEditingPatient = false
  }
  
  function handleCancelEdit() {
    isEditingPatient = false
    editPatientData = {}
  }
  
  function handleAddSymptom() {
    showSymptomsForm = true
  }
  
  function handleEditSymptom(event) {
    const symptom = event.detail
    console.log('Editing symptom:', symptom)
  }
  
  function handleDeleteSymptom(event) {
    const symptom = event.detail
    showConfirmation(
      'Delete Symptom',
      'Are you sure you want to delete this symptom?',
      'Delete',
      'Cancel',
      'danger'
    )
    pendingAction = () => {
      console.log('Deleting symptom:', symptom)
      // Delete logic here
    }
  }
  
  function handleAddReport() {
    showReportForm = true
  }
  
  function handleEditReport(event) {
    const report = event.detail
    console.log('Editing report:', report)
  }
  
  function handleDeleteReport(event) {
    const report = event.detail
    showConfirmation(
      'Delete Report',
      'Are you sure you want to delete this report?',
      'Delete',
      'Cancel',
      'danger'
    )
    pendingAction = () => {
      console.log('Deleting report:', report)
      // Delete logic here
    }
  }
  
  function handleAddDiagnosis() {
    showDiagnosisForm = true
  }
  
  function handleEditDiagnosis(event) {
    const diagnosis = event.detail
    console.log('Editing diagnosis:', diagnosis)
  }
  
  function handleDeleteDiagnosis(event) {
    const diagnosis = event.detail
    showConfirmation(
      'Delete Diagnosis',
      'Are you sure you want to delete this diagnosis?',
      'Delete',
      'Cancel',
      'danger'
    )
    pendingAction = () => {
      console.log('Deleting diagnosis:', diagnosis)
      // Delete logic here
    }
  }
  
  function handleAddPrescription() {
    showPrescriptionForm = true
  }
  
  function handleEditPrescription(event) {
    const prescription = event.detail
    console.log('Editing prescription:', prescription)
  }
  
  function handleDeletePrescription(event) {
    const prescription = event.detail
    showConfirmation(
      'Delete Prescription',
      'Are you sure you want to delete this prescription?',
      'Delete',
      'Cancel',
      'danger'
    )
    pendingAction = () => {
      console.log('Deleting prescription:', prescription)
      // Delete logic here
    }
  }
  
  function handleFinalizePrescription(event) {
    const prescriptionData = event.detail
    console.log('Finalizing prescription:', prescriptionData)
    showPrescriptionForm = false
    currentMedications = []
    prescriptionNotes = ''
  }
  
  function handleAddMedication() {
    showMedicationForm = true
  }
  
  function handleEditMedication(event) {
    const medication = event.detail
    console.log('Editing medication:', medication)
  }
  
  function handleDeleteMedication(event) {
    const medication = event.detail
    console.log('Deleting medication:', medication)
  }
  
  // Load data on mount
  onMount(() => {
    if (selectedPatient) {
      loadMedicalData(selectedPatient.id)
    }
  })
</script>

<div class="h-full flex flex-col">
  <!-- Patient Tabs -->
  <PatientTabs
    {activeTab}
    {enabledTabs}
    on:tab-change={(e) => handleTabChange(e.detail.tab)}
  />
  
  <!-- Main Content -->
  <div class="flex-1 overflow-auto">
    {#if loading}
      <div class="flex items-center justify-center h-64">
        <LoadingSpinner />
      </div>
    {:else if activeTab === 'overview'}
      <PatientOverview
        {selectedPatient}
        {isEditingPatient}
        bind:editPatientData
        on:toggle-edit={handleToggleEdit}
        on:save-patient={handleSavePatient}
        on:cancel-edit={handleCancelEdit}
      />
    {:else if activeTab === 'symptoms'}
      <PatientSymptoms
        {symptoms}
        {selectedPatient}
        {doctorId}
        {showSymptomsForm}
        bind:expandedSymptoms
        on:add-symptom={handleAddSymptom}
        on:edit-symptom={handleEditSymptom}
        on:delete-symptom={handleDeleteSymptom}
      />
    {:else if activeTab === 'reports'}
      <PatientReports
        {reports}
        {selectedPatient}
        {doctorId}
        {showReportForm}
        on:add-report={handleAddReport}
        on:edit-report={handleEditReport}
        on:delete-report={handleDeleteReport}
      />
    {:else if activeTab === 'diagnoses'}
      <PatientDiagnoses
        {diagnoses}
        {selectedPatient}
        {doctorId}
        {showDiagnosisForm}
        on:add-diagnosis={handleAddDiagnosis}
        on:edit-diagnosis={handleEditDiagnosis}
        on:delete-diagnosis={handleDeleteDiagnosis}
      />
    {:else if activeTab === 'prescriptions'}
      <PatientPrescriptions
        {prescriptions}
        {selectedPatient}
        {doctorId}
        {showPrescriptionForm}
        {currentPrescription}
        bind:currentMedications
        bind:prescriptionNotes
        {prescriptionsFinalized}
        on:add-prescription={handleAddPrescription}
        on:edit-prescription={handleEditPrescription}
        on:delete-prescription={handleDeletePrescription}
        on:finalize-prescription={handleFinalizePrescription}
        on:add-medication={handleAddMedication}
        on:edit-medication={handleEditMedication}
        on:delete-medication={handleDeleteMedication}
      />
    {/if}
  </div>
  
  <!-- Forms Modal -->
  {#if showSymptomsForm || showReportForm || showDiagnosisForm || showIllnessForm || showMedicationForm}
    <PatientForms
      {selectedPatient}
      {doctorId}
      {showSymptomsForm}
      {showReportForm}
      {showDiagnosisForm}
      {showIllnessForm}
      {showMedicationForm}
      on:close={() => {
        showSymptomsForm = false
        showReportForm = false
        showDiagnosisForm = false
        showIllnessForm = false
        showMedicationForm = false
      }}
      on:save={(event) => {
        console.log('Form saved:', event.detail)
        // Handle form save
      }}
    />
  {/if}
  
  <!-- Confirmation Modal -->
  <ConfirmationModal
    bind:show={showConfirmationModal}
    config={confirmationConfig}
    on:confirm={handleConfirmationConfirm}
    on:cancel={handleConfirmationCancel}
  />
  
  <!-- Prescription PDF Modal -->
  {#if showPrescriptionPDF}
    <PrescriptionPDF
      {selectedPatient}
      {currentPrescription}
      on:close={() => showPrescriptionPDF = false}
    />
  {/if}
</div>
