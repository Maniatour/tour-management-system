import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase-server'
import { canManageCompanySop, normalizeEmail } from '@/lib/sopPermissions'

export const runtime = 'nodejs'

const MAX_BYTES = 15 * 1024 * 1024

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization')
    const bearer = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : ''

    const supabase = await createServerSupabase()
    let {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (!user && bearer) {
      const jwtResult = await supabase.auth.getUser(bearer)
      user = jwtResult.data.user
      authError = jwtResult.error
    }

    if (authError || !user?.email) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
    }

    const email = normalizeEmail(user.email)
    const { data: teamRow, error: teamErr } = await supabase
      .from('team')
      .select('position, is_active, email')
      .eq('email', email)
      .maybeSingle()

    if (teamErr) {
      console.error('extract-document-text team:', teamErr)
      return NextResponse.json({ error: '권한 확인에 실패했습니다.' }, { status: 500 })
    }

    if (!canManageCompanySop(user.email, teamRow)) {
      return NextResponse.json({ error: '문서 가져오기 권한이 없습니다.' }, { status: 403 })
    }

    const form = await request.formData()
    const file = form.get('file')
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: 'file 필수' }, { status: 400 })
    }

    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: '파일은 15MB 이하여야 합니다.' }, { status: 400 })
    }

    const buf = Buffer.from(await file.arrayBuffer())
    const name = file.name.toLowerCase()
    const isPdf = file.type === 'application/pdf' || name.endsWith('.pdf')
    const isDocx =
      name.endsWith('.docx') ||
      file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    const isTxt = name.endsWith('.txt') || name.endsWith('.md') || file.type.startsWith('text/')

    if (isPdf) {
      const pdfMod = await import('pdf-parse')
      const pdfParse = (pdfMod as { default?: (b: Buffer) => Promise<{ text: string }> }).default
      if (typeof pdfParse !== 'function') {
        return NextResponse.json({ error: 'PDF 파서 로드 실패' }, { status: 500 })
      }
      const data = await pdfParse(buf)
      return NextResponse.json({
        kind: 'pdf' as const,
        fileName: file.name,
        text: (data?.text ?? '').trim(),
      })
    }

    if (isDocx) {
      const mammoth = await import('mammoth')
      const result = await mammoth.extractRawText({ buffer: buf })
      return NextResponse.json({
        kind: 'docx' as const,
        fileName: file.name,
        text: (result.value ?? '').trim(),
      })
    }

    if (name.endsWith('.doc')) {
      return NextResponse.json(
        { error: '구형 .doc 은 지원하지 않습니다. .docx 또는 PDF로 저장해 주세요.' },
        { status: 400 }
      )
    }

    if (isTxt) {
      let text = buf.toString('utf-8')
      if (text.charCodeAt(0) === 0xfeff) text = text.slice(1)
      return NextResponse.json({
        kind: 'text' as const,
        fileName: file.name,
        text: text.trim(),
      })
    }

    return NextResponse.json(
      { error: '지원 형식: PDF, DOCX, TXT, MD' },
      { status: 400 }
    )
  } catch (e) {
    console.error('extract-document-text', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : '파일 처리 실패' },
      { status: 500 }
    )
  }
}
