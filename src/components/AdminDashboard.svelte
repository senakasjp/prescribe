<script>
  import { createEventDispatcher, onMount } from 'svelte'
  import adminAuthService from '../services/adminAuthService.js'
  import firebaseStorage from '../services/firebaseStorage.js'
  import { auth } from '../firebase-config.js'
  import LoadingSpinner from './LoadingSpinner.svelte'
  import aiTokenTracker from '../services/aiTokenTracker.js'
  import AIPromptLogs from './AIPromptLogs.svelte'
  import ConfirmationModal from './ConfirmationModal.svelte'
  import { formatDoctorId } from '../utils/idFormat.js'
  
  const dispatch = createEventDispatcher()
  
  // Accept admin data as prop from AdminPanel
  export let currentAdmin = null
  export let handleBackToApp = null
  let statistics = {
    totalDoctors: 0,
    totalPatients: 0,
    totalPrescriptions: 0,
    totalSymptoms: 0,
    totalIllnesses: 0
  }
  let aiUsageStats = null
  let doctors = []
  // Removed patients array and doctorPatientCounts for HIPAA compliance
  // Admins should not have access to patient PHI data
  let loading = true
  let activeTab = 'overview'
  
  // Quota management variables
  let showQuotaModal = false
  let selectedDoctorId = ''
  let quotaInput = 0
  
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
  
  // Confirmation modal helper functions
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
  
  // Configuration variables
  let defaultQuotaInput = 0
  let tokenPriceInput = 0

  // Welcome email template (system setting)
  let welcomeEmailLoading = false
  let welcomeEmailSaving = false
  let welcomeEmailStatus = ''
  let welcomeSubject = ''
  let welcomeText = ''
  let welcomeHtml = ''
  let welcomeFromName = ''
  let welcomeFromEmail = ''
  let welcomeReplyTo = ''
  let welcomeTextOnly = false
  let welcomeEmailEnabled = true

  // Patient welcome email template
  let patientWelcomeLoading = false
  let patientWelcomeSaving = false
  let patientWelcomeStatus = ''
  let patientWelcomeSubject = ''
  let patientWelcomeText = ''
  let patientWelcomeHtml = ''
  let patientWelcomeFromName = ''
  let patientWelcomeFromEmail = ''
  let patientWelcomeReplyTo = ''
  let patientWelcomeTextOnly = false
  let patientWelcomeEnabled = true

  // Appointment reminder email template
  let appointmentEmailLoading = false
  let appointmentEmailSaving = false
  let appointmentEmailStatus = ''
  let appointmentEmailSubject = ''
  let appointmentEmailText = ''
  let appointmentEmailHtml = ''
  let appointmentEmailFromName = ''
  let appointmentEmailFromEmail = ''
  let appointmentEmailReplyTo = ''
  let appointmentEmailTextOnly = false
  let appointmentEmailEnabled = true

  // Doctor broadcast email template
  let doctorBroadcastLoading = false
  let doctorBroadcastSaving = false
  let doctorBroadcastStatus = ''
  let doctorBroadcastSending = false
  let doctorBroadcastSubject = ''
  let doctorBroadcastText = ''
  let doctorBroadcastHtml = ''
  let doctorBroadcastFromName = ''
  let doctorBroadcastFromEmail = ''
  let doctorBroadcastReplyTo = ''
  let doctorBroadcastTextOnly = false

  // Email templates for single-doctor sends
  let selectedDoctorForEmail = ''
  let approvalWelcomeLoading = false
  let approvalWelcomeSaving = false
  let approvalWelcomeStatus = ''
  let approvalWelcomeSubject = ''
  let approvalWelcomeText = ''
  let approvalWelcomeHtml = ''
  let approvalWelcomeFromName = ''
  let approvalWelcomeFromEmail = ''
  let approvalWelcomeReplyTo = ''
  let approvalWelcomeTextOnly = false
  let approvalWelcomeEnabled = true

  let paymentReminderLoading = false
  let paymentReminderSaving = false
  let paymentReminderStatus = ''
  let paymentReminderSubject = ''
  let paymentReminderText = ''
  let paymentReminderHtml = ''
  let paymentReminderFromName = ''
  let paymentReminderFromEmail = ''
  let paymentReminderReplyTo = ''
  let paymentReminderTextOnly = false

  let paymentThanksLoading = false
  let paymentThanksSaving = false
  let paymentThanksStatus = ''
  let paymentThanksSubject = ''
  let paymentThanksText = ''
  let paymentThanksHtml = ''
  let paymentThanksFromName = ''
  let paymentThanksFromEmail = ''
  let paymentThanksReplyTo = ''
  let paymentThanksTextOnly = false

  let otherMessageLoading = false
  let otherMessageSaving = false
  let otherMessageStatus = ''
  let otherMessageSubject = ''
  let otherMessageText = ''
  let otherMessageHtml = ''
  let otherMessageFromName = ''
  let otherMessageFromEmail = ''
  let otherMessageReplyTo = ''
  let otherMessageTextOnly = false

  // OpenAI proxy test
  let openaiTestRunning = false
  let openaiTestStatus = ''

  // SMTP settings (stored in Firestore)
  let smtpLoading = false
  let smtpSaving = false
  let smtpStatus = ''
  let smtpHost = ''
  let smtpPort = '587'
  let smtpSecure = false
  let smtpUser = ''
  let smtpTestRunning = false
  let smtpTestStatus = ''
  let messagingTab = 'templates'
  let whatsappTestNumber = 'whatsapp:+642041210342'
  let whatsappTestMessage = 'Welcome to M-Prescribe!'
  let whatsappTestRunning = false
  let whatsappTestStatus = ''
  let smsTestRecipient = '94712345678'
  let smsTestSenderId = 'YourName'
  let smsTestType = 'plain'
  let smsTestMessage = 'This is a test message'
  let smsTestRunning = false
  let smsTestStatus = ''
  let smsSenderIdSaving = false
  let smsSenderIdStatus = ''
  let registrationTemplate =
    'Welcome {{name}} to Prescribe! Your account is ready with Dr. {{doctorName}}. Sign in at {{appUrl}}.'
  let registrationTemplateEnabled = true
  let appointmentReminderTemplate =
    'Reminder: your appointment with {{doctorName}} is on {{date}} at {{time}}. Reply if you need to reschedule.'
  let appointmentReminderTemplateEnabled = true
  let registrationChannel = 'sms'
  let appointmentReminderChannel = 'sms'
  let messagingTemplatesLoading = false
  let messagingTemplatesSaving = false
  let messagingTemplatesStatus = ''
  let emailTab = 'settings'
  // Email logs
  let emailLogs = []
  let emailLogsLoading = false
  let emailLogsError = ''
  let authLogs = []
  let authLogsLoading = false
  let authLogsError = ''
  let logView = 'email'
  let showReferralPendingOnly = false
  let selectedDoctorView = null
  
  // Reactive statement to reload data when currentAdmin changes
  $: if (currentAdmin) {
    console.log('🔄 AdminDashboard: currentAdmin changed, reloading...')
    loadAdminData()
  }
  
  // Load admin data and initialize Flowbite components on mount
  onMount(async () => {
    console.log('🚀 AdminDashboard component mounted')
    
    // Initialize Flowbite dropdowns
    if (typeof window !== 'undefined' && window.Flowbite && typeof window.Flowbite.initDropdowns === 'function') {
      window.Flowbite.initDropdowns()
    }
    
    await loadAdminData()
  })
  
  // Load admin data and statistics
  const loadAdminData = async () => {
    try {
      console.log('🔍 Starting loadAdminData...')
      loading = true
      
      if (!currentAdmin) {
        console.log('❌ No current admin found, dispatching sign-out')
        dispatch('admin-signed-out')
        return
      }
      
      console.log('✅ Admin found:', currentAdmin.email)
      
      // Load statistics
      console.log('🔍 Loading statistics...')
      await loadStatistics()
      console.log('✅ Statistics loaded')
      
      // Load AI usage statistics
      console.log('🔍 Loading AI usage stats...')
      loadAIUsageStats()
      console.log('✅ AI usage stats loaded')
      
      // Load doctors data only (no patient data for HIPAA compliance)
      console.log('🔍 Loading doctors...')
      await loadDoctors()
      console.log('✅ Doctors loaded')

      // Load system settings (welcome email template)
      await loadWelcomeEmailTemplate()
      await loadPatientWelcomeTemplate()
      await loadAppointmentReminderTemplate()
      await loadDoctorBroadcastTemplate()
      await loadSmtpSettings()
      await loadMessagingTemplates()
      await loadApprovalWelcomeTemplate()
      await loadPaymentReminderTemplate()
      await loadPaymentThanksTemplate()
      await loadOtherMessageTemplate()
      
      console.log('🎉 All admin data loaded successfully')
      
    } catch (error) {
      console.error('❌ Error loading admin data:', error)
      console.error('❌ Error details:', error.message, error.stack)
    } finally {
      loading = false
      console.log('🔍 Loading set to false')
    }
  }

  const loadEmailLogs = async () => {
    try {
      emailLogsError = ''
      emailLogsLoading = true
      emailLogs = await firebaseStorage.getEmailLogs(200)
    } catch (error) {
      console.error('❌ Error loading email logs:', error)
      emailLogsError = error?.message || 'Failed to load email logs.'
      emailLogs = []
    } finally {
      emailLogsLoading = false
    }
  }

  const loadAuthLogs = async () => {
    try {
      authLogsError = ''
      authLogsLoading = true
      authLogs = await firebaseStorage.getAuthLogs(200)
    } catch (error) {
      console.error('❌ Error loading auth logs:', error)
      authLogsError = error?.message || 'Failed to load auth logs.'
      authLogs = []
    } finally {
      authLogsLoading = false
    }
  }

  const clearEmailLogs = async () => {
    const baseUrl = getFunctionsBaseUrl()
    if (!baseUrl) {
      return
    }
    const currentUser = auth?.currentUser
    if (!currentUser) {
      return
    }
    try {
      const token = await currentUser.getIdToken()
      const response = await fetch(`${baseUrl}/clearEmailLogs`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({})
      })
      if (!response.ok) {
        throw new Error(await response.text())
      }
      await loadEmailLogs()
    } catch (error) {
      console.error('❌ Error clearing email logs:', error)
    }
  }

  const loadWelcomeEmailTemplate = async () => {
    try {
      welcomeEmailLoading = true
      const template = await firebaseStorage.getWelcomeEmailTemplate()
      welcomeSubject = template?.subject || ''
      welcomeText = template?.text || ''
      welcomeHtml = template?.html || ''
      welcomeFromName = template?.fromName || ''
      welcomeFromEmail = template?.fromEmail || 'support@mprescribe.net'
      welcomeReplyTo = template?.replyTo || ''
      welcomeTextOnly = Boolean(template?.textOnly)
      welcomeEmailEnabled = template?.enabled !== false
    } catch (error) {
      console.error('❌ Error loading welcome email template:', error)
    } finally {
      welcomeEmailLoading = false
    }
  }

  const loadPatientWelcomeTemplate = async () => {
    try {
      patientWelcomeLoading = true
      const template = await firebaseStorage.getPatientWelcomeEmailTemplate()
      patientWelcomeSubject = template?.subject || ''
      patientWelcomeText = template?.text || ''
      patientWelcomeHtml = template?.html || ''
      patientWelcomeFromName = template?.fromName || ''
      patientWelcomeFromEmail = template?.fromEmail || 'support@mprescribe.net'
      patientWelcomeReplyTo = template?.replyTo || ''
      patientWelcomeTextOnly = Boolean(template?.textOnly)
      patientWelcomeEnabled = template?.enabled !== false
    } catch (error) {
      console.error('❌ Error loading patient welcome template:', error)
    } finally {
      patientWelcomeLoading = false
    }
  }

  const loadAppointmentReminderTemplate = async () => {
    try {
      appointmentEmailLoading = true
      const template = await firebaseStorage.getAppointmentReminderEmailTemplate()
      appointmentEmailSubject = template?.subject || ''
      appointmentEmailText = template?.text || ''
      appointmentEmailHtml = template?.html || ''
      appointmentEmailFromName = template?.fromName || ''
      appointmentEmailFromEmail = template?.fromEmail || 'support@mprescribe.net'
      appointmentEmailReplyTo = template?.replyTo || ''
      appointmentEmailTextOnly = Boolean(template?.textOnly)
      appointmentEmailEnabled = template?.enabled !== false
    } catch (error) {
      console.error('❌ Error loading appointment reminder template:', error)
    } finally {
      appointmentEmailLoading = false
    }
  }

  const loadDoctorBroadcastTemplate = async () => {
    try {
      doctorBroadcastLoading = true
      const template = await firebaseStorage.getDoctorBroadcastEmailTemplate()
      doctorBroadcastSubject = template?.subject || ''
      doctorBroadcastText = template?.text || ''
      doctorBroadcastHtml = template?.html || ''
      doctorBroadcastFromName = template?.fromName || ''
      doctorBroadcastFromEmail = template?.fromEmail || 'support@mprescribe.net'
      doctorBroadcastReplyTo = template?.replyTo || ''
      doctorBroadcastTextOnly = Boolean(template?.textOnly)
    } catch (error) {
      console.error('❌ Error loading doctor broadcast email template:', error)
    } finally {
      doctorBroadcastLoading = false
    }
  }

  const loadApprovalWelcomeTemplate = async () => {
    try {
      approvalWelcomeLoading = true
      const template = await firebaseStorage.getEmailTemplate('approvalWelcomeEmail')
      approvalWelcomeSubject = template?.subject || ''
      approvalWelcomeText = template?.text || ''
      approvalWelcomeHtml = template?.html || ''
      approvalWelcomeFromName = template?.fromName || ''
      approvalWelcomeFromEmail = template?.fromEmail || 'support@mprescribe.net'
      approvalWelcomeReplyTo = template?.replyTo || ''
      approvalWelcomeTextOnly = Boolean(template?.textOnly)
      approvalWelcomeEnabled = template?.enabled !== false
    } catch (error) {
      console.error('❌ Error loading approval welcome template:', error)
    } finally {
      approvalWelcomeLoading = false
    }
  }

  const saveApprovalWelcomeTemplate = async () => {
    try {
      approvalWelcomeSaving = true
      approvalWelcomeStatus = ''
      await firebaseStorage.saveEmailTemplate('approvalWelcomeEmail', {
        subject: approvalWelcomeSubject.trim(),
        text: approvalWelcomeText.trim(),
        html: approvalWelcomeHtml.trim(),
        fromName: approvalWelcomeFromName.trim(),
        fromEmail: approvalWelcomeFromEmail.trim(),
        replyTo: approvalWelcomeReplyTo.trim(),
        textOnly: approvalWelcomeTextOnly,
        enabled: approvalWelcomeEnabled
      })
      approvalWelcomeStatus = 'Saved'
    } catch (error) {
      console.error('❌ Error saving approval welcome template:', error)
      approvalWelcomeStatus = 'Save failed'
    } finally {
      approvalWelcomeSaving = false
      setTimeout(() => {
        approvalWelcomeStatus = ''
      }, 2500)
    }
  }

  const loadPaymentReminderTemplate = async () => {
    try {
      paymentReminderLoading = true
      const template = await firebaseStorage.getEmailTemplate('paymentReminderEmail')
      paymentReminderSubject = template?.subject || ''
      paymentReminderText = template?.text || ''
      paymentReminderHtml = template?.html || ''
      paymentReminderFromName = template?.fromName || ''
      paymentReminderFromEmail = template?.fromEmail || 'support@mprescribe.net'
      paymentReminderReplyTo = template?.replyTo || ''
      paymentReminderTextOnly = Boolean(template?.textOnly)
    } catch (error) {
      console.error('❌ Error loading payment reminder template:', error)
    } finally {
      paymentReminderLoading = false
    }
  }

  const savePaymentReminderTemplate = async () => {
    try {
      paymentReminderSaving = true
      paymentReminderStatus = ''
      await firebaseStorage.saveEmailTemplate('paymentReminderEmail', {
        subject: paymentReminderSubject.trim(),
        text: paymentReminderText.trim(),
        html: paymentReminderHtml.trim(),
        fromName: paymentReminderFromName.trim(),
        fromEmail: paymentReminderFromEmail.trim(),
        replyTo: paymentReminderReplyTo.trim(),
        textOnly: paymentReminderTextOnly
      })
      paymentReminderStatus = 'Saved'
    } catch (error) {
      console.error('❌ Error saving payment reminder template:', error)
      paymentReminderStatus = 'Save failed'
    } finally {
      paymentReminderSaving = false
      setTimeout(() => {
        paymentReminderStatus = ''
      }, 2500)
    }
  }

  const loadPaymentThanksTemplate = async () => {
    try {
      paymentThanksLoading = true
      const template = await firebaseStorage.getEmailTemplate('paymentThanksEmail')
      paymentThanksSubject = template?.subject || ''
      paymentThanksText = template?.text || ''
      paymentThanksHtml = template?.html || ''
      paymentThanksFromName = template?.fromName || ''
      paymentThanksFromEmail = template?.fromEmail || 'support@mprescribe.net'
      paymentThanksReplyTo = template?.replyTo || ''
      paymentThanksTextOnly = Boolean(template?.textOnly)
    } catch (error) {
      console.error('❌ Error loading payment thanks template:', error)
    } finally {
      paymentThanksLoading = false
    }
  }

  const savePaymentThanksTemplate = async () => {
    try {
      paymentThanksSaving = true
      paymentThanksStatus = ''
      await firebaseStorage.saveEmailTemplate('paymentThanksEmail', {
        subject: paymentThanksSubject.trim(),
        text: paymentThanksText.trim(),
        html: paymentThanksHtml.trim(),
        fromName: paymentThanksFromName.trim(),
        fromEmail: paymentThanksFromEmail.trim(),
        replyTo: paymentThanksReplyTo.trim(),
        textOnly: paymentThanksTextOnly
      })
      paymentThanksStatus = 'Saved'
    } catch (error) {
      console.error('❌ Error saving payment thanks template:', error)
      paymentThanksStatus = 'Save failed'
    } finally {
      paymentThanksSaving = false
      setTimeout(() => {
        paymentThanksStatus = ''
      }, 2500)
    }
  }

  const loadOtherMessageTemplate = async () => {
    try {
      otherMessageLoading = true
      const template = await firebaseStorage.getEmailTemplate('doctorMessageEmail')
      otherMessageSubject = template?.subject || ''
      otherMessageText = template?.text || ''
      otherMessageHtml = template?.html || ''
      otherMessageFromName = template?.fromName || ''
      otherMessageFromEmail = template?.fromEmail || 'support@mprescribe.net'
      otherMessageReplyTo = template?.replyTo || ''
      otherMessageTextOnly = Boolean(template?.textOnly)
    } catch (error) {
      console.error('❌ Error loading other message template:', error)
    } finally {
      otherMessageLoading = false
    }
  }

  const saveOtherMessageTemplate = async () => {
    try {
      otherMessageSaving = true
      otherMessageStatus = ''
      await firebaseStorage.saveEmailTemplate('doctorMessageEmail', {
        subject: otherMessageSubject.trim(),
        text: otherMessageText.trim(),
        html: otherMessageHtml.trim(),
        fromName: otherMessageFromName.trim(),
        fromEmail: otherMessageFromEmail.trim(),
        replyTo: otherMessageReplyTo.trim(),
        textOnly: otherMessageTextOnly
      })
      otherMessageStatus = 'Saved'
    } catch (error) {
      console.error('❌ Error saving other message template:', error)
      otherMessageStatus = 'Save failed'
    } finally {
      otherMessageSaving = false
      setTimeout(() => {
        otherMessageStatus = ''
      }, 2500)
    }
  }

  const saveDoctorBroadcastTemplate = async () => {
    try {
      doctorBroadcastSaving = true
      doctorBroadcastStatus = ''
      await firebaseStorage.saveDoctorBroadcastEmailTemplate({
        subject: doctorBroadcastSubject.trim(),
        text: doctorBroadcastText.trim(),
        html: doctorBroadcastHtml.trim(),
        fromName: doctorBroadcastFromName.trim(),
        fromEmail: doctorBroadcastFromEmail.trim(),
        replyTo: doctorBroadcastReplyTo.trim(),
        textOnly: doctorBroadcastTextOnly
      })
      doctorBroadcastStatus = 'Saved'
    } catch (error) {
      console.error('❌ Error saving doctor broadcast email template:', error)
      doctorBroadcastStatus = 'Save failed'
    } finally {
      doctorBroadcastSaving = false
      setTimeout(() => {
        doctorBroadcastStatus = ''
      }, 2500)
    }
  }

  const loadSmtpSettings = async () => {
    try {
      smtpLoading = true
      const settings = await firebaseStorage.getSmtpSettings()
      smtpHost = settings?.host || ''
      smtpPort = String(settings?.port || '587')
      smtpSecure = Boolean(settings?.secure)
      smtpUser = settings?.user || ''
    } catch (error) {
      console.error('❌ Error loading SMTP settings:', error)
    } finally {
      smtpLoading = false
    }
  }

  const loadMessagingTemplates = async () => {
    try {
      messagingTemplatesLoading = true
      const templates = await firebaseStorage.getMessagingTemplates()
      if (templates) {
        registrationTemplate = templates.registrationTemplate || registrationTemplate
        registrationTemplateEnabled = templates.registrationTemplateEnabled !== false
        appointmentReminderTemplate =
          templates.appointmentReminderTemplate || appointmentReminderTemplate
        appointmentReminderTemplateEnabled = templates.appointmentReminderTemplateEnabled !== false
        registrationChannel = templates.registrationChannel || registrationChannel
        appointmentReminderChannel =
          templates.appointmentReminderChannel || appointmentReminderChannel
        smsTestSenderId = templates.smsSenderId || smsTestSenderId
      }
    } catch (error) {
      console.error('❌ Error loading messaging templates:', error)
    } finally {
      messagingTemplatesLoading = false
    }
  }

  const saveMessagingTemplates = async () => {
    try {
      messagingTemplatesSaving = true
      messagingTemplatesStatus = ''
      await firebaseStorage.saveMessagingTemplates({
        registrationTemplate: registrationTemplate.trim(),
        appointmentReminderTemplate: appointmentReminderTemplate.trim(),
        registrationTemplateEnabled,
        appointmentReminderTemplateEnabled,
        registrationChannel,
        appointmentReminderChannel,
        smsSenderId: smsTestSenderId.trim()
      })
      messagingTemplatesStatus = 'Saved'
    } catch (error) {
      console.error('❌ Error saving messaging templates:', error)
      messagingTemplatesStatus = 'Save failed'
    } finally {
      messagingTemplatesSaving = false
      setTimeout(() => {
        messagingTemplatesStatus = ''
      }, 2500)
    }
  }

  const saveSmsSenderId = async () => {
    try {
      smsSenderIdSaving = true
      smsSenderIdStatus = ''
      await firebaseStorage.saveMessagingTemplates({
        smsSenderId: smsTestSenderId.trim()
      })
      smsSenderIdStatus = 'Saved'
    } catch (error) {
      console.error('❌ Error saving SMS sender ID:', error)
      smsSenderIdStatus = 'Save failed'
    } finally {
      smsSenderIdSaving = false
      setTimeout(() => {
        smsSenderIdStatus = ''
      }, 2500)
    }
  }

  const saveSmtpSettings = async () => {
    try {
      smtpSaving = true
      smtpStatus = ''
      await firebaseStorage.saveSmtpSettings({
        host: smtpHost.trim(),
        port: smtpPort.trim(),
        secure: smtpSecure,
        user: smtpUser.trim(),
        pass: ''
      })
      smtpStatus = 'Saved'
    } catch (error) {
      console.error('❌ Error saving SMTP settings:', error)
      smtpStatus = 'Save failed'
    } finally {
      smtpSaving = false
      setTimeout(() => {
        smtpStatus = ''
      }, 2500)
    }
  }

  const testSmtpSettings = async () => {
    const baseUrl = getFunctionsBaseUrl()
    if (!baseUrl) {
      smtpTestStatus = 'Functions base URL not configured'
      return
    }
    const currentUser = auth?.currentUser
    if (!currentUser) {
      smtpTestStatus = 'No authenticated user'
      return
    }
    try {
      smtpTestRunning = true
      smtpTestStatus = ''
      const token = await currentUser.getIdToken()
      const response = await fetch(`${baseUrl}/testSmtp`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({})
      })
      const text = await response.text()
      if (!response.ok) {
        throw new Error(text || 'SMTP test failed')
      }
      smtpTestStatus = 'SMTP test email sent'
    } catch (error) {
      smtpTestStatus = error?.message || 'SMTP test failed'
    } finally {
      smtpTestRunning = false
      setTimeout(() => {
        smtpTestStatus = ''
      }, 12000)
    }
  }

  const testWhatsappWelcome = async () => {
    const baseUrl = getFunctionsBaseUrl()
    if (!baseUrl) {
      whatsappTestStatus = 'Functions base URL not configured'
      return
    }
    const currentUser = auth?.currentUser
    if (!currentUser) {
      whatsappTestStatus = 'No authenticated user'
      return
    }
    try {
      whatsappTestRunning = true
      whatsappTestStatus = ''
      const token = await currentUser.getIdToken()
      const response = await fetch(`${baseUrl}/sendWelcomeWhatsapp`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          to: whatsappTestNumber,
          body: whatsappTestMessage
        })
      })
      const text = await response.text()
      if (!response.ok) {
        throw new Error(text || 'WhatsApp send failed')
      }
      whatsappTestStatus = 'WhatsApp message sent'
    } catch (error) {
      whatsappTestStatus = error?.message || 'WhatsApp send failed'
    } finally {
      whatsappTestRunning = false
      setTimeout(() => {
        whatsappTestStatus = ''
      }, 12000)
    }
  }

  const testSmsSend = async () => {
    const baseUrl = getFunctionsBaseUrl()
    if (!baseUrl) {
      smsTestStatus = 'Functions base URL not configured'
      return
    }
    const currentUser = auth?.currentUser
    if (!currentUser) {
      smsTestStatus = 'No authenticated user'
      return
    }
    try {
      smsTestRunning = true
      smsTestStatus = ''
      const token = await currentUser.getIdToken()
      const response = await fetch(`${baseUrl}/sendSmsApi`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          recipient: smsTestRecipient,
          senderId: smsTestSenderId,
          type: smsTestType === 'unicode' ? smsTestType : undefined,
          message: smsTestMessage
        })
      })
      const text = await response.text()
      if (!response.ok) {
        throw new Error(text || 'SMS send failed')
      }
      smsTestStatus = 'SMS sent'
    } catch (error) {
      smsTestStatus = error?.message || 'SMS send failed'
    } finally {
      smsTestRunning = false
      setTimeout(() => {
        smsTestStatus = ''
      }, 12000)
    }
  }

  const getFunctionsBaseUrl = () => {
    const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID
    const region = import.meta.env.VITE_FUNCTIONS_REGION || 'us-central1'
    if (!projectId) return null
    return import.meta.env.VITE_FUNCTIONS_BASE_URL || `https://${region}-${projectId}.cloudfunctions.net`
  }

  const sendTemplateToDoctor = async (templateId, doctorId, statusSetter) => {
    const baseUrl = getFunctionsBaseUrl()
    if (!baseUrl) {
      statusSetter('Functions base URL not configured')
      return
    }
    const currentUser = auth?.currentUser
    if (!currentUser) {
      statusSetter('No authenticated user')
      return
    }
    if (!doctorId) {
      statusSetter('Select a doctor first')
      return
    }
    try {
      const token = await currentUser.getIdToken()
      const response = await fetch(`${baseUrl}/sendDoctorTemplateEmail`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ templateId, doctorId })
      })
      if (!response.ok) {
        const message = await response.text()
        throw new Error(message || 'Send failed')
      }
      statusSetter('Sent')
    } catch (error) {
      statusSetter(error?.message || 'Send failed')
    } finally {
      setTimeout(() => statusSetter(''), 3000)
    }
  }

  const sendTemplateToTest = async (templateId, statusSetter, templateData = null) => {
    const baseUrl = getFunctionsBaseUrl()
    if (!baseUrl) {
      statusSetter('Functions base URL not configured')
      return
    }
    const currentUser = auth?.currentUser
    if (!currentUser) {
      statusSetter('No authenticated user')
      return
    }
    try {
      const token = await currentUser.getIdToken()
      const response = await fetch(`${baseUrl}/sendDoctorTemplateEmail`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          templateId,
          doctorEmail: 'senakahks@gmail.com',
          templateData: templateData || undefined
        })
      })
      if (!response.ok) {
        const message = await response.text()
        throw new Error(message || 'Send failed')
      }
      statusSetter('Test sent to senakahks@gmail.com')
    } catch (error) {
      statusSetter(error?.message || 'Send failed')
    } finally {
      setTimeout(() => statusSetter(''), 3000)
    }
  }

  const sendPatientTemplateToTest = async (templateId, statusSetter, templateData = null) => {
    const baseUrl = getFunctionsBaseUrl()
    if (!baseUrl) {
      statusSetter('Functions base URL not configured')
      return
    }
    const currentUser = auth?.currentUser
    if (!currentUser) {
      statusSetter('No authenticated user')
      return
    }
    try {
      const testPatientId = `test-patient-${Math.random().toString(36).slice(2, 10)}`
      const token = await currentUser.getIdToken()
      const response = await fetch(`${baseUrl}/sendPatientTemplateEmail`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          templateId,
          patientEmail: 'senakahks@gmail.com',
          doctorName: 'Dr. Test',
          patientData: {
            id: testPatientId,
            firstName: 'Test',
            lastName: 'Patient',
            email: 'senakahks@gmail.com'
          },
          templateData: templateData || undefined
        })
      })
      if (!response.ok) {
        const message = await response.text()
        throw new Error(message || 'Send failed')
      }
      statusSetter('Test sent to senakahks@gmail.com')
    } catch (error) {
      statusSetter(error?.message || 'Send failed')
    } finally {
      setTimeout(() => statusSetter(''), 3000)
    }
  }

  const sendAppointmentTemplateToTest = async (templateId, statusSetter, templateData = null) => {
    const baseUrl = getFunctionsBaseUrl()
    if (!baseUrl) {
      statusSetter('Functions base URL not configured')
      return
    }
    const currentUser = auth?.currentUser
    if (!currentUser) {
      statusSetter('No authenticated user')
      return
    }
    try {
      const token = await currentUser.getIdToken()
      const response = await fetch(`${baseUrl}/sendAppointmentReminderTemplateEmail`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          templateId,
          patientEmail: 'senakahks@gmail.com',
          doctorName: 'Dr. Test',
          appointmentDate: '2026-01-01',
          patientData: {
            firstName: 'Test',
            lastName: 'Patient',
            email: 'senakahks@gmail.com'
          },
          templateData: templateData || undefined
        })
      })
      if (!response.ok) {
        const message = await response.text()
        throw new Error(message || 'Send failed')
      }
      statusSetter('Test sent to senakahks@gmail.com')
    } catch (error) {
      statusSetter(error?.message || 'Send failed')
    } finally {
      setTimeout(() => statusSetter(''), 3000)
    }
  }

  const sendDoctorBroadcast = async (mode) => {
    const baseUrl = getFunctionsBaseUrl()
    if (!baseUrl) {
      console.error('❌ Functions base URL is not configured')
      return
    }
    const currentUser = auth?.currentUser
    if (!currentUser) {
      console.error('❌ No authenticated user found for email send')
      return
    }
    try {
      doctorBroadcastSending = true
      const token = await currentUser.getIdToken()
      const response = await fetch(`${baseUrl}/sendDoctorBroadcastEmail`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ mode })
      })
      if (!response.ok) {
        const message = await response.text()
        throw new Error(message || 'Send failed')
      }
      const data = await response.json()
      doctorBroadcastStatus = mode === 'test'
        ? `Test sent to ${data?.sent || 0} recipient`
        : `Sent to ${data?.sent || 0} doctors`
    } catch (error) {
      console.error('❌ Error sending doctor broadcast:', error)
      doctorBroadcastStatus = error?.message || 'Send failed'
    } finally {
      doctorBroadcastSending = false
      setTimeout(() => {
        doctorBroadcastStatus = ''
      }, 3000)
    }
  }

  const testOpenAIProxy = async () => {
    const baseUrl = getFunctionsBaseUrl()
    if (!baseUrl) {
      openaiTestStatus = 'Functions base URL not configured'
      return
    }
    const currentUser = auth?.currentUser
    if (!currentUser) {
      openaiTestStatus = 'No authenticated user'
      return
    }
    try {
      openaiTestRunning = true
      openaiTestStatus = ''
      const token = await currentUser.getIdToken()
      const response = await fetch(`${baseUrl}/openaiProxy`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          endpoint: 'chat/completions',
          requestBody: {
            model: 'gpt-3.5-turbo',
            messages: [
              { role: 'system', content: 'You are a test endpoint.' },
              { role: 'user', content: 'Reply with OK.' }
            ],
            max_tokens: 5,
            temperature: 0
          }
        })
      })
      const text = await response.text()
      if (!response.ok) {
        throw new Error(text || 'OpenAI test failed')
      }
      openaiTestStatus = 'OpenAI proxy OK'
    } catch (error) {
      openaiTestStatus = error?.message || 'OpenAI test failed'
    } finally {
      openaiTestRunning = false
      setTimeout(() => {
        openaiTestStatus = ''
      }, 3000)
    }
  }
  const saveWelcomeEmailTemplate = async () => {
    try {
      welcomeEmailSaving = true
      welcomeEmailStatus = ''
      await firebaseStorage.saveWelcomeEmailTemplate({
        subject: welcomeSubject.trim(),
        text: welcomeText.trim(),
        html: welcomeHtml.trim(),
        fromName: welcomeFromName.trim(),
        fromEmail: welcomeFromEmail.trim(),
        replyTo: welcomeReplyTo.trim(),
        textOnly: welcomeTextOnly,
        enabled: welcomeEmailEnabled
      })
      welcomeEmailStatus = 'Saved'
    } catch (error) {
      console.error('❌ Error saving welcome email template:', error)
      welcomeEmailStatus = 'Save failed'
    } finally {
      welcomeEmailSaving = false
      setTimeout(() => {
        welcomeEmailStatus = ''
      }, 2500)
    }
  }

  const savePatientWelcomeTemplate = async () => {
    try {
      patientWelcomeSaving = true
      patientWelcomeStatus = ''
      await firebaseStorage.savePatientWelcomeEmailTemplate({
        subject: patientWelcomeSubject.trim(),
        text: patientWelcomeText.trim(),
        html: patientWelcomeHtml.trim(),
        fromName: patientWelcomeFromName.trim(),
        fromEmail: patientWelcomeFromEmail.trim(),
        replyTo: patientWelcomeReplyTo.trim(),
        textOnly: patientWelcomeTextOnly,
        enabled: patientWelcomeEnabled
      })
      patientWelcomeStatus = 'Saved'
    } catch (error) {
      console.error('❌ Error saving patient welcome template:', error)
      patientWelcomeStatus = 'Save failed'
    } finally {
      patientWelcomeSaving = false
      setTimeout(() => {
        patientWelcomeStatus = ''
      }, 2500)
    }
  }

  const saveAppointmentReminderTemplate = async () => {
    try {
      appointmentEmailSaving = true
      appointmentEmailStatus = ''
      await firebaseStorage.saveAppointmentReminderEmailTemplate({
        subject: appointmentEmailSubject.trim(),
        text: appointmentEmailText.trim(),
        html: appointmentEmailHtml.trim(),
        fromName: appointmentEmailFromName.trim(),
        fromEmail: appointmentEmailFromEmail.trim(),
        replyTo: appointmentEmailReplyTo.trim(),
        textOnly: appointmentEmailTextOnly,
        enabled: appointmentEmailEnabled
      })
      appointmentEmailStatus = 'Saved'
    } catch (error) {
      console.error('❌ Error saving appointment reminder template:', error)
      appointmentEmailStatus = 'Save failed'
    } finally {
      appointmentEmailSaving = false
      setTimeout(() => {
        appointmentEmailStatus = ''
      }, 2500)
    }
  }
  
  // Load system statistics (HIPAA compliant - aggregated data only)
  const loadStatistics = async () => {
    try {
      console.log('📊 Loading system statistics...')
      
      // Get all doctors
      const allDoctors = await firebaseStorage.getAllDoctors()
      console.log('📊 Found doctors:', allDoctors.length)
      statistics.totalDoctors = allDoctors.length
      
      // Get aggregated counts without accessing individual patient data
      let totalPatients = 0
      let totalPrescriptions = 0
      let totalSymptoms = 0
      let totalIllnesses = 0
      
      for (const doctor of allDoctors) {
        console.log(`📊 Processing doctor: ${doctor.name || doctor.email} (${doctor.id})`)
        
        try {
          // Get patient count only (aggregated data)
          const doctorPatients = await firebaseStorage.getPatientsByDoctorId(doctor.id)
          console.log(`📊 Doctor has ${doctorPatients.length} patients`)
          totalPatients += doctorPatients.length
          
          // Get aggregated counts for medical data (without accessing individual patient details)
          // Note: This still accesses patient data but only for counting - consider implementing
          // separate aggregation functions in firebaseStorage for full HIPAA compliance
          for (const patient of doctorPatients) {
            try {
              const prescriptions = await firebaseStorage.getPrescriptionsByPatientId(patient.id)
              const symptoms = await firebaseStorage.getSymptomsByPatientId(patient.id)
              const illnesses = await firebaseStorage.getIllnessesByPatientId(patient.id)
              
              totalPrescriptions += prescriptions.length
              totalSymptoms += symptoms.length
              totalIllnesses += illnesses.length
            } catch (error) {
              console.error(`❌ Error loading medical data for patient ${patient.id}:`, error)
              // Continue with other patients
            }
          }
        } catch (error) {
          console.error(`❌ Error loading data for doctor ${doctor.id}:`, error)
          // Continue with other doctors
        }
      }
      
      statistics.totalPatients = totalPatients
      statistics.totalPrescriptions = totalPrescriptions
      statistics.totalSymptoms = totalSymptoms
      statistics.totalIllnesses = totalIllnesses
      
      console.log('📊 Final statistics (aggregated):', statistics)
      
    } catch (error) {
      console.error('❌ Error loading statistics:', error)
      console.error('❌ Error details:', error.message, error.stack)
    }
  }
  
  // Load AI usage statistics
  const loadAIUsageStats = () => {
    try {
      console.log('📊 Loading AI usage stats...')
      aiUsageStats = aiTokenTracker.getUsageStats()
      console.log('📊 AI usage stats loaded:', aiUsageStats)
      
      // If no usage data exists, initialize with zero values
      if (!aiUsageStats || !aiUsageStats.total) {
        aiUsageStats = {
          total: { tokens: 0, cost: 0, requests: 0 },
          today: { tokens: 0, cost: 0, requests: 0 },
          thisMonth: { tokens: 0, cost: 0, requests: 0 },
          lastUpdated: null
        }
      }
      
      // Run migration to fix any missing doctorId values
      const migratedCount = aiTokenTracker.migrateRequestsWithMissingDoctorId()
      if (migratedCount > 0) {
        console.log(`🔄 Fixed ${migratedCount} AI usage records with missing doctorId`)
        // Reload stats after migration
        aiUsageStats = aiTokenTracker.getUsageStats()
      }
    } catch (error) {
      console.error('❌ Error loading AI usage stats:', error)
      aiUsageStats = {
        total: { tokens: 0, cost: 0, requests: 0 },
        today: { tokens: 0, cost: 0, requests: 0 },
        thisMonth: { tokens: 0, cost: 0, requests: 0 },
        lastUpdated: null
      }
    }
  }
  
  // Load doctors data only (HIPAA compliant - no patient data access)
  const loadDoctors = async () => {
    try {
      console.log('🔍 Loading doctors...')
      const fetchedDoctors = await firebaseStorage.getAllDoctors()
      const dedupedDoctors = []
      const seenByEmail = new Map()

      fetchedDoctors.forEach((doctor) => {
        const emailKey = (doctor?.email || '').toLowerCase()
        if (!emailKey) {
          dedupedDoctors.push(doctor)
          return
        }

        const existing = seenByEmail.get(emailKey)
        if (!existing) {
          seenByEmail.set(emailKey, doctor)
          return
        }

        const existingDate = new Date(existing.createdAt || 0).getTime()
        const currentDate = new Date(doctor.createdAt || 0).getTime()
        if (currentDate > existingDate) {
          seenByEmail.set(emailKey, doctor)
        }
      })

      seenByEmail.forEach((doctor) => {
        dedupedDoctors.push(doctor)
      })

      doctors = dedupedDoctors
      await applyReferralBonuses(doctors)
      
      console.log(`🔍 Found ${doctors.length} doctors`)
      
      // Get patient counts and token usage for each doctor (aggregated data only)
      for (const doctor of doctors) {
        try {
          console.log(`🔍 Getting patient count for doctor: ${doctor.email}`)
          const doctorPatients = await firebaseStorage.getPatientsByDoctorId(doctor.id)
          console.log(`🔍 Doctor ${doctor.email} has ${doctorPatients.length} patients`)
          
          // Add patient count to doctor object for display (aggregated data only)
          doctor.patientCount = doctorPatients.length
          
          // Get token usage stats for this doctor
          // Try multiple ID formats to match token usage data
          let tokenStats = aiTokenTracker.getDoctorUsageStats(doctor.id)
          console.log(`📊 Token stats for doctor.id (${doctor.id}):`, tokenStats)
          
          // If no stats found with Firebase ID, try with UID
          if (!tokenStats && doctor.uid) {
            tokenStats = aiTokenTracker.getDoctorUsageStats(doctor.uid)
            console.log(`📊 Token stats for doctor.uid (${doctor.uid}):`, tokenStats)
          }
          
          // If still no stats found, try with email as fallback
          if (!tokenStats) {
            tokenStats = aiTokenTracker.getDoctorUsageStats(doctor.email)
            console.log(`📊 Token stats for doctor.email (${doctor.email}):`, tokenStats)
          }
          
          // Check for unknown-doctor entries that might belong to this doctor
          const unknownDoctorStats = aiTokenTracker.getDoctorUsageStats('unknown-doctor')
          if (unknownDoctorStats && unknownDoctorStats.total.requests > 0) {
            console.log(`📊 Found unknown-doctor entries with ${unknownDoctorStats.total.requests} requests`)
          }
          
          doctor.tokenUsage = tokenStats || {
            total: { tokens: 0, cost: 0, requests: 0 },
            today: { tokens: 0, cost: 0, requests: 0 }
          }
          
        } catch (error) {
          console.error(`❌ Error loading data for doctor ${doctor.id}:`, error)
          doctor.patientCount = 0
          doctor.tokenUsage = {
            total: { tokens: 0, cost: 0, requests: 0 },
            today: { tokens: 0, cost: 0, requests: 0 }
          }
        }
      }
      
    } catch (error) {
      console.error('❌ Error loading doctors:', error)
    }
  }
  
  // Handle admin sign out
  const handleSignOut = async () => {
    try {
      await adminAuthService.signOut()
      dispatch('admin-signed-out')
    } catch (error) {
      console.error('❌ Error signing out admin:', error)
    }
  }
  
  // Handle tab change
  const handleTabChange = (tab) => {
    activeTab = tab
    if (tab === 'logs' && !emailLogsLoading && emailLogs.length === 0) {
      loadEmailLogs()
    }
    if (tab === 'logs' && !authLogsLoading && authLogs.length === 0) {
      loadAuthLogs()
    }
  }

  const openDoctorView = (doctor) => {
    if (!doctor) return
    selectedDoctorView = doctor
    activeTab = 'doctor-view'
  }

  const closeDoctorView = () => {
    selectedDoctorView = null
    activeTab = 'doctors'
  }
  
  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A'
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
  }

  const formatDateTime = (dateString) => {
    if (!dateString) return 'N/A'
    return new Date(dateString).toLocaleString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    })
  }

  const isTrialActive = (doctor) => {
    if (!doctor?.accessExpiresAt) return false
    const expiresAt = new Date(doctor.accessExpiresAt)
    if (Number.isNaN(expiresAt.getTime())) return false
    return Date.now() <= expiresAt.getTime()
  }

  const isReferralBonusPending = (doctor) => {
    if (!doctor?.referredByDoctorId) return false
    if (doctor.referralBonusApplied) return false
    if (!doctor.referralEligibleAt) return false
    const eligibleAt = new Date(doctor.referralEligibleAt)
    if (Number.isNaN(eligibleAt.getTime())) return false
    return Date.now() < eligibleAt.getTime()
  }

  const getDisplayedDoctors = () => {
    return showReferralPendingOnly ?
      doctors.filter(isReferralBonusPending) :
      doctors
  }

  const getOwnerDoctor = (doctor) => {
    if (!doctor?.externalDoctor || !doctor?.invitedByDoctorId) return null
    return doctors.find(d => d.id === doctor.invitedByDoctorId) || null
  }

  const isApprovalPending = (doctor) => doctor?.isApproved === false

  const isOwnerDisabled = (doctor) => {
    const ownerDoctor = getOwnerDoctor(doctor)
    return !!ownerDoctor?.isDisabled
  }

  const isEffectivelyDisabled = (doctor) => {
    return isApprovalPending(doctor) || !!doctor?.isDisabled || isOwnerDisabled(doctor)
  }

  const addOneMonthToDate = (value) => {
    const base = value ? new Date(value) : new Date()
    const baseTime = Number.isNaN(base.getTime()) ? new Date() : base
    const now = new Date()
    const effectiveBase = baseTime < now ? now : baseTime
    const next = new Date(effectiveBase)
    next.setMonth(next.getMonth() + 1)
    return next.toISOString()
  }

  let referralBonusRunning = false

  const resolveReferrerId = (referrerId) => {
    if (!referrerId) return ''
    const direct = doctors.find(d => d.id === referrerId)
    if (direct) return direct.id
    const shortMatch = doctors.find(d => formatDoctorId(d.id) === referrerId)
    return shortMatch ? shortMatch.id : referrerId
  }

  const applyReferralBonuses = async (currentDoctors) => {
    if (referralBonusRunning) return
    referralBonusRunning = true
    try {
      const now = new Date()
      const eligible = currentDoctors.filter(d =>
        d.referredByDoctorId &&
        d.referralEligibleAt &&
        !d.referralBonusApplied &&
        d.isApproved !== false &&
        !d.isDisabled
      )
      for (const referredDoctor of eligible) {
        const eligibleAt = new Date(referredDoctor.referralEligibleAt)
        if (Number.isNaN(eligibleAt.getTime()) || eligibleAt > now) {
          continue
        }
        const referrerId = resolveReferrerId(referredDoctor.referredByDoctorId)
        const referrer = currentDoctors.find(d => d.id === referrerId) || null

        const updatedReferred = {
          ...referredDoctor,
          referredByDoctorId: referrerId,
          accessExpiresAt: addOneMonthToDate(referredDoctor.accessExpiresAt),
          referralBonusApplied: true,
          referralBonusAppliedAt: new Date().toISOString()
        }
        await firebaseStorage.updateDoctor(updatedReferred)

        let updatedReferrer = null
        if (referrer) {
          updatedReferrer = {
            ...referrer,
            accessExpiresAt: addOneMonthToDate(referrer.accessExpiresAt)
          }
          await firebaseStorage.updateDoctor(updatedReferrer)
        }

        doctors = doctors.map(d => {
          if (d.id === updatedReferred.id) {
            return { ...d, ...updatedReferred }
          }
          if (updatedReferrer && d.id === updatedReferrer.id) {
            return { ...d, accessExpiresAt: updatedReferrer.accessExpiresAt }
          }
          return d
        })
      }
    } catch (error) {
      console.error('❌ Error applying referral bonuses:', error)
    } finally {
      referralBonusRunning = false
    }
  }

  const getDoctorStatusLabel = (doctor) => {
    if (isApprovalPending(doctor)) {
      return 'Approval Pending'
    }
    if (isOwnerDisabled(doctor)) {
      return 'Disabled (Owner)'
    }
    return doctor?.isDisabled ? 'Disabled' : 'Enabled'
  }

  const getDoctorStatusBadgeClass = (doctor) => {
    if (isApprovalPending(doctor)) {
      return 'bg-amber-100 text-amber-700'
    }
    return isEffectivelyDisabled(doctor) ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
  }

  const canToggleDoctor = (doctor) => {
    if (!doctor) return false
    if (doctor.isAdmin || doctor.email === 'senakahks@gmail.com') return false
    if (doctor.externalDoctor && isOwnerDisabled(doctor)) return false
    if (isApprovalPending(doctor)) return false
    return true
  }

  const approveDoctor = async (doctor) => {
    if (!doctor || doctor.isApproved) return
    try {
      const date = new Date()
      date.setMonth(date.getMonth() + 1)
      let referredByDoctorId = doctor.referredByDoctorId
      if (referredByDoctorId) {
        referredByDoctorId = resolveReferrerId(referredByDoctorId)
      }
      const updatedDoctor = {
        ...doctor,
        isApproved: true,
        isDisabled: false,
        accessExpiresAt: date.toISOString(),
        referredByDoctorId,
        referralEligibleAt: referredByDoctorId ? date.toISOString() : null,
        referralBonusApplied: false
      }
      await firebaseStorage.updateDoctor(updatedDoctor)
      doctors = doctors.map(d => d.id === doctor.id ? { ...d, ...updatedDoctor } : d)
      try {
        await sendTemplateToDoctor('approvalWelcomeEmail', doctor.id, () => {})
      } catch (error) {
        console.error('❌ Error sending approval welcome email:', error)
      }
    } catch (error) {
      console.error('❌ Error approving doctor:', error)
    }
  }

  const toggleDoctorStatus = async (doctor) => {
    if (!doctor || !canToggleDoctor(doctor)) return
    try {
      const enabling = doctor.isDisabled
      const accessExpiresAt = enabling
        ? (() => {
            const date = new Date()
            date.setMonth(date.getMonth() + 1)
            return date.toISOString()
          })()
        : doctor.accessExpiresAt || null
      const updatedDoctor = { ...doctor, isDisabled: !doctor.isDisabled, accessExpiresAt }
      await firebaseStorage.updateDoctor(updatedDoctor)
      doctors = doctors.map(d => d.id === doctor.id ? { ...d, isDisabled: updatedDoctor.isDisabled, accessExpiresAt } : d)
    } catch (error) {
      console.error('❌ Error updating doctor status:', error)
    }
  }

  const formatCompactNumber = (value) => {
    const num = Number(value)
    if (!Number.isFinite(num)) {
      return '0'
    }
    const abs = Math.abs(num)
    const format = (divisor, suffix) => {
      const trimmed = (num / divisor).toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1')
      return `${trimmed}${suffix}`
    }
    if (abs >= 1e12) return format(1e12, 'T')
    if (abs >= 1e9) return format(1e9, 'G')
    if (abs >= 1e6) return format(1e6, 'M')
    if (abs >= 1e3) return format(1e3, 'K')
    return num.toLocaleString()
  }
  
  // Refresh data
  const refreshData = async () => {
    await loadAdminData()
  }

  // Quota Management Functions
  
  // Get doctor name by ID
  const getDoctorName = (doctorId) => {
    const doctor = doctors.find(d => d.id === doctorId || d.uid === doctorId)
    if (doctor) {
      return doctor.name || `${doctor.firstName || ''} ${doctor.lastName || ''}`.trim() || doctor.email || 'Unknown Doctor'
    }
    return 'Unknown Doctor'
  }
  
  // Open quota modal
  const openQuotaModal = (doctorId, currentQuota = 0) => {
    selectedDoctorId = doctorId
    quotaInput = currentQuota
    showQuotaModal = true
  }
  
  // Close quota modal
  const closeQuotaModal = () => {
    showQuotaModal = false
    selectedDoctorId = ''
    quotaInput = 0
  }
  
  // Save quota
  const saveQuota = () => {
    if (!selectedDoctorId || quotaInput < 0) return
    
    try {
      aiTokenTracker.setDoctorQuota(selectedDoctorId, parseInt(quotaInput))
      
      // Show success notification
      console.log(`✅ Quota set for doctor ${selectedDoctorId}: ${quotaInput} tokens`)
      
      // Close modal
      closeQuotaModal()
      
      // Refresh the page to show updated data
      setTimeout(() => {
        loadAIUsageStats()
      }, 100)
      
    } catch (error) {
      console.error('❌ Error setting quota:', error)
    }
  }

  // Configuration Management Functions
  
  // Save default quota
  const saveDefaultQuota = () => {
    if (!defaultQuotaInput || defaultQuotaInput < 0) return
    
    try {
      aiTokenTracker.setDefaultQuota(defaultQuotaInput)
      console.log(`✅ Default quota saved: ${defaultQuotaInput} tokens`)
      
      // Clear input
      defaultQuotaInput = 0
      
      // Refresh the page to show updated data
      setTimeout(() => {
        loadAIUsageStats()
      }, 100)
      
    } catch (error) {
      console.error('❌ Error saving default quota:', error)
    }
  }
  
  // Apply default quota to all doctors
  const applyDefaultQuotaToAll = () => {
    try {
      const appliedCount = aiTokenTracker.applyDefaultQuotaToAllDoctors()
      console.log(`✅ Applied default quota to ${appliedCount} doctors`)
      
      // Refresh the page to show updated data
      setTimeout(() => {
        loadAIUsageStats()
      }, 100)
      
    } catch (error) {
      console.error('❌ Error applying default quota:', error)
    }
  }
  
  // Save token price
  const saveTokenPrice = () => {
    if (!tokenPriceInput || tokenPriceInput < 0) return
    
    try {
      aiTokenTracker.setTokenPricePerMillion(tokenPriceInput)
      console.log(`✅ Token price saved: $${tokenPriceInput} per 1M tokens`)
      
      // Clear input
      tokenPriceInput = 0
      
      // Refresh the page to show updated data
      setTimeout(() => {
        loadAIUsageStats()
      }, 100)
      
    } catch (error) {
      console.error('❌ Error saving token price:', error)
    }
  }
  
  // Refresh cost estimates
  const refreshCostEstimates = () => {
    try {
      console.log('🔄 Refreshing cost estimates...')
      
      // Refresh the page to show updated data
      loadAIUsageStats()
      
    } catch (error) {
      console.error('❌ Error refreshing cost estimates:', error)
    }
  }

  // Delete doctor
  const deleteDoctor = async (doctor) => {
    const targetDoctor = {
      id: doctor?.id,
      email: doctor?.email,
      name: doctor?.name || `${doctor?.firstName || ''} ${doctor?.lastName || ''}`.trim()
    }

    pendingAction = async () => {
      try {
      // Show loading state
      const deleteButton = document.querySelector(`[data-doctor-id="${targetDoctor.id}"]`)
      if (deleteButton) {
        deleteButton.disabled = true
          deleteButton.innerHTML = '<svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>Deleting...'
      }
      
      console.log('🗑️ Admin: Deleting doctor:', targetDoctor.email)
      
      // Call the delete function
      try {
        await firebaseStorage.deleteDoctor(targetDoctor.id)
      } catch (deleteError) {
        console.warn('⚠️ Full doctor cleanup failed, retrying without patient cleanup:', deleteError)
        await firebaseStorage.deleteDoctor(targetDoctor.id, { skipPatientCleanup: true })
      }
      
      // Remove doctor from local array
      doctors = doctors.filter(d => d.id !== targetDoctor.id)
      
      // Update statistics
      statistics.totalDoctors = doctors.length
      
      // Refresh doctors list and stats
      await loadDoctors()
      
      console.log('✅ Admin: Doctor deleted successfully')
        
        // Show success message
        showConfirmation(
          'Success',
          `Doctor "${targetDoctor.name || targetDoctor.email}" has been deleted successfully.`,
          'OK',
          '',
          'success'
        )
      
    } catch (error) {
      console.error('❌ Admin: Error deleting doctor:', error)
        
        // Show error message
        showConfirmation(
          'Error',
          error?.message || 'Error deleting doctor. Please try again.',
          'OK',
          '',
          'danger'
        )
      
      // Reset button state
      const deleteButton = document.querySelector(`[data-doctor-id="${targetDoctor.id}"]`)
      if (deleteButton) {
        deleteButton.disabled = false
          deleteButton.innerHTML = '<i class="fas fa-trash mr-2"></i>Delete'
        }
      }
    }
    
    showConfirmation(
      'Delete Doctor',
      `Are you sure you want to delete doctor "${targetDoctor.name || targetDoctor.email}"?\n\nThis will permanently delete:\n• The doctor account\n• All patients belonging to this doctor\n• All prescriptions, symptoms, and illnesses\n• All drug database entries\n\nThis action cannot be undone!`,
      'Delete',
      'Cancel',
      'danger'
    )
  }
