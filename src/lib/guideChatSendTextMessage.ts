import type { SupabaseClient } from '@supabase/supabase-js'
import type { ChatMessage } from '@/types/chat'

type InsertBuilder = {
  insert: (values: {
    room_id: string
    sender_type: 'guide' | 'customer'
    sender_name: string
    sender_email?: string
    message: string
    message_type: 'text'
  }) => {
    select: () => {
      single: () => Promise<{ data: ChatMessage | null; error: Error | null }>
    }
  }
}

export async function guideChatSendTextMessage(
  supabase: SupabaseClient,
  params: {
    roomId: string
    guideEmail: string
    senderName: string
    messageText: string
  }
): Promise<{ ok: true; data: ChatMessage } | { ok: false; error: unknown }> {
  const { roomId, guideEmail, senderName, messageText } = params
  try {
    const result = await (supabase.from('chat_messages') as unknown as InsertBuilder)
      .insert({
        room_id: roomId,
        sender_type: 'guide',
        sender_name: senderName,
        sender_email: guideEmail,
        message: messageText,
        message_type: 'text'
      })
      .select()
      .single()

    if (result.error) {
      return { ok: false, error: result.error }
    }
    const data = result.data
    if (!data) {
      return { ok: false, error: new Error('no_row') }
    }
    try {
      await fetch('/api/push-notification/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId,
          message: messageText,
          senderName
        })
      })
    } catch (pushError) {
      console.error('[guideChatSendTextMessage] push error:', pushError)
    }
    return { ok: true, data }
  } catch (e) {
    return { ok: false, error: e }
  }
}
