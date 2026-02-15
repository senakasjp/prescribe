import { render, screen } from "@testing-library/svelte"
import userEvent from "@testing-library/user-event"
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import PaymentsPage from "../../components/PaymentsPage.svelte"
import { auth } from "../../firebase-config.js"

vi.mock("../../firebase-config.js", () => ({
  auth: {
    currentUser: {
      getIdToken: vi.fn().mockResolvedValue("doctor-token")
    }
  }
}))

describe("PaymentsPage.svelte", () => {
  const originalEnv = {
    ...import.meta.env
  }

  beforeEach(() => {
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
    expect(request.body).toContain("\"planId\":\"professional_monthly_usd\"")
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

})