</script>

<div class="min-h-screen bg-gray-50">
  {#if loading}
    <LoadingSpinner 
      size="large" 
      color="red" 
      text="Loading admin dashboard..." 
      fullScreen={true}
    />
  {:else}
    <!-- Admin Header -->
    <nav class="bg-gray-900 border-gray-200 dark:bg-gray-900" style="height: 50px; min-height: 50px; max-height: 50px;">
      <div class="max-w-screen-xl flex flex-wrap items-center justify-between mx-auto px-4 py-1">
        <span class="text-lg font-semibold text-white">
          <i class="fas fa-shield-alt mr-2"></i>
          Admin Panel
        </span>
        
        <div class="flex items-center gap-3">
          {#if handleBackToApp}
            <button
              type="button"
              class="text-white border border-gray-500 hover:bg-gray-800 font-medium rounded-lg text-xs px-3 py-1.5 transition-colors duration-200 flex items-center"
              on:click={handleBackToApp}
            >
              <i class="fas fa-user-md mr-2"></i>
              Doctor Panel
            </button>
          {/if}
          <div class="relative">
            <button 
              class="text-white hover:text-gray-300 border-0 bg-transparent py-1 px-2 text-sm flex items-center transition-colors duration-200" 
              type="button" 
              data-dropdown-toggle="adminDropdown"
              data-dropdown-placement="bottom-end"
              aria-expanded="false"
            >
              <i class="fas fa-user-shield mr-2"></i>
              {currentAdmin?.name || 'Admin'}
              <svg class="w-2.5 h-2.5 ml-2.5" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 10 6">
                <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m1 1 4 4 4-4"/>
              </svg>
            </button>
            <div 
              id="adminDropdown" 
              class="z-10 hidden bg-white divide-y divide-gray-100 rounded-lg shadow w-44 dark:bg-gray-700"
            >
              <div class="px-4 py-3 text-sm text-gray-900 dark:text-white">
                <div class="font-medium">Admin Account</div>
                <div class="truncate">{currentAdmin?.email}</div>
              </div>
              <ul class="py-2 text-sm text-gray-700 dark:text-gray-200">
                <li>
                  <button 
                    type="button"
                    class="block w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-600 dark:hover:text-white transition-colors duration-200" 
                    on:click={handleSignOut}
                  >
                    <i class="fas fa-sign-out-alt mr-2"></i>Sign Out
                </button>
              </li>
            </ul>
            </div>
          </div>
        </div>
      </div>
    </nav>
    
    <!-- Main Content -->
    <div class="max-w-screen-xl mx-auto px-4 py-6">
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <!-- Sidebar -->
        <div class="lg:col-span-3">
          <div class="bg-white rounded-lg shadow-sm border border-gray-200">
            <div class="p-4">
              <nav class="space-y-2">
            <button
                  class="w-full flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors duration-200 {activeTab === 'overview' ? 'bg-red-50 text-red-700 border border-red-200' : 'text-gray-700 hover:bg-gray-50'}"
              on:click={() => handleTabChange('overview')}
            >
                  <i class="fas fa-chart-bar mr-3"></i>Overview
            </button>
            <button
                  class="w-full flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors duration-200 {activeTab === 'doctors' ? 'bg-red-50 text-red-700 border border-red-200' : 'text-gray-700 hover:bg-gray-50'}"
              on:click={() => handleTabChange('doctors')}
            >
                  <i class="fas fa-user-md mr-3"></i>Doctors
            </button>
            <!-- Patients tab removed for HIPAA compliance - admins should not access patient PHI data -->
            <button
                  class="w-full flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors duration-200 {activeTab === 'ai-usage' ? 'bg-red-50 text-red-700 border border-red-200' : 'text-gray-700 hover:bg-gray-50'}"
              on:click={() => handleTabChange('ai-usage')}
            >
                  <i class="fas fa-brain mr-3 text-red-500"></i>AI Usage
            </button>
            <button
                  class="w-full flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors duration-200 {activeTab === 'ai-logs' ? 'bg-red-50 text-red-700 border border-red-200' : 'text-gray-700 hover:bg-gray-50'}"
              on:click={() => handleTabChange('ai-logs')}
            >
                  <i class="fas fa-brain mr-3 text-red-500"></i>AI Logs
            </button>
            <button
                  class="w-full flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors duration-200 {activeTab === 'logs' ? 'bg-red-50 text-red-700 border border-red-200' : 'text-gray-700 hover:bg-gray-50'}"
              on:click={() => handleTabChange('logs')}
            >
                  <i class="fas fa-clipboard-list mr-3"></i>Logs
            </button>
            <button
                  class="w-full flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors duration-200 {activeTab === 'payments' ? 'bg-red-50 text-red-700 border border-red-200' : 'text-gray-700 hover:bg-gray-50'}"
              on:click={() => handleTabChange('payments')}
            >
                  <i class="fas fa-credit-card mr-3"></i>Payments
            </button>
            <button
                  class="w-full flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors duration-200 {activeTab === 'promotions' ? 'bg-red-50 text-red-700 border border-red-200' : 'text-gray-700 hover:bg-gray-50'}"
              on:click={() => handleTabChange('promotions')}
            >
                  <i class="fas fa-bullhorn mr-3"></i>Promotions
            </button>
            <button
                  class="w-full flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors duration-200 {activeTab === 'messaging' ? 'bg-red-50 text-red-700 border border-red-200' : 'text-gray-700 hover:bg-gray-50'}"
              on:click={() => handleTabChange('messaging')}
            >
                  <i class="fas fa-comment-dots mr-3"></i>Messaging
            </button>
            <button
                  class="w-full flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors duration-200 {activeTab === 'system' ? 'bg-red-50 text-red-700 border border-red-200' : 'text-gray-700 hover:bg-gray-50'}"
              on:click={() => handleTabChange('system')}
            >
                  <i class="fas fa-cog mr-3"></i>System
            </button>
            <button
                  class="w-full flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors duration-200 {activeTab === 'email' ? 'bg-red-50 text-red-700 border border-red-200' : 'text-gray-700 hover:bg-gray-50'}"
              on:click={() => handleTabChange('email')}
            >
                  <i class="fas fa-envelope mr-3"></i>Email
            </button>
              </nav>
            </div>
          </div>
        </div>
        
        <!-- Main Content Area -->
        <div class="lg:col-span-9">
          {#if activeTab === 'overview'}
            <div>
            <!-- Overview Tab -->
            <div class="flex justify-between items-center mb-6">
              <h2 class="text-2xl font-bold text-gray-900"><i class="fas fa-chart-bar mr-2 text-red-500"></i>System Overview</h2>
              <button class="text-white bg-teal-600 hover:bg-teal-700 focus:ring-4 focus:outline-none focus:ring-teal-300 font-medium rounded-lg text-sm px-5 py-2.5 text-center dark:bg-teal-600 dark:hover:bg-teal-700 dark:focus:ring-teal-800 transition-all duration-200 flex items-center" on:click={refreshData}>
                <i class="fas fa-sync-alt mr-2"></i>Refresh
              </button>
            </div>
            
            <!-- HIPAA Compliance Notice -->
            <div class="bg-blue-50 border border-teal-200 rounded-lg p-4 mb-6" role="alert">
              <i class="fas fa-shield-alt text-blue-500 mr-2"></i>
              <span class="text-sm text-blue-700">
              <strong>HIPAA Compliance:</strong> This admin panel displays only aggregated system statistics. 
              Individual patient data is not accessible to administrators to maintain HIPAA compliance and patient privacy.
              </span>
            </div>
            
            <!-- Statistics Cards -->
            <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
              <div class="bg-white border-2 border-teal-200 rounded-lg shadow-sm p-4 text-center">
                <i class="fas fa-user-md text-2xl text-blue-500 mb-2"></i>
                <h3 class="text-xl font-bold text-gray-900">{statistics.totalDoctors}</h3>
                <p class="text-sm text-gray-500">Total Doctors</p>
              </div>
              
              <div class="bg-white border-2 border-teal-200 rounded-lg shadow-sm p-4 text-center">
                <i class="fas fa-users text-2xl text-teal-500 mb-2"></i>
                <h3 class="text-xl font-bold text-gray-900">{statistics.totalPatients}</h3>
                <p class="text-sm text-gray-500">Total Patients <small>(Aggregated)</small></p>
              </div>
              
              <div class="bg-white border-2 border-yellow-200 rounded-lg shadow-sm p-4 text-center">
                <i class="fas fa-pills text-2xl text-yellow-600 mb-2"></i>
                <h3 class="text-xl font-bold text-gray-900">{statistics.totalPrescriptions}</h3>
                <p class="text-sm text-gray-500">Total Prescriptions <small>(Aggregated)</small></p>
              </div>
              
              <div class="bg-white border-2 border-teal-200 rounded-lg shadow-sm p-4 text-center">
                <i class="fas fa-heartbeat text-2xl text-teal-600 mb-2"></i>
                <h3 class="text-xl font-bold text-gray-900">{statistics.totalSymptoms}</h3>
                <p class="text-sm text-gray-500">Total Symptoms <small>(Aggregated)</small></p>
              </div>
              
              <div class="bg-white border-2 border-red-200 rounded-lg shadow-sm p-4 text-center">
                <i class="fas fa-brain text-2xl text-red-600 mb-2"></i>
                <h3 class="text-xl font-bold text-gray-900">
                      {#if aiUsageStats}
                        ${aiUsageStats.total.cost.toFixed(3)}
                      {:else}
                        $0.000
                      {/if}
                </h3>
                <p class="text-sm text-gray-500">AI Cost <small>(Est.)</small></p>
              </div>
            </div>

            <!-- Recent Activity -->
            <div class="bg-white border-2 border-teal-200 rounded-lg shadow-sm">
              <div class="bg-gray-50 px-4 py-3 border-b border-gray-200">
                <h5 class="text-lg font-semibold text-gray-900 mb-0"><i class="fas fa-clock mr-2"></i>Recent Activity</h5>
              </div>
              <div class="p-4">
                <p class="text-gray-500">Recent system activity will be displayed here.</p>
              </div>
            </div>
            </div>
          {:else if activeTab === 'doctors'}
            <!-- Doctors Tab -->
            <div class="flex justify-between items-center mb-6">
              <h2 class="text-2xl font-bold text-gray-900"><i class="fas fa-user-md mr-2 text-red-600"></i>Doctors Management</h2>
              <div class="flex items-center gap-3">
                <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-teal-100 text-teal-800">{doctors.length} Doctors</span>
                <label class="inline-flex items-center text-xs text-gray-600">
                  <input
                    type="checkbox"
                    class="h-3 w-3 text-red-600 border-gray-300 rounded mr-2"
                    bind:checked={showReferralPendingOnly}
                  />
                  Show referral pending only
                </label>
              </div>
            </div>
            
            <div class="bg-white border-2 border-teal-200 rounded-lg shadow-sm">
              <div class="bg-gray-50 px-4 py-3 border-b border-gray-200">
                <h5 class="text-lg font-semibold text-gray-900 mb-0">All Registered Doctors</h5>
              </div>
              <div class="p-4">
                {#if getDisplayedDoctors().length > 0}
                  <!-- Desktop Table View -->
                  <div class="hidden lg:block overflow-x-auto">
                    <table class="min-w-full divide-y divide-gray-200">
                      <thead class="bg-gray-50">
                        <tr>
                          <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                          <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                          <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                          <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                          <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Patients</th>
                          <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Token Usage</th>
                          <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                      </thead>
                      <tbody class="bg-white divide-y divide-gray-200">
                        {#each getDisplayedDoctors() as doctor (doctor.id)}
                          <tr class="hover:bg-gray-50">
                            <td class="px-4 py-4 text-sm text-gray-900 break-words max-w-xs">
                              <div class="truncate" title={doctor.email}>{doctor.email}</div>
                              <div class="text-xs text-gray-500 mt-1">ID: {formatDoctorId(doctor.id)}</div>
                            </td>
                            <td class="px-4 py-4 text-sm text-gray-900 break-words max-w-xs">
                              <div class="truncate" title={doctor.name || `${doctor.firstName || ''} ${doctor.lastName || ''}`.trim() || doctor.email || 'Unknown Doctor'}>
                                {doctor.name || `${doctor.firstName || ''} ${doctor.lastName || ''}`.trim() || doctor.email || 'Unknown Doctor'}
                              </div>
                              {#if isTrialActive(doctor)}
                                <div class="mt-1">
                                  <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-100 text-amber-700">
                                    Trial until {formatDate(doctor.accessExpiresAt)}
                                  </span>
                                </div>
                              {/if}
                              {#if doctor.externalDoctor}
                                {@const ownerDoctor = getOwnerDoctor(doctor)}
                                <div class="mt-1">
                                  <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-indigo-100 text-indigo-700">
                                    External of {ownerDoctor?.id ? formatDoctorId(ownerDoctor.id) : 'Owner'}
                                  </span>
                                </div>
                              {/if}
                              {#if doctor.referredByDoctorId}
                                {@const referrer = doctors.find(d => d.id === doctor.referredByDoctorId)}
                                <div class="mt-1">
                                  <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-blue-100 text-blue-700">
                                    Referred by {referrer?.id ? formatDoctorId(referrer.id) : formatDoctorId(doctor.referredByDoctorId)}
                                  </span>
                                </div>
                              {/if}
                              {#if isReferralBonusPending(doctor)}
                                <div class="mt-1">
                                  <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-100 text-amber-700">
                                    Referral bonus pending until {formatDate(doctor.referralEligibleAt)}
                                  </span>
                                </div>
                              {/if}
                              {#if doctor.referralBonusAppliedAt}
                                <div class="mt-1">
                                  <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-green-100 text-green-700">
                                    Referral bonus applied on {formatDate(doctor.referralBonusAppliedAt)}
                                  </span>
                                </div>
                              {/if}
                            </td>
                            <td class="px-4 py-4 text-sm text-gray-900">
                              <div class="flex flex-wrap gap-1">
                                <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-teal-100 text-teal-800">{doctor.role}</span>
                              {#if doctor.isAdmin}
                                  <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">Admin</span>
                              {/if}
                              </div>
                            </td>
                            <td class="px-4 py-4 text-sm text-gray-900">{formatDate(doctor.createdAt)}</td>
                            <td class="px-4 py-4 text-sm text-gray-900 text-center">{doctor.patientCount || 0}</td>
                            <td class="px-4 py-4 text-sm text-gray-900 min-w-0">
                              <div class="space-y-1">
                                <div class="flex items-center">
                                  <i class="fas fa-coins text-yellow-600 mr-1 flex-shrink-0"></i>
                                  <span class="font-medium truncate">${(doctor.tokenUsage?.total?.cost || 0).toFixed(4)}</span>
                                </div>
                                <div class="flex items-center text-xs text-gray-500">
                                  <i class="fas fa-hashtag text-blue-600 mr-1 flex-shrink-0"></i>
                                  <span class="truncate">{formatCompactNumber(doctor.tokenUsage?.total?.tokens || 0)} tokens</span>
                                </div>
                                <div class="flex items-center text-xs text-gray-500">
                                  <i class="fas fa-bolt text-green-600 mr-1 flex-shrink-0"></i>
                                  <span class="truncate">{doctor.tokenUsage?.total?.requests || 0} requests</span>
                                </div>
                              </div>
                            </td>
                            <td class="px-4 py-4 text-sm text-gray-900">
                              <div class="flex flex-col gap-2">
                                <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium {getDoctorStatusBadgeClass(doctor)}">
                                  {getDoctorStatusLabel(doctor)}
                                </span>
                                {#if !doctor.externalDoctor}
                                  <button
                                    class="inline-flex items-center px-2 py-1 border border-blue-300 text-blue-700 bg-white hover:bg-blue-50 text-xs font-medium rounded-lg"
                                    on:click={() => openDoctorView(doctor)}
                                  >
                                    <i class="fas fa-eye mr-1"></i>View
                                  </button>
                                  {#if isApprovalPending(doctor)}
                                    <button
                                      class="inline-flex items-center px-2 py-1 border border-amber-300 text-amber-700 bg-white hover:bg-amber-50 text-xs font-medium rounded-lg"
                                      on:click={() => approveDoctor(doctor)}
                                    >
                                      <i class="fas fa-check mr-1"></i>Approve
                                    </button>
                                  {:else}
                                    <button
                                      class="inline-flex items-center px-2 py-1 border {isEffectivelyDisabled(doctor) ? 'border-green-300 text-green-700 hover:bg-green-50' : 'border-yellow-300 text-yellow-700 hover:bg-yellow-50'} bg-white text-xs font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                                      on:click={() => toggleDoctorStatus(doctor)}
                                      disabled={!canToggleDoctor(doctor)}
                                    >
                                      <i class="fas {isEffectivelyDisabled(doctor) ? 'fa-unlock' : 'fa-ban'} mr-1"></i>
                                      {#if isOwnerDisabled(doctor)}
                                        Owner Disabled
                                      {:else if doctor.isDisabled}
                                        Enable
                                      {:else}
                                        Disable
                                      {/if}
                                    </button>
                                  {/if}
                                  {#if doctor.email !== 'senakahks@gmail.com'}
                                    <button 
                                      class="inline-flex items-center px-2 py-1 border border-red-300 text-red-700 bg-white hover:bg-red-50 text-xs font-medium rounded-lg"
                                      data-doctor-id={doctor.id}
                                      on:click={() => deleteDoctor(doctor)}
                                      title="Delete doctor and all related data"
                                    >
                                      <i class="fas fa-trash mr-1"></i>Delete
                                    </button>
                                  {:else}
                                    <span class="text-gray-500 text-xs">
                                      <i class="fas fa-shield-alt mr-1"></i>Super Admin
                                    </span>
                                  {/if}
                                {:else}
                                  <span class="text-xs text-gray-500">Managed by owner</span>
                                {/if}
                              </div>
                            </td>
                          </tr>
                        {/each}
                      </tbody>
                    </table>
                  </div>
                  
                  <!-- Mobile Card View -->
                  <div class="lg:hidden space-y-4">
                    {#each getDisplayedDoctors() as doctor (doctor.id)}
                      <div class="bg-white border border-gray-200 rounded-lg shadow-sm p-4">
                        <div class="flex flex-col space-y-3">
                          <!-- Header Row -->
                          <div class="flex justify-between items-start">
                            <div class="flex-1 min-w-0">
                              <h3 class="text-sm font-medium text-gray-900 truncate" title={doctor.email}>{doctor.email}</h3>
                              <p class="text-xs text-gray-500 truncate" title={doctor.name || `${doctor.firstName || ''} ${doctor.lastName || ''}`.trim() || doctor.email || 'Unknown Doctor'}>
                                {doctor.name || `${doctor.firstName || ''} ${doctor.lastName || ''}`.trim() || doctor.email || 'Unknown Doctor'}
                              </p>
                              {#if isTrialActive(doctor)}
                                <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-100 text-amber-700 mt-1">
                                  Trial until {formatDate(doctor.accessExpiresAt)}
                                </span>
                              {/if}
                              {#if doctor.externalDoctor}
                                {@const ownerDoctor = getOwnerDoctor(doctor)}
                                <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-indigo-100 text-indigo-700 mt-1">
                                  External of {ownerDoctor?.id ? formatDoctorId(ownerDoctor.id) : 'Owner'}
                                </span>
                              {/if}
                              {#if doctor.referredByDoctorId}
                                {@const referrer = doctors.find(d => d.id === doctor.referredByDoctorId)}
                                <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-blue-100 text-blue-700 mt-1">
                                  Referred by {referrer?.id ? formatDoctorId(referrer.id) : formatDoctorId(doctor.referredByDoctorId)}
                                </span>
                              {/if}
                              {#if isReferralBonusPending(doctor)}
                                <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-100 text-amber-700 mt-1">
                                  Referral bonus pending until {formatDate(doctor.referralEligibleAt)}
                                </span>
                              {/if}
                              {#if doctor.referralBonusAppliedAt}
                                <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-green-100 text-green-700 mt-1">
                                  Referral bonus applied on {formatDate(doctor.referralBonusAppliedAt)}
                                </span>
                              {/if}
                            </div>
                            <div class="flex flex-wrap gap-1 ml-2">
                              <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-teal-100 text-teal-800">{doctor.role}</span>
                              {#if doctor.isAdmin}
                                <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">Admin</span>
                {/if}
              </div>
            </div>
            
                          <!-- Details Grid -->
                          <div class="grid grid-cols-2 gap-3 text-xs">
                            <div>
                              <span class="text-gray-500">Created:</span>
                              <div class="font-medium text-gray-900">{formatDate(doctor.createdAt)}</div>
            </div>
                            <div>
                              <span class="text-gray-500">Patients:</span>
                              <div class="font-medium text-gray-900">{doctor.patientCount || 0}</div>
                            </div>
              </div>
              
                          <!-- Token Usage -->
                          <div class="border-t pt-3">
                            <div class="text-xs text-gray-500 mb-2">Token Usage:</div>
                            <div class="space-y-1">
                              <div class="flex items-center justify-between">
                                <div class="flex items-center">
                                  <i class="fas fa-coins text-yellow-600 mr-1"></i>
                                  <span class="text-gray-500">Cost:</span>
                    </div>
                                <span class="font-medium text-gray-900">${(doctor.tokenUsage?.total?.cost || 0).toFixed(4)}</span>
                  </div>
                              <div class="flex items-center justify-between">
                                <div class="flex items-center">
                                  <i class="fas fa-hashtag text-blue-600 mr-1"></i>
                                  <span class="text-gray-500">Tokens:</span>
                </div>
                                <span class="font-medium text-gray-900">{formatCompactNumber(doctor.tokenUsage?.total?.tokens || 0)}</span>
                    </div>
                              <div class="flex items-center justify-between">
                                <div class="flex items-center">
                                  <i class="fas fa-bolt text-green-600 mr-1"></i>
                                  <span class="text-gray-500">Requests:</span>
                  </div>
                                <span class="font-medium text-gray-900">{doctor.tokenUsage?.total?.requests || 0}</span>
                </div>
                    </div>
                  </div>

                          <div class="border-t pt-3">
                            <div class="flex items-center justify-between mb-2">
                              <span class="text-xs text-gray-500">Status:</span>
                              <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium {getDoctorStatusBadgeClass(doctor)}">
                                {getDoctorStatusLabel(doctor)}
                              </span>
                            </div>
                            {#if !doctor.externalDoctor}
                              {#if isApprovalPending(doctor)}
                                <button
                                  class="w-full inline-flex items-center justify-center px-3 py-2 border border-amber-300 text-amber-700 bg-white hover:bg-amber-50 text-sm font-medium rounded-lg"
                                  on:click={() => approveDoctor(doctor)}
                                >
                                  <i class="fas fa-check mr-2"></i>Approve
                                </button>
                              {:else}
                                <button
                                  class="w-full inline-flex items-center justify-center px-3 py-2 border {isEffectivelyDisabled(doctor) ? 'border-green-300 text-green-700 hover:bg-green-50' : 'border-yellow-300 text-yellow-700 hover:bg-yellow-50'} bg-white text-sm font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                                  on:click={() => toggleDoctorStatus(doctor)}
                                  disabled={!canToggleDoctor(doctor)}
                                >
                                  <i class="fas {isEffectivelyDisabled(doctor) ? 'fa-unlock' : 'fa-ban'} mr-2"></i>
                                  {#if isOwnerDisabled(doctor)}
                                    Owner Disabled
                                  {:else if doctor.isDisabled}
                                    Enable
                                  {:else}
                                    Disable
                                  {/if}
                                </button>
                              {/if}
                            {:else}
                              <span class="text-xs text-gray-500">Managed by owner</span>
                            {/if}
                          </div>
                          
                          <!-- Actions -->
                          <div class="border-t pt-3">
                            {#if !doctor.externalDoctor}
                              <button
                                class="w-full inline-flex items-center justify-center px-3 py-2 border border-blue-300 text-blue-700 bg-white hover:bg-blue-50 text-sm font-medium rounded-lg mb-2"
                                on:click={() => openDoctorView(doctor)}
                              >
                                <i class="fas fa-eye mr-2"></i>View
                              </button>
                              {#if doctor.email !== 'senakahks@gmail.com'}
                                <button 
                                  class="w-full inline-flex items-center justify-center px-3 py-2 border border-red-300 text-red-700 bg-white hover:bg-red-50 text-sm font-medium rounded-lg"
                                  data-doctor-id={doctor.id}
                                  on:click={() => deleteDoctor(doctor)}
                                  title="Delete doctor and all related data"
                                >
                                  <i class="fas fa-trash mr-2"></i>Delete Doctor
                                </button>
                              {:else}
                                <div class="text-center text-gray-500 text-sm">
                                  <i class="fas fa-shield-alt mr-1"></i>Super Admin - Protected
                                </div>
                              {/if}
                            {:else}
                              <div class="text-center text-gray-500 text-sm">Managed by owner</div>
                            {/if}
                          </div>
                  </div>
                      </div>
                    {/each}
                  </div>
                {:else}
                  <p class="text-gray-500 text-center py-8">No doctors registered yet.</p>
                {/if}
                </div>
              </div>
              
          <!-- Patients tab removed for HIPAA compliance -->
          <!-- Admins should not have access to patient PHI data -->
          <!-- Patient data access is restricted to individual doctors only -->
          {:else if activeTab === 'ai-usage'}
            <!-- AI Usage Tab -->
            <div class="flex justify-between items-center mb-6">
              <h2 class="text-2xl font-bold text-gray-900"><i class="fas fa-brain mr-2 text-red-600"></i>AI Usage Analytics</h2>
              <button class="inline-flex items-center px-3 py-2 border border-red-300 text-red-700 bg-white hover:bg-red-50 text-sm font-medium rounded-lg focus:outline-none focus:ring-4 focus:ring-red-300 focus:ring-offset-2 dark:bg-white dark:text-red-700 dark:border-red-300 dark:hover:bg-red-50 transition-all duration-200" on:click={loadAIUsageStats}>
                <i class="fas fa-sync-alt mr-2"></i>Refresh
              </button>
                    </div>
            
            {#if aiUsageStats}
              <!-- Cost Disclaimer -->
              <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6" role="alert">
                <i class="fas fa-exclamation-triangle mr-2 text-yellow-600"></i>
                <strong class="text-yellow-800">Cost Disclaimer:</strong> <span class="text-yellow-700">These cost estimates are approximate and may not reflect actual OpenAI billing. 
                Actual costs may be higher due to taxes, fees, or pricing changes. 
                Check your <a href="https://platform.openai.com/usage" target="_blank" class="text-yellow-600 hover:text-yellow-800 underline">OpenAI dashboard</a> for exact billing amounts.</span>
                  </div>
              
              <!-- Usage Overview Cards -->
              <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
                <div class="bg-white border-2 border-teal-200 rounded-lg shadow-sm p-4 text-center">
                  <h6 class="text-teal-600 font-semibold mb-2">
                    <i class="fas fa-coins mr-1"></i>Total Cost
                  </h6>
                  <h5 class="text-teal-600 text-xl font-bold mb-1">${aiUsageStats.total.cost.toFixed(4)}</h5>
                  <small class="text-gray-500">All Time</small>
                </div>
                <div class="bg-white border-2 border-teal-200 rounded-lg shadow-sm p-4 text-center">
                  <h6 class="text-teal-600 font-semibold mb-2">
                    <i class="fas fa-hashtag mr-1"></i>Total Tokens
                  </h6>
                  <h5 class="text-teal-600 text-xl font-bold mb-1">{formatCompactNumber(aiUsageStats.total.tokens)}</h5>
                  <small class="text-gray-500">All Time</small>
                    </div>
                <div class="bg-white border-2 border-teal-200 rounded-lg shadow-sm p-4 text-center">
                  <h6 class="text-teal-600 font-semibold mb-2">
                    <i class="fas fa-bolt mr-1"></i>Total Requests
                  </h6>
                  <h5 class="text-teal-600 text-xl font-bold mb-1">{aiUsageStats.total.requests}</h5>
                  <small class="text-gray-500">All Time</small>
                  </div>
                <div class="bg-white border-2 border-yellow-200 rounded-lg shadow-sm p-4 text-center">
                  <h6 class="text-yellow-600 font-semibold mb-2">
                    <i class="fas fa-calendar-day mr-1"></i>Today
                  </h6>
                  <h5 class="text-yellow-600 text-xl font-bold mb-1">${aiUsageStats.today.cost.toFixed(4)}</h5>
                  <small class="text-gray-500">{aiUsageStats.today.requests} requests</small>
                </div>
                <div class="bg-white border-2 border-teal-200 rounded-lg shadow-sm p-4 text-center">
                  <h6 class="text-teal-600 font-semibold mb-2">
                    <i class="fas fa-calendar-alt mr-1"></i>This Month
                  </h6>
                  <h5 class="text-teal-600 text-xl font-bold mb-1">${aiUsageStats.thisMonth.cost.toFixed(4)}</h5>
                  <small class="text-gray-500">{aiUsageStats.thisMonth.requests} requests</small>
                    </div>
                <div class="bg-white border-2 border-teal-200 rounded-lg shadow-sm p-4 text-center">
                  <h6 class="text-teal-600 font-semibold mb-2">
                    <i class="fas fa-percentage mr-1"></i>Avg Cost/Request
                  </h6>
                  <h5 class="text-teal-600 text-xl font-bold mb-1">${aiUsageStats.total.requests > 0 ? (aiUsageStats.total.cost / aiUsageStats.total.requests).toFixed(4) : '0.0000'}</h5>
                  <small class="text-gray-500">All Time Average</small>
                  </div>
                  </div>
              
              <!-- Last Updated Card -->
              <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div class="bg-white border-2 border-teal-200 rounded-lg shadow-sm p-4 text-center">
                  <h6 class="text-teal-600 font-semibold mb-2">
                    <i class="fas fa-clock mr-1"></i>Last Updated
                  </h6>
                  <h6 class="text-teal-600 text-lg font-bold mb-1">{aiUsageStats.lastUpdated ? new Date(aiUsageStats.lastUpdated).toLocaleString() : 'Never'}</h6>
                  <small class="text-gray-500">Usage Data</small>
                </div>
              </div>
              
              <!-- Daily Usage Chart -->
              <div class="mb-6">
                <div class="bg-white border border-gray-200 rounded-lg shadow-sm">
                  <div class="bg-gray-50 px-4 py-3 border-b border-gray-200">
                    <h5 class="text-lg font-semibold text-gray-900 mb-0">
                      <i class="fas fa-chart-line mr-2"></i>Daily Usage (Last 7 Days)
                      </h5>
                    </div>
                  <div class="p-4">
                      <div class="overflow-x-auto">
                        <table class="min-w-full divide-y divide-gray-200">
                          <thead class="bg-gray-50">
                            <tr>
                              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Requests</th>
                              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tokens</th>
                              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cost</th>
                            </tr>
                          </thead>
                          <tbody class="bg-white divide-y divide-gray-200">
                            {#each aiTokenTracker.getWeeklyUsage() as day}
                              <tr class="hover:bg-gray-50">
                                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{new Date(day.date).toLocaleDateString('en-GB', {
                                  day: '2-digit',
                                  month: '2-digit',
                                  year: 'numeric'
                                })}</td>
                                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{day.requests || 0}</td>
                                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{formatCompactNumber(day.tokens || 0)}</td>
                                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${(day.cost || 0).toFixed(4)}</td>
                              </tr>
                            {/each}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
              
              <!-- Monthly Usage Chart -->
              <div class="mb-6">
                <div class="bg-white border border-gray-200 rounded-lg shadow-sm">
                  <div class="bg-gray-50 px-4 py-3 border-b border-gray-200">
                    <h5 class="text-lg font-semibold text-gray-900 mb-0">
                      <i class="fas fa-chart-bar mr-2"></i>Monthly Usage (Last 6 Months)
                      </h5>
                    </div>
                  <div class="p-4">
                    <div class="overflow-x-auto">
                      <table class="min-w-full divide-y divide-gray-200">
                        <thead class="bg-gray-50">
                          <tr>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Month</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Requests</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tokens</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cost</th>
                            </tr>
                          </thead>
                        <tbody class="bg-white divide-y divide-gray-200">
                            {#each aiTokenTracker.getMonthlyUsage() as month}
                            <tr class="hover:bg-gray-50">
                              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{new Date(month.month + '-01').toLocaleDateString('en-US', { year: 'numeric', month: 'long' })}</td>
                              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{month.requests || 0}</td>
                              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{formatCompactNumber(month.tokens || 0)}</td>
                              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${(month.cost || 0).toFixed(4)}</td>
                              </tr>
                            {/each}
                          </tbody>
                        </table>
                    </div>
                  </div>
                </div>
              </div>
              
              <!-- Recent Requests -->
              <div class="mb-6">
                <div class="bg-white border border-gray-200 rounded-lg shadow-sm">
                  <div class="bg-gray-50 px-4 py-3 border-b border-gray-200">
                    <h5 class="text-lg font-semibold text-gray-900 mb-0">
                      <i class="fas fa-history mr-2 text-red-600"></i>Recent AI Requests
                      </h5>
                    </div>
                  <div class="p-4">
                    <div class="overflow-x-auto">
                      <table class="min-w-full divide-y divide-gray-200">
                        <thead class="bg-gray-50">
                          <tr>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tokens</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cost</th>
                            </tr>
                          </thead>
                        <tbody class="bg-white divide-y divide-gray-200">
                            {#each aiTokenTracker.getRecentRequests(10) as request}
                            <tr class="hover:bg-gray-50">
                              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{new Date(request.timestamp).toLocaleString()}</td>
                              <td class="px-6 py-4 whitespace-nowrap">
                                <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-teal-100 text-teal-800">
                                    {request.type.replace('generate', '').replace('check', '')}
                                  </span>
                                </td>
                              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{request.totalTokens.toLocaleString()}</td>
                              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${request.cost.toFixed(4)}</td>
                              </tr>
                            {:else}
                              <tr>
                              <td colspan="4" class="px-6 py-4 text-center text-gray-500">
                                <i class="fas fa-info-circle mr-2"></i>
                                  No recent AI requests found
                                </td>
                              </tr>
                            {/each}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
              
              <!-- AI Configuration Section -->
              <div class="mb-6">
                <div class="bg-white border border-gray-200 rounded-lg shadow-sm">
                  <div class="bg-gray-50 px-4 py-3 border-b border-gray-200">
                    <h5 class="text-lg font-semibold text-gray-900 mb-0">
                      <i class="fas fa-cog mr-2 text-red-600"></i>AI Configuration
                    </h5>
              </div>
                  <div class="p-4">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <!-- Default Quota Configuration -->
                      <div class="bg-gray-50 border border-gray-200 rounded-lg p-4">
                        <h6 class="text-lg font-semibold text-gray-900 mb-3">
                          <i class="fas fa-users mr-2 text-teal-600"></i>Default Quota
                        </h6>
                        <p class="text-sm text-gray-600 mb-4">
                          Set the default monthly token quota for all doctors. This will be applied to new doctors and can be used to update existing doctors.
                        </p>
                        <div class="space-y-3">
                          <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">
                              Monthly Token Quota:
                            </label>
                            <input
                              type="number"
                              bind:value={defaultQuotaInput}
                              placeholder="Enter default quota"
                              class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                              min="0"
                              step="1000"
                            />
                            <p class="text-xs text-gray-500 mt-1">
                              Current: {aiTokenTracker.getDefaultQuota().toLocaleString()} tokens
                            </p>
            </div>
                          <div class="flex space-x-2">
                            <button
                              class="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors duration-200"
                              on:click={saveDefaultQuota}
                              disabled={!defaultQuotaInput || defaultQuotaInput < 0}
                            >
                              <i class="fas fa-save mr-1"></i>Save Default
                            </button>
                            <button
                              class="px-4 py-2 text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 rounded-lg transition-colors duration-200"
                              on:click={applyDefaultQuotaToAll}
                            >
                              <i class="fas fa-user-plus mr-1"></i>Apply to All
                            </button>
                          </div>
                        </div>
                      </div>
                      
                      <!-- Token Pricing Configuration -->
                      <div class="bg-gray-50 border border-gray-200 rounded-lg p-4">
                        <h6 class="text-lg font-semibold text-gray-900 mb-3">
                          <i class="fas fa-dollar-sign mr-2 text-teal-600"></i>Token Pricing
                        </h6>
                        <p class="text-sm text-gray-600 mb-4">
                          Set the cost per 1 million tokens. This affects cost calculations and estimates throughout the system.
                        </p>
                        <div class="space-y-3">
                          <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">
                              Price per 1M Tokens (USD):
                            </label>
                            <input
                              type="number"
                              bind:value={tokenPriceInput}
                              placeholder="Enter price per million tokens"
                              class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                              min="0"
                              step="0.01"
                            />
                            <p class="text-xs text-gray-500 mt-1">
                              Current: ${aiTokenTracker.getTokenPricePerMillion().toFixed(2)} per 1M tokens
                            </p>
                          </div>
                          <div class="flex space-x-2">
                            <button
                              class="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors duration-200"
                              on:click={saveTokenPrice}
                              disabled={!tokenPriceInput || tokenPriceInput < 0}
                            >
                              <i class="fas fa-save mr-1"></i>Save Price
                            </button>
                            <button
                              class="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors duration-200"
                              on:click={refreshCostEstimates}
                            >
                              <i class="fas fa-sync-alt mr-1"></i>Refresh Costs
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              <!-- Doctor Token Quotas Section -->
              <div class="mb-6">
                <div class="bg-white border border-gray-200 rounded-lg shadow-sm">
                  <div class="bg-gray-50 px-4 py-3 border-b border-gray-200">
                    <h5 class="text-lg font-semibold text-gray-900 mb-0">
                      <i class="fas fa-user-md mr-2 text-red-600"></i>Doctor Token Quotas
                    </h5>
                  </div>
                  <div class="p-4">
                    <!-- Desktop Table View -->
                    <div class="hidden lg:block overflow-x-auto">
                      <table class="min-w-full divide-y divide-gray-200">
                        <thead class="bg-gray-50">
                          <tr>
                            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Doctor Name</th>
                            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Monthly Quota</th>
                            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Used This Month</th>
                            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Remaining</th>
                            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                          </tr>
                        </thead>
                        <tbody class="bg-white divide-y divide-gray-200">
                          {#each aiTokenTracker.getAllDoctorsWithQuotas() as doctor}
                            <tr class="hover:bg-gray-50">
                              <td class="px-4 py-4 text-sm text-gray-900 break-words max-w-xs">
                                <div class="font-medium text-gray-900 truncate" title={getDoctorName(doctor.doctorId)}>{getDoctorName(doctor.doctorId)}</div>
                                <div class="text-xs text-gray-500 truncate" title={doctor.doctorId}>ID: {formatDoctorId(doctor.doctorId)}</div>
                              </td>
                              <td class="px-4 py-4 text-sm text-gray-900">
                                {#if doctor.quota}
                                  <div class="truncate">{doctor.quota.monthlyTokens.toLocaleString()} tokens</div>
                                {:else}
                                  <span class="text-gray-400">No quota set</span>
                                {/if}
                              </td>
                              <td class="px-4 py-4 text-sm text-gray-900">
                                <div class="truncate">{doctor.monthlyUsage.tokens.toLocaleString()} tokens</div>
                                <div class="text-xs text-gray-500 truncate">${doctor.monthlyUsage.cost.toFixed(4)}</div>
                              </td>
                              <td class="px-4 py-4 text-sm text-gray-900">
                                {#if doctor.quotaStatus.hasQuota}
                                  <div class="truncate">{doctor.quotaStatus.remainingTokens.toLocaleString()} tokens</div>
                                {:else}
                                  <span class="text-gray-400">-</span>
                                {/if}
                              </td>
                              <td class="px-4 py-4 text-sm text-gray-900">
                                <div class="flex flex-col space-y-1">
                                  {#if doctor.quotaStatus.hasQuota}
                                    {#if doctor.quotaStatus.isExceeded}
                                      <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                        <i class="fas fa-exclamation-triangle mr-1"></i>Exceeded
                                      </span>
                                    {:else if doctor.quotaStatus.percentageUsed > 80}
                                      <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                                        <i class="fas fa-exclamation-circle mr-1"></i>Warning
                                      </span>
                                    {:else}
                                      <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                        <i class="fas fa-check-circle mr-1"></i>Good
                                      </span>
                                    {/if}
                                    <div class="text-xs text-gray-500">{doctor.quotaStatus.percentageUsed.toFixed(1)}% used</div>
                                  {:else}
                                    <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                      No Quota
                                    </span>
                                  {/if}
                                </div>
                              </td>
                              <td class="px-4 py-4 text-sm text-gray-900">
                                <button 
                                  class="text-red-600 hover:text-red-900 font-medium text-xs"
                                  on:click={() => openQuotaModal(doctor.doctorId, doctor.quota?.monthlyTokens || 0)}
                                >
                                  <i class="fas fa-edit mr-1"></i>Set Quota
                                </button>
                              </td>
                            </tr>
                          {:else}
                            <tr>
                              <td colspan="6" class="px-6 py-4 text-center text-gray-500">
                                <i class="fas fa-info-circle mr-2"></i>
                                No doctors with AI usage found
                              </td>
                            </tr>
                          {/each}
                        </tbody>
                      </table>
                    </div>
                    
                    <!-- Mobile Card View -->
                    <div class="lg:hidden space-y-4">
                      {#each aiTokenTracker.getAllDoctorsWithQuotas() as doctor}
                        <div class="bg-white border border-gray-200 rounded-lg shadow-sm p-4">
                          <div class="flex flex-col space-y-3">
                            <!-- Header Row -->
                            <div class="flex justify-between items-start">
                              <div class="flex-1 min-w-0">
                                <h3 class="text-sm font-medium text-gray-900 truncate" title={getDoctorName(doctor.doctorId)}>{getDoctorName(doctor.doctorId)}</h3>
                                <p class="text-xs text-gray-500 truncate" title={doctor.doctorId}>ID: {formatDoctorId(doctor.doctorId)}</p>
                              </div>
                              <div class="ml-2">
                                {#if doctor.quotaStatus.hasQuota}
                                  {#if doctor.quotaStatus.isExceeded}
                                    <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                      <i class="fas fa-exclamation-triangle mr-1"></i>Exceeded
                                    </span>
                                  {:else if doctor.quotaStatus.percentageUsed > 80}
                                    <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                                      <i class="fas fa-exclamation-circle mr-1"></i>Warning
                                    </span>
                                  {:else}
                                    <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                      <i class="fas fa-check-circle mr-1"></i>Good
                                    </span>
                                  {/if}
                                {:else}
                                  <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                    No Quota
                                  </span>
                                {/if}
                              </div>
                            </div>
                            
                            <!-- Quota Details -->
                            <div class="grid grid-cols-2 gap-3 text-xs">
                              <div>
                                <span class="text-gray-500">Monthly Quota:</span>
                                <div class="font-medium text-gray-900">
                                  {#if doctor.quota}
                                    {doctor.quota.monthlyTokens.toLocaleString()} tokens
                                  {:else}
                                    <span class="text-gray-400">No quota set</span>
                                  {/if}
                                </div>
                              </div>
                              <div>
                                <span class="text-gray-500">Used This Month:</span>
                                <div class="font-medium text-gray-900">{doctor.monthlyUsage.tokens.toLocaleString()} tokens</div>
                                <div class="text-gray-500">${doctor.monthlyUsage.cost.toFixed(4)}</div>
                              </div>
                            </div>
                            
                            <!-- Remaining and Percentage -->
                            <div class="grid grid-cols-2 gap-3 text-xs">
                              <div>
                                <span class="text-gray-500">Remaining:</span>
                                <div class="font-medium text-gray-900">
                                  {#if doctor.quotaStatus.hasQuota}
                                    {doctor.quotaStatus.remainingTokens.toLocaleString()} tokens
                                  {:else}
                                    <span class="text-gray-400">-</span>
                                  {/if}
                                </div>
                              </div>
                              <div>
                                <span class="text-gray-500">Usage:</span>
                                <div class="font-medium text-gray-900">
                                  {#if doctor.quotaStatus.hasQuota}
                                    {doctor.quotaStatus.percentageUsed.toFixed(1)}% used
                                  {:else}
                                    <span class="text-gray-400">-</span>
                                  {/if}
                                </div>
                              </div>
                            </div>
                            
                            <!-- Actions -->
                            <div class="border-t pt-3">
                              <button 
                                class="w-full inline-flex items-center justify-center px-3 py-2 border border-red-300 text-red-700 bg-white hover:bg-red-50 text-sm font-medium rounded-lg"
                                on:click={() => openQuotaModal(doctor.doctorId, doctor.quota?.monthlyTokens || 0)}
                              >
                                <i class="fas fa-edit mr-2"></i>Set Quota
                              </button>
                            </div>
                          </div>
                        </div>
                      {:else}
                        <div class="text-center py-8 text-gray-500">
                          <i class="fas fa-info-circle mr-2"></i>
                          No doctors with AI usage found
                        </div>
                      {/each}
                    </div>
                  </div>
                </div>
              </div>
            {:else}
              <div class="bg-white border border-gray-200 rounded-lg shadow-sm">
                <div class="text-center py-8">
                  <i class="fas fa-brain text-4xl text-gray-400 mb-3"></i>
                  <h5 class="text-gray-500">No AI Usage Data Available</h5>
                  <p class="text-gray-500 mb-6">AI usage statistics will appear here once AI features are used.</p>
                  <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <i class="fas fa-info-circle mr-2 text-blue-600"></i>
                    <strong class="text-blue-800">Getting Started:</strong> <span class="text-blue-700">AI usage tracking begins when doctors use AI features like:</span>
                    <ul class="list-disc list-inside mt-2 text-sm text-blue-700">
                      <li><i class="fas fa-check text-teal-600 mr-1"></i> AI Medical Analysis</li>
                      <li><i class="fas fa-check text-teal-600 mr-1"></i> AI Drug Suggestions</li>
                      <li><i class="fas fa-check text-teal-600 mr-1"></i> AI Chat Assistant</li>
                    </ul>
                  </div>
                </div>
              </div>
            {/if}
            
          {:else if activeTab === 'ai-logs'}
            <!-- AI Logs Tab -->
            <div class="flex justify-between items-center mb-6">
              <h2 class="text-2xl font-bold text-gray-900"><i class="fas fa-brain mr-2 text-red-600"></i>AI Prompt Logs</h2>
            </div>
            
            <AIPromptLogs />
            
          {:else if activeTab === 'logs'}
            <!-- Logs Tab -->
            <div class="flex justify-between items-center mb-6">
              <h2 class="text-2xl font-bold text-gray-900"><i class="fas fa-clipboard-list mr-2 text-red-600"></i>System Logs</h2>
            </div>
            
            <div class="bg-white border border-gray-200 rounded-lg shadow-sm">
              <div class="border-b border-gray-200">
                <div class="flex">
                  <button
                    class="px-4 py-2 text-sm font-medium border-b-2 {logView === 'email' ? 'border-red-500 text-red-700' : 'border-transparent text-gray-600 hover:text-gray-800'}"
                    on:click={() => logView = 'email'}
                  >
                    Email Logs
                  </button>
                  <button
                    class="px-4 py-2 text-sm font-medium border-b-2 {logView === 'auth' ? 'border-red-500 text-red-700' : 'border-transparent text-gray-600 hover:text-gray-800'}"
                    on:click={() => logView = 'auth'}
                  >
                    Login/Logout Logs
                  </button>
                </div>
              </div>
              <div class="p-4">
                {#if logView === 'email'}
                  <div class="flex items-center justify-between mb-4">
                    <p class="text-sm text-gray-600">Email send confirmations (latest 200).</p>
                    <div class="flex items-center gap-2">
                      <button
                        class="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-lg text-white bg-teal-600 hover:bg-teal-700 disabled:opacity-60"
                        on:click={loadEmailLogs}
                        disabled={emailLogsLoading}
                      >
                        <i class="fas fa-sync-alt mr-2"></i>Refresh
                      </button>
                      <button
                        class="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-lg text-white bg-red-600 hover:bg-red-700 disabled:opacity-60"
                        on:click={() => {
                          pendingAction = clearEmailLogs
                          showConfirmation(
                            'Clear Email Logs',
                            'Delete all email logs?',
                            'Delete',
                            'Cancel',
                            'danger'
                          )
                        }}
                      >
                        <i class="fas fa-trash mr-2"></i>Clear Logs
                      </button>
                    </div>
                  </div>
                  {#if emailLogsError}
                    <p class="text-sm text-red-600 mb-3">{emailLogsError}</p>
                  {/if}
                  {#if emailLogsLoading}
                    <p class="text-sm text-gray-500">Loading logs...</p>
                  {:else if emailLogs.length === 0}
                    <p class="text-sm text-gray-500">No email logs yet.</p>
                  {:else}
                    <div class="overflow-x-auto">
                      <table class="min-w-full divide-y divide-gray-200 text-sm">
                        <thead class="bg-gray-50">
                          <tr>
                            <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time</th>
                            <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                            <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                            <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">To</th>
                            <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Doctor ID</th>
                            <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Error</th>
                          </tr>
                        </thead>
                        <tbody class="bg-white divide-y divide-gray-200">
                          {#each emailLogs as log (log.id)}
                            <tr>
                              <td class="px-3 py-2 text-gray-900">{formatDateTime(log.createdAt)}</td>
                              <td class="px-3 py-2 text-gray-700">{log.type || '-'}</td>
                              <td class="px-3 py-2">
                                <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium {log.status === 'sent' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}">
                                  {log.status || 'unknown'}
                                </span>
                              </td>
                              <td class="px-3 py-2 text-gray-700">{log.to || '-'}</td>
                              <td class="px-3 py-2 text-gray-700" title={log.doctorId || ''}>
                                {log.doctorId ? formatDoctorId(log.doctorId) : '-'}
                              </td>
                              <td class="px-3 py-2 text-gray-500 text-xs">{log.error || '-'}</td>
                            </tr>
                          {/each}
                        </tbody>
                      </table>
                    </div>
                  {/if}
                {:else}
                  <div class="flex items-center justify-between mb-4">
                    <p class="text-sm text-gray-600">Authentication events (latest 200).</p>
                    <button
                      class="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-lg text-white bg-teal-600 hover:bg-teal-700 disabled:opacity-60"
                      on:click={loadAuthLogs}
                      disabled={authLogsLoading}
                    >
                      <i class="fas fa-sync-alt mr-2"></i>Refresh
                    </button>
                  </div>
                  {#if authLogsError}
                    <p class="text-sm text-red-600 mb-3">{authLogsError}</p>
                  {/if}
                  {#if authLogsLoading}
                    <p class="text-sm text-gray-500">Loading logs...</p>
                  {:else if authLogs.length === 0}
                    <p class="text-sm text-gray-500">No login/logout logs yet.</p>
                  {:else}
                    <div class="overflow-x-auto">
                      <table class="min-w-full divide-y divide-gray-200 text-sm">
                        <thead class="bg-gray-50">
                          <tr>
                            <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time</th>
                            <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                            <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                            <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                            <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Doctor ID</th>
                          </tr>
                        </thead>
                        <tbody class="bg-white divide-y divide-gray-200">
                          {#each authLogs as log (log.id)}
                            <tr>
                              <td class="px-3 py-2 text-gray-900">{formatDateTime(log.createdAt)}</td>
                              <td class="px-3 py-2 text-gray-700">{log.action || '-'}</td>
                              <td class="px-3 py-2 text-gray-700">{log.role || '-'}</td>
                              <td class="px-3 py-2 text-gray-700">{log.email || '-'}</td>
                              <td class="px-3 py-2 text-gray-700" title={log.doctorId || ''}>
                                {log.doctorId ? formatDoctorId(log.doctorId) : '-'}
                              </td>
                            </tr>
                          {/each}
                        </tbody>
                      </table>
                    </div>
                  {/if}
                {/if}
              </div>
            </div>
          {:else if activeTab === 'payments'}
            <!-- Payments Tab -->
            <div class="flex justify-between items-center mb-6">
              <h2 class="text-2xl font-bold text-gray-900"><i class="fas fa-credit-card mr-2 text-red-600"></i>Payments</h2>
            </div>
            <div class="bg-white border border-gray-200 rounded-lg shadow-sm">
              <div class="bg-gray-50 px-4 py-3 border-b border-gray-200">
                <h5 class="text-lg font-semibold text-gray-900 mb-0">Payments</h5>
              </div>
              <div class="p-4">
                <p class="text-sm text-gray-600">Payments dashboard coming soon.</p>
              </div>
            </div>
          {:else if activeTab === 'promotions'}
            <!-- Promotions Tab -->
            <div class="flex justify-between items-center mb-6">
              <h2 class="text-2xl font-bold text-gray-900"><i class="fas fa-bullhorn mr-2 text-red-600"></i>Promotions</h2>
            </div>
            <div class="bg-white border border-gray-200 rounded-lg shadow-sm">
              <div class="bg-gray-50 px-4 py-3 border-b border-gray-200">
                <h5 class="text-lg font-semibold text-gray-900 mb-0">Promotions</h5>
              </div>
              <div class="p-4">
                <p class="text-sm text-gray-600">Promotions dashboard coming soon.</p>
              </div>
            </div>
          {:else if activeTab === 'messaging'}
            <!-- Messaging Tab -->
            <div class="flex justify-between items-center mb-6">
              <h2 class="text-2xl font-bold text-gray-900"><i class="fas fa-comment-dots mr-2 text-red-600"></i>Messaging</h2>
            </div>
            <div class="flex items-center gap-2 mb-4">
              <button
                class={`px-4 py-2 text-sm font-medium rounded-lg border transition-colors ${
                  messagingTab === 'templates'
                    ? 'bg-red-600 text-white border-red-600'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
                on:click={() => (messagingTab = 'templates')}
              >
                Templates
              </button>
              <button
                class={`px-4 py-2 text-sm font-medium rounded-lg border transition-colors ${
                  messagingTab === 'whatsapp'
                    ? 'bg-red-600 text-white border-red-600'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
                on:click={() => (messagingTab = 'whatsapp')}
              >
                Whatsapp
              </button>
              <button
                class={`px-4 py-2 text-sm font-medium rounded-lg border transition-colors ${
                  messagingTab === 'sms'
                    ? 'bg-red-600 text-white border-red-600'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
                on:click={() => (messagingTab = 'sms')}
              >
                SMS
              </button>
            </div>
            <div class="bg-white border border-gray-200 rounded-lg shadow-sm p-6 space-y-5">
              {#if messagingTab === 'templates'}
                <div class="rounded-lg border border-blue-200 bg-blue-50 p-4">
                  <p class="text-sm text-blue-900 font-semibold mb-1">Message Templates</p>
                  <p class="text-sm text-blue-800">
                    Use placeholders like &#123;&#123;name&#125;&#125;, &#123;&#123;doctorName&#125;&#125;, &#123;&#123;patientShortId&#125;&#125;, &#123;&#123;date&#125;&#125;, &#123;&#123;time&#125;&#125;.
                  </p>
                </div>
                {#if messagingTemplatesLoading}
                  <p class="text-sm text-gray-500">Loading templates...</p>
                {:else}
                  <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div class="border border-gray-200 rounded-lg p-4 space-y-3">
                    <div class="flex items-center gap-2">
                      <i class="fas fa-user-plus text-red-600"></i>
                      <p class="text-sm font-semibold text-gray-800">Registration</p>
                    </div>
                    <div>
                      <label class="block text-xs text-gray-500 mb-1" for="registrationChannel">Channel</label>
                      <select
                        id="registrationChannel"
                        class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-200 focus:border-red-400"
                        bind:value={registrationChannel}
                      >
                        <option value="sms">SMS</option>
                        <option value="whatsapp">WhatsApp</option>
                        <option value="both">Both</option>
                      </select>
                    </div>
                    <div class="flex items-center gap-2">
                      <input
                        id="registrationTemplateEnabled"
                        type="checkbox"
                        bind:checked={registrationTemplateEnabled}
                        class="h-4 w-4 text-red-600 border-gray-300 rounded"
                      />
                      <label for="registrationTemplateEnabled" class="text-sm text-gray-700">
                        Enable registration messages
                      </label>
                    </div>
                    <label class="block text-xs text-gray-500">Template</label>
                    <textarea
                      class="w-full min-h-[140px] px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-200 focus:border-red-400"
                      bind:value={registrationTemplate}
                    ></textarea>
                    <p class="text-xs text-gray-500">Suggested placeholders: &#123;&#123;name&#125;&#125;, &#123;&#123;doctorName&#125;&#125;, &#123;&#123;patientShortId&#125;&#125;, &#123;&#123;appUrl&#125;&#125;</p>
                  </div>
                  <div class="border border-gray-200 rounded-lg p-4 space-y-3">
                    <div class="flex items-center gap-2">
                      <i class="fas fa-bell text-red-600"></i>
                      <p class="text-sm font-semibold text-gray-800">Appointment Reminder</p>
                    </div>
                    <div>
                      <label class="block text-xs text-gray-500 mb-1" for="appointmentChannel">Channel</label>
                      <select
                        id="appointmentChannel"
                        class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-200 focus:border-red-400"
                        bind:value={appointmentReminderChannel}
                      >
                        <option value="sms">SMS</option>
                        <option value="whatsapp">WhatsApp</option>
                        <option value="both">Both</option>
                      </select>
                    </div>
                    <div class="flex items-center gap-2">
                      <input
                        id="appointmentReminderEnabled"
                        type="checkbox"
                        bind:checked={appointmentReminderTemplateEnabled}
                        class="h-4 w-4 text-red-600 border-gray-300 rounded"
                      />
                      <label for="appointmentReminderEnabled" class="text-sm text-gray-700">
                        Enable appointment reminders
                      </label>
                    </div>
                    <label class="block text-xs text-gray-500">Template</label>
                    <textarea
                      class="w-full min-h-[140px] px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-200 focus:border-red-400"
                      bind:value={appointmentReminderTemplate}
                    ></textarea>
                    <p class="text-xs text-gray-500">Suggested placeholders: &#123;&#123;doctorName&#125;&#125;, &#123;&#123;patientShortId&#125;&#125;, &#123;&#123;date&#125;&#125;, &#123;&#123;time&#125;&#125;</p>
                  </div>
                </div>
                <div class="flex items-center gap-3">
                  <button
                    class="inline-flex items-center px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors duration-200 disabled:opacity-50"
                    on:click={saveMessagingTemplates}
                    disabled={messagingTemplatesSaving}
                  >
                    {#if messagingTemplatesSaving}
                      <i class="fas fa-spinner fa-spin mr-2"></i>Saving...
                    {:else}
                      <i class="fas fa-save mr-2"></i>Save Templates
                    {/if}
                  </button>
                  {#if messagingTemplatesStatus}
                    <span class="text-sm text-gray-600">{messagingTemplatesStatus}</span>
                  {/if}
                </div>
                {/if}
              {:else if messagingTab === 'whatsapp'}
                <div class="rounded-lg border border-blue-200 bg-blue-50 p-4">
                  <p class="text-sm text-blue-900 font-semibold mb-1">Twilio WhatsApp (Welcome Message)</p>
                  <p class="text-sm text-blue-800">
                    Store credentials in Firebase Secrets. Do not paste the Auth Token in the UI.
                  </p>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Test Number</label>
                    <input
                      type="text"
                      class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-200 focus:border-red-400"
                      bind:value={whatsappTestNumber}
                      placeholder="whatsapp:+14155238886"
                    />
                  </div>
                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Message</label>
                    <input
                      type="text"
                      class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-200 focus:border-red-400"
                      bind:value={whatsappTestMessage}
                      placeholder="Welcome to M-Prescribe!"
                    />
                  </div>
                </div>
                <div class="flex items-center gap-3">
                  <button
                    class="inline-flex items-center px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 transition-colors duration-200 disabled:opacity-50"
                    on:click={testWhatsappWelcome}
                    disabled={whatsappTestRunning}
                  >
                    {#if whatsappTestRunning}
                      <i class="fas fa-spinner fa-spin mr-2"></i>Sending...
                    {:else}
                      <i class="fas fa-paper-plane mr-2"></i>Send Test WhatsApp
                    {/if}
                  </button>
                  {#if whatsappTestStatus}
                    <span class="text-sm text-gray-600">{whatsappTestStatus}</span>
                  {/if}
                </div>
                <div>
                  <p class="text-sm font-semibold text-gray-700 mb-2">Secrets (CLI)</p>
                  <pre class="bg-gray-900 text-gray-100 text-xs rounded-lg p-4 overflow-x-auto"><code>firebase functions:secrets:set TWILIO_ACCOUNT_SID
firebase functions:secrets:set TWILIO_AUTH_TOKEN
firebase functions:secrets:set TWILIO_WHATSAPP_FROM</code></pre>
                </div>
                <div>
                  <p class="text-sm font-semibold text-gray-700 mb-2">Sample Node.js (Cloud Function)</p>
                  <pre class="bg-gray-900 text-gray-100 text-xs rounded-lg p-4 overflow-x-auto"><code>const functions = require('firebase-functions');
const twilio = require('twilio');

exports.sendWelcomeWhatsapp = functions
  .runWith(&#123;
    secrets: ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_WHATSAPP_FROM']
  &#125;)
  .https.onCall(async (data) =&gt; &#123;
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const from = process.env.TWILIO_WHATSAPP_FROM; // e.g. whatsapp:+14155238886

    const client = twilio(accountSid, authToken);
    const to = data?.to; // e.g. whatsapp:+642041210342
    const body = data?.body || 'Welcome to M-Prescribe!';

    if (!to) &#123;
      throw new functions.https.HttpsError('invalid-argument', 'Recipient is required.');
    &#125;

    const message = await client.messages.create(&#123; body, from, to &#125;);
    return &#123; sid: message.sid &#125;;
  &#125;);</code></pre>
                </div>
                <div>
                  <p class="text-sm font-semibold text-gray-700 mb-2">Test Payload</p>
                  <pre class="bg-gray-900 text-gray-100 text-xs rounded-lg p-4 overflow-x-auto"><code>&#123;
  "to": "whatsapp:+642041210342",
  "body": "Welcome to M-Prescribe!"
&#125;</code></pre>
                </div>
              {:else}
                <div class="rounded-lg border border-blue-200 bg-blue-50 p-4">
                  <p class="text-sm text-blue-900 font-semibold mb-1">SMS Gateway (notify.lk)</p>
                  <p class="text-sm text-blue-800">
                    Store the API token in Firebase Secrets. Do not paste it in the UI.
                  </p>
                </div>
                <div class="border border-gray-200 rounded-lg p-4">
                  <div class="flex items-center justify-between mb-3">
                    <p class="text-sm font-semibold text-gray-800">Sender ID</p>
                    {#if smsSenderIdStatus}
                      <span class="text-xs text-gray-500">{smsSenderIdStatus}</span>
                    {/if}
                  </div>
                  <div class="flex flex-col sm:flex-row gap-3">
                    <input
                      type="text"
                      class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-200 focus:border-red-400"
                      bind:value={smsTestSenderId}
                      placeholder="YourName"
                    />
                    <button
                      class="inline-flex items-center justify-center px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors duration-200 disabled:opacity-50"
                      on:click={saveSmsSenderId}
                      disabled={smsSenderIdSaving}
                    >
                      {#if smsSenderIdSaving}
                        <i class="fas fa-spinner fa-spin mr-2"></i>Saving...
                      {:else}
                        <i class="fas fa-save mr-2"></i>Save Sender ID
                      {/if}
                    </button>
                  </div>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Recipient</label>
                    <input
                      type="text"
                      class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-200 focus:border-red-400"
                      bind:value={smsTestRecipient}
                      placeholder="94712345678"
                    />
                  </div>
                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Sender ID</label>
                    <input
                      type="text"
                      class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-200 focus:border-red-400"
                      bind:value={smsTestSenderId}
                      placeholder="YourName"
                    />
                  </div>
                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Type (unicode only)</label>
                    <select
                      class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-200 focus:border-red-400"
                      bind:value={smsTestType}
                    >
                      <option value="plain">plain</option>
                      <option value="unicode">unicode</option>
                    </select>
                  </div>
                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Message</label>
                    <input
                      type="text"
                      class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-200 focus:border-red-400"
                      bind:value={smsTestMessage}
                      placeholder="This is a test message"
                    />
                  </div>
                </div>
                <div class="flex items-center gap-3">
                  <button
                    class="inline-flex items-center px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 transition-colors duration-200 disabled:opacity-50"
                    on:click={testSmsSend}
                    disabled={smsTestRunning}
                  >
                    {#if smsTestRunning}
                      <i class="fas fa-spinner fa-spin mr-2"></i>Sending...
                    {:else}
                      <i class="fas fa-paper-plane mr-2"></i>Send Test SMS
                    {/if}
                  </button>
                  {#if smsTestStatus}
                    <span class="text-sm text-gray-600">{smsTestStatus}</span>
                  {/if}
                </div>
                <div>
                  <p class="text-sm font-semibold text-gray-700 mb-2">Secrets (CLI)</p>
                  <pre class="bg-gray-900 text-gray-100 text-xs rounded-lg p-4 overflow-x-auto"><code>firebase functions:secrets:set NOTIFY_USER_ID
firebase functions:secrets:set NOTIFY_API_KEY</code></pre>
                </div>
                <div>
                  <p class="text-sm font-semibold text-gray-700 mb-2">Sample Node.js (Cloud Function)</p>
                  <pre class="bg-gray-900 text-gray-100 text-xs rounded-lg p-4 overflow-x-auto"><code>exports.sendSmsApi = functions
  .runWith(&#123; secrets: ['NOTIFY_USER_ID', 'NOTIFY_API_KEY'] &#125;)
  .https.onCall(async (data) =&gt; &#123;
    const userId = process.env.NOTIFY_USER_ID;
    const apiKey = process.env.NOTIFY_API_KEY;
    const payload = new URLSearchParams(&#123;
      user_id: userId,
      api_key: apiKey,
      sender_id: data?.senderId,
      to: data?.recipient,
      message: data?.message
    &#125;);

    const response = await fetch('https://app.notify.lk/api/v1/send', &#123;
      method: 'POST',
      headers: &#123;
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json'
      &#125;,
      body: payload.toString()
    &#125;);

    return response.json();
  &#125;);</code></pre>
                </div>
                <div>
                  <p class="text-sm font-semibold text-gray-700 mb-2">Test Payload</p>
                  <pre class="bg-gray-900 text-gray-100 text-xs rounded-lg p-4 overflow-x-auto"><code>&#123;
  "recipient": "31612345678",
  "senderId": "YourName",
  "type": "plain",
  "message": "This is a test message"
&#125;</code></pre>
                </div>
              {/if}
            </div>
          {:else if activeTab === 'doctor-view'}
            <!-- Doctor View Tab -->
            <div class="flex justify-between items-center mb-6">
              <div class="flex items-center gap-3">
                <button
                  class="inline-flex items-center px-3 py-2 text-sm font-medium rounded-lg text-gray-700 bg-white border border-gray-300 hover:bg-gray-50"
                  on:click={closeDoctorView}
                >
                  <i class="fas fa-arrow-left mr-2"></i>Back to Doctors
                </button>
                <h2 class="text-2xl font-bold text-gray-900">
                  <i class="fas fa-user-md mr-2 text-red-600"></i>Doctor Details
                </h2>
              </div>
            </div>
            {#if selectedDoctorView}
              <div class="bg-white border border-gray-200 rounded-lg shadow-sm">
                <div class="bg-gray-50 px-4 py-3 border-b border-gray-200">
                  <h5 class="text-lg font-semibold text-gray-900 mb-0">{selectedDoctorView.name || selectedDoctorView.email}</h5>
                </div>
                <div class="p-4 grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                  <div class="space-y-2">
                    <div><span class="text-gray-500">Email:</span> <span class="text-gray-900">{selectedDoctorView.email}</span></div>
                    <div><span class="text-gray-500">Doctor ID:</span> <span class="text-gray-900">{formatDoctorId(selectedDoctorView.id)}</span></div>
                    <div><span class="text-gray-500">Created:</span> <span class="text-gray-900">{formatDate(selectedDoctorView.createdAt)}</span></div>
                    <div><span class="text-gray-500">Status:</span> <span class="text-gray-900">{getDoctorStatusLabel(selectedDoctorView)}</span></div>
                    <div><span class="text-gray-500">Trial:</span> <span class="text-gray-900">{selectedDoctorView.accessExpiresAt ? formatDate(selectedDoctorView.accessExpiresAt) : 'N/A'}</span></div>
                  </div>
                  <div class="space-y-2">
                    <div><span class="text-gray-500">Country:</span> <span class="text-gray-900">{selectedDoctorView.country || 'N/A'}</span></div>
                    <div><span class="text-gray-500">City:</span> <span class="text-gray-900">{selectedDoctorView.city || 'N/A'}</span></div>
                    <div><span class="text-gray-500">Role:</span> <span class="text-gray-900">{selectedDoctorView.role}</span></div>
                    <div><span class="text-gray-500">Referral:</span> <span class="text-gray-900">{selectedDoctorView.referredByDoctorId ? formatDoctorId(selectedDoctorView.referredByDoctorId) : 'N/A'}</span></div>
                    <div><span class="text-gray-500">Referral Bonus:</span> <span class="text-gray-900">{selectedDoctorView.referralBonusAppliedAt ? `Applied ${formatDate(selectedDoctorView.referralBonusAppliedAt)}` : (selectedDoctorView.referralEligibleAt ? `Eligible ${formatDate(selectedDoctorView.referralEligibleAt)}` : 'N/A')}</span></div>
                  </div>
                </div>
              </div>
            {:else}
              <p class="text-sm text-gray-500">Select a doctor to view details.</p>
            {/if}
          {:else if activeTab === 'system'}
            <!-- System Tab -->
            <div class="flex justify-between items-center mb-6">
              <h2 class="text-2xl font-bold text-gray-900"><i class="fas fa-cog mr-2 text-red-600"></i>System Settings</h2>
            </div>
            
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div class="bg-white border border-gray-200 rounded-lg shadow-sm">
                <div class="bg-gray-50 px-4 py-3 border-b border-gray-200">
                  <h5 class="text-lg font-semibold text-gray-900 mb-0">System Information</h5>
                  </div>
                <div class="p-4">
                    <dl class="grid grid-cols-1 gap-4">
                      <div class="flex justify-between">
                        <dt class="text-sm font-medium text-gray-500">Version:</dt>
                        <dd class="text-sm text-gray-900">1.0.0</dd>
                      </div>
                      
                      <div class="flex justify-between">
                        <dt class="text-sm font-medium text-gray-500">Last Updated:</dt>
                        <dd class="text-sm text-gray-900">{new Date().toLocaleDateString('en-GB', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric'
                        })}</dd>
                      </div>
                      
                      <div class="flex justify-between">
                        <dt class="text-sm font-medium text-gray-500">Admin Email:</dt>
                        <dd class="text-sm text-gray-900">senakahks@gmail.com</dd>
                      </div>
                    </dl>
                  </div>
                </div>
              </div>
              
              <div class="bg-white border border-gray-200 rounded-lg shadow-sm">
                <div class="bg-gray-50 px-4 py-3 border-b border-gray-200">
                  <h5 class="text-lg font-semibold text-gray-900 mb-0">Quick Actions</h5>
                  </div>
                <div class="p-4">
                  <div class="space-y-3">
                    <button class="w-full inline-flex items-center justify-center px-4 py-2 border border-blue-300 text-blue-700 bg-white hover:bg-blue-50 text-sm font-medium rounded-lg focus:outline-none focus:ring-4 focus:ring-blue-300 focus:ring-offset-2 dark:bg-white dark:text-blue-700 dark:border-blue-300 dark:hover:bg-blue-50 transition-all duration-200">
                      <i class="fas fa-download mr-2"></i>Export Data
                      </button>
                    <button class="w-full inline-flex items-center justify-center px-4 py-2 border border-yellow-300 text-yellow-700 bg-white hover:bg-yellow-50 text-sm font-medium rounded-lg focus:outline-none focus:ring-4 focus:ring-yellow-300 focus:ring-offset-2 dark:bg-white dark:text-yellow-700 dark:border-yellow-300 dark:hover:bg-yellow-50 transition-all duration-200">
                      <i class="fas fa-backup mr-2"></i>Backup System
                      </button>
                    <button class="w-full inline-flex items-center justify-center px-4 py-2 border border-blue-300 text-blue-700 bg-white hover:bg-blue-50 text-sm font-medium rounded-lg focus:outline-none focus:ring-4 focus:ring-blue-300 focus:ring-offset-2 dark:bg-white dark:text-blue-700 dark:border-blue-300 dark:hover:bg-blue-50 transition-all duration-200" on:click={refreshData}>
                      <i class="fas fa-sync-alt mr-2"></i>Refresh Data
                      </button>
                    </div>
                  </div>
              </div>

              <div class="bg-white border border-gray-200 rounded-lg shadow-sm">
                <div class="bg-gray-50 px-4 py-3 border-b border-gray-200">
                  <h5 class="text-lg font-semibold text-gray-900 mb-0">Secrets Setup (CLI)</h5>
                </div>
                <div class="p-4 space-y-3">
                  <p class="text-sm text-gray-600">Run these in your project root to store secrets in Firebase Functions.</p>
                  <pre class="bg-gray-900 text-gray-100 text-xs rounded-lg p-3 overflow-x-auto"><code>firebase functions:secrets:set SMTP_PASS
firebase functions:secrets:set OPENAI_API_KEY</code></pre>
                </div>
              </div>
              
              <div class="bg-white border border-gray-200 rounded-lg shadow-sm">
                <div class="bg-gray-50 px-4 py-3 border-b border-gray-200">
                  <h5 class="text-lg font-semibold text-gray-900 mb-0">OpenAI Proxy Test</h5>
                </div>
                <div class="p-4 space-y-3">
                  <p class="text-sm text-gray-600">Sends a tiny request through the Functions proxy to confirm the secret is working.</p>
                  <div class="flex items-center gap-3">
                    <button
                      class="inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg text-white bg-teal-600 hover:bg-teal-700 disabled:opacity-60"
                      on:click={testOpenAIProxy}
                      disabled={openaiTestRunning}
                    >
                      {#if openaiTestRunning}
                        <i class="fas fa-spinner fa-spin mr-2"></i>Testing
                      {:else}
                        <i class="fas fa-vial mr-2"></i>Test OpenAI
                      {/if}
                    </button>
                    {#if openaiTestStatus}
                      <span class="text-sm text-gray-500">{openaiTestStatus}</span>
                    {/if}
                  </div>
                </div>
              </div>
          {:else if activeTab === 'email'}
            <div class="flex justify-between items-center mb-6">
              <h2 class="text-2xl font-bold text-gray-900"><i class="fas fa-envelope mr-2 text-red-600"></i>Email</h2>
            </div>
            <div class="flex items-center gap-2 mb-4">
              <button
                class={`px-4 py-2 text-sm font-medium rounded-lg border transition-colors ${
                  emailTab === 'settings'
                    ? 'bg-red-600 text-white border-red-600'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
                on:click={() => (emailTab = 'settings')}
              >
                Settings
              </button>
              <button
                class={`px-4 py-2 text-sm font-medium rounded-lg border transition-colors ${
                  emailTab === 'templates'
                    ? 'bg-red-600 text-white border-red-600'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
                on:click={() => (emailTab = 'templates')}
              >
                Templates
              </button>
            </div>
            {#if emailTab === 'settings'}

            <div class="bg-white border border-gray-200 rounded-lg shadow-sm">
              <div class="bg-gray-50 px-4 py-3 border-b border-gray-200">
                <h5 class="text-lg font-semibold text-gray-900 mb-0">SMTP Settings</h5>
              </div>
              <div class="p-4 space-y-4">
                {#if smtpLoading}
                  <p class="text-sm text-gray-500">Loading settings...</p>
                {:else}
                  <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label class="block text-sm font-medium text-gray-700 mb-1" for="smtpHost">SMTP Host</label>
                      <input
                        id="smtpHost"
                        type="text"
                        bind:value={smtpHost}
                        placeholder="smtp.gmail.com"
                        class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-200 focus:border-red-400"
                      />
                    </div>
                    <div>
                      <label class="block text-sm font-medium text-gray-700 mb-1" for="smtpPort">SMTP Port</label>
                      <input
                        id="smtpPort"
                        type="number"
                        min="1"
                        bind:value={smtpPort}
                        placeholder="587"
                        class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-200 focus:border-red-400"
                      />
                    </div>
                    <div>
                      <label class="block text-sm font-medium text-gray-700 mb-1" for="smtpUser">SMTP User</label>
                      <input
                        id="smtpUser"
                        type="text"
                        bind:value={smtpUser}
                        placeholder="support@mprescribe.net"
                        class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-200 focus:border-red-400"
                      />
                    </div>
                  </div>

                  <div class="flex items-center gap-3">
                    <label class="inline-flex items-center gap-2 text-sm text-gray-700">
                      <input type="checkbox" bind:checked={smtpSecure} class="rounded border-gray-300 text-red-600 focus:ring-red-200" />
                      Use SSL/TLS (secure)
                    </label>
                  </div>

                  <div class="flex flex-wrap items-center gap-3">
                    <button
                      class="inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg text-white bg-red-600 hover:bg-red-700 disabled:opacity-60"
                      on:click={saveSmtpSettings}
                      disabled={smtpSaving}
                    >
                      {#if smtpSaving}
                        <i class="fas fa-spinner fa-spin mr-2"></i>Saving
                      {:else}
                        <i class="fas fa-save mr-2"></i>Save
                      {/if}
                    </button>
                    <button
                      class="inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg text-white bg-teal-600 hover:bg-teal-700 disabled:opacity-60"
                      on:click={testSmtpSettings}
                      disabled={smtpTestRunning}
                    >
                      {#if smtpTestRunning}
                        <i class="fas fa-spinner fa-spin mr-2"></i>Testing
                      {:else}
                        <i class="fas fa-vial mr-2"></i>Test SMTP
                      {/if}
                    </button>
                    {#if smtpStatus}
                      <span class="text-sm text-gray-500">{smtpStatus}</span>
                    {/if}
                    {#if smtpTestStatus}
                      <span class="text-sm text-gray-500">{smtpTestStatus}</span>
                    {/if}
                  </div>
                {/if}
              </div>
            </div>

          {:else}
            <div class="flex justify-between items-center mb-6">
              <h2 class="text-2xl font-bold text-gray-900"><i class="fas fa-paper-plane mr-2 text-red-600"></i>Email Templates</h2>
            </div>

            <div class="bg-white border border-gray-200 rounded-lg shadow-sm">
              <div class="bg-gray-50 px-4 py-3 border-b border-gray-200">
                <h5 class="text-lg font-semibold text-gray-900 mb-0">Broadcast Email to All Doctors</h5>
              </div>
              <div class="p-4 space-y-4">
                {#if doctorBroadcastLoading}
                  <p class="text-sm text-gray-500">Loading template...</p>
                {:else}
                  <p class="text-xs text-gray-500">
                    Available variables:
                    <code class="text-xs bg-gray-100 px-1 py-0.5 rounded">{'{{name}}'}</code>,
                    <code class="text-xs bg-gray-100 px-1 py-0.5 rounded">{'{{email}}'}</code>,
                    <code class="text-xs bg-gray-100 px-1 py-0.5 rounded">{'{{doctorId}}'}</code>,
                    <code class="text-xs bg-gray-100 px-1 py-0.5 rounded">{'{{doctorIdShort}}'}</code>,
                    <code class="text-xs bg-gray-100 px-1 py-0.5 rounded">{'{{doctorIdBarcode}}'}</code>,
                    <code class="text-xs bg-gray-100 px-1 py-0.5 rounded">{'{{referralUrl}}'}</code>,
                    <code class="text-xs bg-gray-100 px-1 py-0.5 rounded">{'{{referralQr}}'}</code>,
                    <code class="text-xs bg-gray-100 px-1 py-0.5 rounded">{'{{unsubscribeUrl}}'}</code>,
                    <code class="text-xs bg-gray-100 px-1 py-0.5 rounded">{'{{unsubscribeLink}}'}</code>
                  </p>
                  <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label class="block text-sm font-medium text-gray-700 mb-1" for="doctorBroadcastSubject">Subject</label>
                      <input
                        id="doctorBroadcastSubject"
                        type="text"
                        bind:value={doctorBroadcastSubject}
                        placeholder="Important update from Prescribe"
                        class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-200 focus:border-red-400"
                      />
                    </div>
                    <div>
                      <label class="block text-sm font-medium text-gray-700 mb-1" for="doctorBroadcastFromName">From Name (optional)</label>
                      <input
                        id="doctorBroadcastFromName"
                        type="text"
                        bind:value={doctorBroadcastFromName}
                        placeholder="Prescribe Team"
                        class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-200 focus:border-red-400"
                      />
                    </div>
                    <div>
                      <label class="block text-sm font-medium text-gray-700 mb-1" for="doctorBroadcastFromEmail">From Email (optional)</label>
                      <input
                        id="doctorBroadcastFromEmail"
                        type="email"
                        bind:value={doctorBroadcastFromEmail}
                        placeholder="support@mprescribe.net"
                        class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-200 focus:border-red-400"
                      />
                    </div>
                    <div>
                      <label class="block text-sm font-medium text-gray-700 mb-1" for="doctorBroadcastReplyTo">Reply-To (optional)</label>
                      <input
                        id="doctorBroadcastReplyTo"
                        type="email"
                        bind:value={doctorBroadcastReplyTo}
                        placeholder="support@yourdomain.com"
                        class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-200 focus:border-red-400"
                      />
                    </div>
                  </div>

                  <div class="flex items-center gap-2">
                    <input
                      id="doctorBroadcastTextOnly"
                      type="checkbox"
                      bind:checked={doctorBroadcastTextOnly}
                      class="h-4 w-4 text-red-600 border-gray-300 rounded"
                    />
                    <label for="doctorBroadcastTextOnly" class="text-sm text-gray-700">
                      Send plain text only (ignore HTML)
                    </label>
                  </div>

                  <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label class="block text-sm font-medium text-gray-700 mb-1" for="doctorBroadcastText">Plain Text</label>
                      <textarea
                        id="doctorBroadcastText"
                        rows="8"
                        bind:value={doctorBroadcastText}
                        placeholder="Hi {{name}},&#10;We have an important update..."
                        class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-200 focus:border-red-400"
                      />
                    </div>
                    <div>
                      <label class="block text-sm font-medium text-gray-700 mb-1" for="doctorBroadcastHtml">HTML</label>
                      <textarea
                        id="doctorBroadcastHtml"
                        rows="8"
                        bind:value={doctorBroadcastHtml}
                        placeholder="<h2>Important update</h2>"
                        class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-red-200 focus:border-red-400"
                      />
                    </div>
                  </div>

                  <div class="flex flex-wrap items-center gap-3">
                    <button
                      class="inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg text-white bg-red-600 hover:bg-red-700 disabled:opacity-60"
                      on:click={saveDoctorBroadcastTemplate}
                      disabled={doctorBroadcastSaving}
                    >
                      {#if doctorBroadcastSaving}
                        <i class="fas fa-spinner fa-spin mr-2"></i>Saving
                      {:else}
                        <i class="fas fa-save mr-2"></i>Save
                      {/if}
                    </button>
                    <button
                      class="inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg text-white bg-teal-600 hover:bg-teal-700 disabled:opacity-60"
                      on:click={() => sendDoctorBroadcast('test')}
                      disabled={doctorBroadcastSending}
                    >
                      <i class="fas fa-vial mr-2"></i>Test to senakahks@gmail.com
                    </button>
                    <button
                      class="inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60"
                      on:click={() => {
                        pendingAction = () => sendDoctorBroadcast('all')
                        showConfirmation(
                          'Send Broadcast',
                          'Send this email to all doctors?',
                          'Send',
                          'Cancel',
                          'warning'
                        )
                      }}
                      disabled={doctorBroadcastSending}
                    >
                      <i class="fas fa-paper-plane mr-2"></i>Send to all doctors
                    </button>
                    {#if doctorBroadcastStatus}
                      <span class="text-sm text-gray-500">{doctorBroadcastStatus}</span>
                    {/if}
                  </div>
                {/if}
              </div>
            </div>

            <div class="bg-white border border-gray-200 rounded-lg shadow-sm mt-6">
              <div class="bg-gray-50 px-4 py-3 border-b border-gray-200">
                <h5 class="text-lg font-semibold text-gray-900 mb-0">Send to a Single Doctor</h5>
              </div>
              <div class="p-4">
                <label class="block text-sm font-medium text-gray-700 mb-1" for="singleDoctorSelect">Select Doctor</label>
                <select
                  id="singleDoctorSelect"
                  bind:value={selectedDoctorForEmail}
                  class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-200 focus:border-red-400"
                >
                  <option value="">Choose a doctor...</option>
                  {#each doctors as doctor (doctor.id)}
                    <option value={doctor.id}>{doctor.name || `${doctor.firstName || ''} ${doctor.lastName || ''}`.trim() || doctor.email}</option>
                  {/each}
                </select>
              </div>
            </div>

            <div class="bg-white border border-gray-200 rounded-lg shadow-sm mt-6">
              <div class="bg-gray-50 px-4 py-3 border-b border-gray-200">
                <h5 class="text-lg font-semibold text-gray-900 mb-0">Welcome Email</h5>
              </div>
              <div class="p-4 space-y-4">
                {#if welcomeEmailLoading}
                  <p class="text-sm text-gray-500">Loading template...</p>
                {:else}
                  <p class="text-xs text-gray-500">
                    Available variables:
                    <code class="text-xs bg-gray-100 px-1 py-0.5 rounded">{'{{name}}'}</code>,
                    <code class="text-xs bg-gray-100 px-1 py-0.5 rounded">{'{{email}}'}</code>,
                    <code class="text-xs bg-gray-100 px-1 py-0.5 rounded">{'{{doctorId}}'}</code>,
                    <code class="text-xs bg-gray-100 px-1 py-0.5 rounded">{'{{doctorIdShort}}'}</code>,
                    <code class="text-xs bg-gray-100 px-1 py-0.5 rounded">{'{{doctorIdBarcode}}'}</code>,
                    <code class="text-xs bg-gray-100 px-1 py-0.5 rounded">{'{{referralUrl}}'}</code>,
                    <code class="text-xs bg-gray-100 px-1 py-0.5 rounded">{'{{referralQr}}'}</code>,
                    <code class="text-xs bg-gray-100 px-1 py-0.5 rounded">{'{{unsubscribeUrl}}'}</code>,
                    <code class="text-xs bg-gray-100 px-1 py-0.5 rounded">{'{{unsubscribeLink}}'}</code>
                  </p>
                  <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label class="block text-sm font-medium text-gray-700 mb-1" for="welcomeSubject">Subject</label>
                      <input
                        id="welcomeSubject"
                        type="text"
                        bind:value={welcomeSubject}
                        placeholder="Welcome to Prescribe"
                        class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-200 focus:border-red-400"
                      />
                    </div>
                    <div>
                      <label class="block text-sm font-medium text-gray-700 mb-1" for="welcomeFromName">From Name (optional)</label>
                      <input
                        id="welcomeFromName"
                        type="text"
                        bind:value={welcomeFromName}
                        placeholder="Prescribe Team"
                        class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-200 focus:border-red-400"
                      />
                    </div>
                    <div>
                      <label class="block text-sm font-medium text-gray-700 mb-1" for="welcomeFromEmail">From Email (optional)</label>
                      <input
                        id="welcomeFromEmail"
                        type="email"
                        bind:value={welcomeFromEmail}
                        placeholder="support@mprescribe.net"
                        class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-200 focus:border-red-400"
                      />
                    </div>
                    <div>
                      <label class="block text-sm font-medium text-gray-700 mb-1" for="welcomeReplyTo">Reply-To (optional)</label>
                      <input
                        id="welcomeReplyTo"
                        type="email"
                        bind:value={welcomeReplyTo}
                        placeholder="support@yourdomain.com"
                        class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-200 focus:border-red-400"
                      />
                    </div>
                  </div>

                  <div class="flex items-center gap-2">
                    <input
                      id="welcomeTextOnly"
                      type="checkbox"
                      bind:checked={welcomeTextOnly}
                      class="h-4 w-4 text-red-600 border-gray-300 rounded"
                    />
                    <label for="welcomeTextOnly" class="text-sm text-gray-700">
                      Send plain text only (ignore HTML)
                    </label>
                  </div>
                  <div class="flex items-center gap-2">
                    <input
                      id="welcomeEmailEnabled"
                      type="checkbox"
                      bind:checked={welcomeEmailEnabled}
                      class="h-4 w-4 text-red-600 border-gray-300 rounded"
                    />
                    <label for="welcomeEmailEnabled" class="text-sm text-gray-700">
                      Enable automated welcome emails
                    </label>
                  </div>

                  <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label class="block text-sm font-medium text-gray-700 mb-1" for="welcomeText">Plain Text</label>
                      <textarea
                        id="welcomeText"
                        rows="8"
                        bind:value={welcomeText}
                        placeholder="Hi {{name}},&#10;Welcome to Prescribe..."
                        class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-200 focus:border-red-400"
                      />
                    </div>
                    <div>
                      <label class="block text-sm font-medium text-gray-700 mb-1" for="welcomeHtml">HTML</label>
                      <textarea
                        id="welcomeHtml"
                        rows="8"
                        bind:value={welcomeHtml}
                        placeholder="<h2>Welcome to Prescribe</h2>"
                        class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-red-200 focus:border-red-400"
                      />
                    </div>
                  </div>

                  <div class="flex items-center justify-between">
                    <button
                      class="inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg text-white bg-red-600 hover:bg-red-700 disabled:opacity-60"
                      on:click={saveWelcomeEmailTemplate}
                      disabled={welcomeEmailSaving}
                    >
                      {#if welcomeEmailSaving}
                        <i class="fas fa-spinner fa-spin mr-2"></i>Saving
                      {:else}
                        <i class="fas fa-save mr-2"></i>Save
                      {/if}
                    </button>
                    <button
                      class="inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg text-white bg-teal-600 hover:bg-teal-700 disabled:opacity-60"
                      on:click={() => sendTemplateToTest(
                        'welcomeEmail',
                        (msg) => welcomeEmailStatus = msg,
                        {
                          subject: welcomeSubject,
                          text: welcomeText,
                          html: welcomeHtml,
                          fromName: welcomeFromName,
                          fromEmail: welcomeFromEmail,
                          replyTo: welcomeReplyTo,
                          textOnly: welcomeTextOnly
                        }
                      )}
                    >
                      <i class="fas fa-vial mr-2"></i>Test to senakahks@gmail.com
                    </button>
                    {#if welcomeEmailStatus}
                      <span class="text-sm text-gray-500">{welcomeEmailStatus}</span>
                    {/if}
                  </div>
                {/if}
              </div>
            </div>

            <div class="bg-white border border-gray-200 rounded-lg shadow-sm mt-6">
              <div class="bg-gray-50 px-4 py-3 border-b border-gray-200">
                <h5 class="text-lg font-semibold text-gray-900 mb-0">Patient Welcome Email</h5>
              </div>
              <div class="p-4 space-y-4">
                {#if patientWelcomeLoading}
                  <p class="text-sm text-gray-500">Loading template...</p>
                {:else}
                  <p class="text-xs text-gray-500">
                    Available variables:
                    <code class="text-xs bg-gray-100 px-1 py-0.5 rounded">{'{{name}}'}</code>,
                    <code class="text-xs bg-gray-100 px-1 py-0.5 rounded">{'{{email}}'}</code>,
                    <code class="text-xs bg-gray-100 px-1 py-0.5 rounded">{'{{patientId}}'}</code>,
                    <code class="text-xs bg-gray-100 px-1 py-0.5 rounded">{'{{patientIdShort}}'}</code>,
                    <code class="text-xs bg-gray-100 px-1 py-0.5 rounded">{'{{patientIdBarcode}}'}</code>,
                    <code class="text-xs bg-gray-100 px-1 py-0.5 rounded">{'{{doctorName}}'}</code>,
                    <code class="text-xs bg-gray-100 px-1 py-0.5 rounded">{'{{unsubscribeUrl}}'}</code>,
                    <code class="text-xs bg-gray-100 px-1 py-0.5 rounded">{'{{unsubscribeLink}}'}</code>
                  </p>
                  <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label class="block text-sm font-medium text-gray-700 mb-1" for="patientWelcomeSubject">Subject</label>
                      <input
                        id="patientWelcomeSubject"
                        type="text"
                        bind:value={patientWelcomeSubject}
                        placeholder="Welcome to M-Prescribe"
                        class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-200 focus:border-red-400"
                      />
                    </div>
                    <div>
                      <label class="block text-sm font-medium text-gray-700 mb-1" for="patientWelcomeFromName">From Name (optional)</label>
                      <input
                        id="patientWelcomeFromName"
                        type="text"
                        bind:value={patientWelcomeFromName}
                        placeholder="M-Prescribe Team"
                        class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-200 focus:border-red-400"
                      />
                    </div>
                    <div>
                      <label class="block text-sm font-medium text-gray-700 mb-1" for="patientWelcomeFromEmail">From Email (optional)</label>
                      <input
                        id="patientWelcomeFromEmail"
                        type="email"
                        bind:value={patientWelcomeFromEmail}
                        placeholder="support@mprescribe.net"
                        class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-200 focus:border-red-400"
                      />
                    </div>
                    <div>
                      <label class="block text-sm font-medium text-gray-700 mb-1" for="patientWelcomeReplyTo">Reply-To (optional)</label>
                      <input
                        id="patientWelcomeReplyTo"
                        type="email"
                        bind:value={patientWelcomeReplyTo}
                        placeholder="support@yourdomain.com"
                        class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-200 focus:border-red-400"
                      />
                    </div>
                  </div>

                  <div class="flex items-center gap-2">
                    <input
                      id="patientWelcomeTextOnly"
                      type="checkbox"
                      bind:checked={patientWelcomeTextOnly}
                      class="h-4 w-4 text-red-600 border-gray-300 rounded"
                    />
                    <label for="patientWelcomeTextOnly" class="text-sm text-gray-700">
                      Send plain text only (ignore HTML)
                    </label>
                  </div>
                  <div class="flex items-center gap-2">
                    <input
                      id="patientWelcomeEnabled"
                      type="checkbox"
                      bind:checked={patientWelcomeEnabled}
                      class="h-4 w-4 text-red-600 border-gray-300 rounded"
                    />
                    <label for="patientWelcomeEnabled" class="text-sm text-gray-700">
                      Enable automated patient welcome emails
                    </label>
                  </div>

                  <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label class="block text-sm font-medium text-gray-700 mb-1" for="patientWelcomeText">Plain Text</label>
                      <textarea
                        id="patientWelcomeText"
                        rows="8"
                        bind:value={patientWelcomeText}
                        placeholder="Hi {{name}},&#10;Welcome to M-Prescribe..."
                        class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-200 focus:border-red-400"
                      />
                    </div>
                    <div>
                      <label class="block text-sm font-medium text-gray-700 mb-1" for="patientWelcomeHtml">HTML</label>
                      <textarea
                        id="patientWelcomeHtml"
                        rows="8"
                        bind:value={patientWelcomeHtml}
                        placeholder="<h2>Welcome to M-Prescribe</h2>"
                        class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-red-200 focus:border-red-400"
                      />
                    </div>
                  </div>

                  <div class="flex items-center justify-between">
                    <button
                      class="inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg text-white bg-red-600 hover:bg-red-700 disabled:opacity-60"
                      on:click={savePatientWelcomeTemplate}
                      disabled={patientWelcomeSaving}
                    >
                      {#if patientWelcomeSaving}
                        <i class="fas fa-spinner fa-spin mr-2"></i>Saving
                      {:else}
                        <i class="fas fa-save mr-2"></i>Save
                      {/if}
                    </button>
                    <button
                      class="inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg text-white bg-teal-600 hover:bg-teal-700 disabled:opacity-60"
                      on:click={() => sendPatientTemplateToTest(
                        'patientWelcomeEmail',
                        (msg) => patientWelcomeStatus = msg,
                        {
                          subject: patientWelcomeSubject,
                          text: patientWelcomeText,
                          html: patientWelcomeHtml,
                          fromName: patientWelcomeFromName,
                          fromEmail: patientWelcomeFromEmail,
                          replyTo: patientWelcomeReplyTo,
                          textOnly: patientWelcomeTextOnly
                        }
                      )}
                    >
                      <i class="fas fa-vial mr-2"></i>Test to senakahks@gmail.com
                    </button>
                    {#if patientWelcomeStatus}
                      <span class="text-sm text-gray-500">{patientWelcomeStatus}</span>
                    {/if}
                  </div>
                {/if}
              </div>
            </div>

            <div class="bg-white border border-gray-200 rounded-lg shadow-sm mt-6">
              <div class="bg-gray-50 px-4 py-3 border-b border-gray-200">
                <h5 class="text-lg font-semibold text-gray-900 mb-0">Appointment Reminder Email</h5>
              </div>
              <div class="p-4 space-y-4">
                {#if appointmentEmailLoading}
                  <p class="text-sm text-gray-500">Loading template...</p>
                {:else}
                  <p class="text-xs text-gray-500">
                    Available variables:
                    <code class="text-xs bg-gray-100 px-1 py-0.5 rounded">{'{{patientName}}'}</code>,
                    <code class="text-xs bg-gray-100 px-1 py-0.5 rounded">{'{{doctorName}}'}</code>,
                    <code class="text-xs bg-gray-100 px-1 py-0.5 rounded">{'{{date}}'}</code>,
                    <code class="text-xs bg-gray-100 px-1 py-0.5 rounded">{'{{unsubscribeUrl}}'}</code>,
                    <code class="text-xs bg-gray-100 px-1 py-0.5 rounded">{'{{unsubscribeLink}}'}</code>
                  </p>
                  <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label class="block text-sm font-medium text-gray-700 mb-1" for="appointmentEmailSubject">Subject</label>
                      <input
                        id="appointmentEmailSubject"
                        type="text"
                        bind:value={appointmentEmailSubject}
                        placeholder="Appointment reminder"
                        class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-200 focus:border-red-400"
                      />
                    </div>
                    <div>
                      <label class="block text-sm font-medium text-gray-700 mb-1" for="appointmentEmailFromName">From Name (optional)</label>
                      <input
                        id="appointmentEmailFromName"
                        type="text"
                        bind:value={appointmentEmailFromName}
                        placeholder="M-Prescribe Team"
                        class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-200 focus:border-red-400"
                      />
                    </div>
                    <div>
                      <label class="block text-sm font-medium text-gray-700 mb-1" for="appointmentEmailFromEmail">From Email (optional)</label>
                      <input
                        id="appointmentEmailFromEmail"
                        type="email"
                        bind:value={appointmentEmailFromEmail}
                        placeholder="support@mprescribe.net"
                        class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-200 focus:border-red-400"
                      />
                    </div>
                    <div>
                      <label class="block text-sm font-medium text-gray-700 mb-1" for="appointmentEmailReplyTo">Reply-To (optional)</label>
                      <input
                        id="appointmentEmailReplyTo"
                        type="email"
                        bind:value={appointmentEmailReplyTo}
                        placeholder="support@yourdomain.com"
                        class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-200 focus:border-red-400"
                      />
                    </div>
                  </div>

                  <div class="flex items-center gap-2">
                    <input
                      id="appointmentEmailTextOnly"
                      type="checkbox"
                      bind:checked={appointmentEmailTextOnly}
                      class="h-4 w-4 text-red-600 border-gray-300 rounded"
                    />
                    <label for="appointmentEmailTextOnly" class="text-sm text-gray-700">
                      Send plain text only (ignore HTML)
                    </label>
                  </div>
                  <div class="flex items-center gap-2">
                    <input
                      id="appointmentEmailEnabled"
                      type="checkbox"
                      bind:checked={appointmentEmailEnabled}
                      class="h-4 w-4 text-red-600 border-gray-300 rounded"
                    />
                    <label for="appointmentEmailEnabled" class="text-sm text-gray-700">
                      Enable automated appointment reminders
                    </label>
                  </div>

                  <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label class="block text-sm font-medium text-gray-700 mb-1" for="appointmentEmailText">Plain Text</label>
                      <textarea
                        id="appointmentEmailText"
                        rows="8"
                        bind:value={appointmentEmailText}
                        placeholder="Hi &#123;&#123;patientName&#125;&#125;,&#10;Reminder: your appointment with &#123;&#123;doctorName&#125;&#125; is on &#123;&#123;date&#125;&#125;."
                        class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-200 focus:border-red-400"
                      />
                    </div>
                    <div>
                      <label class="block text-sm font-medium text-gray-700 mb-1" for="appointmentEmailHtml">HTML</label>
                      <textarea
                        id="appointmentEmailHtml"
                        rows="8"
                        bind:value={appointmentEmailHtml}
                        placeholder="<h2>Appointment reminder</h2>"
                        class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-red-200 focus:border-red-400"
                      />
                    </div>
                  </div>

                  <div class="flex items-center justify-between">
                    <button
                      class="inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg text-white bg-red-600 hover:bg-red-700 disabled:opacity-60"
                      on:click={saveAppointmentReminderTemplate}
                      disabled={appointmentEmailSaving}
                    >
                      {#if appointmentEmailSaving}
                        <i class="fas fa-spinner fa-spin mr-2"></i>Saving
                      {:else}
                        <i class="fas fa-save mr-2"></i>Save
                      {/if}
                    </button>
                    <button
                      class="inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg text-white bg-teal-600 hover:bg-teal-700 disabled:opacity-60"
                      on:click={() => sendAppointmentTemplateToTest(
                        'appointmentReminderEmail',
                        (msg) => appointmentEmailStatus = msg,
                        {
                          subject: appointmentEmailSubject,
                          text: appointmentEmailText,
                          html: appointmentEmailHtml,
                          fromName: appointmentEmailFromName,
                          fromEmail: appointmentEmailFromEmail,
                          replyTo: appointmentEmailReplyTo,
                          textOnly: appointmentEmailTextOnly
                        }
                      )}
                    >
                      <i class="fas fa-vial mr-2"></i>Test to senakahks@gmail.com
                    </button>
                    {#if appointmentEmailStatus}
                      <span class="text-sm text-gray-500">{appointmentEmailStatus}</span>
                    {/if}
                  </div>
                {/if}
              </div>
            </div>

            <div class="bg-white border border-gray-200 rounded-lg shadow-sm mt-6">
              <div class="bg-gray-50 px-4 py-3 border-b border-gray-200">
                <h5 class="text-lg font-semibold text-gray-900 mb-0">Approval Welcome Email</h5>
              </div>
              <div class="p-4 space-y-4">
                {#if approvalWelcomeLoading}
                  <p class="text-sm text-gray-500">Loading template...</p>
                {:else}
                  <p class="text-xs text-gray-500">
                    Available variables:
                    <code class="text-xs bg-gray-100 px-1 py-0.5 rounded">{'{{name}}'}</code>,
                    <code class="text-xs bg-gray-100 px-1 py-0.5 rounded">{'{{email}}'}</code>,
                    <code class="text-xs bg-gray-100 px-1 py-0.5 rounded">{'{{doctorId}}'}</code>,
                    <code class="text-xs bg-gray-100 px-1 py-0.5 rounded">{'{{doctorIdShort}}'}</code>,
                    <code class="text-xs bg-gray-100 px-1 py-0.5 rounded">{'{{doctorIdBarcode}}'}</code>,
                    <code class="text-xs bg-gray-100 px-1 py-0.5 rounded">{'{{referralUrl}}'}</code>,
                    <code class="text-xs bg-gray-100 px-1 py-0.5 rounded">{'{{referralQr}}'}</code>,
                    <code class="text-xs bg-gray-100 px-1 py-0.5 rounded">{'{{unsubscribeUrl}}'}</code>,
                    <code class="text-xs bg-gray-100 px-1 py-0.5 rounded">{'{{unsubscribeLink}}'}</code>
                  </p>
                  <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label class="block text-sm font-medium text-gray-700 mb-1" for="approvalWelcomeSubject">Subject</label>
                      <input
                        id="approvalWelcomeSubject"
                        type="text"
                        bind:value={approvalWelcomeSubject}
                        placeholder="Your account is approved"
                        class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-200 focus:border-red-400"
                      />
                    </div>
                    <div>
                      <label class="block text-sm font-medium text-gray-700 mb-1" for="approvalWelcomeFromName">From Name (optional)</label>
                      <input
                        id="approvalWelcomeFromName"
                        type="text"
                        bind:value={approvalWelcomeFromName}
                        placeholder="Prescribe Team"
                        class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-200 focus:border-red-400"
                      />
                    </div>
                    <div>
                      <label class="block text-sm font-medium text-gray-700 mb-1" for="approvalWelcomeFromEmail">From Email (optional)</label>
                      <input
                        id="approvalWelcomeFromEmail"
                        type="email"
                        bind:value={approvalWelcomeFromEmail}
                        placeholder="support@mprescribe.net"
                        class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-200 focus:border-red-400"
                      />
                    </div>
                    <div>
                      <label class="block text-sm font-medium text-gray-700 mb-1" for="approvalWelcomeReplyTo">Reply-To (optional)</label>
                      <input
                        id="approvalWelcomeReplyTo"
                        type="email"
                        bind:value={approvalWelcomeReplyTo}
                        placeholder="support@mprescribe.net"
                        class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-200 focus:border-red-400"
                      />
                    </div>
                  </div>
                  <div class="flex items-center gap-2">
                    <input
                      id="approvalWelcomeTextOnly"
                      type="checkbox"
                      bind:checked={approvalWelcomeTextOnly}
                      class="h-4 w-4 text-red-600 border-gray-300 rounded"
                    />
                    <label for="approvalWelcomeTextOnly" class="text-sm text-gray-700">
                      Send plain text only (ignore HTML)
                    </label>
                  </div>
                  <div class="flex items-center gap-2">
                    <input
                      id="approvalWelcomeEnabled"
                      type="checkbox"
                      bind:checked={approvalWelcomeEnabled}
                      class="h-4 w-4 text-red-600 border-gray-300 rounded"
                    />
                    <label for="approvalWelcomeEnabled" class="text-sm text-gray-700">
                      Enable approval welcome email
                    </label>
                  </div>
                  <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label class="block text-sm font-medium text-gray-700 mb-1" for="approvalWelcomeText">Plain Text</label>
                      <textarea
                        id="approvalWelcomeText"
                        rows="8"
                        bind:value={approvalWelcomeText}
                        placeholder="Hi {{name}},&#10;Your account is approved..."
                        class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-200 focus:border-red-400"
                      />
                    </div>
                    <div>
                      <label class="block text-sm font-medium text-gray-700 mb-1" for="approvalWelcomeHtml">HTML</label>
                      <textarea
                        id="approvalWelcomeHtml"
                        rows="8"
                        bind:value={approvalWelcomeHtml}
                        placeholder="<h2>Your account is approved</h2>"
                        class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-red-200 focus:border-red-400"
                      />
                    </div>
                  </div>
                  <div class="flex flex-wrap items-center gap-3">
                    <button
                      class="inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg text-white bg-red-600 hover:bg-red-700 disabled:opacity-60"
                      on:click={saveApprovalWelcomeTemplate}
                      disabled={approvalWelcomeSaving}
                    >
                      {#if approvalWelcomeSaving}
                        <i class="fas fa-spinner fa-spin mr-2"></i>Saving
                      {:else}
                        <i class="fas fa-save mr-2"></i>Save
                      {/if}
                    </button>
                    <button
                      class="inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg text-white bg-teal-600 hover:bg-teal-700 disabled:opacity-60"
                      on:click={() => sendTemplateToTest(
                        'approvalWelcomeEmail',
                        (msg) => approvalWelcomeStatus = msg,
                        {
                          subject: approvalWelcomeSubject,
                          text: approvalWelcomeText,
                          html: approvalWelcomeHtml,
                          fromName: approvalWelcomeFromName,
                          fromEmail: approvalWelcomeFromEmail,
                          replyTo: approvalWelcomeReplyTo,
                          textOnly: approvalWelcomeTextOnly
                        }
                      )}
                      disabled={!approvalWelcomeEnabled}
                    >
                      <i class="fas fa-vial mr-2"></i>Test to senakahks@gmail.com
                    </button>
                    <button
                      class="inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg text-white bg-teal-600 hover:bg-teal-700 disabled:opacity-60"
                      on:click={() => sendTemplateToDoctor('approvalWelcomeEmail', selectedDoctorForEmail, (msg) => approvalWelcomeStatus = msg)}
                      disabled={!approvalWelcomeEnabled}
                    >
                      <i class="fas fa-paper-plane mr-2"></i>Send to selected doctor
                    </button>
                    {#if approvalWelcomeStatus}
                      <span class="text-sm text-gray-500">{approvalWelcomeStatus}</span>
                    {/if}
                  </div>
                {/if}
              </div>
            </div>

            <div class="bg-white border border-gray-200 rounded-lg shadow-sm mt-6">
              <div class="bg-gray-50 px-4 py-3 border-b border-gray-200">
                <h5 class="text-lg font-semibold text-gray-900 mb-0">Payment Reminder</h5>
              </div>
              <div class="p-4 space-y-4">
                {#if paymentReminderLoading}
                  <p class="text-sm text-gray-500">Loading template...</p>
                {:else}
                  <p class="text-xs text-gray-500">
                    Available variables:
                    <code class="text-xs bg-gray-100 px-1 py-0.5 rounded">{'{{name}}'}</code>,
                    <code class="text-xs bg-gray-100 px-1 py-0.5 rounded">{'{{email}}'}</code>,
                    <code class="text-xs bg-gray-100 px-1 py-0.5 rounded">{'{{doctorId}}'}</code>,
                    <code class="text-xs bg-gray-100 px-1 py-0.5 rounded">{'{{doctorIdShort}}'}</code>,
                    <code class="text-xs bg-gray-100 px-1 py-0.5 rounded">{'{{doctorIdBarcode}}'}</code>,
                    <code class="text-xs bg-gray-100 px-1 py-0.5 rounded">{'{{referralUrl}}'}</code>,
                    <code class="text-xs bg-gray-100 px-1 py-0.5 rounded">{'{{referralQr}}'}</code>,
                    <code class="text-xs bg-gray-100 px-1 py-0.5 rounded">{'{{unsubscribeUrl}}'}</code>,
                    <code class="text-xs bg-gray-100 px-1 py-0.5 rounded">{'{{unsubscribeLink}}'}</code>
                  </p>
                  <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label class="block text-sm font-medium text-gray-700 mb-1" for="paymentReminderSubject">Subject</label>
                      <input
                        id="paymentReminderSubject"
                        type="text"
                        bind:value={paymentReminderSubject}
                        placeholder="Payment reminder"
                        class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-200 focus:border-red-400"
                      />
                    </div>
                    <div>
                      <label class="block text-sm font-medium text-gray-700 mb-1" for="paymentReminderFromName">From Name (optional)</label>
                      <input
                        id="paymentReminderFromName"
                        type="text"
                        bind:value={paymentReminderFromName}
                        placeholder="Prescribe Team"
                        class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-200 focus:border-red-400"
                      />
                    </div>
                    <div>
                      <label class="block text-sm font-medium text-gray-700 mb-1" for="paymentReminderFromEmail">From Email (optional)</label>
                      <input
                        id="paymentReminderFromEmail"
                        type="email"
                        bind:value={paymentReminderFromEmail}
                        placeholder="support@mprescribe.net"
                        class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-200 focus:border-red-400"
                      />
                    </div>
                    <div>
                      <label class="block text-sm font-medium text-gray-700 mb-1" for="paymentReminderReplyTo">Reply-To (optional)</label>
                      <input
                        id="paymentReminderReplyTo"
                        type="email"
                        bind:value={paymentReminderReplyTo}
                        placeholder="support@mprescribe.net"
                        class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-200 focus:border-red-400"
                      />
                    </div>
                  </div>
                  <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label class="block text-sm font-medium text-gray-700 mb-1" for="paymentReminderText">Plain Text</label>
                      <textarea
                        id="paymentReminderText"
                        rows="8"
                        bind:value={paymentReminderText}
                        placeholder="Hi {{name}},&#10;This is a payment reminder..."
                        class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-200 focus:border-red-400"
                      />
                    </div>
                    <div>
                      <label class="block text-sm font-medium text-gray-700 mb-1" for="paymentReminderHtml">HTML</label>
                      <textarea
                        id="paymentReminderHtml"
                        rows="8"
                        bind:value={paymentReminderHtml}
                        placeholder="<h2>Payment reminder</h2>"
                        class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-red-200 focus:border-red-400"
                      />
                    </div>
                  </div>
                  <div class="flex flex-wrap items-center gap-3">
                    <button
                      class="inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg text-white bg-red-600 hover:bg-red-700 disabled:opacity-60"
                      on:click={savePaymentReminderTemplate}
                      disabled={paymentReminderSaving}
                    >
                      {#if paymentReminderSaving}
                        <i class="fas fa-spinner fa-spin mr-2"></i>Saving
                      {:else}
                        <i class="fas fa-save mr-2"></i>Save
                      {/if}
                    </button>
                    <button
                      class="inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg text-white bg-teal-600 hover:bg-teal-700 disabled:opacity-60"
                      on:click={() => sendTemplateToTest(
                        'paymentReminderEmail',
                        (msg) => paymentReminderStatus = msg,
                        {
                          subject: paymentReminderSubject,
                          text: paymentReminderText,
                          html: paymentReminderHtml,
                          fromName: paymentReminderFromName,
                          fromEmail: paymentReminderFromEmail,
                          replyTo: paymentReminderReplyTo,
                          textOnly: paymentReminderTextOnly
                        }
                      )}
                    >
                      <i class="fas fa-vial mr-2"></i>Test to senakahks@gmail.com
                    </button>
                    <button
                      class="inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg text-white bg-teal-600 hover:bg-teal-700 disabled:opacity-60"
                      on:click={() => sendTemplateToDoctor('paymentReminderEmail', selectedDoctorForEmail, (msg) => paymentReminderStatus = msg)}
                    >
                      <i class="fas fa-paper-plane mr-2"></i>Send to selected doctor
                    </button>
                    {#if paymentReminderStatus}
                      <span class="text-sm text-gray-500">{paymentReminderStatus}</span>
                    {/if}
                  </div>
                {/if}
              </div>
            </div>

            <div class="bg-white border border-gray-200 rounded-lg shadow-sm mt-6">
              <div class="bg-gray-50 px-4 py-3 border-b border-gray-200">
                <h5 class="text-lg font-semibold text-gray-900 mb-0">Payment Thank You</h5>
              </div>
              <div class="p-4 space-y-4">
                {#if paymentThanksLoading}
                  <p class="text-sm text-gray-500">Loading template...</p>
                {:else}
                  <p class="text-xs text-gray-500">
                    Available variables:
                    <code class="text-xs bg-gray-100 px-1 py-0.5 rounded">{'{{name}}'}</code>,
                    <code class="text-xs bg-gray-100 px-1 py-0.5 rounded">{'{{email}}'}</code>,
                    <code class="text-xs bg-gray-100 px-1 py-0.5 rounded">{'{{doctorId}}'}</code>,
                    <code class="text-xs bg-gray-100 px-1 py-0.5 rounded">{'{{doctorIdShort}}'}</code>,
                    <code class="text-xs bg-gray-100 px-1 py-0.5 rounded">{'{{doctorIdBarcode}}'}</code>,
                    <code class="text-xs bg-gray-100 px-1 py-0.5 rounded">{'{{referralUrl}}'}</code>,
                    <code class="text-xs bg-gray-100 px-1 py-0.5 rounded">{'{{referralQr}}'}</code>,
                    <code class="text-xs bg-gray-100 px-1 py-0.5 rounded">{'{{unsubscribeUrl}}'}</code>,
                    <code class="text-xs bg-gray-100 px-1 py-0.5 rounded">{'{{unsubscribeLink}}'}</code>
                  </p>
                  <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label class="block text-sm font-medium text-gray-700 mb-1" for="paymentThanksSubject">Subject</label>
                      <input
                        id="paymentThanksSubject"
                        type="text"
                        bind:value={paymentThanksSubject}
                        placeholder="Thank you for your payment"
                        class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-200 focus:border-red-400"
                      />
                    </div>
                    <div>
                      <label class="block text-sm font-medium text-gray-700 mb-1" for="paymentThanksFromName">From Name (optional)</label>
                      <input
                        id="paymentThanksFromName"
                        type="text"
                        bind:value={paymentThanksFromName}
                        placeholder="Prescribe Team"
                        class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-200 focus:border-red-400"
                      />
                    </div>
                    <div>
                      <label class="block text-sm font-medium text-gray-700 mb-1" for="paymentThanksFromEmail">From Email (optional)</label>
                      <input
                        id="paymentThanksFromEmail"
                        type="email"
                        bind:value={paymentThanksFromEmail}
                        placeholder="support@mprescribe.net"
                        class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-200 focus:border-red-400"
                      />
                    </div>
                    <div>
                      <label class="block text-sm font-medium text-gray-700 mb-1" for="paymentThanksReplyTo">Reply-To (optional)</label>
                      <input
                        id="paymentThanksReplyTo"
                        type="email"
                        bind:value={paymentThanksReplyTo}
                        placeholder="support@mprescribe.net"
                        class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-200 focus:border-red-400"
                      />
                    </div>
                  </div>
                  <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label class="block text-sm font-medium text-gray-700 mb-1" for="paymentThanksText">Plain Text</label>
                      <textarea
                        id="paymentThanksText"
                        rows="8"
                        bind:value={paymentThanksText}
                        placeholder="Hi {{name}},&#10;Thank you for your payment..."
                        class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-200 focus:border-red-400"
                      />
                    </div>
                    <div>
                      <label class="block text-sm font-medium text-gray-700 mb-1" for="paymentThanksHtml">HTML</label>
                      <textarea
                        id="paymentThanksHtml"
                        rows="8"
                        bind:value={paymentThanksHtml}
                        placeholder="<h2>Thank you</h2>"
                        class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-red-200 focus:border-red-400"
                      />
                    </div>
                  </div>
                  <div class="flex flex-wrap items-center gap-3">
                    <button
                      class="inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg text-white bg-red-600 hover:bg-red-700 disabled:opacity-60"
                      on:click={savePaymentThanksTemplate}
                      disabled={paymentThanksSaving}
                    >
                      {#if paymentThanksSaving}
                        <i class="fas fa-spinner fa-spin mr-2"></i>Saving
                      {:else}
                        <i class="fas fa-save mr-2"></i>Save
                      {/if}
                    </button>
                    <button
                      class="inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg text-white bg-teal-600 hover:bg-teal-700 disabled:opacity-60"
                      on:click={() => sendTemplateToTest(
                        'paymentThanksEmail',
                        (msg) => paymentThanksStatus = msg,
                        {
                          subject: paymentThanksSubject,
                          text: paymentThanksText,
                          html: paymentThanksHtml,
                          fromName: paymentThanksFromName,
                          fromEmail: paymentThanksFromEmail,
                          replyTo: paymentThanksReplyTo,
                          textOnly: paymentThanksTextOnly
                        }
                      )}
                    >
                      <i class="fas fa-vial mr-2"></i>Test to senakahks@gmail.com
                    </button>
                    <button
                      class="inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg text-white bg-teal-600 hover:bg-teal-700 disabled:opacity-60"
                      on:click={() => sendTemplateToDoctor('paymentThanksEmail', selectedDoctorForEmail, (msg) => paymentThanksStatus = msg)}
                    >
                      <i class="fas fa-paper-plane mr-2"></i>Send to selected doctor
                    </button>
                    {#if paymentThanksStatus}
                      <span class="text-sm text-gray-500">{paymentThanksStatus}</span>
                    {/if}
                  </div>
                {/if}
              </div>
            </div>

            <div class="bg-white border border-gray-200 rounded-lg shadow-sm mt-6">
              <div class="bg-gray-50 px-4 py-3 border-b border-gray-200">
                <h5 class="text-lg font-semibold text-gray-900 mb-0">Other Message</h5>
              </div>
              <div class="p-4 space-y-4">
                {#if otherMessageLoading}
                  <p class="text-sm text-gray-500">Loading template...</p>
                {:else}
                  <p class="text-xs text-gray-500">
                    Available variables:
                    <code class="text-xs bg-gray-100 px-1 py-0.5 rounded">{'{{name}}'}</code>,
                    <code class="text-xs bg-gray-100 px-1 py-0.5 rounded">{'{{email}}'}</code>,
                    <code class="text-xs bg-gray-100 px-1 py-0.5 rounded">{'{{doctorId}}'}</code>,
                    <code class="text-xs bg-gray-100 px-1 py-0.5 rounded">{'{{doctorIdShort}}'}</code>,
                    <code class="text-xs bg-gray-100 px-1 py-0.5 rounded">{'{{doctorIdBarcode}}'}</code>,
                    <code class="text-xs bg-gray-100 px-1 py-0.5 rounded">{'{{referralUrl}}'}</code>,
                    <code class="text-xs bg-gray-100 px-1 py-0.5 rounded">{'{{referralQr}}'}</code>,
                    <code class="text-xs bg-gray-100 px-1 py-0.5 rounded">{'{{unsubscribeUrl}}'}</code>,
                    <code class="text-xs bg-gray-100 px-1 py-0.5 rounded">{'{{unsubscribeLink}}'}</code>
                  </p>
                  <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label class="block text-sm font-medium text-gray-700 mb-1" for="otherMessageSubject">Subject</label>
                      <input
                        id="otherMessageSubject"
                        type="text"
                        bind:value={otherMessageSubject}
                        placeholder="A message from Prescribe"
                        class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-200 focus:border-red-400"
                      />
                    </div>
                    <div>
                      <label class="block text-sm font-medium text-gray-700 mb-1" for="otherMessageFromName">From Name (optional)</label>
                      <input
                        id="otherMessageFromName"
                        type="text"
                        bind:value={otherMessageFromName}
                        placeholder="Prescribe Team"
                        class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-200 focus:border-red-400"
                      />
                    </div>
                    <div>
                      <label class="block text-sm font-medium text-gray-700 mb-1" for="otherMessageFromEmail">From Email (optional)</label>
                      <input
                        id="otherMessageFromEmail"
                        type="email"
                        bind:value={otherMessageFromEmail}
                        placeholder="support@mprescribe.net"
                        class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-200 focus:border-red-400"
                      />
                    </div>
                    <div>
                      <label class="block text-sm font-medium text-gray-700 mb-1" for="otherMessageReplyTo">Reply-To (optional)</label>
                      <input
                        id="otherMessageReplyTo"
                        type="email"
                        bind:value={otherMessageReplyTo}
                        placeholder="support@mprescribe.net"
                        class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-200 focus:border-red-400"
                      />
                    </div>
                  </div>
                  <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label class="block text-sm font-medium text-gray-700 mb-1" for="otherMessageText">Plain Text</label>
                      <textarea
                        id="otherMessageText"
                        rows="8"
                        bind:value={otherMessageText}
                        placeholder="Hi {{name}},&#10;Here is an update..."
                        class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-200 focus:border-red-400"
                      />
                    </div>
                    <div>
                      <label class="block text-sm font-medium text-gray-700 mb-1" for="otherMessageHtml">HTML</label>
                      <textarea
                        id="otherMessageHtml"
                        rows="8"
                        bind:value={otherMessageHtml}
                        placeholder="<h2>Update</h2>"
                        class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-red-200 focus:border-red-400"
                      />
                    </div>
                  </div>
                  <div class="flex flex-wrap items-center gap-3">
                    <button
                      class="inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg text-white bg-red-600 hover:bg-red-700 disabled:opacity-60"
                      on:click={saveOtherMessageTemplate}
                      disabled={otherMessageSaving}
                    >
                      {#if otherMessageSaving}
                        <i class="fas fa-spinner fa-spin mr-2"></i>Saving
                      {:else}
                        <i class="fas fa-save mr-2"></i>Save
                      {/if}
                    </button>
                    <button
                      class="inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg text-white bg-teal-600 hover:bg-teal-700 disabled:opacity-60"
                      on:click={() => sendTemplateToTest(
                        'doctorMessageEmail',
                        (msg) => otherMessageStatus = msg,
                        {
                          subject: otherMessageSubject,
                          text: otherMessageText,
                          html: otherMessageHtml,
                          fromName: otherMessageFromName,
                          fromEmail: otherMessageFromEmail,
                          replyTo: otherMessageReplyTo,
                          textOnly: otherMessageTextOnly
                        }
                      )}
                    >
                      <i class="fas fa-vial mr-2"></i>Test to senakahks@gmail.com
                    </button>
                    <button
                      class="inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg text-white bg-teal-600 hover:bg-teal-700 disabled:opacity-60"
                      on:click={() => sendTemplateToDoctor('doctorMessageEmail', selectedDoctorForEmail, (msg) => otherMessageStatus = msg)}
                    >
                      <i class="fas fa-paper-plane mr-2"></i>Send to selected doctor
                    </button>
                    {#if otherMessageStatus}
                      <span class="text-sm text-gray-500">{otherMessageStatus}</span>
                    {/if}
                  </div>
                {/if}
              </div>
            </div>
          {/if}
          {/if}
        </div>
      </div>
    </div>

<!-- Quota Management Modal -->
{#if showQuotaModal}
  <div 
    id="quotaModal" 
    tabindex="-1" 
    aria-hidden="true" 
    class="fixed top-0 left-0 right-0 z-50 w-full p-4 overflow-x-hidden overflow-y-auto md:inset-0 h-[calc(100%-1rem)] max-h-full bg-gray-900 bg-opacity-50"
    on:click={closeQuotaModal}
    on:keydown={(e) => { if (e.key === 'Escape') closeQuotaModal() }}
    role="dialog"
    aria-modal="true"
    aria-labelledby="quota-modal-title"
  >
    <div class="relative w-full max-w-md max-h-full mx-auto flex items-center justify-center min-h-screen">
      <div 
        class="relative bg-white rounded-lg shadow-xl dark:bg-gray-700 transform transition-all duration-300 ease-out scale-100"
        on:click|stopPropagation
      >
        <div class="flex items-center justify-between p-4 md:p-5 border-b rounded-t-lg dark:border-gray-600">
          <h3 id="quota-modal-title" class="text-xl font-semibold text-gray-900 dark:text-white flex items-center">
            <i class="fas fa-user-md mr-2 text-red-600"></i>
            Set Token Quota
          </h3>
          <button 
            type="button" 
            class="text-gray-400 bg-transparent hover:bg-gray-200 hover:text-gray-900 rounded-lg text-sm w-8 h-8 ms-auto inline-flex justify-center items-center dark:hover:bg-gray-600 dark:hover:text-white transition-colors duration-200" 
            data-modal-hide="quotaModal"
            on:click={closeQuotaModal}
          >
            <svg class="w-3 h-3" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 14 14">
              <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m1 1 6 6m0 0 6 6M7 7l6-6M7 7l-6 6"/>
            </svg>
            <span class="sr-only">Close modal</span>
          </button>
        </div>
        
        <!-- Flowbite Modal Body -->
        <div class="p-4 md:p-5 space-y-4">
          <div class="space-y-3">
            <div class="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
              <label class="block text-sm font-medium text-gray-900 dark:text-white mb-1">
                Doctor: <span class="font-semibold text-red-600">{getDoctorName(selectedDoctorId)}</span>
              </label>
              <span class="text-xs text-gray-500 dark:text-gray-400">ID: {formatDoctorId(selectedDoctorId)}</span>
            </div>
            
            <div>
              <label for="quotaInput" class="block text-sm font-medium text-gray-900 dark:text-white mb-2">
                Monthly Token Quota:
              </label>
              <input
                type="number"
                id="quotaInput"
                bind:value={quotaInput}
                placeholder="Enter monthly token quota"
                class="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-red-500 focus:border-red-500 block w-full p-2.5 dark:bg-gray-600 dark:border-gray-500 dark:placeholder-gray-400 dark:text-white transition-colors duration-200"
                min="0"
                step="1000"
              />
              <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Set the maximum number of tokens this doctor can use per month
              </p>
            </div>
          </div>
        </div>

        <!-- Flowbite Modal Footer -->
        <div class="flex items-center justify-end p-4 md:p-5 border-t border-gray-200 rounded-b-lg dark:border-gray-600 space-x-3">
          <button
            type="button"
            class="py-2.5 px-5 text-sm font-medium text-gray-900 focus:outline-none bg-white rounded-lg border border-gray-200 hover:bg-gray-100 hover:text-blue-700 focus:z-10 focus:ring-4 focus:ring-gray-100 dark:focus:ring-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-600 dark:hover:text-white dark:hover:bg-gray-700 transition-colors duration-200"
            on:click={closeQuotaModal}
          >
            Cancel
          </button>
          <button
            type="button"
            class="text-white bg-red-600 hover:bg-red-700 focus:ring-4 focus:outline-none focus:ring-red-300 font-medium rounded-lg text-sm px-5 py-2.5 text-center dark:bg-red-500 dark:hover:bg-red-600 dark:focus:ring-red-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
            on:click={saveQuota}
            disabled={!quotaInput || quotaInput < 0}
          >
            <i class="fas fa-save mr-1"></i>
            Save Quota
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}

<!-- Confirmation Modal -->
<ConfirmationModal
  visible={showConfirmationModal}
  title={confirmationConfig.title}
  message={confirmationConfig.message}
  confirmText={confirmationConfig.confirmText}
  cancelText={confirmationConfig.cancelText}
  type={confirmationConfig.type}
  on:confirm={handleConfirmationConfirm}
  on:cancel={handleConfirmationCancel}
  on:close={handleConfirmationCancel}
/>

<!-- Flowbite styling -->
{/if}
</div>
