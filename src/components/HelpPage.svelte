<script>
  import BrandName from './BrandName.svelte'
  import DoctorGettingStarted from './DoctorGettingStarted.svelte'
  import PublicHeader from './PublicHeader.svelte'

  let searchQuery = ''
</script>

<div class="min-h-screen bg-[radial-gradient(circle_at_top,_#e6f7f4_0%,_#f9fafb_55%,_#f3f4f6_100%)]">
  <PublicHeader />
  <div class="max-w-6xl mx-auto px-6 py-6">
    <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
      <div>
        <p class="text-xs uppercase tracking-[0.2em] text-teal-600 font-semibold">
          <BrandName className="text-teal-600" />
        </p>
        <h1 class="text-3xl sm:text-4xl lg:text-5xl font-semibold text-gray-900 font-hero">Help center</h1>
        <p class="mt-2 text-sm text-gray-600">Guides for doctors getting started with M-Prescribe. Includes AI based medicine name, spelling and grammar corrections.</p>
        <div class="mt-4 w-full sm:max-w-md">
          <label class="sr-only" for="help-search">Search help</label>
          <div class="relative">
            <i class="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm"></i>
            <input
              id="help-search"
              type="text"
              class="w-full rounded-full border border-gray-200 bg-white py-2 pl-9 pr-4 text-sm text-gray-700 shadow-sm focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-200"
              placeholder="Search help topics"
              bind:value={searchQuery}
            />
          </div>
        </div>
      </div>
      <div></div>
    </div>

    <DoctorGettingStarted searchQuery={searchQuery} />

    <footer class="mt-10 border-t border-gray-200 pt-6 text-sm text-gray-500 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <span>© Tronicgate Hardware and Software Services</span>
      <div class="flex items-center gap-4">
        <a href="/?privacy=1" class="text-blue-600 hover:text-blue-800 underline">Privacy Policy</a>
        <a href="/?pricing=1" class="text-blue-600 hover:text-blue-800 underline">Pricing</a>
        <a href="/?faq=1" class="text-blue-600 hover:text-blue-800 underline">FAQ</a>
        <a href="/?help=1" class="text-blue-600 hover:text-blue-800 underline">Help</a>
        <a href="/?contact=1" class="text-blue-600 hover:text-blue-800 underline">Contact us</a>
      </div>
    </footer>
  </div>
</div>
