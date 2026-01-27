<script>
  import { createEventDispatcher, onMount } from 'svelte'
  import jsPDF from 'jspdf'
  import firebaseStorage from '../services/firebaseStorage.js'
  import doctorAuthService from '../services/doctor/doctorAuthService.js'
  import { formatPrescriptionId } from '../utils/idFormat.js'
  
  const dispatch = createEventDispatcher()
  
  export let selectedPatient
  export let illnesses
  export let prescriptions
  export let symptoms
  
  let loading = false
  
  // Generate PDF prescription
  const generatePDF = async () => {
    loading = true
    
    try {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a5'
      })
      const currentDate = new Date().toLocaleDateString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      })
      
      const pageWidth = 148
      const pageHeight = 210
      const margin = 20
      const contentWidth = pageWidth - (margin * 2)
      
      // Load template settings for header rendering
      let templateSettings = null
      try {
        const currentDoctor = doctorAuthService.getCurrentDoctor()
        if (currentDoctor?.externalDoctor && currentDoctor?.invitedByDoctorId) {
          const ownerDoctor = await firebaseStorage.getDoctorById(currentDoctor.invitedByDoctorId)
          if (ownerDoctor?.id) {
            templateSettings = await firebaseStorage.getDoctorTemplateSettings(ownerDoctor.id)
          }
        } else if (currentDoctor?.email) {
          const doctor = await firebaseStorage.getDoctorByEmail(currentDoctor.email)
          if (doctor?.id) {
            templateSettings = await firebaseStorage.getDoctorTemplateSettings(doctor.id)
          }
        }
      } catch (error) {
        console.warn('⚠️ Could not load template settings:', error)
      }
      
      let headerYStart = 5
      let contentYStart = 35
      let capturedHeaderImage = null
      let capturedHeaderWidth = 0
      let capturedHeaderHeight = 0
      let capturedHeaderX = 0
      
      if (templateSettings) {
        if (templateSettings.templateType === 'upload' && templateSettings.uploadedHeader) {
          const maxHeaderHeightMm = (templateSettings.headerSize || 300) * 0.264583
          const maxHeaderWidthMm = pageWidth - (margin * 2)
          headerYStart = 5
          
          let imageFormat = 'JPEG'
          if (templateSettings.uploadedHeader.includes('data:image/png')) {
            imageFormat = 'PNG'
          } else if (templateSettings.uploadedHeader.includes('data:image/jpeg') || templateSettings.uploadedHeader.includes('data:image/jpg')) {
            imageFormat = 'JPEG'
          } else if (templateSettings.uploadedHeader.includes('data:image/gif')) {
            imageFormat = 'GIF'
          }
          
          const embedImageWithAspectRatio = () => {
            return new Promise((resolve, reject) => {
              const img = new Image()
              img.onload = () => {
                try {
                  const aspectRatio = img.width / img.height
                  let actualWidthMm = maxHeaderWidthMm
                  let actualHeightMm = maxHeaderWidthMm / aspectRatio
                  
                  if (actualHeightMm > maxHeaderHeightMm) {
                    actualHeightMm = maxHeaderHeightMm
                    actualWidthMm = maxHeaderHeightMm * aspectRatio
                  }
                  
                  const lineY = headerYStart + actualHeightMm + 2
                  doc.setLineWidth(0.5)
                  doc.line(margin, lineY, pageWidth - margin, lineY)
                  
                  contentYStart = lineY + 5
                  doc.addImage(
                    templateSettings.uploadedHeader,
                    imageFormat,
                    margin,
                    headerYStart,
                    actualWidthMm,
                    actualHeightMm,
                    undefined,
                    'FAST'
                  )
                  
                  capturedHeaderImage = templateSettings.uploadedHeader
                  capturedHeaderWidth = actualWidthMm
                  capturedHeaderHeight = actualHeightMm
                  capturedHeaderX = margin
                  resolve()
                } catch (error) {
                  reject(error)
                }
              }
              
              img.onerror = () => {
                reject(new Error('Failed to load header image'))
              }
              
              img.src = templateSettings.uploadedHeader
            })
          }
          
          await embedImageWithAspectRatio()
        } else if (templateSettings.templateType === 'printed') {
          const headerHeightMm = (templateSettings.headerSize || 300) * 0.264583
          headerYStart = 5
          
          capturedHeaderImage = 'PRINTED_LETTERHEAD'
          capturedHeaderWidth = 0
          capturedHeaderHeight = headerHeightMm
          capturedHeaderX = 0
          
          const lineY = headerYStart + headerHeightMm + 2
          doc.setLineWidth(0.5)
          doc.line(margin, lineY, pageWidth - margin, lineY)
          
          contentYStart = lineY + 5
        } else if (templateSettings.templateType === 'system') {
          const headerContent = templateSettings.templatePreview?.formattedHeader || templateSettings.headerText
          if (headerContent) {
            const headerContainer = document.createElement('div')
            const style = document.createElement('style')
            headerContainer.style.position = 'absolute'
            headerContainer.style.left = '-9999px'
            headerContainer.style.top = '0'
            const pxPerMm = 3.7795275591
            const baseWidthPx = Math.round((pageWidth - (margin * 2)) * pxPerMm)
            const captureScale = 2
            headerContainer.style.width = `${baseWidthPx}px`
            headerContainer.style.minWidth = `${baseWidthPx}px`
            headerContainer.style.backgroundColor = 'white'
            headerContainer.style.padding = '16px'
            headerContainer.style.fontFamily = 'Arial, sans-serif'
            headerContainer.style.lineHeight = '1.4'
            headerContainer.style.color = '#000000'
            headerContainer.style.textAlign = 'center'
            headerContainer.className = 'header-capture-container'
            
            style.textContent = `
              .header-capture-container {
                text-align: center !important;
                display: flex !important;
                flex-direction: column !important;
                align-items: center !important;
                justify-content: center !important;
                width: 100% !important;
                position: relative !important;
                margin: 0 auto !important;
              }
              .header-capture-container .ql-editor {
                width: 100% !important;
                padding: 0 !important;
                font-size: 21.33px !important;
                line-height: 1.4 !important;
                font-family: inherit !important;
              }
              .header-capture-container .ql-size-small {
                font-size: 0.75em !important;
              }
              .header-capture-container .ql-size-large {
                font-size: 1.5em !important;
              }
              .header-capture-container .ql-size-huge {
                font-size: 2.5em !important;
              }
              .header-capture-container * {
                box-sizing: border-box !important;
                text-align: center !important;
              }
              .header-capture-container > * {
                width: 100% !important;
              }
              .header-capture-container img {
                display: block !important;
                margin: 0 auto !important;
                max-width: 100% !important;
                object-fit: contain !important;
              }
            `
            
            document.head.appendChild(style)
            headerContainer.innerHTML = `<div class="ql-editor">${headerContent}</div>`
            document.body.appendChild(headerContainer)
            
            await new Promise(resolve => setTimeout(resolve, 100))
            
            try {
              const html2canvasModule = await import('html2canvas')
              const html2canvas = html2canvasModule.default
              const canvas = await html2canvas(headerContainer, {
                backgroundColor: 'white',
                scale: captureScale,
                useCORS: true,
                allowTaint: true,
                width: headerContainer.offsetWidth,
                height: headerContainer.offsetHeight,
                logging: false
              })
              
              const headerImageData = canvas.toDataURL('image/png')
              const maxHeaderWidthMm = pageWidth - (margin * 2)
              const maxHeaderHeightMm = pageHeight - (margin * 2)
              const rawHeaderWidthMm = (canvas.width / captureScale) / pxPerMm
              const rawHeaderHeightMm = (canvas.height / captureScale) / pxPerMm
              const aspectRatio = canvas.width / canvas.height
              
              let headerImageWidthMm = rawHeaderWidthMm
              let headerImageHeightMm = rawHeaderHeightMm

              if (headerImageWidthMm < maxHeaderWidthMm) {
                headerImageWidthMm = maxHeaderWidthMm
                headerImageHeightMm = headerImageWidthMm / aspectRatio
              }
              if (headerImageHeightMm > maxHeaderHeightMm) {
                headerImageHeightMm = maxHeaderHeightMm
                headerImageWidthMm = headerImageHeightMm * aspectRatio
              }

              if (headerImageWidthMm > maxHeaderWidthMm) {
                headerImageWidthMm = maxHeaderWidthMm
                headerImageHeightMm = headerImageWidthMm / aspectRatio
              }
              
              const headerImageX = (pageWidth - headerImageWidthMm) / 2
              doc.addImage(headerImageData, 'PNG', headerImageX, headerYStart, headerImageWidthMm, headerImageHeightMm)
              
              capturedHeaderImage = headerImageData
              capturedHeaderWidth = headerImageWidthMm
              capturedHeaderHeight = headerImageHeightMm
              capturedHeaderX = headerImageX
              
              const lineY = headerYStart + headerImageHeightMm + 2
              doc.setLineWidth(0.5)
              doc.line(margin, lineY, pageWidth - margin, lineY)
              contentYStart = lineY + 5
            } finally {
              if (document.body.contains(headerContainer)) {
                document.body.removeChild(headerContainer)
              }
              if (style && document.head.contains(style)) {
                document.head.removeChild(style)
              }
            }
          }
        }
      }
      
      if (!templateSettings) {
        doc.setFontSize(16)
        doc.setFont('helvetica', 'bold')
        doc.text('MEDICAL PRESCRIPTION', margin, headerYStart)
        
        doc.setFontSize(8)
        doc.setFont('helvetica', 'normal')
        doc.text('M-Prescribe v2.2.24', pageWidth - margin, pageHeight - 5, { align: 'right' })
        
        doc.setFontSize(10)
        doc.setFont('helvetica', 'normal')
        doc.text('Your Medical Clinic', margin, headerYStart + 7)
        doc.text('123 Medical Street, City', margin, headerYStart + 12)
        doc.text('Phone: (555) 123-4567', margin, headerYStart + 17)
        
        const lineY = headerYStart + 22
        doc.setLineWidth(0.5)
        doc.line(margin, lineY, pageWidth - margin, lineY)
        contentYStart = lineY + 5
      }
      
      doc.setFontSize(11)
      doc.setFont('helvetica', 'bold')
      doc.text('PATIENT INFORMATION', margin, contentYStart)
      
      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      
      let patientAge = 'Not specified'
      if (selectedPatient.age && selectedPatient.age !== '' && !isNaN(selectedPatient.age)) {
        patientAge = selectedPatient.age + ' years'
      } else if (selectedPatient.dateOfBirth) {
        const birthDate = new Date(selectedPatient.dateOfBirth)
        if (!isNaN(birthDate.getTime())) {
          const today = new Date()
          const age = today.getFullYear() - birthDate.getFullYear()
          const monthDiff = today.getMonth() - birthDate.getMonth()
          const calculatedAge = monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate()) ? age - 1 : age
          patientAge = calculatedAge + ' years'
        }
      }
      
      doc.text(`Name: ${selectedPatient.firstName} ${selectedPatient.lastName}`, margin, contentYStart + 7)
      doc.text(`Date: ${currentDate}`, pageWidth - margin, contentYStart + 7, { align: 'right' })
      
      doc.text(`Age: ${patientAge}`, margin, contentYStart + 13)
      const prescriptionId = formatPrescriptionId(Date.now().toString())
      doc.text(`Prescription #: ${prescriptionId}`, pageWidth - margin, contentYStart + 13, { align: 'right' })
      
      const patientSex = selectedPatient.gender || selectedPatient.sex || 'Not specified'
      doc.text(`Sex: ${patientSex}`, margin, contentYStart + 19)
      
      let yPos = contentYStart + 31
      
      if (prescriptions && prescriptions.length > 0) {
        doc.setFontSize(11)
        doc.setFont('helvetica', 'bold')
        doc.text('PRESCRIPTION MEDICATIONS', margin, yPos)
        yPos += 6
        
        doc.setFontSize(9)
        doc.setFont('helvetica', 'normal')
        
        prescriptions.forEach((medication, index) => {
          if (yPos > pageHeight - 30) {
            doc.addPage()
            
            if (capturedHeaderImage) {
              if (capturedHeaderImage === 'PRINTED_LETTERHEAD') {
                const lineY = headerYStart + capturedHeaderHeight + 2
                doc.setLineWidth(0.5)
                doc.line(margin, lineY, pageWidth - margin, lineY)
                yPos = lineY + 5
              } else {
                doc.addImage(capturedHeaderImage, 'PNG', capturedHeaderX, headerYStart, capturedHeaderWidth, capturedHeaderHeight)
                const lineY = headerYStart + capturedHeaderHeight + 2
                doc.setLineWidth(0.5)
                doc.line(margin, lineY, pageWidth - margin, lineY)
                yPos = lineY + 5
              }
            } else {
              yPos = margin + 10
            }
          }
          
          doc.setFontSize(10)
          doc.setFont('helvetica', 'bold')
          doc.text(`${index + 1}. ${medication.name}`, margin, yPos)
          doc.text(`${medication.dosage}`, pageWidth - margin, yPos, { align: 'right' })
          
          doc.setFontSize(9)
          doc.setFont('helvetica', 'normal')
          
          let medicationDetails = `Frequency: ${medication.frequency}`
          if (medication.duration) {
            medicationDetails += ` | Duration: ${medication.duration}`
          }
          
          yPos += 4
          const detailsLines = doc.splitTextToSize(medicationDetails, contentWidth)
          doc.text(detailsLines, margin, yPos)
          yPos += detailsLines.length * 3
          
          if (medication.instructions) {
            yPos += 2
            const instructionText = `Instructions: ${medication.instructions}`
            const instructionLines = doc.splitTextToSize(instructionText, contentWidth)
            doc.text(instructionLines, margin, yPos)
            yPos += instructionLines.length * 3
          }
          
          yPos += 4
        })
      } else {
        doc.setFontSize(10)
        doc.setFont('helvetica', 'normal')
        doc.text('No medications prescribed.', margin, yPos)
        yPos += 10
      }
      
      doc.setFontSize(7)
      doc.text('This prescription is valid for 30 days from the date of issue.', margin, pageHeight - 5)
      doc.text('Keep this prescription in a safe place.', margin + 75, pageHeight - 5)
      
      // Generate filename with capital letter as per user preference
      const filename = `Prescription_${selectedPatient.firstName}_${selectedPatient.lastName}_${currentDate.replace(/\//g, '-')}.pdf`
      
      const pdfBlob = doc.output('blob')
      const pdfUrl = URL.createObjectURL(pdfBlob)
      window.open(pdfUrl, '_blank')
      
      console.log('PDF generated successfully')
      
    } catch (error) {
      console.error('Error generating PDF:', error)
    } finally {
      loading = false
    }
  }
  
  // Handle close
  const handleClose = () => {
    dispatch('close')
  }
