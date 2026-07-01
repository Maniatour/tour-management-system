/** 이메일·전화번호 입력에서 공백 문자를 제거합니다. */
export function stripSpacesFromContactInput(value: string): string {
  return value.replace(/\s/g, '')
}
