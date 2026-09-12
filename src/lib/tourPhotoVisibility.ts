import { supabase } from '@/lib/supabase'

export function tourPhotoFileKeys(fileName: string, filePath?: string | null): string[] {
  const keys = new Set<string>()
  const name = (fileName || '').trim()
  if (name) keys.add(name)
  if (typeof filePath === 'string' && filePath.length > 0) {
    const base = filePath.split('/').filter(Boolean).pop()
    if (base) keys.add(base)
  }
  return Array.from(keys)
}

export function isTourPhotoFileHidden(hiddenNames: Set<string>, fileName: string, filePath?: string | null): boolean {
  return tourPhotoFileKeys(fileName, filePath).some((key) => hiddenNames.has(key))
}

/** Customer-facing hide set: customer hide requests + admin hide. */
export async function loadHiddenTourPhotoFileNames(tourId: string): Promise<Set<string>> {
  const hidden = new Set<string>()
  if (!tourId) return hidden

  const [{ data: hideRequests, error: hideError }, { data: adminHidden, error: adminError }] = await Promise.all([
    supabase
      .from('tour_photo_hide_requests')
      .select('file_name, file_path')
      .eq('tour_id', tourId)
      .eq('is_hidden', true),
    supabase
      .from('tour_photos')
      .select('file_name, file_path')
      .eq('tour_id', tourId)
      .eq('hidden_by_admin', true),
  ])

  if (hideError) console.warn('Error loading photo hide requests:', hideError)
  if (adminError) console.warn('Error loading admin-hidden photos:', adminError)

  for (const row of hideRequests || []) {
    for (const key of tourPhotoFileKeys(row.file_name, row.file_path)) hidden.add(key)
  }
  for (const row of adminHidden || []) {
    for (const key of tourPhotoFileKeys(row.file_name, row.file_path)) hidden.add(key)
  }

  return hidden
}

type TourPhotoHideTarget = {
  id: string
  file_name: string
  file_path: string
  file_size?: number
  mime_type?: string
  uploaded_by?: string
}

async function findTourPhotoRowId(tourId: string, photo: TourPhotoHideTarget): Promise<string | null> {
  if (photo.id) {
    const { data } = await supabase.from('tour_photos').select('id').eq('id', photo.id).maybeSingle()
    if (data?.id) return data.id
  }

  const { data: byName } = await supabase
    .from('tour_photos')
    .select('id')
    .eq('tour_id', tourId)
    .eq('file_name', photo.file_name)
    .maybeSingle()
  if (byName?.id) return byName.id

  const { data: byPath } = await supabase
    .from('tour_photos')
    .select('id')
    .eq('tour_id', tourId)
    .eq('file_path', photo.file_path)
    .maybeSingle()
  return byPath?.id || null
}

export async function setTourPhotoHiddenByAdmin(params: {
  tourId: string
  photo: TourPhotoHideTarget
  hidden: boolean
  uploadedBy: string
}): Promise<void> {
  const { tourId, photo, hidden, uploadedBy } = params
  const existingId = await findTourPhotoRowId(tourId, photo)

  if (existingId) {
    const { error } = await supabase
      .from('tour_photos')
      .update({ hidden_by_admin: hidden })
      .eq('id', existingId)
    if (error) throw error
    return
  }

  if (!hidden) return

  const submitter = (uploadedBy || photo.uploaded_by || '').trim() || 'admin'
  const { error } = await supabase.from('tour_photos').insert({
    tour_id: tourId,
    file_name: photo.file_name,
    file_path: photo.file_path,
    file_size: photo.file_size || 0,
    mime_type: photo.mime_type || 'image/jpeg',
    uploaded_by: submitter,
    hidden_by_admin: true,
    is_public: false,
  })
  if (error) throw error
}
