import assert from 'node:assert/strict'
import test from 'node:test'
import {
  classifyResidentOption,
  dropStaleUsResidentClassificationRows,
  emptyResidentStatusAmounts,
  filterReservationChoicesForOptionFk,
  findUsResidentClassificationChoice,
  mergeResidentRowsIntoSelectedChoices,
  overlayResidentRowsFromPricingJson,
  parseResidentLineStateFromSelections,
  recoverResidentStatusAmounts,
  residentAmountsAlignedToKeptCounts,
  shouldKeepFormResidentCounts,
} from '@/utils/usResidentChoiceSync'

test('classifyResidentOption recognizes US resident by key and English name', () => {
  assert.equal(classifyResidentOption({ option_key: 'us_resident' }), 'us_resident')
  assert.equal(classifyResidentOption({ option_name: 'US Resident' }), 'us_resident')
  assert.equal(classifyResidentOption({ option_name: 'U.S. Resident' }), 'us_resident')
  assert.equal(classifyResidentOption({ option_name_ko: '미국 거주자' }), 'us_resident')
})

test('classifyResidentOption does not treat US resident as non-resident', () => {
  assert.equal(
    classifyResidentOption({
      option_name_ko: '미국 거주자',
      option_name: 'US Resident',
      option_key: 'us_resident',
    }),
    'us_resident'
  )
  assert.equal(classifyResidentOption({ option_key: 'non_resident' }), 'non_resident')
  assert.equal(classifyResidentOption({ option_name_ko: '비 거주자' }), 'non_resident')
})

test('findUsResidentClassificationChoice prefers the group with resident line options', () => {
  const otherFees = {
    id: 'other',
    choice_group_ko: '기타 입장료',
    choice_group: 'Other entrance fees',
    options: [{ option_name_ko: '앤텔롭 캐년', option_name: 'Antelope Canyon', option_key: 'ac' }],
  }
  const resident = {
    id: 'resident',
    choice_group_ko: '미국 거주자 구분',
    choice_group: 'US resident classification',
    options: [
      { option_name_ko: '미국 거주자', option_name: 'US Resident', option_key: 'us_resident' },
      { option_name_ko: '비 거주자', option_name: 'Non-Resident', option_key: 'non_resident' },
    ],
  }
  const found = findUsResidentClassificationChoice([otherFees, resident])
  assert.equal(found?.id, 'resident')
})

test('shouldKeepFormResidentCounts keeps US resident when choices still say non-resident', () => {
  const form = {
    usResidentCount: 2,
    nonResidentCount: 0,
    nonResidentUnder16Count: 0,
    nonResidentWithPassCount: 0,
    nonResidentPurchasePassCount: 0,
  }
  const parsed = {
    usResidentCount: 0,
    nonResidentCount: 2,
    nonResidentUnder16Count: 0,
    nonResidentWithPassCount: 0,
    nonResidentPurchasePassCount: 0,
  }
  assert.equal(shouldKeepFormResidentCounts(2, 2, form, parsed), true)
  assert.equal(shouldKeepFormResidentCounts(0, 2, form, parsed), false)
})

test('residentAmountsAlignedToKeptCounts zeros stale non-resident fee when count is 0', () => {
  const amounts = residentAmountsAlignedToKeptCounts(
    {
      undecidedResidentCount: 0,
      usResidentCount: 2,
      nonResidentCount: 0,
      nonResidentUnder16Count: 0,
      nonResidentWithPassCount: 0,
      nonResidentPurchasePassCount: 0,
    },
    { ...emptyResidentStatusAmounts(), non_resident: 100, us_resident: 0 },
    emptyResidentStatusAmounts()
  )
  assert.equal(amounts.non_resident, 0)
  assert.equal(amounts.us_resident, 0)
})

test('one pass does not leave a leftover undecided person when it covers the party', () => {
  const productChoices = [
    {
      id: 'resident',
      choice_group_ko: '미국 거주자 구분',
      choice_group: 'US resident',
      options: [
        { id: 'pass', option_name_ko: '비 거주자 (패스 보유)', option_name: 'With pass', option_key: 'non_resident_with_pass' },
      ],
    },
    {
      id: 'other',
      choice_group_ko: '기타 입장료',
      choice_group: 'Other entrance fees',
      options: [{ id: 'fee', option_name_ko: '입장료', option_name: 'Fee', option_key: 'fee' }],
    },
  ]
  const stale = [
    { choice_id: 'canyon', option_id: 'lower', quantity: 1, total_price: 0 },
    { choice_id: 'other', option_id: '013529fa-fac6-45aa-aaaa-aaaaaaaaaaaa', quantity: 1, total_price: 0 },
    { choice_id: 'resident', option_id: '__undecided__', quantity: 2, total_price: 0 },
  ]
  const dropped = dropStaleUsResidentClassificationRows(productChoices, stale)
  assert.equal(dropped.some((row) => row.option_id === '013529fa-fac6-45aa-aaaa-aaaaaaaaaaaa'), false)
  assert.equal(dropped.some((row) => row.choice_id === 'canyon'), true)

  const merged = mergeResidentRowsIntoSelectedChoices(productChoices, stale, [
    {
      choice_id: 'resident',
      option_id: 'pass',
      option_key: 'non_resident_with_pass',
      option_name_ko: '비 거주자 (패스 보유)',
      quantity: 1,
      total_price: 0,
    },
  ])
  assert.equal(merged.selectedChoices.some((row) => row.option_id === 'pass'), true)
  assert.equal(
    merged.selectedChoices.some((row) => row.option_id === '013529fa-fac6-45aa-aaaa-aaaaaaaaaaaa'),
    false
  )
})

