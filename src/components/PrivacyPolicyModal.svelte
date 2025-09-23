<script>
  import { onMount } from 'svelte'
  
  let isVisible = false
  
  // Load privacy policy content
  let privacyContent = ''
  
  onMount(async () => {
    try {
      const response = await fetch('/PRIVACY_POLICY.md')
      if (response.ok) {
        privacyContent = await response.text()
      } else {
        // Fallback content if file not found
        privacyContent = getDefaultPrivacyContent()
      }
    } catch (error) {
      console.error('Error loading privacy policy:', error)
      privacyContent = getDefaultPrivacyContent()
    }
  })
  
  function getDefaultPrivacyContent() {
    return `# Privacy Policy

**Effective Date:** December 19, 2024

## Introduction

Prescribe is committed to protecting the privacy and security of your personal information. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our medical prescription management platform.

## Information We Collect

### Personal Information
- **Doctor Information:** Name, email address, professional credentials, country, city
- **Patient Information:** Name, age, date of birth, contact information, medical history, symptoms, diagnoses, prescriptions
- **Authentication Data:** Login credentials, authentication tokens, session data
- **Usage Data:** AI token usage, feature interactions, system logs

## How We Use Your Information

### Primary Purposes
- **Medical Record Management:** Creating, storing, and managing patient medical records
- **Prescription Management:** Generating, tracking, and managing prescriptions
- **AI-Powered Assistance:** Providing AI-generated medical recommendations and drug suggestions
- **Authentication:** Verifying user identity and managing access to the platform

## Data Security

### Security Measures
- **Encryption:** All data is encrypted in transit and at rest
- **Access Controls:** Role-based access with strict authentication requirements
- **Audit Logging:** Comprehensive logging of all data access and modifications
- **HIPAA Compliance:** Adherence to healthcare data protection standards

### Data Isolation
- **Doctor Isolation:** Each doctor can only access their own patients' data
- **Patient Privacy:** No cross-doctor data access is possible
- **Secure Storage:** Data stored in secure, encrypted databases

## Your Rights and Choices

### Access and Control
- **View Your Data:** Access your personal information and medical records
- **Update Information:** Correct or update your personal details
- **Data Portability:** Request a copy of your data in a portable format
- **Account Deletion:** Request deletion of your account and associated data

## Contact Information

### Privacy Questions
- **Email:** privacy@prescribe-medical.com
- **Response Time:** We respond to privacy inquiries within 30 days

## Legal Compliance

### Applicable Laws
- **HIPAA:** Health Insurance Portability and Accountability Act
- **GDPR:** General Data Protection Regulation (where applicable)
- **State Laws:** Applicable state healthcare privacy laws

By using Prescribe, you acknowledge that you have read and understood this Privacy Policy and agree to the collection, use, and disclosure of your information as described herein.

**Last Updated:** December 19, 2024`
  }
  
  function closeModal() {
    isVisible = false
  }
  
  function openModal() {
    isVisible = true
  }
  
  // Export functions for parent components
  export { openModal, closeModal }
</script>

{#if isVisible}
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900 bg-opacity-50" 
       on:click={closeModal}
       on:keydown={(e) => { if (e.key === 'Escape') closeModal() }}
       role="dialog"
       aria-modal="true"
       aria-labelledby="privacy-modal-title">
    
    <div class="relative w-full max-w-4xl max-h-[90vh] bg-white rounded-lg shadow-lg dark:bg-gray-800"
         on:click|stopPropagation>
      
      <!-- Header -->
      <div class="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
        <h3 id="privacy-modal-title" class="text-xl font-semibold text-gray-900 dark:text-white">
          <i class="fas fa-shield-alt text-blue-600 mr-2"></i>
          Privacy Policy
        </h3>
        <button
          type="button"
          class="text-gray-400 bg-transparent hover:bg-gray-200 hover:text-gray-900 rounded-lg text-sm p-1.5 ml-auto inline-flex items-center dark:hover:bg-gray-600 dark:hover:text-white"
          on:click={closeModal}
        >
          <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
            <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"></path>
          </svg>
        </button>
      </div>
      
      <!-- Content -->
      <div class="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
        <div class="prose prose-sm max-w-none dark:prose-invert">
          {#if privacyContent}
            {@html privacyContent.replace(/\n/g, '<br>').replace(/#{1,6}\s/g, '<br><br>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\*(.*?)\*/g, '<em>$1</em>')}
          {:else}
            <div class="flex items-center justify-center py-8">
              <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span class="ml-2 text-gray-600">Loading privacy policy...</span>
            </div>
          {/if}
        </div>
      </div>
      
      <!-- Footer -->
      <div class="flex items-center justify-end p-6 border-t border-gray-200 dark:border-gray-700">
        <button
          type="button"
          class="text-white bg-blue-600 hover:bg-blue-700 focus:ring-4 focus:outline-none focus:ring-blue-300 font-medium rounded-lg text-sm px-5 py-2.5 text-center dark:bg-blue-600 dark:hover:bg-blue-700 dark:focus:ring-blue-800"
          on:click={closeModal}
        >
          <i class="fas fa-check mr-2"></i>
          I Understand
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .prose {
    color: #374151;
  }
  
  .prose h1, .prose h2, .prose h3, .prose h4, .prose h5, .prose h6 {
    color: #1f2937;
    font-weight: 600;
    margin-top: 1.5rem;
    margin-bottom: 0.5rem;
  }
  
  .prose h1 {
    font-size: 1.875rem;
    border-bottom: 2px solid #e5e7eb;
    padding-bottom: 0.5rem;
  }
  
  .prose h2 {
    font-size: 1.5rem;
    color: #2563eb;
  }
  
  .prose h3 {
    font-size: 1.25rem;
    color: #374151;
  }
  
  .prose ul {
    margin-left: 1.5rem;
    margin-bottom: 1rem;
  }
  
  .prose li {
    margin-bottom: 0.25rem;
  }
  
  .prose strong {
    color: #1f2937;
    font-weight: 600;
  }
  
  .prose em {
    color: #6b7280;
    font-style: italic;
  }
  
  .dark .prose {
    color: #d1d5db;
  }
  
  .dark .prose h1, .dark .prose h2, .dark .prose h3, .dark .prose h4, .dark .prose h5, .dark .prose h6 {
    color: #f9fafb;
  }
  
  .dark .prose h2 {
    color: #60a5fa;
  }
  
  .dark .prose strong {
    color: #f9fafb;
  }
</style>
