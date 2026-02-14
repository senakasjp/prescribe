<script>
  export let accessCode = ''

  let selectedImageDataUrl = ''
  let captureError = ''
  let isCodeValid = false
  let isCodeExpired = false

  const validateAccessCode = () => {
    const normalized = String(accessCode || '').trim()
    return /^[A-Z0-9]{8,16}$/.test(normalized)
  }

  const validateExpiry = () => {
    if (typeof window === 'undefined') return false
    const params = new URLSearchParams(window.location.search)
    const ts = Number(params.get('ts') || 0)
    if (!Number.isFinite(ts) || ts <= 0) return false
    const ageMs = Date.now() - ts
    return ageMs > 15 * 60 * 1000
  }

  const handleCapture = async (event) => {
    const file = event?.target?.files?.[0]
    if (!file) return

    captureError = ''
    try {
      const reader = new FileReader()
      const dataUrl = await new Promise((resolve, reject) => {
        reader.onload = () => resolve(reader.result)
        reader.onerror = reject
        reader.readAsDataURL(file)
      })
      selectedImageDataUrl = String(dataUrl || '')
    } catch (error) {
      console.error('❌ Mobile capture failed:', error)
      captureError = 'Failed to read captured photo.'
    }
  }

  const clearImage = () => {
    selectedImageDataUrl = ''
    captureError = ''
  }

  $: isCodeValid = validateAccessCode()
  $: isCodeExpired = isCodeValid ? validateExpiry() : false
</script>

<section class="min-h-screen bg-gray-50 px-4 py-6">
  <div class="mx-auto w-full max-w-xl">
    <div class="rounded-2xl border border-cyan-200 bg-white shadow-sm overflow-hidden">
      <div class="bg-cyan-600 text-white px-4 py-3">
        <h1 class="text-lg font-semibold">
          <i class="fas fa-mobile-screen-button mr-2"></i>Mobile Report Capture
        </h1>
      </div>

      <div class="p-4 space-y-4">
        {#if !isCodeValid}
          <div class="rounded-lg border border-red-200 bg-red-50 text-red-800 text-sm px-3 py-2">
            Invalid access code. Please scan the QR code again from desktop.
          </div>
        {:else if isCodeExpired}
          <div class="rounded-lg border border-red-200 bg-red-50 text-red-800 text-sm px-3 py-2">
            This capture link has expired. Generate a new QR from desktop.
          </div>
        {:else}
          <div class="rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-2 text-xs text-cyan-800">
            Access code: <span class="font-semibold tracking-wider">{accessCode}</span>
          </div>

          <label for="mobileCaptureInput" class="block text-sm font-medium text-gray-700">Take Photo</label>
          <input
            id="mobileCaptureInput"
            type="file"
            accept="image/*"
            capture="environment"
            class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
            on:change={handleCapture}
          />

          {#if selectedImageDataUrl}
            <div class="space-y-2">
              <p class="text-sm font-medium text-gray-700">Preview</p>
              <div class="rounded-lg border border-gray-200 overflow-hidden bg-black/5">
                <img src={selectedImageDataUrl} alt="Captured mobile report" class="w-full h-auto" />
              </div>
              <div class="flex items-center gap-2">
                <a
                  href={selectedImageDataUrl}
                  download={`report-capture-${Date.now()}.jpg`}
                  class="inline-flex items-center px-3 py-2 text-xs font-medium rounded-lg bg-cyan-600 text-white hover:bg-cyan-700"
                >
                  <i class="fas fa-download mr-1"></i>Download Image
                </a>
                <button
                  type="button"
                  class="inline-flex items-center px-3 py-2 text-xs font-medium rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200"
                  on:click={clearImage}
                >
                  <i class="fas fa-rotate-left mr-1"></i>Retake
                </button>
              </div>
            </div>
          {/if}

          {#if captureError}
            <div class="rounded-lg border border-red-200 bg-red-50 text-red-800 text-xs px-3 py-2">
              {captureError}
            </div>
          {/if}
        {/if}
      </div>
    </div>
  </div>
</section>
