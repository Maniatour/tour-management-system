import assert from 'node:assert/strict'
import test from 'node:test'
import { DEFAULT_MESSENGER_CONTACT_SETTINGS } from '@/lib/preTourContactSms'
import {
  applyOneWaySmsContactGuidance,
  isOneWaySmsDestination,
} from '@/lib/oneWaySmsContactGuidance'

const contacts = DEFAULT_MESSENGER_CONTACT_SETTINGS

test('미국·캐나다 번호는 양방향 발신이다', () => {
  assert.equal(isOneWaySmsDestination('+18888365247'), false)
  assert.equal(isOneWaySmsDestination('+14155552671'), false)
})

test('일본 번호는 단방향 발신이다', () => {
  assert.equal(isOneWaySmsDestination('+819012345678'), true)
})

test('취소 안내의 회신 문장을 연락처로 바꾼다', () => {
  const en = applyOneWaySmsContactGuidance(
    'Cancelled. Questions? Reply here.',
    'en',
    contacts
  )
  assert.match(en, new RegExp(`Questions\\? LINE ${contacts.line_id}`))
  assert.doesNotMatch(en, /Reply here/)

  const ko = applyOneWaySmsContactGuidance(
    '취소되었습니다. 문의는 본 문자 회신 부탁드립니다.',
    'ko',
    contacts
  )
  assert.match(ko, new RegExp(`문의: LINE ${contacts.line_id}`))
  assert.doesNotMatch(ko, /회신/)
})

test('확정 전 안내의 회신 문장을 연락처로 바꾼다', () => {
  const en = applyOneWaySmsContactGuidance(
    'Still pending. Please reply: confirm, change date, switch tour, or cancel.',
    'en',
    contacts
  )
  assert.match(en, new RegExp(`contact LINE ${contacts.line_id}`))
  assert.doesNotMatch(en, /Please reply/)
})

test('연락처가 이미 있으면 Reply STOP만 뺀다', () => {
  const body = applyOneWaySmsContactGuidance(
    'Pickup info\nLINE maniatour\n\nReply STOP to opt out.',
    'en',
    contacts
  )
  assert.match(body, /LINE maniatour/)
  assert.doesNotMatch(body, /Reply STOP/)
  assert.doesNotMatch(body, /Questions\?/)
})
