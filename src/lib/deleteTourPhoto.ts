import { supabase } from '@/lib/supabase'

export type DeleteTourPhotoParams = {
  photoId: string
  filePath: string
  thumbnailPath?: string | null
}

export async function deleteTourPhotoFromStorageAndDb(params: DeleteTourPhotoParams): Promise<void> {
  const paths = [params.filePath]
  if (params.thumbnailPath && params.thumbnailPath !== params.filePath) {
    paths.push(params.thumbnailPath)
  }

  const { error: storageError } = await supabase.storage.from('tour-photos').remove(paths)
  if (storageError) throw storageError

  const { error: dbError } = await supabase.from('tour_photos').delete().eq('id', params.photoId)
  if (dbError) throw dbError
}

