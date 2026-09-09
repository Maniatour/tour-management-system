import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildImportTourDayStatusSummary,
  formatImportTourDayStatusLine,
  formatImportTourStaffLabel,
  resolveImportProductId,
  resolveImportTourMaxCapacity,
} from '@/lib/importTourDayStatus'

test('차량 정원이 있으면 투어 정원보다 차량 정원을 쓴다', () => {
  assert.equal(resolveImportTourMaxCapacity(10, 12), 12)
  assert.equal(resolveImportTourMaxCapacity(12, null), 12)
  assert.equal(resolveImportTourMaxCapacity(null, null), 12)
})

test('가이드/어시스턴트 닉네임을 슬래시로 붙인다', () => {
  assert.equal(formatImportTourStaffLabel('마틴', '해롤드'), '마틴/해롤드')
  assert.equal(formatImportTourStaffLabel('Dez', 'Sean'), 'Dez/Sean')
  assert.equal(formatImportTourStaffLabel('마틴', null), '마틴')
  assert.equal(formatImportTourStaffLabel(null, null), '미정')
})

test('해당일 투어 현황 한 줄 형식을 만든다', () => {
  const line = formatImportTourDayStatusLine({
    tourCount: 2,
    totalSpotsLeft: 5,
    teams: [
      { index: 1, staffLabel: '마틴/해롤드', assigned: 10, max: 12, spotsLeft: 2 },
      { index: 2, staffLabel: 'Dez/Sean', assigned: 9, max: 12, spotsLeft: 3 },
    ],
  })
  assert.equal(line, '투어 X 2, 잔여 좌석 X 5 (1. 마틴/해롤드 10/12 , 2. Dez/Sean 9/12)')
})

test('취소·삭제 투어는 제외하고 배정 인원과 차량 정원을 팀별로 집계한다', () => {
  const summary = buildImportTourDayStatusSummary(
    [
      {
        id: 'tour-a',
        tour_date: '2026-09-10',
        product_id: 'MDGCSUNRISE',
        tour_status: 'Confirmed',
        tour_guide_id: 'martin@example.com',
        assistant_id: 'harold@example.com',
        tour_car_id: 'van-1',
        reservation_ids: ['r1'],
        max_participants: 10,
        created_at: '2026-01-01T00:00:00Z',
      },
      {
        id: 'tour-b',
        tour_date: '2026-09-10',
        product_id: 'MDGCSUNRISE',
        tour_status: 'Confirmed',
        tour_guide_id: 'dez@example.com',
        assistant_id: 'sean@example.com',
        tour_car_id: 'van-2',
        reservation_ids: ['r2'],
        max_participants: 10,
        created_at: '2026-01-02T00:00:00Z',
      },
      {
        id: 'tour-cancelled',
        tour_date: '2026-09-10',
        product_id: 'MDGCSUNRISE',
        tour_status: 'Canceled - by customer',
        tour_guide_id: 'x@example.com',
        assistant_id: null,
        tour_car_id: 'van-3',
        reservation_ids: ['r3'],
        max_participants: 12,
        created_at: '2026-01-03T00:00:00Z',
      },
    ],
    [
      { id: 'r1', status: 'confirmed', adults: 10, tour_date: '2026-09-10', product_id: 'MDGCSUNRISE' },
      { id: 'r2', status: 'confirmed', adults: 9, tour_date: '2026-09-10', product_id: 'MDGCSUNRISE' },
      { id: 'r3', status: 'confirmed', adults: 4, tour_date: '2026-09-10', product_id: 'MDGCSUNRISE' },
      { id: 'r-cancelled', status: 'cancelled', adults: 3, tour_date: '2026-09-10', product_id: 'MDGCSUNRISE' },
    ],
    new Map([
      ['martin@example.com', { nick_name: '마틴' }],
      ['harold@example.com', { nick_name: '해롤드' }],
      ['dez@example.com', { nick_name: 'Dez' }],
      ['sean@example.com', { nick_name: 'Sean' }],
    ]),
    new Map([
      ['van-1', 12],
      ['van-2', 12],
    ]),
    'MDGCSUNRISE',
    '2026-09-10'
  )

  assert.equal(summary.tourCount, 2)
  assert.equal(summary.totalSpotsLeft, 5)
  assert.equal(formatImportTourDayStatusLine(summary), '투어 X 2, 잔여 좌석 X 5 (1. 마틴/해롤드 10/12 , 2. Dez/Sean 9/12)')
})

test('추출 상품명으로 상품 ID를 찾는다', () => {
  const id = resolveImportProductId(
    { product_name: 'Grand Canyon Sunrise' },
    [{ id: 'MDGCSUNRISE', name: 'Grand Canyon Sunrise', name_ko: '그랜드캐년 일출' }]
  )
  assert.equal(id, 'MDGCSUNRISE')
})
