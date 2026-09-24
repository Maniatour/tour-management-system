import assert from 'node:assert/strict'
import test from 'node:test'
import { findLinkedCustomerInList, readReservationCustomerId } from './linkedCustomerLookup'

test('finds a linked customer when the id has surrounding spaces', () => {
  const customers = [{ id: 'cust-1', name: 'Martyna' }]
  assert.equal(findLinkedCustomerInList(customers, ' cust-1 ')?.name, 'Martyna')
})

test('returns null when the customer is not in the list', () => {
  assert.equal(findLinkedCustomerInList([{ id: 'cust-1' }], 'cust-2'), null)
  assert.equal(findLinkedCustomerInList([{ id: 'cust-1' }], ''), null)
  assert.equal(findLinkedCustomerInList([{ id: 'cust-1' }], null), null)
})

test('reads customer id from either field name', () => {
  assert.equal(readReservationCustomerId({ customerId: 'a' }), 'a')
  assert.equal(readReservationCustomerId({ customer_id: 'b' }), 'b')
  assert.equal(readReservationCustomerId({ customerId: '', customer_id: 'c' }), 'c')
  assert.equal(readReservationCustomerId(null), '')
})
