import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const p = path.join(root, 'src/components/reservation/ReservationCardItem.tsx')
let s = fs.readFileSync(p, 'utf8')

const importOld = `import { Plus, Calendar, MapPin, Users, DollarSign, Eye, Clock, Mail, ChevronDown, Edit, MessageSquare, X, FileText, Printer } from 'lucide-react'`
const importNew = `import { Plus, Calendar, MapPin, Users, DollarSign, Eye, Clock, Mail, ChevronDown, Edit, MessageSquare, X, FileText, Printer, CheckCircle, XCircle, CircleCheck, User } from 'lucide-react'`
if (!s.includes(importOld)) throw new Error('import line not found')
s = s.replace(importOld, importNew)

const ifaceOld = `  /** reservations.tour_id가 비어 있을 때 tours.reservation_ids 기준 투어 ID */
  linkedTourId?: string | null
}`
const ifaceNew = `  /** reservations.tour_id가 비어 있을 때 tours.reservation_ids 기준 투어 ID */
  linkedTourId?: string | null
  /** 카드뷰 밀도: 간단(4줄) / 상세(기본) */
  cardLayout?: 'standard' | 'simple'
}

function reservationStatusLucideIcon(statusLower: string) {
  const className = 'h-4 w-4 shrink-0'
  if (statusLower === 'confirmed') return <CheckCircle className={\`\${className} text-green-600\`} aria-hidden />
  if (statusLower === 'pending') return <Clock className={\`\${className} text-amber-600\`} aria-hidden />
  if (statusLower === 'completed') return <CircleCheck className={\`\${className} text-blue-600\`} aria-hidden />
  if (statusLower === 'cancelled' || statusLower === 'canceled') {
    return <XCircle className={\`\${className} text-red-600\`} aria-hidden />
  }
  if (statusLower === 'recruiting') return <Users className={\`\${className} text-purple-600\`} aria-hidden />
  if (statusLower === 'deleted') return <X className={\`\${className} text-gray-500\`} aria-hidden />
  return <Clock className={\`\${className} text-gray-600\`} aria-hidden />
}`
if (!s.includes(ifaceOld)) throw new Error('interface block not found')
s = s.replace(ifaceOld, ifaceNew)

const destOld = `  choicesCacheRef,
  linkedTourId = null
}: ReservationCardItemProps) {`
const destNew = `  choicesCacheRef,
  linkedTourId = null,
  cardLayout = 'standard'
}: ReservationCardItemProps) {`
if (!s.includes(destOld)) throw new Error('destructure not found')
s = s.replace(destOld, destNew)

