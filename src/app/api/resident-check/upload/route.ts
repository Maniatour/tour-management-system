import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import {
  getTokenBundleByRawToken,
  tokenIsExpired,
} from '@/lib/residentCheckTokenService'

/**
 * POST /api/resident-check/upload (multipart: token, kind=pass|id, file)
 */
export async function POST(request: NextRequest) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: 'Server is not configured for this feature.' },
        { status: 503 }
      )
    }

    const formData = await request.formData()
    const rawToken = String(formData.get('token') || '')
    const kind = String(formData.get('kind') || '')
    const file = formData.get('file') as File | null

    if (!rawToken || !file) {
      return NextResponse.json({ error: 'Missing token or file.' }, { status: 400 })
    }
    if (kind !== 'pass' && kind !== 'id') {
      return NextResponse.json({ error: 'Invalid kind.' }, { status: 400 })
    }

    const bundle = await getTokenBundleByRawToken(rawToken)
    if (!bundle) {
      return NextResponse.json({ error: 'Invalid or unknown link.' }, { status: 404 })
    }
    const { token, submission } = bundle
    if (token.completed_at) {
      return NextResponse.json({ error: 'This link has already been completed.' }, { status: 400 })
    }
    if (tokenIsExpired(token)) {
      return NextResponse.json({ error: 'This link has expired.' }, { status: 400 })
    }
    if (!submission) {
      return NextResponse.json(
        { error: 'Please save the questionnaire first, then upload photos.' },
        { status: 400 }
      )
    }

    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: 'Invalid file type.' }, { status: 400 })
    }
    const maxSize = 5 * 1024 * 1024
    if (file.size > maxSize) {
      return NextResponse.json({ error: 'File too large (max 5MB).' }, { status: 400 })
    }

    const timestamp = Date.now()
    const randomString = Math.random().toString(36).substring(2, 15)
    const fileExtension = file.name.split('.').pop() || 'jpg'
    const fileName = `resident_check_${token.id}_${kind}_${timestamp}_${randomString}.${fileExtension}`

    const { data, error } = await supabaseAdmin.storage
      .from('images')
      .upload(`resident-check/${fileName}`, file, {
        cacheControl: '3600',
        upsert: false,
      })

    if (error) {
      console.error('resident-check/upload storage', error)
      return NextResponse.json({ error: 'Upload failed.' }, { status: 500 })
    }

    const {
      data: { publicUrl },
    } = supabaseAdmin.storage.from('images').getPublicUrl(data.path)

    const patch =
      kind === 'pass'
        ? { pass_photo_url: publicUrl, updated_at: new Date().toISOString() }
        : { id_proof_url: publicUrl, updated_at: new Date().toISOString() }

    const { error: upErr } = await supabaseAdmin
      .from('resident_check_submissions')
      .update(patch)
      .eq('token_id', token.id)

    if (upErr) {
      console.error('resident-check/upload db', upErr)
      return NextResponse.json({ error: 'Failed to attach file.' }, { status: 500 })
    }

    return NextResponse.json({ ok: true, imageUrl: publicUrl, path: data.path })
  } catch (e) {
    console.error('resident-check/upload', e)
    return NextResponse.json({ error: 'Unexpected error.' }, { status: 500 })
  }
}
