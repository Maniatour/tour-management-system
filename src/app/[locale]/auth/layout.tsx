/** 로그인·콜백: Navigation/Sidebar 없이 해시(#access_token) 처리만 수행 */
export default function AuthSegmentLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen app-page-bg">{children}</div>
}
