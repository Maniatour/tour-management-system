'use client'

import { useRef, useState } from 'react'
import { Eye, EyeOff, ChevronRight, Mail, Globe, MapPin } from 'lucide-react'
import type { CustomerPageLocationDef } from '@/lib/productCustomerPageLocations'
import type { ProductEmailDestinationKey } from '@/lib/productEmailDestinations'
import {
  getEmailDestinationLabel,
  PRODUCT_EMAIL_DESTINATIONS,
  filterPreviewableEmails,
} from '@/lib/productEmailDestinations'
import { useCustomerPagePreviewContext } from '@/components/product/CustomerPagePreviewContext'
import CustomerPageLocationPreviewModal from '@/components/product/CustomerPageLocationPreviewModal'

type CustomerPageLocationHintProps = {
  location?: CustomerPageLocationDef
  paths?: string[][]
  internal?: boolean
  note?: string
  emails?: ProductEmailDestinationKey[]
  emailNote?: string
  variant?: 'tab' | 'section' | 'inline' | 'compact'
  className?: string
  previewDisabled?: boolean
}

function PathBreadcrumb({ paths }: { paths: string[][] }) {
  if (paths.length === 0) return null

  return (
    <div className="space-y-1">
      {paths.map((path, i) => (
        <div key={i}>
          <div className="flex flex-wrap items-center gap-0.5 text-xs leading-snug">
            {path.map((segment, j) => (
              <span key={j} className="inline-flex items-center">
                {j > 0 && (
                  <ChevronRight className="h-3 w-3 shrink-0 text-blue-400 mx-0.5" aria-hidden />
                )}
                <span
                  className={
                    j === path.length - 1 ? 'font-medium text-blue-800' : 'text-blue-600/90'
                  }
                >
                  {segment}
                </span>
              </span>
            ))}
          </div>
          {i < paths.length - 1 && (
            <span className="text-[10px] text-blue-500/70 font-normal py-0.5 block">또는</span>
          )}
        </div>
      ))}
    </div>
  )
}

function EmailDestinationsBlock({
  emails,
  emailNote,
  inPopover = false,
}: {
  emails: ProductEmailDestinationKey[]
  emailNote?: string
  inPopover?: boolean
}) {
  if (emails.length === 0) return null

  return (
    <div className={inPopover ? 'mt-2 pt-2 border-t border-gray-100' : ''}>
      <p className="text-[10px] font-semibold text-violet-900 flex items-center gap-1 mb-1">
        <Mail className="h-3 w-3 shrink-0 text-violet-600" />
        고객 이메일·알림
      </p>
      <div className="flex flex-wrap gap-1">
        {emails.map((key) => (
          <span
            key={key}
            title={PRODUCT_EMAIL_DESTINATIONS[key]?.description}
            className="inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-violet-100 text-violet-900 border border-violet-200/80"
          >
            {getEmailDestinationLabel(key)}
          </span>
        ))}
      </div>
      {emailNote && <p className="text-[10px] text-violet-800/75 mt-1">{emailNote}</p>}
    </div>
  )
}

function LocationHintPopover({
  paths,
  emails,
  note,
  emailNote,
  hasWeb,
  previewHint,
}: {
  paths: string[][]
  emails: ProductEmailDestinationKey[]
  note?: string
  emailNote?: string
  hasWeb: boolean
  previewHint?: string
}) {
  return (
    <div
      className="rounded-lg border border-gray-200 bg-white shadow-xl ring-1 ring-black/5 p-3 min-w-[240px] max-w-[min(420px,calc(100vw-2rem))]"
      role="tooltip"
    >
      <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-2">
        노출 위치 상세
      </p>
      {hasWeb && (
        <div>
          <p className="text-[10px] font-medium text-blue-800 mb-0.5 flex items-center gap-1">
            <Globe className="h-3 w-3" />
            고객 웹 페이지
          </p>
          <PathBreadcrumb paths={paths} />
        </div>
      )}
      <EmailDestinationsBlock emails={emails} emailNote={emailNote} inPopover />
      {note && <p className="text-[11px] text-gray-600 mt-2 pt-2 border-t border-gray-100">{note}</p>}
      {previewHint && (
        <p className="text-[10px] text-indigo-600 mt-2 pt-2 border-t border-gray-100">{previewHint}</p>
      )}
    </div>
  )
}

