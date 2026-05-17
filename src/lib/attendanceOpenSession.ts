import type { SupabaseClient } from '@supabase/supabase-js'

export type OpenAttendanceSession = {
  id: string
  session_number: number
  date: string
  check_in_time: string
}

/** 퇴근(check_out)이 없는 진행 중 세션이 있으면 반환 */
export async function findOpenAttendanceSession(
  supabase: SupabaseClient,
  employeeEmail: string
): Promise<OpenAttendanceSession | null> {
  const { data, error } = await supabase
    .from('attendance_records')
    .select('id, session_number, date, check_in_time')
    .eq('employee_email', employeeEmail)
    .is('check_out_time', null)
    .not('check_in_time', 'is', null)
    .order('check_in_time', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    throw error
  }

  if (!data?.check_in_time) {
    return null
  }

  return data as OpenAttendanceSession
}

export function formatOpenSessionBlockMessage(session: OpenAttendanceSession): string {
  return `${session.session_number}번째 세션(${session.date})의 퇴근 처리가 완료되지 않았습니다. 새 출근을 시작하려면 먼저 퇴근 체크아웃을 해주세요.`
}
