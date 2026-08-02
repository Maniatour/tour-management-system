'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Loader2, Mail, Save, FileText, RefreshCw, CheckCircle2 } from 'lucide-react'
import { fetchApiWithAuth } from '@/lib/api-client-bearer'
import { domElementToPdfBlob } from '@/lib/sopPreviewPrintAndPdf'
import { downloadDomAsA4Pdf } from '@/lib/sopPreviewPrintAndPdf'
import { DailyReportDocument } from '@/components/admin/daily-report/DailyReportDocument'
import type { DailyReportData } from '@/lib/dailyReport/types'
import { DAILY_REPORT_TRAVEL_AGENCY_RECOMMENDATIONS } from '@/lib/dailyReport/types'
import { todayInLasVegas, getDailyReportDatePreset, DAILY_REPORT_DATE_PRESET_LABELS, formatReportDateRangeLabel, type DailyReportDatePreset } from '@/lib/dailyReport/dateUtils'
import { useOperator } from '@/contexts/OperatorContext'

type DailyReportPreviewModalProps = {
  open: boolean
  onClose: () => void
  locale?: string
  reportDate?: string
}

type ExistingMeta = {
  id: string
  status: 'draft' | 'submitted'
  submittedAt: string | null
  pdfUrl: string | null
  emailSentAt: string | null
} | null

