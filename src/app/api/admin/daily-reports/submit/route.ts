import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import type { Database } from '@/lib/database.types'
import { requireStaffApiAuth } from '@/lib/api-security'
import { resolveOperatorId } from '@/lib/operators/scopeQuery'
import { fetchSuperAdminRecipients } from '@/lib/dailyReport/superRecipients'
import {
  dailyReportEmailSubject,
  renderDailyReportEmailHtml,
} from '@/lib/dailyReport/renderDailyReportHtml'
import type { DailyReportData } from '@/lib/dailyReport/types'
import { fromUntypedTable } from '@/lib/supabaseUntypedTable'

export const dynamic = 'force-dynamic'

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('SUPABASE_SERVICE_ROLE_KEY가 설정되지 않았습니다.')
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

/** POST — PDF 저장 + SUPER 이메일 발송 */
export async function POST(request: NextRequest) {
  const auth = await requireStaffApiAuth(request)
  if (!auth.ok) return auth.response

  try {
    const body = await request.json()
    const reportData = body.reportData as DailyReportData | undefined
    const pdfBase64 = typeof body.pdfBase64 === 'string' ? body.pdfBase64 : ''

    if (!reportData?.reportDate) {
      return NextResponse.json({ error: 'reportData가 필요합니다.' }, { status: 400 })
    }
    if (!pdfBase64) {
      return NextResponse.json({ error: 'PDF 데이터가 필요합니다.' }, { status: 400 })
    }

    const operatorId = resolveOperatorId(body.operatorId ?? reportData.operatorId)
    const serviceClient = getServiceClient()

    const { data: teamRow } = await auth.staffClient
      .from('team')
      .select('name_ko, nick_name, display_name, email')
      .eq('email', auth.userEmail)
      .maybeSingle()

    const submitterName =
      teamRow?.nick_name?.trim() || teamRow?.name_ko?.trim() || teamRow?.display_name?.trim() || null
    const enrichedData: DailyReportData = {
      ...reportData,
      operatorId,
      submittedByName: submitterName,
      submittedByEmail: auth.userEmail,
      generatedAt: reportData.generatedAt || new Date().toISOString(),
    }

    const pdfBuffer = Buffer.from(pdfBase64.replace(/^data:application\/pdf;base64,/, ''), 'base64')
    const storagePath = `${operatorId}/${reportData.reportDate}/daily-report-${Date.now()}.pdf`

    const { error: uploadError } = await serviceClient.storage
      .from('office-daily-reports')
      .upload(storagePath, pdfBuffer, {
        contentType: 'application/pdf',
        upsert: true,
      })

    if (uploadError) {
      console.error('daily-report PDF upload error:', uploadError)
      return NextResponse.json({ error: 'PDF 저장에 실패했습니다.' }, { status: 500 })
    }

    const { data: signedUrlData } = await serviceClient.storage
      .from('office-daily-reports')
      .createSignedUrl(storagePath, 60 * 60 * 24 * 365)

    const pdfUrl = signedUrlData?.signedUrl ?? null
    const now = new Date().toISOString()

    const recipients = await fetchSuperAdminRecipients(auth.staffClient)
    if (!recipients.length) {
      return NextResponse.json({ error: 'SUPER 관리자 이메일을 찾을 수 없습니다.' }, { status: 404 })
    }

    const resendApiKey = process.env.RESEND_API_KEY
    if (!resendApiKey) {
      return NextResponse.json({ error: '이메일 서비스 설정 오류입니다.' }, { status: 500 })
    }

    const resend = new Resend(resendApiKey)
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'info@maniatour.com'
    const replyTo = process.env.RESEND_REPLY_TO || 'info@maniatour.com'
    const html = renderDailyReportEmailHtml(enrichedData, 'ko')
    const subject = dailyReportEmailSubject(enrichedData)
    const recipientEmails = recipients.map((r) => r.email)

    const emailResults = await Promise.allSettled(
      recipientEmails.map((to) =>
        resend.emails.send({
          from: fromEmail,
          replyTo,
          to,
          subject,
          html,
          attachments: [
            {
              filename: `daily-report-${reportData.reportDate}.pdf`,
              content: pdfBuffer,
            },
          ],
        })
      )
    )

    const emailSuccess = emailResults.filter((r) => r.status === 'fulfilled').length
    const emailFailed = emailResults.filter((r) => r.status === 'rejected').length

    const { data: saved, error: saveError } = await fromUntypedTable(
      auth.staffClient,
      'office_daily_reports'
    )
      .upsert(
        {
          report_date: reportData.reportDate,
          operator_id: operatorId,
          submitted_by: auth.userId,
          submitted_by_email: auth.userEmail,
          submitted_by_name: submitterName,
          submitted_at: now,
          status: 'submitted',
          report_data: enrichedData,
          editor_notes: enrichedData.additionalNotes || null,
          pdf_storage_path: storagePath,
          pdf_url: pdfUrl,
          email_sent_at: emailSuccess > 0 ? now : null,
          email_sent_to: emailSuccess > 0 ? recipientEmails : null,
        },
        { onConflict: 'report_date,operator_id' }
      )
      .select('id, pdf_url, email_sent_at')
      .single()

    if (saveError) {
      console.error('daily-report save error:', saveError)
      return NextResponse.json({ error: '보고서 저장에 실패했습니다.' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      id: saved.id as string,
      pdfUrl: saved.pdf_url as string | null,
      emailSentAt: saved.email_sent_at as string | null,
      emailSuccess,
      emailFailed,
      sentTo: recipientEmails,
      message:
        emailFailed > 0
          ? `보고서가 저장되었습니다. 이메일 ${emailSuccess}건 성공, ${emailFailed}건 실패.`
          : `SUPER 관리자 ${emailSuccess}명에게 일일 보고가 발송되었습니다.`,
    })
  } catch (error) {
    console.error('daily-report submit error:', error)
    return NextResponse.json({ error: '일일 보고 발송 중 오류가 발생했습니다.' }, { status: 500 })
  }
}
