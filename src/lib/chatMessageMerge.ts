type MergeableChatMessage = {
  id: string
  sender_type: string
  message?: string
  file_url?: string
  message_type?: string
}

function isTempId(id: string) {
  return id.startsWith('temp_')
}

function sameOptimisticPayload(a: MergeableChatMessage, b: MergeableChatMessage) {
  return (
    a.sender_type === b.sender_type &&
    (a.message || '') === (b.message || '') &&
    (a.file_url || '') === (b.file_url || '') &&
    (a.message_type || 'text') === (b.message_type || 'text')
  )
}

/** 실시간/폴링으로 들어온 메시지를 임시(낙관적) 메시지와 합친다. */
export function upsertIncomingChatMessage<T extends MergeableChatMessage>(
  prev: T[],
  incoming: T
): T[] {
  if (prev.some((m) => m.id === incoming.id)) {
    return prev
  }

  const tempIdx = prev.findIndex(
    (m) => isTempId(m.id) && sameOptimisticPayload(m, incoming)
  )
  if (tempIdx !== -1) {
    const next = [...prev]
    next[tempIdx] = incoming
    return next
  }

  return [...prev, incoming]
}

/** 전송 성공 후 임시 메시지를 서버 메시지로 확정한다. 이미 들어온 실메시지와 중복되지 않게 한다. */
export function commitOptimisticChatMessage<T extends MergeableChatMessage>(
  prev: T[],
  tempId: string,
  real: T
): T[] {
  const next = prev.filter((m) => m.id !== tempId && m.id !== real.id)
  next.push(real)
  return next
}

export function mergePolledChatMessages<T extends MergeableChatMessage>(
  prev: T[],
  serverRows: T[]
): T[] {
  let next = prev
  let changed = false
  for (const row of serverRows) {
    const merged = upsertIncomingChatMessage(next, row)
    if (merged !== next) {
      changed = true
      next = merged
    }
  }
  return changed ? next : prev
}
