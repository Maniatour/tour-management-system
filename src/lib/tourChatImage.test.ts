import assert from 'node:assert/strict'
import test from 'node:test'
import { chatMessagePreviewText, isChatImageMessage } from '@/lib/tourChatImage'

test('isChatImageMessage requires a file url', () => {
  assert.equal(isChatImageMessage({ message_type: 'image' }), false)
  assert.equal(
    isChatImageMessage({
      message_type: 'image',
      file_url: 'https://example.supabase.co/storage/v1/object/public/images/chat-messages/a.jpg',
    }),
    true
  )
  assert.equal(
    isChatImageMessage({
      message_type: 'text',
      file_url: 'https://example.supabase.co/storage/v1/object/public/images/chat-messages/a.jpg',
    }),
    true
  )
})

test('chatMessagePreviewText labels image messages', () => {
  assert.equal(
    chatMessagePreviewText({
      message_type: 'image',
      file_url: 'https://example.supabase.co/storage/v1/object/public/images/chat-messages/a.jpg',
      message: '',
    }),
    '[이미지]'
  )
  assert.equal(
    chatMessagePreviewText(
      {
        message_type: 'image',
        file_url: 'https://example.supabase.co/storage/v1/object/public/images/chat-messages/a.jpg',
        message: 'caption',
      },
      'en'
    ),
    '[Image] caption'
  )
})
