<script>
  import { onMount } from 'svelte'
  import BrandName from './BrandName.svelte'
  import PublicHeader from './PublicHeader.svelte'

  let isSriLanka = false
  let standardPrice = 'USD 20 / month'

  const detectSriLankaFromIp = async () => {
    if (typeof fetch === 'undefined') {
      return null
    }
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 2500)
    try {
      const response = await fetch('https://www.whatismyip.net/api/geoip/', {
        signal: controller.signal
      })
      if (!response.ok) {
        return null
      }
      const data = await response.json()
      const countryCode = String(data?.country_code || data?.countryCode || '').toLowerCase()
      const countryName = String(data?.country || '').toLowerCase()
      if (countryCode === 'lk' || countryName === 'sri lanka') {
        return true
      }
      return false
    } catch (error) {
      return null
    } finally {
      clearTimeout(timeoutId)
    }
  }

  onMount(async () => {
    const ipResult = await detectSriLankaFromIp()
    isSriLanka = ipResult === true
  })

  $: standardPrice = isSriLanka ? 'LKR 5000 / month' : 'USD 20 / month'

  const tiers = [
    {
      name: 'Professional',
      price: 'Free',
      cadence: 'first month',
      description: 'Best for new clinics getting started.',
      highlights: [
        'Patient history management',
        'AI based treatment suggestions based on symptoms and reports',
        'AI based drug interaction check',
        'Barcode based patient identification',
        'Barcode based prescription identification',
        'Printing prescriptions, send prescription to own pharmacy assistant\'s phone/computer',
        'Maintaining a drug inventory',
        'Notification on drug finishing',
        'Send email and SMS notifications for next appointment',
        'Auto charge calculation for each patient',
        'Daily income and monthly income reports'
      ],
      cta: 'Start free month',
      ctaHref: '/?register=1#signin',
      accent: 'border-teal-200 bg-teal-50 text-teal-700'
    },
    {
      name: 'Professional',
      price: standardPrice,
      cadence: '',
      description: 'For growing practices that need multiple staff and pharmacies.',
      highlights: [
        'Patient history management',
        'AI based treatment suggestions based on symptoms and reports',
        'AI based drug interaction check',
        'Barcode based patient identification',
        'Barcode based prescription identification',
        'Printing prescriptions, send prescription to own pharmacy assistant\'s phone/computer',
        'Maintaining a drug inventory',
        'Notification on drug finishing',
        'Send email and SMS notifications for next appointment',
        'Auto charge calculation for each patient',
        'Daily income and monthly income reports'
      ],
      cta: '',
      ctaHref: '',
      accent: 'border-gray-200 bg-white text-gray-700'
    },
    {
      name: 'Enterprise',
      price: 'Custom',
      cadence: '',
      description: 'For hospitals and networks with advanced requirements.',
      highlights: [
        'Custom integrations',
        'Dedicated onboarding',
        'Security review support',
        'Service-level agreements'
      ],
      cta: 'Request proposal',
      ctaHref: '/?contact=1',
      accent: 'border-amber-200 bg-amber-50 text-amber-700'
    }
  ]
</script>

<div class="min-h-screen bg-[radial-gradient(circle_at_top,_#e6f7f4_0%,_#f9fafb_55%,_#f3f4f6_100%)]">
  <PublicHeader />
  <div class="max-w-6xl mx-auto px-6 py-6">
    <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-10">
      <div>
        <p class="text-xs uppercase tracking-[0.2em] text-teal-600 font-semibold">
          <BrandName className="text-teal-600" />
        </p>
        <h1 class="text-3xl sm:text-4xl lg:text-5xl font-semibold text-gray-900 font-hero">Pricing</h1>
        <p class="mt-2 text-sm text-gray-600">Simple plans with a free first month for new registrations.</p>
      </div>
      <div></div>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
      {#each tiers as tier}
        <div class={`rounded-2xl border p-6 shadow-sm ${tier.accent}`}>
          <div class="flex items-center justify-between">
            <h2 class="text-lg font-semibold text-gray-900">{tier.name}</h2>
          </div>
          <div class="mt-4">
            <div class="text-3xl font-semibold text-gray-900">{tier.price}</div>
            {#if tier.cadence}
              <p class="text-xs text-gray-500">{tier.cadence}</p>
            {/if}
          </div>
          <p class="mt-3 text-sm text-gray-600">{tier.description}</p>
          <ul class="mt-4 space-y-2 text-sm text-gray-700">
            {#each tier.highlights as item}
              <li class="flex items-start gap-2">
                <i class="fas fa-check text-teal-600 mt-0.5"></i>
                <span>{item}</span>
              </li>
            {/each}
          </ul>
          {#if tier.cta}
            <a
              href={tier.ctaHref}
              class="mt-6 inline-flex w-full items-center justify-center rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800"
            >
              {tier.cta}
            </a>
          {/if}
        </div>
      {/each}
    </div>

    <div class="mt-10 rounded-2xl border border-gray-200 bg-white p-6 text-sm text-gray-600">
      <div class="flex items-start gap-3">
        <i class="fas fa-circle-info text-teal-600 mt-0.5"></i>
        <div>
          <p class="font-semibold text-gray-900">Need help choosing?</p>
          <p class="mt-1">Contact our team and we will recommend the best plan based on your clinic size and workflow.</p>
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
