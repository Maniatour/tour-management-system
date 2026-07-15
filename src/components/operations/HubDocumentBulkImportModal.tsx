'use client'

import { useEffect, useRef, useState } from 'react'
import { FileUp, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { supabase } from '@/lib/supabase'
import {
  mergeParallelKoEnPasteDocs,
  parseSopPlainTextToDocument,
  type SopDocument,
} from '@/types/sopStructure'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  uiLocaleEn?: boolean
  /** 모달 열 때 기존 원문 미리 채움 */
  initialRawKo?: string
  initialRawEn?: string
  /** 구조 파싱 + 원문 보관 후 본문 교체 */
  onApplyStructure: (doc: SopDocument) => void
  /** 구조는 그대로 두고 원문만 갱신 */
  onApplyRawOnly: (raw: { ko: string; en: string }) => void
}

type LocaleSide = 'ko' | 'en'

function countStructure(doc: SopDocument) {
  let categories = 0
  let lines = 0
  for (const s of doc.sections) {
    categories += s.categories.length
    for (const c of s.categories) {
      lines += c.checklist_items?.length ?? 0
    }
  }
  return { sections: doc.sections.length, categories, lines }
}

function buildMergedDoc(rawKo: string, rawEn: string): SopDocument {
  const koDoc = parseSopPlainTextToDocument(rawKo, 'ko')
  const enDoc = parseSopPlainTextToDocument(rawEn, 'en')
  const merged = mergeParallelKoEnPasteDocs(koDoc, enDoc)
  return {
    ...merged,
    ...(rawKo.trim() ? { source_raw_ko: rawKo.trim() } : {}),
    ...(rawEn.trim() ? { source_raw_en: rawEn.trim() } : {}),
  }
}

function attachSourceRaw(doc: SopDocument, rawKo: string, rawEn: string): SopDocument {
  const next: SopDocument = { ...doc }
  if (rawKo.trim()) next.source_raw_ko = rawKo.trim()
  else delete next.source_raw_ko
  if (rawEn.trim()) next.source_raw_en = rawEn.trim()
  else delete next.source_raw_en
  return next
}

