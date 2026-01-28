<script>
  import { onMount } from 'svelte'
  import BrandName from './BrandName.svelte'

  const defaultPrivacyContent = `# Privacy Policy

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

  let privacyContent = defaultPrivacyContent
  let hasLoaded = false

  const renderMarkdown = (source) => {
    const input = String(source || '').replace(/\r\n/g, '\n')
    let html = input
      .replace(/^###\s+(.*)$/gm, '<h3>$1</h3>')
      .replace(/^##\s+(.*)$/gm, '<h2>$1</h2>')
      .replace(/^#\s+(.*)$/gm, '<h1>$1</h1>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/^\-\s+(.*)$/gm, '<li>$1</li>')

    html = html.replace(/(?:<li>.*<\/li>\n?)+/g, (match) => `<ul>${match}</ul>`)
    html = html.replace(/\n{2,}/g, '<br><br>')
    html = html.replace(/\n/g, '<br>')
    return html
  }

  onMount(async () => {
    try {
      const response = await fetch('/PRIVACY_POLICY.md', { cache: 'no-store' })
      if (response.ok) {
        const text = await response.text()
        if (text && !text.toLowerCase().includes('<html')) {
          privacyContent = text
        }
      }
    } catch (error) {
      console.error('Error loading privacy policy:', error)
    } finally {
      hasLoaded = true
    }
  })
</script>

<div class="min-h-screen bg-[radial-gradient(circle_at_top,_#e6f7f4_0%,_#f9fafb_55%,_#f3f4f6_100%)]">
  <div class="max-w-6xl mx-auto px-6 py-10">
    <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-8">
      <div>
        <p class="text-xs uppercase tracking-[0.2em] text-teal-600 font-semibold">
          <BrandName className="text-teal-600" />
        </p>
        <h1 class="text-3xl sm:text-4xl lg:text-5xl font-semibold text-gray-900 font-hero">Privacy Policy</h1>
        <p class="mt-2 text-sm text-gray-600">For Tronicgate Hardware and Software Services</p>
      </div>
      <a
        href="/"
        class="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50"
      >
        <i class="fas fa-arrow-left"></i>
        Back to home
      </a>
    </div>

    <div class="rounded-3xl border border-gray-200 bg-white/90 p-6 shadow-sm">
      {#if !privacyContent && !hasLoaded}
        <div class="flex items-center justify-center py-8">
          <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
          <span class="ml-2 text-gray-600">Loading privacy policy...</span>
        </div>
      {:else}
        <div class="prose prose-sm max-w-none text-gray-700">
          {@html renderMarkdown(privacyContent)}
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  .prose {
    color: #374151;
  }

  .prose h1, .prose h2, .prose h3, .prose h4, .prose h5, .prose h6 {
    color: #111827;
    font-weight: 600;
    margin-top: 1.5rem;
    margin-bottom: 0.5rem;
  }

  .prose h1 {
    font-size: 1.875rem;
  }

  .prose h2 {
    font-size: 1.5rem;
    color: #0f766e;
  }

  .prose h3 {
    font-size: 1.25rem;
  }

  .prose ul {
    margin-left: 1.5rem;
    margin-bottom: 1rem;
  }

  .prose li {
    margin-bottom: 0.25rem;
  }

  .prose strong {
    color: #0f172a;
  }
</style>
