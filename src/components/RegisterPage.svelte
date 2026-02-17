<script>
  import BrandName from './BrandName.svelte'
  import DoctorAuth from './DoctorAuth.svelte'
  import PharmacistAuth from './PharmacistAuth.svelte'

  let authMode = 'doctor'

  const handleSwitchToDoctor = () => {
    authMode = 'doctor'
  }

  const handleSwitchToPharmacist = () => {
    authMode = 'pharmacist'
  }
</script>

<div class="flex justify-center sm:text-sm">
  <div class="w-full max-w-md">
    <div id="signin" class="bg-white rounded-3xl shadow-xl border border-gray-200 overflow-hidden">
      <div class="px-6 py-6 border-b border-gray-200">
        <div class="flex items-center justify-between">
          <div>
            <h2 class="text-xl font-semibold text-gray-900 font-landing">Create account</h2>
            <p class="text-xs text-gray-500">Doctor or pharmacy registration</p>
          </div>
          <div class="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-teal-100 text-teal-700">
            <i class="fas fa-user-plus"></i>
          </div>
        </div>
      </div>
      <div class="px-6 py-6">
        <div class="mb-5">
          <div class="flex rounded-xl border border-gray-200 bg-gray-100 p-1 w-full" role="group" aria-label="Authentication mode">
            <button
              type="button"
              class="flex-1 flex items-center justify-center px-4 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 {authMode === 'doctor' ? 'bg-white text-teal-600 shadow-sm' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}"
              on:click={handleSwitchToDoctor}
            >
              <i class="fas fa-user-md mr-2"></i>
              <span>Doctor</span>
            </button>
            <button
              type="button"
              class="flex-1 flex items-center justify-center px-4 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 {authMode === 'pharmacist' ? 'bg-white text-teal-600 shadow-sm' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}"
              on:click={handleSwitchToPharmacist}
            >
              <i class="fas fa-pills mr-2"></i>
              <span>Pharmacy</span>
            </button>
          </div>
        </div>
        <div class="rounded-2xl bg-gray-50 p-4">
          {#if authMode === 'doctor'}
            <div class="text-center mb-4">
              <h4 class="text-base font-semibold text-gray-900 mb-0">
                <i class="fas fa-user-md text-teal-600 mr-2"></i>
                Doctor Registration
              </h4>
            </div>
            <DoctorAuth allowRegister={true} registerOnly={true} />
          {:else}
            <div class="text-center mb-4">
              <h4 class="text-base font-semibold text-gray-900 mb-0">
                <i class="fas fa-pills text-teal-600 mr-2"></i>
                Pharmacy Registration
              </h4>
            </div>
            <PharmacistAuth allowRegister={true} registerOnly={true} />
          {/if}
        </div>
      </div>
      <div class="bg-gray-50 px-6 py-4 text-center text-xs text-gray-500 space-y-2">
        <div class="flex flex-wrap justify-center gap-2">
          <span class="inline-flex items-center gap-1"><i class="fas fa-shield-alt"></i> Secure</span>
          <span class="inline-flex items-center gap-1"><i class="fas fa-brain"></i> AI-Enhanced</span>
          <span class="inline-flex items-center gap-1"><i class="fas fa-user-check"></i> Role-based access</span>
        </div>
      </div>
    </div>
    <footer class="mt-6 text-center text-xs text-gray-500">
      <div class="flex flex-wrap items-center justify-center gap-3">
        <a href="/" class="text-blue-600 hover:text-blue-800 underline">Back to home</a>
      </div>
    </footer>
  </div>
</div>
