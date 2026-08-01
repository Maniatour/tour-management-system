import { NextRequest, NextResponse } from 'next/server'
import twilio from 'twilio'
import { updateSmsLogFromTwilioWebhook } from '@/lib/smsLogDeliverySync'

function parseTwilioFormBody(rawBody: string): Record<string, string> {
  const params = new URLSearchParams(rawBody)
  const result: Record<string, string> = {}
  for (const [key, value] of params.entries()) {
    result[key] = value
  }
  return result
}

function verifyTwilioWebhook(
  request: NextRequest,
  params: Record<string, string>
): boolean {
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim()
  if (!authToken) return false

  const signature = request.headers.get('x-twilio-signature')
  if (!signature) return false

  const url = request.nextUrl.origin + request.nextUrl.pathname
  return twilio.validateRequest(authToken, signature, url, params)
}

/**
 * POST /api/webhooks/twilio/sms-status
 * Twilio SMS 배달 상태 콜백
 */
export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text()
    const params = parseTwilioFormBody(rawBody)
    const authToken = process.env.TWILIO_AUTH_TOKEN?.trim()

    if (process.env.NODE_ENV === 'production') {
      if (!authToken) {
        console.error('[webhook/twilio/sms-status] TWILIO_AUTH_TOKEN is not configured')
        return NextResponse.json({ error: 'Service unavailable' }, { status: 503 })
      }
      if (!verifyTwilioWebhook(request, params)) {
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
      }
    } else if (authToken && !verifyTwilioWebhook(request, params)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    const messageSid = params.MessageSid?.trim() ?? ''
    const messageStatus = params.MessageStatus?.trim() ?? ''
    const errorCode = params.ErrorCode?.trim() ?? null

    console.log('[webhook/twilio/sms-status] event:', {
      messageSid,
      messageStatus,
      errorCode,
    })

    if (!messageSid || !messageStatus) {
      return NextResponse.json({ error: 'MessageSid and MessageStatus are required' }, { status: 400 })
    }

    await updateSmsLogFromTwilioWebhook({
      messageSid,
      messageStatus,
      errorCode,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[webhook/twilio/sms-status] error:', error)
    return NextResponse.json(
      {
        error: 'Webhook processing failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Twilio SMS Status Callback Endpoint',
    status: 'active',
    supported_statuses: ['queued', 'sending', 'sent', 'delivered', 'undelivered', 'failed'],
  })
}