export function DailyReportPreviewModal({
  open,
  onClose,
  locale = 'ko',
  reportDate,
}: DailyReportPreviewModalProps) {
  const isKo = locale.startsWith('ko')
  const { operatorId } = useOperator()
  const previewRef = useRef<HTMLDivElement>(null)

  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [data, setData] = useState<DailyReportData | null>(null)
  const [existing, setExisting] = useState<ExistingMeta>(null)
  const [activeTab, setActiveTab] = useState<'preview' | 'edit'>('preview')
  const [startDate, setStartDate] = useState(() => reportDate ?? todayInLasVegas())
  const [endDate, setEndDate] = useState(() => reportDate ?? todayInLasVegas())

  useEffect(() => {
    if (!open) return
    const d = reportDate ?? todayInLasVegas()
    setStartDate(d)
    setEndDate(d)
  }, [open, reportDate])

  const reportDateForLoad = startDate
  const isRangeReport = startDate !== endDate

  const loadReport = useCallback(async () => {
    if (!open || !reportDateForLoad || !endDate) return
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('startDate', reportDateForLoad)
      params.set('endDate', endDate)
      if (operatorId) params.set('operatorId', operatorId)

      const res = await fetchApiWithAuth(`/api/admin/daily-reports?${params}`)
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || '데이터를 불러오지 못했습니다.')
      }
      const json = await res.json()
      setData(json.data as DailyReportData)
      setExisting(json.existing ?? null)
    } catch (e) {
      console.error('DailyReportPreviewModal load', e)
      alert(isKo ? '일일 보고 데이터를 불러오지 못했습니다.' : 'Failed to load daily report.')
    } finally {
      setLoading(false)
    }
  }, [operatorId, isKo, open, reportDateForLoad, endDate])

  useEffect(() => {
    if (open && startDate && endDate) {
      void loadReport()
    }
  }, [open, startDate, endDate, loadReport])

  const handleStartDateChange = (value: string) => {
    setStartDate(value)
    if (endDate < value) setEndDate(value)
  }

  const handleEndDateChange = (value: string) => {
    setEndDate(value)
    if (startDate > value) setStartDate(value)
  }

  const applyDatePreset = (preset: DailyReportDatePreset) => {
    const range = getDailyReportDatePreset(preset)
    setStartDate(range.start)
    setEndDate(range.end)
  }

  const datePresets: DailyReportDatePreset[] = [
    'today',
    'yesterday',
    'this_week',
    'last_week',
    'this_month',
    'last_month',
  ]

  const updateNotes = (
    section: 'reservation' | 'tour' | 'todo' | 'tomorrow' | 'additional',
    value: string
  ) => {
    if (!data) return
    setData({
      ...data,
      ...(section === 'additional'
        ? { additionalNotes: value }
        : section === 'reservation'
          ? { reservationSummary: { ...data.reservationSummary, notes: value } }
          : section === 'tour'
            ? { tourSummary: { ...data.tourSummary, notes: value } }
            : section === 'todo'
              ? { todoSummary: { ...data.todoSummary, notes: value } }
              : { tomorrowSchedule: { ...data.tomorrowSchedule, notes: value } }),
    })
  }

  const handleSaveDraft = async () => {
    if (!data) return
    setSaving(true)
    try {
      const res = await fetchApiWithAuth('/api/admin/daily-reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportData: data, operatorId: operatorId }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || '저장 실패')
      }
      alert(isKo ? '초안이 저장되었습니다.' : 'Draft saved.')
      void loadReport()
    } catch (e) {
      console.error('save draft', e)
      alert(isKo ? '초안 저장에 실패했습니다.' : 'Failed to save draft.')
    } finally {
      setSaving(false)
    }
  }

  const handleDownloadPdf = async () => {
    if (!previewRef.current || !data) return
    try {
      await downloadDomAsA4Pdf(
        previewRef.current,
        isRangeReport ? `report-${startDate}_${endDate}` : `daily-report-${data.reportDate}`,
        { format: 'letter' }
      )
    } catch (e) {
      console.error('pdf download', e)
      alert(isKo ? 'PDF 다운로드에 실패했습니다.' : 'PDF download failed.')
    }
  }

  const handleSubmit = async () => {
    if (!data || !previewRef.current) return

    const confirmMsg = isKo
      ? `SUPER 관리자에게 ${formatReportDateRangeLabel(data.reportDate, data.reportEndDate ?? data.reportDate, locale)} 업무 보고를 발송하시겠습니까?\nPDF가 서버에 저장되고 이메일이 전송됩니다.`
      : `Send the report for ${formatReportDateRangeLabel(data.reportDate, data.reportEndDate ?? data.reportDate, locale)} to SUPER admins?`

    if (!window.confirm(confirmMsg)) return

    setSubmitting(true)
    try {
      const pdfBlob = await domElementToPdfBlob(previewRef.current, { format: 'letter' })
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => {
          const result = reader.result as string
          resolve(result.split(',')[1] ?? '')
        }
        reader.onerror = reject
        reader.readAsDataURL(pdfBlob)
      })

      const res = await fetchApiWithAuth('/api/admin/daily-reports/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reportData: data,
          operatorId: operatorId,
          pdfBase64: base64,
        }),
      })

      const json = await res.json()
      if (!res.ok) throw new Error(json.error || '발송 실패')

      alert(json.message || (isKo ? '발송 완료' : 'Sent successfully'))
      void loadReport()
      onClose()
    } catch (e) {
      console.error('submit daily report', e)
      alert(isKo ? '일일 보고 발송에 실패했습니다.' : 'Failed to send daily report.')
    } finally {
      setSubmitting(false)
    }
  }

  const busy = loading || saving || submitting

  return (
    <Dialog open={open} onOpenChange={(next) => !next && !busy && onClose()}>
      <DialogContent
        className="flex max-h-[92vh] max-w-5xl flex-col gap-0 overflow-hidden p-0"
        hideCloseButton={busy}
      >
        <DialogHeader className="shrink-0 border-b border-border/60 px-6 py-4">
          <DialogTitle className="flex items-center gap-2 text-xl">
            <FileText className="h-5 w-5 text-primary" />
            {isKo ? 'Daily Report — 일일 업무 보고' : 'Daily Report'}
          </DialogTitle>

          <div className="mt-3 space-y-2">
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-[140px] flex-1 sm:flex-none">
                <Label htmlFor="daily-report-start-date" className="mb-1.5 block text-xs font-medium text-muted-foreground">
                  {isKo ? '시작일' : 'Start date'}
                </Label>
                <Input
                  id="daily-report-start-date"
                  type="date"
                  value={startDate}
                  onChange={(e) => handleStartDateChange(e.target.value)}
                  disabled={busy}
                  className="h-9 rounded-lg"
                />
              </div>
              <span className="hidden pb-2 text-muted-foreground sm:inline" aria-hidden>
                —
              </span>
              <div className="min-w-[140px] flex-1 sm:flex-none">
                <Label htmlFor="daily-report-end-date" className="mb-1.5 block text-xs font-medium text-muted-foreground">
                  {isKo ? '종료일' : 'End date'}
                </Label>
                <Input
                  id="daily-report-end-date"
                  type="date"
                  value={endDate}
                  onChange={(e) => handleEndDateChange(e.target.value)}
                  disabled={busy}
                  className="h-9 rounded-lg"
                />
              </div>

              <div className="flex flex-wrap gap-1.5 sm:ml-auto">
                {datePresets.map((preset) => (
                  <Button
                    key={preset}
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={busy}
                    onClick={() => applyDatePreset(preset)}
                    className="h-9 rounded-lg px-2.5 text-xs"
                  >
                    {isKo ? DAILY_REPORT_DATE_PRESET_LABELS[preset].ko : DAILY_REPORT_DATE_PRESET_LABELS[preset].en}
                  </Button>
                ))}
              </div>
            </div>

            {isRangeReport && (
              <p className="text-xs text-primary">
                {isKo
                  ? `${formatReportDateRangeLabel(startDate, endDate, locale)} 기간 통계를 표시합니다.`
                  : `Showing stats for ${formatReportDateRangeLabel(startDate, endDate, locale)}.`}
              </p>
            )}
          </div>

          <DialogDescription className="mt-2">
            {isKo
              ? isRangeReport
                ? '선택한 기간의 업무 통계를 확인하고, 메모를 추가한 뒤 SUPER 관리자에게 발송하세요.'
                : '하루 업무를 한눈에 확인하고, 메모를 추가한 뒤 SUPER 관리자에게 발송하세요.'
              : isRangeReport
                ? 'Review the selected period, add notes, and send to SUPER admins.'
                : 'Review today, add notes, and send to SUPER admins.'}
            {existing?.status === 'submitted' && (
              <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                <CheckCircle2 className="h-3 w-3" />
                {isKo ? '발송 완료' : 'Sent'}
                {existing.emailSentAt
                  ? ` · ${new Date(existing.emailSentAt).toLocaleString(isKo ? 'ko-KR' : 'en-US')}`
                  : ''}
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        {loading || !data ? (
          <div className="flex flex-1 items-center justify-center py-24">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="shrink-0 border-b border-border/40 px-6">
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => setActiveTab('preview')}
                  className={`border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                    activeTab === 'preview'
                      ? 'border-primary text-primary'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {isKo ? '미리보기' : 'Preview'}
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('edit')}
                  className={`border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                    activeTab === 'edit'
                      ? 'border-primary text-primary'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {isKo ? '메모 수정' : 'Edit Notes'}
                </button>
              </div>
            </div>

            {activeTab === 'preview' ? (
              <div className="min-h-0 flex-1 overflow-y-auto bg-muted/20 p-4 md:p-6">
                <div ref={previewRef} className="mx-auto max-w-3xl overflow-hidden rounded-2xl shadow-lg">
                  <DailyReportDocument data={data} locale={locale} />
                </div>
              </div>
            ) : (
              <div className="min-h-0 flex-1 overflow-y-auto p-6">
                <div className="mx-auto max-w-2xl space-y-5">
                  <NoteField
                    label={isKo ? '예약 관리 메모' : 'Reservation notes'}
                    value={data.reservationSummary.notes}
                    onChange={(v) => updateNotes('reservation', v)}
                    placeholder={isKo ? '예: OTA 마감 완료, 취소 2건 재예약 안내 완료' : 'Reservation notes...'}
                  />
                  <NoteField
                    label={isKo ? '투어 관리 메모' : 'Tour notes'}
                    value={data.tourSummary.notes}
                    onChange={(v) => updateNotes('tour', v)}
                    placeholder={isKo ? '예: 그랜드캐년 투어 지연 없이 완료' : 'Tour notes...'}
                  />
                  <NoteField
                    label={isKo ? 'TODO 메모' : 'TODO notes'}
                    value={data.todoSummary.notes}
                    onChange={(v) => updateNotes('todo', v)}
                    placeholder={isKo ? '예: 픽업 알림 전체 발송 완료' : 'TODO notes...'}
                  />
                  <NoteField
                    label={isKo ? '내일 스케줄 메모' : 'Tomorrow schedule notes'}
                    value={data.tomorrowSchedule.notes}
                    onChange={(v) => updateNotes('tomorrow', v)}
                    placeholder={isKo ? '예: 내일 앤텔로프 2건 가이드 추가 배정 필요' : 'Schedule notes...'}
                  />
                  <NoteField
                    label={isKo ? '종합 메모 (SUPER에게 전달)' : 'Overall notes'}
                    value={data.additionalNotes}
                    onChange={(v) => updateNotes('additional', v)}
                    placeholder={isKo ? '오늘 특이사항, 내일 주의사항 등' : 'Overall notes for SUPER...'}
                    rows={5}
                  />
                  <div className="rounded-xl border border-border/60 bg-muted/30 p-4">
                    <p className="mb-2 text-sm font-semibold text-muted-foreground">
                      {isKo ? '여행사 Daily Report 권장 항목' : 'Recommended daily report items'}
                    </p>
                    <ul className="list-inside list-disc space-y-1 text-xs text-muted-foreground">
                      {DAILY_REPORT_TRAVEL_AGENCY_RECOMMENDATIONS.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="shrink-0 gap-2 border-t border-border/60 px-6 py-4 sm:justify-between">
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => void loadReport()} disabled={busy}>
              <RefreshCw className="mr-1.5 h-4 w-4" />
              {isKo ? '새로고침' : 'Refresh'}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void handleDownloadPdf()}
              disabled={busy || !data}
            >
              <FileText className="mr-1.5 h-4 w-4" />
              PDF
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
              {isKo ? '닫기' : 'Close'}
            </Button>
            <Button type="button" variant="secondary" onClick={() => void handleSaveDraft()} disabled={busy || !data}>
              {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}
              {isKo ? '초안 저장' : 'Save Draft'}
            </Button>
            <Button type="button" onClick={() => void handleSubmit()} disabled={busy || !data}>
              {submitting ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Mail className="mr-1.5 h-4 w-4" />}
              {isKo ? 'SUPER에게 발송' : 'Send to SUPER'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function NoteField({
  label,
  value,
  onChange,
  placeholder,
  rows = 3,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  rows?: number
}) {
  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">{label}</Label>
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="resize-y rounded-xl"
      />
    </div>
  )
}
