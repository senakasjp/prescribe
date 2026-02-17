<script>
  import BrandName from './BrandName.svelte'
  import PublicHeader from './PublicHeader.svelte'

  const supportEmail = 'support@mprescribe.net'
  let name = ''
  let email = ''
  let subject = ''
  let message = ''
  let submitStatus = ''
  let submitError = ''
  let submitLoading = false

  const getFunctionsBaseUrl = () => {
    const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID
    const region = import.meta.env.VITE_FUNCTIONS_REGION || 'us-central1'
    return import.meta.env.VITE_FUNCTIONS_BASE_URL || (projectId ? `https://${region}-${projectId}.cloudfunctions.net` : '')
  }

  const openChat = () => {
    if (typeof window !== 'undefined' && window.Tawk_API && typeof window.Tawk_API.maximize === 'function') {
      window.Tawk_API.maximize()
      return
    }
    if (typeof window !== 'undefined') {
      window.__tawkOpenOnLoad = true
    }
  }

  const submitContact = async () => {
    if (typeof window === 'undefined') {
      return
    }
    submitStatus = ''
    submitError = ''
    if (!message.trim()) {
      submitError = 'Please add a message before submitting.'
      return
    }
    const baseUrl = getFunctionsBaseUrl()
    if (!baseUrl) {
      submitError = 'Email service is not configured. Please use live chat or email support.'
      return
    }
    try {
      submitLoading = true
      const response = await fetch(`${baseUrl}/sendContactEmail`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          subject: subject.trim(),
          message: message.trim()
        })
      })
      const text = await response.text()
      if (!response.ok) {
        throw new Error(text || 'Unable to send message')
      }
      submitStatus = 'Message sent. We will reply soon.'
      name = ''
      email = ''
      subject = ''
      message = ''
    } catch (error) {
      submitError = error?.message || 'Unable to send message'
    } finally {
      submitLoading = false
    }
  }
</script>

