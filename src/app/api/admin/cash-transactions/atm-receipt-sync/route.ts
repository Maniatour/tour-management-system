import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getSupabaseForApiRoute } from '@/lib/api-route-supabase'
import { listAtmReceiptImports } from '@/lib/listCashAtmReceipts'
import { importAtmReceiptsFromGmail } from '@/lib/importGmailAtmReceipts'

export const maxDuration = 60

export async function GET(request: NextRequest) {
  const auth = await getSupabaseForApiRoute(request)
  if (auth instanceof NextResponse) return auth
  const {
    data: { user },
  } = await auth.auth.getUser()
  if (!user) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })

  const dateYmd = request.nextUrl.searchParams.get('date')?.trim() || ''
  const linkedImportId = request.nextUrl.searchParams.get('linked')?.trim() || ''
  const client = supabaseAdmin ?? auth
  try {
    let gmailError: string | undefined
    let imported = 0
    let searched = 0
    if (dateYmd) {
      const gmail = await importAtmReceiptsFromGmail(client, dateYmd)
      gmailError = gmail.error
      imported = gmail.imported
      searched = gmail.searched
    }
    const items = await listAtmReceiptImports(client, { dateYmd, linkedImportId })
    return NextResponse.json({
      items,
      gmailError: gmailError ?? null,
      imported,
      searched,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error('[atm-receipt] GET', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const auth = await getSupabaseForApiRoute(request)
  if (auth instanceof NextResponse) return auth
  const {
    data: { user },
  } = await auth.auth.getUser()
  if (!user?.email) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })

  const body = (await request.json().catch(() => ({}))) as {
    action?: string
    importId?: string
    cashTransactionId?: string
  }
  const client = supabaseAdmin ?? auth
  const cashTransactionId = String(body.cashTransactionId ?? '').trim()
  if (!cashTransactionId) {
    return NextResponse.json({ error: '현금 거래가 필요합니다.' }, { status: 400 })
  }

  const { linkAtmReceiptToCashTransaction, unlinkAtmReceiptFromCashTransaction } = await import(
    '@/lib/linkCashAtmReceipt'
  )

  if (body.action === 'unlink') {
    const r = await unlinkAtmReceiptFromCashTransaction(client, cashTransactionId)
    if (r.error) return NextResponse.json({ error: r.error }, { status: 400 })
    return NextResponse.json({ action: 'unlink', ok: true })
  }

  const importId = String(body.importId ?? '').trim()
  if (body.action !== 'link' || !importId) {
    return NextResponse.json({ error: '연결할 ATM 메일이 없습니다.' }, { status: 400 })
  }
  const r = await linkAtmReceiptToCashTransaction(client, {
    importId,
    cashTransactionId,
    actorEmail: user.email,
  })
  if (r.error) return NextResponse.json({ error: r.error, statementLinked: false }, { status: 400 })
  return NextResponse.json({ action: 'link', ok: true, statementLinked: r.statementLinked })
}
