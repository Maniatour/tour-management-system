import assert from 'node:assert/strict'
import test from 'node:test'
import {
  adjustPeopleQuantityFromResidents,
  getMaxPeopleQuantityForOption,
} from '@/lib/choiceOptionCapacity'

const options = [
  { option_id: 'us', option_name: 'US Resident', option_name_ko: '미국 거주자' },
  { option_id: 'non', option_name: 'Non-Resident', option_name_ko: '비거주자' },
]

test('non-resident +1 takes the default US resident slot', () => {
  const current = { us: 1, non: 0 }
  assert.equal(
    getMaxPeopleQuantityForOption(options[1], options, current, 1),
    1
  )

  const next = adjustPeopleQuantityFromResidents(options, current, 'non', 1, 1)
  assert.equal(next.us, 0)
  assert.equal(next.non, 1)
})

test('party of two keeps the other US resident when adding one non-resident', () => {
  const next = adjustPeopleQuantityFromResidents(
    options,
    { us: 2, non: 0 },
    'non',
    1,
    2
  )
  assert.equal(next.us, 1)
  assert.equal(next.non, 1)
})

test('lowering non-resident returns the open seat to US residents', () => {
  const next = adjustPeopleQuantityFromResidents(
    options,
    { us: 0, non: 1 },
    'non',
    0,
    1
  )
  assert.equal(next.us, 1)
  assert.equal(next.non, 0)
})

test('US resident +1 takes the non-resident slot', () => {
  const current = { us: 0, non: 1 }
  assert.equal(getMaxPeopleQuantityForOption(options[0], options, current, 1), 1)

  const next = adjustPeopleQuantityFromResidents(options, current, 'us', 1, 1)
  assert.equal(next.us, 1)
  assert.equal(next.non, 0)
})

test('any option in the choice can take a seat from another option', () => {
  const withMinor = [
    ...options,
    { option_id: 'minor', option_name: 'Non-Resident under 16', option_name_ko: '비거주자 미성년' },
  ]
  const fromNon = adjustPeopleQuantityFromResidents(
    withMinor,
    { us: 0, non: 1, minor: 0 },
    'minor',
    1,
    1
  )
  assert.equal(fromNon.non, 0)
  assert.equal(fromNon.minor, 1)

  const backToUs = adjustPeopleQuantityFromResidents(withMinor, fromNon, 'us', 1, 1)
  assert.equal(backToUs.us, 1)
  assert.equal(backToUs.minor, 0)
})

test('options without a resident row still trade quantities', () => {
  const canyon = [
    { option_id: 'lower', option_name_ko: '로어 앤텔롭 캐년' },
    { option_id: 'x', option_name_ko: '엑스 앤텔롭 캐년' },
  ]
  const next = adjustPeopleQuantityFromResidents(
    canyon,
    { lower: 1, x: 0 },
    'x',
    1,
    1
  )
  assert.equal(next.lower, 0)
  assert.equal(next.x, 1)
})
