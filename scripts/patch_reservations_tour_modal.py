from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
p = ROOT / "src/app/[locale]/admin/reservations/page.tsx"
s = p.read_text(encoding="utf-8")

old = """  const [showActionRequiredModal, setShowActionRequiredModal] = useState(false)
  const [reservationIdsWithPayments, setReservationIdsWithPayments] = useState<Set<string>>(new Set())"""
new = """  const [showActionRequiredModal, setShowActionRequiredModal] = useState(false)
  const [tourDetailModalTourId, setTourDetailModalTourId] = useState<string | null>(null)
  const [reservationIdsWithPayments, setReservationIdsWithPayments] = useState<Set<string>>(new Set())"""
if old not in s:
    raise SystemExit("state anchor missing")
s = s.replace(old, new, 1)

anchor = """  const handleClosePricingModal = useCallback(() => {
    setShowPricingModal(false)
    setPricingModalReservation(null)
  }, [])
"""
ins = anchor + """  const handleOpenTourDetailModal = useCallback((tourId: string) => {
    setTourDetailModalTourId(tourId)
  }, [])

"""
if anchor not in s:
    raise SystemExit("pricing close anchor")
if "handleOpenTourDetailModal" in s:
    raise SystemExit("already patched handler")
s = s.replace(anchor, ins, 1)

a = """                        linkedTourId={tourIdByReservationId.get(reservation.id) ?? null}
                        cardLayout={cardLayout}
                      />"""
b = """                        linkedTourId={tourIdByReservationId.get(reservation.id) ?? null}
                        cardLayout={cardLayout}
                        onOpenTourDetailModal={handleOpenTourDetailModal}
                      />"""
if a not in s:
    raise SystemExit("grouped card block missing")
s = s.replace(a, b, 1)

a2 = """                        linkedTourId={tourIdByReservationId.get(reservation.id) ?? null}
                        cardLayout={cardLayout}
                  />"""
b2 = """                        linkedTourId={tourIdByReservationId.get(reservation.id) ?? null}
                        cardLayout={cardLayout}
                        onOpenTourDetailModal={handleOpenTourDetailModal}
                  />"""
if a2 in s:
    s = s.replace(a2, b2, 1)

mod_old = "      <DeletedReservationsTableModal\n"
mod_new = """      {tourDetailModalTourId ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-2 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="reservations-tour-detail-modal-title"
          onClick={() => setTourDetailModalTourId(null)}
        >
          <div
            className="flex h-[min(92vh,900px)] w-full max-w-6xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-gray-200 px-4 py-3">
              <h3 id="reservations-tour-detail-modal-title" className="text-lg font-semibold text-gray-900 truncate pr-2">
                {t('card.tourDetailModalTitle')}
              </h3>
              <div className="flex shrink-0 items-center gap-2">
                <a
                  href={`/${locale}/admin/tours/${tourDetailModalTourId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline whitespace-nowrap"
                >
                  {t('card.openTourInNewTab')}
                </a>
                <button
                  type="button"
                  onClick={() => setTourDetailModalTourId(null)}
                  className="rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-800"
                  aria-label={t('card.close')}
                >
                  <X className="h-5 w-5" aria-hidden />
                </button>
              </div>
            </div>
            <div className="min-h-0 flex-1 bg-gray-50">
              <iframe
                key={tourDetailModalTourId}
                title={t('card.tourDetailModalTitle')}
                src={`/${locale}/admin/tours/${tourDetailModalTourId}`}
                className="h-full w-full min-h-[60vh] border-0"
              />
            </div>
          </div>
        </div>
      ) : null}

      <DeletedReservationsTableModal
"""
if mod_old not in s:
    raise SystemExit("modal anchor missing")
if "{tourDetailModalTourId ? (" in s:
    print("modal already present")
else:
    s = s.replace(mod_old, mod_new, 1)

p.write_text(s, encoding="utf-8")
print("page patched")