const simpleBlock = `
  if (cardLayout === 'simple') {
    const customerRow = customers.find((c) => c.id === reservation.customerId)
    const channelRow = channels?.find((c) => c.id === reservation.channelId)
    const productRow = products?.find((p) => p.id === reservation.productId)
    const headTotal =
      (typeof reservation.totalPeople === 'number' ? reservation.totalPeople : null) ??
      (reservation.adults || 0) + (reservation.child || 0) + (reservation.infant || 0)

    const tourInfoSimple =
      effectiveTourId && !hideAssignedTourUi ? tourInfoMap.get(effectiveTourId) : null
    const assignedTourTotalPeople = tourInfoSimple?.totalPeople ?? 0
    const finalAllDateTotalPeople = tourInfoSimple?.allDateTotalPeople ?? assignedTourTotalPeople
    const tourStatusLabel = tourInfoSimple?.status ?? ''

    const tourStatusTone = (status: string) => {
      const st = status.toLowerCase()
      if (st === 'confirmed') return 'bg-green-100 text-green-800'
      if (st === 'completed') return 'bg-blue-100 text-blue-800'
      if (st === 'cancelled' || st === 'canceled') return 'bg-red-100 text-red-800'
      return 'bg-gray-100 text-gray-800'
    }

    const guideDisplay =
      tourInfoSimple && tourInfoSimple.guideName && tourInfoSimple.guideName !== '-'
        ? tourInfoSimple.guideName
        : '—'

    const assignedDisplay = tourInfoSimple
      ? \`\${assignedTourTotalPeople}/\${finalAllDateTotalPeople}\${t('card.peopleShort')}\`
      : '—'

    const isManiaTourSimple =
      productRow?.sub_category === 'Mania Tour' || productRow?.sub_category === 'Mania Service'

    const statusIconEl = reservationStatusLucideIcon(reservationStatusLower)

    return (
      <div
        key={reservation.id}
        className="bg-white rounded-lg shadow border border-gray-200 hover:shadow-md transition-shadow duration-200 group"
      >
        <div className="p-3 space-y-2">
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <div className="relative shrink-0" ref={statusDropdownRef}>
              {onStatusChange ? (
                <button
                  type="button"
                  onClick={() => setStatusDropdownOpen((v) => !v)}
                  disabled={statusUpdating}
                  className="inline-flex items-center rounded-md p-1 text-gray-700 hover:bg-gray-100 disabled:opacity-60"
                  title={getStatusLabel(reservation.status, t)}
                >
                  {statusIconEl}
                  <ChevronDown className={\`w-3 h-3 ml-0.5 shrink-0 transition-transform \${statusDropdownOpen ? 'rotate-180' : ''}\`} />
                </button>
              ) : (
                <span className="inline-flex items-center p-1" title={getStatusLabel(reservation.status, t)}>
                  {statusIconEl}
                </span>
              )}
              {onStatusChange && statusDropdownOpen && (
                <div className="absolute left-0 top-full mt-1 z-20 py-1 bg-white border border-gray-200 rounded-lg shadow-lg min-w-[7rem]">
                  {statusOptions.map((opt) => {
                    const isCurrent = (reservation.status as string)?.toLowerCase?.() === opt.value
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => handleStatusSelect(opt.value)}
                        className={\`w-full text-left px-3 py-1.5 text-xs hover:bg-gray-100 \${getStatusColor(opt.value)} \${isCurrent ? 'font-semibold' : ''}\`}
                      >
                        {t(opt.labelKey)}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            {channelRow?.favicon_url ? (
              <Image
                src={channelRow.favicon_url}
                alt={\`\${channelRow.name || 'Channel'} favicon\`}
                width={16}
                height={16}
                className="rounded flex-shrink-0"
                style={{ width: 'auto', height: 'auto' }}
                onError={(e) => {
                  const target = e.target as HTMLImageElement
                  target.style.display = 'none'
                }}
              />
            ) : (
              <div className="h-4 w-4 rounded bg-gray-100 flex items-center justify-center flex-shrink-0">
                <span className="text-gray-400 text-[10px]">·</span>
              </div>
            )}

            {customerRow?.country ? (
              <ReactCountryFlag
                countryCode={customerRow.country}
                svg
                style={{ width: 16, height: 12, borderRadius: 2 }}
              />
            ) : null}

            <button
              type="button"
              className="text-sm font-medium text-gray-900 truncate min-w-0 flex-1 text-left hover:text-blue-600 hover:underline"
              onClick={(e) => {
                e.stopPropagation()
                if (customerRow) onCustomerClick(customerRow)
              }}
            >
              {getCustomerName(reservation.customerId, customers || [])}
            </button>

            <span className="inline-flex items-center gap-0.5 text-xs text-gray-600 shrink-0 tabular-nums">
              <Users className="h-3.5 w-3.5" />
              {headTotal}
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap text-sm text-gray-800 min-w-0">
            <span className="shrink-0 text-gray-600 tabular-nums">{reservation.tourDate || '—'}</span>
            <span className="text-gray-300">·</span>
            <span className="truncate min-w-0 font-medium">
              {getProductNameForLocale(reservation.productId, products as never[] || [], locale)}
            </span>
            <div className="flex flex-wrap gap-1 items-center">
              <ChoicesDisplay
                reservation={reservation}
                getGroupColorClasses={getGroupColorClasses}
                getSelectedChoicesFromNewSystem={getSelectedChoicesFromNewSystem}
                choicesCacheRef={choicesCacheRef}
              />
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap text-xs min-w-0 text-gray-800">
            {effectiveTourId && !hideAssignedTourUi && !tourInfoSimple ? (
              <span className="text-gray-500">{t('card.assignedTourMetaLoading')}</span>
            ) : tourInfoSimple ? (
              <>
                <span className="inline-flex items-center gap-1 min-w-0">
                  <User className="h-3.5 w-3.5 text-gray-400 shrink-0" aria-hidden />
                  <span className="truncate max-w-[10rem]">{guideDisplay}</span>
                </span>
                <span className="text-gray-300">·</span>
                <span className="tabular-nums shrink-0">{assignedDisplay}</span>
                <span className="text-gray-300">·</span>
                <span
                  className={\`px-1.5 py-0.5 rounded text-[10px] font-medium shrink-0 \${tourStatusTone(tourStatusLabel)}\`}
                >
                  {tourStatusLabel || '—'}
                </span>
              </>
            ) : (
              <span className="text-gray-500">{t('card.simpleNoTour')}</span>
            )}
          </div>

          <div className="flex items-center flex-wrap gap-0.5 pt-1 border-t border-gray-100">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onPricingInfoClick(reservation)
              }}
              className="p-2 rounded-md text-blue-600 hover:bg-blue-50 border border-transparent hover:border-blue-200"
              title={t('actions.price')}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1"
                />
              </svg>
            </button>

            {isManiaTourSimple && !reservation.hasExistingTour ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onCreateTour(reservation)
                }}
                className="p-2 rounded-md text-green-600 hover:bg-green-50 border border-transparent hover:border-green-200"
                title={t('card.createTourTitle')}
              >
                <Plus className="w-4 h-4" aria-hidden />
              </button>
            ) : null}

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onPaymentClick(reservation)
              }}
              className="p-2 rounded-md text-blue-600 hover:bg-blue-50 border border-transparent hover:border-blue-200"
              title={t('card.paymentHistoryTitle')}
            >
              <DollarSign className="w-4 h-4" aria-hidden />
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onDetailClick(reservation)
              }}
              className="p-2 rounded-md text-purple-600 hover:bg-purple-50 border border-transparent hover:border-purple-200"
              title={t('card.viewCustomerTitle')}
            >
              <Eye className="w-4 h-4" aria-hidden />
            </button>

            {onReceiptClick ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onReceiptClick(reservation)
                }}
                className="p-2 rounded-md text-slate-600 hover:bg-slate-50 border border-transparent hover:border-slate-200"
                title={t('print')}
              >
                <Printer className="w-4 h-4" aria-hidden />
              </button>
            ) : null}

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setFollowUpModalOpen(true)
              }}
              className="p-2 rounded-md text-amber-700 hover:bg-amber-50 border border-transparent hover:border-amber-200"
              title="Follow up"
            >
              <FileText className="w-4 h-4" aria-hidden />
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onReviewClick(reservation)
              }}
              className="p-2 rounded-md text-pink-600 hover:bg-pink-50 border border-transparent hover:border-pink-200"
              title={t('card.reviewManagementTitle')}
            >
              <MessageSquare className="w-4 h-4" aria-hidden />
            </button>

            <div className="relative">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onEmailDropdownToggle(reservation.id)
                }}
                disabled={sendingEmail === reservation.id}
                className="p-2 rounded-md text-green-600 hover:bg-green-50 border border-transparent hover:border-green-200 disabled:opacity-50 disabled:cursor-not-allowed"
                title={t('card.emailTitle')}
              >
                <Mail className="w-4 h-4" aria-hidden />
              </button>

              {emailDropdownOpen === reservation.id && (
                <div
                  className="absolute right-0 mt-1 w-48 bg-white rounded-md shadow-lg border border-gray-200 z-50"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    onClick={() => onEmailPreview(reservation, 'confirmation')}
                    className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 flex items-center space-x-2"
                  >
                    <Mail className="w-3 h-3" />
                    <span>{t('card.emailConfirmation')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onEmailPreview(reservation, 'departure')}
                    className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 flex items-center space-x-2"
                  >
                    <Mail className="w-3 h-3" />
                    <span>{t('card.emailDeparture')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onEmailPreview(reservation, 'pickup')}
                    disabled={!reservation.pickUpTime || !reservation.tourDate}
                    className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Mail className="w-3 h-3" />
                    <span>{t('card.emailPickup')}</span>
                  </button>
                  <div className="border-t border-gray-200 my-1" />
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      onEmailLogsClick(reservation.id)
                    }}
                    className="w-full text-left px-3 py-2 text-xs text-blue-600 hover:bg-blue-50 flex items-center space-x-2"
                  >
                    <Clock className="w-3 h-3" />
                    <span>{t('card.emailLogs')}</span>
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
              className="p-2 rounded-md text-orange-600 hover:bg-orange-50 border border-transparent hover:border-orange-200"
              title={t('card.editReservationTitle')}
            >
              <Edit className="w-4 h-4" aria-hidden />
            </button>
          </div>
        </div>

        {followUpModalOpen && (
          <div
            className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50"
            onClick={(e) => {
              e.stopPropagation()
              setFollowUpModalOpen(false)
            }}
          >
            <div
              className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[85vh] flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-4 border-b border-gray-200 flex-shrink-0">
                <h3 className="text-base font-semibold text-gray-900">Follow up</h3>
                <button
                  type="button"
                  onClick={() => setFollowUpModalOpen(false)}
                  className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                  aria-label={t('card.close')}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                <ReservationFollowUpSection reservationId={reservation.id} status={reservation.status as string} />
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

`

const returnAnchor = `  }

  return (
    <div
      key={reservation.id}
      className="bg-white rounded-lg shadow-md border border-gray-200 hover:shadow-lg transition-shadow duration-200 group"
    >
      {/* 카드 헤더 - 상태 표시 */}`

const returnAnchorOld = `    } finally {
      setStatusUpdating(false)
    }
  }

  return (
    <div
      key={reservation.id}
      className="bg-white rounded-lg shadow-md border border-gray-200 hover:shadow-lg transition-shadow duration-200 group"
    >
      {/* 카드 헤더 - 상태 표시 */}`

if (!s.includes(returnAnchorOld)) throw new Error('return anchor not found')
s = s.replace(returnAnchorOld, returnAnchorOld.replace(/\n  return \(/, '\n' + simpleBlock + '\n  return ('))

// Fix: the replace above is wrong - I need to insert simpleBlock before "return ("

const s2 = fs.readFileSync(p, 'utf8')
// re-read - actually we already mutated s incorrectly. Let me re-read file and do clean replace
