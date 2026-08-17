import React from 'react'

export default function ExpensesLayout({ children }: { children: React.ReactNode }) {
  return <div className="w-full min-w-0 max-w-full overflow-x-hidden">{children}</div>
}
