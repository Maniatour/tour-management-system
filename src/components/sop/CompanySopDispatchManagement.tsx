'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

type RecipientRow = { recipient_email: string; status: string }

type DocKind = 'sop' | 'employee_contract'

type CampaignRow = {
  id: string
  doc_kind: DocKind
  title: string
  note: string
  created_at: string
  closed_at: string | null
  company_structured_doc_sign_campaign_recipients: RecipientRow[] | null
}

export default function CompanySopDispatchManagement({ uiLocaleEn }: { uiLocaleEn: boolean }) {
  const [rows, setRows] = useState<CampaignRow[]>([])
  const [loading, setLoading] = useState(true)
  const [cancelTargetRow, setCancelTargetRow] = useState<CampaignRow | null>(null)
  const [cancelBusy, setCancelBusy] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setErrorMsg(null)
    try {
      const { data, error } = await supabase
        .from('company_structured_doc_sign_campaigns')
        .select(
          `
          id,
          doc_kind,
          title,
          note,
          created_at,
          closed_at,
          company_structured_doc_sign_campaign_recipients (
            recipient_email,
            status
          )
        `
        )
        .in('doc_kind', ['sop', 'employee_contract'])
        .order('created_at', { ascending: false })
        .limit(100)

      if (error) throw error
      setRows((data || []) as CampaignRow[])
    } catch (e) {
      console.warn('structured doc dispatch list:', e)
      setErrorMsg(
        uiLocaleEn ? 'Could not load dispatch list.' : '발송 목록을 불러오지 못했습니다.'
      )
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [uiLocaleEn])

  useEffect(() => {
    void load()
  }, [load])

  const confirmCancel = async () => {
    if (!cancelTargetRow) return
    setCancelBusy(true)
    setErrorMsg(null)
    try {
      const { error } = await supabase
        .from('company_structured_doc_sign_campaigns')
        .update({ closed_at: new Date().toISOString() })
        .eq('id', cancelTargetRow.id)
        .eq('doc_kind', cancelTargetRow.doc_kind)
        .is('closed_at', null)

      if (error) throw error
      setCancelTargetRow(null)
      await load()
    } catch (e) {
      console.warn('cancel campaign:', e)
      setErrorMsg(
        uiLocaleEn ? 'Could not cancel this dispatch.' : '발송을 취소하지 못했습니다.'
      )
    } finally {
      setCancelBusy(false)
    }
  }

  const docKindLabel = (k: DocKind) =>
    k === 'sop' ? 'SOP' : uiLocaleEn ? 'Employment contract' : '직원 계약서'

  return (
    <div className="p-4" role="tabpanel">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-gray-900">
            {uiLocaleEn ? 'Dispatch management' : '발송 관리'}
          </h2>
          <p className="mt-1 text-sm text-gray-600">
            {uiLocaleEn
              ? 'Cancel a dispatch to stop the login reminder modal for recipients who have not signed yet. Completed PDFs stay stored.'
              : '발송을 취소하면 미서명 수신인에게 더 이상 「관리자 발송: 문서 확인·서명이 필요합니다」 알림이 뜨지 않습니다. 이미 제출한 서명 PDF는 그대로 보관됩니다.'}
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" disabled={loading} onClick={() => void load()}>
          {loading ? (uiLocaleEn ? 'Loading…' : '불러오는 중…') : uiLocaleEn ? 'Refresh' : '새로고침'}
        </Button>
      </div>

      {errorMsg ? <p className="mb-3 text-sm text-red-600">{errorMsg}</p> : null}

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-left">
            <tr>
              <th className="px-3 py-2 whitespace-nowrap">{uiLocaleEn ? 'Document' : '문서'}</th>
              <th className="px-3 py-2">{uiLocaleEn ? 'Title / note' : '제목·메모'}</th>
              <th className="px-3 py-2">{uiLocaleEn ? 'Sent at' : '발송 시각'}</th>
              <th className="px-3 py-2">{uiLocaleEn ? 'Recipients' : '수신'}</th>
              <th className="px-3 py-2">{uiLocaleEn ? 'Status' : '상태'}</th>
              <th className="px-3 py-2 w-28 text-right">{uiLocaleEn ? 'Action' : '작업'}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-gray-500">
                  {uiLocaleEn ? 'Loading…' : '불러오는 중…'}
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-gray-500">
                  {uiLocaleEn
                    ? 'No dispatches yet (SOP or employment contract).'
                    : 'SOP·직원 계약서 서명 요청 발송 내역이 없습니다.'}
                </td>
              </tr>
            ) : (
              rows.map((r) => {
                const rec = r.company_structured_doc_sign_campaign_recipients || []
                const total = rec.length
                const signed = rec.filter((x) => x.status === 'signed').length
                const pending = total - signed
                const closed = Boolean(r.closed_at)
                const statusLabel = closed
                  ? uiLocaleEn
                    ? 'Cancelled'
                    : '취소됨'
                  : pending === 0
                    ? uiLocaleEn
                      ? 'All signed'
                      : '전원 서명'
                    : uiLocaleEn
                      ? 'Open'
                      : '진행 중'

                return (
                  <tr key={r.id} className="border-t border-gray-100">
                    <td className="px-3 py-2 align-top text-gray-800 whitespace-nowrap">
                      {docKindLabel(r.doc_kind)}
                    </td>
                    <td className="px-3 py-2 align-top">
                      <div className="font-medium text-gray-900">{r.title || '—'}</div>
                      {r.note ? <div className="mt-0.5 text-xs text-gray-500">{r.note}</div> : null}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-gray-600 align-top">
                      {new Date(r.created_at).toLocaleString(uiLocaleEn ? 'en-US' : 'ko-KR')}
                    </td>
                    <td className="px-3 py-2 align-top text-gray-700">
                      {total === 0
                        ? '—'
                        : uiLocaleEn
                          ? `${signed}/${total} signed`
                          : `서명 ${signed}/${total} · 미서명 ${pending}`}
                    </td>
                    <td className="px-3 py-2 align-top">
                      <span
                        className={
                          closed
                            ? 'text-gray-600'
                            : pending === 0
                              ? 'text-green-700'
                              : 'text-amber-700'
                        }
                      >
                        {statusLabel}
                      </span>
                      {closed && r.closed_at ? (
                        <div className="text-xs text-gray-500">
                          {uiLocaleEn ? 'At ' : '취소: '}
                          {new Date(r.closed_at).toLocaleString(uiLocaleEn ? 'en-US' : 'ko-KR')}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 text-right align-top">
                      {!closed ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="text-red-700 border-red-200 hover:bg-red-50"
                          onClick={() => setCancelTargetRow(r)}
                        >
                          {uiLocaleEn ? 'Cancel dispatch' : '발송 취소'}
                        </Button>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-xs text-gray-500">
        {uiLocaleEn
          ? 'To send a new request, use the paper-plane button on a version row in Edit SOP or Employment contract.'
          : '새 발송은 「SOP 수정」 또는 「직원 계약서」 탭의 버전 목록에서 발송(종이비행기) 버튼으로 할 수 있습니다.'}
      </p>

      <AlertDialog
        open={Boolean(cancelTargetRow)}
        onOpenChange={(o) => !o && !cancelBusy && setCancelTargetRow(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {uiLocaleEn ? 'Cancel this dispatch?' : '이 발송을 취소할까요?'}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-left space-y-2">
              <span className="block">
                {uiLocaleEn
                  ? 'Recipients who have not signed will no longer see the manager sign-request modal when they log in.'
                  : '아직 서명하지 않은 수신인은 접속 시 관리자 발송 안내 모달이 더 이상 표시되지 않습니다.'}
              </span>
              {cancelTargetRow ? (
                <span className="block font-medium text-gray-900">
                  [{docKindLabel(cancelTargetRow.doc_kind)}] {cancelTargetRow.title || '—'}
                </span>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelBusy}>{uiLocaleEn ? 'Back' : '돌아가기'}</AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              disabled={cancelBusy}
              onClick={() => void confirmCancel()}
            >
              {cancelBusy ? (uiLocaleEn ? 'Working…' : '처리 중…') : uiLocaleEn ? 'Cancel dispatch' : '발송 취소'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
