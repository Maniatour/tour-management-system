import assert from 'node:assert/strict'
import test from 'node:test'
import {
  hasNarrationSkipExplanation,
  narrationSkipNeedsDetails,
  narrationSkipSummary,
  parseNarrationSkip,
  serializeNarrationSkip,
} from '@/lib/tourReportNarration'

test('parseNarrationSkip treats missing values as empty', () => {
  assert.deepEqual(parseNarrationSkip(undefined), {
    narration_not_played: false,
    narration_explained_in_person: false,
    narration_skip_reason: '',
  })
})

test('hasNarrationSkipExplanation requires not-played plus reason or explained check', () => {
  assert.equal(hasNarrationSkipExplanation({ narration_not_played: true }), false)
  assert.equal(
    hasNarrationSkipExplanation({
      narration_not_played: true,
      narration_explained_in_person: true,
    }),
    true
  )
  assert.equal(
    hasNarrationSkipExplanation({
      narration_not_played: true,
      narration_skip_reason: 'Audio system failed',
    }),
    true
  )
  assert.equal(
    hasNarrationSkipExplanation({
      narration_not_played: false,
      narration_explained_in_person: true,
    }),
    false
  )
})

test('narrationSkipNeedsDetails is true only when not-played with no reason', () => {
  assert.equal(narrationSkipNeedsDetails({ narration_not_played: false }), false)
  assert.equal(narrationSkipNeedsDetails({ narration_not_played: true }), true)
  assert.equal(
    narrationSkipNeedsDetails({
      narration_not_played: true,
      narration_explained_in_person: true,
    }),
    false
  )
})

test('serializeNarrationSkip clears details when audio was played', () => {
  assert.deepEqual(
    serializeNarrationSkip({
      narration_not_played: false,
      narration_explained_in_person: true,
      narration_skip_reason: 'should not save',
    }),
    {
      narration_not_played: false,
      narration_explained_in_person: false,
      narration_skip_reason: null,
    }
  )
})

test('narrationSkipSummary prefers explained-without-audio wording', () => {
  const explained = narrationSkipSummary(
    {
      narration_not_played: true,
      narration_explained_in_person: true,
      narration_skip_reason: 'Guests asked for live Korean guide',
    },
    'ko'
  )
  assert.equal(explained?.title, '나레이션 재생 안 함 — 충분한 설명을 했습니다')
  assert.equal(explained?.detail, 'Guests asked for live Korean guide')
  assert.equal(narrationSkipSummary({ narration_not_played: false }, 'ko'), null)
})
