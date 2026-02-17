<script>
  import { onMount } from 'svelte'
  import LoadingSpinner from './LoadingSpinner.svelte'
  
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

**Last updated:** January 27, 2026

Tronicgate Hardware and Software Services ("Tronicgate", "we", "our", or "us") operates the M-Prescribe Patient and Pharmacy Management System (the "Service"). This Privacy Policy explains what data we collect, why we collect it, where it is stored, who can access it, how long it is retained, how patients can access or correct their data, and how data breaches are handled.

The Service is provided to countries worldwide except the European Union/EEA, the United States, the United Kingdom, Australia, Canada, and New Zealand.

## 1. What data we collect

### Patient data (entered by doctors or pharmacies)
- Patient identity details (name, date of birth, sex/gender, contact information)
- Medical information (symptoms, diagnoses, allergies, prescriptions, medication instructions)
- Visit records and prescription history
- Notes and attachments (if uploaded)

### Provider data (doctors and pharmacies)
- Name, email address, phone number
- Practice/pharmacy details (business name, location)
- Account IDs, role and access permissions

### System data
- Login events, audit logs, and usage logs
- Device/browser information and IP address
- Email delivery logs for system notifications

## 2. Why we collect data
We collect and use data to:
- Provide patient record management and prescription workflows
- Enable pharmacy dispensing and billing
- Facilitate communication and confirmations
- Support security, auditing, and fraud prevention
- Improve performance and reliability
- Provide optional AI-assisted features when enabled by users

## 3. Where data is stored
Data is stored in Google Firebase (Google Cloud Platform). This is cloud-hosted infrastructure and may involve data storage outside your country.

Data is encrypted in transit and at rest by Google Firebase.

## 4. Who can access data
Access is strictly role-based:
- Doctors: Access their own patients and prescriptions
- Pharmacies: Access only patient name, age, sex/gender, and medication list shared by connected doctors
- System administrators: Access only what is necessary to maintain the Service, provide support, and meet security obligations

## 5. Data retention
We retain data while an account is active and for one (1) year after account closure or inactivity. After this period, data is deleted or anonymized unless required by law or a valid legal request.

## 6. How patients can access or correct their data
Patients may request access to or correction of their data by contacting the doctor or pharmacy that created the record. If additional assistance is needed, requests may be sent to support@mprescribe.net.

We will facilitate access or corrections where possible, subject to authentication and verification.

## 7. Data breaches and incident response
If a data breach is detected, we will:
- Investigate and secure affected systems
- Assess the scope and impact
- Notify affected users and relevant authorities where legally required
- Document and remediate the incident to prevent recurrence

## 8. International use and restricted regions
The Service is available globally except in the EU/EEA, USA, UK, Australia, Canada, and New Zealand. Users are responsible for ensuring local compliance in their jurisdiction.

## 9. Changes to this policy
We may update this Privacy Policy from time to time. Updates will be posted within the Service and will include the "Last updated" date.

## 10. Contact
For privacy inquiries, data access, or corrections, contact:

Tronicgate Hardware and Software Services
Email: support@mprescribe.net`
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
  <!-- Flowbite Modal Backdrop -->
  <div 
    id="privacyModal" 
    tabindex="-1" 
    aria-hidden="true" 
    class="fixed top-0 left-0 right-0 z-50 w-full p-4 overflow-x-hidden overflow-y-auto md:inset-0 h-[calc(100%-1rem)] max-h-full bg-gray-900 bg-opacity-50 sm:text-sm"
    on:click={closeModal}
    on:keydown={(e) => { if (e.key === 'Escape') closeModal() }}
    role="dialog"
    aria-modal="true"
    aria-labelledby="privacy-modal-title"
  >
    <!-- Flowbite Modal Container -->
    <div class="relative w-full max-w-4xl max-h-full mx-auto flex items-center justify-center min-h-screen">
      <!-- Flowbite Modal Content -->
      <div 
        class="relative bg-white rounded-lg shadow-xl dark:bg-gray-700 transform transition-all duration-300 ease-out scale-100 max-h-[90vh]"
        on:click|stopPropagation
      >
        <!-- Flowbite Modal Header -->
        <div class="flex items-center justify-between p-4 md:p-5 border-b rounded-t-lg dark:border-gray-600">
          <h3 id="privacy-modal-title" class="text-xl font-semibold text-gray-900 dark:text-white flex items-center">
            <i class="fas fa-shield-alt text-blue-600 mr-2"></i>
            Privacy Policy
          </h3>
          <button
            type="button"
            class="text-gray-400 bg-transparent hover:bg-gray-200 hover:text-gray-900 rounded-lg text-sm w-8 h-8 ms-auto inline-flex justify-center items-center dark:hover:bg-gray-600 dark:hover:text-white transition-colors duration-200"
            data-modal-hide="privacyModal"
            on:click={closeModal}
          >
            <svg class="w-3 h-3" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 14 14">
              <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m1 1 6 6m0 0 6 6M7 7l6-6M7 7l-6 6"/>
            </svg>
            <span class="sr-only">Close modal</span>
          </button>
        </div>
      
        <!-- Flowbite Modal Body -->
        <div class="p-4 md:p-5 space-y-4 overflow-y-auto max-h-[calc(90vh-140px)]">
          <div class="prose prose-sm max-w-none dark:prose-invert text-gray-500 dark:text-gray-400">
            {#if privacyContent}
              {@html privacyContent.replace(/\n/g, '<br>').replace(/#{1,6}\s/g, '<br><br>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\*(.*?)\*/g, '<em>$1</em>')}
            {:else}
              <LoadingSpinner text="Loading privacy policy..." size="medium" color="blue" />
            {/if}
          </div>
        </div>
        
        <!-- Flowbite Modal Footer -->
        <div class="flex items-center justify-end p-4 md:p-5 border-t border-gray-200 rounded-b-lg dark:border-gray-600">
          <button
            type="button"
            class="text-white bg-blue-600 hover:bg-blue-700 focus:ring-4 focus:outline-none focus:ring-blue-300 font-medium rounded-lg text-sm px-5 py-2.5 text-center dark:bg-blue-500 dark:hover:bg-blue-600 dark:focus:ring-blue-800 transition-colors duration-200"
            data-modal-hide="privacyModal"
            on:click={closeModal}
          >
            <i class="fas fa-check mr-1"></i>
            I Understand
          </button>
        </div>
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
