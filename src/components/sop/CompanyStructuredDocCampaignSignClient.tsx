'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import jsPDF from 'jspdf'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import SopDocumentReadonly from '@/components/sop/SopDocumentReadonly'
import { markdownToHtml } from '@/components/LightRichEditor'
import {
  parseSopDocumentJson,
  flattenSopDocumentToPlainText,
  sopText,
  type SopDocument,
  type SopEditLocale,
} from '@/types/sopStructure'
import { normalizeEmail } from '@/lib/sopPermissions'

function canvasCoords(
  canvas: HTMLCanvasElement,
  clientX: number,
  clientY: number
): { x: number; y: number } {
  const r = canvas.getBoundingClientRect()
  const scaleX = canvas.width / r.width
  const scaleY = canvas.height / r.height
  return {
    x: (clientX - r.left) * scaleX,
    y: (clientY - r.top) * scaleY,
  }
}

type CampaignRow = {
  id: string
  doc_kind: 'sop' | 'employee_contract'
  title: string
  body_structure: unknown
  created_at: string
  closed_at?: string | null
}

type RecipientRow = {
  id: string
  campaign_id: string
  recipient_email: string
  status: string
}

export default function CompanyStructuredDocCampaignSignClient() {
  const router = useRouter()
  const pathname = usePathname() || ''
  const searchParams = useSearchParams()
  const campaignId = searchParams.get('campaign')
  const { authUser, userRole, loading, isInitialized } = useAuth()
  const locale = pathname.split('/').filter(Boolean)[0] || 'ko'
  const isEn = locale === 'en'

  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const drawing = useRef(false)
  const [campaign, setCampaign] = useState<CampaignRow | null>(null)
  const [recipient, setRecipient] = useState<RecipientRow | null>(null)
  const [structureDoc, setStructureDoc] = useState<SopDocument | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [alreadySigned, setAlreadySigned] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [viewLang, setViewLang] = useState<SopEditLocale>(isEn ? 'en' : 'ko')
  const [signedPdfUrl, setSignedPdfUrl] = useState<string | null>(null)

  useEffect(() => {
    setViewLang(isEn ? 'en' : 'ko')
  }, [isEn])

  const staffOk = userRole === 'admin' || userRole === 'manager' || userRole === 'team_member'

  const load = useCallback(async () => {
    if (!isInitialized || loading || !authUser?.id || !authUser.email) return
    if (!staffOk) {
      setLoadError(isEn ? 'Staff only.' : '직원만 접근할 수 있습니다.')
      return
    }
    if (!campaignId) {
      setLoadError(isEn ? 'Missing campaign id.' : '캠페인 정보가 없습니다.')
      return
    }

    const myEmail = normalizeEmail(authUser.email)

    const { data: camp, error: cErr } = await supabase
      .from('company_structured_doc_sign_campaigns')
      .select('id, doc_kind, title, body_structure, created_at, closed_at')
      .eq('id', campaignId)
      .is('closed_at', null)
      .maybeSingle()

    if (cErr || !camp || camp.closed_at) {
      setLoadError(isEn ? 'This sign request was not found or is closed.' : '서명 요청을 찾을 수 없거나 종료되었습니다.')
      return
    }

    const { data: rec, error: rErr } = await supabase
      .from('company_structured_doc_sign_campaign_recipients')
      .select('id, campaign_id, recipient_email, status')
      .eq('campaign_id', campaignId)
      .eq('recipient_email', myEmail)
      .maybeSingle()

    if (rErr || !rec) {
      setLoadError(isEn ? 'You are not on the recipient list for this request.' : '이 요청의 수신 대상이 아닙니다.')
      return
    }

    const { data: sig } = await supabase
      .from('company_structured_doc_campaign_signatures')
      .select('id, pdf_storage_path')
      .eq('campaign_id', campaignId)
      .eq('user_id', authUser.id)
      .maybeSingle()

    if (rec.status === 'signed' || sig) {
      setAlreadySigned(true)
    }

    const pdfPath = sig?.pdf_storage_path ?? null
    if (pdfPath) {
      const { data: urlData } = await supabase.storage
        .from('structured-doc-campaign-signatures')
        .createSignedUrl(pdfPath, 7200)
      setSignedPdfUrl(urlData?.signedUrl ?? null)
    } else {
      setSignedPdfUrl(null)
    }

    const parsed = parseSopDocumentJson(camp.body_structure)
    setCampaign(camp as CampaignRow)
    setRecipient(rec as RecipientRow)
    setStructureDoc(parsed)
  }, [authUser?.email, authUser?.id, campaignId, isEn, isInitialized, loading, staffOk])

  useEffect(() => {
    void load()
  }, [load])

  const startDraw = (canvas: HTMLCanvasElement, x: number, y: number) => {
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    drawing.current = true
    ctx.strokeStyle = '#111'
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(x, y)
  }

  const moveDraw = (canvas: HTMLCanvasElement, x: number, y: number) => {
    if (!drawing.current) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.lineTo(x, y)
    ctx.stroke()
  }

  const endDraw = () => {
    drawing.current = false
  }

  const clearSig = () => {
    const c = canvasRef.current
    if (!c) return
    const ctx = c.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, c.width, c.height)
  }

  const hasSignature = (): boolean => {
    const c = canvasRef.current
    if (!c) return false
    const ctx = c.getContext('2d')
    if (!ctx) return false
    const { data } = ctx.getImageData(0, 0, c.width, c.height)
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] !== 0) return true
    }
    return false
  }

  const submit = async () => {
    if (!campaign || !recipient || !authUser?.email || !authUser?.name) return
    if (!hasSignature()) {
      setSubmitError(isEn ? 'Please sign in the box.' : '서명란에 서명해 주세요.')
      return
    }

    setSubmitting(true)
    setSubmitError(null)

    try {
      const c = canvasRef.current!
      const sigDataUrl = c.toDataURL('image/png')
      const doc = new jsPDF({ unit: 'pt', format: 'a4' })
      const margin = 40
      const pageW = doc.internal.pageSize.getWidth()
      const maxW = pageW - 2 * margin
      let y = margin

      doc.setFontSize(16)
      doc.setFont('helvetica', 'bold')
      doc.text(campaign.title || (campaign.doc_kind === 'sop' ? 'SOP' : 'Contract'), margin, y)
      y += 28
      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      const meta = isEn
        ? `Acknowledgment · Sent ${new Date(campaign.created_at).toLocaleString()}`
        : `확인·서명 요청 · 발송 ${new Date(campaign.created_at).toLocaleString('ko-KR')}`
      doc.text(meta, margin, y)
      y += 22

      const bodyText = structureDoc
        ? flattenSopDocumentToPlainText(structureDoc, viewLang)
        : ''

      doc.setFontSize(11)
      const lines = doc.splitTextToSize(bodyText, maxW) as string[]
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        if (y > doc.internal.pageSize.getHeight() - 120) {
          doc.addPage()
          y = margin
        }
        doc.text(line, margin, y)
        y += 14
      }

      y += 16
      doc.setFont('helvetica', 'bold')
      doc.text(isEn ? 'Signature' : '서명', margin, y)
      y += 12
      doc.addImage(sigDataUrl, 'PNG', margin, y, 220, 70)
      y += 88
      doc.setFont('helvetica', 'normal')
      doc.text(
        `${isEn ? 'Name' : '이름'}: ${authUser.name}  ·  ${isEn ? 'Email' : '이메일'}: ${authUser.email}`,
        margin,
        y
      )
      y += 16
      doc.text(
        `${isEn ? 'Signed at' : '서명 시각'}: ${new Date().toLocaleString(isEn ? 'en-US' : 'ko-KR')}`,
        margin,
        y
      )

      const blob = doc.output('blob')
      const storagePath = `${authUser.id}/${campaign.id}.pdf`
      const bucket = 'structured-doc-campaign-signatures'

      const { error: upErr } = await supabase.storage.from(bucket).upload(storagePath, blob, {
        contentType: 'application/pdf',
        upsert: true,
      })

      if (upErr) {
        setSubmitError(upErr.message || (isEn ? 'Upload failed.' : '업로드에 실패했습니다.'))
        setSubmitting(false)
        return
      }

      const { error: insErr } = await supabase.from('company_structured_doc_campaign_signatures').insert({
        campaign_id: campaign.id,
        user_id: authUser.id,
        signer_email: authUser.email,
        signer_name: authUser.name,
        pdf_storage_path: storagePath,
      })

      if (insErr) {
        setSubmitError(insErr.message || (isEn ? 'Save failed.' : '저장에 실패했습니다.'))
        setSubmitting(false)
        return
      }

      const { error: upRecErr } = await supabase
        .from('company_structured_doc_sign_campaign_recipients')
        .update({ status: 'signed' })
        .eq('id', recipient.id)

      if (upRecErr) {
        console.warn('recipient status update:', upRecErr)
      }

      if (userRole === 'team_member') {
        router.replace(`/${locale}/guide`)
      } else {
        router.replace(`/${locale}/admin/sop`)
      }
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : String(e))
    } finally {
      setSubmitting(false)
    }
  }

  if (!isInitialized || loading) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <p className="text-gray-600">{isEn ? 'Loading…' : '불러오는 중…'}</p>
      </div>
    )
  }

  if (!staffOk) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <p className="text-red-600">{loadError}</p>
      </div>
    )
  }

  if (loadError || !campaign) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <p className="text-red-600">{loadError || (isEn ? 'Not found.' : '찾을 수 없습니다.')}</p>
      </div>
    )
  }

  if (alreadySigned) {
    return (
      <div className="mx-auto max-w-3xl p-6 space-y-4">
        <h1 className="text-xl font-semibold">{isEn ? 'Already signed' : '이미 서명 완료'}</h1>
        <p className="text-gray-700">
          {isEn ? 'This acknowledgment is already on file.' : '이 요청에 대한 서명이 이미 등록되어 있습니다.'}
        </p>
        {signedPdfUrl ? (
          <p>
            <a
              href={signedPdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sky-700 underline font-medium"
            >
              {isEn ? 'Open signed PDF' : '서명 PDF 열기'}
            </a>
          </p>
        ) : (
          <p className="text-sm text-gray-500">
            {isEn ? 'PDF link could not be created. Ask an admin if you need a copy.' : 'PDF 링크를 만들 수 없습니다. 사본이 필요하면 관리자에게 문의하세요.'}
          </p>
        )}
        <Button
          type="button"
          onClick={() =>
            router.push(userRole === 'team_member' ? `/${locale}/guide` : `/${locale}/admin/sop`)
          }
        >
          {isEn ? 'Back' : '돌아가기'}
        </Button>
      </div>
    )
  }

  const headingText =
    structureDoc != null
      ? (sopText(structureDoc.title_ko, structureDoc.title_en, viewLang).trim() || campaign.title)
      : campaign.title

  return (
    <div className="mx-auto max-w-3xl p-4 sm:p-6 space-y-6">
      <div>
        <div
          className="text-2xl font-bold text-gray-900 prose prose-sm max-w-none"
          dangerouslySetInnerHTML={{ __html: markdownToHtml(headingText) }}
        />
        <p className="text-sm text-gray-600 mt-1">
          {isEn ? 'Manager sign request · acknowledgment' : '관리자 발송 · 내용 확인 후 서명'}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-gray-700">{isEn ? 'View language' : '보기 언어'}</span>
        <Button type="button" size="sm" variant={viewLang === 'ko' ? 'default' : 'outline'} onClick={() => setViewLang('ko')}>
          한국어
        </Button>
        <Button type="button" size="sm" variant={viewLang === 'en' ? 'default' : 'outline'} onClick={() => setViewLang('en')}>
          English
        </Button>
      </div>

      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 max-h-[60vh] overflow-y-auto">
        {structureDoc ? (
          <SopDocumentReadonly doc={structureDoc} viewLang={viewLang} />
        ) : (
          <p className="text-gray-600">{isEn ? 'No structured content.' : '구조화된 본문이 없습니다.'}</p>
        )}
      </div>

      <div>
        <p className="text-sm font-medium text-gray-800 mb-2">
          {isEn ? 'Sign below (required)' : '아래에 서명해 주세요 (필수)'}
        </p>
        <canvas
          ref={canvasRef}
          width={560}
          height={200}
          className="touch-none w-full max-w-[560px] border border-gray-400 rounded-md bg-gray-50 cursor-crosshair"
          onMouseDown={(e) => {
            const { x, y } = canvasCoords(e.currentTarget, e.clientX, e.clientY)
            startDraw(e.currentTarget, x, y)
          }}
          onMouseMove={(e) => {
            const { x, y } = canvasCoords(e.currentTarget, e.clientX, e.clientY)
            moveDraw(e.currentTarget, x, y)
          }}
          onMouseUp={endDraw}
          onMouseLeave={endDraw}
          onTouchStart={(ev) => {
            ev.preventDefault()
            const t = ev.touches[0]
            const { x, y } = canvasCoords(ev.currentTarget, t.clientX, t.clientY)
            startDraw(ev.currentTarget, x, y)
          }}
          onTouchMove={(ev) => {
            ev.preventDefault()
            const t = ev.touches[0]
            const { x, y } = canvasCoords(ev.currentTarget, t.clientX, t.clientY)
            moveDraw(ev.currentTarget, x, y)
          }}
          onTouchEnd={endDraw}
        />
        <Button type="button" variant="outline" size="sm" className="mt-2" onClick={clearSig}>
          {isEn ? 'Clear signature' : '서명 지우기'}
        </Button>
      </div>

      {submitError ? <p className="text-sm text-red-600">{submitError}</p> : null}

      <div className="flex flex-wrap gap-2">
        <Button type="button" disabled={submitting} onClick={submit}>
          {submitting ? (isEn ? 'Saving…' : '저장 중…') : isEn ? 'Save signed PDF' : '서명 PDF 저장'}
        </Button>
        <Button type="button" variant="ghost" onClick={() => router.back()}>
          {isEn ? 'Cancel' : '취소'}
        </Button>
      </div>
    </div>
  )
}
