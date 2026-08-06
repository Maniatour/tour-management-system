import {
  ADMIN_TODO_LIST_MANUAL_INTRO,
  ADMIN_TODO_LIST_MANUAL_SECTIONS,
  type AdminTodoListManualSection,
} from '@/lib/adminTodoListManual'
import { prefillSortOrders, type SopCategory, type SopDocument, type SopSection } from '@/types/sopStructure'

export const ADMIN_TODO_LIST_HUB_ARTICLE_SLUG = 'admin-todo-list-manual-2026'

export const ADMIN_TODO_LIST_HUB_ARTICLE_META = {
  slug: ADMIN_TODO_LIST_HUB_ARTICLE_SLUG,
  title_ko: '업무 Todo List 사용 매뉴얼 (2026 개편)',
  title_en: 'Work Todo List Manual (2026 Revamp)',
  summary_ko:
    '업무 Todo·업무 관리 플로팅 위젯, 일일 고정 패널 14종, 완료/보류, 알림, 가이드 스케줄 컨펌, 사이트 알림까지 이번 개편 내용을 정리한 운영 매뉴얼입니다.',
  summary_en:
    'Operations manual for the 2026 Work Todos revamp: floating widgets, 14 daily built-in panels, done/on hold, notifications, guide schedule confirm, and staff site alerts.',
  hub_category: 'system' as const,
  content_type: 'system_guide' as const,
  target_roles: ['op', 'office manager', 'office', 'guide', 'driver'] as const,
  sort_order: 5,
}

function bulletLines(lines: string[]): string {
  return lines.map((line) => `- ${line}`).join('\n')
}

function panelToCategory(section: AdminTodoListManualSection, sortOrder: number): SopCategory {
  const workflowKo = section.workflowLinesKo?.length
    ? `\n\n**워크플로**\n${section.workflowLinesKo.map((line, i) => `${i + 1}. ${line}`).join('\n')}`
    : ''
  const workflowEn = section.workflowLinesEn?.length
    ? `\n\n**Workflow**\n${section.workflowLinesEn.map((line, i) => `${i + 1}. ${line}`).join('\n')}`
    : ''

  const deptKo = section.departmentKo ? `\n\n**담당:** ${section.departmentKo}` : ''
  const deptEn = section.departmentEn ? `\n\n**Team:** ${section.departmentEn}` : ''

  return {
    id: `todo-hub-cat-${section.id}`,
    title_ko: section.titleKo,
    title_en: section.titleEn,
    sort_order: sortOrder,
    content_ko: `**표시 조건**\n${bulletLines(section.filterLinesKo)}${workflowKo}${deptKo}\n\n**완료 조건:** ${section.completeKo}`,
    content_en: `**Queue filters**\n${bulletLines(section.filterLinesEn)}${workflowEn}${deptEn}\n\n**Done when:** ${section.completeEn}`,
    manual_status: 'complete',
  }
}

