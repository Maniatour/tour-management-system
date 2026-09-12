import { supabase } from '@/lib/supabase'
import { isTourMediaVideo } from '@/lib/tourPhotoUploadUtils'
import { uploadGuideQuickReceipt } from '@/lib/guideQuickReceiptUpload'
import { todayInLasVegas } from '@/lib/dailyReport/dateUtils'
import { setTourPhotoHiddenByAdmin } from '@/lib/tourPhotoVisibility'

export type MoveTourPhotoToReceiptParams = {
  tourId: string
  photo: {
    id: string
    file_name: string
    file_path: string
    thumbnail_path?: string | null
    mime_type?: string | null
    file_size?: number
  }
  uploadedBy: string
}

export async function moveTourPhotoToReceipt(params: MoveTourPhotoToReceiptParams): Promise<void> {
  const { tourId, photo, uploadedBy } = params
  if (isTourMediaVideo(photo.file_name, photo.mime_type)) {
    throw new Error('VIDEO_NOT_ALLOWED')
  }

  const { data: blob, error: downloadError } = await supabase.storage.from('tour-photos').download(photo.file_path)
  if (downloadError || !blob) {
    throw downloadError || new Error('PHOTO_DOWNLOAD_FAILED')
  }

  const mimeType = photo.mime_type || blob.type || 'image/jpeg'
  const file = new File([blob], photo.file_name || 'receipt.jpg', {
    type: mimeType,
    lastModified: Date.now(),
  })

  const { data: tour } = await supabase
    .from('tours')
    .select('tour_date, product_id')
    .eq('id', tourId)
    .maybeSingle()

  await uploadGuideQuickReceipt({
    file,
    tourId,
    tourDate: tour?.tour_date || todayInLasVegas(),
    productId: tour?.product_id || null,
    uploadedBy,
    note: 'Moved from tour photo album by admin; hidden from guest photo album.',
  })

  const storagePaths = [photo.file_path]
  if (photo.thumbnail_path) storagePaths.push(photo.thumbnail_path)

  const { error: storageError } = await supabase.storage.from('tour-photos').remove(storagePaths)
  if (storageError) {
    console.warn('Receipt created but tour photo storage delete failed:', storageError)
    await setTourPhotoHiddenByAdmin({
      tourId,
      photo: {
        id: photo.id,
        file_name: photo.file_name,
        file_path: photo.file_path,
        file_size: photo.file_size || 0,
        mime_type: mimeType,
        uploaded_by: uploadedBy,
      },
      hidden: true,
      uploadedBy,
    })
    return
  }

  await supabase.from('tour_photos').delete().eq('tour_id', tourId).eq('file_path', photo.file_path)
  await supabase.from('tour_photos').delete().eq('tour_id', tourId).eq('file_name', photo.file_name)
  if (photo.id) {
    await supabase.from('tour_photos').delete().eq('id', photo.id).eq('tour_id', tourId)
  }

  await supabase
    .from('tour_photo_hide_requests')
    .delete()
    .eq('tour_id', tourId)
    .eq('file_name', photo.file_name)
}
