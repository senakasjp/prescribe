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

  <div class="mt-6 flex flex-col lg:flex-row gap-6">
    <aside class="w-full lg:w-60 lg:shrink-0">
      <div class="border border-gray-200 rounded-lg bg-gray-50 p-4">
        <h3 class="text-sm font-semibold text-gray-700 mb-3">Topics</h3>
        <nav class="space-y-2 text-sm">
          <a href="#help-login" class="block px-3 py-2 rounded-lg text-gray-700 hover:bg-white hover:text-teal-700 border border-transparent hover:border-gray-200">1. Login</a>
          <a href="#help-settings" class="block px-3 py-2 rounded-lg text-gray-700 hover:bg-white hover:text-teal-700 border border-transparent hover:border-gray-200">2. Doctor Settings</a>
          <a href="#help-add-patient" class="block px-3 py-2 rounded-lg text-gray-700 hover:bg-white hover:text-teal-700 border border-transparent hover:border-gray-200">3. Add a Patient</a>
          <a href="#help-create-prescription" class="block px-3 py-2 rounded-lg text-gray-700 hover:bg-white hover:text-teal-700 border border-transparent hover:border-gray-200">4. Create Prescription</a>
          <a href="#help-add-pharmacy" class="block px-3 py-2 rounded-lg text-gray-700 hover:bg-white hover:text-teal-700 border border-transparent hover:border-gray-200">5. Add a Pharmacy</a>
          <a href="#help-send-pharmacy" class="block px-3 py-2 rounded-lg text-gray-700 hover:bg-white hover:text-teal-700 border border-transparent hover:border-gray-200">6. Send to Pharmacy</a>
          <a href="#help-inventory" class="block px-3 py-2 rounded-lg text-gray-700 hover:bg-white hover:text-teal-700 border border-transparent hover:border-gray-200">7. Inventory</a>
          <a href="#help-billing" class="block px-3 py-2 rounded-lg text-gray-700 hover:bg-white hover:text-teal-700 border border-transparent hover:border-gray-200">8. Billing</a>
          <a href="#help-assistants" class="block px-3 py-2 rounded-lg text-gray-700 hover:bg-white hover:text-teal-700 border border-transparent hover:border-gray-200">Pharmacy Assistants</a>
          <a href="#help-switch-portal" class="block px-3 py-2 rounded-lg text-gray-700 hover:bg-white hover:text-teal-700 border border-transparent hover:border-gray-200">Switch Portals</a>
          <a href="#help-tip" class="block px-3 py-2 rounded-lg text-gray-700 hover:bg-white hover:text-teal-700 border border-transparent hover:border-gray-200">Quick Tip</a>
        </nav>
      </div>
    </aside>

    <div class="flex-1 space-y-4">
      <section id="help-login" class="p-4 border border-gray-200 rounded-lg">
        <div class="flex items-center mb-2">
          <span class="inline-flex items-center justify-center w-8 h-8 rounded-full bg-teal-100 text-teal-700 text-sm font-semibold mr-3">1</span>
          <h3 class="text-base font-semibold text-gray-900">Login</h3>
        </div>
        <ul class="text-sm text-gray-600 space-y-1">
          <li>Use your doctor account to sign in.</li>
          <li>Confirm your name, country, and currency in Settings if needed.</li>
        </ul>
      </section>

      <section id="help-settings" class="p-4 border border-gray-200 rounded-lg">
        <div class="flex items-center mb-2">
          <span class="inline-flex items-center justify-center w-8 h-8 rounded-full bg-teal-100 text-teal-700 text-sm font-semibold mr-3">2</span>
          <h3 class="text-base font-semibold text-gray-900">Doctor Settings</h3>
        </div>
        <ul class="text-sm text-gray-600 space-y-1">
          <li>Update your name, country, city, and currency in Settings.</li>
          <li>Set consultation, hospital, and procedure prices for billing.</li>
          <li>Manage templates, external doctor access, and backups.</li>
        </ul>
      </section>

      <section id="help-add-patient" class="p-4 border border-gray-200 rounded-lg">
        <div class="flex items-center mb-2">
          <span class="inline-flex items-center justify-center w-8 h-8 rounded-full bg-teal-100 text-teal-700 text-sm font-semibold mr-3">3</span>
          <h3 class="text-base font-semibold text-gray-900">Add a Patient</h3>
        </div>
        <ul class="text-sm text-gray-600 space-y-1">
          <li>Go to Patients → “+ Add New Patient”.</li>
          <li>Fill the patient details and save.</li>
        </ul>
      </section>

      <section id="help-create-prescription" class="p-4 border border-gray-200 rounded-lg">
        <div class="flex items-center mb-2">
          <span class="inline-flex items-center justify-center w-8 h-8 rounded-full bg-teal-100 text-teal-700 text-sm font-semibold mr-3">4</span>
          <h3 class="text-base font-semibold text-gray-900">Create a Prescription</h3>
        </div>
        <ul class="text-sm text-gray-600 space-y-1">
          <li>Open a patient → Prescriptions tab and click “New Prescription”.</li>
          <li>Add medicines from the search list, or use AI Suggestions to prefill.</li>
          <li>For each drug, set dosage, unit, dosage form, frequency, and duration.</li>
          <li>Add instructions (e.g., after food) and optional notes.</li>
          <li>Select procedures/treatments and adjust discount scope if needed.</li>
          <li>Review the expected price after finalizing, then send to pharmacy.</li>
        </ul>
      </section>

      <section id="help-add-pharmacy" class="p-4 border border-gray-200 rounded-lg">
        <div class="flex items-center mb-2">
          <span class="inline-flex items-center justify-center w-8 h-8 rounded-full bg-teal-100 text-teal-700 text-sm font-semibold mr-3">5</span>
          <h3 class="text-base font-semibold text-gray-900">Add a Pharmacy</h3>
        </div>
        <ul class="text-sm text-gray-600 space-y-1">
          <li>Open the Pharmacies tab in the doctor portal.</li>
          <li>Click “Add Pharmacy” and invite a pharmacy by email.</li>
          <li>If you own a pharmacy, register it in the pharmacy portal, then connect it here.</li>
        </ul>
      </section>

      <section id="help-send-pharmacy" class="p-4 border border-gray-200 rounded-lg">
        <div class="flex items-center mb-2">
          <span class="inline-flex items-center justify-center w-8 h-8 rounded-full bg-teal-100 text-teal-700 text-sm font-semibold mr-3">6</span>
          <h3 class="text-base font-semibold text-gray-900">Send to Pharmacy</h3>
        </div>
        <ul class="text-sm text-gray-600 space-y-1">
          <li>Finalize the prescription.</li>
          <li>Click “Send to Pharmacy” and select a connected pharmacy.</li>
          <li>If no pharmacy is connected, go to the Pharmacies tab and add one.</li>
        </ul>
      </section>

      <section id="help-inventory" class="p-4 border border-gray-200 rounded-lg">
        <div class="flex items-center mb-2">
          <span class="inline-flex items-center justify-center w-8 h-8 rounded-full bg-teal-100 text-teal-700 text-sm font-semibold mr-3">7</span>
          <h3 class="text-base font-semibold text-gray-900">Inventory (Pharmacy)</h3>
        </div>
        <ul class="text-sm text-gray-600 space-y-1">
          <li>Open the Pharmacies tab to connect a pharmacy to your doctor portal.</li>
          <li>Click “Add Pharmacy” and invite an existing pharmacy by email.</li>
          <li>If you own a pharmacy, register it in the pharmacy portal using the same email, then connect it here.</li>
          <li>Inventory is managed in the pharmacy portal, not in the doctor portal.</li>
        </ul>
      </section>

      <section id="help-billing" class="p-4 border border-gray-200 rounded-lg">
        <div class="flex items-center mb-2">
          <span class="inline-flex items-center justify-center w-8 h-8 rounded-full bg-teal-100 text-teal-700 text-sm font-semibold mr-3">8</span>
          <h3 class="text-base font-semibold text-gray-900">Billing</h3>
        </div>
        <ul class="text-sm text-gray-600 space-y-1">
          <li>Charges are calculated in the pharmacy portal after dispensing.</li>
          <li>Expected price appears after finalizing (if configured).</li>
        </ul>
      </section>

      <section id="help-switch-portal" class="p-4 border border-gray-200 rounded-lg">
        <div class="flex items-center mb-2">
          <span class="inline-flex items-center justify-center w-8 h-8 rounded-full bg-teal-100 text-teal-700 text-sm font-semibold mr-3">9</span>
          <h3 class="text-base font-semibold text-gray-900">Switch Between Doctor & Pharmacy Portals</h3>
        </div>
        <ul class="text-sm text-gray-600 space-y-1">
          <li>Use the Doctor/Pharmacy toggle on the login screen to switch portals.</li>
          <li>If you are already signed in, sign out and select the other portal.</li>
          <li>Doctors with active accounts can access the pharmacy portal using the same email.</li>
        </ul>
      </section>

      <section id="help-assistants" class="p-4 border border-gray-200 rounded-lg">
        <div class="flex items-center mb-2">
          <span class="inline-flex items-center justify-center w-8 h-8 rounded-full bg-teal-100 text-teal-700 text-sm font-semibold mr-3">10</span>
          <h3 class="text-base font-semibold text-gray-900">Add Pharmacy Assistants (Teams)</h3>
        </div>
        <ul class="text-sm text-gray-600 space-y-1">
          <li>Open the pharmacy portal and go to Settings → Team.</li>
          <li>Click “Add Team Member” and enter the assistant’s name, email, and role.</li>
          <li>They can log in using the pharmacy portal with their email and password.</li>
        </ul>
      </section>

      <section id="help-tip" class="p-4 border border-teal-200 bg-teal-50 rounded-lg text-sm text-teal-800">
        <div class="flex items-start">
          <i class="fas fa-info-circle mt-0.5 mr-2"></i>
          <div>
            Tip: Use the AI Suggestions button to speed up drug selection, then adjust dosage and instructions.
          </div>
        </div>
      </section>

      <section id="help-faq" class="p-4 border border-gray-200 rounded-lg">
        <div class="flex items-center mb-3">
          <i class="fas fa-circle-question text-teal-600 mr-2"></i>
          <h3 class="text-base font-semibold text-gray-900">FAQ</h3>
        </div>
        <div class="space-y-3 text-sm text-gray-600">
          <div>
            <p class="font-medium text-gray-800">Where do I set procedure prices?</p>
            <p>Go to Settings → Procedures and update the default prices used during billing.</p>
          </div>
          <div>
            <p class="font-medium text-gray-800">Why is the expected price different?</p>
            <p>Expected price uses your procedure pricing and discount rules. Final totals are calculated after pharmacy dispensing and rounding.</p>
          </div>
          <div>
            <p class="font-medium text-gray-800">Can I send to multiple pharmacies?</p>
            <p>Yes. Connect pharmacies in the Pharmacies tab and choose the destination when sending a prescription.</p>
          </div>
          <div>
            <p class="font-medium text-gray-800">How do I add my own pharmacy?</p>
            <p>Create the pharmacy account in the pharmacy portal (use the same email if you own it), then return to the doctor portal → Pharmacies tab and connect it.</p>
          </div>
          <div>
            <p class="font-medium text-gray-800">Where can I see a patient’s history?</p>
            <p>Open the patient and use the Prescriptions and Reports tabs for full history.</p>
          </div>
        </div>
      </section>
    </div>
  </div>
</div>
