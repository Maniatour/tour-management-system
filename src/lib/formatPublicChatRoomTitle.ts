/** 고객용 공개 채팅: 상품명만 (날짜와 한 줄로 쓸 때) */
export function formatPublicChatTourLabel(
  language: 'ko' | 'en',
  product: { name?: string | null; name_ko?: string | null; name_en?: string | null } | null,
  roomName: string
): string {
  if (language === 'ko') {
    const label = product?.name_ko ?? product?.name
    if (label) return label.trim()
    return roomName.replace(/\s*채팅방\s*$/u, '').trim() || roomName
  }
  const label = product?.name_en ?? product?.name
  if (label) return label.trim()
  const stripped = roomName
    .replace(/\s*채팅방\s*$/u, '')
    .replace(/\s*Chat Room\s*$/iu, '')
    .trim()
  return stripped || roomName.replace(/채팅방/g, '').replace(/Chat Room/gi, '').trim() || 'Tour'
}

/** 고객용 공개 채팅: 상품명·언어에 맞는 채팅방 제목 (DB room_name은 한국어 고정일 수 있음) */
export function formatPublicChatRoomTitle(
  language: 'ko' | 'en',
  product: { name?: string | null; name_ko?: string | null; name_en?: string | null } | null,
  roomName: string
): string {
  const label = formatPublicChatTourLabel(language, product, roomName)
  if (language === 'ko') {
    if (product?.name_ko ?? product?.name) return `${label} 채팅방`
    return roomName
  }
  if (product?.name_en ?? product?.name) return `${label} Chat Room`
  if (label) return `${label} Chat Room`
  return roomName.replace(/채팅방/g, 'Chat Room').trim() || 'Chat room'
}
