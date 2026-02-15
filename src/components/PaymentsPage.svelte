<script>
  import { createEventDispatcher, onDestroy, onMount } from "svelte"
  import { onAuthStateChanged } from "firebase/auth"
  import { auth } from "../firebase-config.js"
  import { resolveCurrencyFromCountry } from "../utils/currencyByCountry.js"

  export let user = null

  const dispatch = createEventDispatcher()

  let loadingPlanId = ""
  let confirmingPayment = false
  let statusMessage = ""
  let statusTone = "info"
  let redirectHomeTimer = null

  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID
  const region = import.meta.env.VITE_FUNCTIONS_REGION || "us-central1"

  const getFunctionsBaseUrl = () => {
    if (!projectId && !import.meta.env.VITE_FUNCTIONS_BASE_URL) {
      return ""
    }
    return import.meta.env.VITE_FUNCTIONS_BASE_URL || `https://${region}-${projectId}.cloudfunctions.net`
  }

  const normalizedCurrency = (value) => {
    const code = String(value || "").trim().toUpperCase()
    return code === "LKR" ? "LKR" : "USD"
  }

  $: doctorCurrency = normalizedCurrency(
    user?.currency || resolveCurrencyFromCountry(user?.country) || "USD"
  )

  $: plans = doctorCurrency === "LKR"
    ? [
        {
          id: "professional_monthly_lkr",
          name: "Professional Monthly",
          price: "LKR 5,000",
          cadence: "/month",
          note: "Unlimited core workflow tools for one clinic"
        },
        {
          id: "professional_annual_lkr",
          name: "Professional Annual",
          price: "LKR 50,000",
          cadence: "/year",
          note: "Save two months compared with monthly billing"
        }
      ]
    : [
        {
          id: "professional_monthly_usd",
          name: "Professional Monthly",
          price: "USD 20",
          cadence: "/month",
          note: "Unlimited core workflow tools for one clinic"
        },
        {
          id: "professional_annual_usd",
          name: "Professional Annual",
          price: "USD 200",
          cadence: "/year",
          note: "Save two months compared with monthly billing"
        }
      ]

  const waitForAuthRestore = async (timeoutMs = 5000) => {
    try {
      if (typeof auth?.authStateReady === "function") {
        await auth.authStateReady()
      }
    } catch (error) {
      // Ignore and continue with fallback listener below.
    }

    if (auth?.currentUser) return

    await new Promise((resolve) => {
      let resolved = false
      const timer = setTimeout(() => {
        if (resolved) return
        resolved = true
        unsubscribe?.()
        resolve()
      }, timeoutMs)

      const unsubscribe = onAuthStateChanged(auth, () => {
        if (resolved) return
        resolved = true
        clearTimeout(timer)
        unsubscribe()
        resolve()
      })
    })
  }

  const getAuthToken = async (waitForRestore = false) => {
    if (waitForRestore) {
      await waitForAuthRestore()
    }
    return auth?.currentUser?.getIdToken?.() || ""
  }

  const clearPaymentReturnParams = () => {
    if (typeof window === "undefined") return
    const url = new URL(window.location.href)
    let changed = false
    ;["checkout", "payment", "session_id"].forEach((key) => {
      if (url.searchParams.has(key)) {
        url.searchParams.delete(key)
        changed = true
      }
    })
    if (!changed) return
    const nextUrl = `${url.pathname}${url.search}${url.hash}`
    window.history.replaceState(window.history.state, "", nextUrl || url.pathname)
  }

  const scheduleHomeRedirect = () => {
    if (redirectHomeTimer) {
      clearTimeout(redirectHomeTimer)
    }
    redirectHomeTimer = setTimeout(() => {
      dispatch("navigate-home")
    }, 1600)
  }

  const startCheckout = async (planId) => {
    if (loadingPlanId) return

    loadingPlanId = planId
    statusMessage = ""
    statusTone = "info"

    try {
      const baseUrl = getFunctionsBaseUrl()
      if (!baseUrl) {
        throw new Error("Payments service is not configured.")
      }

      const token = await getAuthToken()
      if (!token) {
        throw new Error("Please sign in again to start Stripe checkout.")
      }

      const successUrl = `${window.location.origin}${window.location.pathname}?payment=success`
      const cancelUrl = `${window.location.origin}${window.location.pathname}?payment=cancel`

      const response = await fetch(`${baseUrl}/createStripeCheckoutSession`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          planId,
          currency: doctorCurrency,
          doctorId: user?.id || "",
          email: user?.email || "",
          successUrl,
          cancelUrl
        })
      })

      const payload = await response.json().catch(() => ({}))
      if (!response.ok || !payload?.url) {
        throw new Error(payload?.error || "Unable to create checkout session.")
      }

      try {
        window.location.assign(payload.url)
      } catch (redirectError) {
        statusTone = "info"
        statusMessage = "Checkout session created. Open the Stripe URL manually if redirect is blocked."
      }
    } catch (error) {
      statusTone = "error"
      statusMessage = error?.message || "Unable to start payment."
    } finally {
      loadingPlanId = ""
    }
  }

  const confirmCheckoutSuccess = async (sessionId) => {
    if (confirmingPayment) return
    confirmingPayment = true
    statusTone = "info"
    statusMessage = "Verifying Stripe payment..."
    try {
      const baseUrl = getFunctionsBaseUrl()
      if (!baseUrl) {
        throw new Error("Payments service is not configured.")
      }
      const token = await getAuthToken(true)
      if (!token) {
        throw new Error("Payment completed. Please sign in again and refresh this page to verify account update.")
      }

      const response = await fetch(`${baseUrl}/confirmStripeCheckoutSuccess`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          sessionId,
          doctorId: user?.id || ""
        })
      })

      const payload = await response.json().catch(() => ({}))
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error || "Unable to confirm payment.")
      }

      statusTone = "info"
      statusMessage = "Payment successful. Doctor account access is updated."
      if (payload?.doctor) {
        dispatch("profile-updated", payload.doctor)
      }
      scheduleHomeRedirect()
    } catch (error) {
      statusTone = "error"
      statusMessage = error?.message || "Unable to verify payment."
    } finally {
      confirmingPayment = false
    }
  }

  onMount(async () => {
    const params = new URLSearchParams(window.location.search)
    const checkoutStatus = params.get("checkout") || params.get("payment")
    const sessionId = params.get("session_id")
    if (checkoutStatus === "success") {
      if (sessionId) {
        await confirmCheckoutSuccess(sessionId)
      } else {
        statusTone = "info"
        statusMessage = "Payment completed in Stripe. Verification may take a moment."
      }
    } else if (checkoutStatus === "cancel") {
      statusTone = "error"
      statusMessage = "Payment was canceled."
    }
    if (checkoutStatus || sessionId) {
      clearPaymentReturnParams()
    }
  })

  onDestroy(() => {
    if (redirectHomeTimer) {
      clearTimeout(redirectHomeTimer)
      redirectHomeTimer = null
    }
  })
