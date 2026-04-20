const fs = require('fs')
const p = 'src/components/reservation/ReservationCardItem.tsx'
let s = fs.readFileSync(p, 'utf8')
const old = `            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onEditClick(reservation.id)
              }}
              className="px-2 py-1 text-[11px] bg-orange-50 text-orange-600 rounded-md hover:bg-orange-100 border border-orange-200"
            >
              {t('actions.edit')}
            </button>
          </div>
        </div>
      ) : (
      <>
`
const neu = `            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onEditClick(reservation.id)
              }}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-orange-200 bg-orange-50 text-orange-600 hover:bg-orange-100"
              title={t('card.editReservationTitle')}
            >
              <Edit className="h-4 w-4" />
            </button>
          </div>
          )}

          {statusModalOpen && onStatusChange && (
            <div
              className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
              onClick={(e) => {
                e.stopPropagation()
                setStatusModalOpen(false)
              }}
            >
              <div
                className="w-full max-w-sm rounded-xl border border-gray-200 bg-white shadow-xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between border-b border-gray-200 p-3">
                  <h3 className="text-sm font-semibold text-gray-900">{t('card.changeStatusModalTitle')}</h3>
                  <button
                    type="button"
                    onClick={() => setStatusModalOpen(false)}
                    className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100"
                    aria-label={t('card.close')}
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <div className="max-h-[60vh] space-y-1 overflow-y-auto p-2">
                  {statusOptions.map((opt) => {
                    const isCurrent = (reservation.status as string)?.toLowerCase?.() === opt.value
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        disabled={statusUpdating}
                        onClick={() => handleStatusSelect(opt.value)}
                        className={\`w-full rounded-lg px-3 py-2 text-left text-xs font-medium hover:bg-gray-50 disabled:opacity-50 \${getStatusColor(opt.value)} \${isCurrent ? 'ring-2 ring-blue-300' : ''}\`}
                      >
                        {t(opt.labelKey)}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
      <>
`
if (!s.includes(old)) {
  console.error('OLD block not found')
  process.exit(1)
}
s = s.replace(old, neu)
fs.writeFileSync(p, s)
console.log('ok')
