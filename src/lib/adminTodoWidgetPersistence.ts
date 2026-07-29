export const ADMIN_TODO_WIDGET_STORAGE_KEY = 'adminTodoWidget'

function readFlag(key: string): boolean {
  if (typeof window === 'undefined') return false
  try {
    return localStorage.getItem(key) === '1'
  } catch {
    return false
  }
}

function writeFlag(key: string, value: boolean): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(key, value ? '1' : '0')
  } catch {
    /* ignore */
  }
}

export function readAdminTodoWidgetPanelOpen(): boolean {
  return readFlag(`${ADMIN_TODO_WIDGET_STORAGE_KEY}.panelOpen`)
}

export function writeAdminTodoWidgetPanelOpen(open: boolean): void {
  writeFlag(`${ADMIN_TODO_WIDGET_STORAGE_KEY}.panelOpen`, open)
}

export function readAdminTodoWidgetMinimized(): boolean {
  return readFlag(`${ADMIN_TODO_WIDGET_STORAGE_KEY}.minimized`)
}

export function writeAdminTodoWidgetMinimized(minimized: boolean): void {
  writeFlag(`${ADMIN_TODO_WIDGET_STORAGE_KEY}.minimized`, minimized)
}

export function readAdminTodoWidgetDocked(): boolean {
  return readFlag(`${ADMIN_TODO_WIDGET_STORAGE_KEY}.docked`)
}

export function writeAdminTodoWidgetDocked(docked: boolean): void {
  writeFlag(`${ADMIN_TODO_WIDGET_STORAGE_KEY}.docked`, docked)
}
