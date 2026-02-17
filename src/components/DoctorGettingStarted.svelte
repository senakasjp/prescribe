<script>
  export let user
  export let searchQuery = ''
  const quickStartCards = [
    {
      title: 'Register your account',
      description: 'Create a doctor or pharmacy account in minutes.',
      href: '#help-register',
      icon: 'fa-user-plus'
    },
    {
      title: 'Get approved',
      description: 'Check email for approval and sign in.',
      href: '#help-approval',
      icon: 'fa-envelope-open-text'
    },
    {
      title: 'Create a prescription',
      description: 'Register a patient and add drugs or procedures.',
      href: '#help-add-drugs',
      icon: 'fa-notes-medical'
    },
    {
      title: 'Send to pharmacy',
      description: 'Finalize and send the prescription online.',
      href: '#help-send-pharmacy',
      icon: 'fa-paper-plane'
    }
  ]

  const topics = [
    {
      id: 'help-register',
      navLabel: '1. Register Using the Form',
      stepLabel: '1',
      title: 'Register Using the Form',
      summary: '',
      bullets: [
        'Use the registration form to create a doctor or pharmacy account.',
        'Choose the correct portal (Doctor or Pharmacy) during signup.'
      ]
    },
    {
      id: 'help-approval',
      navLabel: '2. Check Email for Approval',
      stepLabel: '2',
      title: 'Check Email for Approval',
      summary: '',
      bullets: [
        'Check your inbox for the approval email.',
        'Once approved, return to the system to sign in.'
      ]
    },
    {
      id: 'help-login',
      navLabel: '3. Login to System',
      stepLabel: '3',
      title: 'Login to System (Doctor/Pharmacist)',
      summary: '',
      bullets: [
        'Sign in using your approved doctor or pharmacy account.',
        'If needed, use the Doctor/Pharmacy toggle on the login screen.'
      ]
    },
    {
      id: 'help-settings',
      navLabel: '4. Enter Doctor Data & Templates',
      stepLabel: '4',
      title: 'Enter Doctor Data & Prescription Template',
      summary: '',
      bullets: [
        'Update your profile in Settings (name, country, city, currency).',
        'Configure prescription templates, procedures, and pricing.'
      ]
    },
    {
      id: 'help-pharmacy-data',
      navLabel: '5. Add Drugs to System (Pharmacist)',
      stepLabel: '5',
      title: 'Add Drugs to System (Pharmacist)',
      summary: '',
      bullets: [
        'In the pharmacy portal, add drug inventory and pricing.',
        'Ensure pharmacy data is ready before dispensing.'
      ]
    },
    {
      id: 'help-add-patient',
      navLabel: '6. Register Patient',
      stepLabel: '6',
      title: 'Register Patient',
      summary: '',
      bullets: [
        'Go to Patients → “+ Add New Patient”.',
        'Fill the patient details and save.'
      ]
    },
    {
      id: 'help-patient-view',
      navLabel: '7. Select Patient & Open View',
      stepLabel: '7',
      title: 'Select Patient & Go to Patient View',
      summary: '',
      bullets: [
        'Search and select a patient from the Patients list.',
        'Open the patient profile to access charts and prescriptions.'
      ]
    },
    {
      id: 'help-clinical',
      navLabel: '8. Enter Symptoms/Reports/Diagnosis',
      stepLabel: '8',
      title: 'Enter Symptoms, Reports, Diagnosis',
      summary: '',
      bullets: [
        'Record symptoms, reports, and diagnoses in the patient chart.',
        'Skip if not needed and proceed to prescriptions.'
      ]
    },
    {
      id: 'help-prescriptions',
      navLabel: '9. Go to Prescriptions',
      stepLabel: '9',
      title: 'Go to Prescriptions',
      summary: '',
      bullets: [
        'Open the Prescriptions tab in the patient profile.',
        'Create a new prescription or review existing ones.'
      ]
    },
    {
      id: 'help-add-drugs',
      navLabel: '10. Add Drugs / Procedures',
      stepLabel: '10',
      title: 'Add Drugs / Procedures',
      summary: '',
      bullets: [
        'Add medicines, dosage, frequency, and duration.',
        'Include procedures or treatments if required.'
      ]
    },
    {
      id: 'help-ai',
      navLabel: '11. Conduct AI Analysis (Optional)',
      stepLabel: '11',
      title: 'Conduct AI Analysis (Optional)',
      summary: '',
      bullets: [
        'Use AI Suggestions to speed up drug selection.',
        'Review and adjust AI output before finalizing.'
      ]
    },
    {
      id: 'help-send-pharmacy',
      navLabel: '12. Send Online Prescription',
      stepLabel: '12',
      title: 'Send Online Prescription to Pharmacy',
      summary: '',
      bullets: [
        'Finalize the prescription.',
        'Send it to a connected pharmacy.'
      ]
    },
    {
      id: 'help-print',
      navLabel: '13. Print Prescription',
      stepLabel: '13',
      title: 'Print Prescription',
      summary: '',
      bullets: [
        'Print or download the prescription for patient records.',
        'Only print if pharmacy sending is not required.'
      ]
    }
  ]

  const tipSection = {
    id: 'help-tip',
    title: 'Tip',
    body: 'Use the AI Suggestions button to speed up drug selection, then adjust dosage and instructions.'
  }

  const normalize = (value) => String(value || '').toLowerCase()

  const topicMatches = (topic, query) => {
    if (!query) return true
    const combined = [
      topic.navLabel,
      topic.title,
      topic.summary,
      ...(topic.bullets || [])
    ]
    return combined.some((entry) => normalize(entry).includes(query))
  }

  $: normalizedQuery = normalize(searchQuery).trim()
  $: filteredTopics = topics.filter((topic) => topicMatches(topic, normalizedQuery))
  $: showTip = !normalizedQuery || normalize(tipSection.body).includes(normalizedQuery)
  $: hasResults = !normalizedQuery || filteredTopics.length > 0 || showTip
