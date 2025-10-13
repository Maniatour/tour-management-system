import { ColumnMapping } from '@/types/data-sync'

export const saveColumnMapping = (tableName: string, mapping: ColumnMapping): void => {
  try {
    const key = `column-mapping-${tableName}`
    localStorage.setItem(key, JSON.stringify(mapping))
    console.log('Column mapping saved to localStorage:', key, mapping)
  } catch (error) {
    console.error('Error saving column mapping to localStorage:', error)
  }
}

export const loadColumnMapping = (tableName: string): ColumnMapping => {
  try {
    const key = `column-mapping-${tableName}`
    const saved = localStorage.getItem(key)
    if (saved) {
      const mapping = JSON.parse(saved)
      console.log('Column mapping loaded from localStorage:', key, mapping)
      return mapping
    }
  } catch (error) {
    console.error('Error loading column mapping from localStorage:', error)
  }
  return {}
}
