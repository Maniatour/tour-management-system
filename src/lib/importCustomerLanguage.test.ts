import assert from 'node:assert/strict'
import test from 'node:test'
import {
  resolveImportCustomerLanguage,
  resolveImportTourLanguage,
  shouldReplaceDefaultImportCustomerLanguage,
} from '@/lib/importCustomerLanguage'

test('추출된 고객 언어를 KR/EN 코드로 저장한다', () => {
  assert.equal(resolveImportCustomerLanguage({ language: 'English' }), 'EN')
  assert.equal(resolveImportCustomerLanguage({ language: 'en' }), 'EN')
  assert.equal(resolveImportCustomerLanguage({ language: 'Spanish' }), 'ES')
  assert.equal(resolveImportCustomerLanguage({ language: 'ko' }), 'KR')
})

test('언어가 없으면 전화번호 국가로 추정한다', () => {
  assert.equal(resolveImportCustomerLanguage({ customer_phone: '+1 (843) 509-2495' }), 'EN')
  assert.equal(resolveImportCustomerLanguage({ customer_phone: '+82 10-1234-5678' }), 'KR')
  assert.equal(resolveImportCustomerLanguage({ customer_phone: '+81 90-1234-5678' }), 'JA')
})

test('언어·전화번호가 없으면 한국 OTA만 KR, 나머지는 EN이다', () => {
  assert.equal(resolveImportCustomerLanguage({}, 'viator'), 'EN')
  assert.equal(resolveImportCustomerLanguage({}, 'klook'), 'EN')
  assert.equal(resolveImportCustomerLanguage({}, 'getyourguide'), 'EN')
  assert.equal(resolveImportCustomerLanguage({}, 'myrealtrip'), 'KR')
  assert.equal(resolveImportCustomerLanguage({}, 'nol'), 'KR')
})

test('DB 기본값 ko만 자동 추가 언어로 덮어쓴다', () => {
  assert.equal(shouldReplaceDefaultImportCustomerLanguage('ko'), true)
  assert.equal(shouldReplaceDefaultImportCustomerLanguage(null), true)
  assert.equal(shouldReplaceDefaultImportCustomerLanguage('KR'), false)
  assert.equal(shouldReplaceDefaultImportCustomerLanguage('EN'), false)
})

test('투어 신청 언어는 명시된 일본어만 ja이고 일본인 고객은 기본 en이다', () => {
  assert.equal(resolveImportTourLanguage({ tour_language: 'Japanese' }), 'ja')
  assert.equal(resolveImportTourLanguage({ tour_language: 'JA' }), 'ja')
  assert.equal(resolveImportTourLanguage({ tour_language: 'Japanese (Live tour guide)' }), 'ja')
  assert.equal(resolveImportTourLanguage({ language: 'JA', customer_phone: '+81 90-1234-5678' }), 'en')
  assert.equal(resolveImportTourLanguage({ language: 'KR' }), 'ko')
  assert.equal(resolveImportTourLanguage({}, 'myrealtrip'), 'ko')
  assert.equal(resolveImportTourLanguage({}, 'viator'), 'en')
})
