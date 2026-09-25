/**
 * QR 스캐너·인앱 브라우저가 데스크톱 폭으로 축소해 그리는 경우,
 * 화면 너비보다 레이아웃이 넓을 때만 viewport를 휴대폰 너비로 다시 맞춘다.
 */
export const PAY_INVOICE_VIEWPORT_INLINE_SCRIPT = `
(function () {
  try {
    if ((location.pathname || '').indexOf('/pay/invoice/') === -1) return;
    document.documentElement.classList.add('pay-invoice-standalone');
    var ua = navigator.userAgent || '';
    if (!/Android|iPhone|iPod|iPad/i.test(ua)) return;
    var sw = Math.min(window.screen.width || 0, window.screen.height || 0);
    var iw = window.innerWidth || 0;
    if (!sw || sw > 540 || !iw || iw <= sw * 1.15) return;
    var meta = document.querySelector('meta[name="viewport"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'viewport');
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', 'width=' + Math.round(sw) + ', initial-scale=1, viewport-fit=cover');
  } catch (e) {}
})();
`.trim()

export default function PayInvoiceViewportScript() {
  return (
    <script
      id="pay-invoice-viewport"
      dangerouslySetInnerHTML={{ __html: PAY_INVOICE_VIEWPORT_INLINE_SCRIPT }}
    />
  )
}
