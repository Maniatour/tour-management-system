// @ts-nocheck — 브라우저 콘솔용 수동 테스트 스크립트
/**
 * 가이드 언어 감지 테스트 스크립트
 * 브라우저 콘솔에서 실행하여 테스트할 수 있습니다.
 */

// 테스트 데이터
const testTeamData = [
  {
    email: 'guide@tour.com',
    name_ko: '김가이드',
    position: '투어 가이드',
    languages: ['ko', 'en'],
    description: '한국어와 영어를 지원하는 가이드'
  },
  {
    email: 'english-guide@tour.com',
    name_ko: '영어가이드',
    position: 'Tour Guide',
    languages: ['en'],
    description: '영어만 지원하는 가이드'
  },
  {
    email: 'japanese-guide@tour.com',
    name_ko: '일본어가이드',
    position: 'tour guide',
    languages: ['ja', 'ko'],
    description: '일본어와 한국어를 지원하는 가이드'
  },
  {
    email: 'no-lang-guide@tour.com',
    name_ko: '언어없음',
    position: 'guide',
    languages: null,
    description: 'languages 필드가 null인 가이드'
  },
  {
    email: 'string-lang-guide@tour.com',
    name_ko: '문자열데이터',
    position: 'guide',
    languages: 'ko,en',
    description: 'languages가 배열이 아닌 문자열인 경우 (잘못된 데이터)'
  }
]

export function testLanguageDetection() {
  console.log('=== 가이드 언어 감지 테스트 ===')
  testTeamData.forEach((teamData) => {
    console.log(`\n테스트: ${teamData.email}`)
    console.log(`Position: ${teamData.position}`)
    console.log(`Languages:`, teamData.languages)
    if (typeof window !== 'undefined' && window.detectGuidePreferredLanguage) {
      const result = window.detectGuidePreferredLanguage(teamData, teamData.email)
      console.log(`결과: ${result}`)
    } else {
      console.log('detectGuidePreferredLanguage 함수를 찾을 수 없습니다.')
    }
  })
}

export function testGuidePositionDetection() {
  console.log('=== 가이드 포지션 감지 테스트 ===')
  testTeamData.forEach((teamData) => {
    console.log(`${teamData.email}: position="${teamData.position}"`)
  })
}

export function testTeamData() {
  console.log('=== 테스트 팀 데이터 ===')
  console.table(testTeamData)
}

export function manualLanguageDetection(teamData: any, email?: string) {
  if (typeof window !== 'undefined' && window.detectGuidePreferredLanguage) {
    return window.detectGuidePreferredLanguage(teamData, email)
  }
  return 'ko'
}

if (typeof window !== 'undefined') {
  window.testLanguageDetection = testLanguageDetection
  window.testGuidePositionDetection = testGuidePositionDetection
  window.testTeamData = testTeamData
  window.manualLanguageDetection = manualLanguageDetection
  console.log('가이드 언어 테스트 함수가 window에 등록되었습니다.')
  console.log('사용법: testLanguageDetection(), testGuidePositionDetection(), testTeamData()')
}
