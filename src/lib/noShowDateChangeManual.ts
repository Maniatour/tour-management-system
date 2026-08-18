import { newSopId, prefillSortOrders, type SopCategory, type SopChecklistItem, type SopDocument, type SopSection } from '@/types/sopStructure'

export const NO_SHOW_DATE_CHANGE_MANUAL_SLUG = 'system-admin-no-show-date-change'

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

const CHECKLIST = checks([
  { ko: 'GYG 등 OTA 날짜 착각 노쇼인지 확인 (투어비 재청구 아님)', en: 'Confirm OTA wrong-date no-show (do not re-charge tour fare)' },
  { ko: '다음날 좌석이 있는지 확인', en: 'Confirm next-day seats are available' },
  { ko: '고객 추가 청구액(입장권/processing)만 입력', en: 'Enter extra charge only (entrance / processing)' },
  { ko: '확인 후 실예약에 고객 $ 입금을 따로 기록', en: 'Record the customer extra payment on the live booking' },
  { ko: '다음날 앤텔롭 티켓을 수동으로 추가 부킹', en: 'Manually book next-day Antelope tickets' },
  { ko: '입장권 Need Check에서 구날짜 오버부킹이 사라졌는지 확인', en: 'Confirm old-date ticket Need Check is cleared' },
])

export const noShowDateChangeManualDocument: SopDocument = prefillSortOrders({
  title_ko: '노쇼 날짜 변경',
  title_en: 'No-show date change',
  sections: [
    sec('언제 쓰나', 'When to use', 0, [
      cat(
        '이런 경우에만 사용',
        'Use only in this case',
        'GetYourGuide 등 **OTA 고객이 투어 당일 노쇼**했는데, 원인은 **날짜를 착각하고 예약한 경우**입니다.\n\n다음날 좌석이 있으면:\n- 투어비는 다시 받지 않습니다 (GYG $384 등은 그대로)\n- 기존 날짜 입장권 비용 또는 processing fee만 고객에게 추가로 받습니다 (예: $100)\n- 다음날 투어로 태우고, 다음날 앤텔롭 티켓은 **따로 구매**합니다\n\n**쓰지 말 것**\n- 단순 일정 변경 (Pending의 「날짜 변경」 — 같은 예약의 날짜만 바꿈)\n- 진짜 노쇼(다음날 안 태움) → 상태 **노쇼**\n- 취소 후 새로 받기 → **취소(재예약)**',
        'Use when an **OTA guest no-shows on tour day** because they **booked the wrong date**.\n\nIf the next day has seats:\n- Do not re-charge the tour fare (GYG $384 stays)\n- Charge only the old-date entrance fee or a processing fee (e.g. $100)\n- Move them to the next-day tour and **buy new Antelope tickets** for that day\n\n**Do not use**\n- Simple date edit (Pending 「Date change」 edits the same row)\n- True no-show (not moving them) → status **No-show**\n- Cancel and rebook → **Cancelled (rebooking)**',
        0
      ),
    ]),
    sec('버튼이 하는 일', 'What the button does', 1, [
      cat(
        '실예약은 다음날로, 구날짜는 $0 자리표시',
        'Live booking moves; old date gets a $0 placeholder',
        '예약 수정 모달에서 **노쇼 날짜 변경**을 누르면:\n\n1. **이 예약(실예약)** 의 투어 날짜가 새 날짜로 바뀝니다\n2. **채널 RN#, GYG 금액, 옵션, 입금 내역은 이 예약에 그대로** 남습니다\n3. 입력한 추가 청구가 **추가비용**에 더해집니다 (채널 정산 금액은 건드리지 않음)\n4. **원래 날짜**에 $0 **날짜변경** 자리표시 예약이 생깁니다 (RN 없음, 입금·유료옵션 없음, **투어 미배정**)\n5. 구날짜 앤텔롭 티켓은 자리표시 예약에 연결됩니다\n6. 양쪽 이벤트 노트에 상대 예약 번호가 기록됩니다\n\n자리표시는 투어 진행인원에 들어가지 않고, **그 티켓이 붙은 투어의 L/X 숫자만** 맞춥니다.',
        'In the reservation edit modal, **No-show date change**:\n\n1. **This booking (live)** moves to the new tour date\n2. **Channel RN#, GYG amount, options, and payments stay on this row**\n3. The extra charge is added to **additional cost** (channel settlement is unchanged)\n4. A $0 **date_changed** placeholder is created on the **original date** (no RN, no payments/paid options, **not assigned to a tour**)\n5. Old-date Antelope tickets are linked to the placeholder\n6. Event notes on both rows point to each other\n\nThe placeholder is excluded from tour headcount and only fills **L/X on the tour those tickets belong to**.',
        0
      ),
    ]),
    sec('확인 후 할 일', 'After confirm', 2, [
      cat(
        '입금·다음날 티켓은 수동',
        'Payment and next-day tickets are manual',
        '| 할 일 | 위치 |\n|------|------|\n| 고객 추가 $ 입금 | 실예약 **입금 내역** (고객 카드. GYG Partner Received와 합치지 말 것) |\n| 다음날 앤텔롭 티켓 | 입장권 부킹에서 **신규** — 실예약·새 날짜 투어에 연결 |\n| 오버부킹 확인 | 입장권 Need Check — 구날짜 L/X가 맞아야 함 |\n| 실예약 찾기 | 자리표시 카드의 **실예약 열기** / 실예약의 **구날짜 자리표시 열기** |\n\n**정산:** GYG 지급은 계속 같은 RN으로 실예약과 맞습니다. 투어일을 16일로 바꿔 두면, 날짜로 찾을 때는 16일에 보입니다.',
        '| Task | Where |\n|------|-------|\n| Extra customer payment | Live booking **payments** (customer card — do not mix with GYG Partner Received) |\n| Next-day Antelope tickets | Ticket booking **new row** — link to live booking & new-date tour |\n| Overbooking check | Ticket Need Check — old-date L/X should match |\n| Find the pair | Placeholder **Open live booking** / live **Open placeholder** |\n\n**Settlement:** GYG payout still matches the same RN on the live booking. After the date move it appears on the new tour date if you filter by date.',
        0,
        CHECKLIST
      ),
    ]),
  ],
})

export const noShowDateChangeManualTitles = {
  ko: '노쇼 날짜 변경',
  en: 'No-show date change',
} as const
