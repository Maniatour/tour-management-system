import assert from 'node:assert/strict'
import test from 'node:test'
import {
  ageOnTourDate,
  antelopeXPrintName,
  buildLeadCompanionRoster,
  chunkPrintGuests,
  countryFromCustomerLanguage,
  formatCanyonFormDate,
  formatCanyonFormTime,
  padPrintRows,
  pickEnglishPrintName,
  pickReusableWaiverSignature,
} from '@/lib/canyonWaiverPrintForms'

test('pickEnglishPrintName prefers Latin legal name', () => {
  assert.equal(
    pickEnglishPrintName({
      fullLegalName: 'Minsoo Kim',
      nameEn: 'MINSOO KIM',
      name: '김민수',
    }),
    'MINSOO KIM'
  )
})

test('pickEnglishPrintName uses name_en when legal name is Korean', () => {
  assert.equal(
    pickEnglishPrintName({
      fullLegalName: '김민수',
      nameEn: 'Minsoo Kim',
      name: '김민수',
    }),
    'MINSOO KIM'
  )
})

test('pickEnglishPrintName ignores Guest N placeholders', () => {
  assert.equal(pickEnglishPrintName({ placeholder: 'Guest 2' }), '')
  assert.equal(
    pickEnglishPrintName({
      fullLegalName: 'Guest 2',
      nameEn: 'Minsoo Kim',
    }),
    'MINSOO KIM'
  )
})

test('buildLeadCompanionRoster keeps lead name and empty companion rows', () => {
  const rows = buildLeadCompanionRoster({
    reservationId: 'r1',
    partySize: 3,
    leadName: 'MINSOO KIM',
    leadSignatureUrl: 'https://sig/lead.png',
  })
  assert.equal(rows.length, 3)
  assert.equal(rows[0].printName, 'MINSOO KIM')
  assert.equal(rows[0].signatureUrl, 'https://sig/lead.png')
  assert.equal(rows[1].printName, '')
  assert.equal(rows[1].signatureUrl, null)
  assert.equal(rows[2].printName, '')
  assert.equal(rows[0].country, '')
  assert.equal(rows[0].receiptNumber, '')
})

test('countryFromCustomerLanguage maps common locales', () => {
  assert.equal(countryFromCustomerLanguage('ko'), 'Korea')
  assert.equal(countryFromCustomerLanguage('Japanese'), 'Japan')
  assert.equal(countryFromCustomerLanguage('zh-CN'), 'China')
  assert.equal(countryFromCustomerLanguage(''), '')
})

test('pickReusableWaiverSignature reuses Mania when canyon is unsigned', () => {
  assert.equal(
    pickReusableWaiverSignature({
      canyonSignatureUrl: null,
      maniaSignatureUrl: 'https://sig/mania.png',
      isMinor: false,
    }),
    'https://sig/mania.png'
  )
})

test('pickReusableWaiverSignature uses guardian for minors first', () => {
  assert.equal(
    pickReusableWaiverSignature({
      canyonSignatureUrl: 'https://sig/canyon.png',
      maniaSignatureUrl: 'https://sig/mania.png',
      guardianSignatureUrl: 'https://sig/guardian.png',
      isMinor: true,
    }),
    'https://sig/guardian.png'
  )
})

test('chunk and pad print rows', () => {
  const chunks = chunkPrintGuests([1, 2, 3, 4, 5], 2)
  assert.deepEqual(chunks, [[1, 2], [3, 4], [5]])
  assert.equal(padPrintRows([1, 2], 4).length, 4)
  assert.equal(padPrintRows([1, 2], 4)[3], null)
})

test('format canyon date and time for US operators', () => {
  assert.equal(formatCanyonFormDate('2026-09-02'), '09/02/2026')
  assert.equal(formatCanyonFormTime('07:30:00'), '7:30 AM')
  assert.equal(formatCanyonFormTime('15:05'), '3:05 PM')
})

test('antelope X minor print name includes age', () => {
  assert.equal(
    antelopeXPrintName({
      id: '1',
      reservationId: 'r',
      printName: 'JANE DOE',
      signatureUrl: null,
      country: 'USA',
      receiptNumber: '',
      isMinor: true,
      age: 8,
      guardianName: 'JOHN DOE',
    }),
    'JANE DOE — AGE 8'
  )
})

test('ageOnTourDate uses tour date', () => {
  assert.equal(ageOnTourDate('2018-09-02', '2026-09-02'), 8)
  assert.equal(ageOnTourDate(null, '2026-09-02'), null)
})
