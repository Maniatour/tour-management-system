import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

/**
 * 투어별 사진 폴더 자동 생성 및 관리 훅
 */
export function useTourPhotoFolder(tourId: string) {
  const [folderStatus, setFolderStatus] = useState<'checking' | 'exists' | 'creating' | 'error'>('checking')
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    if (!tourId) return

    const ensureFolder = async () => {
      try {
        setFolderStatus('checking')
        
        // 폴더 존재 확인
        const { data: folderFiles } = await supabase.storage
          .from('tour-photos')
          .list(tourId, { limit: 1 })
        
        if (folderFiles && folderFiles.length >= 0) {
          setFolderStatus('exists')
          setIsReady(true)
          return
        }

        // 폴더가 없으면 생성
        setFolderStatus('creating')
        
        const folderInfo = JSON.stringify({
          tourId: tourId,
          createdAt: new Date().toISOString(),
          autoCreated: true,
          folderType: 'tour-photos'
        })

        const { error } = await supabase.storage
          .from('tour-photos')
          .upload(`${tourId}/.folder_info.json`, new Blob([folderInfo], { type: 'application/json' }), {
            upsert: true
          })

        if (error) {
          console.error('Error creating tour photo folder:', error)
          setFolderStatus('error')
          return
        }

        setFolderStatus('exists')
        setIsReady(true)
        console.log(`✅ Tour photo folder ready for: ${tourId}`)
        
      } catch (error) {
        console.error('Error in useTourPhotoFolder:', error)
        setFolderStatus('error')
      }
    }

    ensureFolder()
  }, [tourId])

  return {
    folderStatus,
    isReady,
    retry: () => {
      // 수동으로 재시도
      const ensureFolder = async () => {
        setFolderStatus('creating')
        
        const folderInfo = JSON.stringify({
          tourId: tourId,
          createdAt: new Date().toISOString(),
          retryCreated: true
        })

        const { error } = await supabase.storage
          .from('tour-photos')
          .upload(`${tourId}/.folder_info.json`, new Blob([folderInfo], { type: 'application/json' }), {
            upsert: true
          })

        if (error) {
          setFolderStatus('error')
        } else {
          setFolderStatus('exists')
          setIsReady(true)
        }
      }
      
      ensureFolder()
    }
  }
}
