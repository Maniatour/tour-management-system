import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import {
  MAX_PROOF_FILES,
  parseResidentCheckProofUrls,
  serializeResidentCheckProofUrls,
} from '@/lib/residentCheckProofUrls'
import {
  getTokenBundleByRawToken,
  tokenIsExpired,
} from '@/lib/residentCheckTokenService'
import { syncResidentCheckProofsToReservationEvidence } from '@/lib/syncResidentCheckProofsToReservationEvidence'

const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
const MAX_SIZE = 5 * 1024 * 1024

function isUploadFile(value: FormDataEntryValue): value is File {
  return typeof File !== 'undefined' && value instanceof File && value.size > 0
}

function collectUploadFiles(formData: FormData): File[] {
  const files: File[] = []
  for (const key of ['file', 'files']) {
    for (const value of formData.getAll(key)) {
      if (isUploadFile(value)) files.push(value)
    }
  }
  return files
}

function storagePathFromPublicUrl(publicUrl: string): string | null {
  const marker = '/storage/v1/object/public/images/'
  const idx = publicUrl.indexOf(marker)
  if (idx === -1) return null
  const path = publicUrl.slice(idx + marker.length).split('?')[0]
  return path ? decodeURIComponent(path) : null
}

/**
 * POST /api/resident-check/upload
 * multipart: token, kind=pass|id, file|files[]
 * optional removeUrl: detach one previously uploaded file
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
    const removeUrl = String(formData.get('removeUrl') || '').trim()
    const files = collectUploadFiles(formData)

    if (!rawToken) {
      return NextResponse.json({ error: 'Missing token or file.' }, { status: 400 })
    }
    if (kind !== 'pass' && kind !== 'id') {
      return NextResponse.json({ error: 'Invalid kind.' }, { status: 400 })
    }
    if (!removeUrl && files.length === 0) {
      return NextResponse.json({ error: 'Missing token or file.' }, { status: 400 })
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

    const field: 'pass_photo_url' | 'id_proof_url' =
      kind === 'pass' ? 'pass_photo_url' : 'id_proof_url'
    let urls = parseResidentCheckProofUrls(submission[field])

    if (removeUrl) {
      urls = urls.filter((url) => url !== removeUrl)
      const path = storagePathFromPublicUrl(removeUrl)
      if (path?.startsWith('resident-check/')) {
        await supabaseAdmin.storage.from('images').remove([path])
      }
    }

    if (files.length > 0) {
      const remainingSlots = MAX_PROOF_FILES - urls.length
      if (remainingSlots <= 0) {
        return NextResponse.json(
          { error: `You can upload up to ${MAX_PROOF_FILES} files.` },
          { status: 400 }
        )
      }

      const toUpload = files.slice(0, remainingSlots)
      for (const file of toUpload) {
        if (!ALLOWED_TYPES.includes(file.type)) {
          return NextResponse.json({ error: 'Invalid file type.' }, { status: 400 })
        }
        if (file.size > MAX_SIZE) {
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

        urls.push(publicUrl)
      }
    }

    const serialized = serializeResidentCheckProofUrls(urls)
    const patch =
      kind === 'pass'
        ? { pass_photo_url: serialized, updated_at: new Date().toISOString() }
        : { id_proof_url: serialized, updated_at: new Date().toISOString() }
    const { error: upErr } = await supabaseAdmin
      .from('resident_check_submissions')
      .update(patch)
      .eq('token_id', token.id)

    if (upErr) {
      console.error('resident-check/upload db', upErr)
      return NextResponse.json({ error: 'Failed to attach file.' }, { status: 500 })
    }

    await syncResidentCheckProofsToReservationEvidence(token.reservation_id)

    return NextResponse.json({
      ok: true,
      urls,
      imageUrl: urls[urls.length - 1] ?? null,
    })
  } catch (e) {
    console.error('resident-check/upload', e)
    return NextResponse.json({ error: 'Unexpected error.' }, { status: 500 })
  }
}
