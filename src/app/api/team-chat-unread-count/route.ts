import type { NextRequest } from 'next/server'
import { getTeamChatUnreadCount } from '@/lib/team-chat/get-unread-count'

export async function GET(request: NextRequest) {
  return getTeamChatUnreadCount(request)
}