function HoverPopoverWrap({
  children,
  popover,
  className = '',
  align = 'left',
}: {
  children: React.ReactNode
  popover: React.ReactNode
  className?: string
  align?: 'left' | 'right'
}) {
  const [open, setOpen] = useState(false)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const show = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current)
    setOpen(true)
  }

  const scheduleHide = () => {
    closeTimer.current = setTimeout(() => setOpen(false), 120)
  }

  return (
    <div
      className={`relative inline-block ${className}`}
      onMouseEnter={show}
      onMouseLeave={scheduleHide}
      onFocus={show}
      onBlur={scheduleHide}
    >
      {children}
      {open && (
        <div
          className={`absolute z-[45] top-full pt-1.5 ${align === 'right' ? 'right-0' : 'left-0'}`}
          onMouseEnter={show}
          onMouseLeave={scheduleHide}
        >
          {popover}
        </div>
      )}
    </div>
  )
}

function LocationHintButton({
  hasWeb,
  hasEmail,
  emailCount,
  canPreview,
  previewLabel,
  size = 'md',
  fullWidth = false,
  onClick,
}: {
  hasWeb: boolean
  hasEmail: boolean
  emailCount: number
  canPreview: boolean
  previewLabel?: string
  size?: 'sm' | 'md'
  fullWidth?: boolean
  onClick?: (e: React.MouseEvent) => void
}) {
  const sizeClass =
    size === 'sm' ? 'px-2 py-0.5 text-[10px] gap-1' : 'px-2.5 py-1 text-xs gap-1.5'

  return (
    <button
      type="button"
      onClick={canPreview ? onClick : undefined}
      className={`inline-flex items-center font-medium rounded-md border transition-colors shrink-0 ${sizeClass} ${
        fullWidth ? 'w-full justify-start' : ''
      } ${
        hasEmail && hasWeb
          ? 'border-indigo-200 bg-gradient-to-r from-blue-50 to-violet-50 text-indigo-900 hover:border-indigo-300 hover:from-blue-100 hover:to-violet-100'
          : hasEmail
            ? 'border-violet-200 bg-violet-50 text-violet-900 hover:border-violet-300 hover:bg-violet-100'
            : 'border-blue-200 bg-blue-50 text-blue-900 hover:border-blue-300 hover:bg-blue-100'
      } ${canPreview ? 'cursor-pointer' : 'cursor-default'}`}
    >
      <MapPin className={size === 'sm' ? 'h-3 w-3 shrink-0' : 'h-3.5 w-3.5 shrink-0'} />
      <span>노출 위치</span>
      <span className="inline-flex items-center gap-1 opacity-80">
        {hasWeb && (
          <span className="inline-flex items-center gap-0.5 rounded bg-blue-100/80 px-1 py-0.5 text-[10px] text-blue-800">
            <Globe className="h-2.5 w-2.5" />
            웹
          </span>
        )}
        {hasEmail && (
          <span className="inline-flex items-center gap-0.5 rounded bg-violet-100/80 px-1 py-0.5 text-[10px] text-violet-800">
            <Mail className="h-2.5 w-2.5" />
            {emailCount > 1 ? `이메일 ${emailCount}` : '이메일'}
          </span>
        )}
      </span>
      {canPreview && previewLabel && (
        <span className="text-[10px] font-normal text-indigo-600/80 hidden lg:inline">
          {previewLabel}
        </span>
      )}
    </button>
  )
}

