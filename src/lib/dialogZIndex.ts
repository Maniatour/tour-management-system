/** Dialog / AlertDialog z-index stack (admin header ≈ 9999). */
export type DialogStackLevel = 'default' | 'elevated' | 'nested' | 'nestedElevated'

export const DIALOG_Z_INDEX: Record<DialogStackLevel, number> = {
  default: 10050,
  elevated: 10100,
  nested: 10200,
  nestedElevated: 10300,
}

export function dialogZIndexStyle(level: DialogStackLevel = 'default'): { zIndex: number } {
  return { zIndex: DIALOG_Z_INDEX[level] }
}
