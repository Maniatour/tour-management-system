/** 고객용 공개 채팅: 상품명·언어에 맞는 채팅방 제목 (DB room_name은 한국어 고정일 수 있음) */
export function formatPublicChatRoomTitle(
  language: 'ko' | 'en',
  product: { name?: string | null; name_ko?: string | null; name_en?: string | null } | null,
  roomName: string
): string {
  if (language === 'ko') {
    const label = product?.name_ko ?? product?.name
    if (label) return `${label} 채팅방`
    return roomName
  }
  const label = product?.name_en ?? product?.name
  if (label) return `${label} Chat Room`
  const stripped = roomName.replace(/\s*채팅방\s*$/u, '').trim()
  if (stripped) return `${stripped} Chat Room`
  return roomName.replace(/채팅방/g, 'Chat Room').trim() || 'Chat room'
}