</script>

<!-- Flowbite Modal Backdrop -->
<div 
  id="prescriptionPDFModal" 
  tabindex="-1" 
  aria-hidden="true" 
  class="fixed top-0 left-0 right-0 z-50 w-full p-4 overflow-x-hidden overflow-y-auto md:inset-0 h-[calc(100%-1rem)] max-h-full bg-gray-900 bg-opacity-50"
  on:click={handleClose}
  on:keydown={(e) => { if (e.key === 'Escape') handleClose() }}
  role="dialog"
  aria-modal="true"
  aria-labelledby="prescription-modal-title"
>
  <!-- Flowbite Modal Container -->
  <div class="relative w-full max-w-4xl max-h-full mx-auto flex items-center justify-center min-h-screen">
    <!-- Flowbite Modal Content -->
    <div 
      class="relative bg-white rounded-lg shadow-xl dark:bg-gray-700 transform transition-all duration-300 ease-out scale-100"
      on:click|stopPropagation
    >
      <!-- Flowbite Modal Header -->
      <div class="flex items-center justify-between p-4 md:p-5 border-b rounded-t-lg dark:border-gray-600">
        <h3 id="prescription-modal-title" class="text-xl font-semibold text-gray-900 dark:text-white flex items-center">
          <i class="fas fa-file-pdf text-red-600 mr-2"></i>
          Generate Prescription PDF
        </h3>
        <button
          type="button"
          class="text-gray-400 bg-transparent hover:bg-gray-200 hover:text-gray-900 rounded-lg text-sm w-8 h-8 ms-auto inline-flex justify-center items-center dark:hover:bg-gray-600 dark:hover:text-white transition-colors duration-200"
          data-modal-hide="prescriptionPDFModal"
          on:click={handleClose}
          disabled={loading}
        >
          <svg class="w-3 h-3" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 14 14">
            <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m1 1 6 6m0 0 6 6M7 7l6-6M7 7l-6 6"/>
          </svg>
          <span class="sr-only">Close modal</span>
        </button>
      </div>
      
      <!-- Flowbite Modal Body -->
      <div class="p-4 md:p-5 space-y-6">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div class="space-y-3">
            <h6 class="text-lg font-semibold text-gray-900 dark:text-white">Patient Information</h6>
            <div class="space-y-2 text-sm text-gray-600 dark:text-gray-300">
              <p><span class="font-medium">Name:</span> {selectedPatient.firstName} {selectedPatient.lastName}</p>
              <p><span class="font-medium">ID:</span> {selectedPatient.idNumber}</p>
              <p><span class="font-medium">DOB:</span> {selectedPatient.dateOfBirth}</p>
            </div>
          </div>
          <div class="space-y-3">
            <h6 class="text-lg font-semibold text-gray-900 dark:text-white">Summary</h6>
            <div class="space-y-2 text-sm text-gray-600 dark:text-gray-300">
              <p><span class="font-medium">Illnesses:</span> {illnesses.length}</p>
              <p><span class="font-medium">Prescriptions:</span> {prescriptions.length}</p>
              <p><span class="font-medium">Symptoms:</span> {symptoms.length}</p>
            </div>
          </div>
        </div>
        
        {#if illnesses.length > 0}
          <div class="space-y-3">
            <h6 class="text-lg font-semibold text-gray-900 dark:text-white">Current Illnesses</h6>
            <div class="space-y-2">
              {#each illnesses as illness}
                <div class="bg-gray-50 dark:bg-gray-600 p-3 rounded-lg">
                  <div class="flex justify-between items-start">
                    <div class="flex-1">
                      <div class="font-medium text-gray-900 dark:text-white">{illness.name}</div>
                      {#if illness.description}
                        <div class="text-sm text-gray-600 dark:text-gray-300">{illness.description}</div>
                      {/if}
                    </div>
                    <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-800 dark:text-blue-100">
                      {illness.status}
                    </span>
                  </div>
                </div>
              {/each}
            </div>
          </div>
        {/if}
        
        {#if prescriptions.length > 0}
          <div class="space-y-3">
            <h6 class="text-lg font-semibold text-gray-900 dark:text-white">Prescribed Prescriptions</h6>
            <div class="space-y-2">
              {#each prescriptions as medication}
                <div class="bg-gray-50 dark:bg-gray-600 p-3 rounded-lg">
                  <div class="flex justify-between items-start">
                    <div class="flex-1">
                      <div class="font-medium text-gray-900 dark:text-white">{medication.name}</div>
                      <div class="text-sm text-gray-600 dark:text-gray-300 space-y-1">
                        <p><span class="font-medium">Frequency:</span> {medication.frequency}</p>
                        {#if medication.instructions}
                          <p><span class="font-medium">Instructions:</span> {medication.instructions}</p>
                        {/if}
                      </div>
                    </div>
                    <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100">
                      {medication.dosage}
                    </span>
                  </div>
                </div>
              {/each}
            </div>
          </div>
        {/if}
        
        {#if symptoms.length > 0}
          <div class="space-y-3">
            <h6 class="text-lg font-semibold text-gray-900 dark:text-white">Current Symptoms</h6>
            <div class="space-y-2">
              {#each symptoms as symptom}
                <div class="bg-gray-50 dark:bg-gray-600 p-3 rounded-lg">
                  <div class="flex justify-between items-start">
                    <div class="flex-1">
                      <div class="font-medium text-gray-900 dark:text-white">{symptom.description}</div>
                      {#if symptom.duration}
                        <div class="text-sm text-gray-600 dark:text-gray-300">Duration: {symptom.duration}</div>
                      {/if}
                    </div>
                    <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-100">
                      {symptom.severity}
                    </span>
                  </div>
                </div>
              {/each}
            </div>
          </div>
        {/if}
      </div>
      
      <!-- Flowbite Modal Footer -->
      <div class="flex items-center justify-end p-4 md:p-5 border-t border-gray-200 rounded-b-lg dark:border-gray-600 space-x-3">
        <button 
          type="button" 
          class="py-2.5 px-5 text-sm font-medium text-gray-900 focus:outline-none bg-white rounded-lg border border-gray-200 hover:bg-gray-100 hover:text-blue-700 focus:z-10 focus:ring-4 focus:ring-gray-100 dark:focus:ring-gray-700 dark:bg-gray-600 dark:text-white dark:border-gray-500 dark:hover:text-white dark:hover:bg-gray-500 transition-colors duration-200"
          on:click={handleClose}
          disabled={loading}
        >
          <i class="fas fa-times mr-1"></i>
          Cancel
        </button>
        <button 
          type="button" 
          class="text-white bg-red-600 hover:bg-red-700 focus:ring-4 focus:outline-none focus:ring-red-300 font-medium rounded-lg text-sm px-5 py-2.5 text-center dark:bg-red-500 dark:hover:bg-red-600 dark:focus:ring-red-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
          on:click={generatePDF}
          disabled={loading}
        >
          {#if loading}
            <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          {/if}
          <i class="fas fa-file-pdf mr-1"></i>
          Generate PDF
        </button>
      </div>
    </div>
  </div>
</div>
