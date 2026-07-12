import { supabase } from '@/lib/supabase'

const BUCKET_NAME = 'product-media'

export async function uploadCustomerPageAsset(file: File, folder: string): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('이미지 파일만 업로드할 수 있습니다.')
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
  const fileName = `customer-page/${folder}/${Date.now()}-${safeName}`

  const { error } = await supabase.storage.from(BUCKET_NAME).upload(fileName, file, {
    cacheControl: '3600',
    upsert: false,
  })

  if (error) {
    throw new Error(error.message)
  }

  const { data } = supabase.storage.from(BUCKET_NAME).getPublicUrl(fileName)
  return data.publicUrl
}
