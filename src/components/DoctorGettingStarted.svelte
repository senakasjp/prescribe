<script>
  export let user
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

  <div class="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
    <div class="p-4 border border-gray-200 rounded-lg">
      <div class="flex items-center mb-2">
        <span class="inline-flex items-center justify-center w-8 h-8 rounded-full bg-teal-100 text-teal-700 text-sm font-semibold mr-3">1</span>
        <h3 class="text-base font-semibold text-gray-900">Login</h3>
      </div>
      <ul class="text-sm text-gray-600 space-y-1">
        <li>Use your doctor account to sign in.</li>
        <li>Confirm your name, country, and currency in Settings if needed.</li>
      </ul>
    </div>

    <div class="p-4 border border-gray-200 rounded-lg">
      <div class="flex items-center mb-2">
        <span class="inline-flex items-center justify-center w-8 h-8 rounded-full bg-teal-100 text-teal-700 text-sm font-semibold mr-3">2</span>
        <h3 class="text-base font-semibold text-gray-900">Add a Patient</h3>
      </div>
      <ul class="text-sm text-gray-600 space-y-1">
        <li>Go to Patients → “+ Add New Patient”.</li>
        <li>Fill the patient details and save.</li>
      </ul>
    </div>

    <div class="p-4 border border-gray-200 rounded-lg">
      <div class="flex items-center mb-2">
        <span class="inline-flex items-center justify-center w-8 h-8 rounded-full bg-teal-100 text-teal-700 text-sm font-semibold mr-3">3</span>
        <h3 class="text-base font-semibold text-gray-900">Create a Prescription</h3>
      </div>
      <ul class="text-sm text-gray-600 space-y-1">
        <li>Open a patient → Prescriptions tab.</li>
        <li>Add drugs, dosage, frequency, duration, and instructions.</li>
        <li>Optional: add procedures and discount.</li>
      </ul>
    </div>

    <div class="p-4 border border-gray-200 rounded-lg">
      <div class="flex items-center mb-2">
        <span class="inline-flex items-center justify-center w-8 h-8 rounded-full bg-teal-100 text-teal-700 text-sm font-semibold mr-3">4</span>
        <h3 class="text-base font-semibold text-gray-900">Send to Pharmacy</h3>
      </div>
      <ul class="text-sm text-gray-600 space-y-1">
        <li>Finalize the prescription.</li>
        <li>Click “Send to Pharmacy” and select a connected pharmacy.</li>
      </ul>
    </div>

    <div class="p-4 border border-gray-200 rounded-lg">
      <div class="flex items-center mb-2">
        <span class="inline-flex items-center justify-center w-8 h-8 rounded-full bg-teal-100 text-teal-700 text-sm font-semibold mr-3">5</span>
        <h3 class="text-base font-semibold text-gray-900">Inventory (Pharmacy)</h3>
      </div>
      <ul class="text-sm text-gray-600 space-y-1">
        <li>Connect a pharmacy from the Pharmacies tab.</li>
        <li>Inventory is managed in the pharmacy portal, not here.</li>
      </ul>
    </div>

    <div class="p-4 border border-gray-200 rounded-lg">
      <div class="flex items-center mb-2">
        <span class="inline-flex items-center justify-center w-8 h-8 rounded-full bg-teal-100 text-teal-700 text-sm font-semibold mr-3">6</span>
        <h3 class="text-base font-semibold text-gray-900">Billing</h3>
      </div>
      <ul class="text-sm text-gray-600 space-y-1">
        <li>Charges are calculated in the pharmacy portal after dispensing.</li>
        <li>Expected price appears after finalizing (if configured).</li>
      </ul>
    </div>
  </div>

  <div class="mt-6 p-4 border border-teal-200 bg-teal-50 rounded-lg text-sm text-teal-800">
    <div class="flex items-start">
      <i class="fas fa-info-circle mt-0.5 mr-2"></i>
      <div>
        Tip: Use the AI Suggestions button to speed up drug selection, then adjust dosage and instructions.
      </div>
    </div>
  </div>
</div>
