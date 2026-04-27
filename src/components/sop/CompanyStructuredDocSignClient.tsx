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

export type CompanyStructuredDocSignKind = 'sop' | 'employee_contract'

type VersionRow = {
  id: string
  title: string
  body_md: string | null
  body_structure: unknown
  version_number: number
  published_at: string
}

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

export default function CompanyStructuredDocSignClient({
  documentType,
}: {
  documentType: CompanyStructuredDocSignKind
}) {
  const router = useRouter()
  const pathname = usePathname() || ''
  const searchParams = useSearchParams()
  const versionParam = searchParams.get('version')
  const { authUser, userRole, loading, isInitialized } = useAuth()
  const locale = pathname.split('/').filter(Boolean)[0] || 'ko'
  const isEn = locale === 'en'

  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const drawing = useRef(false)
  const [version, setVersion] = useState<VersionRow | null>(null)
  const [structureDoc, setStructureDoc] = useState<SopDocument | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [alreadySigned, setAlreadySigned] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [viewLang, setViewLang] = useState<SopEditLocale>(isEn ? 'en' : 'ko')

  const isContract = documentType === 'employee_contract'

  useEffect(() => {
    setViewLang(isEn ? 'en' : 'ko')
  }, [isEn])

  const staffOk =
    userRole === 'admin' || userRole === 'manager' || userRole === 'team_member'

  const load = useCallback(async () => {
    if (!isInitialized || loading || !authUser?.id) return
    if (!staffOk) {
      setLoadError(isEn ? 'Staff only.' : '직원만 접근할 수 있습니다.')
      return
    }

    const versionQuery =
      documentType === 'sop'
        ? versionParam
          ? supabase
              .from('company_sop_versions')
              .select('id, title, body_md, body_structure, version_number, published_at')
              .eq('id', versionParam)
              .maybeSingle()
          : supabase
              .from('company_sop_versions')
              .select('id, title, body_md, body_structure, version_number, published_at')
              .order('published_at', { ascending: false })
              .limit(1)
              .maybeSingle()
        : versionParam
          ? supabase
              .from('company_employee_contract_versions')
              .select('id, title, body_md, body_structure, version_number, published_at')
              .eq('id', versionParam)
              .maybeSingle()
          : supabase
              .from('company_employee_contract_versions')
              .select('id, title, body_md, body_structure, version_number, published_at')
              .order('published_at', { ascending: false })
              .limit(1)
              .maybeSingle()

    const { data, error } = await versionQuery

    if (error || !data) {
      setLoadError(
        isEn
          ? isContract
            ? 'Could not load the contract.'
            : 'Could not load SOP.'
          : isContract
            ? '계약서를 불러오지 못했습니다.'
            : 'SOP를 불러오지 못했습니다.'
      )
      return
    }

    const sigQuery =
      documentType === 'sop'
        ? supabase.from('sop_signatures').select('id').eq('version_id', data.id).eq('user_id', authUser.id).maybeSingle()
        : supabase
            .from('employee_contract_signatures')
            .select('id')
            .eq('version_id', data.id)
            .eq('user_id', authUser.id)
            .maybeSingle()

    const { data: sig } = await sigQuery

    if (sig) {
      setAlreadySigned(true)
    }

    const row = data as VersionRow
    setVersion(row)
    const parsed = parseSopDocumentJson(row.body_structure)
    setStructureDoc(parsed)
  }, [authUser?.id, documentType, isEn, isInitialized, loading, staffOk, versionParam])

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
    if (!version || !authUser?.email || !authUser?.name) return
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
      doc.text(version.title, margin, y)
      y += 28
      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      const meta = isEn
        ? `Version ${version.version_number} · Published ${new Date(version.published_at).toLocaleString()}`
        : `제${version.version_number}판 · 게시 ${new Date(version.published_at).toLocaleString('ko-KR')}`
      doc.text(meta, margin, y)
      y += 22

      const bodyText = structureDoc
        ? flattenSopDocumentToPlainText(structureDoc, viewLang)
        : version.body_md || ''

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
      const storagePath = `${authUser.id}/${version.id}.pdf`
      const bucket = isContract ? 'employee-contract-signatures' : 'sop-signatures'

      const { error: upErr } = await supabase.storage.from(bucket).upload(storagePath, blob, {
        contentType: 'application/pdf',
        upsert: true,
      })

      if (upErr) {
        setSubmitError(upErr.message || (isEn ? 'Upload failed.' : '업로드에 실패했습니다.'))
        setSubmitting(false)
        return
      }

      const insertPayload = {
        version_id: version.id,
        user_id: authUser.id,
        signer_email: authUser.email,
        signer_name: authUser.name,
        pdf_storage_path: storagePath,
      }

      const { error: insErr } =
        documentType === 'sop'
          ? await supabase.from('sop_signatures').insert(insertPayload)
          : await supabase.from('employee_contract_signatures').insert(insertPayload)

      if (insErr) {
        setSubmitError(insErr.message || (isEn ? 'Save failed.' : '저장에 실패했습니다.'))
        setSubmitting(false)
        return
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

  if (loadError || !version) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <p className="text-red-600">
          {loadError ||
            (isEn ? (isContract ? 'No contract found.' : 'No SOP found.') : isContract ? '계약서가 없습니다.' : 'SOP가 없습니다.')}
        </p>
      </div>
    )
  }

  if (alreadySigned) {
    return (
      <div className="mx-auto max-w-3xl p-6 space-y-4">
        <h1 className="text-xl font-semibold">{isEn ? 'Already signed' : '이미 서명 완료'}</h1>
        <p className="text-gray-700">
          {isEn ? 'This version is already on file.' : '이 버전에 대한 서명이 이미 등록되어 있습니다.'}
        </p>
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
      ? (sopText(structureDoc.title_ko, structureDoc.title_en, viewLang).trim() || version.title)
      : version.title

  return (
    <div className="mx-auto max-w-3xl p-4 sm:p-6 space-y-6">
      <div>
        <div
          className="text-2xl font-bold text-gray-900 prose prose-sm max-w-none"
          dangerouslySetInnerHTML={{ __html: markdownToHtml(headingText) }}
        />
        <p className="text-sm text-gray-600 mt-1">
          {isEn ? `Version ${version.version_number}` : `제${version.version_number}판`} ·{' '}
          {new Date(version.published_at).toLocaleString(isEn ? 'en-US' : 'ko-KR')}
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
          <pre className="whitespace-pre-wrap font-sans text-sm text-gray-800">{version.body_md || ''}</pre>
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