export default function HubDocumentBulkImportModal({
  open,
  onOpenChange,
  uiLocaleEn,
  initialRawKo = '',
  initialRawEn = '',
  onApplyStructure,
  onApplyRawOnly,
}: Props) {
  const fileInputKoRef = useRef<HTMLInputElement>(null)
  const fileInputEnRef = useRef<HTMLInputElement>(null)
  const [rawKo, setRawKo] = useState('')
  const [rawEn, setRawEn] = useState('')
  const [busySide, setBusySide] = useState<LocaleSide | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [preview, setPreview] = useState<ReturnType<typeof countStructure> | null>(null)

  const busy = busySide !== null
  const hasAnyText = !!(rawKo.trim() || rawEn.trim())

  useEffect(() => {
    if (!open) return
    setRawKo(initialRawKo)
    setRawEn(initialRawEn)
    setMsg(null)
    setPreview(null)
  }, [open, initialRawKo, initialRawEn])

  const resetFeedback = () => {
    setMsg(null)
    setPreview(null)
  }

  const clearLocal = () => {
    setRawKo('')
    setRawEn('')
    resetFeedback()
  }

  const runPreview = () => {
    const doc = buildMergedDoc(rawKo, rawEn)
    setPreview(countStructure(doc))
    return doc
  }

  const handleFile = async (file: File | null, side: LocaleSide) => {
    if (!file) return
    resetFeedback()
    setBusySide(side)
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      const form = new FormData()
      form.append('file', file)
      const headers: HeadersInit = {}
      if (session?.access_token) {
        headers.Authorization = `Bearer ${session.access_token}`
      }
      const res = await fetch('/api/operations-hub/extract-document-text', {
        method: 'POST',
        headers,
        body: form,
      })
      const data = (await res.json()) as { text?: string; error?: string; fileName?: string }
      if (!res.ok) throw new Error(data.error || (uiLocaleEn ? 'Upload failed' : '업로드 실패'))
      const text = (data.text || '').trim()
      if (!text) {
        throw new Error(
          uiLocaleEn
            ? 'No text could be extracted from the file.'
            : '파일에서 텍스트를 추출하지 못했습니다.'
        )
      }
      if (side === 'ko') setRawKo(text)
      else setRawEn(text)

      const nextKo = side === 'ko' ? text : rawKo
      const nextEn = side === 'en' ? text : rawEn
      setPreview(countStructure(buildMergedDoc(nextKo, nextEn)))
      setMsg(
        uiLocaleEn
          ? `Loaded “${data.fileName || file.name}” into ${side === 'ko' ? 'Korean' : 'English'}.`
          : `「${data.fileName || file.name}」을 ${side === 'ko' ? '한국어' : '영문'} 칸에 불러왔습니다.`
      )
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e))
    } finally {
      setBusySide(null)
      const input = side === 'ko' ? fileInputKoRef.current : fileInputEnRef.current
      if (input) input.value = ''
    }
  }

  const handleApplyStructure = () => {
    resetFeedback()
    if (!hasAnyText) {
      setMsg(
        uiLocaleEn
          ? 'Paste Korean and/or English text first.'
          : '한국어·영문 중 하나 이상 붙여넣어 주세요.'
      )
      return
    }
    try {
      const doc = attachSourceRaw(runPreview(), rawKo, rawEn)
      if (doc.sections.length === 0) {
        setMsg(
          uiLocaleEn
            ? 'Could not detect sections. Use # / ## / ### headings, or save as original only.'
            : '섹션을 인식하지 못했습니다. # / ## / ### 제목을 쓰거나 「원문만 저장」을 사용하세요.'
        )
        return
      }
      onApplyStructure(doc)
      clearLocal()
      onOpenChange(false)
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e))
    }
  }

  const handleApplyRawOnly = () => {
    resetFeedback()
    if (!hasAnyText) {
      setMsg(
        uiLocaleEn
          ? 'Paste Korean and/or English text first.'
          : '한국어·영문 중 하나 이상 붙여넣어 주세요.'
      )
      return
    }
    onApplyRawOnly({ ko: rawKo.trim(), en: rawEn.trim() })
    clearLocal()
    onOpenChange(false)
  }

  const renderSide = (
    side: LocaleSide,
    value: string,
    setValue: (v: string) => void,
    fileRef: React.RefObject<HTMLInputElement | null>
  ) => {
    const isKo = side === 'ko'
    const uploading = busySide === side
    return (
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span
            className={
              isKo
                ? 'rounded bg-sky-700 px-2 py-0.5 text-xs font-bold text-white'
                : 'rounded bg-violet-700 px-2 py-0.5 text-xs font-bold text-white'
            }
          >
            {isKo ? '한국어' : 'English'}
          </span>
          <div className="flex items-center gap-1.5">
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.docx,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown"
              className="hidden"
              onChange={(e) => void handleFile(e.target.files?.[0] ?? null, side)}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 px-2 text-[11px]"
              disabled={busy}
              onClick={() => fileRef.current?.click()}
            >
              {uploading ? (
                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              ) : (
                <FileUp className="mr-1 h-3 w-3" />
              )}
              {uiLocaleEn ? 'Upload…' : '업로드…'}
            </Button>
          </div>
        </div>
        <textarea
          className={
            isKo
              ? 'min-h-[220px] w-full rounded-lg border border-sky-200 bg-sky-50/40 px-3 py-2 font-mono text-xs leading-relaxed text-slate-800 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400'
              : 'min-h-[220px] w-full rounded-lg border border-violet-200 bg-violet-50/40 px-3 py-2 font-mono text-xs leading-relaxed text-slate-800 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400'
          }
          value={value}
          disabled={busy}
          onChange={(e) => {
            setValue(e.target.value)
            setPreview(null)
            setMsg(null)
          }}
          placeholder={
            isKo
              ? '# 보고서 제목\n## 1. 섹션\n…'
              : '# Report Title\n## 1. Section\n…'
          }
          aria-label={isKo ? 'Korean document text' : 'English document text'}
        />
      </div>
    )
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) clearLocal()
        onOpenChange(o)
      }}
    >
      <DialogContent
        stackLevel="nested"
        className="flex max-h-[90vh] max-w-4xl flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl"
      >
        <DialogHeader className="shrink-0 space-y-2 border-b border-slate-200 px-6 pb-4 pt-6 pr-14 text-left">
          <DialogTitle>
            {uiLocaleEn ? 'Import full document (KO + EN)' : '통짜 문서 가져오기 (한국어·영문)'}
          </DialogTitle>
          <DialogDescription className="text-left text-sm">
            {uiLocaleEn
              ? 'Paste or upload Korean and English separately. “Apply as structure” parses into sections and also keeps the original text. “Save original only” keeps the current structure and stores the paste for the Original tab.'
              : '한글·영문 문서를 각각 붙여넣거나 업로드하세요. 「구조로 적용」은 섹션으로 나누고 원문도 함께 보관합니다. 「원문만 저장」은 현재 구조는 그대로 두고 원문 보기용으로만 보관합니다.'}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-6 py-4">
          <p className="text-[11px] text-slate-500">
            {uiLocaleEn
              ? 'PDF, DOCX, TXT, MD · max 15MB each · one language per box'
              : 'PDF, DOCX, TXT, MD · 칸당 최대 15MB · 칸마다 한 언어'}
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            {renderSide('ko', rawKo, setRawKo, fileInputKoRef)}
            {renderSide('en', rawEn, setRawEn, fileInputEnRef)}
          </div>

          {preview ? (
            <p className="text-xs text-indigo-800">
              {uiLocaleEn
                ? `Structure preview: ${preview.sections} sections · ${preview.categories} categories · ${preview.lines} lines`
                : `구조 미리보기: 섹션 ${preview.sections} · 카테고리 ${preview.categories} · 줄 ${preview.lines}`}
            </p>
          ) : null}
          {msg ? <p className="text-xs text-amber-800">{msg}</p> : null}
        </div>

        <DialogFooter className="shrink-0 flex flex-wrap gap-2 border-t border-slate-200 px-6 py-4 sm:justify-end">
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => onOpenChange(false)}
          >
            {uiLocaleEn ? 'Cancel' : '취소'}
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={busy || !hasAnyText}
            onClick={() => {
              try {
                runPreview()
                setMsg(
                  uiLocaleEn
                    ? 'Structure preview updated (apply separately below).'
                    : '구조 미리보기를 갱신했습니다. 아래에서 적용 방식을 고르세요.'
                )
              } catch (e) {
                setMsg(e instanceof Error ? e.message : String(e))
              }
            }}
          >
            {uiLocaleEn ? 'Parse preview' : '구조 미리보기'}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={busy || !hasAnyText}
            onClick={handleApplyRawOnly}
          >
            {uiLocaleEn ? 'Save original only' : '원문만 저장'}
          </Button>
          <Button type="button" disabled={busy || !hasAnyText} onClick={handleApplyStructure}>
            {uiLocaleEn ? 'Apply as structure' : '구조로 적용'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
