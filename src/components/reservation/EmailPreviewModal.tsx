'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { X, Mail, Eye, Loader2, Send, Copy, Check, Printer } from 'lucide-react'
import ProductDetailFieldEditModal from '@/components/reservation/ProductDetailFieldEditModal'
import {
  isProductDetailEmailEditableField,
  type ProductDetailEmailEditableField,
} from '@/lib/fetchProductDetailsForEmail'

type ProductDetailEditPayload = {
  context: {
    productId: string
    channelId: string | null
    variantKey: string
    languageCode: string
    channelName: string | null
    productDisplayName: string
    sourceLabel: string
  }
  fieldValues: Record<ProductDetailEmailEditableField, string>
  sectionTitles?: Record<string, string>
  /** DB customer_page_visibility (필드명 → false 이면 고객 페이지 숨김) */
  customerPageVisibility?: Record<string, unknown> | null
}

interface EmailPreviewModalProps {
  isOpen: boolean
  onClose: () => void
  reservationId: string
  emailType: 'confirmation' | 'departure' | 'pickup'
  customerEmail: string
  pickupTime?: string | null
  tourDate?: string | null
  onSend: () => Promise<void>
}

export default function EmailPreviewModal({
  isOpen,
  onClose,
  reservationId,
  emailType,
  customerEmail,
  pickupTime,
  tourDate,
  onSend
}: EmailPreviewModalProps) {
  const [emailContent, setEmailContent] = useState<{
    subject: string
    html: string
    customer: {
      name: string
      email: string
      language: string
    }
  } | null>(null)
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [copied, setCopied] = useState(false)
  const [productDetailEdit, setProductDetailEdit] =
    useState<ProductDetailEditPayload | null>(null)
  const [editingField, setEditingField] =
    useState<ProductDetailEmailEditableField | null>(null)
  const previewBodyRef = useRef<HTMLDivElement>(null)

  const showCopyPrintToolbar = emailType === 'confirmation' || emailType === 'departure'

  /** 미리보기 전용: 복사·인쇄 시 수정 버튼·data-pd-field 등 고객용 HTML에 넣지 않을 마크업 제거 */
  const stripAdminPreviewMarkupFromEmailHtml = (html: string): string => {
    try {
      const doc = new DOMParser().parseFromString(html, 'text/html')
      doc.querySelectorAll('button[data-pd-field]').forEach((el) => el.remove())
      doc.querySelectorAll('[data-pd-field]').forEach((el) => {
        el.removeAttribute('data-pd-field')
        const st = el.getAttribute('style')
        if (st) {
          const cleaned = st
            .replace(/cursor\s*:\s*pointer\s*;?/gi, '')
            .replace(/;\s*;/g, ';')
            .replace(/^\s*;\s*|\s*;\s*$/g, '')
            .trim()
          if (cleaned) el.setAttribute('style', cleaned)
          else el.removeAttribute('style')
        }
      })
      doc.querySelectorAll('.email-preview-product-details').forEach((el) => {
        el.classList.remove('email-preview-product-details')
      })
      const doctypeMatch = html.match(/<!DOCTYPE[\s\S]*?>/i)
      const doctype = doctypeMatch ? doctypeMatch[0] : '<!DOCTYPE html>'
      return `${doctype}\n${doc.documentElement.outerHTML}`
    } catch {
      return html
    }
  }

  // HTML → 텍스트 (PickupScheduleEmailPreviewModal과 동일한 핵심 로직, 범용 정리)
  const htmlToText = (html: string): string => {
    const NL = '{{NL}}'
    let processed = html
    const blockTags = ['div', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'tr', 'td', 'th', 'section', 'article', 'header', 'footer']
    for (const tag of blockTags) {
      processed = processed.replace(new RegExp(`</${tag}>`, 'gi'), `</${tag}>${NL}`)
    }
    processed = processed.replace(/<br\s*\/?>/gi, NL)
    const tempDiv = document.createElement('div')
    tempDiv.innerHTML = processed
    tempDiv.querySelectorAll('script, style').forEach(el => el.remove())
    tempDiv.querySelectorAll('a').forEach(link => {
      const linkText = link.textContent?.trim() || ''
      const linkUrl = link.getAttribute('href') || ''
      const replacement = linkUrl
        ? (linkText ? `${linkText} (${linkUrl})` : linkUrl)
        : linkText
      link.parentNode?.replaceChild(document.createTextNode(replacement), link)
    })
    tempDiv.querySelectorAll('img').forEach(img => {
      const src = img.getAttribute('src') || ''
      const alt = img.getAttribute('alt')?.trim()
      const line = src && !src.startsWith('data:') ? (alt ? `${alt} (${src})` : src) : alt
      if (line) {
        img.replaceWith(document.createTextNode(`\n${line}\n`))
      } else {
        img.remove()
      }
    })
    let text = tempDiv.textContent || ''
    text = text.replace(/\{\{NL\}\}/g, '\n')
    text = text.replace(/[ \t]+/g, ' ')
    text = text.replace(/\n{4,}/g, '\n\n')
    text = text.replace(/\n{3,}/g, '\n\n')
    return text.trim()
  }

  const handleCopyText = async () => {
    if (!emailContent) return
    try {
      let textContent = htmlToText(
        stripAdminPreviewMarkupFromEmailHtml(emailContent.html)
      )
      textContent = textContent.replace(/\n/g, '\r\n')
      await navigator.clipboard.writeText(textContent)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error('텍스트 복사 실패:', error)
      const textArea = document.createElement('textarea')
      textArea.value = htmlToText(
        stripAdminPreviewMarkupFromEmailHtml(emailContent.html)
      ).replace(/\n/g, '\r\n')
      textArea.style.position = 'fixed'
      textArea.style.opacity = '0'
      document.body.appendChild(textArea)
      textArea.select()
      try {
        document.execCommand('copy')
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      } catch {
        alert('텍스트 복사에 실패했습니다.')
      }
      document.body.removeChild(textArea)
    }
  }

  const handleCopyHtml = async () => {
    if (!emailContent) return
    const cleanHtml = stripAdminPreviewMarkupFromEmailHtml(emailContent.html)
    try {
      const htmlBlob = new Blob([cleanHtml], { type: 'text/html' })
      const textBlob = new Blob([cleanHtml], { type: 'text/plain' })
      const clipboardItem = new ClipboardItem({
        'text/html': htmlBlob,
        'text/plain': textBlob
      })
      await navigator.clipboard.write([clipboardItem])
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error('HTML 복사 실패:', error)
      try {
        await navigator.clipboard.writeText(cleanHtml)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
        alert('일부 환경에서는 서식 없이 복사됩니다. 이메일 작성 시 붙여넣기를 확인해 주세요.')
      } catch {
        const textArea = document.createElement('textarea')
        textArea.value = cleanHtml
        textArea.style.position = 'fixed'
        textArea.style.opacity = '0'
        document.body.appendChild(textArea)
        textArea.select()
        try {
          document.execCommand('copy')
          setCopied(true)
          setTimeout(() => setCopied(false), 2000)
        } catch {
          alert('복사에 실패했습니다.')
        }
        document.body.removeChild(textArea)
      }
    }
  }

  const handlePrint = () => {
    if (!emailContent) return
    const w = window.open('', '_blank')
    if (!w) {
      alert('팝업이 차단되었습니다. 팝업을 허용한 뒤 다시 시도해 주세요.')
      return
    }
    const subject = (emailContent.subject || 'Email').replace(/</g, '&lt;')
    const printHtml = stripAdminPreviewMarkupFromEmailHtml(emailContent.html)
    w.document.write(`<!DOCTYPE html><html lang="ko"><head><meta charset="utf-8"><title>${subject}</title>
<style>body{font-family:system-ui,sans-serif;padding:16px;max-width:600px;margin:0 auto;} @media print { body { padding: 8px; } }</style></head><body>
${printHtml}
</body></html>`)
    w.document.close()
    setTimeout(() => {
      try {
        w.focus()
        w.print()
      } finally {
        w.close()
      }
    }, 250)
  }

  const loadEmailPreview = useCallback(async () => {
    if (!isOpen || !reservationId) return

    setLoading(true)
    try {
      let response: Response

      if (emailType === 'pickup') {
        if (!pickupTime || !tourDate) {
          alert('픽업 시간과 투어 날짜가 필요합니다.')
          setLoading(false)
          return
        }

        response = await fetch('/api/preview-pickup-schedule-notification', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            reservationId,
            pickupTime: pickupTime.includes(':') ? pickupTime : `${pickupTime}:00`,
            tourDate,
          }),
        })
      } else {
        const type = emailType === 'confirmation' ? 'both' : 'voucher'
        response = await fetch('/api/preview-email', {
          method: 'POST',
          cache: 'no-store',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            reservationId,
            type,
          }),
        })
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(
          errorData.error || `이메일 미리보기 로드 실패 (${response.status})`
        )
      }

      const data = await response.json()
      if (!data.emailContent) {
        throw new Error('이메일 내용을 받을 수 없습니다.')
      }
      setEmailContent(data.emailContent)
      if (data.productDetailEdit && emailType !== 'pickup') {
        setProductDetailEdit(data.productDetailEdit as ProductDetailEditPayload)
      }
    } catch (error) {
      console.error('이메일 미리보기 로드 오류:', error)
      alert('이메일 미리보기를 불러오는 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }, [isOpen, reservationId, emailType, pickupTime, tourDate])

  useEffect(() => {
    loadEmailPreview()
  }, [loadEmailPreview])

  useEffect(() => {
    if (emailType === 'pickup') return
    if (!productDetailEdit) return
    const root = previewBodyRef.current
    if (!root) return

    const onClick = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null
      const el = t?.closest('[data-pd-field]') as HTMLElement | null
      if (!el) return
      const field = el.getAttribute('data-pd-field')
      if (!field || !isProductDetailEmailEditableField(field)) return
      e.preventDefault()
      e.stopPropagation()
      setEditingField(field)
    }

    root.addEventListener('click', onClick)
    return () => root.removeEventListener('click', onClick)
  }, [emailContent, productDetailEdit, emailType])

  const handleSend = async () => {
    setSending(true)
    try {
      await onSend()
      onClose()
    } catch (error) {
      console.error('이메일 발송 오류:', error)
    } finally {
      setSending(false)
    }
  }

  if (!isOpen) return null

  const emailTypeLabels = {
    confirmation: '예약 확인 이메일',
    departure: '투어 출발 확정 이메일',
    pickup: '픽업 notification 이메일'
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-lg w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* 헤더 */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-3">
            <Eye className="w-5 h-5 text-blue-600" />
            <h2 className="text-xl font-bold text-gray-900">{emailTypeLabels[emailType]} 미리보기</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X size={24} />
          </button>
        </div>

        {/* 본문 */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
                <p className="text-gray-600">이메일 미리보기를 불러오는 중...</p>
              </div>
            </div>
          ) : emailContent ? (
            <div className="space-y-4">
              {/* 이메일 정보 */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="font-semibold text-gray-700">받는 사람:</span>
                    <span className="ml-2 text-gray-900">{emailContent.customer?.name || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="font-semibold text-gray-700">이메일:</span>
                    <span className="ml-2 text-gray-900">{emailContent.customer?.email || customerEmail}</span>
                  </div>
                  <div>
                    <span className="font-semibold text-gray-700">언어:</span>
                    <span className="ml-2 text-gray-900">{emailContent.customer?.language || '한국어'}</span>
                  </div>
                  <div>
                    <span className="font-semibold text-gray-700">제목:</span>
                    <span className="ml-2 text-gray-900">{emailContent.subject || 'N/A'}</span>
                  </div>
                </div>
              </div>

              {productDetailEdit &&
                (emailType === 'confirmation' || emailType === 'departure') && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                    상품 상세 정보의 각 제목을 클릭하거나 옆의{' '}
                    <span className="font-semibold">수정</span>을 누르면, 이 예약에
                    쓰인 채널·언어·variant의 해당 섹션만 데이터베이스에 바로 저장됩니다.
                  </div>
                )}

              {/* 이메일 내용 미리보기 */}
              <div className="border rounded-lg overflow-hidden bg-white">
                <div className="bg-gray-100 px-4 py-2 border-b">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Mail className="w-4 h-4" />
                      <span>이메일 미리보기</span>
                    </div>
                    {showCopyPrintToolbar && (
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={handlePrint}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-slate-600 text-white rounded hover:bg-slate-700 transition-colors"
                          title="인쇄"
                        >
                          <Printer className="w-4 h-4" />
                          <span>인쇄</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleCopyHtml}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                          title="HTML 복사"
                        >
                          {copied ? (
                            <>
                              <Check className="w-4 h-4" />
                              <span>복사됨</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-4 h-4" />
                              <span>HTML 복사</span>
                            </>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={handleCopyText}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                          title="텍스트 복사"
                        >
                          {copied ? (
                            <>
                              <Check className="w-4 h-4" />
                              <span>복사됨</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-4 h-4" />
                              <span>텍스트 복사</span>
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                <div
                  ref={previewBodyRef}
                  className="p-4"
                  dangerouslySetInnerHTML={{ __html: emailContent.html }}
                  style={{
                    maxWidth: '600px',
                    margin: '0 auto',
                    backgroundColor: '#ffffff',
                  }}
                />
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center text-gray-500">
                <Mail className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p>이메일 미리보기를 불러올 수 없습니다.</p>
              </div>
            </div>
          )}
        </div>

        {/* 푸터 */}
        <div className="flex items-center justify-between p-4 border-t bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
          >
            닫기
          </button>
          <button
            onClick={handleSend}
            disabled={sending || !emailContent}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {sending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>발송 중...</span>
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                <span>이메일 발송</span>
              </>
            )}
          </button>
        </div>
      </div>

      {productDetailEdit && editingField && (
        <ProductDetailFieldEditModal
          isOpen={!!editingField}
          onClose={() => setEditingField(null)}
          productId={productDetailEdit.context.productId}
          channelId={productDetailEdit.context.channelId}
          variantKey={productDetailEdit.context.variantKey}
          languageCode={productDetailEdit.context.languageCode}
          field={editingField}
          initialValue={
            productDetailEdit.fieldValues[editingField] ?? ''
          }
          sourceLabel={productDetailEdit.context.sourceLabel}
          isEnglish={productDetailEdit.context.languageCode === 'en'}
          sectionTitles={productDetailEdit.sectionTitles ?? {}}
          customerPageVisibility={productDetailEdit.customerPageVisibility ?? null}
          onSaved={() => void loadEmailPreview()}
        />
      )}
    </div>
  )
}


