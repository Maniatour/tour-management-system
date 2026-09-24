import assert from 'node:assert/strict'
import test from 'node:test'
import { directWebPricingChannelId, WIX_HOMEPAGE_CHANNEL_ID } from './platformChannelMapping'
import { duplicateWebBookingMessage, webCheckoutDedupeKey } from './webCheckoutDedupe'

test('web checkout dedupe key ignores option changes and stays stable', () => {
  const key = webCheckoutDedupeKey({
    customerId: 'CsPowmxLh',
    productId: 'MDGCSUNRISE',
    tourDate: '2026-10-17',
    adults: 2,
    child: 0,
    infant: 0,
    channelId: 'M00001',
  })
  assert.equal(key, 'CsPowmxLh|MDGCSUNRISE|2026-10-17|2|0|0|M00001')
})

test('duplicate booking message includes the existing reservation id', () => {
  assert.match(duplicateWebBookingMessage('RcFPKihAG'), /RcFPKihAG/)
})

test('Wix homepage reservations still price from the new-site channel', () => {
  assert.equal(directWebPricingChannelId(WIX_HOMEPAGE_CHANNEL_ID), 'M00001')
  assert.equal(directWebPricingChannelId('M00001'), 'M00001')
  assert.equal(directWebPricingChannelId('Partner5'), 'Partner5')
})
