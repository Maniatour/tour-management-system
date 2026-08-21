export type AdminTodoListManualSection = {
  id: string
  titleKo: string
  titleEn: string
  categoryKo: string
  categoryEn: string
  departmentKo?: string
  departmentEn?: string
  filterLinesKo: string[]
  filterLinesEn: string[]
  workflowLinesKo?: string[]
  workflowLinesEn?: string[]
  completeKo: string
  completeEn: string
}

export type AdminTodoListManualIntro = {
  titleKo: string
  titleEn: string
  listFiltersKo: string[]
  listFiltersEn: string[]
}

export const ADMIN_TODO_LIST_MANUAL_INTRO: AdminTodoListManualIntro = {
  titleKo: 'Todo List 매뉴얼',
  titleEn: 'Todo List manual',
  listFiltersKo: [
    '부서 필터(전체 / Office / Guide / 공통): 사용자 정의 Todo(op_todos)만 필터링합니다. 고정 업무 패널은 항상 일일 영역에 표시됩니다.',
    '동일 제목의 DB Todo가 있으면 고정 패널과 중복되지 않도록 칩 목록에서 숨깁니다(고정 패널이 우선).',
    '모든 날짜·기간 기준은 라스베가스(Pacific) 현지 시간입니다.',
  ],
  listFiltersEn: [
    'Department filter (All / Office / Guide / Common) applies to custom DB todos only. Built-in panels always appear in the daily section.',
    'If a DB todo has the same title as a built-in panel, the chip is hidden to avoid duplication (the panel takes priority).',
    'All dates and ranges use Las Vegas (Pacific) local time.',
  ],
}

