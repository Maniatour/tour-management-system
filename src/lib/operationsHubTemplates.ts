import type { OperationsContentType, OperationsHubCategory } from '@/types/sopStructure'
import {
  newSopId,
  prefillSortOrders,
  sopDocumentToJson,
  type SopCategory,
  type SopChecklistItem,
  type SopDocument,
  type SopSection,
} from '@/types/sopStructure'
import type { Json } from '@/lib/database.types'
import { reservationAdminManualDocument } from '@/lib/reservationAdminManualDocument'
import { productsHomeSectionsManualDocument } from '@/lib/productsHomeSectionsManualDocument'

type ArticleSeed = {
  slug: string
  title_ko: string
  title_en: string
  summary_ko: string
  summary_en: string
  hub_category: OperationsHubCategory
  content_type: OperationsContentType
  target_roles: string[]
  sort_order: number
  body_structure: SopDocument
}

export type { ArticleSeed }

export function buildKnowledgeArticleSeedPayload(
  seed: ArticleSeed,
  options?: {
    is_published?: boolean
    published_at?: string | null
    updated_by?: string | null
  }
) {
  const isPublished = options?.is_published ?? true
  return {
    slug: seed.slug,
    title_ko: seed.title_ko,
    title_en: seed.title_en,
    summary_ko: seed.summary_ko,
    summary_en: seed.summary_en,
    hub_category: seed.hub_category,
    content_type: seed.content_type,
    target_roles: seed.target_roles,
    sort_order: seed.sort_order,
    body_structure: sopDocumentToJson(seed.body_structure) as Json,
    is_published: isPublished,
    published_at: options?.published_at ?? (isPublished ? new Date().toISOString() : null),
    updated_by: options?.updated_by ?? null,
  }
}

function checks(
  items: Array<{ ko: string; en: string; parent?: number }>
): SopChecklistItem[] {
  const ids = items.map(() => newSopId())
  return items.map((it, i) => ({
    id: ids[i]!,
    title_ko: it.ko,
    title_en: it.en,
    sort_order: i,
    parent_id: it.parent != null && ids[it.parent] ? ids[it.parent]! : null,
  }))
}

function cat(
  title_ko: string,
  title_en: string,
  content_ko: string,
  content_en: string,
  sort_order: number,
  checklist?: SopChecklistItem[]
): SopCategory {
  return {
    id: newSopId(),
    title_ko,
    title_en,
    content_ko,
    content_en,
    sort_order,
    ...(checklist?.length ? { checklist_items: checklist } : {}),
  }
}

function sec(
  title_ko: string,
  title_en: string,
  sort_order: number,
  categories: SopCategory[]
): SopSection {
  return { id: newSopId(), title_ko, title_en, sort_order, categories }
}

function doc(title_ko: string, title_en: string, sections: SopSection[]): SopDocument {
  return prefillSortOrders({ title_ko, title_en, sections })
}

function seed(
  slug: string,
  title_ko: string,
  title_en: string,
  summary_ko: string,
  summary_en: string,
  hub_category: OperationsHubCategory,
  content_type: OperationsContentType,
  target_roles: string[],
  sort_order: number,
  body: SopDocument
): ArticleSeed {
  return {
    slug,
    title_ko,
    title_en,
    summary_ko,
    summary_en,
    hub_category,
    content_type,
    target_roles,
    sort_order,
    body_structure: body,
  }
}

