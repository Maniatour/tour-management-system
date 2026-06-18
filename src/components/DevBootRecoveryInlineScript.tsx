import Script from 'next/script'

/** next dev: React 번들 로드 전 SW·chunk 오류 1회 복구 (layout.tsx 전용) */
export const DEV_BOOT_RECOVERY_INLINE_SCRIPT = `
(function () {
  var CHUNK_KEY = 'tms-dev-chunk-reload-v1';
  function isChunk(msg) {
    return msg.indexOf('Loading chunk') !== -1
      || msg.indexOf('ChunkLoadError') !== -1
      || msg.indexOf('Failed to fetch dynamically imported module') !== -1;
  }
  function reloadOnce() {
    try {
      if (document.visibilityState !== 'visible') return;
      if (sessionStorage.getItem(CHUNK_KEY)) return;
      sessionStorage.setItem(CHUNK_KEY, '1');
    } catch (e) {}
    location.reload();
  }
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(function (regs) {
      if (!regs.length) return;
      regs.forEach(function (r) { r.unregister(); });
    }).catch(function () {});
  }
  if (typeof caches !== 'undefined') {
    caches.keys().then(function (keys) {
      var stale = keys.filter(function (k) {
        return /workbox|serwist|precache/i.test(k);
      });
      if (!stale.length) return;
      stale.forEach(function (k) { caches.delete(k); });
    }).catch(function () {});
  }
  window.addEventListener('error', function (e) {
    var msg = (e && e.message) || (e && e.error && e.error.message) || '';
    if (isChunk(String(msg))) reloadOnce();
  }, true);
  window.addEventListener('unhandledrejection', function (e) {
    var r = e && e.reason;
    var msg = typeof r === 'string' ? r : (r && r.message) || String(r || '');
    if (isChunk(String(msg))) {
      e.preventDefault();
      reloadOnce();
    }
  }, true);
})();
`.trim()

export function DevBootRecoveryInlineScript() {
  if (process.env.NODE_ENV !== 'development') return null

  return (
    <Script id="tms-dev-boot-recovery" strategy="beforeInteractive">
      {DEV_BOOT_RECOVERY_INLINE_SCRIPT}
    </Script>
  )
}
