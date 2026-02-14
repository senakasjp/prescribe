import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/svelte'
import MobileCameraCapturePage from '../../components/MobileCameraCapturePage.svelte'

describe('MobileCameraCapturePage', () => {
  const originalPath = window.location.pathname + window.location.search + window.location.hash

  beforeEach(() => {
    window.history.pushState({}, '', '/')
  })

  afterEach(() => {
    cleanup()
    window.history.pushState({}, '', originalPath)
    vi.restoreAllMocks()
  })

  it('shows invalid access code message for malformed code', async () => {
    const { getByText, container } = render(MobileCameraCapturePage, {
      props: { accessCode: 'bad-code!' }
    })

    expect(getByText(/Invalid access code/i)).toBeInTheDocument()
    expect(container.querySelector('input[type="file"]')).toBeNull()
  })

  it('shows expired message when timestamp is too old', async () => {
    const oldTs = Date.now() - (16 * 60 * 1000)
    window.history.pushState({}, '', `/?mobile-capture=1&code=ABCDEFGH12&ts=${oldTs}`)

    const { getByText } = render(MobileCameraCapturePage, {
      props: { accessCode: 'ABCDEFGH12' }
    })

    expect(getByText(/capture link has expired/i)).toBeInTheDocument()
  })

  it('shows capture controls for valid code and fresh timestamp', async () => {
    const freshTs = Date.now()
    window.history.pushState({}, '', `/?mobile-capture=1&code=ABCDEFGH12&ts=${freshTs}`)

    const { container } = render(MobileCameraCapturePage, {
      props: { accessCode: 'ABCDEFGH12' }
    })

    expect(screen.getByText(/Access code:/i)).toBeInTheDocument()
    const input = container.querySelector('input[type="file"]')
    expect(input).toBeTruthy()
    expect(input.getAttribute('capture')).toBe('environment')
  })

  it('renders preview and download button after selecting an image', async () => {
    const freshTs = Date.now()
    window.history.pushState({}, '', `/?mobile-capture=1&code=ABCDEFGH12&ts=${freshTs}`)

    const fileReaderMock = vi.fn(function FileReaderMock() {
      this.readAsDataURL = () => {
        this.result = 'data:image/jpeg;base64,TEST_IMAGE'
        if (typeof this.onload === 'function') {
          this.onload()
        }
      }
    })
    vi.stubGlobal('FileReader', fileReaderMock)

    const { container } = render(MobileCameraCapturePage, {
      props: { accessCode: 'ABCDEFGH12' }
    })

    const input = container.querySelector('input[type="file"]')
    const file = new File(['image-bytes'], 'capture.jpg', { type: 'image/jpeg' })

    await fireEvent.change(input, { target: { files: [file] } })

    await waitFor(() => {
      expect(screen.getByAltText(/Captured mobile report/i)).toBeInTheDocument()
    })

    const download = screen.getByRole('link', { name: /Download Image/i })
    expect(download.getAttribute('href')).toBe('data:image/jpeg;base64,TEST_IMAGE')
  })
})
