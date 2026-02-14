<script>
  import { createEventDispatcher, onMount } from 'svelte'
  import jsPDF from 'jspdf'
  import JsBarcode from 'jsbarcode'
  import firebaseStorage from '../services/firebaseStorage.js'
  import doctorAuthService from '../services/doctor/doctorAuthService.js'
  import { pharmacyMedicationService } from '../services/pharmacyMedicationService.js'
  import { formatPrescriptionId } from '../utils/idFormat.js'
  import { formatDate } from '../utils/dataProcessing.js'
  
  const dispatch = createEventDispatcher()
  
  export let selectedPatient
  export let illnesses
  export let prescriptions
  export let symptoms
  
  let loading = false
  let pharmacyStrengthLookup = new Map()

  const normalizeName = (value) => (value || '')
    .toString()
    .toLowerCase()
    .replace(/[\u3000\s]+/g, ' ')
    .replace(/[\(\)（）]/g, '')
    .trim()


  const findInventoryStrengthText = (medication) => {
    if (!pharmacyStrengthLookup || pharmacyStrengthLookup.size === 0) return ''

    const nameKey = normalizeName(medication?.name)
    const genericKey = normalizeName(medication?.genericName)
    const keysToTry = [nameKey, genericKey].filter(Boolean)

    for (const key of keysToTry) {
      if (pharmacyStrengthLookup.has(key)) {
        return pharmacyStrengthLookup.get(key) || ''
      }
    }

    return ''
  }

  const parseStrengthParts = (medication) => {
    const rawStrength = medication?.strength ?? medication?.dosage ?? ''
    const rawUnit = medication?.strengthUnit ?? medication?.dosageUnit ?? medication?.unit ?? medication?.packUnit ?? ''

    if (!rawStrength) {
      return { strength: '', strengthUnit: rawUnit || '' }
    }

    if (typeof rawStrength === 'number') {
      return { strength: String(rawStrength), strengthUnit: rawUnit || '' }
    }

    const normalized = String(rawStrength).trim()
    const match = normalized.match(/^(\d+(?:\.\d+)?)([a-zA-Z%]+)?$/)
    if (match) {
      return { strength: match[1], strengthUnit: match[2] || rawUnit || '' }
    }

    return { strength: normalized, strengthUnit: rawUnit || '' }
  }

  const getStrengthText = (rawStrength, rawUnit = '') => {
    const parsed = parseStrengthParts({ strength: rawStrength ?? '', strengthUnit: rawUnit ?? '' })
    return [parsed.strength, parsed.strengthUnit].filter(Boolean).join(' ').trim()
  }

  const parseDosageValue = (dosage) => {
    const raw = String(dosage || '').trim()
    if (!raw) return null
    const parts = raw.split(/\s+/)
    let total = 0
    for (const part of parts) {
      if (!part) continue
      if (part.includes('/')) {
        const [num, den] = part.split('/')
        const numerator = parseFloat(num)
        const denominator = parseFloat(den)
        if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) {
          return null
        }
        total += numerator / denominator
      } else {
        const value = parseFloat(part)
        if (!Number.isFinite(value)) return null
        total += value
      }
    }
    return total
  }

  const formatDosageFormLabel = (form, isPlural) => {
    const trimmed = String(form || '').trim()
    const base = trimmed ? trimmed.charAt(0).toUpperCase() + trimmed.slice(1) : 'Tablet'
    if (!isPlural) return base
    if (base.toLowerCase().endsWith('s')) return base
    return `${base}s`
  }

  const getDoseLabel = (medication) => {
    const dosage = String(medication?.dosage ?? '').trim()
    if (!dosage) return ''
    const parsedValue = parseDosageValue(dosage)
    const isPlural = parsedValue !== null ? parsedValue > 1 : !/^1(?:\s|$)/.test(dosage)
    const form = medication?.dosageForm ?? medication?.form ?? medication?.packUnit ?? medication?.unit ?? ''
    const formLabel = formatDosageFormLabel(form || 'Tablet', isPlural)
    return `${dosage} ${formLabel}`.trim()
  }

  const isLiquidMedication = (medication) => {
    const { strength, strengthUnit } = parseStrengthParts(medication)
    const strengthText = [strength, strengthUnit].filter(Boolean).join(' ').trim()
    const dosageForm = String(medication?.dosageForm ?? medication?.form ?? '').trim().toLowerCase()
    const strengthTextLower = strengthText.toLowerCase()
    return Boolean(
      strengthUnit &&
      ['ml', 'l'].includes(String(strengthUnit).toLowerCase())
    ) || dosageForm === 'liquid' || strengthTextLower.includes('ml') || strengthTextLower.includes(' l')
  }

  const requiresQtsPricing = (medication) => {
    if (isLiquidMedication(medication)) return false
    const dosageForm = String(medication?.dosageForm ?? medication?.form ?? '').trim().toLowerCase()
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

  const getQtsMetaLine = (medication) => {
    if (!requiresQtsPricing(medication)) return ''
    const formRaw = String(medication?.dosageForm ?? medication?.form ?? medication?.packUnit ?? medication?.unit ?? '').trim()
    if (!formRaw) return ''
    const formLabel = formRaw.charAt(0).toUpperCase() + formRaw.slice(1)
    const qtsRaw = String(medication?.qts ?? '').trim()
    const parsedQts = Number.parseInt(qtsRaw, 10)
    if (!Number.isFinite(parsedQts) || parsedQts <= 0) {
      return formLabel
    }
    return `${formLabel} | Quantity: ${String(parsedQts).padStart(2, '0')}`
  }

  const getMedicationMetaLine = (medication, headerLabel = '') => {
    const qtsMetaLine = getQtsMetaLine(medication)
    if (qtsMetaLine) return qtsMetaLine
    const parts = []
    if (!isLiquidMedication(medication)) {
      const doseLabel = getDoseLabel(medication)
      if (doseLabel && doseLabel !== headerLabel) parts.push(doseLabel)
    }
    return parts.join(' | ')
  }

  const getPrintableDuration = (duration) => {
    const value = String(duration || '').trim()
    if (!value) return ''
    if (/^days?$/i.test(value)) return ''
    return value
  }

  const getPdfDosageLabel = (medication) => {
    const { strength, strengthUnit } = parseStrengthParts(medication)
    const strengthText = [strength, strengthUnit].filter(Boolean).join(' ').trim()
    const hasStrength = Boolean(strength && strengthUnit)
    if (hasStrength) return strengthText

    const fromInventory = findInventoryStrengthText(medication)
    if (fromInventory) return fromInventory

    const doseLabel = getDoseLabel(medication)
    if (doseLabel) return doseLabel

    const base = String(medication?.dosage ?? '').trim()
    const fallbackUnit = String(medication?.strengthUnit ?? medication?.dosageUnit ?? medication?.unit ?? medication?.packUnit ?? '').trim()
    if (base && fallbackUnit) {
      return `${base} ${fallbackUnit}`.trim()
    }
    return base
  }

  const sanitizeTemplateHtml = (html) => {
    if (!html) return ''
    return String(html)
      .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
      .replace(/\son\w+\s*=\s*"[^"]*"/gi, '')
      .replace(/\son\w+\s*=\s*'[^']*'/gi, '')
      .replace(/\son\w+\s*=\s*[^\s>]+/gi, '')
      .replace(/javascript:/gi, '')
  }
  
  // Generate PDF prescription
  const generatePDF = async () => {
    loading = true
    
    try {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a5'
      })
      const currentDate = formatDate(new Date(), { country: selectedPatient?.country })
      
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

      // Load pharmacy inventory strengths for dosage units
      try {
        const currentDoctor = doctorAuthService.getCurrentDoctor()
        let doctorId = currentDoctor?.id || currentDoctor?.uid || null
        if (currentDoctor?.externalDoctor && currentDoctor?.invitedByDoctorId) {
          doctorId = currentDoctor.invitedByDoctorId
        }
        if (!doctorId && selectedPatient?.doctorId) {
          doctorId = selectedPatient.doctorId
        }
        if (!doctorId && currentDoctor?.email) {
          const doctor = await firebaseStorage.getDoctorByEmail(currentDoctor.email)
          doctorId = doctor?.id || null
        }

        if (doctorId) {
          const stock = await pharmacyMedicationService.getPharmacyStock(doctorId)
          const lookup = new Map()
          stock.forEach(item => {
            const strengthText = getStrengthText(item.strength, item.strengthUnit)
            if (!strengthText) return
            const nameKey = normalizeName(item.drugName || item.brandName)
            const genericKey = normalizeName(item.genericName)
            if (nameKey && !lookup.has(nameKey)) lookup.set(nameKey, strengthText)
            if (genericKey && !lookup.has(genericKey)) lookup.set(genericKey, strengthText)
          })
          pharmacyStrengthLookup = lookup
        }
      } catch (error) {
        console.warn('⚠️ Could not load pharmacy inventory strengths:', error)
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
          const headerContent = sanitizeTemplateHtml(
            templateSettings.templatePreview?.formattedHeader || templateSettings.headerText
          )
          if (headerContent) {
            const headerFontSize = Number(templateSettings.headerFontSize || 24)
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
            headerContainer.style.padding = '0 0 8px 0'
            headerContainer.style.fontFamily = 'inherit'
            headerContainer.style.lineHeight = 'normal'
            headerContainer.style.color = '#000000'
            headerContainer.className = 'header-capture-container'
            
            style.textContent = `
              .header-capture-container {
                position: relative !important;
                margin: 0 !important;
                overflow: visible !important;
              }
              .header-capture-container .ql-editor {
                width: 100% !important;
                padding: 0 !important;
                font-size: ${headerFontSize}px;
                line-height: 1.42;
                font-family: inherit !important;
                color: #000 !important;
                min-height: 0 !important;
                height: auto !important;
                overflow: visible !important;
              }
              .header-capture-container .ql-editor h1,
              .header-capture-container .ql-editor h2,
              .header-capture-container .ql-editor h3,
              .header-capture-container .ql-editor h4,
              .header-capture-container .ql-editor h5,
              .header-capture-container .ql-editor h6,
              .header-capture-container .ql-editor p,
              .header-capture-container .ql-editor ol,
              .header-capture-container .ql-editor ul,
              .header-capture-container .ql-editor pre,
              .header-capture-container .ql-editor blockquote {
                margin: 0 !important;
                padding: 0 !important;
              }
              .header-capture-container .ql-editor ol,
              .header-capture-container .ql-editor ul {
                padding-left: 1.5em !important;
              }
              .header-capture-container .ql-editor .ql-align-center {
                text-align: center !important;
              }
              .header-capture-container .ql-editor .ql-align-right {
                text-align: right !important;
              }
              .header-capture-container .ql-editor .ql-align-justify {
                text-align: justify !important;
              }
              .header-capture-container .ql-editor .ql-indent-1 { padding-left: 3em !important; }
              .header-capture-container .ql-editor .ql-indent-2 { padding-left: 6em !important; }
              .header-capture-container .ql-editor .ql-indent-3 { padding-left: 9em !important; }
              .header-capture-container .ql-editor .ql-indent-4 { padding-left: 12em !important; }
              .header-capture-container .ql-editor .ql-indent-5 { padding-left: 15em !important; }
              .header-capture-container .ql-editor .ql-indent-6 { padding-left: 18em !important; }
              .header-capture-container .ql-editor .ql-indent-7 { padding-left: 21em !important; }
              .header-capture-container .ql-editor .ql-indent-8 { padding-left: 24em !important; }
              .header-capture-container .ql-editor .ql-size-small {
                font-size: 0.75em !important;
              }
              .header-capture-container .ql-editor .ql-size-large {
                font-size: 1.9em !important;
              }
              .header-capture-container .ql-editor .ql-size-huge {
                font-size: 3em !important;
              }
              .header-capture-container .ql-editor img {
                display: inline-block !important;
                max-width: 100% !important;
                height: auto !important;
              }
            `
            
            document.head.appendChild(style)
            headerContainer.innerHTML = `<div class="ql-editor">${headerContent}</div>`
            document.body.appendChild(headerContainer)
            
            await new Promise(resolve => setTimeout(resolve, 100))
            
            try {
              const html2canvasModule = await import('html2canvas')
              const html2canvas = html2canvasModule.default
              const captureWidth = Math.ceil(headerContainer.scrollWidth || headerContainer.offsetWidth)
              const captureHeight = Math.ceil((headerContainer.scrollHeight || headerContainer.offsetHeight) + 8)
              const canvas = await html2canvas(headerContainer, {
                backgroundColor: 'white',
                scale: captureScale,
                useCORS: true,
                allowTaint: true,
                width: captureWidth,
                height: captureHeight,
                windowWidth: captureWidth,
                windowHeight: captureHeight,
                logging: false
              })
              
              const headerImageData = canvas.toDataURL('image/png')
              const maxHeaderWidthMm = pageWidth - (margin * 2)
              const maxHeaderHeightMm = null
              const rawHeaderWidthMm = (canvas.width / captureScale) / pxPerMm
              const rawHeaderHeightMm = (canvas.height / captureScale) / pxPerMm
              const aspectRatio = canvas.width / canvas.height
              
              let headerImageWidthMm = rawHeaderWidthMm
              let headerImageHeightMm = rawHeaderHeightMm
              const minHeaderWidthMm = maxHeaderWidthMm * 0.9
              if (headerImageWidthMm < minHeaderWidthMm) {
                const scaleUp = minHeaderWidthMm / headerImageWidthMm
                headerImageWidthMm *= scaleUp
                headerImageHeightMm *= scaleUp
              }
              if (maxHeaderHeightMm && headerImageHeightMm > maxHeaderHeightMm) {
                headerImageHeightMm = maxHeaderHeightMm
                headerImageWidthMm = headerImageHeightMm * aspectRatio
              }

              if (headerImageWidthMm > maxHeaderWidthMm) {
                headerImageWidthMm = maxHeaderWidthMm
                headerImageHeightMm = headerImageWidthMm / aspectRatio
              }

              const minHeaderHeightMm = 0
              if (minHeaderHeightMm && headerImageHeightMm < minHeaderHeightMm) {
                headerImageHeightMm = minHeaderHeightMm
                headerImageWidthMm = headerImageHeightMm * aspectRatio
                if (headerImageWidthMm > maxHeaderWidthMm) {
                  headerImageWidthMm = maxHeaderWidthMm
                  headerImageHeightMm = headerImageWidthMm / aspectRatio
                }
              }
              
              const headerImageX = margin
              doc.addImage(headerImageData, 'PNG', headerImageX, headerYStart, headerImageWidthMm, headerImageHeightMm)
              
              capturedHeaderImage = headerImageData
              capturedHeaderWidth = headerImageWidthMm
              capturedHeaderHeight = headerImageHeightMm
              capturedHeaderX = headerImageX
              
              const lineY = headerYStart + headerImageHeightMm + 6
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
        doc.text('M-Prescribe v2.3', pageWidth - margin, pageHeight - 5, { align: 'right' })
        
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
      
      const patientTitle = selectedPatient.title ? `${selectedPatient.title} ` : ''
      doc.text(`Name: ${patientTitle}${selectedPatient.firstName} ${selectedPatient.lastName}`, margin, contentYStart + 7)
      doc.text(`Date: ${currentDate}`, pageWidth - margin, contentYStart + 7, { align: 'right' })
      
      doc.text(`Age: ${patientAge}`, margin, contentYStart + 13)
      const prescriptionId = formatPrescriptionId(Date.now().toString())
      doc.text(`Prescription #: ${prescriptionId}`, pageWidth - margin, contentYStart + 13, { align: 'right' })

      let barcodeDataUrl = null
      try {
        const barcodeCanvas = document.createElement('canvas')
        JsBarcode(barcodeCanvas, prescriptionId, {
          format: 'CODE128',
          displayValue: false,
          margin: 4,
          width: 2,
          height: 32
        })
        barcodeDataUrl = barcodeCanvas.toDataURL('image/png')
      } catch (error) {
        console.error('❌ Failed to generate barcode:', error)
      }

      if (barcodeDataUrl) {
        const barcodeWidth = 60
        const barcodeHeight = 12
        const barcodeX = pageWidth - margin - barcodeWidth
        const barcodeY = contentYStart + 15
        doc.addImage(barcodeDataUrl, 'PNG', barcodeX, barcodeY, barcodeWidth, barcodeHeight)
      }
      
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
          const medName = medication.genericName ? `${medication.name} (${medication.genericName})` : medication.name
          doc.text(`${index + 1}. ${medName}`, margin, yPos)
          const headerLabel = getPdfDosageLabel(medication)
          doc.text(headerLabel, pageWidth - margin, yPos, { align: 'right' })
          
          const metaLine = getMedicationMetaLine(medication, headerLabel)
          doc.setFontSize(9)
          doc.setFont('helvetica', 'normal')
          if (metaLine) {
            yPos += 4
            const metaLines = doc.splitTextToSize(metaLine, contentWidth)
            doc.text(metaLines, margin, yPos)
            yPos += metaLines.length * 3
          }

          const medicationDetailsParts = []
          const frequencyText = String(medication?.frequency || '').trim()
          if (frequencyText) {
            medicationDetailsParts.push(frequencyText)
          }
          const printableDuration = getPrintableDuration(medication?.duration)
          if (printableDuration) {
            medicationDetailsParts.push(`Duration: ${printableDuration}`)
          }

          if (medicationDetailsParts.length > 0) {
            yPos += 4
            const medicationDetails = medicationDetailsParts.join(' | ')
            const detailsLines = doc.splitTextToSize(medicationDetails, contentWidth)
            doc.text(detailsLines, margin, yPos)
            yPos += detailsLines.length * 3
          }
          
          if (medication.timing) {
            yPos += 2
            const timingText = `${medication.timing}`
            const timingLines = doc.splitTextToSize(timingText, contentWidth)
            doc.text(timingLines, margin, yPos)
            yPos += timingLines.length * 3
          }

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
  class="fixed top-0 left-0 right-0 z-50 w-full p-4 overflow-x-hidden overflow-y-auto md:inset-0 h-[calc(100%-1rem)] max-h-full bg-gray-900 bg-opacity-50 relative"
  on:keydown={(e) => { if (e.key === 'Escape') handleClose() }}
  role="dialog"
  aria-modal="true"
  aria-labelledby="prescription-modal-title"
>
  <button
    type="button"
    class="absolute inset-0 w-full h-full cursor-default"
    aria-label="Close modal"
    on:click={handleClose}
  ></button>
  <!-- Flowbite Modal Container -->
  <div class="relative z-10 w-full max-w-4xl max-h-full mx-auto flex items-center justify-center min-h-screen">
    <!-- Flowbite Modal Content -->
    <div class="relative bg-white rounded-lg shadow-xl dark:bg-gray-700 transform transition-all duration-300 ease-out scale-100">
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
              <p><span class="font-medium">Name:</span> {selectedPatient.title ? `${selectedPatient.title} ` : ''}{selectedPatient.firstName} {selectedPatient.lastName}</p>
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
                      <div class="font-medium text-gray-900 dark:text-white">
                        {medication.name}{#if medication.genericName} ({medication.genericName}){/if}
                      </div>
                      {#if getMedicationMetaLine(medication, getPdfDosageLabel(medication))}
                        <div class="text-xs text-gray-500 mt-1">
                          {getMedicationMetaLine(medication, getPdfDosageLabel(medication))}
                        </div>
                      {/if}
                      <div class="text-sm text-gray-600 dark:text-gray-300 space-y-1">
                        <p><span class="font-medium">Frequency:</span> {medication.frequency}</p>
                        {#if medication.timing}
                          <p>{medication.timing}</p>
                        {/if}
                        {#if medication.instructions}
                          <p><span class="font-medium">Instructions:</span> {medication.instructions}</p>
                        {/if}
                      </div>
                    </div>
                    <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100">
                      {getPdfDosageLabel(medication)}
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
