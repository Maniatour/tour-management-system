'use client'

import { useEffect, useMemo, useState } from 'react'
import { X, ExternalLink, MapPin, Loader2, Mail, Globe } from 'lucide-react'
import {
  buildCustomerPreviewUrl,
  resolvePreviewTargetsFromPaths,
  type CustomerPreviewTarget,
} from '@/lib/customerPageZones'
import type { ProductEmailDestinationKey } from '@/lib/productEmailDestinations'
import {
  filterPreviewableEmails,
  getEmailDestinationLabel,
  PRODUCT_EMAIL_DESTINATIONS,
} from '@/lib/productEmailDestinations'
import CustomerPageWireframePreview from '@/components/product/CustomerPageWireframePreview'
import ProductEmailPreviewPanel from '@/components/product/ProductEmailPreviewPanel'

type CustomerPageLocationPreviewModalProps = {
  isOpen: boolean
  onClose: () => void
  paths: string[][]
  emails?: ProductEmailDestinationKey[]
  productId: string | null
  locale: string
  note?: string
  emailNote?: string
}

type MainViewMode = 'web' | 'email'

export default function CustomerPageLocationPreviewModal({
  isOpen,
  onClose,
  paths,
  emails = [],
  productId,
  locale,
  note,
  emailNote,
}: CustomerPageLocationPreviewModalProps) {
  const targets = useMemo(() => resolvePreviewTargetsFromPaths(paths), [paths])
  const previewableEmails = useMemo(() => filterPreviewableEmails(emails), [emails])
  const hasWebPreview = targets.length > 0
  const hasEmailPreview = previewableEmails.length > 0 && productId != null

  const [activeIndex, setActiveIndex] = useState(0)
  const [iframeLoading, setIframeLoading] = useState(true)
  const [webViewMode, setWebViewMode] = useState<'live' | 'wireframe'>('live')
  const [mainView, setMainView] = useState<MainViewMode>('web')
  const [activeEmailType, setActiveEmailType] = useState<ProductEmailDestinationKey>(
    previewableEmails[0] ?? 'reservation_confirmation'
  )

  const activeTarget: CustomerPreviewTarget | undefined = targets[activeIndex] ?? targets[0]
  const previewUrl = activeTarget
    ? buildCustomerPreviewUrl(locale, productId, activeTarget)
    : null

  useEffect(() => {
    if (!isOpen) return
    setActiveIndex(0)
    setIframeLoading(true)
    setWebViewMode(previewUrl ? 'live' : 'wireframe')
    const firstEmail = filterPreviewableEmails(emails)[0]
    if (firstEmail) setActiveEmailType(firstEmail)
    if (hasWebPreview) setMainView('web')
    else if (hasEmailPreview) setMainView('email')
  }, [isOpen, paths, previewUrl, emails, hasWebPreview, hasEmailPreview])

  useEffect(() => {
    setIframeLoading(true)
  }, [activeIndex, previewUrl])

  if (!isOpen) return null

  const showMainTabs = hasWebPreview && hasEmailPreview

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-6">
      <div className="absolute inset-0 bg-black/55" onClick={onClose} aria-hidden />

      <div className="relative flex flex-col w-full max-w-5xl max-h-[92vh] bg-white rounded-xl shadow-2xl overflow-hidden">
        <div className="flex items-start justify-between gap-3 px-4 sm:px-5 py-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 via-indigo-50 to-violet-50">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-gray-900">
              {mainView === 'email' ? (
                <Mail className="h-5 w-5 shrink-0 text-violet-600" />
              ) : (
                <MapPin className="h-5 w-5 shrink-0 text-blue-800" />
              )}
              <h2 className="text-base sm:text-lg font-semibold">노출 위치 미리보기</h2>
            </div>
            {mainView === 'web' && activeTarget && (
              <p className="mt-1 text-sm text-gray-700 truncate">{activeTarget.pathLabel}</p>
            )}
            {mainView === 'email' && hasEmailPreview && (
              <p className="mt-1 text-sm text-violet-900">
                {getEmailDestinationLabel(activeEmailType)}
              </p>
            )}
            {note && mainView === 'web' && (
              <p className="mt-1 text-xs text-gray-500">{note}</p>
            )}
            {emails.length > 0 && (
              <div className="mt-2 pt-2 border-t border-violet-200/60">
                <p className="text-xs font-medium text-violet-900 flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5" />
                  고객 이메일·알림에도 포함
                </p>
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {emails.map((key) => {
                    const previewable = previewableEmails.includes(key)
                    return (
                      <button
                        key={key}
                        type="button"
                        disabled={!previewable || productId == null}
                        onClick={() => {
                          if (!previewable || productId == null) return
                          setActiveEmailType(key)
                          setMainView('email')
                        }}
                        title={
                          previewable && productId
                            ? `${PRODUCT_EMAIL_DESTINATIONS[key]?.description} — 클릭하여 미리보기`
                            : PRODUCT_EMAIL_DESTINATIONS[key]?.description
                        }
                        className={`text-[11px] font-medium px-2 py-0.5 rounded-full border transition-colors ${
                          previewable && productId
                            ? 'bg-violet-100 text-violet-900 border-violet-200 hover:bg-violet-200 cursor-pointer'
                            : 'bg-gray-100 text-gray-600 border-gray-200 cursor-default'
                        } ${
                          mainView === 'email' && activeEmailType === key
                            ? 'ring-2 ring-violet-400 ring-offset-1'
                            : ''
                        }`}
                      >
                        {getEmailDestinationLabel(key)}
                        {previewable && productId ? ' ↗' : ''}
                      </button>
                    )
                  })}
                </div>
                {emailNote && (
                  <p className="text-[11px] text-violet-800/80 mt-1">{emailNote}</p>
                )}
                {productId == null && previewableEmails.length > 0 && (
                  <p className="text-[11px] text-amber-700 mt-1">
                    상품 저장 후 이메일 미리보기가 가능합니다.
                  </p>
                )}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg p-2 text-gray-400 hover:bg-white/80 hover:text-gray-600"
            aria-label="닫기"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {showMainTabs && (
          <div className="flex gap-1 px-4 sm:px-5 py-2 border-b border-gray-100 bg-gray-50">
            <button
              type="button"
              onClick={() => setMainView('web')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md font-medium ${
                mainView === 'web'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-600 border border-gray-200 hover:border-blue-300'
              }`}
            >
              <Globe className="h-3.5 w-3.5" />
              고객 웹 페이지
            </button>
            <button
              type="button"
              onClick={() => setMainView('email')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md font-medium ${
                mainView === 'email'
                  ? 'bg-violet-600 text-white'
                  : 'bg-white text-gray-600 border border-gray-200 hover:border-violet-300'
              }`}
            >
              <Mail className="h-3.5 w-3.5" />
              고객 이메일
            </button>
          </div>
        )}

        {mainView === 'email' && hasEmailPreview && previewableEmails.length > 1 && (
          <div className="flex flex-wrap gap-1.5 px-4 sm:px-5 py-2 border-b border-gray-100 bg-violet-50/50">
            {previewableEmails.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setActiveEmailType(key)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                  key === activeEmailType
                    ? 'bg-violet-600 text-white'
                    : 'bg-white text-gray-600 border border-gray-200 hover:border-violet-300'
                }`}
              >
                {getEmailDestinationLabel(key)}
              </button>
            ))}
          </div>
        )}

        {mainView === 'web' && hasWebPreview && targets.length > 1 && (
          <div className="flex flex-wrap gap-1.5 px-4 sm:px-5 py-2 border-b border-gray-100 bg-gray-50">
            {targets.map((target, i) => (
              <button
                key={target.id}
                type="button"
                onClick={() => setActiveIndex(i)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                  i === activeIndex
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-600 border border-gray-200 hover:border-blue-300'
                }`}
              >
                {target.pathLabel}
              </button>
            ))}
          </div>
        )}

        {mainView === 'web' && hasWebPreview && (
          <>
            <div className="flex items-center gap-2 px-4 sm:px-5 py-2 border-b border-gray-100">
              <button
                type="button"
                disabled={!previewUrl}
                onClick={() => setWebViewMode('live')}
                className={`px-3 py-1.5 text-xs rounded-md font-medium ${
                  webViewMode === 'live'
                    ? 'bg-blue-100 text-blue-800'
                    : 'text-gray-600 hover:bg-gray-100 disabled:opacity-40'
                }`}
              >
                실제 고객 페이지
              </button>
              <button
                type="button"
                onClick={() => setWebViewMode('wireframe')}
                className={`px-3 py-1.5 text-xs rounded-md font-medium ${
                  webViewMode === 'wireframe'
                    ? 'bg-blue-100 text-blue-800'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                영역 구조 안내
              </button>
              {previewUrl && webViewMode === 'live' && (
                <a
                  href={previewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-auto inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800"
                >
                  새 탭에서 열기
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
            </div>

            <div className="relative flex-1 min-h-0 bg-gray-100">
              {webViewMode === 'live' && previewUrl ? (
                <>
                  {iframeLoading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-gray-100 z-10">
                      <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />
                    </div>
                  )}
                  <iframe
                    key={previewUrl}
                    title="고객 페이지 미리보기"
                    src={previewUrl}
                    className="w-full h-full min-h-[420px] sm:min-h-[520px] border-0 bg-white"
                    onLoad={() => setIframeLoading(false)}
                  />
                </>
              ) : (
                <div className="h-full min-h-[420px] sm:min-h-[520px] overflow-auto p-4 sm:p-6">
                  {!previewUrl && productId === null && (
                    <p className="text-center text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4">
                      새 상품은 저장 후 실제 페이지 미리보기가 가능합니다. 아래 구조 안내로 위치를
                      확인하세요.
                    </p>
                  )}
                  {activeTarget && <CustomerPageWireframePreview target={activeTarget} />}
                </div>
              )}
            </div>
          </>
        )}

        {mainView === 'email' && hasEmailPreview && productId && (
          <div className="relative flex-1 min-h-0 bg-gray-50">
            <ProductEmailPreviewPanel
              key={`${productId}-${activeEmailType}-${locale}`}
              productId={productId}
              emailType={activeEmailType}
              locale={locale}
            />
          </div>
        )}

        {mainView === 'email' && !hasEmailPreview && (
          <div className="flex-1 min-h-[200px] flex items-center justify-center p-6 bg-violet-50/50">
            <div className="text-center max-w-md">
              <Mail className="h-10 w-10 text-violet-400 mx-auto mb-3" />
              <p className="text-sm text-gray-700">
                {productId == null
                  ? '상품 저장 후 이메일 미리보기가 가능합니다.'
                  : '이 항목은 미리보기 가능한 이메일 유형에 포함되지 않습니다.'}
              </p>
            </div>
          </div>
        )}

        {!hasWebPreview && mainView === 'web' && hasEmailPreview && (
          <div className="flex-1 min-h-[200px] flex items-center justify-center p-6 bg-violet-50/50">
            <p className="text-sm text-gray-600">위 「고객 이메일」 탭에서 미리보기하세요.</p>
          </div>
        )}

        <div className="px-4 sm:px-5 py-3 border-t border-gray-200 bg-white text-xs text-gray-500">
          {mainView === 'email'
            ? '저장된 상품·세부정보가 이메일 본문에 반영됩니다. 실제 예약이 있으면 해당 예약 정보를 사용합니다.'
            : hasWebPreview
              ? '파란 테두리로 강조된 영역에 편집 내용이 표시됩니다. 이메일 미리보기는 「고객 이메일」 탭을 이용하세요.'
              : '이메일·알림은 발송 시점의 상품 데이터를 사용합니다.'}
        </div>
      </div>
    </div>
  )
}
