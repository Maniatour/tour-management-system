export const OP_TODO_REFRESH_EVENT = 'op-todos-refresh'

export function dispatchOpTodoRefresh(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(OP_TODO_REFRESH_EVENT))
}