test('filterReservationChoicesForOptionFk drops deleted option ids before insert', () => {
  const rows = [
    { option_id: 'pass' },
    { option_id: '__undecided__' },
    { option_id: '013529fa-fac6-45aa-aaaa-aaaaaaaaaaaa' },
  ]
  const kept = filterReservationChoicesForOptionFk(rows, ['pass'])
  assert.deepEqual(kept.map((row) => row.option_id), ['pass'])
})

test('overlayResidentRowsFromPricingJson ignores deleted resident option ids', () => {
  const productChoices = [
    {
      id: 'resident',
      choice_group_ko: '미국 거주자 구분',
      choice_group: 'US resident',
      options: [
        { id: 'us', option_name_ko: '미국 거주자', option_name: 'US Resident', option_key: 'us_resident' },
      ],
    },
  ]
  const selected = [{ choice_id: 'resident', option_id: '__undecided__', quantity: 2, total_price: 0 }]
  const json = {
    required: [
      { choice_id: 'resident', option_id: 'deleted-uuid', quantity: 2, total_price: 0 },
    ],
  }
  const overlaid = overlayResidentRowsFromPricingJson(productChoices, selected, json)
  assert.equal(overlaid[0]?.option_id, '__undecided__')
})

test('overlayResidentRowsFromPricingJson replaces stale non-resident table rows', () => {
  const productChoices = [
    {
      id: 'resident',
      choice_group_ko: '미국 거주자 구분',
      choice_group: 'US resident',
      options: [
        { id: 'us', option_name_ko: '미국 거주자', option_name: 'US Resident', option_key: 'us_resident' },
        { id: 'non', option_name_ko: '비 거주자', option_name: 'Non-Resident', option_key: 'non_resident' },
      ],
    },
  ]
  const selected = [
    { choice_id: 'canyon', option_id: 'lower', quantity: 1, total_price: 0 },
    { choice_id: 'resident', option_id: 'non', quantity: 2, total_price: 100 },
  ]
  const json = {
    required: [
      { choice_id: 'resident', option_id: 'us', quantity: 2, total_price: 0, option_key: 'us_resident' },
    ],
  }
  const overlaid = overlayResidentRowsFromPricingJson(productChoices, selected, json)
  const residentRows = overlaid.filter((row) => row.choice_id === 'resident')
  assert.equal(residentRows.length, 1)
  assert.equal(residentRows[0]?.option_id, 'us')
  assert.equal(residentRows[0]?.total_price, 0)
  assert.equal(overlaid.some((row) => row.choice_id === 'canyon'), true)
})

test('parseResidentLineStateFromSelections reads US resident even if only English names are on the row', () => {
  const productChoices = [
    {
      id: 'resident',
      choice_group_ko: '미국 거주자 구분',
      choice_group: 'US resident',
      options: [{ id: 'us', option_name: 'US Resident', option_name_ko: '', option_key: 'us_resident' }],
    },
  ]
  const parsed = parseResidentLineStateFromSelections(productChoices, [
    { choice_id: 'resident', option_id: 'us', quantity: 2, total_price: 0 },
  ])
  assert.equal(parsed?.usResidentCount, 2)
  assert.equal(parsed?.nonResidentCount, 0)
})

test('recoverResidentStatusAmounts does not restore old non-resident $100 after US resident $0 save', () => {
  const productChoices = [
    {
      id: 'resident',
      choice_group_ko: '미국 거주자 구분',
      choice_group: 'US resident',
      options: [
        { id: 'us', option_name_ko: '미국 거주자', option_name: 'US Resident', option_key: 'us_resident' },
        { id: 'non', option_name_ko: '비 거주자', option_name: 'Non-Resident', option_key: 'non_resident' },
      ],
    },
  ]
  const recovered = recoverResidentStatusAmounts({
    choicesJson: {
      required: [
        { choice_id: 'resident', option_id: 'us', quantity: 2, total_price: 0, option_name_ko: '미국 거주자' },
      ],
    },
    productChoices,
  })
  assert.equal(recovered.non_resident, undefined)
  assert.equal(recovered.us_resident, undefined)
})
