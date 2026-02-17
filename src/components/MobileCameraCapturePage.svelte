<script>
  import { onMount } from 'svelte'
  import firebaseStorage from '../services/firebaseStorage.js'
  import BrandName from './BrandName.svelte'

  export let accessCode = ''

  let selectedImageDataUrl = ''
  let captureError = ''
  let uploadPending = false
  let uploadComplete = false
  let closingWindow = false
  let isCodeValid = false
  let isCodeExpired = false
  let captureInputEl

  const normalizeCode = () => String(accessCode || '').trim().toUpperCase()

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

  const optimizeImageDataUrl = async (rawDataUrl) => {
    const source = String(rawDataUrl || '')
    if (!source) return source
    if (typeof window === 'undefined' || typeof Image === 'undefined') {
      return source
    }

    return await new Promise((resolve) => {
      let settled = false
      const finish = (value) => {
        if (settled) return
        settled = true
        resolve(value || source)
      }

      const timeoutId = setTimeout(() => finish(source), 800)
      const img = new Image()
      img.onload = () => {
        try {
          const maxSide = 1280
          const scale = Math.min(1, maxSide / Math.max(img.width || 1, img.height || 1))
          const targetWidth = Math.max(1, Math.round((img.width || 1) * scale))
          const targetHeight = Math.max(1, Math.round((img.height || 1) * scale))
          const canvas = document.createElement('canvas')
          canvas.width = targetWidth
          canvas.height = targetHeight
          const ctx = canvas.getContext('2d')
          if (!ctx) {
            clearTimeout(timeoutId)
            finish(source)
            return
          }
          ctx.drawImage(img, 0, 0, targetWidth, targetHeight)
          const optimized = canvas.toDataURL('image/jpeg', 0.75)
          clearTimeout(timeoutId)
          finish(optimized)
        } catch (_) {
          clearTimeout(timeoutId)
          finish(source)
        }
      }
      img.onerror = () => {
        clearTimeout(timeoutId)
        finish(source)
      }
      img.src = source
    })
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
      selectedImageDataUrl = await optimizeImageDataUrl(dataUrl)
      uploadComplete = false
    } catch (error) {
      console.error('❌ Mobile capture failed:', error)
      captureError = 'Failed to read captured photo.'
    }
  }

  const openCameraCapture = () => {
    captureError = ''
    captureInputEl?.click()
  }

  const uploadCapturedPhoto = async () => {
    if (!selectedImageDataUrl || !isCodeValid || isCodeExpired || uploadPending) return
    captureError = ''
    uploadPending = true
    try {
      await firebaseStorage.upsertMobileCaptureSession(normalizeCode(), {
        status: 'photo_ready',
        photoUploadedAt: new Date().toISOString(),
        imageDataUrl: selectedImageDataUrl
      })
      uploadComplete = true
      closingWindow = true
      setTimeout(() => {
        try {
          window.close()
        } catch (_) {
          // no-op when browser blocks closing
        }
      }, 1000)
    } catch (error) {
      console.error('❌ Mobile photo upload failed:', error)
      const message = String(error?.message || '')
      captureError = /too large|maximum allowed size|resource-exhausted/i.test(message)
        ? 'Photo is too large. Retake and upload a closer crop.'
        : 'Failed to upload photo.'
      closingWindow = false
    } finally {
      uploadPending = false
    }
  }

  const clearImage = () => {
    selectedImageDataUrl = ''
    captureError = ''
    uploadComplete = false
    uploadPending = false
    closingWindow = false
  }

  $: isCodeValid = validateAccessCode()
  $: isCodeExpired = isCodeValid ? validateExpiry() : false

  onMount(async () => {
    if (!isCodeValid || isCodeExpired) return
    try {
      await firebaseStorage.upsertMobileCaptureSession(normalizeCode(), {
        status: 'opened',
        openedAt: new Date().toISOString()
      })
    } catch (error) {
      console.warn('⚠️ Unable to publish mobile capture open status:', error)
    }
  })
</script>

<section class="min-h-screen bg-gray-50 px-4 py-6 sm:text-sm">
  <div class="mx-auto w-full max-w-xl">
    <div class="rounded-2xl border border-cyan-200 bg-white shadow-sm overflow-hidden">
      <div class="bg-cyan-600 text-white px-4 py-3">
        <p class="text-xs font-medium text-cyan-100 mb-1">Powered by <BrandName className="text-white" /></p>
        <h1 class="text-lg font-semibold"><i class="fas fa-camera mr-2"></i>Mobile Report Capture</h1>
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
          <input
            bind:this={captureInputEl}
            id="mobileCaptureInput"
            type="file"
            accept="image/*"
            capture="environment"
            class="hidden"
            on:change={handleCapture}
          />

          {#if !selectedImageDataUrl}
            <button
              type="button"
              class="w-full inline-flex items-center justify-center px-4 py-3 text-sm font-semibold rounded-lg bg-cyan-600 text-white hover:bg-cyan-700"
              on:click={openCameraCapture}
            >
              <i class="fas fa-camera mr-2"></i>Take Photograph
            </button>
          {:else}
            <div class="space-y-2">
              <p class="text-sm font-medium text-gray-700">Preview</p>
              <div class="rounded-lg border border-gray-200 overflow-hidden bg-black/5">
                <img src={selectedImageDataUrl} alt="Captured mobile report" class="w-full h-auto" />
              </div>
              <div class="flex items-center gap-2">
                <button
                  type="button"
                  class="inline-flex items-center px-3 py-2 text-xs font-medium rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed"
                  on:click={uploadCapturedPhoto}
                  disabled={uploadPending || uploadComplete}
                >
                  {#if uploadPending}
                    <i class="fas fa-spinner fa-spin mr-1"></i>Uploading...
                  {:else if uploadComplete}
                    <i class="fas fa-check mr-1"></i>Uploaded
                  {:else}
                    <i class="fas fa-upload mr-1"></i>Upload Photo
                  {/if}
                </button>
                <button
                  type="button"
                  class="inline-flex items-center px-3 py-2 text-xs font-medium rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200"
                  on:click={clearImage}
                >
                  <i class="fas fa-rotate-left mr-1"></i>Retake
                </button>
              </div>
              {#if uploadComplete}
                <div class="rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-800 text-xs px-3 py-2">
                  Photo uploaded successfully. {closingWindow ? 'Closing this window...' : 'You can return to desktop.'}
                </div>
              {/if}
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
