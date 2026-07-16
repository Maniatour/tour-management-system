'use client'

import { createContext, useContext } from 'react'
import type { KnowledgeBodyLayout } from '@/lib/operationsHub'
import type { SopDocument } from '@/types/sopStructure'

export type PrintLinkedManualEntry = {
  id: string
  title: string
  doc: SopDocument
  bodyLayout?: KnowledgeBodyLayout
}

type PrintLinkedManualsContextValue = {
  /** articleId → 본문. 인쇄 미리보기에서만 채워짐 */
  byId: Record<string, PrintLinkedManualEntry>
  /** true면 연결 문서 카드를 본문 전문으로 대체 */
  expandInline: boolean
  loading?: boolean
}

const SopPrintLinkedManualsContext = createContext<PrintLinkedManualsContextValue | null>(null)

export function SopPrintLinkedManualsProvider({
  value,
  children,
}: {
  value: PrintLinkedManualsContextValue
  children: React.ReactNode
}) {
  return (
    <SopPrintLinkedManualsContext.Provider value={value}>
      {children}
    </SopPrintLinkedManualsContext.Provider>
  )
}

export function usePrintLinkedManuals(): PrintLinkedManualsContextValue | null {
  return useContext(SopPrintLinkedManualsContext)
}
