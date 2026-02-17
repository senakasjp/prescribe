<script>
  import { createEventDispatcher, onDestroy, onMount } from "svelte"
  import { onAuthStateChanged } from "firebase/auth"
  import { auth } from "../firebase-config.js"
  import firebaseStorage from "../services/firebaseStorage.js"
  import { resolveCurrencyFromCountry } from "../utils/currencyByCountry.js"

  export let user = null

  const dispatch = createEventDispatcher()

  let loadingPlanId = ""
  let confirmingPayment = false
  let statusMessage = ""
  let statusTone = "info"
  let redirectHomeTimer = null
  let billingHistory = []
  let visibleBillingHistory = []
  let displayedBillingHistory = []
  let billingHistoryLoading = false
  let billingHistoryError = ""
  let loadedHistoryForDoctorId = ""
  let billingHistoryExpanded = false
  let billingHistoryCollapsed = false
  let canExpandBillingHistory = false
  let promoCode = ""
  let promoPreviewLoading = false
  let promoPreviewByPlan = {}
  let promoFormatMessage = ""
  let promoFormatTone = "info"
  let activeTab = "payments"
  let hasRestoredPaymentsTab = false
  let restoredPaymentsTabUserKey = ""
  const PAYMENTS_TAB_STORAGE_PREFIX = "prescribe-payments-active-tab"
  const ALLOWED_PAYMENT_TABS = new Set(["payments", "billing", "referral"])
  let checkoutAdminDiscountPercent = 0
  let serverDoctorProfile = null
  let loadedDoctorProfileId = ""
  const BILLING_HISTORY_PREVIEW_COUNT = 8
  const SUCCESS_STATUSES = new Set(["confirmed", "paid", "succeeded", "complete", "completed", "recorded"])
  const FAIL_STATUSES = new Set(["failed", "fail", "canceled", "cancelled"])

  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID
  const region = import.meta.env.VITE_FUNCTIONS_REGION || "us-central1"

  const getDoctorTabUserKey = () => String(user?.id || user?.email || user?.uid || "").trim().toLowerCase()
  const getPaymentsTabStorageKey = () => {
    const userKey = getDoctorTabUserKey()
    if (!userKey) return ""
    return `${PAYMENTS_TAB_STORAGE_PREFIX}:${userKey}`
  }
  const normalizePaymentTab = (value) => {
    const normalized = String(value || "").trim().toLowerCase()
    return ALLOWED_PAYMENT_TABS.has(normalized) ? normalized : "payments"
  }
  const restorePaymentsTab = () => {
    if (typeof window === "undefined") return
    const storageKey = getPaymentsTabStorageKey()
    if (!storageKey) return
    const stored = localStorage.getItem(storageKey)
    if (!stored) return
    activeTab = normalizePaymentTab(stored)
  }
  const persistPaymentsTab = () => {
    if (typeof window === "undefined") return
    const storageKey = getPaymentsTabStorageKey()
    if (!storageKey) return
    localStorage.setItem(storageKey, normalizePaymentTab(activeTab))
  }
  const setPaymentsTab = (tab) => {
    activeTab = normalizePaymentTab(tab)
    if (hasRestoredPaymentsTab) {
      persistPaymentsTab()
    }
  }

  $: {
    const userKey = getDoctorTabUserKey()
    if (typeof window !== "undefined" && userKey && userKey !== restoredPaymentsTabUserKey) {
      restoredPaymentsTabUserKey = userKey
      restorePaymentsTab()
      hasRestoredPaymentsTab = true
    }
  }

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

  const parseDiscountPercent = (value) => {
    if (typeof value === "number") return Number.isFinite(value) ? value : 0
    const raw = String(value ?? "").trim()
    if (!raw) return 0
    const direct = Number(raw)
    if (Number.isFinite(direct)) return direct
    const match = raw.match(/-?\d+(?:\.\d+)?/)
    if (!match) return 0
    const parsed = Number(match[0])
    return Number.isFinite(parsed) ? parsed : 0
  }

  const resolveDoctorDiscountPercent = (doctor) => Math.max(
    parseDiscountPercent(doctor?.adminStripeDiscountPercent),
    parseDiscountPercent(doctor?.adminDiscountPercent),
    parseDiscountPercent(doctor?.individualStripeDiscountPercent),
    parseDiscountPercent(doctor?.individualDiscountPercent),
    parseDiscountPercent(doctor?.stripeDiscountPercent),
    parseDiscountPercent(doctor?.doctorDiscountPercent),
    parseDiscountPercent(doctor?.discountPercent)
  )

  const normalizePromoCodeInput = (value = "") =>
    String(value || "").trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "")

  const clearPromoPreview = () => {
    promoPreviewByPlan = {}
  }

  const previewPromoForPlans = async (normalizedPromo) => {
    const baseUrl = getFunctionsBaseUrl()
    if (!baseUrl) {
      throw new Error("Payments service is not configured.")
    }
    const token = await getAuthToken()
    if (!token) {
      throw new Error("Please sign in again to validate promo.")
    }
    const successUrl = `${window.location.origin}${window.location.pathname}?payment=success`
    const cancelUrl = `${window.location.origin}${window.location.pathname}?payment=cancel`
    const responses = await Promise.all(plans.map(async (plan) => {
      const response = await fetch(`${baseUrl}/createStripeCheckoutSession`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          planId: plan.id,
          currency: doctorCurrency,
          doctorId: user?.id || "",
          email: user?.email || "",
          promoCode: normalizedPromo,
          successUrl,
          cancelUrl,
          previewOnly: true
        })
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok || payload?.success === false) {
        throw new Error(payload?.error || "Unable to validate promo code.")
      }
      return {
        planId: String(plan.id || ""),
        promoApplied: Boolean(payload?.promoApplied),
        promoValidated: Boolean(payload?.promoValidated),
        appliedDiscountSource: String(
          payload?.appliedDiscountSource ||
          (payload?.promoApplied ? "promo" : "")
        ),
        originalMinor: Number(payload?.originalAmount || plan.amountMinor || 0),
        finalMinor: Number(payload?.discountedAmount || plan.amountMinor || 0)
      }
    }))
    const nextPreview = {}
    responses.forEach((entry) => {
      nextPreview[entry.planId] = {
        promoApplied: entry.promoApplied,
        promoValidated: entry.promoValidated,
        appliedDiscountSource: entry.appliedDiscountSource,
        originalMinor: Math.max(0, Number(entry.originalMinor || 0)),
        finalMinor: Math.max(0, Number(entry.finalMinor || 0))
      }
    })
    promoPreviewByPlan = nextPreview
    return responses
  }

  const applyPromoFormat = async () => {
    const normalizedPromo = normalizePromoCodeInput(promoCode)
    promoCode = normalizedPromo
    clearPromoPreview()
    if (!normalizedPromo) {
      promoFormatTone = "error"
      promoFormatMessage = "Enter a promo code first."
      return
    }
    promoPreviewLoading = true
    try {
      const previewResults = await previewPromoForPlans(normalizedPromo)
      const appliedToAnyPlan = previewResults.some(
        (entry) => entry.appliedDiscountSource === "promo" || entry.promoApplied
      )
      const promoValidated = previewResults.some(
        (entry) => entry.promoValidated || entry.promoApplied
      )
      if (appliedToAnyPlan) {
        const highestAppliedPercent = previewResults.reduce((highest, entry) => {
          const originalMinor = Number(entry?.originalMinor || 0)
          const finalMinor = Number(entry?.finalMinor || 0)
          if (!originalMinor || finalMinor >= originalMinor) return highest
          return Math.max(highest, ((originalMinor - finalMinor) / originalMinor) * 100)
        }, 0)
        promoFormatTone = "info"
        promoFormatMessage = highestAppliedPercent > 0
          ? `Promo code applied. Up to ${formatDiscountPercent(highestAppliedPercent)}% off. Plan prices updated below.`
          : "Promo code applied. Plan prices updated below."
      } else if (promoValidated) {
        promoFormatTone = "info"
        promoFormatMessage = "Promo code is valid, but your individual discount is already higher."
      } else {
        promoFormatTone = "error"
        promoFormatMessage = "Promo code is not eligible for current plans."
      }
    } catch (error) {
      promoFormatTone = "error"
      promoFormatMessage = error?.message || "Unable to validate promo code."
    } finally {
      promoPreviewLoading = false
    }
  }

  const getProfileLookupKey = (sourceUser) => {
    const doctorId = String(sourceUser?.id || "").trim()
    if (doctorId) return doctorId
    return String(sourceUser?.email || "").trim().toLowerCase()
  }

  // Merge local + server profile for display fields, but compute discount from both sources.
  $: effectiveDoctor = serverDoctorProfile
    ? { ...(user || {}), ...(serverDoctorProfile || {}) }
    : user

  $: doctorCurrency = normalizedCurrency(
    effectiveDoctor?.currency || resolveCurrencyFromCountry(effectiveDoctor?.country) || "USD"
  )
  $: doctorAdminDiscountPercent = Math.max(
    0,
    Math.min(100, Math.max(
      resolveDoctorDiscountPercent(user),
      resolveDoctorDiscountPercent(serverDoctorProfile),
      resolveDoctorDiscountPercent(effectiveDoctor),
      parseDiscountPercent(checkoutAdminDiscountPercent)
    ))
  )
  $: doctorReferralToken = String(
    effectiveDoctor?.doctorIdShort || effectiveDoctor?.referralCode || ""
  ).trim()
  $: referralRegisterUrl = (() => {
    if (!doctorReferralToken) return ""
    if (typeof window === "undefined") return `/?register=1&ref=${encodeURIComponent(doctorReferralToken)}#signin`
    return `${window.location.origin}/?register=1&ref=${encodeURIComponent(doctorReferralToken)}#signin`
  })()
  $: whatsappShareUrl = (() => {
    if (!referralRegisterUrl) return ""
    const shareText = `Join M-Prescribe using my referral link: ${referralRegisterUrl}`
    return `https://wa.me/?text=${encodeURIComponent(shareText)}`
  })()

  $: plans = doctorCurrency === "LKR"
    ? [
        {
          id: "professional_monthly_lkr",
          name: "Professional Monthly",
          price: "LKR 5,000",
          amountMinor: 500000,
          cadence: "/month",
          note: "Unlimited core workflow tools for one clinic"
        },
        {
          id: "professional_annual_lkr",
          name: "Professional Annual",
          price: "LKR 50,000",
          amountMinor: 5000000,
          cadence: "/year",
          note: "Save two months compared with monthly billing"
        }
      ]
    : [
        {
          id: "professional_monthly_usd",
          name: "Professional Monthly",
          price: "USD 20",
          amountMinor: 2000,
          cadence: "/month",
          note: "Unlimited core workflow tools for one clinic"
        },
        {
          id: "professional_annual_usd",
          name: "Professional Annual",
          price: "USD 200",
          amountMinor: 20000,
          cadence: "/year",
          note: "Save two months compared with monthly billing"
        }
      ]

  $: pricedPlans = plans.map((plan) => {
    const baseMinor = Math.max(0, Number(plan?.amountMinor || 0))
    const preview = promoPreviewByPlan?.[String(plan?.id || "")]
    const previewFinalMinor = Number(preview?.finalMinor)
    const adminAdjustedMinor = Math.max(0, Math.round(baseMinor * (1 - doctorAdminDiscountPercent / 100)))
    const displayedMinor = Number.isFinite(previewFinalMinor)
      ? Math.max(0, previewFinalMinor)
      : adminAdjustedMinor
    const discountPercent = baseMinor > 0 && displayedMinor < baseMinor
      ? Math.max(0, Math.min(100, ((baseMinor - displayedMinor) / baseMinor) * 100))
      : 0
    return {
      ...plan,
      baseMinor,
      displayedMinor,
      showCrossedPrice: displayedMinor < baseMinor,
      discountPercent
    }
  })

  const formatAmountMinor = (minorAmount = 0, currencyCode = "USD") => {
    const amount = Number(minorAmount || 0) / 100
    return `${currencyCode} ${amount.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`
  }

  const formatDiscountPercent = (value = 0) => {
    const percent = Number(value || 0)
    if (!Number.isFinite(percent) || percent <= 0) return "0"
    return Number.isInteger(percent) ? String(percent) : percent.toFixed(1).replace(/\.0$/, "")
  }

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

  const formatDateTime = (value) => {
    if (!value) return "N/A"
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return "N/A"
    return date.toLocaleString("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true
    })
  }

  const formatBillingAmount = (record) => {
    const currency = String(record?.currency || "").toUpperCase()
    const amount = Number(record?.amount || 0)
    if (!Number.isFinite(amount) || amount <= 0) return "-"
    return `${currency ? `${currency} ` : ""}${amount.toFixed(2)}`
  }

  const getStripeOutcome = (record) => {
    const status = String(record?.status || "").toLowerCase()
    if (SUCCESS_STATUSES.has(status)) return "success"
    if (FAIL_STATUSES.has(status)) return "fail"
    return "pending"
  }

  const formatStripeOutcome = (record) => {
    const outcome = getStripeOutcome(record)
    if (outcome === "success") return "Success"
    if (outcome === "fail") return "Fail"
    return "Pending"
  }

  const loadBillingHistory = async (force = false) => {
    const doctorId = String(user?.id || "").trim()
    if (!doctorId) {
      billingHistory = []
      billingHistoryError = ""
      return
    }
    if (!force && loadedHistoryForDoctorId === doctorId && billingHistory.length > 0) {
      return
    }
    billingHistoryLoading = true
    billingHistoryError = ""
    try {
      billingHistory = await firebaseStorage.getDoctorPaymentRecords(
        doctorId,
        200,
        String(user?.email || "").trim().toLowerCase()
      )
      billingHistoryExpanded = false
      billingHistoryCollapsed = false
      loadedHistoryForDoctorId = doctorId
    } catch (error) {
      billingHistory = []
      billingHistoryError = error?.message || "Unable to load billing history."
    } finally {
      billingHistoryLoading = false
    }
  }

  const loadServerDoctorProfile = async (force = false) => {
    const doctorId = String(user?.id || "").trim()
    const doctorEmail = String(user?.email || "").trim().toLowerCase()
    const profileLookupKey = getProfileLookupKey(user)
    if (!profileLookupKey) {
      serverDoctorProfile = null
      loadedDoctorProfileId = ""
      return
    }
    if (!force && loadedDoctorProfileId === profileLookupKey && serverDoctorProfile) {
      return
    }
    try {
      let latestDoctor = null
      if (doctorId) {
        latestDoctor = await firebaseStorage.getDoctorById(doctorId)
      }
      if (!latestDoctor?.id && doctorEmail) {
        latestDoctor = await firebaseStorage.getDoctorByEmail(doctorEmail)
      }
      if (latestDoctor?.id) {
        serverDoctorProfile = latestDoctor
      } else {
        serverDoctorProfile = null
      }
      loadedDoctorProfileId = profileLookupKey
    } catch (error) {
      // Keep using existing user prop when profile refresh fails.
    }
  }

  $: visibleBillingHistory = (billingHistory || []).filter((record) => {
    const source = String(record?.source || "").toLowerCase()
    const sourceCollection = String(record?.sourceCollection || "").toLowerCase()
    const isStripeRecord = source.includes("stripe") || sourceCollection.includes("stripe")
    if (!isStripeRecord) return true
    return getStripeOutcome(record) !== "pending"
  })
  $: displayedBillingHistory = billingHistoryExpanded
    ? visibleBillingHistory
    : visibleBillingHistory.slice(0, BILLING_HISTORY_PREVIEW_COUNT)
  $: canExpandBillingHistory = visibleBillingHistory.length > BILLING_HISTORY_PREVIEW_COUNT

  const startCheckout = async (planId) => {
    if (loadingPlanId) return
    if (doctorAdminDiscountPercent >= 100) {
      statusTone = "info"
      statusMessage = "This account has 100% admin discount. Payment is not required."
      return
    }

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
          promoCode: normalizePromoCodeInput(promoCode),
          successUrl,
          cancelUrl
        })
      })

      const payload = await response.json().catch(() => ({}))
      if (!response.ok || !payload?.url) {
        throw new Error(payload?.error || "Unable to create checkout session.")
      }

      const original = Number(payload?.originalAmount || 0) / 100
      const discounted = Number(payload?.discountedAmount || 0) / 100
      const adminDiscountPercent = Number(payload?.adminDiscountPercent || 0)
      const appliedDiscountSource = String(
        payload?.appliedDiscountSource ||
        (payload?.promoApplied ? "promo" : (adminDiscountPercent > 0 ? "individual" : "none"))
      )
      checkoutAdminDiscountPercent = Math.max(0, Math.min(100, adminDiscountPercent))
      if (checkoutAdminDiscountPercent >= 100) {
        statusTone = "info"
        statusMessage = "This account has 100% admin discount. Payment is not required."
        return
      }
      if (appliedDiscountSource === "promo" && payload?.promoApplied) {
        const appliedPercent = original > 0 ? ((original - discounted) / original) * 100 : 0
        statusTone = "info"
        statusMessage = `Promo ${payload?.promoCode || promoCode.trim().toUpperCase()} applied (${formatDiscountPercent(appliedPercent)}% off). ${doctorCurrency} ${original.toFixed(2)} -> ${doctorCurrency} ${discounted.toFixed(2)}.`
      } else if (payload?.promoValidated && appliedDiscountSource === "individual" && adminDiscountPercent > 0) {
        statusTone = "info"
        statusMessage = `Individual discount ${adminDiscountPercent}% is higher than promo and was applied. ${doctorCurrency} ${original.toFixed(2)} -> ${doctorCurrency} ${discounted.toFixed(2)}.`
      } else if (adminDiscountPercent > 0) {
        statusTone = "info"
        statusMessage = `Individual discount ${adminDiscountPercent}% applied. ${doctorCurrency} ${original.toFixed(2)} -> ${doctorCurrency} ${discounted.toFixed(2)}.`
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
      await loadBillingHistory(true)
      scheduleHomeRedirect()
    } catch (error) {
      statusTone = "error"
      statusMessage = error?.message || "Unable to verify payment."
    } finally {
      confirmingPayment = false
    }
  }

  onMount(async () => {
    if (!hasRestoredPaymentsTab) {
      restorePaymentsTab()
      hasRestoredPaymentsTab = true
    }
    const params = new URLSearchParams(window.location.search)
    const checkoutStatus = params.get("checkout") || params.get("payment")
    const sessionId = params.get("session_id")
    if (checkoutStatus === "success") {
      setPaymentsTab("payments")
      if (sessionId) {
        await confirmCheckoutSuccess(sessionId)
      } else {
        statusTone = "info"
        statusMessage = "Payment completed in Stripe. Verification may take a moment."
      }
    } else if (checkoutStatus === "cancel") {
      setPaymentsTab("payments")
      statusTone = "error"
      statusMessage = "Payment was canceled."
    }
    if (checkoutStatus || sessionId) {
      clearPaymentReturnParams()
    }
    await loadServerDoctorProfile(true)
    await loadBillingHistory(true)

    const handleWindowFocus = () => {
      loadServerDoctorProfile(true)
    }
    window.addEventListener("focus", handleWindowFocus)
    return () => {
      window.removeEventListener("focus", handleWindowFocus)
    }
  })

  $: if (typeof window !== "undefined" && hasRestoredPaymentsTab) {
    persistPaymentsTab()
  }

  $: if (getProfileLookupKey(user) && loadedDoctorProfileId !== getProfileLookupKey(user)) {
    loadServerDoctorProfile(true)
  }

  $: if (user?.id && loadedHistoryForDoctorId !== user.id) {
    loadBillingHistory(true)
  }

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
      <div class="mb-5 border-b border-gray-200" role="tablist" aria-label="Payments sections">
        <div class="flex flex-wrap gap-2">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "payments"}
            aria-controls="payments-tab-panel"
            class="inline-flex items-center rounded-t-lg border px-4 py-2 text-sm font-semibold transition-colors {activeTab === 'payments' ? 'border-cyan-300 bg-cyan-50 text-cyan-700' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'}"
            on:click={() => {
              setPaymentsTab("payments")
              loadServerDoctorProfile(true)
            }}
          >
            <i class="fas fa-credit-card mr-2"></i>
            Payments
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "billing"}
            aria-controls="billing-tab-panel"
            class="inline-flex items-center rounded-t-lg border px-4 py-2 text-sm font-semibold transition-colors {activeTab === 'billing' ? 'border-cyan-300 bg-cyan-50 text-cyan-700' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'}"
            on:click={() => { setPaymentsTab("billing") }}
          >
            <i class="fas fa-receipt mr-2"></i>
            Billing History
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "referral"}
            aria-controls="referral-tab-panel"
            class="inline-flex items-center rounded-t-lg border px-4 py-2 text-sm font-semibold transition-colors {activeTab === 'referral' ? 'border-cyan-300 bg-cyan-50 text-cyan-700' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'}"
            on:click={() => { setPaymentsTab("referral") }}
          >
            <i class="fas fa-link mr-2"></i>
            Referral
          </button>
        </div>
      </div>

      {#if activeTab === "payments"}
        <div id="payments-tab-panel" role="tabpanel">
          {#if doctorAdminDiscountPercent > 0}
            <div class="mb-4 rounded-lg border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm text-cyan-800" role="status">
              <i class="fas fa-percent mr-2"></i>
              Admin discount active: <span class="font-semibold">{doctorAdminDiscountPercent}%</span>
              {#if doctorAdminDiscountPercent >= 100}
                . Full discount applied. Payment buttons are hidden.
              {/if}
            </div>
          {/if}

          <div class="mb-4 rounded-xl border border-gray-200 bg-gray-50 p-4">
            <label for="promoCode" class="block text-sm font-semibold text-gray-900">Promo code (optional)</label>
            <div class="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
              <input
                id="promoCode"
                type="text"
                class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm uppercase tracking-wide text-gray-900 focus:outline-none focus:ring-2 focus:ring-cyan-200 focus:border-cyan-400"
                placeholder="e.g. NEWDOC25"
                bind:value={promoCode}
                maxlength="24"
              />
              <button
                type="button"
                class="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-100"
                on:click={applyPromoFormat}
                disabled={promoPreviewLoading || Boolean(loadingPlanId) || confirmingPayment}
              >
                {promoPreviewLoading ? "Applying..." : "Apply"}
              </button>
            </div>
            <p class="mt-2 text-xs text-gray-500">Promo is validated securely on server during checkout creation.</p>
            {#if promoFormatMessage}
              <p class="mt-1 text-xs {promoFormatTone === 'error' ? 'text-red-600' : 'text-cyan-700'}">
                {promoFormatMessage}
              </p>
            {/if}
          </div>

          <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
            {#each pricedPlans as plan}
              <article class="rounded-xl border border-gray-200 bg-gray-50 p-4 sm:p-5">
                <h3 class="text-base sm:text-lg font-semibold text-gray-900">{plan.name}</h3>
                {#if plan.showCrossedPrice}
                  <p class="mt-2 text-sm text-gray-500 line-through">
                    {formatAmountMinor(plan.baseMinor, doctorCurrency)}
                    <span class="text-xs font-medium text-gray-400">{plan.cadence}</span>
                  </p>
                  <p class="text-2xl font-bold text-teal-700">
                    {doctorAdminDiscountPercent >= 100 || plan.displayedMinor <= 0 ? "FREE" : formatAmountMinor(plan.displayedMinor, doctorCurrency)}
                    <span class="text-sm font-medium text-gray-500">{plan.cadence}</span>
                  </p>
                  <p class="mt-1 text-xs font-semibold text-cyan-700">
                    {formatDiscountPercent(plan.discountPercent)}% discount applied
                  </p>
                {:else}
                  <p class="mt-2 text-2xl font-bold text-teal-700">
                    {formatAmountMinor(plan.baseMinor, doctorCurrency)}
                    <span class="text-sm font-medium text-gray-500">{plan.cadence}</span>
                  </p>
                {/if}
                <p class="mt-2 text-sm text-gray-600">{plan.note}</p>
                {#if doctorAdminDiscountPercent < 100}
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
                {/if}
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
      {/if}

      {#if activeTab === "billing"}
        <div id="billing-tab-panel" role="tabpanel" class="rounded-xl border border-gray-200 bg-white">
          <div class="flex items-center justify-between border-b border-gray-100 px-4 py-3">
            <h3 class="text-base font-semibold text-gray-900">
              <i class="fas fa-receipt mr-2 text-teal-600"></i>
              Billing History
            </h3>
            <div class="flex items-center gap-2">
              <button
                type="button"
                class="inline-flex items-center rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                on:click={() => {
                  billingHistoryCollapsed = !billingHistoryCollapsed
                }}
              >
                <i class="fas {billingHistoryCollapsed ? 'fa-expand-alt' : 'fa-compress-alt'} mr-2"></i>
                {billingHistoryCollapsed ? "Show history" : "Shrink history"}
              </button>
              <button
                type="button"
                class="inline-flex items-center rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                on:click={() => loadBillingHistory(true)}
                disabled={billingHistoryLoading}
              >
                <i class="fas fa-sync-alt mr-2"></i>
                Refresh
              </button>
            </div>
          </div>
          <div class="p-4">
            {#if billingHistoryCollapsed}
              <p class="text-sm text-gray-500">Billing history is collapsed.</p>
            {:else if billingHistoryError}
              <p class="text-sm text-red-600">{billingHistoryError}</p>
            {:else if billingHistoryLoading}
              <p class="text-sm text-gray-500">Loading billing history...</p>
            {:else if visibleBillingHistory.length === 0}
              <p class="text-sm text-gray-500">No Stripe-confirmed billing records yet.</p>
            {:else}
              <div class="overflow-x-auto">
                <table class="min-w-full divide-y divide-gray-200 text-sm">
                  <thead class="bg-gray-50">
                    <tr>
                      <th class="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Time</th>
                      <th class="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Amount</th>
                      <th class="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Status</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-gray-200 bg-white">
                    {#each displayedBillingHistory as record (record.id)}
                      <tr>
                        <td class="px-3 py-2 text-gray-900">{formatDateTime(record.createdAt)}</td>
                        <td class="px-3 py-2 text-gray-700">{formatBillingAmount(record)}</td>
                        <td class="px-3 py-2 text-gray-700">{formatStripeOutcome(record)}</td>
                      </tr>
                    {/each}
                  </tbody>
                </table>
              </div>
              {#if canExpandBillingHistory}
                <div class="mt-3 flex justify-end">
                  <button
                    type="button"
                    class="inline-flex items-center rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                    on:click={() => {
                      billingHistoryExpanded = !billingHistoryExpanded
                    }}
                  >
                    <i class="fas {billingHistoryExpanded ? 'fa-compress-alt' : 'fa-expand-alt'} mr-2"></i>
                    {billingHistoryExpanded ? "Show less" : "Expand history"}
                  </button>
                </div>
              {/if}
            {/if}
          </div>
        </div>
      {/if}

      {#if activeTab === "referral"}
        <div id="referral-tab-panel" role="tabpanel">
          {#if referralRegisterUrl}
            <div class="rounded-xl border border-slate-700 bg-slate-900/70 p-4">
              <p class="text-sm font-semibold text-slate-100">Referral Link</p>
              <p class="mt-1 text-xs text-slate-300">
                Every registrant via referral who continues using for a month will add a free month for you.
              </p>
              <a
                href={referralRegisterUrl}
                target="_blank"
                rel="noopener noreferrer"
                class="mt-2 inline-flex items-center gap-2 break-all text-xs font-semibold text-cyan-300 underline hover:text-cyan-200"
              >
                <i class="fas fa-up-right-from-square text-[10px]"></i>
                {referralRegisterUrl}
              </a>
              {#if whatsappShareUrl}
                <div class="mt-2">
                  <a
                    href={whatsappShareUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    class="inline-flex items-center gap-2 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-300"
                    aria-label="Share referral link on WhatsApp"
                  >
                    <i class="fab fa-whatsapp"></i>
                    Share on WhatsApp
                  </a>
                </div>
              {/if}
            </div>
          {:else}
            <div class="rounded-xl border border-slate-700 bg-slate-900/70 px-4 py-3 text-sm text-slate-300">
              Referral link is not available yet.
            </div>
          {/if}
        </div>
      {/if}
    </div>
  </div>
</section>