<div class="min-h-screen bg-[radial-gradient(circle_at_top,_#e6f7f4_0%,_#f9fafb_55%,_#f3f4f6_100%)]">
  <PublicHeader />
  <div class="max-w-6xl mx-auto px-6 py-6">
    <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-8">
      <div>
        <p class="text-xs uppercase tracking-[0.2em] text-teal-600 font-semibold">
          <BrandName className="text-teal-600" />
        </p>
        <h1 class="text-3xl sm:text-4xl lg:text-5xl font-semibold text-gray-900 font-hero">Contact us</h1>
        <p class="mt-2 text-sm text-gray-600">We usually reply within 1 business day.</p>
      </div>
      <div></div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div class="lg:col-span-2 space-y-6">
        <div class="rounded-3xl border border-gray-200 bg-white/90 p-6 shadow-sm">
          <h2 class="text-xl font-semibold text-gray-900">How can we help?</h2>
          <p class="mt-2 text-sm text-gray-600">
            Whether you need onboarding help, product support, or have billing questions, our team is ready to assist.
          </p>
          <div class="mt-5 flex flex-wrap gap-3">
            <a
              class="inline-flex items-center gap-2 rounded-full bg-teal-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-teal-700"
              href={`mailto:${supportEmail}?subject=Contact%20M-Prescribe`}
            >
              <i class="fas fa-envelope"></i>
              Email support
            </a>
            <button
              type="button"
              class="inline-flex items-center gap-2 rounded-full border border-teal-200 bg-teal-50 px-5 py-2 text-sm font-semibold text-teal-700 hover:bg-teal-100"
              on:click={openChat}
            >
              <i class="fas fa-comments"></i>
              Live chat
            </button>
          </div>
          <div class="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div class="rounded-2xl border border-gray-200 bg-white p-4">
              <div class="flex items-start gap-3">
                <span class="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-teal-100 text-teal-700">
                  <i class="fas fa-life-ring"></i>
                </span>
                <div>
                  <p class="text-sm font-semibold text-gray-900">Customer support</p>
                  <p class="text-xs text-gray-500">Product help, troubleshooting, and account questions.</p>
                </div>
              </div>
            </div>
            <div class="rounded-2xl border border-gray-200 bg-white p-4">
              <div class="flex items-start gap-3">
                <span class="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                  <i class="fas fa-handshake"></i>
                </span>
                <div>
                  <p class="text-sm font-semibold text-gray-900">Partnerships</p>
                  <p class="text-xs text-gray-500">Clinic partnerships, regional rollouts, and training.</p>
                </div>
              </div>
            </div>
            <div class="rounded-2xl border border-gray-200 bg-white p-4">
              <div class="flex items-start gap-3">
                <span class="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700">
                  <i class="fas fa-file-invoice-dollar"></i>
                </span>
                <div>
                  <p class="text-sm font-semibold text-gray-900">Billing</p>
                  <p class="text-xs text-gray-500">Invoices, renewals, and payment confirmations.</p>
                </div>
              </div>
            </div>
            <div class="rounded-2xl border border-gray-200 bg-white p-4">
              <div class="flex items-start gap-3">
                <span class="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                  <i class="fas fa-shield-alt"></i>
                </span>
                <div>
                  <p class="text-sm font-semibold text-gray-900">Security & privacy</p>
                  <p class="text-xs text-gray-500">Report security concerns or request compliance docs.</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="rounded-3xl border border-gray-200 bg-white/90 p-6 shadow-sm">
          <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h3 class="text-lg font-semibold text-gray-900">Send us a message</h3>
              <p class="text-sm text-gray-600">We will route your request to the right team.</p>
            </div>
            <span class="text-xs text-gray-500">Powered by email</span>
          </div>
          <form class="mt-5 space-y-4" on:submit|preventDefault={submitContact}>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label class="block text-xs font-semibold text-gray-600 mb-2" for="contact-name">Full name</label>
                <input
                  id="contact-name"
                  type="text"
                  placeholder="Enter your name"
                  class="w-full rounded-2xl border border-gray-200 bg-white px-4 py-2 text-sm text-gray-900 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-200"
                  bind:value={name}
                />
              </div>
              <div>
                <label class="block text-xs font-semibold text-gray-600 mb-2" for="contact-email">Work email</label>
                <input
                  id="contact-email"
                  type="email"
                  placeholder="you@clinic.com"
                  class="w-full rounded-2xl border border-gray-200 bg-white px-4 py-2 text-sm text-gray-900 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-200"
                  bind:value={email}
                />
              </div>
            </div>
            <div>
              <label class="block text-xs font-semibold text-gray-600 mb-2" for="contact-subject">Subject</label>
              <input
                id="contact-subject"
                type="text"
                placeholder="How can we help?"
                class="w-full rounded-2xl border border-gray-200 bg-white px-4 py-2 text-sm text-gray-900 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-200"
                bind:value={subject}
              />
            </div>
            <div>
              <label class="block text-xs font-semibold text-gray-600 mb-2" for="contact-message">Message</label>
              <textarea
                id="contact-message"
                rows="5"
                placeholder="Tell us more about your request..."
                class="w-full rounded-2xl border border-gray-200 bg-white px-4 py-2 text-sm text-gray-900 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-200"
                bind:value={message}
              ></textarea>
            </div>
            <div class="flex flex-wrap items-center gap-3">
              <button
                type="submit"
                class="inline-flex items-center gap-2 rounded-full bg-teal-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-teal-700 disabled:opacity-60"
                disabled={submitLoading}
              >
                {#if submitLoading}
                  <i class="fas fa-spinner fa-spin"></i>
                  Sending...
                {:else}
                  <i class="fas fa-paper-plane"></i>
                  Send message
                {/if}
              </button>
              <p class="text-xs text-gray-500">Messages are delivered to {supportEmail}.</p>
            </div>
            {#if submitStatus}
              <p class="text-sm text-teal-700 font-semibold">{submitStatus}</p>
            {/if}
            {#if submitError}
              <p class="text-sm text-red-600">{submitError}</p>
            {/if}
          </form>
        </div>

        <div class="rounded-3xl border border-gray-200 bg-white/90 p-6 shadow-sm">
          <h3 class="text-lg font-semibold text-gray-900">Support details</h3>
          <div class="mt-4 space-y-3 text-sm text-gray-600">
            <div class="flex items-center gap-3">
              <span class="inline-flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-gray-700">
                <i class="fas fa-envelope"></i>
              </span>
              <div>
                <p class="text-xs uppercase tracking-[0.2em] text-gray-400">Email</p>
                <a class="text-teal-700 font-semibold" href={`mailto:${supportEmail}`}>{supportEmail}</a>
              </div>
            </div>
            <div class="flex items-center gap-3">
              <span class="inline-flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-gray-700">
                <i class="fas fa-clock"></i>
              </span>
              <div>
                <p class="text-xs uppercase tracking-[0.2em] text-gray-400">Hours</p>
                <p>Monday - Friday, 9:00 AM to 6:00 PM (GMT)</p>
              </div>
            </div>
            <div class="flex items-center gap-3">
              <span class="inline-flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-gray-700">
                <i class="fas fa-map-marker-alt"></i>
              </span>
              <div>
                <p class="text-xs uppercase tracking-[0.2em] text-gray-400">Company</p>
                <p>Tronicgate Hardware and Software Services</p>
              </div>
            </div>
          </div>
          <p class="mt-5 text-xs text-gray-500">
            For urgent issues outside support hours, start a chat and our on-call team will follow up.
          </p>
        </div>
      </div>

      <div class="space-y-6">
        <div class="rounded-3xl border border-gray-200 bg-white/90 p-6 shadow-sm">
          <h3 class="text-lg font-semibold text-gray-900">Quick links</h3>
          <div class="mt-4 flex flex-col gap-3 text-sm">
            <a class="inline-flex items-center gap-2 text-teal-700 font-semibold" href="/?register=1#signin">
              <i class="fas fa-user-plus"></i>
              Start free trial
            </a>
            <a class="inline-flex items-center gap-2 text-teal-700 font-semibold" href="/?privacy=1">
              <i class="fas fa-file-shield"></i>
              Privacy policy
            </a>
          </div>
        </div>

        <div class="rounded-3xl border border-teal-200 bg-gradient-to-br from-teal-50 to-white p-6 shadow-sm">
          <div class="flex items-center gap-3">
            <span class="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-600 text-white text-xl">
              <i class="fas fa-comment-dots"></i>
            </span>
            <div>
              <p class="text-sm font-semibold text-gray-900">Prefer chat?</p>
              <p class="text-xs text-gray-500">We can answer questions live.</p>
            </div>
          </div>
          <button
            type="button"
            class="mt-4 w-full rounded-2xl bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700"
            on:click={openChat}
          >
            Open live chat
          </button>
          <p class="mt-3 text-xs text-gray-500">
            The chat widget appears in the lower-right corner after the page loads.
          </p>
        </div>
      </div>
    </div>

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
