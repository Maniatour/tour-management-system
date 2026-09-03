import assert from 'node:assert/strict'
import test from 'node:test'
import { applyStoredCanyonChoices } from '@/lib/canyonChoice'
import {
  appendCanyonChoicesFromReservationJson,
  fetchCanyonChoiceRowsByReservationIds,
  loadCalendarChoiceRows,
} from '@/lib/fetchCanyonChoiceRows'

test('loadCalendarChoiceRows uses canyon_choice without querying reservation_choices', async () => {
  let queried = false
  const supabase = {
    from() {
      queried = true
      return {
        select() {
          return this
        },
        in() {
          return Promise.resolve({ data: [], error: null })
        },
      }
    },
  }
  const map = await loadCalendarChoiceRows(supabase, [
    { id: 'r1', canyon_choice: 'L', choices: null },
    { id: 'r2', canyon_choice: 'X', choices: null },
  ])
  assert.equal(queried, false)
  assert.equal(map.get('r1')?.[0]?.choiceKey, 'L')
  assert.equal(map.get('r2')?.[0]?.choiceKey, 'X')
})

test('loadCalendarChoiceRows uses choices JSON before reservation_choices', async () => {
  let queried = false
  const supabase = {
    from() {
      queried = true
      return {
        select() {
          return this
        },
        in() {
          return Promise.resolve({ data: [], error: null })
        },
      }
    },
  }
  const map = await loadCalendarChoiceRows(supabase, [
    {
      id: 'r3',
      canyon_choice: null,
      choices: {
        required: [{ canyon_key: 'X', quantity: 2, option_key: 'antelope_x' }],
      },
    },
  ])
  assert.equal(queried, false)
  assert.equal(map.get('r3')?.[0]?.choiceKey, 'X')
  assert.equal(map.get('r3')?.[0]?.quantity, 2)
})

test('appendCanyonChoicesFromReservationJson does not overwrite stored canyon_choice', () => {
  const map = new Map()
  applyStoredCanyonChoices(map, [{ id: 'r4', canyon_choice: 'L' }])
  appendCanyonChoicesFromReservationJson(map, [
    {
      id: 'r4',
      choices: { required: [{ canyon_key: 'X', quantity: 1 }] },
    },
  ])
  assert.equal(map.get('r4')?.[0]?.choiceKey, 'L')
})

test('fetchCanyonChoiceRowsByReservationIds queries columns only when canyon_key is present', async () => {
  const selects: string[] = []
  const supabase = {
    from() {
      return {
        select(select: string) {
          selects.push(select)
          return this
        },
        in() {
          return Promise.resolve({
            data: [
              {
                reservation_id: 'r5',
                quantity: 1,
                option_key: 'antelope_x',
                canyon_key: 'X',
                canonical_option_key: 'antelope_x',
              },
            ],
            error: null,
          })
        },
      }
    },
  }
  const map = await fetchCanyonChoiceRowsByReservationIds(supabase, ['r5'])
  assert.equal(selects.length, 1)
  assert.equal(selects[0]?.includes('choice_options'), false)
  assert.equal(map.get('r5')?.[0]?.choiceKey, 'X')
})
