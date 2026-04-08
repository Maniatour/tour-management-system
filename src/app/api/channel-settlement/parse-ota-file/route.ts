import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase-server'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization')
    const bearer =
      authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : ''

    const supabaseCookie = await createServerSupabase()
    let {
      data: { user },
      error: authError,
    } = await supabaseCookie.auth.getUser()

    /** 이 앱은 클라이언트 세션을 localStorage에 두는 경우가 많아, 쿠키만으로는 user가 없을 수 있음 */
    if (!user && bearer) {
      const jwtResult = await supabaseCookie.auth.getUser(bearer)
      user = jwtResult.data.user
      authError = jwtResult.error
    }

    if (authError || !user) {
      return NextResponse.json(
        { error: '로그인이 필요합니다.' },
        { status: 401 }
      )
    }

    const form = await request.formData()
    const file = form.get('file')
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: 'file 필수' }, { status: 400 })
    }

    const buf = Buffer.from(await file.arrayBuffer())
    const name = file.name.toLowerCase()
    const isPdf = file.type === 'application/pdf' || name.endsWith('.pdf')
    const isXlsx =
      name.endsWith('.xlsx') ||
      name.endsWith('.xlsm') ||
      name.endsWith('.xls') ||
      file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      file.type === 'application/vnd.ms-excel' ||
      file.type === 'application/vnd.ms-excel.sheet.macroEnabled.12'

    if (isPdf) {
      const pdfMod = await import('pdf-parse')
      const pdfParse = (pdfMod as { default?: (b: Buffer) => Promise<{ text: string }> }).default
      if (typeof pdfParse !== 'function') {
        return NextResponse.json({ error: 'PDF 파서 로드 실패' }, { status: 500 })
      }
      const data = await pdfParse(buf)
      return NextResponse.json({ kind: 'pdf' as const, text: data?.text ?? '' })
    }

    if (isXlsx) {
      const XLSX = await import('xlsx')
      const workbook = XLSX.read(buf, { type: 'buffer' })
      const sheetName = workbook.SheetNames[0]
      if (!sheetName) {
        return NextResponse.json({ error: '워크북에 시트가 없습니다.' }, { status: 400 })
      }
      const sheet = workbook.Sheets[sheetName]
      const text = XLSX.utils.sheet_to_csv(sheet, { FS: ',', blankrows: false })
      return NextResponse.json({
        kind: 'xlsx' as const,
        text,
        sheetName,
      })
    }

    let text = buf.toString('utf-8')
    if (text.length > 0 && text.charCodeAt(0) === 0xfeff) {
      text = text.slice(1)
    }
    return NextResponse.json({ kind: 'csv' as const, text })
  } catch (e) {
    console.error('parse-ota-file', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : '파일 처리 실패' },
      { status: 500 }
    )
  }
}
