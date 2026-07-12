const DEFAULT_LIBRARIES = 'places'

export function isGoogleMapsReady() {
  const maps = window.google?.maps
  return Boolean(maps?.MapTypeId && typeof maps.Map === 'function')
}

export function waitForGoogleMapsReady(options?: {
  maxAttempts?: number
  intervalMs?: number
}) {
  const maxAttempts = options?.maxAttempts ?? 120
  const intervalMs = options?.intervalMs ?? 50

  return new Promise<void>((resolve, reject) => {
    if (isGoogleMapsReady()) {
      resolve()
      return
    }

    let attempts = 0

    const check = () => {
      if (isGoogleMapsReady()) {
        resolve()
        return
      }

      attempts += 1
      if (attempts >= maxAttempts) {
        reject(new Error('google_maps_timeout'))
        return
      }

      window.setTimeout(check, intervalMs)
    }

    check()
  })
}

export function loadGoogleMapsApi(libraries = DEFAULT_LIBRARIES) {
  return new Promise<void>((resolve, reject) => {
    if (isGoogleMapsReady()) {
      resolve()
      return
    }

    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
    if (!apiKey) {
      reject(new Error('missing_api_key'))
      return
    }

    const existingScript = document.querySelector('script[src*="maps.googleapis.com"]')

    const finishLoading = () => {
      waitForGoogleMapsReady()
        .then(resolve)
        .catch(reject)
    }

    if (existingScript) {
      if (window.google?.maps) {
        finishLoading()
        return
      }

      existingScript.addEventListener('load', finishLoading, { once: true })
      existingScript.addEventListener('error', () => reject(new Error('script_error')), {
        once: true,
      })
      finishLoading()
      return
    }

    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=${libraries}&loading=async`
    script.async = true
    script.defer = true
    script.id = 'google-maps-script'
    script.onload = () => finishLoading()
    script.onerror = () => reject(new Error('script_error'))
    document.head.appendChild(script)
  })
}
