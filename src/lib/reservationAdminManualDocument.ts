import { newSopId, prefillSortOrders, type SopCategory, type SopChecklistItem, type SopDocument, type SopSection } from '@/types/sopStructure'

export const RESERVATION_ADMIN_MANUAL_SLUG = 'system-admin-reservation'

function checks(items: Array<{ ko: string; en: string }>): SopChecklistItem[] {
  const ids = items.map(() => newSopId())
  return items.map((it, i) => ({
    id: ids[i]!,
    title_ko: it.ko,
    title_en: it.en,
    sort_order: i,
    parent_id: null,
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

function sec(title_ko: string, title_en: string, sort_order: number, categories: SopCategory[]): SopSection {
  return { id: newSopId(), title_ko, title_en, sort_order, categories }
}

const OPERATIONS_CHECKLIST = checks([
  { ko: '상태 변경 시 감사 로그 확인 (필요 시)', en: 'Check audit log on status change when needed' },
  { ko: 'Pricing 저장 전 숫자·산식 재확인', en: 'Recheck numbers and formulas before saving Pricing' },
  { ko: 'Follow-up: 컨펌 → 거주(해당 시) → 출발 → 픽업 순서 점검', en: 'Follow-up order: confirm → resident → departure → pickup' },
  { ko: '확정 전 pending 예약 — 투어일 7일 이내 건 우선 처리', en: 'Prioritize pending bookings within 7 days of tour date' },
  { ko: '취소 건 — 입금·환불·Balance 탭에서 정리 완료 확인', en: 'Cancelled bookings — verify cleanup in deposit/refund/Balance tabs' },
  { ko: 'Mania Tour/Service 확정 건 — 투어 배정 여부 확인', en: 'Confirm tour assignment for Mania Tour/Service confirmed bookings' },
  { ko: '미완성 초안 — 수정 이어쓰기 또는 삭제', en: 'Incomplete drafts — continue editing or delete' },
])

/** 예약 관리 화면 시스템 가이드 — 운영 허브 템플릿·페이지 메뉴얼 모달 공용 */
export const reservationAdminManualDocument: SopDocument = prefillSortOrders({
  title_ko: '예약 관리',
  title_en: 'Reservation admin',
  sections: [
    sec('화면 개요', 'Overview', 0, [
      cat(
        '화면 개요',
        'Overview',
        '**관리자 > 예약 관리**는 예약 접수부터 확정·픽업·정산까지 운영하는 핵심 화면입니다.\n\n| 영역 | 설명 |\n|------|------|\n| **상단 헤더** | 뷰 전환, 검색, 처리 필요·Follow-up 큐, 필터, 삭제된 예약, 신규 추가 |\n| **본문** | 카드 / 달력 / 목록 뷰 + 주간 통계 패널 |\n| **예약 카드** | 한 건 요약 + 상태·가격·픽업·투어·메일 등 인라인 액션 |\n| **예약 상세** | 고객·투어·옵션·입금·Pricing·이메일/SMS·문서 |\n| **운영 큐** | 「예약 처리 필요」「Follow-up 단계」 모달 |\n\n**관련 워크플로 문서 (운영 허브 > 예약)**\n- 문의 → 견적·예약 생성\n- 예약 확정 / 취소 / 컴플레인 / 바우처·itinerary',
        '**Admin > Reservations** is the core screen for booking operations from inquiry through pickup and settlement.\n\n| Area | Description |\n|------|-------------|\n| **Header** | View switch, search, action queues, filters, deleted list, add new |\n| **Body** | Card / calendar / list views + weekly stats panel |\n| **Card** | Summary + inline actions (status, pricing, pickup, tour, email) |\n| **Detail** | Customer, tour, options, payments, Pricing, email/SMS, documents |\n| **Queues** | Action required & Follow-up modals |\n\n**Related playbooks (Operations Hub > Reservation)**\n- Inquiry to quote · Booking confirm · Cancel · Complaint · Voucher/itinerary',
        0
      ),
    ]),
    sec('상단 헤더', 'Header', 1, [
      cat(
        '상단 버튼·검색',
        'Header buttons & search',
        '| 버튼 | 기능 |\n|------|------|\n| **카드 / 달력 / 목록** | 표시 방식 전환 |\n| **상세 보기 / 간단 보기** | 카드 뷰일 때만 — 카드에 보이는 정보 양 조절 |\n| **검색** | 예약번호·고객명·영문명·특별요청·상품명 검색 (Enter 또는 검색 버튼) |\n| **예약 처리 필요** | 처리가 필요한 예약 큐 (배지 = 건수) |\n| **Follow-up 단계** | 컨펌·거주·출발·픽업·취소 후 Follow-up 큐 |\n| **필터** | 상태·채널·기간·정렬·날짜 그룹·페이지당 건수 |\n| **삭제된 예약 보기** | soft-delete(status=deleted) 예약 목록 |\n| **+ 새 예약** | 신규 예약 생성 |\n\n**URL 파라미터**\n- `?add=true` — 새 예약 폼 열기\n- `?customer={고객ID}` — 특정 고객 예약만 필터\n- `/admin/reservations/[id]` — 예약 상세 화면',
        '| Button | Function |\n|--------|----------|\n| **Card / Calendar / List** | Switch view mode |\n| **Standard / Simple card** | Card density (card view only) |\n| **Search** | Reservation #, customer name, product, special requests (Enter or search button) |\n| **Action required** | Queue of reservations needing attention (badge = count) |\n| **Follow-up steps** | Confirm · resident · departure · pickup · post-cancel queues |\n| **Filter** | Status, channel, dates, sort, date groups, page size |\n| **Deleted reservations** | Soft-deleted (status=deleted) list |\n| **+ New reservation** | Create new booking |\n\n**URL parameters**\n- `?add=true` — open new reservation form\n- `?customer={customerId}` — filter by customer\n- `/admin/reservations/[id]` — reservation detail',
        0
      ),
    ]),
    sec('필터', 'Filters', 2, [
      cat(
        '필터 옵션',
        'Filter options',
        '| 항목 | 옵션 |\n|------|------|\n| **상태** | 전체 / 대기 / 확정 / 완료 / 취소 / 노쇼 / 삭제됨 / 모집 중 |\n| **채널** | 등록된 판매 채널 |\n| **기간** | 시작일 ~ 종료일 |\n| **정렬** | 등록일 / 투어일 / 고객명 / 상품명 + 오름·내림 |\n| **날짜 그룹** | 카드 뷰에서 날짜별 묶음 on/off |\n| **페이지당 건수** | 목록·카드 로드 단위 |\n\n**목록 뷰 참고:** 정렬은 **등록일 최신순 고정**. 상태·채널·기간·검색 필터만 적용됩니다.',
        '| Field | Options |\n|-------|--------|\n| **Status** | All / pending / confirmed / completed / cancelled / no_show / deleted / recruiting |\n| **Channel** | Registered sales channels |\n| **Date range** | Start ~ end date |\n| **Sort** | Created / tour date / customer / product + asc/desc |\n| **Date groups** | Group by date in card view on/off |\n| **Page size** | Items loaded per page |\n\n**List view note:** Sort is fixed to **newest created date**. Status, channel, date range, and search filters still apply.',
        0
      ),
    ]),
    sec('뷰 모드', 'View modes', 3, [
      cat(
        '카드·달력·목록',
        'Card, calendar & list',
        '### 카드 뷰 (기본)\n- 최근 주간 구간 기준, **날짜별 그룹**으로 표시\n- **상세 보기**: 상태·가격·픽업·투어·Follow-up·메일 등 풀 액션\n- **간단 보기**: 핵심 정보만, 액션은 접기/펼치기\n\n### 달력 뷰\n- 투어일 기준 월간 캘린더\n- 월 이동으로 다른 기간 탐색\n\n### 목록 뷰\n- 플랫 테이블 + 페이지네이션\n- 등록일 최신순, 필터·검색 적용\n\n### 주간 통계 패널 (카드 뷰 상단)\n- 주간 등록·취소·순인원\n- 상품·채널·상태별 집계\n- 일별 등록·취소 차트 (7일 / 월 / 년)\n- 상태 전환 버킷',
        '### Card view (default)\n- Recent week range, grouped **by date**\n- **Standard**: full actions (status, pricing, pickup, tour, follow-up, email)\n- **Simple**: core info only; actions collapse/expand\n\n### Calendar view\n- Monthly calendar by tour date\n- Navigate months to explore other periods\n\n### List view\n- Flat table + pagination\n- Newest created first; filters and search apply\n\n### Weekly stats panel (top of card view)\n- Weekly registrations, cancellations, net pax\n- Breakdown by product, channel, status\n- Daily registration/cancellation charts (7-day / month / year)\n- Status transition buckets',
        0
      ),
    ]),
    sec('예약 처리 필요', 'Action required', 4, [
      cat(
        '예약 처리 필요 큐',
        'Action required queue',
        '상단 **「예약 처리 필요」** 버튼으로 엽니다. 조건에 맞는 예약만 탭별로 모아 보여 줍니다.\n\n| 탭 | 표시 조건 (요약) |\n|----|------------------|\n| **상태** | 투어일 7일 이내 + 상태 **대기(pending)** |\n| **투어** | Mania Tour/Service + **확정** + **투어 미배정** |\n| **예약 가격** | ① 총 가격 미저장 ② DB·산식 불일치 (취소 제외) |\n| **입금** | ① 입금 있음·투어 없음 ② 확정·입금 없음 |\n| **취소** | 취소 건 중 환불·가격 정리 미완 |\n| **Balance** | 지난 투어 + 잔액 이슈 (취소 잔존 / 미입금 / 계산 틀림) |\n| **미완성 초안** | 고객·상품·투어 비어 있는 pending 행 |\n\n**뷰 모드:** 카드 / 테이블 / **한 건씩** (상세 폼 + 이전·다음·스와이프)\n\n**Balance 탭 하위:** 취소된 예약 · 발란스 미입금 · 발란스 계산 틀림\n\n**예약 가격 탭 하위:** 총 가격 미저장 · 산식 불일치',
        'Opened via **Action required** in the header. Shows matching reservations by tab.\n\n| Tab | Condition (summary) |\n|-----|---------------------|\n| **Status** | Tour within 7 days + **pending** |\n| **Tour** | Mania Tour/Service + **confirmed** + **unassigned** |\n| **Pricing** | ① No saved total ② DB/formula mismatch (excl. cancelled) |\n| **Deposit** | ① Payment but no tour ② Confirmed but no payment |\n| **Cancel** | Cancelled with incomplete refund/pricing cleanup |\n| **Balance** | Past tour + balance issues |\n| **Incomplete draft** | Pending row with empty customer/product/tour |\n\n**View modes:** card / table / **one-at-a-time** (detail form + prev/next/swipe)\n\n**Balance sub-tabs:** cancelled · unpaid balance · balance calc wrong\n\n**Pricing sub-tabs:** no saved total · formula mismatch',
        0
      ),
    ]),
    sec('Follow-up 단계', 'Follow-up', 5, [
      cat(
        'Follow-up 파이프라인',
        'Follow-up pipeline',
        '상단 **「Follow-up 단계」** 버튼으로 엽니다.\n\n**이상적 순서:** 예약 확인 → 거주·패스(해당 상품) → 출발 확정 → 픽업  \n※ 출발 확정 메일은 컨펌·거주 전에도 가능. 발송 시 예약 확인 단계는 완료 처리.  \n※ 거주·패스 안내는 **반드시 별도** 발송.\n\n| 탭 | 내용 |\n|----|------|\n| **① 컨펌 메일** | 예약 확인 이메일(또는 동등 연락) 미발송 |\n| **② 거주·패스** | NPS 거주 상품 — 안내 미발송 또는 고객 응답 미완 |\n| **③ 출발 확정** | 출발 확정 메일 미발송 |\n| **④ 픽업** | 투어 48시간 이내 + 픽업 노티 미발송 |\n| **⑤ 취소 후 Follow-up** | 취소 + 투어일 남음 — 취소일 기준 그룹 |\n\n**카드 아이콘 조작**\n- **좌클릭:** 이메일 미리보기\n- **우클릭:** 다른 채널로 완료 표시 / 수동 완료 취소\n\n**⑤ 취소 탭**\n- 📞 전화 아이콘: 취소 안내·Follow-up 완료\n- 🌐 지구본 아이콘: 홈페이지 재예약 권유 연락 완료',
        'Opened via **Follow-up steps** in the header.\n\n**Ideal order:** booking confirm → resident/pass (if applicable) → departure confirm → pickup  \n※ Departure email can be sent before confirm/resident. Sending marks confirm step complete.  \n※ Resident/pass notice must be sent **separately**.\n\n| Tab | Content |\n|-----|--------|\n| **① Confirm email** | Booking confirmation not sent |\n| **② Resident/pass** | NPS resident product — notice not sent or customer response incomplete |\n| **③ Departure** | Departure confirmation email not sent |\n| **④ Pickup** | Within 48h of tour + pickup notification not sent |\n| **⑤ Post-cancel follow-up** | Cancelled + tour date remains — grouped by cancel date |\n\n**Card icon actions**\n- **Left-click:** email preview\n- **Right-click:** mark complete via other channel / clear manual mark\n\n**⑤ Cancel tab**\n- 📞 Phone icon: cancel notice & follow-up complete\n- 🌐 Globe icon: rebooking outreach complete',
        0
      ),
    ]),
    sec('예약 카드 액션', 'Card actions', 6, [
      cat(
        '카드에서 할 수 있는 작업',
        'Actions from the card',
        '카드(상세/간단)에서 바로 처리할 수 있는 주요 액션입니다.\n\n| 액션 | 용도 |\n|------|------|\n| **상태 변경** | 문의 / 대기 / 확정 / 완료 / 취소 등 |\n| **가격 정보** | Pricing 요약·모달 |\n| **픽업 시간·호텔** | 픽업 정보 확인·수정 |\n| **투어 생성 / 투어 상세** | 배정·투어 정보 |\n| **입금 내역** | 결제·보증금 기록 |\n| **고객 보기** | 고객 프로필 |\n| **인쇄** | 예약 인쇄 |\n| **Follow-up 아이콘** | ①~④ 단계 진행 상태 |\n| **리뷰 관리** | 게스트 리뷰 |\n| **이메일** | 확정 / 출발 / 픽업 / 거주문의 + 발송 로그 |\n| **SMS** | 간단 카드에서 문자 발송 |\n| **영수증** | 고객 영수증 |\n| **예약 수정** | 상세 폼 이동 |\n\n**카드 표시 정보:** 채널, 인원, Choices 뱃지, 가이드·차량 요약, 취소 사유 등',
        'Main actions available directly from standard/simple cards.\n\n| Action | Use |\n|--------|-----|\n| **Change status** | inquiry / pending / confirmed / completed / cancelled |\n| **Pricing info** | Pricing summary modal |\n| **Pickup time & hotel** | View/edit pickup |\n| **Create tour / tour detail** | Assignment & tour info |\n| **Payment records** | Deposits & payments |\n| **View customer** | Customer profile |\n| **Print** | Print reservation |\n| **Follow-up icons** | Steps ①–④ progress |\n| **Review management** | Guest reviews |\n| **Email** | confirm / departure / pickup / resident + send logs |\n| **SMS** | Send SMS (simple card) |\n| **Receipt** | Customer receipt |\n| **Edit reservation** | Open detail form |\n\n**Card display:** channel, pax, Choices badges, guide/vehicle summary, cancel reason, etc.',
        0
      ),
    ]),
    sec('예약 상세 폼', 'Detail form', 7, [
      cat(
        '예약 상세·신규 생성',
        'Detail & new reservation',
        '**+ 새 예약** 또는 카드 **수정**으로 진입합니다.\n\n| 섹션 | 내용 |\n|------|------|\n| **고객 정보** | 이름·연락처·호텔·특이사항, 고객 연결/신규 |\n| **Follow-up** | 컨펌·거주·출발·픽업 진행 + 이메일 발송 |\n| **상태** | 예약 상태·취소 사유 |\n| **투어 정보** | 투어일·시간·채널·픽업 |\n| **인원** | 성인·아동·유아 (거주 상품 시 추가 필드) |\n| **투어 연결** | 배정된 투어 선택·생성 |\n| **Choices** | 상품 옵션·식사·입장권 선택 |\n| **예약 옵션** | 추가 옵션 행 (수량·단가·상태) |\n| **입금 내역** | 보증금·잔금·결제 기록 |\n| **Pricing (가격 정보)** | 매출·수수료·할인·환불·잔액·채널 정산 |\n| **이메일 / SMS** | 각종 고객 연락 + 발송 로그 |\n| **문서** | itinerary·바우처·영수증 |\n\n**저장 시 주의**\n- Pricing 저장 전 숫자·산식 재확인\n- 상태 변경 시 필요하면 감사 로그 확인\n- 편집 중 다른 사용자 변경 시 알림 표시',
        'Enter via **+ New reservation** or **Edit** on a card.\n\n| Section | Content |\n|---------|--------|\n| **Customer** | Name, contact, hotel, notes; link or create customer |\n| **Follow-up** | Confirm · resident · departure · pickup + emails |\n| **Status** | Reservation status & cancel reason |\n| **Tour info** | Tour date, time, channel, pickup |\n| **Pax** | Adults/children/infants (+ resident fields if applicable) |\n| **Tour link** | Select or create assigned tour |\n| **Choices** | Product options, meals, tickets |\n| **Add-on options** | Extra option rows (qty, price, status) |\n| **Payments** | Deposits, balance, payment records |\n| **Pricing** | Revenue, fees, discounts, refund, balance, channel settlement |\n| **Email / SMS** | Customer comms + send logs |\n| **Documents** | Itinerary, voucher, receipt |\n\n**Before saving**\n- Recheck Pricing numbers and formulas\n- Check audit log on status change if needed\n- Alert shown when another user changed the record',
        0
      ),
    ]),
    sec('Pricing (가격 정보)', 'Pricing', 8, [
      cat(
        'Pricing 핵심',
        'Pricing essentials',
        '| 항목 | 설명 |\n|------|------|\n| **상품 가격** | effective product_price_total, 인원·미포함 반영 |\n| **Choices** | 옵션 합계 (색상 뱃지 = 그룹별) |\n| **할인·추가** | 쿠폰, 추가비용, 세금, 카드수수료, 팁 등 |\n| **총액 (total_price)** | DB 저장값 — 산식과 일치해야 함 |\n| **보증금·잔액** | 입금 집계와 연동 |\n| **채널 정산** | commission, OTA 정산, 총매출, 운영이익 |\n| **환불** | 취소 시 환불 금액 |\n\n**처리 필요 > 예약 가격 / Balance** 탭에서 DB·산식 불일치 건을 일괄 점검할 수 있습니다.',
        '| Item | Description |\n|------|-------------|\n| **Product price** | effective product_price_total, pax & exclusions |\n| **Choices** | Option totals (color badges = by group) |\n| **Discounts & extras** | Coupons, extras, tax, card fees, tips, etc. |\n| **Total (total_price)** | DB value — must match formula |\n| **Deposit & balance** | Linked to payment aggregates |\n| **Channel settlement** | Commission, OTA settlement, gross revenue, operating profit |\n| **Refund** | Refund amount on cancellation |\n\nUse **Action required > Pricing / Balance** tabs to review DB/formula mismatches in bulk.',
        0
      ),
    ]),
    sec('연관 기능', 'Related', 9, [
      cat(
        '연관 메뉴·문서',
        'Related menus & docs',
        '| 기능 | 위치 / 문서 |\n|------|-------------|\n| **Gmail 예약 가져오기** | system-gmail-reservation-import |\n| **투어 상세** | system-admin-tour-detail (배정 후) |\n| **픽업 호텔 DB** | system-admin-pickup-hotels |\n| **고객 관리** | 고객 페이지 → 해당 고객 예약 필터로 이동 |\n| **예약 통계** | `/admin/reservations/statistics` |\n| **삭제된 예약** | 헤더 휴지통 — 복구·영구 삭제 |',
        '| Feature | Location / doc |\n|---------|----------------|\n| **Gmail import** | system-gmail-reservation-import |\n| **Tour detail** | system-admin-tour-detail (after assignment) |\n| **Pickup hotels** | system-admin-pickup-hotels |\n| **Customer management** | Customer page → filter reservations by customer |\n| **Reservation statistics** | `/admin/reservations/statistics` |\n| **Deleted reservations** | Header trash icon — restore or permanent delete |',
        0,
        OPERATIONS_CHECKLIST
      ),
    ]),
  ],
})

export const reservationAdminManualTitles = {
  ko: '관리자 — 예약 관리 화면',
  en: 'Admin — reservation management',
} as const