export const ADMIN_TODO_LIST_MANUAL_SECTIONS: AdminTodoListManualSection[] = [
  {
    id: 'tour-envelope-print',
    titleKo: '투어 봉투 프린트',
    titleEn: 'Tour envelope print',
    categoryKo: '일일 · 고정 패널',
    categoryEn: 'Daily · built-in panel',
    departmentKo: '공통',
    departmentEn: 'Common',
    filterLinesKo: [
      '투어일 = 오늘 + 1일(내일 출발, LA 기준 D+1).',
      '취소·삭제된 투어 제외.',
      '배정된 예약이 있는 활성 투어만 표시.',
    ],
    filterLinesEn: [
      'Tour date = today + 1 day (tomorrow departures, LA D+1).',
      'Excludes cancelled or deleted tours.',
      'Shows active tours with assigned reservations.',
    ],
    completeKo: '각 투어별 완료/보류 처리 또는 연결된 DB Todo 완료. 당일 로컬 저장 키로 진행률 관리.',
    completeEn: 'Mark each tour done/on hold, or complete the linked DB todo. Progress stored per day in local storage.',
  },
  {
    id: 'pickup-notification',
    titleKo: 'Pick up Notification',
    titleEn: 'Pick up Notification',
    categoryKo: '일일 · 고정 패널',
    categoryEn: 'Daily · built-in panel',
    departmentKo: '공통',
    departmentEn: 'Common',
    filterLinesKo: [
      '오늘 ~ +3일 범위의 투어 조회.',
      '투어 시작 48시간 이내(현지 기준)인 투어만 표시.',
      '취소·삭제된 투어 제외.',
    ],
    filterLinesEn: [
      'Tours from today through +3 days.',
      'Only tours within 48 hours before start (local time).',
      'Excludes cancelled or deleted tours.',
    ],
    completeKo: '투어별 픽업 알림 발송·완료 표시 또는 연결 DB Todo 완료.',
    completeEn: 'Send pickup notice per tour and mark done, or complete the linked DB todo.',
  },
  {
    id: 'guide-schedule-confirm',
    titleKo: '가이드와 스케줄 컨펌',
    titleEn: 'Guide & schedule confirm',
    categoryKo: '일일 · 고정 패널',
    categoryEn: 'Daily · built-in panel',
    departmentKo: 'Guide',
    departmentEn: 'Guide',
    filterLinesKo: [
      '투어일 = 내일·모레(D+1, D+2, LA 기준).',
      '취소·삭제된 투어 제외.',
    ],
    filterLinesEn: [
      'Tour dates = tomorrow and day after (D+1, D+2, LA).',
      'Excludes cancelled or deleted tours.',
    ],
    completeKo: '가이드/어시스턴트에게 스케줄 확인 메시지 발송 후 투어별 완료 처리.',
    completeEn: 'Send schedule confirmation to guide/assistant, then mark each tour done.',
  },
  {
    id: 'rental-car-pickup-dropoff',
    titleKo: '렌트카 픽드랍 안내',
    titleEn: 'Rental pickup / return notice',
    categoryKo: '일일 · 고정 패널',
    categoryEn: 'Daily · built-in panel',
    departmentKo: 'Office',
    departmentEn: 'Office',
    filterLinesKo: [
      '오늘 픽업: 렌터카 시작일 = 오늘(라스베가스 기준).',
      '오늘 반납: 렌터카 종료일 = 오늘.',
      '취소·비활성 차량 제외.',
      '픽업 안내는 렌터카 예약자(팀원)에게 발송.',
      '반납 안내는 해당 차량의 마지막 투어 가이드·드라이버에게 발송.',
      '같은 날 다른 렌터카를 계속 쓰는 팀이 있으면 공항 픽업 요청 문자를 보낼 수 있음.',
    ],
    filterLinesEn: [
      'Pickup today: rental start date = today (Las Vegas).',
      'Return today: rental end date = today.',
      'Excludes cancelled or inactive vehicles.',
      'Pickup SMS goes to the reserved team member.',
      'Return SMS goes to the last tour guide/driver on that vehicle.',
      'If another rental stays in use the same day, send an airport pickup request to that crew.',
    ],
    completeKo: '픽업·반납 안내 발송 후 차량별 완료 처리.',
    completeEn: 'Send pickup/return notices, then mark each vehicle done.',
  },
  {
    id: 'antelope-canyon-booking',
    titleKo: '앤텔롭캐년 부킹 관리',
    titleEn: 'Antelope Canyon booking management',
    categoryKo: '일일 · 고정 패널',
    categoryEn: 'Daily · built-in panel',
    departmentKo: 'Office',
    departmentEn: 'Office',
    filterLinesKo: [
      '추가·변경: 오늘 ~ +3일 투어 중 티켓/인원 불일치.',
      'Due Date: 체크인일 = 오늘 + 2일인 취소 마감 대상.',
      '취소·삭제 투어 제외.',
    ],
    filterLinesEn: [
      'Add/change: ticket or headcount mismatch on tours today through +3 days.',
      'Due date: cancel deadline with check-in = today + 2 days.',
      'Excludes cancelled/deleted tours.',
    ],
    completeKo: '각 투어(행)별 완료/보류 처리 또는 연결된 DB Todo·패널 전체 완료. 당일 로컬 저장 키로 진행률 관리.',
    completeEn: 'Mark each tour row done/on hold, or complete the linked DB todo / whole panel. Progress stored per day in local storage.',
  },
  {
    id: 'customer-info-review',
    titleKo: '고객 정보 검수',
    titleEn: 'Customer info review',
    categoryKo: '일일 · 고정 패널',
    categoryEn: 'Daily · built-in panel',
    departmentKo: 'Office',
    departmentEn: 'Office',
    filterLinesKo: [
      '투어일 = 내일·모레(D+1, D+2).',
      '취소·삭제되지 않은 투어의 활성 예약만 검사.',
      '다음 이슈가 하나라도 있으면 큐에 포함: 소통 채널이 플랫폼/답변없음, 픽업 호텔 미설정, 거주 상태별 인원 미설정(해당 상품).',
    ],
    filterLinesEn: [
      'Tour dates = tomorrow and day after (D+1, D+2).',
      'Checks active reservations on non-cancelled tours.',
      'Included if any issue: platform/no-reply channel, missing pickup hotel, or incomplete resident count (when product requires it).',
    ],
    completeKo: '이슈가 있는 예약을 모두 처리하면 해당 투어 완료.',
    completeEn: 'Mark tour done after all flagged reservations are resolved.',
  },
  {
    id: 'cancel-rebooking-follow-up',
    titleKo: '취소 고객 재예약 권유',
    titleEn: 'Cancelled customer — rebook outreach',
    categoryKo: '일일 · 고정 패널',
    categoryEn: 'Daily · built-in panel',
    departmentKo: 'Office',
    departmentEn: 'Office',
    filterLinesKo: [
      '최근 30일 이내 취소(cancelled)된 예약 후보.',
      '재예약 사유(rebooking)로 취소된 건 제외.',
      '워크플로 미완료 건만 표시.',
    ],
    filterLinesEn: [
      'Cancelled reservations updated in the last 30 days.',
      'Excludes cancellations with rebooking reason.',
      'Shows only items with incomplete workflow.',
    ],
    workflowLinesKo: [
      '① 취소 follow-up 안내 + 재예약 권유 안내(수동 완료 체크)',
      '② 고객 답변(reservation_follow_ups)',
      '③ 취소 사유 기록',
    ],
    workflowLinesEn: [
      '① Cancel follow-up + rebook outreach (manual check)',
      '② Customer reply (reservation_follow_ups)',
      '③ Cancellation reason recorded',
    ],
    completeKo: '위 3단계가 모두 완료되면 큐에서 제외.',
    completeEn: 'Removed from queue when all three steps are complete.',
  },
  {
    id: 'pending-customer-management',
    titleKo: 'Pending 고객 관리',
    titleEn: 'Pending customer management',
    categoryKo: '일일 · 고정 패널',
    categoryEn: 'Daily · built-in panel',
    departmentKo: 'Office',
    departmentEn: 'Office',
    filterLinesKo: [
      '예약 상태 = pending.',
      '투어일이 오늘 ~ +3일 이내.',
      '워크플로 미완료 건만 표시.',
    ],
    filterLinesEn: [
      'Reservation status = pending.',
      'Tour date within today through +3 days.',
      'Shows only items with incomplete workflow.',
    ],
    workflowLinesKo: [
      '① 대체 투어 안내(수동 완료)',
      '② 고객 답변',
      '③ 처리: 취소 / 날짜 변경 / 투어 변경',
    ],
    workflowLinesEn: [
      '① Alternative tour outreach (manual)',
      '② Customer reply',
      '③ Resolve: cancel / date change / tour change',
    ],
    completeKo: '안내·답변·처리(해결 종류)가 모두 기록되면 큐에서 제외.',
    completeEn: 'Removed when outreach, reply, and resolution are all recorded.',
  },
  {
    id: 'ota-closure',
    titleKo: 'OTA 마감 처리',
    titleEn: 'OTA closure',
    categoryKo: '일일 · 고정 패널',
    categoryEn: 'Daily · built-in panel',
    departmentKo: 'Office',
    departmentEn: 'Office',
    filterLinesKo: [
      '오늘 포함 앞으로 7일 일정.',
      '판매 상태가 마감(클로저) 필요한 상품·채널.',
      'OTA 잔여석이 내부 잔여석과 맞지 않아 사이트 업데이트가 필요한 리스팅.',
    ],
    filterLinesEn: [
      'Dates from today through +7 days.',
      'Products/channels that require platform closure.',
      'Listings where OTA remaining seats still need a site update vs internal capacity.',
    ],
    completeKo: '날짜·상품별 OTA 마감 동기화 완료 후 패널 완료 처리.',
    completeEn: 'Mark panel done after OTA closure is synced per date/product.',
  },
  {
    id: 'tour-hotel-management',
    titleKo: '투어 호텔 관리',
    titleEn: 'Tour hotel management',
    categoryKo: '일일 · 고정 패널',
    categoryEn: 'Daily · built-in panel',
    departmentKo: 'Office',
    departmentEn: 'Office',
    filterLinesKo: [
      '투어일: 오늘 ~ +90일.',
      '멀티데이(숙박) 상품 투어만.',
      '고객 호텔 예약(객실)이 1건 이상 있는 투어.',
      '예약된 투어 호텔 객실 수가 필요 객실 수와 불일치할 때만 표시.',
    ],
    filterLinesEn: [
      'Tour dates: today through +90 days.',
      'Multi-day (lodging) products only.',
      'Tour must have at least one customer hotel room.',
      'Shown only when booked tour-hotel rooms ≠ required room count.',
    ],
    completeKo: '호텔 부킹 수량을 맞춘 뒤 투어별 완료 처리.',
    completeEn: 'Fix hotel booking counts, then mark each tour done.',
  },
  {
    id: 'tour-hotel-price-check',
    titleKo: '투어 호텔 가격 체크',
    titleEn: 'Tour hotel price check',
    categoryKo: '일일 · 고정 패널',
    categoryEn: 'Daily · built-in panel',
    departmentKo: 'Office',
    departmentEn: 'Office',
    filterLinesKo: [
      '조회 기간: 오늘 ~ +120일.',
      '활성 tour_hotel_bookings 중 체크아웃 ≥ 오늘, 체크인 ≤ 종료일.',
      '삭제 요청·비활성 부킹 제외.',
    ],
    filterLinesEn: [
      'Range: today through +120 days.',
      'Active tour_hotel_bookings with checkout ≥ today and check-in ≤ range end.',
      'Excludes deletion-requested or inactive bookings.',
    ],
    completeKo: '가격·웹사이트 확인 후 부킹별 완료 처리.',
    completeEn: 'Verify price/website, then mark bookings done.',
  },
  {
    id: 'tour-hotel-cc-form',
    titleKo: '투어 호텔 CC Form',
    titleEn: 'Tour hotel CC Form',
    categoryKo: '일일 · 고정 패널',
    categoryEn: 'Daily · built-in panel',
    departmentKo: 'Office',
    departmentEn: 'Office',
    filterLinesKo: [
      '체크인일: 다음날(라스베가스 기준).',
      '투어 호텔 부킹 상태가 확정인 건만.',
      '삭제 요청 부킹 제외.',
      '카드에서 CC 상태(미발송·발송 완료·필요없음) 바로 수정.',
      'CC 발송 후 호텔 전화로 예약자 이름 변경 확인 → 「이름 변경 확인」.',
    ],
    filterLinesEn: [
      'Check-in: tomorrow (Las Vegas time).',
      'Confirmed tour hotel bookings only.',
      'Excludes deletion-requested bookings.',
      'Edit CC status on the card (not sent / sent / not needed).',
      'After CC send, call hotel to confirm guest name change → “Confirm name”.',
    ],
    completeKo:
      '부킹별: CC 필요없음, 또는 CC 발송 완료 + 이름 변경 확인까지 끝나면 완료. 패널 완료는 일일 체크용.',
    completeEn:
      'Per booking: done when CC is not needed, or CC sent + name-change confirmed. Panel complete is the daily checklist mark.',
  },
  {
    id: 'tour-settlement',
    titleKo: '투어 정산',
    titleEn: 'Tour settlement',
    categoryKo: '일일 · 고정 패널',
    categoryEn: 'Daily · built-in panel',
    departmentKo: 'Office',
    departmentEn: 'Office',
    filterLinesKo: [
      '정산 기준일: 어제·오늘 투어(멀티데이·숙박은 종료일 기준).',
      '취소·삭제 투어 제외.',
      '지출 미승인·반려·영수증 누락·필수 필드 누락 등 정산 검토 필요 지출이 있는 투어.',
      '야경투어·골프 예약 대행 등 일부 상품은 영수증 검사 제외.',
    ],
    filterLinesEn: [
      'Settlement date: yesterday and today (multi-day uses end date).',
      'Excludes cancelled/deleted tours.',
      'Tours with expenses needing review: pending approval, rejected, missing receipt, or missing required fields.',
      'Some products (e.g. night tour, golf agency) skip receipt checks.',
    ],
    completeKo: '모든 지출 이슈 해결 후 투어별 완료.',
    completeEn: 'Mark tour done after all expense issues are resolved.',
  },
  {
    id: 'reservation-agency-management',
    titleKo: '예약 대행 관리',
    titleEn: 'Reservation agency management',
    categoryKo: '일일 · 고정 패널',
    categoryEn: 'Daily · built-in panel',
    departmentKo: 'Office',
    departmentEn: 'Office',
    filterLinesKo: [
      '투어일: 오늘 ~ +90일.',
      '매니아투어/서비스가 아닌 대행 상품(sub_category).',
      '취소·삭제 예약 제외.',
      '다음 중 하나도 없으면 큐에 포함: reservation_expenses, 고객 신용카드 결제(payment_records).',
    ],
    filterLinesEn: [
      'Tour dates: today through +90 days.',
      'Agency products (not Mania tour/service sub_category).',
      'Excludes cancelled/deleted reservations.',
      'In queue if neither reservation_expenses nor customer credit card payment exists.',
    ],
    completeKo: '대행 비용 등록 또는 고객 카드 결제 확인 후 예약 완료 처리.',
    completeEn: 'Mark done after agency expense is logged or customer card payment is confirmed.',
  },
  {
    id: 'bento-check',
    titleKo: '도시락 체크',
    titleEn: 'Bento check',
    categoryKo: '일일 · 고정 패널',
    categoryEn: 'Daily · built-in panel',
    departmentKo: 'Office',
    departmentEn: 'Office',
    filterLinesKo: [
      '투어일 = 오늘 + 2일(D+2, LA 기준).',
      '취소·삭제된 투어·예약 제외.',
      '예약 옵션(reservation_options) 또는 선택 초이스에 도시락/식사(meal) 옵션이 있는 투어만 표시.',
    ],
    filterLinesEn: [
      'Tour date = today + 2 days (D+2, LA).',
      'Excludes cancelled or deleted tours and reservations.',
      'Shows tours with bento/meal options in reservation_options or reservation choices.',
    ],
    completeKo: '도시락 주문 완료 후 투어별 완료 처리.',
    completeEn: 'Place bento orders, then mark each tour done.',
  },
  {
    id: 'custom-db-todos',
    titleKo: '사용자 정의 Todo (DB)',
    titleEn: 'Custom todos (database)',
    categoryKo: '일일 / 주간 / 월간 / 연간',
    categoryEn: 'Daily / weekly / monthly / yearly',
    filterLinesKo: [
      'op_todos 테이블에 저장된 항목. 카테고리·부서·알림 시간을 Todo 생성/수정에서 설정.',
      '고정 패널과 동일 제목이면 목록 칩에서 숨김(패널 우선).',
      '완료·보류·알림은 Todo 카드 또는 Notification 관리에서 설정.',
    ],
    filterLinesEn: [
      'Stored in op_todos. Set category, department, and notify schedule when creating/editing.',
      'Hidden from chips if title matches a built-in panel (panel takes priority).',
      'Complete, on hold, and notifications via todo card or Notification manager.',
    ],
    completeKo: '체크박스로 완료 표시. 주기별 히스토리는 카테고리 헤더 시계 아이콘.',
    completeEn: 'Mark complete via checkbox. Per-category history via the clock icon in the header.',
  },
]
