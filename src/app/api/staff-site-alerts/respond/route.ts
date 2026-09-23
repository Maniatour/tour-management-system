import { NextRequest, NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getSupabaseForApiRoute } from '@/lib/api-route-supabase'
import { supabaseAdmin } from '@/lib/supabase'
import type { Database } from '@/lib/database.types'
import {
  buildStaffSiteAlertInteractionResults,
  isStaffSiteAlertSignatureDataUrl,
  parseStaffSiteAlertQuestionRows,
  staffSiteAlertHasInteraction,
  staffSiteAlertInteractionErrorMessage,
  validateStaffSiteAlertAnswers,
  type StaffSiteAlertAnswerInput,
  type StaffSiteAlertInteractionResultQuestion,
  type StaffSiteAlertQuestionRow,
} from '@/lib/staffSiteAlertInteraction'

type RespondBody = {
  recipientId?: string
  answers?: StaffSiteAlertAnswerInput[]
  signatureDataUrl?: string | null
  locale?: string
}

const QUESTION_SELECT =
  'id, alert_id, sort_order, prompt_ko, prompt_en, question_type, required, staff_site_alert_options(id, question_id, sort_order, label_ko, label_en)'

export async function POST(request: NextRequest) {
  const clientOrResponse = await getSupabaseForApiRoute(request)
  if (clientOrResponse instanceof NextResponse) return clientOrResponse

  const {
    data: { user },
    error: userError,
  } = await clientOrResponse.auth.getUser()
  if (userError || !user?.email) {
    return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
  }

  let body: RespondBody
  try {
    body = (await request.json()) as RespondBody
  } catch {
    return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 })
  }

  const recipientId = String(body.recipientId ?? '').trim()
  const locale = typeof body.locale === 'string' ? body.locale : 'ko'
  if (!/^[0-9a-f-]{36}$/i.test(recipientId)) {
    return NextResponse.json({ error: '알림을 찾을 수 없습니다.' }, { status: 400 })
  }

  const email = user.email.toLowerCase()
  const { data: recipient, error: recipientError } = await clientOrResponse
    .from('staff_site_alert_recipients')
    .select('id, alert_id, recipient_email, acknowledged_at')
    .eq('id', recipientId)
    .maybeSingle()

  if (recipientError || !recipient || recipient.recipient_email.toLowerCase() !== email) {
    return NextResponse.json({ error: '이 알림에 응답할 수 없습니다.' }, { status: 403 })
  }
  if (recipient.acknowledged_at) {
    return NextResponse.json({ error: '이미 확인한 알림입니다.' }, { status: 409 })
  }

  const { data: alert, error: alertError } = await clientOrResponse
    .from('staff_site_alerts')
    .select('id, requires_signature, interaction_kind, interaction_show_results')
    .eq('id', recipient.alert_id)
    .maybeSingle()

  if (alertError || !alert) {
    console.error('[staff-site-alerts/respond] alert', alertError)
    return NextResponse.json({ error: '알림을 불러오지 못했습니다.' }, { status: 500 })
  }

  const signature = String(body.signatureDataUrl ?? '').trim()
  if (alert.requires_signature && !isStaffSiteAlertSignatureDataUrl(signature)) {
    return NextResponse.json({ error: '서명을 그려 주세요.' }, { status: 400 })
  }

  let questions: StaffSiteAlertQuestionRow[] = []
  if (staffSiteAlertHasInteraction(alert.interaction_kind)) {
    const loaded = await loadQuestions(clientOrResponse, alert.id)
    if (!loaded.ok) {
      return NextResponse.json({ error: loaded.error }, { status: 500 })
    }
    questions = loaded.questions
    if (questions.length === 0) {
      return NextResponse.json({ error: '투표·설문 문항을 불러오지 못했습니다.' }, { status: 500 })
    }
    const answers = Array.isArray(body.answers) ? body.answers : []
    const validated = validateStaffSiteAlertAnswers(questions, answers)
    if (!validated.ok) {
      return NextResponse.json(
        { error: staffSiteAlertInteractionErrorMessage(validated.error, locale) },
        { status: 400 }
      )
    }

    const { error: deleteError } = await clientOrResponse
      .from('staff_site_alert_responses')
      .delete()
      .eq('recipient_id', recipient.id)
      .eq('alert_id', alert.id)
    if (deleteError) {
      console.error('[staff-site-alerts/respond] delete', deleteError)
      return NextResponse.json({ error: '이전 응답을 정리하지 못했습니다.' }, { status: 500 })
    }

    if (validated.rows.length > 0) {
      const { error: insertError } = await clientOrResponse.from('staff_site_alert_responses').insert(
        validated.rows.map((row) => ({
          alert_id: alert.id,
          question_id: row.question_id,
          recipient_id: recipient.id,
          option_ids: row.option_ids,
          text_answer: row.text_answer,
        }))
      )
      if (insertError) {
        console.error('[staff-site-alerts/respond] insert', insertError)
        return NextResponse.json({ error: '응답 저장에 실패했습니다.' }, { status: 500 })
      }
    }
  }

  const now = new Date().toISOString()
  const { data: updated, error: ackError } = await clientOrResponse
    .from('staff_site_alert_recipients')
    .update({
      acknowledged_at: now,
      ...(alert.requires_signature ? { signature_text: signature, signed_at: now } : {}),
    })
    .eq('id', recipient.id)
    .is('acknowledged_at', null)
    .select('id')

  if (ackError || !updated?.length) {
    console.error('[staff-site-alerts/respond] ack', ackError)
    return NextResponse.json({ error: '확인 처리에 실패했습니다.' }, { status: 500 })
  }

  const showResults = Boolean(alert.interaction_show_results) && questions.length > 0
  const results = showResults ? await loadPublicResults(alert.id, questions, locale) : null

  return NextResponse.json({
    ok: true,
    showResults,
    kind: alert.interaction_kind,
    results,
  })
}

async function loadQuestions(
  client: SupabaseClient<Database>,
  alertId: string
): Promise<{ ok: true; questions: StaffSiteAlertQuestionRow[] } | { ok: false; error: string }> {
  const { data, error } = await client
    .from('staff_site_alert_questions')
    .select(QUESTION_SELECT)
    .eq('alert_id', alertId)
    .order('sort_order', { ascending: true })

  if (error) {
    console.error('[staff-site-alerts/respond] questions', error)
    return { ok: false, error: '투표·설문 문항을 불러오지 못했습니다.' }
  }
  return { ok: true, questions: parseStaffSiteAlertQuestionRows(data) }
}

async function loadPublicResults(
  alertId: string,
  questions: StaffSiteAlertQuestionRow[],
  locale: string
): Promise<StaffSiteAlertInteractionResultQuestion[] | null> {
  if (!supabaseAdmin) return null
  const { data, error } = await supabaseAdmin
    .from('staff_site_alert_responses')
    .select('question_id, option_ids, text_answer')
    .eq('alert_id', alertId)

  if (error) {
    console.error('[staff-site-alerts/respond] tally', error)
    return null
  }

  return buildStaffSiteAlertInteractionResults({
    questions,
    responses: data ?? [],
    locale,
    includeVoters: false,
    includeTextAnswers: false,
  })
}
