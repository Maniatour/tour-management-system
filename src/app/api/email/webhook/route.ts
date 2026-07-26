/**
 * Resend 대시보드에 등록된 기존 URL 별칭:
 * https://kovegas.com/api/email/webhook
 *
 * 실제 처리 로직은 /api/webhooks/resend 와 동일합니다.
 */
export { POST, GET } from '@/app/api/webhooks/resend/route'
