/**
 * 고정 일일 패널(큐 기반)과 제목이 겹치는 DB Todo 판별.
 * 서버(API)에서도 호출 가능하도록 클라이언트 모듈을 import하지 않는다.
 */

const QUEUE_PANEL_TITLE_GROUPS: string[][] = [
  ['투어 봉투 프린트', 'tour envelope print'],
  ['Pick up Notification', 'pickup notification'],
  ['가이드와 스케줄 컨펌', 'guide & schedule confirm'],
  ['고객 정보 검수', 'customer info review'],
  ['취소 고객 재예약 권유', 'cancelled customer — rebook outreach'],
  ['취소 / 상담중 고객 재예약 권유', 'cancelled / consulting — rebook outreach'],
  ['Pending 고객 관리', 'pending customer management'],
  ['OTA 마감 처리', 'ota closure'],
  ['투어 호텔 관리', 'tour hotel management'],
  ['투어 호텔 가격 체크', 'tour hotel price check'],
  ['투어 호텔 CC Form', 'tour hotel cc form'],
  ['투어 정산', 'tour settlement'],
  ['예약 대행 관리', 'reservation agency management'],
  ['앤텔롭캐년 부킹 관리', 'antelope canyon booking management'],
  ['도시락 체크', 'bento check'],
  ['렌트카 픽드랍 안내', 'rental pickup / return notice'],
]

function normalizeTodoTitleKey(title: string): string {
  return title.replace(/\s+/g, ' ').trim().toLowerCase()
}

const QUEUE_PANEL_TITLE_SET = new Set(
  QUEUE_PANEL_TITLE_GROUPS.flat().map((t) => normalizeTodoTitleKey(t))
)

/** 영·한 별칭을 같은 키로 묶어 중복 행 제거에 사용 */
const QUEUE_PANEL_CANONICAL_BY_TITLE = new Map<string, string>()
for (const group of QUEUE_PANEL_TITLE_GROUPS) {
  const canonical = normalizeTodoTitleKey(group[0]!)
  for (const title of group) {
    QUEUE_PANEL_CANONICAL_BY_TITLE.set(normalizeTodoTitleKey(title), canonical)
  }
}

export function isQueuePanelLinkedOpTodo(todo: {
  title?: string | null
  action_type?: string | null
}): boolean {
  const normalized = normalizeTodoTitleKey(todo.title || '')
  if (!normalized) return false
  return QUEUE_PANEL_TITLE_SET.has(normalized)
}

/** 매트릭스 행 중복 제거용 키 (큐 패널은 영·한 제목을 동일 키로) */
export function todoMatrixDedupeKey(title: string): string {
  const normalized = normalizeTodoTitleKey(title)
  return QUEUE_PANEL_CANONICAL_BY_TITLE.get(normalized) ?? normalized
}
