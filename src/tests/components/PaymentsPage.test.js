import { render, screen } from "@testing-library/svelte"
import userEvent from "@testing-library/user-event"
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import PaymentsPage from "../../components/PaymentsPage.svelte"
import { auth } from "../../firebase-config.js"
import firebaseStorage from "../../services/firebaseStorage.js"

vi.mock("../../firebase-config.js", () => ({
  auth: {
    currentUser: {
      getIdToken: vi.fn().mockResolvedValue("doctor-token")
    }
  }
}))

vi.mock("../../services/firebaseStorage.js", () => ({
  default: {
    getDoctorById: vi.fn().mockResolvedValue(null),
    getDoctorByEmail: vi.fn().mockResolvedValue(null),
    getDoctorPaymentRecords: vi.fn().mockResolvedValue([])
  }
}))

describe("PaymentsPage.svelte", () => {
  const originalEnv = {
    ...import.meta.env
  }
  const openBillingHistoryTab = async (user) => {
    await user.click(screen.getByRole("tab", { name: /Billing History/i }))
  }
  const parseCheckoutRequestBody = () => {
    const [, request] = fetch.mock.calls[0]
    return JSON.parse(String(request.body || "{}"))
  }

  beforeEach(() => {
    firebaseStorage.getDoctorById.mockResolvedValue(null)
    firebaseStorage.getDoctorByEmail.mockResolvedValue(null)
    firebaseStorage.getDoctorPaymentRecords.mockResolvedValue([])
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        success: true,
        url: "https://checkout.stripe.com/c/pay/cs_test_123"
      })
    }))
    import.meta.env.VITE_FUNCTIONS_BASE_URL = "https://example-functions.test"
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    import.meta.env.VITE_FUNCTIONS_BASE_URL = originalEnv.VITE_FUNCTIONS_BASE_URL
    window.history.pushState({}, "", "/")
  })

  it("creates a Stripe checkout session for the selected plan", async () => {
    const user = userEvent.setup()
    render(PaymentsPage, {
      props: {
        user: {
          id: "doctor-1",
          email: "doctor@test.com",
          country: "United States",
          currency: "USD"
        }
      }
    })

    await user.click(screen.getAllByRole("button", { name: /Pay with Stripe/i })[0])

    expect(fetch).toHaveBeenCalledTimes(1)
    const [url, request] = fetch.mock.calls[0]
    expect(url).toBe("https://example-functions.test/createStripeCheckoutSession")
    expect(request.method).toBe("POST")
    expect(request.headers.Authorization).toBe("Bearer doctor-token")
    const body = parseCheckoutRequestBody()
    expect(body.planId).toBe("professional_monthly_usd")
    expect(body.currency).toBe("USD")
    expect(body.doctorId).toBe("doctor-1")
    expect(body.email).toBe("doctor@test.com")
    expect(body.promoCode).toBe("")
    expect(body.successUrl).toContain("?payment=success")
    expect(body.cancelUrl).toContain("?payment=cancel")
    expect(firebaseStorage.getDoctorPaymentRecords).toHaveBeenCalledWith(
      "doctor-1",
      200,
      "doctor@test.com"
    )
  })

  it("shows referral explanation and opens referral link in a new tab", async () => {
    const user = userEvent.setup()
    render(PaymentsPage, {
      props: {
        user: {
          id: "doctor-1",
          email: "doctor@test.com",
          country: "United States",
          currency: "USD",
          doctorIdShort: "DR12345"
        }
      }
    })

    await user.click(screen.getByRole("tab", { name: /Referral/i }))
    expect(await screen.findByText("Referral Link")).toBeInTheDocument()
    expect(
      screen.getByText(/continues using for a month will add a free month for you/i)
    ).toBeInTheDocument()
    const referralLink = screen.getByRole("link", {
      name: /register=1&ref=DR12345#signin/i
    })
    expect(referralLink).toHaveAttribute("target", "_blank")
    expect(referralLink).toHaveAttribute("rel", expect.stringContaining("noopener"))
    expect(referralLink).toHaveAttribute("rel", expect.stringContaining("noreferrer"))
    const whatsappShareLink = screen.getByRole("link", { name: /Share referral link on WhatsApp/i })
    expect(whatsappShareLink).toHaveAttribute("target", "_blank")
    expect(whatsappShareLink).toHaveAttribute("href", expect.stringContaining("https://wa.me/?text="))
    expect(whatsappShareLink).toHaveAttribute("href", expect.stringContaining(encodeURIComponent("register=1&ref=DR12345#signin")))
  })

  it("shows an auth error when token is unavailable", async () => {
    auth.currentUser.getIdToken.mockResolvedValueOnce("")
    const user = userEvent.setup()
    render(PaymentsPage, {
      props: {
        user: {
          id: "doctor-1",
          email: "doctor@test.com",
          country: "United States",
          currency: "USD"
        }
      }
    })

    await user.click(screen.getAllByRole("button", { name: /Pay with Stripe/i })[0])

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Please sign in again to start Stripe checkout."
    )
    expect(fetch).not.toHaveBeenCalled()
  })

  it("shows backend checkout errors returned by createStripeCheckoutSession", async () => {
    fetch.mockResolvedValueOnce({
      ok: false,
      json: vi.fn().mockResolvedValue({
        success: false,
        error: "Stripe checkout is temporarily unavailable."
      })
    })
    const user = userEvent.setup()
    render(PaymentsPage, {
      props: {
        user: {
          id: "doctor-1",
          email: "doctor@test.com",
          country: "United States",
          currency: "USD"
        }
      }
    })

    await user.click(screen.getAllByRole("button", { name: /Pay with Stripe/i })[0])

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Stripe checkout is temporarily unavailable."
    )
  })

  it("sends promo code in checkout request and shows promo applied message", async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValue({
        success: true,
        url: "https://checkout.stripe.com/c/pay/cs_test_promo",
        promoApplied: true,
        promoValidated: true,
        appliedDiscountSource: "promo",
        promoCode: "WELCOME25",
        originalAmount: 2000,
        discountedAmount: 1500
      })
    })
    const user = userEvent.setup()
    render(PaymentsPage, {
      props: {
        user: {
          id: "doctor-1",
          email: "doctor@test.com",
          country: "United States",
          currency: "USD"
        }
      }
    })

    await user.type(screen.getByLabelText("Promo code (optional)"), "welcome25")
    await user.click(screen.getAllByRole("button", { name: /Pay with Stripe/i })[0])

    const body = parseCheckoutRequestBody()
    expect(body.planId).toBe("professional_monthly_usd")
    expect(body.currency).toBe("USD")
    expect(body.doctorId).toBe("doctor-1")
    expect(body.email).toBe("doctor@test.com")
    expect(body.promoCode).toBe("WELCOME25")
    expect(await screen.findByRole("alert")).toHaveTextContent(/promo WELCOME25 applied/i)
  })

  it("applies promo preview on cards when Apply is clicked", async () => {
    const user = userEvent.setup()
    fetch.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValue({
        success: true,
        previewOnly: true,
        promoApplied: true,
        promoValidated: true,
        appliedDiscountSource: "promo",
        originalAmount: 2000,
        discountedAmount: 1500
      })
    })
    fetch.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValue({
        success: true,
        previewOnly: true,
        promoApplied: true,
        promoValidated: true,
        appliedDiscountSource: "promo",
        originalAmount: 20000,
        discountedAmount: 15000
      })
    })
    render(PaymentsPage, {
      props: {
        user: {
          id: "doctor-1",
          email: "doctor@test.com",
          country: "United States",
          currency: "USD"
        }
      }
    })

    await user.type(screen.getByLabelText("Promo code (optional)"), "  mpresc26  ")
    await user.click(screen.getByRole("button", { name: "Apply" }))

    expect(screen.getByLabelText("Promo code (optional)")).toHaveValue("MPRESC26")
    expect(
      screen.getByText(/promo code applied\. plan prices updated below/i)
    ).toBeInTheDocument()
    expect(fetch).toHaveBeenCalledTimes(2)
    const previewBodyOne = JSON.parse(String(fetch.mock.calls[0]?.[1]?.body || "{}"))
    const previewBodyTwo = JSON.parse(String(fetch.mock.calls[1]?.[1]?.body || "{}"))
    expect(previewBodyOne.previewOnly).toBe(true)
    expect(previewBodyTwo.previewOnly).toBe(true)
    expect(await screen.findByText(/USD 15\.00/)).toBeInTheDocument()
    expect(await screen.findByText(/USD 150\.00/)).toBeInTheDocument()
  })

  it("keeps original prices when promo is not eligible", async () => {
    const user = userEvent.setup()
    fetch.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValue({
        success: true,
        previewOnly: true,
        promoApplied: false,
        originalAmount: 2000,
        discountedAmount: 2000
      })
    })
    fetch.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValue({
        success: true,
        previewOnly: true,
        promoApplied: false,
        originalAmount: 20000,
        discountedAmount: 20000
      })
    })

    render(PaymentsPage, {
      props: {
        user: {
          id: "doctor-1",
          email: "doctor@test.com",
          country: "United States",
          currency: "USD"
        }
      }
    })

    expect(screen.getByText(/USD 20\.00/)).toBeInTheDocument()
    expect(screen.getByText(/USD 200\.00/)).toBeInTheDocument()

    await user.type(screen.getByLabelText("Promo code (optional)"), "NOTELIGIBLE")
    await user.click(screen.getByRole("button", { name: "Apply" }))

    expect(
      await screen.findByText(/promo code is not eligible for current plans/i)
    ).toBeInTheDocument()
    expect(screen.getByText(/USD 20\.00/)).toBeInTheDocument()
    expect(screen.getByText(/USD 200\.00/)).toBeInTheDocument()
    expect(screen.queryByText(/USD 15\.00/)).not.toBeInTheDocument()
    expect(screen.queryByText(/USD 150\.00/)).not.toBeInTheDocument()
  })

  it("shows admin discount message when server applies persistent doctor discount", async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValue({
        success: true,
        url: "https://checkout.stripe.com/c/pay/cs_test_admin_discount",
        promoApplied: false,
        adminDiscountPercent: 30,
        originalAmount: 2000,
        discountedAmount: 1400
      })
    })
    const user = userEvent.setup()
    render(PaymentsPage, {
      props: {
        user: {
          id: "doctor-1",
          email: "doctor@test.com",
          country: "United States",
          currency: "USD"
        }
      }
    })

    await user.click(screen.getAllByRole("button", { name: /Pay with Stripe/i })[0])

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Individual discount 30% applied. USD 20.00 -> USD 14.00."
    )
  })

  it("shows 100% discount message and hides payment buttons when checkout response reports full admin discount", async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValue({
        success: true,
        url: "https://checkout.stripe.com/c/pay/cs_test_full_discount",
        promoApplied: false,
        adminDiscountPercent: 100,
        originalAmount: 2000,
        discountedAmount: 50
      })
    })
    const user = userEvent.setup()
    render(PaymentsPage, {
      props: {
        user: {
          id: "doctor-1",
          email: "doctor@test.com",
          country: "United States",
          currency: "USD",
          adminStripeDiscountPercent: 0
        }
      }
    })

    await user.click(screen.getAllByRole("button", { name: /Pay with Stripe/i })[0])

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "This account has 100% admin discount. Payment is not required."
    )
    expect(await screen.findByText(/Full discount applied/i)).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Pay with Stripe/i })).not.toBeInTheDocument()
  })

  it("shows active admin discount banner on payments page", async () => {
    render(PaymentsPage, {
      props: {
        user: {
          id: "doctor-1",
          email: "doctor@test.com",
          country: "United States",
          currency: "USD",
          adminStripeDiscountPercent: 25
        }
      }
    })

    expect(await screen.findByText(/Admin discount active:/i)).toBeInTheDocument()
    expect(screen.getByText(/25%/)).toBeInTheDocument()
    expect(screen.getAllByRole("button", { name: /Pay with Stripe/i }).length).toBeGreaterThan(0)
  })

  it("hides Stripe payment buttons when admin discount is 100%", async () => {
    render(PaymentsPage, {
      props: {
        user: {
          id: "doctor-1",
          email: "doctor@test.com",
          country: "United States",
          currency: "USD",
          adminStripeDiscountPercent: 100
        }
      }
    })

    expect(await screen.findByText(/Full discount applied/i)).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Pay with Stripe/i })).not.toBeInTheDocument()
  })

  it("hides Stripe payment buttons when individual discount is 100%", async () => {
    render(PaymentsPage, {
      props: {
        user: {
          id: "doctor-1",
          email: "doctor@test.com",
          country: "United States",
          currency: "USD",
          individualStripeDiscountPercent: 100
        }
      }
    })

    expect(await screen.findByText(/Admin discount active:/i)).toBeInTheDocument()
    expect(screen.getByText(/100%/)).toBeInTheDocument()
    expect(screen.getAllByText("FREE").length).toBeGreaterThan(0)
    expect(screen.queryByRole("button", { name: /Pay with Stripe/i })).not.toBeInTheDocument()
  })

  it("hides Stripe payment buttons when discount is provided via stripeDiscountPercent alias", async () => {
    render(PaymentsPage, {
      props: {
        user: {
          id: "doctor-1",
          email: "doctor@test.com",
          country: "United States",
          currency: "USD",
          stripeDiscountPercent: 100
        }
      }
    })

    expect(await screen.findByText(/Admin discount active:/i)).toBeInTheDocument()
    expect(screen.getByText(/100%/)).toBeInTheDocument()
    expect(screen.getAllByText("FREE").length).toBeGreaterThan(0)
    expect(screen.queryByRole("button", { name: /Pay with Stripe/i })).not.toBeInTheDocument()
  })

  it("hides Stripe payment buttons when admin discount is stored as '100%'", async () => {
    render(PaymentsPage, {
      props: {
        user: {
          id: "doctor-1",
          email: "doctor@test.com",
          country: "United States",
          currency: "USD",
          adminStripeDiscountPercent: "100%"
        }
      }
    })

    expect(await screen.findByText(/Full discount applied/i)).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Pay with Stripe/i })).not.toBeInTheDocument()
  })

  it("hides Stripe payment buttons when server profile has 100% discount even if user prop is stale", async () => {
    firebaseStorage.getDoctorById.mockResolvedValueOnce({
      id: "doctor-1",
      adminStripeDiscountPercent: 100
    })

    render(PaymentsPage, {
      props: {
        user: {
          id: "doctor-1",
          email: "doctor@test.com",
          country: "United States",
          currency: "USD",
          adminStripeDiscountPercent: 0
        }
      }
    })

    expect(await screen.findByText(/Full discount applied/i)).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Pay with Stripe/i })).not.toBeInTheDocument()
  })

  it("hides Stripe payment buttons when doctor id lookup misses but email lookup has 100% discount", async () => {
    firebaseStorage.getDoctorById.mockResolvedValueOnce(null)
    firebaseStorage.getDoctorByEmail.mockResolvedValueOnce({
      id: "doctor-doc-id",
      email: "doctor@test.com",
      adminStripeDiscountPercent: 100
    })

    render(PaymentsPage, {
      props: {
        user: {
          id: "firebase-uid-123",
          email: "doctor@test.com",
          country: "United States",
          currency: "USD",
          adminStripeDiscountPercent: 0
        }
      }
    })

    expect(await screen.findByText(/Full discount applied/i)).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Pay with Stripe/i })).not.toBeInTheDocument()
  })

  it("hides Stripe payment buttons when user id is missing but email profile has 100% discount", async () => {
    firebaseStorage.getDoctorByEmail.mockResolvedValueOnce({
      id: "doctor-doc-id",
      email: "doctor@test.com",
      adminStripeDiscountPercent: 100
    })

    render(PaymentsPage, {
      props: {
        user: {
          email: "doctor@test.com",
          country: "United States",
          currency: "USD",
          adminStripeDiscountPercent: 0
        }
      }
    })

    expect(await screen.findByText(/Full discount applied/i)).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Pay with Stripe/i })).not.toBeInTheDocument()
    expect(firebaseStorage.getDoctorById).not.toHaveBeenCalled()
    expect(firebaseStorage.getDoctorByEmail).toHaveBeenCalledWith("doctor@test.com")
  })

  it("shows full-discount banner after async server profile load and removes all Stripe pay buttons", async () => {
    let resolveDoctorProfile
    const delayedDoctorProfile = new Promise((resolve) => {
      resolveDoctorProfile = resolve
    })

    firebaseStorage.getDoctorById.mockImplementationOnce(() => delayedDoctorProfile)

    render(PaymentsPage, {
      props: {
        user: {
          id: "doctor-async-1",
          email: "doctor@test.com",
          country: "United States",
          currency: "USD",
          adminStripeDiscountPercent: 0
        }
      }
    })

    expect(screen.queryByText(/Full discount applied/i)).not.toBeInTheDocument()
    expect(screen.getAllByRole("button", { name: /Pay with Stripe/i })).toHaveLength(2)

    resolveDoctorProfile({
      id: "doctor-async-1",
      email: "doctor@test.com",
      adminStripeDiscountPercent: 100
    })

    expect(await screen.findByText(/Admin discount active:/i)).toBeInTheDocument()
    expect(await screen.findByText(/Full discount applied/i)).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Pay with Stripe/i })).not.toBeInTheDocument()
  })

  it("shows billing history for doctor payments", async () => {
    const user = userEvent.setup()
    firebaseStorage.getDoctorPaymentRecords.mockResolvedValueOnce([
      {
        id: "rec-1",
        createdAt: "2026-02-15T21:50:00.000Z",
        type: "stripe_checkout",
        monthsDelta: 1,
        amount: 5000,
        currency: "LKR",
        status: "confirmed",
        referenceId: "cs_test_123"
      }
    ])

    render(PaymentsPage, {
      props: {
        user: {
          id: "doctor-1",
          email: "doctor@test.com",
          country: "Sri Lanka",
          currency: "LKR"
        }
      }
    })

    expect(screen.queryByText("LKR 5000.00")).not.toBeInTheDocument()
    await openBillingHistoryTab(user)
    expect(await screen.findByRole("heading", { name: "Billing History" })).toBeInTheDocument()
    expect(await screen.findByText("LKR 5000.00")).toBeInTheDocument()
    expect(await screen.findByText("Success")).toBeInTheDocument()
  })

  it("refreshes billing history when refresh is clicked", async () => {
    const user = userEvent.setup()
    firebaseStorage.getDoctorPaymentRecords
      .mockResolvedValueOnce([
        {
          id: "rec-old",
          createdAt: "2026-02-15T20:00:00.000Z",
          type: "stripe_checkout",
          monthsDelta: 1,
          amount: 5000,
          currency: "LKR",
          status: "created",
          source: "stripeCheckoutLogs",
          sourceCollection: "stripeCheckoutLogs",
          referenceId: "cs_old"
        }
      ])
      .mockResolvedValueOnce([
        {
          id: "rec-new",
          createdAt: "2026-02-15T21:00:00.000Z",
          type: "stripe_checkout",
          monthsDelta: 1,
          amount: 5000,
          currency: "LKR",
          status: "confirmed",
          referenceId: "cs_new"
        }
      ])

    render(PaymentsPage, {
      props: {
        user: {
          id: "doctor-1",
          email: "doctor@test.com",
          country: "Sri Lanka",
          currency: "LKR"
        }
      }
    })

    await openBillingHistoryTab(user)
    expect(await screen.findByText("No Stripe-confirmed billing records yet.")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Refresh" }))
    expect(await screen.findByText("LKR 5000.00")).toBeInTheDocument()
    expect(firebaseStorage.getDoctorPaymentRecords).toHaveBeenCalledTimes(2)
  })

  it("shows only stripe-confirmed outcomes and hides pending records", async () => {
    const user = userEvent.setup()
    firebaseStorage.getDoctorPaymentRecords.mockResolvedValueOnce([
      {
        id: "rec-created",
        createdAt: "2026-02-15T20:00:00.000Z",
        type: "stripe_checkout",
        monthsDelta: 1,
        amount: 5000,
        currency: "LKR",
        status: "created",
        source: "stripeCheckoutLogs",
        sourceCollection: "stripeCheckoutLogs",
        referenceId: "cs_created"
      },
      {
        id: "rec-confirmed",
        createdAt: "2026-02-15T21:00:00.000Z",
        type: "stripe_checkout",
        monthsDelta: 1,
        amount: 5000,
        currency: "LKR",
        status: "confirmed",
        source: "stripeCheckoutLogs",
        sourceCollection: "stripeCheckoutLogs",
        referenceId: "cs_confirmed"
      },
      {
        id: "rec-failed",
        createdAt: "2026-02-15T22:00:00.000Z",
        type: "stripe_checkout",
        monthsDelta: 1,
        amount: 5000,
        currency: "LKR",
        status: "failed",
        source: "stripeCheckoutLogs",
        sourceCollection: "stripeCheckoutLogs",
        referenceId: "cs_failed"
      }
    ])

    render(PaymentsPage, {
      props: {
        user: {
          id: "doctor-1",
          email: "doctor@test.com",
          country: "Sri Lanka",
          currency: "LKR"
        }
      }
    })

    await openBillingHistoryTab(user)
    expect(await screen.findAllByText("LKR 5000.00")).toHaveLength(2)
    expect(await screen.findByText("Success")).toBeInTheDocument()
    expect(screen.getByText("Fail")).toBeInTheDocument()
  })

  it("shows empty confirmed-history state when only pending stripe records exist", async () => {
    const user = userEvent.setup()
    firebaseStorage.getDoctorPaymentRecords.mockResolvedValueOnce([
      {
        id: "rec-created",
        createdAt: "2026-02-15T20:00:00.000Z",
        type: "stripe_checkout",
        monthsDelta: 1,
        amount: 5000,
        currency: "LKR",
        status: "created",
        source: "stripeCheckoutLogs",
        sourceCollection: "stripeCheckoutLogs",
        referenceId: "cs_created"
      }
    ])

    render(PaymentsPage, {
      props: {
        user: {
          id: "doctor-1",
          email: "doctor@test.com",
          country: "Sri Lanka",
          currency: "LKR"
        }
      }
    })

    await openBillingHistoryTab(user)
    expect(await screen.findByText("No Stripe-confirmed billing records yet.")).toBeInTheDocument()
  })

  it("shows expand history button when billing rows exceed preview count", async () => {
    const user = userEvent.setup()
    firebaseStorage.getDoctorPaymentRecords.mockResolvedValueOnce(
      Array.from({ length: 10 }).map((_, index) => ({
        id: `rec-${index + 1}`,
        createdAt: `2026-02-15T2${index % 10}:00:00.000Z`,
        amount: 5000,
        currency: "LKR",
        status: "confirmed",
        source: "stripeCheckoutLogs",
        sourceCollection: "stripeCheckoutLogs"
      }))
    )

    render(PaymentsPage, {
      props: {
        user: {
          id: "doctor-1",
          email: "doctor@test.com",
          country: "Sri Lanka",
          currency: "LKR"
        }
      }
    })

    await openBillingHistoryTab(user)
    const expandButton = await screen.findByRole("button", { name: /Expand history/i })
    expect(expandButton).toBeInTheDocument()
    await user.click(expandButton)
    expect(await screen.findByRole("button", { name: /Show less/i })).toBeInTheDocument()
  })

  it("shrinks and restores the whole billing history section", async () => {
    const user = userEvent.setup()
    firebaseStorage.getDoctorPaymentRecords.mockResolvedValueOnce([
      {
        id: "rec-1",
        createdAt: "2026-02-15T21:50:00.000Z",
        amount: 5000,
        currency: "LKR",
        status: "confirmed",
        source: "stripeCheckoutLogs",
        sourceCollection: "stripeCheckoutLogs"
      }
    ])

    render(PaymentsPage, {
      props: {
        user: {
          id: "doctor-1",
          email: "doctor@test.com",
          country: "Sri Lanka",
          currency: "LKR"
        }
      }
    })

    await openBillingHistoryTab(user)
    expect(await screen.findByText("LKR 5000.00")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: /Shrink history/i }))
    expect(await screen.findByText("Billing history is collapsed.")).toBeInTheDocument()
    expect(screen.queryByText("LKR 5000.00")).not.toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: /Show history/i }))
    expect(await screen.findByText("LKR 5000.00")).toBeInTheDocument()
  })

  it("shows payment-in-progress warning while checkout request is in flight", async () => {
    const user = userEvent.setup()
    let resolveCheckout
    const pendingCheckout = new Promise((resolve) => {
      resolveCheckout = resolve
    })
    fetch.mockReturnValueOnce(pendingCheckout)

    render(PaymentsPage, {
      props: {
        user: {
          id: "doctor-1",
          email: "doctor@test.com",
          country: "Sri Lanka",
          currency: "LKR"
        }
      }
    })

    await user.click(screen.getAllByRole("button", { name: /Pay with Stripe/i })[0])
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Payment is in progress. Do not refresh, close this tab, or switch pages until payment is complete."
    )

    resolveCheckout({
      ok: true,
      json: vi.fn().mockResolvedValue({
        success: true,
        url: "https://checkout.stripe.com/c/pay/cs_test_123"
      })
    })
  })

  it("prevents duplicate checkout creation on rapid double-click", async () => {
    const user = userEvent.setup()
    let resolveCheckout
    const pendingCheckout = new Promise((resolve) => {
      resolveCheckout = resolve
    })
    fetch.mockReturnValueOnce(pendingCheckout)

    render(PaymentsPage, {
      props: {
        user: {
          id: "doctor-1",
          email: "doctor@test.com",
          country: "Sri Lanka",
          currency: "LKR"
        }
      }
    })

    const payButton = screen.getAllByRole("button", { name: /Pay with Stripe/i })[0]
    await user.click(payButton)
    await user.click(payButton)

    expect(fetch).toHaveBeenCalledTimes(1)
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Payment is in progress. Do not refresh, close this tab, or switch pages until payment is complete."
    )
    expect(payButton).toBeDisabled()

    resolveCheckout({
      ok: true,
      json: vi.fn().mockResolvedValue({
        success: true,
        url: "https://checkout.stripe.com/c/pay/cs_test_123"
      })
    })
  })

})
