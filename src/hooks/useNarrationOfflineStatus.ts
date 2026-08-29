'use client'

import { useSyncExternalStore } from 'react'
import {
  getNarrationOfflineStatus,
  subscribeNarrationOfflineStatus,
  type NarrationOfflineStatus,
} from '@/lib/guideNarrationOffline'

export function useNarrationOfflineStatus(): NarrationOfflineStatus {
  return useSyncExternalStore(
    subscribeNarrationOfflineStatus,
    getNarrationOfflineStatus,
    getNarrationOfflineStatus,
  )
}
