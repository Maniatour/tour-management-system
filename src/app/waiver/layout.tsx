import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Tour Waiver | Las Vegas Mania Tour',
  robots: { index: false, follow: false },
}

export default function PublicWaiverLayout({ children }: { children: React.ReactNode }) {
  return children
}