export function buildAdminTodoListHubManualDocument(): SopDocument {
  const intro = ADMIN_TODO_LIST_MANUAL_INTRO
  const dailyPanels = ADMIN_TODO_LIST_MANUAL_SECTIONS.filter((s) => s.id !== 'custom-db-todos')
  const customPanel = ADMIN_TODO_LIST_MANUAL_SECTIONS.find((s) => s.id === 'custom-db-todos')

  const sections: SopSection[] = [
    {
      id: 'todo-hub-sec-overview',
      title_ko: '개편 개요',
      title_en: 'Revamp overview',
      sort_order: 0,
      content_ko: [
        '관리자 페이지 **우측 하단**에 두 개의 플로팅 위젯이 추가되었습니다.',
        '',
        '- **업무 관리** (파란색): 전달사항 · 팀 업무 · 운영 허브 문서',
        '- **업무 Todo** (초록색): 일일 체크리스트 · 고정 업무 패널 14종',
        '',
        '어느 관리자 페이지에서든 열 수 있으며, 창 이동·크기 조절·최소화가 가능합니다. 미완료 건수는 버튼 배지로 표시됩니다.',
      ].join('\n'),
      content_en: [
        'Two floating widgets are on the **bottom-right** of every admin page.',
        '',
        '- **Work Management** (blue): team notes · tasks · Operations Hub docs',
        '- **Work Todos** (green): daily checklist · 13 built-in work panels',
        '',
        'Open from any admin page; drag, resize, and minimize. Pending counts show on the button badge.',
      ].join('\n'),
      categories: [],
    },
    {
      id: 'todo-hub-sec-usage',
      title_ko: '사용 방법',
      title_en: 'How to use',
      sort_order: 10,
      content_ko: [
        '**공통 규칙**',
        bulletLines(intro.listFiltersKo),
        '',
        '**완료 / 보류**',
        '- 고정 패널: 투어·항목별 **완료** 또는 **보류** 처리',
        '- 사용자 정의 Todo: 체크박스 완료, **보류** 버튼(지원 시)',
        '',
        '**알림**',
        '- 기한이 된 Todo는 관리자 페이지에서 알림 표시',
        '- Todo 생성 시 알림 시간·주기 설정 가능',
        '',
        '**메뉴얼 연결**',
        '- Todo·업무·전달사항에 운영 허브 문서를 연결하면 카드 클릭 시 메뉴얼 모달로 열림',
        '- 드롭다운에서 검색·카테고리 탭으로 문서 선택',
      ].join('\n'),
      content_en: [
        '**List-wide rules**',
        bulletLines(intro.listFiltersEn),
        '',
        '**Done / On hold**',
        '- Built-in panels: mark each tour/item **Done** or **On hold**',
        '- Custom todos: checkbox complete, **On hold** when available',
        '',
        '**Notifications**',
        '- Due todos show alerts across admin pages',
        '- Set notify schedule when creating/editing todos',
        '',
        '**Linked manual**',
        '- Link an Operations Hub doc to a todo, task, or note — card click opens the manual modal',
        '- Pick docs via searchable category-tab dropdown',
      ].join('\n'),
      categories: [],
    },
    {
      id: 'todo-hub-sec-work-mgmt',
      title_ko: '업무 관리 & 사이트 알림',
      title_en: 'Work Management & site alerts',
      sort_order: 20,
      content_ko: [
        '**업무 관리 탭**',
        '- **전달사항**: 팀 공지 등록·수정, 메뉴얼 연결 가능',
        '- **업무**: 담당자·우선순위·상태(대기/진행/완료) 관리',
        '- **운영 허브**: 문서 검색·바로 열기',
        '',
        '**사이트 알림 (헤더 메가폰)**',
        '- 그룹(가이드·드라이버·OP·매니저·사무직) 또는 개별 직원 선택',
        '- 한글·영문 제목·본문, 서명 요청 옵션',
        '- **운영 허브 문서 첨부**: 수신자가 알림 팝업에서 문서 바로 열기',
      ].join('\n'),
      content_en: [
        '**Work Management tabs**',
        '- **Notes**: post team announcements, optional manual link',
        '- **Tasks**: owners, priority, status (pending / in progress / done)',
        '- **Ops Hub**: search and open documents',
        '',
        '**Site alerts (header megaphone)**',
        '- Target by group (Guide, Driver, OP, Manager, Office Staff) or individuals',
        '- Korean & English title/body, optional signature',
        '- **Attach Operations Hub docs**: recipients open docs from the alert popup',
      ].join('\n'),
      categories: [],
    },
    {
      id: 'todo-hub-sec-guide-confirm',
      title_ko: '가이드 스케줄 컨펌',
      title_en: 'Guide schedule confirm',
      sort_order: 30,
      content_ko: [
        '**발송 (Office)**',
        '- 미리보기 모달에서 SMS·사이트 팝업 내용 수정 후 발송',
        '- **문자 + 사이트 팝업 발송** 또는 **사이트 팝업만 발송** 선택',
        '- 각 입력칸 **복사** 버튼으로 클립보드 복사',
        '',
        '**수신 (가이드·어시스턴트)**',
        '- 로그인 시 사이트 팝업으로 스케줄 확인',
        '- **확인** 버튼으로 수신 완료 처리',
      ].join('\n'),
      content_en: [
        '**Sending (Office)**',
        '- Edit SMS and site popup in the preview modal before sending',
        '- Choose **Send SMS + site popup** or **Send site popup only**',
        '- **Copy** button on each field for clipboard',
        '',
        '**Receiving (Guide / Assistant)**',
        '- Site popup on login with schedule details',
        '- Tap **Confirm** to acknowledge',
      ].join('\n'),
      categories: [],
    },
    {
      id: 'todo-hub-sec-daily-panels',
      title_ko: '일일 고정 패널',
      title_en: 'Daily built-in panels',
      sort_order: 40,
      content_ko: '아래는 업무 Todo에 자동으로 표시되는 고정 패널별 조건·완료 기준입니다.',
      content_en: 'Built-in panels in Work Todos — queue filters and completion rules for each.',
      categories: dailyPanels.map((section, index) => panelToCategory(section, index * 10)),
    },
  ]

  if (customPanel) {
    sections.push({
      id: 'todo-hub-sec-custom',
      title_ko: '사용자 정의 Todo',
      title_en: 'Custom todos',
      sort_order: 50,
      content_ko: 'op_todos에 저장된 일일·주간·월간·연간 사용자 정의 항목입니다.',
      content_en: 'Daily, weekly, monthly, and yearly items stored in op_todos.',
      categories: [panelToCategory(customPanel, 0)],
    })
  }

  return prefillSortOrders({
    title_ko: ADMIN_TODO_LIST_HUB_ARTICLE_META.title_ko,
    title_en: ADMIN_TODO_LIST_HUB_ARTICLE_META.title_en,
    sections,
  })
}
