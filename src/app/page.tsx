import { redirect } from 'next/navigation'

export default function RootPage() {
  // 루트 경로에서 홈페이지로 리다이렉트
  // 로그인하지 않은 사용자는 홈페이지를, 로그인한 사용자는 역할에 따라 적절한 페이지로 이동
  redirect('/ko')
}
