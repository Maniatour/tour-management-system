import { NextRequest, NextResponse } from 'next/server'
import { requireStaffApiAuth } from '@/lib/api-security'
import { resolveOperatorId } from '@/lib/operators/scopeQuery'
import { generateDailyReportData } from '@/lib/dailyReport/generateDailyReportData'
import { todayInLasVegas } from '@/lib/dailyReport/dateUtils'
import type { DailyReportData, OfficeDailyReportRow } from '@/lib/dailyReport/types'
import { fromUntypedTable } from '@/lib/supabaseUntypedTable'

export const dynamic = 'force-dynamic'

async function getSubmitterInfo(
  client: Parameters<typeof generateDailyReportData>[0],
  userEmail: string
): Promise<{ name: string | null; email: string }> {
  const { data } = await client
    .from('team')
    .select('name_ko, nick_name, display_name, email')
    .eq('email', userEmail)
    .maybeSingle()

  const name =
    data?.nick_name?.trim() || data?.name_ko?.trim() || data?.display_name?.trim() || null
  return { name, email: userEmail }
}

function mergeSavedNotes(
  fresh: DailyReportData,
  saved: DailyReportData | null | undefined
): DailyReportData {
  if (!saved) return fresh
  return {
    ...fresh,
    reservationSummary: { ...fresh.reservationSummary, notes: saved.reservationSummary?.notes ?? '' },
    tourSummary: { ...fresh.tourSummary, notes: saved.tourSummary?.notes ?? '' },
    todoSummary: { ...fresh.todoSummary, notes: saved.todoSummary?.notes ?? '' },
    tomorrowSchedule: { ...fresh.tomorrowSchedule, notes: saved.tomorrowSchedule?.notes ?? '' },
    additionalNotes: saved.additionalNotes ?? '',
  }
}

/** GET — 일일 보고 미리보기 데이터 (자동 집계 + 저장된 초안 병합) */
export async function GET(request: NextRequest) {
  const auth = await requireStaffApiAuth(request)
  if (!auth.ok) return auth.response

  const { searchParams } = new URL(request.url)
  const reportDate = searchParams.get('date')?.trim() || todayInLasVegas()
  const operatorId = resolveOperatorId(searchParams.get('operatorId'))

  const submitter = await getSubmitterInfo(auth.staffClient, auth.userEmail)

  const { data: existing } = await fromUntypedTable(auth.staffClient, 'office_daily_reports')
    .select('*')
    .eq('report_date', reportDate)
    .eq('operator_id', operatorId)
    .maybeSingle()

  const existingRow = existing as OfficeDailyReportRow | null
  const savedData = existingRow?.report_data as DailyReportData | undefined

  const preserveNotes = savedData
    ? {
        reservationNotes: savedData.reservationSummary?.notes,
        tourNotes: savedData.tourSummary?.notes,
        todoNotes: savedData.todoSummary?.notes,
        tomorrowNotes: savedData.tomorrowSchedule?.notes,
        additionalNotes: savedData.additionalNotes,
      }
    : undefined

  const fresh = await generateDailyReportData(auth.staffClient, operatorId, reportDate, {
    submittedByName: submitter.name,
    submittedByEmail: submitter.email,
    ...(preserveNotes ? { preserveNotes } : {}),
  })

  const data = mergeSavedNotes(fresh, savedData)

  return NextResponse.json({
    data,
    existing: existingRow
      ? {
          id: existingRow.id,
          status: existingRow.status,
          submittedAt: existingRow.submitted_at,
          pdfUrl: existingRow.pdf_url,
          emailSentAt: existingRow.email_sent_at,
        }
      : null,
  })
}

/** POST — 초안 저장 */
export async function POST(request: NextRequest) {
  const auth = await requireStaffApiAuth(request)
  if (!auth.ok) return auth.response

  const body = await request.json()
  const reportData = body.reportData as DailyReportData | undefined
  if (!reportData?.reportDate) {
    return NextResponse.json({ error: 'reportData가 필요합니다.' }, { status: 400 })
  }

  const operatorId = resolveOperatorId(body.operatorId ?? reportData.operatorId)
  const submitter = await getSubmitterInfo(auth.staffClient, auth.userEmail)

  const payload = {
    report_date: reportData.reportDate,
    operator_id: operatorId,
    submitted_by: auth.userId,
    submitted_by_email: submitter.email,
    submitted_by_name: submitter.name,
    status: 'draft' as const,
    report_data: { ...reportData, operatorId, submittedByName: submitter.name, submittedByEmail: submitter.email },
    editor_notes: reportData.additionalNotes || null,
  }

  const { data, error } = await fromUntypedTable(auth.staffClient, 'office_daily_reports')
    .upsert(payload, { onConflict: 'report_date,operator_id' })
    .select('id, status, updated_at')
    .single()

  if (error) {
    console.error('daily-reports draft save error:', error)
    return NextResponse.json({ error: '초안 저장에 실패했습니다.' }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    id: data.id as string,
    status: data.status as string,
    updatedAt: data.updated_at as string,
  })
}
