// Chat 관련 타입 정의
export interface ChatMessage {
  id: string
  room_id: string
  sender_type: 'guide' | 'customer' | 'system'
  sender_name: string
  sender_email?: string
  sender_avatar?: string
  message: string
  message_type: 'text' | 'image' | 'file' | 'system' | 'location'
  file_url?: string
  file_name?: string
  file_size?: number
  is_read: boolean
  created_at: string
}

export interface ChatRoom {
  id: string
  tour_id: string
  room_name: string
  room_code: string
  description?: string
  is_active: boolean
  created_by: string
  created_at: string
}

export interface ChatAnnouncement {
  id: string
  title: string
  content: string
  language: string
  is_active: boolean
  created_at: string
}

export interface ChatBan {
  id: string
  room_id: string
  client_id?: string
  customer_name?: string
  banned_until?: string
}

export interface Participant {
  id: string
  name: string
  type: 'guide' | 'customer'
  email?: string
  lastSeen: Date
}