</script>

<section class="mx-auto max-w-5xl sm:text-sm">
  <div class="rounded-2xl border border-gray-200 bg-white shadow-sm">
    <div class="border-b border-gray-100 px-4 py-4 sm:px-6">
      <h2 class="text-xl sm:text-2xl font-semibold text-gray-900 flex items-center gap-2">
        <i class="fas fa-credit-card text-teal-600"></i>
        Payments
      </h2>
      <p class="mt-1 text-sm text-gray-600">
        Secure checkout via Stripe. Currency: <span class="font-semibold text-gray-900">{doctorCurrency}</span>
      </p>
    </div>

    <div class="px-4 py-5 sm:px-6">
      <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
        {#each plans as plan}
          <article class="rounded-xl border border-gray-200 bg-gray-50 p-4 sm:p-5">
            <h3 class="text-base sm:text-lg font-semibold text-gray-900">{plan.name}</h3>
            <p class="mt-2 text-2xl font-bold text-teal-700">
              {plan.price}
              <span class="text-sm font-medium text-gray-500">{plan.cadence}</span>
            </p>
            <p class="mt-2 text-sm text-gray-600">{plan.note}</p>
            <button
              type="button"
              class="mt-4 inline-flex w-full items-center justify-center rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={Boolean(loadingPlanId) || confirmingPayment}
              on:click={() => startCheckout(plan.id)}
            >
              {#if loadingPlanId === plan.id}
                <i class="fas fa-circle-notch fa-spin mr-2"></i>
                Redirecting...
              {:else}
                <i class="fas fa-lock mr-2"></i>
                Pay with Stripe
              {/if}
            </button>
          </article>
        {/each}
      </div>

      {#if loadingPlanId || confirmingPayment}
        <div class="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800" role="status">
          <i class="fas fa-triangle-exclamation mr-2"></i>
          Payment is in progress. Do not refresh, close this tab, or switch pages until payment is complete.
        </div>
      {/if}

      {#if statusMessage}
        <div
          class="mt-4 rounded-lg border px-4 py-3 text-sm {statusTone === 'error' ? 'border-red-200 bg-red-50 text-red-700' : 'border-cyan-200 bg-cyan-50 text-cyan-700'}"
          role="alert"
        >
          {statusMessage}
        </div>
      {/if}

      <div class="mt-4 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-xs sm:text-sm text-blue-700">
        <i class="fas fa-shield-alt mr-2"></i>
        Payments are processed by Stripe. Card data is never stored in M-Prescribe.
      </div>
    </div>
  </div>
</section>
