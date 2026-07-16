export type LightRichEditorUiLocale = 'en' | 'ko'

export type LightRichEditorStrings = {
  placeholder: string
  boldTitle: string
  italicTitle: string
  underlineTitle: string
  listTitle: string
  orderedListTitle: string
  tableTitle: string
  /** 툴바에 텍스트 라벨을 보일 때 쓰는 짧은 이름 */
  listButton: string
  orderedListButton: string
  tableButton: string
  linkButton: string
  imageButton: string
  tableSize: string
  rows: string
  cols: string
  insertTable: string
  editTableTitle: string
  addRow: string
  removeRow: string
  addCol: string
  removeCol: string
  moveTableUp: string
  moveTableDown: string
  linkTitle: string
  imageTitle: string
  textColorTitle: string
  backgroundColorTitle: string
  fontSizeTitle: string
  fontFamilyTitle: string
  fontDefault: string
  linkUrlPrompt: string
  linkTextPrompt: string
  linkDefaultText: string
  imageUploadFailed: string
  imageSizeLabel: string
  imageWidthAria: string
  dragResizeTitle: string
  /** true면 목록·표·링크·이미지 버튼에 텍스트 라벨 숨김 */
  iconOnlyToolbar: boolean
}

const EN_STRINGS: LightRichEditorStrings = {
  placeholder: 'Enter text… (Ctrl+B: bold, Ctrl+I: italic, Ctrl+U: underline)',
  boldTitle: 'Bold (Ctrl+B)',
  italicTitle: 'Italic (Ctrl+I)',
  underlineTitle: 'Underline (Ctrl+U)',
  listTitle: 'Bullet list',
  orderedListTitle: 'Numbered list',
  tableTitle: 'Insert table',
  listButton: 'List',
  orderedListButton: 'Numbered',
  tableButton: 'Table',
  linkButton: 'Link',
  imageButton: 'Image',
  tableSize: 'Table size',
  rows: 'Rows',
  cols: 'Columns',
  insertTable: 'Insert table',
  editTableTitle: 'Edit table',
  addRow: 'Add row',
  removeRow: 'Remove row',
  addCol: 'Add column',
  removeCol: 'Remove column',
  moveTableUp: 'Move table up',
  moveTableDown: 'Move table down',
  linkTitle: 'Insert link',
  imageTitle: 'Insert image',
  textColorTitle: 'Text color',
  backgroundColorTitle: 'Highlight color',
  fontSizeTitle: 'Font size',
  fontFamilyTitle: 'Font',
  fontDefault: 'Default',
  linkUrlPrompt: 'Enter link URL:',
  linkTextPrompt: 'Enter link text:',
  linkDefaultText: 'Link',
  imageUploadFailed: 'Image upload failed.',
  imageSizeLabel: 'Size',
  imageWidthAria: 'Adjust image width',
  dragResizeTitle: 'Drag to resize',
  iconOnlyToolbar: true,
}

const KO_STRINGS: LightRichEditorStrings = {
  placeholder: '텍스트를 입력하세요… (Ctrl+B: 굵게, Ctrl+I: 기울임, Ctrl+U: 밑줄)',
  boldTitle: '굵게 (Ctrl+B)',
  italicTitle: '기울임 (Ctrl+I)',
  underlineTitle: '밑줄 (Ctrl+U)',
  listTitle: '글머리 목록',
  orderedListTitle: '숫자 목록',
  tableTitle: '표 삽입',
  listButton: '목록',
  orderedListButton: '숫자',
  tableButton: '표',
  linkButton: '링크',
  imageButton: '이미지',
  tableSize: '표 크기',
  rows: '행',
  cols: '열',
  insertTable: '표 삽입',
  editTableTitle: '표 편집',
  addRow: '행 추가',
  removeRow: '행 삭제',
  addCol: '열 추가',
  removeCol: '열 삭제',
  moveTableUp: '표 위로 이동',
  moveTableDown: '표 아래로 이동',
  linkTitle: '링크',
  imageTitle: '이미지 삽입',
  textColorTitle: '글자색',
  backgroundColorTitle: '글자 배경색',
  fontSizeTitle: '글자 크기',
  fontFamilyTitle: '글꼴',
  fontDefault: '기본',
  linkUrlPrompt: '링크 URL을 입력하세요:',
  linkTextPrompt: '링크 텍스트를 입력하세요:',
  linkDefaultText: '링크',
  imageUploadFailed: '이미지 업로드에 실패했습니다.',
  imageSizeLabel: '크기',
  imageWidthAria: '이미지 너비 조절',
  dragResizeTitle: '드래그하여 크기 조절',
  iconOnlyToolbar: false,
}

export function getLightRichEditorStrings(locale: LightRichEditorUiLocale = 'ko'): LightRichEditorStrings {
  return locale === 'en' ? EN_STRINGS : KO_STRINGS
}