/** 운영 허브 초기·보충 템플릿 (실무 내용 포함) */
export function defaultKnowledgeArticleSeeds(): ArticleSeed[] {
  return [
    // ─── 온보딩 ───
    seed(
      'onboarding-week-1',
      '신규 입사 1주차 로드맵',
      'New hire — first week',
      '계정·SOP·핵심 시스템·담당자 면담까지 5일 체크리스트',
      '5-day checklist: accounts, SOP, core systems, intro meetings',
      'onboarding',
      'onboarding',
      [],
      0,
      doc('신규 입사 1주차', 'First week onboarding', [
        sec('1주차 목표', 'Week 1 goals', 0, [
          cat(
            '완료 기준',
            'Completion criteria',
            '입사 1주차 종료 시 아래 항목을 **모두** 완료해야 일반 업무 투입이 가능합니다.\n\n- 회사 SOP 전자서명 완료\n- 담당 OP·팀장 1:1 면담\n- 본인 역할에 해당하는 운영 허브 문서 3개 이상 숙지\n- 팀보드 OP Todo에서 본인 부서 항목 확인',
            'By end of week 1, complete **all** items below before regular task assignment.\n\n- Sign company SOP electronically\n- 1:1 with assigned OP lead / manager\n- Read at least 3 operations hub docs for your role\n- Review team-board OP todos for your department',
            0,
            checks([
              { ko: 'Day 1: 이메일·Slack(또는 팀 채팅) 계정 확인', en: 'Day 1: Verify email & team chat access' },
              { ko: 'Day 1: 가이드/관리자 앱 로그인 테스트', en: 'Day 1: Test guide/admin app login' },
              { ko: 'Day 2: 회사 SOP 읽기 + 전자서명', en: 'Day 2: Read & sign company SOP' },
              { ko: 'Day 2: 운영 허브 → 본인 역할 카테고리 문서 1개', en: 'Day 2: One hub doc in your role category' },
              { ko: 'Day 3: 팀보드 OP Todo 구조 이해', en: 'Day 3: Understand team-board OP todos' },
              { ko: 'Day 4: 그림자 업무(shadow) 1회 참관', en: 'Day 4: Shadow a colleague once' },
              { ko: 'Day 5: 담당자 면담 + 미해결 질문 정리', en: 'Day 5: Manager check-in & open questions' },
            ])
          ),
        ]),
        sec('역할별 필수 문서', 'Required docs by role', 10, [
          cat(
            '읽을 문서',
            'Documents to read',
            '**사무·OP**: `workflow-booking-confirm`, `system-admin-reservation`, `workflow-guide-assign`\n\n**가이드·드라이버**: `guide-tour-day-checklist`, `system-guide-tour-day`, `guide-pickup-procedure`\n\n**전 직원**: `escalation-contact-matrix`',
            '**Office/OP**: booking confirm workflow, admin reservation guide, guide assignment\n\n**Guide/Driver**: tour-day checklist, guide app guide, pickup procedure\n\n**All staff**: escalation contact matrix',
            0
          ),
        ]),
      ])
    ),

    seed(
      'onboarding-month-1',
      '신규 입사 1개월 로드맵',
      'New hire — first month',
      '2~4주차 실습·독립 업무·멘토 피드백',
      'Weeks 2–4: practice, independent tasks, mentor feedback',
      'onboarding',
      'onboarding',
      [],
      10,
      doc('신규 입사 1개월', 'First month onboarding', [
        sec('2주차 — 실습', 'Week 2 — practice', 0, [
          cat(
            '실습 과제',
            'Practice tasks',
            '멘토와 함께 **실제 건**을 처리하되, 최종 저장·발송은 멘토 확인 후 진행합니다.',
            'Handle **real cases** with a mentor; final save/send only after mentor approval.',
            0,
            checks([
              { ko: '예약 1건 조회·메모 확인 (멘토 동행)', en: 'Review one booking with mentor' },
              { ko: '투어 1건 상세 화면 탐색', en: 'Explore one tour detail screen' },
              { ko: '팀보드 공지 1건 확인 처리', en: 'Acknowledge one team announcement' },
            ])
          ),
        ]),
        sec('3~4주차 — 독립', 'Weeks 3–4 — independent', 10, [
          cat(
            '독립 업무 기준',
            'Independence criteria',
            '아래를 스스로 수행할 수 있으면 1개월 온보딩 완료로 봅니다.\n\n- 본인 담당 채널 예약 문의 1차 응대\n- 투어 배정 확인·가이드 연락\n- 이슈 발생 시 에스컬레이션 매트릭스에 따라 보고',
            'Onboarding complete when you can do the following independently.\n\n- First response to booking inquiries for your channels\n- Confirm tour assignment & contact guide\n- Report issues per escalation matrix',
            0,
            checks([
              { ko: '멘토 피드백 1회 이상 받기', en: 'Receive mentor feedback at least once' },
              { ko: '실수·개선점 노트 작성', en: 'Document mistakes & improvements' },
              { ko: '1개월 면담 일정 잡기', en: 'Schedule 1-month review meeting' },
            ])
          ),
        ]),
      ])
    ),

    seed(
      'onboarding-system-access',
      '시스템 계정 · 접근 권한',
      'System accounts & access',
      '관리자/가이드 앱, 이메일, 푸시 알림 설정',
      'Admin/guide apps, email, push notification setup',
      'onboarding',
      'system_guide',
      [],
      20,
      doc('시스템 접근', 'System access', [
        sec('계정 종류', 'Account types', 0, [
          cat(
            '역할별 접근',
            'Access by role',
            '| 역할 | 관리자 웹 | 가이드 앱 | SOP 서명 | 팀보드 |\n|------|----------|----------|---------|--------|\n| OP / Super | ✅ | 선택 | ✅ | ✅ |\n| Office | ✅ | ❌ | ✅ | ✅ |\n| Guide / Driver | ❌ | ✅ | ✅ | ✅ |\n\n권한 변경은 **OP Super** 또는 **office manager**에게 요청합니다.',
            '| Role | Admin web | Guide app | SOP sign | Team board |\n|------|-----------|-----------|----------|------------|\n| OP / Super | ✅ | optional | ✅ | ✅ |\n| Office | ✅ | ❌ | ✅ | ✅ |\n| Guide / Driver | ❌ | ✅ | ✅ | ✅ |\n\nRequest access changes from **OP Super** or **office manager**.',
            0,
            checks([
              { ko: 'Google 로그인으로 관리자/가이드 앱 접속 확인', en: 'Confirm Google login to admin/guide app' },
              { ko: 'SOP 미서명 시 로그인 차단 모달 확인 (직원)', en: 'Staff: note SOP gate if unsigned' },
              { ko: '웹푸시 알림 허용 (SOP·투어·팀보드)', en: 'Allow web push (SOP, tour, team board)' },
            ])
          ),
        ]),
      ])
    ),

    // ─── 예약 · CS ───
    seed(
      'workflow-inquiry-to-quote',
      '문의 접수 → 견적 · 예약 생성',
      'Inquiry → quote & booking',
      '고객 문의 채널별 1차 응대·상품 확인·예약 생성',
      'First response, product check, create booking',
      'reservation',
      'playbook',
      ['op', 'office manager', 'office'],
      0,
      doc('문의 → 예약 생성', 'Inquiry to booking', [
        sec('절차', 'Procedure', 0, [
          cat(
            '단계',
            'Steps',
            '1. **문의 접수** — 이메일·OTA·채팅·전화 등 채널 확인\n2. **상품·일정 확인** — 투어 가능일, 잔여석, 픽업 지역\n3. **고객 정보** — 인원, 호텔, 연락처, 특이사항(유아·휠체어 등)\n4. **예약 생성** — 관리자 > 예약 관리에서 신규 생성\n5. **가격·선결제** — Pricing 섹션에서 채널 요율 적용\n6. **고객 회신** — 확정 전이면 “접수·검토 중”, 확정 시 다음 워크플로로',
            '1. **Receive inquiry** — email, OTA, chat, phone\n2. **Check product/date** — availability, seats, pickup area\n3. **Customer info** — pax, hotel, contact, special needs\n4. **Create booking** — Admin > Reservations > New\n5. **Pricing** — apply channel rates in Pricing section\n6. **Reply** — “received” if pending; if confirmed, follow confirm workflow',
            0,
            checks([
              { ko: '채널(OTA/직판) 확인 후 올바른 상품·요율 선택', en: 'Select correct product & rate for channel' },
              { ko: '호텔 픽업 가능 여부 확인 (픽업 호텔 DB)', en: 'Verify hotel pickup in pickup hotel DB' },
              { ko: '예약 메모에 특이사항 기록', en: 'Note special requests in reservation memo' },
              { ko: '중복 예약(동일 고객·동일 일자) 검색', en: 'Search duplicate same customer/date' },
            ])
          ),
        ]),
        sec('자주 하는 실수', 'Common mistakes', 10, [
          cat(
            '주의',
            'Cautions',
            '- 상품 코드 혼동 (반일/종일/프라이빗)\n- 픽업 시간대 미확인\n- 환율·통화 잘못 선택\n- 취소 정책 미안내',
            '- Wrong product code (half/full/private)\n- Pickup time not verified\n- Wrong currency\n- Cancellation policy not communicated',
            0
          ),
        ]),
      ])
    ),

    seed(
      'workflow-booking-confirm',
      '예약 확정 워크플로',
      'Booking confirmation workflow',
      '결제 확인 → 투어 연결 → 확정 메일·바우처',
      'Payment check → link tour → confirmation & voucher',
      'reservation',
      'playbook',
      ['op', 'office manager', 'office'],
      10,
      doc('예약 확정', 'Booking confirmation', [
        sec('확정 전 체크', 'Pre-confirmation checks', 0, [
          cat(
            '필수 확인',
            'Required checks',
            '예약 상태를 **확정(Confirmed)** 으로 변경하기 전에 아래를 확인합니다.',
            'Complete all checks below before setting status to **Confirmed**.',
            0,
            checks([
              { ko: '선결제/잔금 조건 충족 (Pricing 섹션)', en: 'Prepayment/balance terms met (Pricing)' },
              { ko: '투어 일정·상품 ID 올바름', en: 'Correct tour date & product' },
              { ko: '픽업 호텔·시간 입력됨', en: 'Pickup hotel & time entered' },
              { ko: '인원·옵션(식사·입장권 등) 최종 확인', en: 'Final pax & options verified' },
              { ko: '해당 일자 투어에 예약 연결 또는 투어 생성 예정', en: 'Linked to tour or tour to be created' },
            ])
          ),
        ]),
        sec('확정 후', 'After confirmation', 10, [
          cat(
            '후속 작업',
            'Follow-up',
            '1. 고객에게 **확정 메일/메시지** 발송 (일정·픽업·준비물)\n2. 필요 시 **바우처·itinerary** 생성·첨부\n3. 투어 OP에 특이사항 전달 (팀 채팅 또는 투어 메모)\n4. Gmail import 예약이면 import 상태 정리',
            '1. Send **confirmation** with schedule, pickup, what to bring\n2. Generate **voucher/itinerary** if needed\n3. Notify tour OP of special notes (team chat or tour memo)\n4. Clean up Gmail import status if applicable',
            0,
            checks([
              { ko: '확정 알림 발송 기록', en: 'Log confirmation sent' },
              { ko: '캘린더/투어 쪽 예약 반영 확인', en: 'Verify booking on tour/calendar' },
            ])
          ),
        ]),
      ])
    ),

    seed(
      'workflow-booking-cancel',
      '예약 변경 · 취소 처리',
      'Booking change & cancellation',
      '정책 확인 → 환불·수수료 → 시스템·투어 반영',
      'Policy → refund/fee → update system & tour',
      'reservation',
      'playbook',
      ['op', 'office manager', 'office'],
      20,
      doc('변경 · 취소', 'Change & cancellation', [
        sec('취소', 'Cancellation', 0, [
          cat(
            '절차',
            'Steps',
            '1. **취소 요청 접수** — 일시·사유 기록\n2. **SOP 취소 정책** 적용 (기한·수수료 %)\n3. **환불 금액** Pricing/환불 필드에 반영\n4. **예약 상태** Cancelled로 변경\n5. **연결 투어**에서 해당 예약 제외·인원 재집계\n6. **고객 회신** — 환불 예정일·금액 명시',
            '1. **Log request** — time & reason\n2. Apply **SOP cancellation policy**\n3. Enter **refund** in Pricing/refund fields\n4. Set status **Cancelled**\n5. Remove from **linked tour** & recount pax\n6. **Reply to customer** with refund amount & timeline',
            0,
            checks([
              { ko: '취소 정책 기한(며칠 전) 확인', en: 'Check policy deadline (days before)' },
              { ko: '부분 취소 vs 전체 취소 구분', en: 'Partial vs full cancellation' },
              { ko: 'OTA 채널이면 채널 규정 우선 확인', en: 'OTA: channel rules first' },
              { ko: '가이드·OP에 인원 변경 알림', en: 'Notify guide/OP of pax change' },
            ])
          ),
        ]),
        sec('변경', 'Changes', 10, [
          cat(
            '일정·인원 변경',
            'Date & pax changes',
            '날짜 변경은 **새 투어 가용성** 확인 후 진행. 인원 증감은 Pricing 재계산 필수.\n\n급한 당일 변경은 `escalation-contact-matrix` 참고하여 OP Super에게 즉시 보고.',
            'Date changes require **new tour availability**. Pax changes require Pricing recalc.\n\nSame-day urgent changes: report to OP Super per escalation matrix.',
            0
          ),
        ]),
      ])
    ),

    seed(
      'workflow-customer-complaint',
      '고객 불만 · 클레임 대응',
      'Customer complaints',
      '접수 → 사실 확인 → 보상·재발방지 → 기록',
      'Intake → verify → remedy → prevent recurrence',
      'reservation',
      'playbook',
      ['op', 'office manager', 'office'],
      30,
      doc('클레임 대응', 'Complaint handling', [
        sec('대응 단계', 'Response steps', 0, [
          cat(
            '표준 절차',
            'Standard procedure',
            '1. **감정 수용** — 고객 말 끊지 않기, 사과(책임 인정 전 사과 표현)\n2. **사실 수집** — 투어 일자, 가이드, 예약번호, 현장 상황\n3. **내부 확인** — 가이드·OP·사진·채팅 로그\n4. **해결안** — 환불/재투어/보상 범위는 **office manager** 이상 승인\n5. **기록** — 팀보드 Issue 또는 예약 메모 + 교훈',
            '1. **Acknowledge** — listen fully\n2. **Facts** — date, guide, booking ref, field situation\n3. **Internal review** — guide, OP, photos, chat logs\n4. **Resolution** — refund/re-tour/compensation needs **office manager+** approval\n5. **Record** — team-board issue + reservation memo + lessons',
            0,
            checks([
              { ko: '24시간 내 1차 회신', en: 'First reply within 24 hours' },
              { ko: 'SOP·계약상 약속 범위 내에서만 보상', en: 'Compensation within SOP/contract only' },
              { ko: '가이드에게 단독 책임 전가 금지 (사실 확인 후)', en: 'No blaming guide before facts' },
            ])
          ),
        ]),
      ])
    ),

    seed(
      'workflow-voucher-itinerary',
      '바우처 · itinerary 발송',
      'Voucher & itinerary',
      '확정 후 고객 발송 문서 생성·검수·발송',
      'Generate, review, send post-confirmation docs',
      'reservation',
      'playbook',
      ['op', 'office', 'office manager'],
      40,
      doc('바우처 · itinerary', 'Voucher & itinerary', [
        sec('발송 절차', 'Send procedure', 0, [
          cat(
            '체크리스트',
            'Checklist',
            '문서 생성기 또는 예약 상세에서 itinerary 생성 후 아래를 검수합니다.',
            'Generate from document generator or reservation detail, then verify:',
            0,
            checks([
              { ko: '고객명·인원·연락처 정확', en: 'Correct name, pax, contact' },
              { ko: '픽업 호텔·시간·장소', en: 'Pickup hotel, time, location' },
              { ko: '상품명·포함/불포함 사항', en: 'Product name, inclusions/exclusions' },
              { ko: '준비물·드레스코드', en: 'What to bring, dress code' },
              { ko: '회사 연락처·긴급 번호', en: 'Company & emergency contact' },
              { ko: 'PDF/이메일 발송 후 발송 로그', en: 'Log after email/PDF sent' },
            ])
          ),
        ]),
      ])
    ),

    // ─── 투어 운영 ───
    seed(
      'workflow-guide-assign',
      '가이드 · 차량 배정',
      'Guide & vehicle assignment',
      '배정 기준·확인·변경·가이드 연락',
      'Criteria, confirm, change, contact guide',
      'tour_ops',
      'playbook',
      ['op', 'super', 'office manager'],
      0,
      doc('가이드 배정', 'Guide assignment', [
        sec('배정 원칙', 'Assignment principles', 0, [
          cat(
            '기준',
            'Criteria',
            '- **자격**: 해당 상품 SOP·언어 가능\n- **일정**: 동일 시간대 중복 배정 금지\n- **피로도**: 연속 장거리 투어 주의\n- **고객 특성**: VIP·단체·특수 요청 시 숙련 가이드',
            '- **Qualification**: product SOP & language\n- **Schedule**: no double-booking same slot\n- **Fatigue**: avoid back-to-back long tours\n- **Client**: skilled guide for VIP/group/special requests',
            0,
            checks([
              { ko: '투어 상세에서 가이드·어시·차량 필드 입력', en: 'Enter guide, assistant, vehicle on tour detail' },
              { ko: '가이드에게 배정 알림(앱 푸시·채팅)', en: 'Notify guide (push/chat)' },
              { ko: '가이드 수락/확인 대기 — 미응답 시 2차 연락', en: 'Wait for ack — 2nd contact if no reply' },
              { ko: '변경 시 이전 가이드·고객 영향 확인', en: 'On change: impact on prior guide & customers' },
            ])
          ),
        ]),
      ])
    ),

    seed(
      'workflow-pickup-schedule',
      '픽업 스케줄 작성 · 발송',
      'Pickup schedule publish',
      '호텔별 픽업 시간·가이드 공유·고객 알림',
      'Hotel pickup times, guide share, customer notify',
      'tour_ops',
      'playbook',
      ['op', 'super'],
      10,
      doc('픽업 스케줄', 'Pickup schedule', [
        sec('작성', 'Preparation', 0, [
          cat(
            '전일·당일 절차',
            'Day-before / day-of',
            '1. 투어 상세 **픽업** 탭에서 호텔·시간 순 정렬\n2. **대표 픽업** 그룹 사용 시 preset 확인\n3. 가이드 앱에서 동일 정보 노출 확인\n4. 필요 시 **픽업 스케줄 알림** API/버튼으로 고객·가이드 발송\n5. 변경 발생 시 즉시 재발송 + 채팅 공지',
            '1. Sort hotels/times in tour **Pickup** tab\n2. Verify **representative pickup** presets\n3. Confirm same data in guide app\n4. Send **pickup schedule notification** if needed\n5. On change: resend + chat notice immediately',
            0,
            checks([
              { ko: '픽업 호텔 DB와 실제 호텔명 매칭', en: 'Match pickup hotel DB names' },
              { ko: '버퍼 시간(교통) 반영', en: 'Include traffic buffer' },
              { ko: '잔액(Balance) 수금 필요 고객 표시 확인', en: 'Flag customers with balance due' },
            ])
          ),
        ]),
      ])
    ),

    seed(
      'workflow-tour-day-ops',
      '투어 당일 OP 모니터링',
      'Tour-day OP monitoring',
      '출발 전·진행 중·종료 후 OP 체크',
      'Pre-departure, in-progress, post-tour OP checks',
      'tour_ops',
      'playbook',
      ['op', 'super'],
      20,
      doc('당일 OP', 'Tour-day OP', [
        sec('타임라인', 'Timeline', 0, [
          cat(
            '체크 포인트',
            'Checkpoints',
            '**출발 2시간 전**: 가이드 출근·차량·인원 최종\n**픽업 시작**: 채팅 모니터링, 지연 시 고객 연락\n**진행 중**: 이슈 즉시 에스컬레이션\n**종료 후**: 리포트·사진·SOP 체크리스트·정산 입력 확인',
            '**2h before**: guide check-in, vehicle, final pax\n**Pickup start**: monitor chat, contact if delay\n**During**: escalate issues immediately\n**After**: report, photos, SOP checklist, expenses verified',
            0,
            checks([
              { ko: '투어 취소/No-show 처리', en: 'Handle cancel/no-show' },
              { ko: '현장 추가 인원·옵션 변경 OP 승인', en: 'Approve on-site pax/option changes' },
              { ko: '팀보드 Issue 등록 (중대 이슈)', en: 'Log major issues on team board' },
            ])
          ),
        ]),
      ])
    ),

    seed(
      'workflow-tour-create-link',
      '투어 생성 · 예약 연결',
      'Create tour & link bookings',
      '캘린더 투어 생성·예약 drag/link·인원 집계',
      'Calendar tour, link reservations, pax count',
      'tour_ops',
      'playbook',
      ['op', 'super', 'office manager'],
      30,
      doc('투어 생성', 'Create tour', [
        sec('절차', 'Procedure', 0, [
          cat(
            '단계',
            'Steps',
            '1. **관리자 > 투어** 캘린더에서 해당 일자·상품 선택\n2. **신규 투어** 생성 — 가이드·차량·메모\n3. **확정 예약**을 투어에 연결 (미연결 예약 큐 확인)\n4. **인원·옵션** 집계 후 최대 수용 인원 초과 여부 확인\n5. **픽업·스케줄** 탭 작성\n6. 가이드 **SOP 체크리스트** 상품 매핑 확인',
            '1. **Admin > Tours** calendar — pick date & product\n2. **New tour** — guide, vehicle, notes\n3. **Link confirmed bookings** (check unlinked queue)\n4. **Recount pax/options** vs capacity\n5. Fill **Pickup/Schedule** tabs\n6. Verify guide **SOP checklist** product mapping',
            0,
            checks([
              { ko: '상품 코드·투어 유형 일치', en: 'Product code & tour type match' },
              { ko: '취소 예약 연결 제외', en: 'Exclude cancelled bookings' },
              { ko: '대표 픽업 사용 여부 설정', en: 'Set representative pickup flag' },
            ])
          ),
        ]),
      ])
    ),

    // ─── 가이드 · 현장 ───
    seed(
      'guide-tour-day-checklist',
      '가이드 — 투어 당일 체크리스트',
      'Guide — tour day checklist',
      '출근부터 종료·리포트까지 현장 순서',
      'From check-in to report — field sequence',
      'guide',
      'playbook',
      ['guide', 'driver'],
      0,
      doc('투어 당일', 'Tour day', [
        sec('당일 순서', 'Day sequence', 0, [
          cat(
            '필수 단계',
            'Required steps',
            '가이드 앱 **투어 상세** 화면 기준입니다.',
            'Based on **tour detail** in the guide app.',
            0,
            checks([
              { ko: '출근(체크인) — 관리자 헤더 또는 지정 방법', en: 'Check in at start of shift' },
              { ko: '투어 상세 → 개요: 일정·인원·특이사항 확인', en: 'Tour detail → overview: schedule, pax, notes' },
              { ko: 'SOP 체크리스트 탭 — 출발 전 항목 완료', en: 'SOP checklist tab — before departure' },
              { ko: '픽업 순서·호텔·잔액 수금 확인', en: 'Pickup order, hotels, balance collection' },
              { ko: '투어 채팅 — 고객/OP 소통', en: 'Tour chat with customers/OP' },
              { ko: '현장 사진 업로드 (필수 장소)', en: 'Upload required location photos' },
              { ko: '지출·팁 기록 (해당 시)', en: 'Log expenses/tips if applicable' },
              { ko: '투어 리포트 작성·제출', en: 'Submit tour report' },
              { ko: 'SOP 체크리스트 — 종료 항목 완료', en: 'Complete end-of-tour SOP items' },
            ])
          ),
        ]),
      ])
    ),

    seed(
      'guide-pickup-procedure',
      '픽업 · 고객 만남 절차',
      'Pickup & guest meeting',
      '호텔 로obby·시간·명단·No-show',
      'Lobby, timing, manifest, no-show',
      'guide',
      'playbook',
      ['guide', 'driver'],
      10,
      doc('픽업 절차', 'Pickup procedure', [
        sec('표준', 'Standard', 0, [
          cat(
            '현장 규칙',
            'Field rules',
            '- 픽업 **5~10분 전** 로비 도착\n- **명판·회사 로고** 확인 가능하게\n- 예약명단과 **인원·성함** 호명\n- **No-show 10~15분** 대기 후 OP 연락\n- 잔액 있으면 **영수·명확한 금액** 안내',
            '- Arrive lobby **5–10 min early**\n- Visible **sign/company branding**\n- Call names vs manifest\n- **No-show: wait 10–15 min**, then call OP\n- State **balance due** clearly with receipt',
            0,
            checks([
              { ko: '휠체어·유아 동반 확인', en: 'Confirm wheelchair/infant needs' },
              { ko: '추가 인원 현장 요청 시 OP 승인 없이 확정 금지', en: 'No extra pax without OP approval' },
            ])
          ),
        ]),
      ])
    ),

    seed(
      'guide-balance-tips',
      '잔액 · 팁 수금',
      'Balance & tips collection',
      'Balance 봉투·현금/카드·팁 안내',
      'Balance envelope, cash/card, tipping guidance',
      'guide',
      'playbook',
      ['guide', 'driver'],
      20,
      doc('잔액 · 팁', 'Balance & tips', [
        sec('수금', 'Collection', 0, [
          cat(
            '가이드 안내',
            'Guide instructions',
            '앱 **픽업** 탭 Balance 표시와 **Balance 봉투** 모달 금액이 일치해야 합니다.\n\n- **현금** 선호 시 잔돈 준비 여부 OP 확인\n- **카드** 가능 상품만 카드 안내\n- **팁**은 강요 금지 — 회사 정책 문구 사용',
            'App **Pickup** balance must match **Balance envelope** modal.\n\n- Confirm change if cash preferred\n- Card only where product allows\n- **No tip pressure** — use company policy wording',
            0,
            checks([
              { ko: '수금 후 시스템 반영 여부 OP에 보고(해당 시)', en: 'Report collection to OP if system update needed' },
              { ko: '분쟁 시 현장 결정 대신 OP 연락', en: 'Disputes: call OP, don’t decide alone' },
            ])
          ),
        ]),
      ])
    ),

    seed(
      'guide-field-faq',
      '가이드 현장 FAQ',
      'Guide field FAQ',
      '자주 묻는 현장 질문과 표준 답변',
      'Common field Q&A and standard answers',
      'guide',
      'reference',
      ['guide', 'driver'],
      30,
      doc('현장 FAQ', 'Field FAQ', [
        sec('FAQ', 'FAQ', 0, [
          cat(
            'Q&A',
            'Q&A',
            '**Q. 픽업 시간을 못 맞췄어요.**\nA. OP 즉시 연락 → 고객에게 지연 SMS/채팅 → 다음 픽업 일정 조정\n\n**Q. 고객이 옵션을 현장에서 추가하고 싶어해요.**\nA. OP 승인 후 Pricing 반영 — 승인 전 “불가” 단정 금지\n\n**Q. 날씨로 일정 변경?**\nA. `workflow-tour-weather` + OP 지시 따르기\n\n**Q. 차량 고장?**\nA. 안전 확보 → OP → 대체 차량/일정',
            '**Q. Late for pickup?**\nA. Call OP → notify guest → adjust route\n\n**Q. Guest wants add-on on site?**\nA. OP approval before confirming\n\n**Q. Weather change?**\nA. Follow weather workflow + OP direction\n\n**Q. Vehicle breakdown?**\nA. Safety first → OP → backup vehicle/schedule',
            0
          ),
        ]),
      ])
    ),

    seed(
      'guide-incident-report',
      '현장 사고 · 이슈 보고',
      'Incidents & issue reporting',
      '부상·분실·분쟁·차량 사고 보고 경로',
      'Injury, loss, dispute, vehicle — reporting',
      'guide',
      'playbook',
      ['guide', 'driver'],
      40,
      doc('이슈 보고', 'Issue reporting', [
        sec('보고', 'Reporting', 0, [
          cat(
            '즉시 보고 대상',
            'Report immediately',
            '1. **인명 사고** — 911 필요 시 먼저, parallel OP\n2. **고객 분실·도난** — 경찰 필요 여부 OP 판단\n3. **성희롱·차별** — OP Super + office manager\n4. **차량 사고** — 보험·사진·목격자',
            '1. **Injury** — 911 first if needed, parallel OP\n2. **Loss/theft** — OP decides police\n3. **Harassment/discrimination** — OP Super + office manager\n4. **Vehicle accident** — insurance, photos, witnesses',
            0,
            checks([
              { ko: '투어 채팅·전화 기록 보존', en: 'Preserve chat/call records' },
              { ko: '팀보드 Issue 또는 리포트에 사실만 기록', en: 'Log facts in issue/report' },
            ])
          ),
        ]),
      ])
    ),

    // ─── 시스템 ───
    seed(
      'system-admin-reservation',
      '관리자 — 예약 관리 화면',
      'Admin — reservation management',
      '예약 목록·상세·Pricing·Follow-up·처리 필요 큐',
      'List, detail, pricing, follow-up, action queues',
      'system',
      'system_guide',
      ['op', 'office manager', 'office'],
      0,
      reservationAdminManualDocument
    ),

    seed(
      'system-admin-products-home-sections',
      '관리자 — 홈 Destinations·Adventure 상품 노출',
      'Admin — home Destinations & Adventure visibility',
      'Explore Top Destinations / Choose Your Adventure에 상품이 보이게 태그 설정',
      'Tag products so they appear under Explore Top Destinations / Choose Your Adventure',
      'system',
      'system_guide',
      ['op', 'office manager', 'office'],
      5,
      productsHomeSectionsManualDocument
    ),

    seed(
      'system-admin-tour-detail',
      '관리자 — 투어 상세 화면',
      'Admin — tour detail',
      '개요·픽업·예약·SOP체크·채팅·정산 탭',
      'Overview, pickup, bookings, SOP, chat, settlement tabs',
      'system',
      'system_guide',
      ['op', 'super', 'office manager'],
      10,
      doc('투어 상세', 'Tour detail admin', [
        sec('탭 설명', 'Tabs', 0, [
          cat(
            '탭별 용도',
            'Tab purposes',
            '| 탭 | 용도 |\n|-----|------|\n| 개요 | 가이드·차량·일정·메모 |\n| 픽업 | 호텔별 시간·지도·스케줄 발송 |\n| 예약 | 연결된 예약·인원 |\n| SOP 체크 | 가이드 이행 현황(관리자) |\n| 채팅 | 투어 단체 채팅 |\n| 정산 | 지출·팁·매출 스냅샷 |',
            '| Tab | Use |\n|-----|-----|\n| Overview | guide, vehicle, schedule, notes |\n| Pickup | hotels, times, map, send schedule |\n| Bookings | linked reservations, pax |\n| SOP check | guide completion (admin) |\n| Chat | group tour chat |\n| Settlement | expenses, tips, revenue |',
            0
          ),
        ]),
      ])
    ),

    seed(
      'system-admin-pickup-hotels',
      '관리자 — 픽업 호텔 관리',
      'Admin — pickup hotels',
      '호텔 DB·그룹·지도·대표 픽업 preset',
      'Hotel DB, groups, map, pickup presets',
      'system',
      'system_guide',
      ['op', 'super'],
      20,
      doc('픽업 호텔', 'Pickup hotels', [
        sec('관리', 'Management', 0, [
          cat(
            '작업',
            'Tasks',
            '**관리자 > 픽업 호텔**에서 호텔 주소·픽업 위치 사진·그룹 번호 관리.\n\n- 신규 호텔: 주소 geocode 확인\n- **그룹 preset**: 자주 쓰는 호텔 묶음 저장\n- 투어에서 **대표 픽업** 사용 시 preset 연결',
            '**Admin > Pickup hotels** — address, pickup photo, group number.\n\n- New hotel: verify geocode\n- **Group presets** for common sets\n- Link preset when tour uses **representative pickup**',
            0
          ),
        ]),
      ])
    ),

    seed(
      'system-guide-app-overview',
      '가이드 앱 — 전체 사용법',
      'Guide app overview',
      '하단 탭·투어·채팅·팀보드·매뉴얼',
      'Footer tabs: tours, chat, team board, manual',
      'system',
      'system_guide',
      ['guide', 'driver'],
      0,
      doc('가이드 앱', 'Guide app', [
        sec('네비게이션', 'Navigation', 0, [
          cat(
            '하단 탭',
            'Footer tabs',
            '| 탭 | 기능 |\n|-----|------|\n| 홈 | 대시보드 |\n| 투어 | 캘린더·당일 투어 상세 |\n| 채팅 | 투어·팀 채팅 |\n| 매뉴얼 | **운영 허브** (본 문서 모음) |\n| 투어 자료 | PDF·브리핑 자료 |',
            '| Tab | Function |\n|-----|----------|\n| Home | dashboard |\n| Tours | calendar & tour detail |\n| Chat | tour & team chat |\n| Manual | **Operations hub** |\n| Materials | PDFs & briefings |',
            0,
            checks([
              { ko: '오프라인 시 캐시된 투어 스냅샷 확인', en: 'Offline: cached tour snapshot' },
              { ko: '푸시 알림 허용 (픽업·채팅·SOP)', en: 'Enable push (pickup, chat, SOP)' },
            ])
          ),
        ]),
      ])
    ),

    seed(
      'system-team-board-guide',
      '팀보드 — 가이드 사용법',
      'Team board for guides',
      '공지 확인·OP Todo·이슈 등록',
      'Announcements, OP todos, issues',
      'system',
      'system_guide',
      ['guide', 'driver', 'office', 'op'],
      10,
      doc('팀보드', 'Team board', [
        sec('기능', 'Features', 0, [
          cat(
            '가이드가 쓰는 기능',
            'What guides use',
            '- **공지**: 확인 버튼 필수 — 미확인 시 헤더 배지\n- **OP Todo**: 본인/공통 체크리스트 — 일·주·월 주기\n- **Issue**: 현장 문제·개선 제안 등록\n\n매일 출근 후 **팀보드** 먼저 확인하는 습관 권장.',
            '- **Announcements**: must acknowledge — badge if pending\n- **OP Todo**: personal/common checklists — daily/weekly/monthly\n- **Issues**: field problems or improvement ideas\n\nHabit: check **team board** after check-in.',
            0
          ),
        ]),
      ])
    ),

    seed(
      'system-gmail-reservation-import',
      'Gmail 예약 import',
      'Gmail reservation import',
      '이메일 예약 자동/수동 import·중복 확인',
      'Auto/manual email import, duplicate check',
      'system',
      'system_guide',
      ['op', 'office manager', 'office'],
      30,
      doc('Gmail import', 'Gmail import', [
        sec('절차', 'Procedure', 0, [
          cat(
            'import 후',
            'After import',
            '1. import 큐에서 **신규** 예약 확인\n2. **중복** 검색 (동일 이메일·날짜)\n3. 상품·인원·가격 **수동 보정**\n4. 확정 워크플로로 연결',
            '1. Review **new** items in import queue\n2. **Duplicate** search (same email/date)\n3. **Fix** product, pax, pricing\n4. Continue to confirmation workflow',
            0
          ),
        ]),
      ])
    ),

    // ─── 사무 · 회계 ───
    seed(
      'office-daily-opening',
      '사무 — 일일 오픈 루틴',
      'Office daily opening',
      '출근 후 이메일·import·당일 투어·Todo',
      'Email, import, today’s tours, todos',
      'office',
      'playbook',
      ['office', 'office manager'],
      0,
      doc('일일 오픈', 'Daily opening', [
        sec('오전 루틴', 'Morning routine', 0, [
          cat(
            '체크리스트',
            'Checklist',
            'Las Vegas 기준 업무 시작 시 (팀보드 OP Todo **Daily** 와 동일하게 유지).',
            'At start of shift (align with team-board **Daily** OP todos).',
            0,
            checks([
              { ko: '이메일·OTA 알림 확인', en: 'Check email & OTA notifications' },
              { ko: 'Gmail import 큐 처리', en: 'Process Gmail import queue' },
              { ko: '당일·익일 투어 인원·미연결 예약', en: 'Today/tomorrow tours & unlinked bookings' },
              { ko: '팀보드 공지·Todo 확인', en: 'Team board announcements & todos' },
              { ko: '전날 미완료 이슈 follow-up', en: 'Follow up yesterday’s open issues' },
            ])
          ),
        ]),
      ])
    ),

    seed(
      'office-weekly-settlement',
      '주간 정산 · 마감',
      'Weekly settlement',
      '매출·지출·채널별·가이드비 정리',
      'Revenue, expenses, by channel, guide fees',
      'office',
      'playbook',
      ['office', 'office manager'],
      10,
      doc('주간 정산', 'Weekly settlement', [
        sec('마감', 'Closing', 0, [
          cat(
            '주간 작업',
            'Weekly tasks',
            '보통 **금요일 또는 월요일** 마감 (회사 일정에 맞게 수정).\n\n1. 완료 투어 Pricing 스냅샷 검토\n2. 미수금·환불 pending 목록\n3. 가이드비·팁 쉐어 리포트\n4. 채널별 매출 export\n5. 이상치 OP와 cross-check',
            'Usually close **Friday or Monday** (adjust to company calendar).\n\n1. Review completed tour Pricing snapshots\n2. Outstanding balances & pending refunds\n3. Guide fee & tip share reports\n4. Export revenue by channel\n5. Cross-check anomalies with OP',
            0,
            checks([
              { ko: '팀보드 Weekly Todo 전 항목 완료', en: 'Complete all team-board weekly todos' },
              { ko: '정산 시트·회계 시스템 입력', en: 'Enter accounting system / sheet' },
            ])
          ),
        ]),
      ])
    ),

    seed(
      'office-expense-entry',
      '투어 · 회사 지출 입력',
      'Expense entry',
      '가이드 지출·회사비·영수증 규칙',
      'Guide expenses, company costs, receipts',
      'office',
      'playbook',
      ['office', 'office manager', 'op'],
      20,
      doc('지출 입력', 'Expense entry', [
        sec('규칙', 'Rules', 0, [
          cat(
            '입력 기준',
            'Entry standards',
            '- **투어 지출**: 가이드 제출 + 영수증 사진\n- **회사 지출**: vehicle maintenance, 사무용품 등\n- 승인 한도 초과 시 **office manager** 사전 승인\n- 통화·환율은 Pricing과 동일 기준',
            '- **Tour expenses**: guide submission + receipt photo\n- **Company expenses**: vehicle, office supplies, etc.\n- Over limit: **office manager** pre-approval\n- Currency/rates same as Pricing',
            0
          ),
        ]),
      ])
    ),

    // ─── 기타 · 비상 ───
    seed(
      'escalation-contact-matrix',
      '에스컬레이션 · 연락 매트릭스',
      'Escalation contact matrix',
      '상황별 1차·2차 담당자·연락처',
      'Primary/secondary contacts by situation',
      'other',
      'reference',
      [],
      0,
      doc('연락 매트릭스', 'Contact matrix', [
        sec('매트릭스', 'Matrix', 0, [
          cat(
            '상황별',
            'By situation',
            '| 상황 | 1차 | 2차 |\n|------|-----|-----|\n| 당일 픽업 지연 | OP 당번 | OP Super |\n| 가이드 No-show | OP Super | office manager |\n| 고객 부상 | 911 → OP Super | office manager |\n| 환불·클레임 | office manager | OP Super |\n| 시스템 장애 | OP Super | 개발/IT |\n| 언론·SNS 위기 | office manager | 대표 |\n\n※ 실제 이름·전화번호는 아래에 최신 유지',
            '| Situation | 1st | 2nd |\n|-----------|-----|-----|\n| Same-day pickup delay | OP on duty | OP Super |\n| Guide no-show | OP Super | office manager |\n| Guest injury | 911 → OP Super | office manager |\n| Refund/claim | office manager | OP Super |\n| System outage | OP Super | dev/IT |\n| PR/SNS crisis | office manager | CEO |\n\n※ Keep real names & phones updated below',
            0,
            checks([
              { ko: '분기 1회 연락처 검증', en: 'Verify contacts quarterly' },
              { ko: '당직 OP 표 업데이트', en: 'Update OP on-duty roster' },
            ])
          ),
        ]),
      ])
    ),

    seed(
      'workflow-tour-weather',
      '악천후 · 일정 변경',
      'Weather & schedule changes',
      '폭우·폭설·극한 기온 시 OP·고객·가이드',
      'Heavy rain/snow/extreme temps — OP, guest, guide',
      'tour_ops',
      'playbook',
      ['op', 'super', 'guide', 'driver'],
      40,
      doc('악천후', 'Weather changes', [
        sec('절차', 'Procedure', 0, [
          cat(
            '단계',
            'Steps',
            '1. **가이드/OP** 현장·예보 확인\n2. **안전 우선** — 진행 불가 시 중단·대체 일정\n3. **고객 전원** 채팅/문자 — 일정·환불·연기 옵션\n4. **예약·투어 상태** 시스템 반영\n5. **SOP·계약**상 환불/재예약 정책 적용',
            '1. **Guide/OP** check conditions & forecast\n2. **Safety first** — cancel/postpone if unsafe\n3. **Notify all guests** — options: reschedule/refund\n4. Update **booking/tour status** in system\n5. Apply **SOP/contract** refund/rebook policy',
            0
          ),
        ]),
      ])
    ),

    seed(
      'reference-glossary',
      '용어 · 약어 사전',
      'Glossary & abbreviations',
      'OP·Pax·OTA·Balance·SOP 등 사내 용어',
      'OP, pax, OTA, balance, SOP, etc.',
      'other',
      'reference',
      [],
      10,
      doc('용어 사전', 'Glossary', [
        sec('용어', 'Terms', 0, [
          cat(
            '자주 쓰는 말',
            'Common terms',
            '| 용어 | 설명 |\n|------|------|\n| OP | Operations — 투어 운영·배정 |\n| Pax | 승객/인원 수 |\n| OTA | Online Travel Agency (Klook, Viator 등) |\n| Balance | 현장 수금 잔액 |\n| SOP | Standard Operating Procedure — 회사 규정 |\n| Pickup preset | 대표 픽업 호텔 묶음 |\n| Pricing ④ | 예약 화면 운영이익 섹션 |',
            '| Term | Meaning |\n|------|--------|\n| OP | Operations — tour ops & assignment |\n| Pax | Passenger count |\n| OTA | Online travel agency |\n| Balance | Amount due on site |\n| SOP | Standard operating procedure |\n| Pickup preset | Grouped representative hotels |\n| Pricing ④ | Operating profit section |',
            0
          ),
        ]),
      ])
    ),
  ]
}

/** 내장 템플릿 slug 목록 (덮어쓰기 대상) */
export function defaultKnowledgeArticleSeedSlugs(): string[] {
  return defaultKnowledgeArticleSeeds().map((s) => s.slug)
}
