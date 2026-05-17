'use client'

import { useEffect, useState } from 'react'
import { fetchTeamMemberDisplayName } from '@/lib/teamMemberDisplayName'

/** submitted_by 이메일 → team.display_name */
export function useTeamMemberDisplayName(email: string | null | undefined): string | null {
  const [displayName, setDisplayName] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const em = String(email || '').trim()
    if (!em) {
      setDisplayName(null)
      return
    }
    void fetchTeamMemberDisplayName(em).then((name) => {
      if (!cancelled) setDisplayName(name)
    })
    return () => {
      cancelled = true
    }
  }, [email])

  return displayName
}
