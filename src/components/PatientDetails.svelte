<script>
  import { onMount } from 'svelte'
  import jsonStorage from '../services/jsonStorage.js'
  import openaiService from '../services/openaiService.js'
  import PatientTabs from './PatientTabs.svelte'
  import PatientForms from './PatientForms.svelte'
  import PrescriptionList from './PrescriptionList.svelte'
  import PrescriptionPDF from './PrescriptionPDF.svelte'
  import AIRecommendations from './AIRecommendations.svelte'
  
  export let selectedPatient
  export const addToPrescription = null
  export let refreshTrigger = 0
  export let doctorId = null
  
  // Event dispatcher to notify parent of data changes
  import { createEventDispatcher } from 'svelte'
  const dispatch = createEventDispatcher()
  
  let illnesses = []
  let prescriptions = []
  let symptoms = []
  let currentPrescriptions = []
  let activeTab = 'overview'
  let showIllnessForm = false
  let showMedicationForm = false
  let showSymptomsForm = false
  let showPrescriptionPDF = false
  let expandedSymptoms = {}
  let expandedIllnesses = {}
  let loading = true
  let editingMedication = null
  let prescriptionNotes = ''
  let prescriptionsFinalized = false
  let printButtonClicked = false
  
  // Drug interaction checking
  let drugInteractions = null
  let checkingInteractions = false
  let interactionError = ''
  let showInteractions = false
  
  // Load patient data
  const loadPatientData = async () => {
    try {
      console.log('🔄 Loading data for patient:', selectedPatient.id)
      
      // Reset finalized state when loading new patient data
      prescriptionsFinalized = false
      printButtonClicked = false
      
      // Load illnesses
      illnesses = await jsonStorage.getIllnessesByPatientId(selectedPatient.id) || []
      console.log('✅ Loaded illnesses:', illnesses.length)
      
      // Load prescriptions
      prescriptions = await jsonStorage.getPrescriptionsByPatientId(selectedPatient.id) || []
      console.log('✅ Loaded prescriptions:', prescriptions.length)
      console.log('📋 Prescriptions data:', prescriptions)
      
      // Load symptoms
      symptoms = await jsonStorage.getSymptomsByPatientId(selectedPatient.id) || []
      console.log('✅ Loaded symptoms:', symptoms.length)
      
    } catch (error) {
      console.error('Error loading patient data:', error)
      // Ensure arrays are always defined
      illnesses = []
      prescriptions = []
      symptoms = []
    } finally {
      loading = false
    }
  }
  
  // Filter current prescriptions (show all prescriptions)
  const filterCurrentPrescriptions = () => {
    console.log('🔍 Showing all prescriptions from', prescriptions.length, 'total prescriptions')
    
    // Show all prescriptions regardless of start/end dates
    currentPrescriptions = prescriptions.filter(prescription => {
      // Only filter out prescriptions that have explicitly ended (before today)
      if (prescription.endDate) {
        const endDate = new Date(prescription.endDate)
        const today = new Date()
        today.setHours(0, 0, 0, 0) // Set to start of day for accurate comparison
        endDate.setHours(0, 0, 0, 0)
        
        const hasEnded = endDate < today
        
        if (hasEnded) {
          console.log(`📋 ${prescription.name}: ended on ${prescription.endDate} - not showing`)
          return false
        }
      }
      
      console.log(`📋 ${prescription.name}: showing in current prescriptions`)
      return true
    })
    console.log('📅 Current prescriptions (all active):', currentPrescriptions.length)
    
    // Check for drug interactions when prescriptions change
    // Only check if not already checking (to avoid duplicate calls)
    if (currentPrescriptions.length >= 2 && !checkingInteractions) {
      checkDrugInteractions()
    } else if (currentPrescriptions.length < 2) {
      drugInteractions = null
      showInteractions = false
    }
  }
  
  // Check for drug interactions
  const checkDrugInteractions = async () => {
    if (!openaiService.isConfigured()) {
      interactionError = 'OpenAI API not configured. Cannot check drug interactions.'
      return
    }
    
    if (currentPrescriptions.length < 2) {
      drugInteractions = null
      return
    }
    
    checkingInteractions = true
    interactionError = ''
    
    try {
      console.log('🔍 Checking drug interactions for:', currentPrescriptions.map(p => p.name))
      drugInteractions = await openaiService.checkDrugInteractions(currentPrescriptions, doctorId)
      console.log('✅ Drug interactions checked:', drugInteractions)
      
      // Notify parent that AI usage was updated
      if (addToPrescription) {
        addToPrescription('ai-usage', { type: 'drug-interactions', timestamp: new Date().toISOString() })
        console.log('📊 AI usage updated - drug interactions checked')
      }
    } catch (error) {
      console.error('❌ Error checking drug interactions:', error)
      interactionError = error.message
    } finally {
      checkingInteractions = false
    }
  }
  
  // Toggle drug interactions display
  const toggleInteractions = () => {
    showInteractions = !showInteractions
  }
  
  // Format drug interactions for display
  const formatInteractions = (text) => {
    if (!text) return ''
    
    return text
      // Convert section headers (lines that end with colon)
      .replace(/^([^:\n]+):$/gm, '<br><h6 class="text-primary mb-2 mt-3">$1:</h6>')
      // Convert bold text patterns
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      // Convert italic text patterns
      .replace(/\*([^*]+)\*/g, '<em>$1</em>')
      // Convert line breaks
      .replace(/\n/g, '<br>')
      // Clean up multiple line breaks
      .replace(/(<br>){3,}/g, '<br><br>')
      // Add proper spacing after headers
      .replace(/(<h6[^>]*>.*?<\/h6>)/g, '$1<br>')
      // Clean up leading/trailing breaks
      .replace(/^(<br>)+|(<br>)+$/g, '')
  }
  
  // Reactive statement to filter current prescriptions when prescriptions change
  $: if (prescriptions) {
    console.log('🔄 Reactive statement triggered - prescriptions changed:', prescriptions.length)
    filterCurrentPrescriptions()
  }
  
  // Handle tab change
  const handleTabChange = (tab) => {
    activeTab = tab
    // Reset form visibility when changing tabs
    showIllnessForm = false
    showSymptomsForm = false
    showMedicationForm = false
  }
  
  // Handle form submissions
  const handleIllnessAdded = async (event) => {
    const illnessData = event.detail
    console.log('🦠 Illness added:', illnessData)
    
    try {
      // Save illness to database
      const newIllness = await jsonStorage.createIllness({
        ...illnessData,
        patientId: selectedPatient.id,
        doctorId: doctorId
      })
      
      console.log('💾 Illness saved to database:', newIllness)
      
      // Add to illnesses array immediately and trigger reactivity
      illnesses = [...illnesses, newIllness]
      console.log('📋 Updated illnesses array:', illnesses.length)
      
      // Notify parent component to refresh medical summary
      dispatch('dataUpdated', { 
        type: 'illness', 
        data: newIllness 
      })
      
    } catch (error) {
      console.error('❌ Error saving illness:', error)
      // Reload data to ensure consistency
      loadPatientData()
    }
    
    showIllnessForm = false
  }
  
  const handleSymptomsAdded = async (event) => {
    const symptomsData = event.detail
    console.log('🤒 Symptoms added:', symptomsData)
    
    try {
      // Save symptoms to database
      const newSymptoms = await jsonStorage.createSymptoms({
        ...symptomsData,
        patientId: selectedPatient.id,
        doctorId: doctorId
      })
      
      console.log('💾 Symptoms saved to database:', newSymptoms)
      
      // Add to symptoms array immediately and trigger reactivity
      symptoms = [...symptoms, newSymptoms]
      console.log('📋 Updated symptoms array:', symptoms.length)
      
      // Notify parent component to refresh medical summary
      dispatch('dataUpdated', { 
        type: 'symptoms', 
        data: newSymptoms 
      })
      
    } catch (error) {
      console.error('❌ Error saving symptoms:', error)
      // Reload data to ensure consistency
      loadPatientData()
    }
    
    showSymptomsForm = false
  }
  
  const handleMedicationAdded = async (event) => {
    const medicationData = event.detail
    console.log('💊 Medication added:', medicationData)
    
    try {
      if (medicationData.isEdit) {
        // Update existing medication in database
        const updatedMedication = await jsonStorage.createMedication({
          ...medicationData,
          patientId: selectedPatient.id,
          doctorId: doctorId
        })
        
        // Update in local arrays
        const index = prescriptions.findIndex(p => p.id === medicationData.id)
        if (index !== -1) {
          prescriptions[index] = updatedMedication
          prescriptions = [...prescriptions] // Trigger reactivity
        }
        
        // Also update in current prescriptions if it exists there
        const currentIndex = currentPrescriptions.findIndex(p => p.id === medicationData.id)
        if (currentIndex !== -1) {
          currentPrescriptions[currentIndex] = updatedMedication
          currentPrescriptions = [...currentPrescriptions] // Trigger reactivity
        }
      } else {
        // Add new medication to database
        const newMedication = await jsonStorage.createMedication({
          ...medicationData,
          patientId: selectedPatient.id,
          doctorId: doctorId
        })
        
        console.log('💾 Medication saved to database:', newMedication)
        
        // Add to prescriptions array immediately and trigger reactivity
        prescriptions = [...prescriptions, newMedication]
        console.log('📋 Updated prescriptions array:', prescriptions.length)
        
        // Force update current prescriptions array
        currentPrescriptions = [...currentPrescriptions, newMedication]
        console.log('📋 Updated current prescriptions array:', currentPrescriptions.length)
        
        // Force reactivity by reassigning the array
        currentPrescriptions = currentPrescriptions
        
        // Also call the filter function to ensure consistency
        filterCurrentPrescriptions()
        
        // Check for drug interactions immediately after adding new medication
        // This ensures immediate feedback when a new drug is added
        if (currentPrescriptions.length >= 2) {
          console.log('🔍 New medication added - checking interactions immediately')
          checkDrugInteractions()
        }
        
        // Notify parent component to refresh medical summary
        dispatch('dataUpdated', { 
          type: 'prescription', 
          data: newMedication 
        })
      }
    } catch (error) {
      console.error('❌ Error saving medication:', error)
      // Reload data to ensure consistency
      loadPatientData()
    }
    
    showMedicationForm = false
    editingMedication = null
  }
  
  // Handle form cancellations
  const handleCancelIllness = () => {
    showIllnessForm = false
  }
  
  // Save or update current prescriptions to ensure they are persisted
  const saveCurrentPrescriptions = async () => {
    try {
      console.log('💾 Saving/updating current prescriptions...')
      
      // Ensure all current prescriptions are saved or updated in the database
      for (const prescription of currentPrescriptions) {
        // Check if prescription already exists in database
        const existingPrescription = prescriptions.find(p => p.id === prescription.id)
        
        if (!existingPrescription) {
          // This is a new prescription that needs to be saved
          const savedPrescription = await jsonStorage.createMedication({
            ...prescription,
            patientId: selectedPatient.id,
            doctorId: doctorId
          })
          console.log('✅ Saved new prescription:', prescription.name)
          
          // Add to prescriptions array
          prescriptions = [...prescriptions, savedPrescription]
        } else {
          // Always update existing prescription to ensure latest data is saved
          const updatedPrescription = {
            ...prescription,
            patientId: selectedPatient.id,
            doctorId: doctorId
          }
          
          await jsonStorage.updatePrescription(prescription.id, updatedPrescription)
          console.log('✅ Updated existing prescription:', prescription.name)
          
          // Update the prescription in the local array
          const prescriptionIndex = prescriptions.findIndex(p => p.id === prescription.id)
          if (prescriptionIndex !== -1) {
            prescriptions[prescriptionIndex] = updatedPrescription
          }
        }
      }
      
      // Update prescriptions array to trigger reactivity
      prescriptions = [...prescriptions]
      
      console.log('💾 All current prescriptions saved/updated successfully')
    } catch (error) {
      console.error('❌ Error saving/updating current prescriptions:', error)
    }
  }
  
  // Check with AI (no saving or printing)
  const finishCurrentPrescriptions = async () => {
    try {
      console.log('🤖 Checking prescriptions with AI...')
      
      // Only perform AI drug interaction check - no saving or printing
      if (currentPrescriptions.length >= 2) {
        console.log('🔍 Triggering AI drug interaction check...')
        await checkDrugInteractions()
      } else {
        console.log('ℹ️ Less than 2 medications - no interactions to check')
      }
      
      console.log('✅ AI check completed')
    } catch (error) {
      console.error('❌ Error during AI check:', error)
    }
  }

  // Complete current prescriptions (mark as finished without printing)
  const completePrescriptions = async () => {
    try {
      console.log('✅ Completing current prescriptions')
      
      // Save current prescriptions first
      await saveCurrentPrescriptions()
      
      // Set finalized state to hide edit/delete buttons
      prescriptionsFinalized = true
      
      // Mark all current prescriptions as completed by setting end date to today
      const today = new Date().toISOString().split('T')[0]
      
      for (const prescription of currentPrescriptions) {
        if (!prescription.endDate) {
          // Update prescription with end date
          const updatedPrescription = {
            ...prescription,
            endDate: today
          }
          
          // Update in database
          await jsonStorage.updatePrescription(prescription.id, updatedPrescription)
          console.log('✅ Marked prescription as completed:', prescription.name)
          
          // Update the prescription in the local array
          const prescriptionIndex = prescriptions.findIndex(p => p.id === prescription.id)
          if (prescriptionIndex !== -1) {
            prescriptions[prescriptionIndex] = updatedPrescription
          }
        }
      }
      
      // Update prescriptions array to trigger reactivity
      prescriptions = [...prescriptions]
      
      console.log('🎉 Current prescriptions completed successfully')
    } catch (error) {
      console.error('❌ Error completing prescriptions:', error)
    }
  }

  // Print prescriptions to PDF
  const printPrescriptions = async () => {
    try {
      console.log('🖨️ Printing prescriptions to PDF')
      
      // Save current prescriptions first
      await saveCurrentPrescriptions()
      
      // Generate and download PDF
      await generatePrescriptionPDF()
      
      // Also try to open print dialog as fallback
      setTimeout(() => {
        console.log('🖨️ Opening print dialog as fallback...')
        window.print()
      }, 1000)
      
      console.log('🎉 Prescriptions printed successfully')
    } catch (error) {
      console.error('❌ Error printing prescriptions:', error)
    }
  }
  
  // Test jsPDF functionality
  const testJsPDF = async () => {
    try {
      console.log('🧪 Testing jsPDF...')
      const { default: jsPDF } = await import('jspdf')
      const testDoc = new jsPDF()
      testDoc.text('Test PDF', 20, 20)
      testDoc.save('test.pdf')
      console.log('✅ jsPDF test successful')
      return true
    } catch (error) {
      console.error('❌ jsPDF test failed:', error)
      return false
    }
  }

  // Generate prescription PDF directly
  const generatePrescriptionPDF = async () => {
    try {
      console.log('🔄 Starting PDF generation...')
      
      // Test jsPDF first
      const jsPDFWorking = await testJsPDF()
      if (!jsPDFWorking) {
        throw new Error('jsPDF is not working properly')
      }
      
      // Try to import jsPDF
      let jsPDF
      try {
        const jsPDFModule = await import('jspdf')
        jsPDF = jsPDFModule.default
        console.log('✅ jsPDF imported successfully')
      } catch (importError) {
        console.error('❌ Failed to import jsPDF:', importError)
        // Fallback: try to use window.jsPDF if available
        if (typeof window !== 'undefined' && window.jsPDF) {
          jsPDF = window.jsPDF
          console.log('✅ Using window.jsPDF as fallback')
        } else {
          throw new Error('jsPDF is not available. Please check if it is properly installed.')
        }
      }
      
      const doc = new jsPDF()
      const currentDate = new Date().toLocaleDateString('en-US', {
        month: '2-digit',
        day: '2-digit', 
        year: 'numeric'
      })
      
      console.log('📄 Creating PDF content...')
      console.log('Patient:', selectedPatient.firstName, selectedPatient.lastName)
      console.log('Current prescriptions:', currentPrescriptions.length)
      console.log('Prescription notes:', prescriptionNotes)
      
      // Set up fonts and styles
      doc.setFont('helvetica', 'bold')
      
      // Header - PRESCRIPTION (centered, large)
      doc.setFontSize(24)
      doc.text('PRESCRIPTION', 105, 30, { align: 'center' })
      
      // Doctor info section
      doc.setFontSize(12)
      doc.setFont('helvetica', 'normal')
      doc.text('DOCTOR NAME', 20, 50)
      doc.text('Your Medical Clinic', 20, 60)
      
      // Date (right aligned)
      doc.text(`DATE: ${currentDate}`, 180, 50, { align: 'right' })
      
      // Patient info section with Rx symbol
      doc.setFontSize(16)
      doc.setFont('helvetica', 'bold')
      doc.text('R', 20, 85)
      
      // Patient name and age line
      doc.setFontSize(12)
      doc.setFont('helvetica', 'normal')
      doc.text(`PATIENT NAME: ${selectedPatient.firstName} ${selectedPatient.lastName}`, 35, 85)
      
      // Calculate age from date of birth
      const birthDate = new Date(selectedPatient.dateOfBirth)
      const today = new Date()
      const age = today.getFullYear() - birthDate.getFullYear()
      const monthDiff = today.getMonth() - birthDate.getMonth()
      const actualAge = monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate()) ? age - 1 : age
      
      doc.text(`AGE: ${actualAge}`, 150, 85)
      
      // Address line
      doc.text(`ADDRESS: ${selectedPatient.address || 'Not provided'}`, 35, 95)
      
      // Medications section
      let yPos = 120
      
      if (currentPrescriptions && currentPrescriptions.length > 0) {
        currentPrescriptions.forEach((medication, index) => {
          if (yPos > 250) {
            doc.addPage()
            yPos = 30
          }
          
          // Medication name and dosage
          doc.setFontSize(12)
          doc.setFont('helvetica', 'normal')
          doc.text(`${medication.name} ${medication.dosage}`, 20, yPos)
          
          // Instructions
          yPos += 8
          doc.text(`${medication.instructions || `Take ${medication.frequency}`}`, 20, yPos)
          
          yPos += 15 // Space between medications
        })
      }
      
      // Add prescription notes if available
      if (prescriptionNotes && prescriptionNotes.trim() !== '') {
        if (yPos > 250) {
          doc.addPage()
          yPos = 30
        }
        yPos += 10
        doc.text('Additional Notes:', 20, yPos)
        yPos += 8
        const notes = doc.splitTextToSize(prescriptionNotes, 170)
        doc.text(notes, 20, yPos)
        yPos += notes.length * 5
      }
      
      // Signature section
      const signatureY = Math.max(yPos + 30, 200)
      
      // Doctor signature line
      doc.setFontSize(12)
      doc.setFont('helvetica', 'normal')
      doc.text('Dr. [Doctor Name]', 150, signatureY)
      
      // Draw signature line
      doc.line(140, signatureY + 5, 190, signatureY + 5)
      
      // Medical seal (simplified)
      doc.setFontSize(8)
      doc.text('MEDICAL SEAL', 20, signatureY)
      doc.circle(30, signatureY - 5, 8)
      
      // Add caduceus symbol (simplified)
      doc.setFontSize(6)
      doc.text('⚕', 30, signatureY - 2, { align: 'center' })
      
      // Generate filename with capital letter as per user preference
      const filename = `Prescription_${selectedPatient.firstName}_${selectedPatient.lastName}_${currentDate.replace(/\//g, '-')}.pdf`
      
      console.log('💾 Saving PDF with filename:', filename)
      
      // Save the PDF
      doc.save(filename)
      
      console.log('✅ PDF generated and downloaded successfully:', filename)
      
      // Show success message to user
      alert(`PDF generated successfully: ${filename}`)
      
    } catch (error) {
      console.error('❌ Error generating PDF:', error)
      console.error('Error details:', error.message)
      console.error('Error stack:', error.stack)
      
      // Show error message to user
      alert(`Error generating PDF: ${error.message}`)
      
      // Try alternative approach - open print dialog
      console.log('🔄 Trying alternative print approach...')
      try {
        window.print()
      } catch (printError) {
        console.error('❌ Print also failed:', printError)
      }
    }
  }
  
  const handleCancelSymptoms = () => {
    showSymptomsForm = false
  }
  
  const handleCancelMedication = () => {
    showMedicationForm = false
    editingMedication = null
  }
  
  // Handle prescription actions
  const handleEditPrescription = (medication, index) => {
    editingMedication = medication
    showMedicationForm = true
    console.log('Editing prescription:', medication)
  }
  
  const handleDeletePrescription = async (medicationId, index) => {
    try {
      if (confirm('Are you sure you want to delete this prescription?')) {
        await jsonStorage.deletePrescription(medicationId)
        
        // Remove from prescriptions list
        prescriptions = prescriptions.filter((_, i) => i !== index)
        
        // Also remove from current prescriptions if it exists there
        const currentIndex = currentPrescriptions.findIndex(p => p.id === medicationId)
        if (currentIndex !== -1) {
          currentPrescriptions = currentPrescriptions.filter((_, i) => i !== currentIndex)
        }
        
        console.log('🗑️ Deleted prescription:', medicationId)
      }
    } catch (error) {
      console.error('❌ Error deleting prescription:', error)
    }
  }
  
  // Toggle expanded state
  const toggleExpanded = (type, index) => {
    if (type === 'symptoms') {
      expandedSymptoms[index] = !expandedSymptoms[index]
      expandedSymptoms = { ...expandedSymptoms }
    } else if (type === 'illnesses') {
      expandedIllnesses[index] = !expandedIllnesses[index]
      expandedIllnesses = { ...expandedIllnesses }
    }
  }
  
  // Debug function to check data state
  const debugDataState = () => {
    console.log('🔍 Debug Data State:')
    console.log('Selected Patient:', selectedPatient)
    console.log('Prescriptions Array:', prescriptions)
    console.log('Prescriptions Length:', prescriptions?.length || 0)
    console.log('Active Tab:', activeTab)
    console.log('Loading State:', loading)
  }
  
  // Expose debug function globally for testing
  if (typeof window !== 'undefined') {
    window.debugPrescriptions = debugDataState
  }
  
  // Reactive statement to reload data when refreshTrigger changes
  $: if (refreshTrigger > 0) {
    loadPatientData()
  }
  
  onMount(() => {
    if (selectedPatient) {
      loadPatientData()
    }
  })