export default function CustomerPageLocationHint({
  location,
  paths: pathsProp,
  internal: internalProp,
  note: noteProp,
  emails: emailsProp,
  emailNote: emailNoteProp,
  variant = 'section',
  className = '',
  previewDisabled = false,
}: CustomerPageLocationHintProps) {
  const { productId, locale } = useCustomerPagePreviewContext()
  const [modalOpen, setModalOpen] = useState(false)

  const internal = internalProp ?? location?.internal ?? false
  const paths = pathsProp ?? location?.paths ?? []
  const note = noteProp ?? location?.note
  const emails = emailsProp ?? location?.emails ?? []
  const emailNote = emailNoteProp ?? location?.emailNote
  const hasWeb = paths.length > 0
  const hasEmail = emails.length > 0
  const previewableEmails = filterPreviewableEmails(emails)
  const canPreviewWeb = !previewDisabled && !internal && hasWeb
  const canPreviewEmail =
    !previewDisabled && !internal && previewableEmails.length > 0 && productId != null
  const canPreview = canPreviewWeb || canPreviewEmail

  const previewLabel =
    canPreviewWeb && canPreviewEmail
      ? '클릭 · 미리보기'
      : canPreviewEmail
        ? '클릭 · 이메일'
        : canPreviewWeb
          ? '클릭 · 웹'
          : undefined

  const hoverPreviewHint = canPreview
    ? canPreviewWeb && canPreviewEmail
      ? '클릭하면 웹·이메일 미리보기'
      : canPreviewEmail
        ? '클릭하면 이메일 미리보기'
        : '클릭하면 페이지 위치 미리보기'
    : undefined

  const openPreview = (e: React.MouseEvent) => {
    if (!canPreview) return
    e.preventDefault()
    e.stopPropagation()
    setModalOpen(true)
  }

  if (internal) {
    if (variant === 'inline') {
      return (
        <span
          className={`inline-flex items-center gap-0.5 ml-1.5 text-[10px] font-medium text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded ${className}`}
          title="고객 페이지·이메일에 표시되지 않음"
        >
          <EyeOff className="h-2.5 w-2.5" />
          내부용
        </span>
      )
    }

    return (
      <HoverPopoverWrap
        className={className}
        popover={
          <div className="rounded-lg border border-gray-200 bg-white shadow-xl p-3 max-w-xs">
            <p className="text-xs font-medium text-gray-700">고객에게 표시되지 않음</p>
            {note && <p className="text-[11px] text-gray-500 mt-1">{note}</p>}
          </div>
        }
      >
        <button
          type="button"
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100"
        >
          <EyeOff className="h-3.5 w-3.5" />
          내부용
        </button>
      </HoverPopoverWrap>
    )
  }

  if (!hasWeb && !hasEmail) return null

  const previewModal = (
    <CustomerPageLocationPreviewModal
      isOpen={modalOpen}
      onClose={() => setModalOpen(false)}
      paths={paths}
      emails={emails}
      productId={productId}
      locale={locale}
      {...(note ? { note } : {})}
      {...(emailNote ? { emailNote } : {})}
    />
  )

  const popover = (
    <LocationHintPopover
      paths={paths}
      emails={emails}
      hasWeb={hasWeb}
      {...(note ? { note } : {})}
      {...(emailNote ? { emailNote } : {})}
      {...(hoverPreviewHint ? { previewHint: hoverPreviewHint } : {})}
    />
  )

  if (variant === 'inline') {
    const lastPath = paths[0]
    const webLabel = lastPath?.slice(-2).join(' › ') ?? ''
    const emailLabel =
      emails.length === 1
        ? getEmailDestinationLabel(emails[0]!)
        : emails.length > 1
          ? `이메일 ${emails.length}종`
          : ''

    return (
      <>
        <span className={`inline-flex flex-wrap items-center gap-1 ml-1.5 ${className}`}>
          {(hasWeb || hasEmail) && (
            <HoverPopoverWrap popover={popover}>
              <button
                type="button"
                onClick={openPreview}
                disabled={!canPreview}
                className={`inline-flex items-center gap-0.5 text-[10px] font-medium text-indigo-800 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100 ${
                  canPreview
                    ? 'hover:bg-indigo-100 hover:border-indigo-300 cursor-pointer'
                    : 'cursor-default'
                }`}
              >
                <MapPin className="h-2.5 w-2.5" />
                노출
              </button>
            </HoverPopoverWrap>
          )}
          {hasWeb && (
            <button
              type="button"
              onClick={openPreview}
              disabled={!canPreviewWeb}
              className={`inline-flex items-center gap-0.5 text-[10px] font-medium text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100 ${
                canPreviewWeb
                  ? 'hover:bg-blue-100 hover:border-blue-300 cursor-pointer'
                  : 'cursor-default'
              }`}
            >
              <Eye className="h-2.5 w-2.5" />
              {webLabel}
            </button>
          )}
          {hasEmail && (
            <button
              type="button"
              onClick={openPreview}
              disabled={!canPreviewEmail}
              className={`inline-flex items-center gap-0.5 text-[10px] font-medium text-violet-800 bg-violet-50 px-1.5 py-0.5 rounded border border-violet-100 ${
                canPreviewEmail
                  ? 'hover:bg-violet-100 hover:border-violet-300 cursor-pointer'
                  : 'cursor-default'
              }`}
            >
              <Mail className="h-2.5 w-2.5" />
              {emailLabel}
            </button>
          )}
        </span>
        {previewModal}
      </>
    )
  }

  const isCompact = variant === 'compact'
  const buttonSize = isCompact || variant === 'inline' ? 'sm' : 'md'

  return (
    <>
      <HoverPopoverWrap className={className} popover={popover}>
        <LocationHintButton
          hasWeb={hasWeb}
          hasEmail={hasEmail}
          emailCount={emails.length}
          canPreview={canPreview}
          previewLabel={previewLabel}
          size={buttonSize}
          onClick={openPreview}
        />
      </HoverPopoverWrap>
      {previewModal}
    </>
  )
}
