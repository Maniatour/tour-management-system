'use client'

import { supabase } from '@/lib/supabase'

/**
 * Travel Guide 스태프 API(/api/travel-guide) 접근 가능 여부.
 * UI의 canViewAdmin과 별개로, team 미등록 is_staff 계정도 포함한다.
 */
export async function canAccessTravelGuideStaffApi(): Promise<boolean> {
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session?.access_token) return false

  try {
    const response = await fetch('/api/travel-guide', {
      method: 'GET',
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
    return response.ok
  } catch {
    return false
  }
}
