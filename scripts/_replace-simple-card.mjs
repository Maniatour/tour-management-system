import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const file = path.join(__dirname, '..', 'src', 'components', 'reservation', 'ReservationCardItem.tsx')
let s = fs.readFileSync(file, 'utf8')

const startMarker = `      {cardLayout === 'simple' ? (
        <div className="p-3 space-y-2.5">`
const endMarker = `        </div>
      ) : (`

const i = s.indexOf(startMarker)
const j = s.indexOf(endMarker, i)
if (i < 0 || j < 0) {
  console.error('markers not found', { i, j })
  process.exit(1)
}

const newBlock = `      {cardLayout === 'simple' ? (
        <div className="p-3 space-y-2">
          {/* Row 1: status, flag, name | resident, channel icon, headcount */}
          <div className="flex justify-between items-center gap-2 min-w-0">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              {onStatusChange ? (
                <button
                  type="button"
                  onClick={() => setStatusModalOpen(true)}
                  disabled={statusUpdating}
                  className={\`inline-flex shrink-0 items-center px-2 py-0.5 rounded-full text-[11px] font-medium cursor-pointer hover:opacity-90 disabled:opacity-70 \${getStatusColor(reservation.status)}\`}
                >
                  {getStatusLabel(reservation.status, t)}
                </button>
              ) : (
                <span className={\`inline-flex shrink-0 items-center px-2 py-0.5 rounded-full text-[11px] font-medium \${getStatusColor(reservation.status)}\`}>
                  {getStatusLabel(reservation.status, t)}
                </span>
              )}
              {(() => {
                const customer = customers.find((c) => c.id === reservation.customerId)
                if (!customer?.language) return null
                const code = getLanguageFlagCountryCode(customer.language)
                return (
                  <ReactCountryFlag
                    countryCode={code}
                    svg
                    style={{ width: '14px', height: '11px', borderRadius: '2px', flexShrink: 0 }}
                  />
                )
              })()}
              <button
                type="button"
                className="min-w-0 truncate text-left text-sm font-medium text-gray-900 hover:text-blue-600 hover:underline"
                onClick={(e) => {
                  e.stopPropagation()
                  const customer = customers.find((c) => c.id === reservation.customerId)
                  if (customer) onCustomerClick(customer)
                }}
              >
                {getCustomerName(reservation.customerId, customers || [])}
              </button>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {showResidentStatusUi && (
                <ResidentStatusIcon
                  reservationId={reservation.id}
                  customerId={reservation.customerId}
                  totalPeople={(reservation.adults || 0) + (reservation.child || 0) + (reservation.infant || 0)}
                  onUpdate={onRefreshReservations}
                />
              )}
              {(() => {
                const channel = channels?.find((c) => c.id === reservation.channelId)
                const chName = getChannelName(reservation.channelId, channels || [])
                return channel?.favicon_url ? (
                  <Image
                    src={channel.favicon_url}
                    alt={chName || 'Channel'}
                    width={16}
                    height={16}
                    className="rounded flex-shrink-0"
                    style={{ width: 'auto', height: 'auto' }}
                    title={chName}
                    onError={(e) => {
                      const target = e.target as HTMLImageElement
                      target.style.display = 'none'
                    }}
                  />
                ) : (
                  <span className="h-4 w-4 shrink-0 rounded bg-gray-100 block" title={chName || ''} aria-hidden />
                )
              })()}
              <span
                className="text-[11px] font-semibold text-gray-800 tabular-nums"
                title={t('peopleLabel')}
              >
                {(reservation.adults || 0) + (reservation.child || 0) + (reservation.infant || 0)}
              </span>
            </div>
          </div>

          {/* Row 2: tour date, product, choices */}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs min-w-0">
            <span className="shrink-0 font-medium text-gray-800">{formatTourDateMmDdYyyy(reservation.tourDate)}</span>
            <span className="min-w-0 flex-1 basis-[40%] font-medium text-gray-900 line-clamp-2 sm:basis-auto">
              {getProductNameForLocale(reservation.productId, products as any || [], locale)}
            </span>
            <div className="flex flex-wrap items-center gap-1">
              <ChoicesDisplay
                reservation={reservation}
                getGroupColorClasses={getGroupColorClasses}
                getSelectedChoicesFromNewSystem={getSelectedChoicesFromNewSystem}
                choicesCacheRef={choicesCacheRef}
              />
            </div>
          </div>

          {/* Row 3: tour ops summary + expand toggle */}
          {(() => {
            const tourInfo = effectiveTourId && !hideAssignedTourUi ? tourInfoMap.get(effectiveTourId) : undefined
            const tourStatusLabel = tourInfo?.status ?? '—'
            const tone = (status: string) => {
              const s = status.toLowerCase()
              if (s === 'confirmed') return 'bg-green-100 text-green-800'
              if (s === 'completed') return 'bg-blue-100 text-blue-800'
              if (s === 'cancelled' || s === 'canceled') return 'bg-red-100 text-red-800'
              return 'bg-gray-100 text-gray-800'
            }
            const g = tourInfo?.guideName && tourInfo.guideName !== '-' ? tourInfo.guideName : '—'
            const a = tourInfo?.assistantName && tourInfo.assistantName !== '-' ? tourInfo.assistantName : '—'
            const v = tourInfo?.vehicleName && tourInfo.vehicleName !== '-' ? tourInfo.vehicleName : '—'
            const assignedN = tourInfo?.totalPeople ?? null
            return (
              <div className="flex items-start gap-1 min-w-0">
                <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11px] text-gray-800 min-w-0 flex-1">
                  <button
                    type="button"
                    disabled={!effectiveTourId || hideAssignedTourUi}
                    onClick={(e) => {
                      e.stopPropagation()
                      if (!effectiveTourId || hideAssignedTourUi) return
                      if (onOpenTourDetailModal) onOpenTourDetailModal(effectiveTourId)
                      else router.push(\`/\${locale}/admin/tours/\${effectiveTourId}\`)
                    }}
                    className="shrink-0 rounded p-0.5 text-blue-600 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-30"
                    title={t('card.tourDetailModalTitle')}
                  >
                    <Flag className="h-4 w-4" />
                  </button>
                  <span className="max-w-[4.5rem] truncate" title={g}>
                    {g}
                  </span>
                  <span className="text-gray-300">·</span>
                  <span className="max-w-[4.5rem] truncate" title={a}>
                    {a}
                  </span>
                  <span className="text-gray-300">·</span>
                  <span className="max-w-[5rem] truncate" title={v}>
                    {v}
                  </span>
                  <span className="text-gray-300">·</span>
                  <span className="tabular-nums text-gray-700" title={t('card.assignedTourBasic')}>
                    {assignedN != null ? assignedN : '—'}
                  </span>
                  <span className={\`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium \${tone(tourStatusLabel)}\`}>
                    {tourStatusLabel}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    setSimpleActionsExpanded((x) => !x)
                  }}
                  className="shrink-0 rounded p-0.5 text-gray-500 hover:bg-gray-100"
                  title={t('card.simpleActionsToggle')}
                  aria-expanded={simpleActionsExpanded}
                >
                  <ChevronDown className={\`h-4 w-4 transition-transform \${simpleActionsExpanded ? 'rotate-180' : ''}\`} />
                </button>
              </div>
            )
          })()}

          {/* Row 4: icon-only actions */}
          {simpleActionsExpanded && (
            <div className="flex flex-wrap gap-1 border-t border-gray-100 pt-2">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onPricingInfoClick(reservation)
                }}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-blue-200 bg-blue-50 text-blue-600 hover:bg-blue-100"
                title={t('actions.price')}
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                </svg>
              </button>
              {(() => {
                const product = products?.find((p) => p.id === reservation.productId)
                const isManiaTour = product?.sub_category === 'Mania Tour' || product?.sub_category === 'Mania Service'
                if (isManiaTour && !reservation.hasExistingTour) {
                  return (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        onCreateTour(reservation)
                      }}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-green-200 bg-green-50 text-green-600 hover:bg-green-100"
                      title={t('card.createTourTitle')}
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  )
                }
                return null
              })()}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onPaymentClick(reservation)
                }}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-blue-200 bg-blue-50 text-blue-600 hover:bg-blue-100"
                title={t('card.paymentHistoryTitle')}
              >
                <DollarSign className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onDetailClick(reservation)
                }}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-purple-200 bg-purple-50 text-purple-600 hover:bg-purple-100"
                title={t('card.viewCustomerTitle')}
              >
                <Eye className="h-4 w-4" />
              </button>
              {onReceiptClick && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    onReceiptClick(reservation)
                  }}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100"
                  title={t('print')}
                >
                  <Printer className="h-4 w-4" />
                </button>
              )}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  setFollowUpModalOpen(true)
                }}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
                title="Follow up"
              >
                <FileText className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onReviewClick(reservation)
                }}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-pink-200 bg-pink-50 text-pink-600 hover:bg-pink-100"
                title={t('card.reviewManagementTitle')}
              >
                <MessageSquare className="h-4 w-4" />
              </button>
              <div className="relative inline-block">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    onEmailDropdownToggle(reservation.id)
                  }}
                  disabled={sendingEmail === reservation.id}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-green-200 bg-green-50 text-green-600 hover:bg-green-100 disabled:opacity-50"
                  title={t('card.emailTitle')}
                >
                  <Mail className="h-4 w-4" />
                </button>
                {emailDropdownOpen === reservation.id && (
                  <div
                    className="absolute right-0 z-50 mt-1 w-48 rounded-md border border-gray-200 bg-white shadow-lg"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      onClick={() => onEmailPreview(reservation, 'confirmation')}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-gray-700 hover:bg-gray-50"
                    >
                      <Mail className="h-3 w-3" />
                      {t('card.emailConfirmation')}
                    </button>
                    <button
                      type="button"
                      onClick={() => onEmailPreview(reservation, 'departure')}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-gray-700 hover:bg-gray-50"
                    >
                      <Mail className="h-3 w-3" />
                      {t('card.emailDeparture')}
                    </button>
                    <button
                      type="button"
                      onClick={() => onEmailPreview(reservation, 'pickup')}
                      disabled={!reservation.pickUpTime || !reservation.tourDate}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                    >
                      <Mail className="h-3 w-3" />
                      {t('card.emailPickup')}
                    </button>
                    <div className="my-1 border-t border-gray-200" />
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        onEmailLogsClick(reservation.id)
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-blue-600 hover:bg-blue-50"
                    >
                      <Clock className="h-3 w-3" />
                      {t('card.emailLogs')}
                    </button>
                  </div>
                )}
              </div>
              <button
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
`

s = s.slice(0, i) + newBlock + s.slice(j)
fs.writeFileSync(file, s)
console.log('patched', file)