</script>

<div class="card">
  <div class="card-header">
    <div class="d-flex justify-content-between align-items-center">
      <h5 class="mb-0">
        <i class="fas fa-user me-2"></i>
        {selectedPatient.firstName} {selectedPatient.lastName}
      </h5>
      <div class="btn-group" role="group">
        <button 
          class="btn btn-outline-primary btn-sm" 
          on:click={() => showPrescriptionPDF = true}
          disabled={loading}
        >
          <i class="fas fa-file-pdf me-1"></i>Generate PDF
        </button>
      </div>
    </div>
  </div>
  
  <div class="card-body">
    <!-- Patient Tabs -->
    <PatientTabs {activeTab} onTabChange={handleTabChange} />
    
    <!-- Tab Content -->
    <div class="tab-content mt-3">
      <!-- Overview Tab -->
      {#if activeTab === 'overview'}
        <div class="tab-pane active">
          <div class="card mb-3">
            <div class="card-header d-flex justify-content-between align-items-center">
              <h6 class="mb-0">
                <i class="fas fa-info-circle me-2"></i>Patient Information
              </h6>
              <button 
                class="btn btn-primary btn-sm" 
                on:click={() => { activeTab = 'prescriptions'; }}
                title="Go to prescriptions tab"
              >
                <i class="fas fa-plus me-1"></i>New Prescription
              </button>
            </div>
            <div class="card-body">
              <div class="row">
                <div class="col-md-6">
                  <p><strong>Name:</strong> {selectedPatient.firstName} {selectedPatient.lastName}</p>
                  <p><strong>Email:</strong> {selectedPatient.email}</p>
                  <p><strong>Phone:</strong> {selectedPatient.phone || 'Not provided'}</p>
                </div>
                <div class="col-md-6">
                  <p><strong>Date of Birth:</strong> {selectedPatient.dateOfBirth}</p>
                  <p><strong>ID Number:</strong> {selectedPatient.idNumber}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      {/if}
      
      <!-- Symptoms Tab -->
      {#if activeTab === 'symptoms'}
        <div class="tab-pane active">
          <div class="d-flex justify-content-between align-items-center mb-3">
            <h6 class="mb-0">
              <i class="fas fa-thermometer-half me-2"></i>Symptoms
            </h6>
            <button 
              class="btn btn-primary btn-sm" 
              on:click={() => showSymptomsForm = true}
            >
              <i class="fas fa-plus me-1"></i>Add Symptoms
            </button>
          </div>
          
          <PatientForms 
            {showSymptomsForm}
            {selectedPatient}
            onSymptomsAdded={handleSymptomsAdded}
            onCancelSymptoms={handleCancelSymptoms}
          />
          
          <!-- AI Recommendations Component -->
          <AIRecommendations 
            {symptoms} 
            currentMedications={currentPrescriptions}
            patientAge={selectedPatient ? (() => {
              const birthDate = new Date(selectedPatient.dateOfBirth)
              const today = new Date()
              const age = today.getFullYear() - birthDate.getFullYear()
              const monthDiff = today.getMonth() - birthDate.getMonth()
              return monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate()) ? age - 1 : age
            })() : null}
            {doctorId}
            on:ai-usage-updated={(event) => {
              if (addToPrescription) {
                addToPrescription('ai-usage', event.detail)
              }
            }}
          />
          
          {#if symptoms && symptoms.length > 0}
            <div class="list-group">
              {#each symptoms as symptom, index}
                <div class="list-group-item">
                  <div class="d-flex w-100 justify-content-between align-items-start">
                    <div class="flex-grow-1">
                      <h6 class="mb-1">
                        <i class="fas fa-thermometer-half me-2"></i>
                        {symptom.description || 'Unknown Symptom'}
                      </h6>
                      <p class="mb-1">
                        <strong>Severity:</strong> 
                        <span class="badge bg-{symptom.severity === 'mild' ? 'success' : symptom.severity === 'moderate' ? 'warning' : symptom.severity === 'severe' ? 'danger' : 'dark'} text-capitalize">
                          {symptom.severity || 'Unknown'}
                        </span>
                      </p>
                      <p class="mb-1">
                        <strong>Duration:</strong> {symptom.duration || 'Not specified'}
                      </p>
                      {#if symptom.notes}
                        <p class="mb-1">
                          <strong>Notes:</strong> {symptom.notes}
                        </p>
                      {/if}
                      <small class="text-muted">
                        <i class="fas fa-calendar me-1"></i>
                        Recorded: {symptom.createdAt ? new Date(symptom.createdAt).toLocaleDateString() : 'Unknown date'}
                      </small>
                    </div>
                    <button 
                      class="btn btn-outline-secondary btn-sm" 
                      on:click={() => toggleExpanded('symptoms', index)}
                    >
                      <i class="fas fa-{expandedSymptoms[index] ? 'chevron-up' : 'chevron-down'}"></i>
                    </button>
                  </div>
                </div>
              {/each}
            </div>
          {:else}
            <div class="text-center p-4">
              <i class="fas fa-thermometer-half fa-2x text-muted mb-3"></i>
              <p class="text-muted">No symptoms recorded for this patient.</p>
            </div>
          {/if}
        </div>
      {/if}
      
      <!-- Illnesses Tab -->
      {#if activeTab === 'illnesses'}
        <div class="tab-pane active">
          <div class="d-flex justify-content-between align-items-center mb-3">
            <h6 class="mb-0">
              <i class="fas fa-heartbeat me-2"></i>Illnesses
            </h6>
            <button 
              class="btn btn-primary btn-sm" 
              on:click={() => showIllnessForm = true}
            >
              <i class="fas fa-plus me-1"></i>Add Illness
            </button>
          </div>
          
          <PatientForms 
            {showIllnessForm}
            {selectedPatient}
            onIllnessAdded={handleIllnessAdded}
            onCancelIllness={handleCancelIllness}
          />
          
          {#if illnesses && illnesses.length > 0}
            <div class="list-group">
              {#each illnesses as illness, index}
                <div class="list-group-item">
                  <div class="d-flex w-100 justify-content-between align-items-start">
                    <div class="flex-grow-1">
                      <h6 class="mb-1">
                        <i class="fas fa-heartbeat me-2"></i>
                        {illness.name || 'Unknown Illness'}
                      </h6>
                      <p class="mb-1">
                        <strong>Status:</strong> 
                        <span class="badge bg-{illness.status === 'active' ? 'danger' : illness.status === 'chronic' ? 'warning' : illness.status === 'resolved' ? 'success' : 'secondary'} text-capitalize">
                          {illness.status || 'Unknown'}
                        </span>
                      </p>
                      <p class="mb-1">
                        <strong>Diagnosis Date:</strong> {illness.diagnosisDate || 'Not specified'}
                      </p>
                      {#if illness.notes}
                        <p class="mb-1">
                          <strong>Notes:</strong> {illness.notes}
                        </p>
                      {/if}
                      <small class="text-muted">
                        <i class="fas fa-calendar me-1"></i>
                        Recorded: {illness.createdAt ? new Date(illness.createdAt).toLocaleDateString() : 'Unknown date'}
                      </small>
                    </div>
                    <button 
                      class="btn btn-outline-secondary btn-sm" 
                      on:click={() => toggleExpanded('illnesses', index)}
                    >
                      <i class="fas fa-{expandedIllnesses[index] ? 'chevron-up' : 'chevron-down'}"></i>
                    </button>
                  </div>
                </div>
              {/each}
            </div>
          {:else}
            <div class="text-center p-4">
              <i class="fas fa-heartbeat fa-2x text-muted mb-3"></i>
              <p class="text-muted">No illnesses recorded for this patient.</p>
            </div>
          {/if}
        </div>
      {/if}
      
      <!-- Prescriptions Tab -->
      {#if activeTab === 'prescriptions'}
        <div class="tab-pane active">
          <div class="d-flex justify-content-between align-items-center mb-3">
            <h6 class="mb-0">
              <i class="fas fa-calendar-day me-2"></i>Current Prescriptions
            </h6>
            <button 
              class="btn btn-success btn-sm" 
              on:click={() => showMedicationForm = true}
            >
              <i class="fas fa-plus me-1"></i>Add Drug
            </button>
          </div>
          
          <PatientForms 
            {showMedicationForm}
            {selectedPatient}
            {editingMedication}
            {doctorId}
            onMedicationAdded={handleMedicationAdded}
            onCancelMedication={handleCancelMedication}
          />
          
          <!-- Drug Interactions Warning -->
          {#if currentPrescriptions && currentPrescriptions.length >= 2}
            <div class="drug-interactions-section mb-3">
              {#if checkingInteractions}
                <div class="alert alert-info d-flex align-items-center">
                  <span class="spinner-border spinner-border-sm me-2" role="status"></span>
                  <i class="fas fa-search me-2"></i>
                  <div>
                    <strong>Checking for drug interactions...</strong>
                    <br>
                    <small class="text-muted">Analyzing {currentPrescriptions.length} medications for potential interactions</small>
                  </div>
                </div>
              {:else if drugInteractions && drugInteractions.hasInteractions}
                <div class="alert alert-{drugInteractions.severity === 'critical' ? 'danger' : drugInteractions.severity === 'high' ? 'warning' : 'info'} d-flex justify-content-between align-items-start {drugInteractions.severity === 'critical' ? 'alert-dangerous' : ''}">
                  <div class="flex-grow-1">
                    <div class="d-flex align-items-center mb-2">
                      {#if drugInteractions.severity === 'critical'}
                        <i class="fas fa-exclamation-triangle me-2 text-danger"></i>
                        <strong class="text-danger">DANGEROUS INTERACTION DETECTED</strong>
                      {:else}
                        <i class="fas fa-exclamation-triangle me-2"></i>
                        <strong>Drug Interaction Warning</strong>
                      {/if}
                      <span class="badge bg-{drugInteractions.severity === 'critical' ? 'danger' : drugInteractions.severity === 'high' ? 'warning' : 'info'} ms-2">
                        {drugInteractions.severity.toUpperCase()}
                      </span>
                      {#if drugInteractions.isLocalDetection}
                        <span class="badge bg-dark ms-2">LOCAL SAFETY CHECK</span>
                      {/if}
                    </div>
                    <p class="mb-2">
                      {#if drugInteractions.severity === 'critical'}
                        <strong class="text-danger">IMMEDIATE ATTENTION REQUIRED:</strong> Dangerous drug interaction detected between current medications.
                      {:else}
                        Potential drug interactions detected between current medications.
                      {/if}
                    </p>
                    <button 
                      class="btn btn-sm btn-outline-{drugInteractions.severity === 'critical' ? 'danger' : drugInteractions.severity === 'high' ? 'warning' : 'info'}"
                      on:click={toggleInteractions}
                    >
                      <i class="fas {showInteractions ? 'fa-eye-slash' : 'fa-eye'} me-1"></i>
                      {showInteractions ? 'Hide' : 'View'} Details
                    </button>
                  </div>
                </div>
                
                {#if showInteractions}
                  <div class="card mt-2">
                    <div class="card-body">
                      <h6 class="card-title">
                        <i class="fas fa-pills me-2"></i>Drug Interaction Analysis
                      </h6>
                      <div class="interaction-content">
                        {@html formatInteractions(drugInteractions.interactions)}
                      </div>
                    </div>
                  </div>
                {/if}
              {:else if drugInteractions && !drugInteractions.hasInteractions}
                <div class="card">
                  <div class="card-header d-flex justify-content-between align-items-center">
                    <h6 class="mb-0 text-danger">
                      <i class="fas fa-robot me-2"></i>AI-Powered Safety Analysis
                    </h6>
                  </div>
                  <div class="card-body">
                    <div class="alert alert-success d-flex align-items-center mb-0">
                      <i class="fas fa-check-circle me-2"></i>
                      <span>No significant drug interactions detected between current medications.</span>
                    </div>
                  </div>
                </div>
              {:else if interactionError}
                <div class="alert alert-warning d-flex align-items-center">
                  <i class="fas fa-exclamation-triangle me-2"></i>
                  <span>{interactionError}</span>
                </div>
              {/if}
            </div>
          {/if}
          
          <!-- Current Prescriptions List -->
          {#if currentPrescriptions && currentPrescriptions.length > 0}
            <div class="list-group">
              {#each currentPrescriptions as prescription, index}
                <div class="list-group-item d-flex justify-content-between align-items-start">
                  <div class="ms-2 me-auto">
                    <div class="fw-bold" style="font-size: 1.1rem;">{prescription.name}</div>
                    <small class="text-muted">
                      {prescription.dosage} • {prescription.frequency} • {prescription.duration}
                    </small>
                    {#if prescription.instructions}
                      <div class="mt-1">
                        <small class="text-muted">{prescription.instructions}</small>
                      </div>
                    {/if}
                  </div>
                  {#if !prescriptionsFinalized}
                    <div class="btn-group btn-group-sm">
                      <button 
                        class="btn btn-outline-primary btn-sm"
                        on:click={() => handleEditPrescription(prescription, index)}
                        title="Edit prescription"
                      >
                        <i class="fas fa-edit"></i>
                      </button>
                      <button 
                        class="btn btn-outline-danger btn-sm"
                        on:click={() => handleDeletePrescription(index)}
                        title="Delete prescription"
                      >
                        <i class="fas fa-trash"></i>
                      </button>
                    </div>
                  {:else}
                    <div class="text-muted">
                      <small><i class="fas fa-check-circle me-1"></i>Finalized</small>
                    </div>
                  {/if}
                </div>
              {/each}
            </div>
            
            <!-- Prescription Notes Box -->
            <div class="mt-3">
              <label for="prescriptionNotes" class="form-label">
                <i class="fas fa-sticky-note me-1"></i>Prescription Notes
              </label>
              <textarea 
                id="prescriptionNotes"
                class="form-control" 
                rows="3" 
                placeholder="Add any additional notes about the current prescriptions..."
                bind:value={prescriptionNotes}
              ></textarea>
              <div class="form-text">
                <small class="text-muted">Optional notes about the current prescription regimen</small>
              </div>
            </div>
            
            <!-- Action Buttons - Show only if there are drugs or notes -->
            {#if currentPrescriptions.length > 0 || prescriptionNotes.trim() !== ''}
              <div class="mt-3 text-center">
                <div class="d-flex gap-2 justify-content-center flex-wrap">
                  <button 
                    class="btn btn-primary flex-fill"
                    on:click={finishCurrentPrescriptions}
                    title="AI-powered drug interaction analysis"
                  >
                    <i class="fas fa-robot me-2"></i>
                    🤖 AI Analysis
                  </button>
                  
                  <button 
                    class="btn btn-success flex-fill"
                    on:click={completePrescriptions}
                    title="Complete current prescriptions"
                  >
                    <i class="fas fa-check-circle me-2"></i>
                    Complete
                  </button>
                  
                  <button 
                    class="btn btn-outline-primary flex-fill"
                    on:click={printPrescriptions}
                    title="Print prescriptions to PDF"
                  >
                    <i class="fas fa-file-pdf me-2"></i>
                    Print
                  </button>
                </div>
              </div>
            {/if}
          {:else}
            <div class="text-center text-muted py-3">
              <i class="fas fa-pills fa-2x mb-2"></i>
              <p>No current prescriptions for today</p>
            </div>
          {/if}
        </div>
      {/if}

      <!-- History Tab -->
      {#if activeTab === 'history'}
        <div class="tab-pane active">
          <div class="d-flex justify-content-between align-items-center mb-3">
            <h6 class="mb-0">
              <i class="fas fa-history me-2"></i>Prescription History
            </h6>
          </div>
          
          <PrescriptionList
            {prescriptions}
          />
        </div>
      {/if}
    </div>
  </div>
</div>

<!-- Prescription PDF Modal -->
{#if showPrescriptionPDF}
  <div class="modal show d-block" tabindex="-1" style="background-color: rgba(0,0,0,0.5);">
    <div class="modal-dialog modal-lg">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title">
            <i class="fas fa-file-pdf me-2"></i>Prescription PDF
          </h5>
          <button 
            type="button" 
            class="btn-close" 
            on:click={() => showPrescriptionPDF = false}
          ></button>
        </div>
        <div class="modal-body">
          <PrescriptionPDF 
            {selectedPatient}
            {prescriptions}
            on:close={() => showPrescriptionPDF = false}
          />
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  .drug-interactions-section .alert {
    border-left: 4px solid;
  }
  
  .drug-interactions-section .alert-danger {
    border-left-color: #dc3545;
  }
  
  .drug-interactions-section .alert-warning {
    border-left-color: #ffc107;
  }
  
  .drug-interactions-section .alert-info {
    border-left-color: #0dcaf0;
  }
  
  .drug-interactions-section .alert-success {
    border-left-color: #198754;
  }
  
  .drug-interactions-section .alert-dangerous {
    border: 3px solid #dc3545 !important;
    background-color: #f8d7da !important;
    animation: pulse-danger 2s infinite;
  }

  @keyframes pulse-danger {
    0% { box-shadow: 0 0 0 0 rgba(220, 53, 69, 0.7); }
    70% { box-shadow: 0 0 0 10px rgba(220, 53, 69, 0); }
    100% { box-shadow: 0 0 0 0 rgba(220, 53, 69, 0); }
  }
  
  .interaction-content {
    line-height: 1.6;
    font-size: 0.9rem;
  }
  
  .interaction-content h6 {
    color: #0d6efd !important;
    font-weight: 600;
    font-size: 0.95rem;
    margin-top: 1rem !important;
    margin-bottom: 0.5rem !important;
    border-bottom: 1px solid #e9ecef;
    padding-bottom: 0.25rem;
  }
  
  .interaction-content strong {
    color: #495057;
    font-weight: 600;
  }
  
  .interaction-content em {
    color: #6c757d;
    font-style: italic;
  }

  /* Critical interaction styling */
  .interaction-content .text-danger {
    color: #dc3545 !important;
    font-weight: bold;
  }
</style>