</script>

<div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
  <div class="flex items-start justify-between gap-4 flex-wrap">
    <div>
      <h2 class="text-xl font-semibold text-gray-900">
        <i class="fas fa-seedling mr-2 text-teal-600"></i>
        Getting Started (Doctor)
      </h2>
      <p class="text-sm text-gray-600 mt-1">
        Quick steps to start using Prescribe in the doctor portal.
      </p>
    </div>
    {#if user?.firstName || user?.lastName}
      <div class="text-sm text-gray-500">
        Logged in as: <span class="font-medium text-gray-700">{user?.firstName} {user?.lastName}</span>
      </div>
    {/if}
  </div>

  <div class="mt-5 rounded-xl border border-teal-100 bg-gradient-to-r from-teal-50 via-white to-teal-50 p-4">
    <div class="flex items-center justify-between gap-4 flex-wrap">
      <div>
        <p class="text-xs font-semibold uppercase tracking-[0.2em] text-teal-600">Start here</p>
        <h3 class="text-lg font-semibold text-gray-900">Follow the quick-start path</h3>
        <p class="text-sm text-gray-600">Jump directly to the most common tasks.</p>
      </div>
      <a href="#help-register" class="text-sm font-semibold text-teal-700 hover:text-teal-900">
        View all steps
        <i class="fas fa-arrow-right ml-1"></i>
      </a>
    </div>
    <div class="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      {#each quickStartCards as card}
        <a
          href={card.href}
          class="group rounded-lg border border-teal-100 bg-white p-3 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
        >
          <div class="flex items-center gap-2 text-teal-700">
            <i class={`fas ${card.icon}`}></i>
            <span class="text-sm font-semibold">{card.title}</span>
          </div>
          <p class="mt-2 text-xs text-gray-600">{card.description}</p>
        </a>
      {/each}
    </div>
  </div>

  <div class="mt-6 flex flex-col lg:flex-row gap-6">
    <aside class="w-full lg:w-60 lg:shrink-0">
      <div class="border border-gray-200 rounded-lg bg-gray-50 p-4">
        <h3 class="text-sm font-semibold text-gray-700 mb-3">Topics</h3>
        <nav class="space-y-2 text-sm">
          {#each filteredTopics as topic}
            <a
              href={`#${topic.id}`}
              class="block px-3 py-2 rounded-lg text-gray-700 hover:bg-white hover:text-teal-700 border border-transparent hover:border-gray-200"
            >
              {topic.navLabel}
            </a>
          {/each}
        </nav>
      </div>
    </aside>

    <div class="flex-1 space-y-4">
      <div class="rounded-lg border border-gray-200 bg-white p-4">
        <img
          src="/help.jpg"
          alt="Help overview"
          class="w-full h-auto rounded-md"
          loading="lazy"
        />
      </div>
      {#if !hasResults}
        <div class="rounded-lg border border-gray-200 bg-gray-50 p-6 text-sm text-gray-600">
          <p class="font-semibold text-gray-800">No results for “{searchQuery}”.</p>
          <p class="mt-1">Try searching for “register”, “prescription”, “pharmacy”, or “template”.</p>
        </div>
      {/if}

      {#each filteredTopics as topic}
        <section id={topic.id} class="p-4 border border-gray-200 rounded-lg bg-white">
          <div class="flex items-center mb-2">
            <span class="inline-flex items-center justify-center w-8 h-8 rounded-full bg-teal-100 text-teal-700 text-sm font-semibold mr-3">
              {topic.stepLabel}
            </span>
            <h3 class="text-base font-semibold text-gray-900">{topic.title}</h3>
          </div>
          {#if topic.summary}
            <p class="text-sm text-gray-600 mb-4">{topic.summary}</p>
          {/if}
          <ul class="text-sm text-gray-600 space-y-1">
            {#each topic.bullets as bullet}
              <li>{bullet}</li>
            {/each}
          </ul>
        </section>
      {/each}

      {#if showTip}
        <section id={tipSection.id} class="p-4 border border-teal-200 bg-teal-50 rounded-lg text-sm text-teal-800">
          <div class="flex items-start">
            <i class="fas fa-info-circle mt-0.5 mr-2"></i>
            <div>
              Tip: {tipSection.body}
            </div>
          </div>
        </section>
      {/if}

    </div>
  </div>
</div>
