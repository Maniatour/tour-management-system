'use client'

/**
 * 스케줄 디스플레이 전용 진입점.
 * admin 페이지는 `@/components/ScheduleView`를 직접 import하고,
 * 디스플레이는 이 파일을 dynamic import해 동일 구현을 공유하면서
 * 프리로드·청크 경계를 분리합니다.
 */
export { default } from '@/components/ScheduleView'
