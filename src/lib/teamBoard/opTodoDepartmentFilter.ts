import { opTodoAudiencesForUser, type OpTodoDepartment } from '@/lib/opTodoSchedule'

/** null = 전체 부서, 배열 = 해당 부서만 서버 필터 */
export function resolveOpTodoDepartmentFilter(options: {
  viewAll: boolean
  userPosition: string | null
}): OpTodoDepartment[] | null {
  if (options.viewAll) return null
  return opTodoAudiencesForUser(options.userPosition)
}

export function opTodoDepartmentFilterToRpc(
  departments: OpTodoDepartment[] | null | undefined
): string[] | null {
  if (!departments || departments.length === 0) return null
  return [...departments]
}
