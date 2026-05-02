/**
 * 투어관리 스케줄 뷰와 동일한 상품 색상 프리셋 (id가 DB·localStorage에 저장됨).
 */

export type ScheduleColorPreset = {
  id: string;
  groupLabel: string;
  name: string;
  bgHex: string;
  textHex: string;
};

export const SCHEDULE_COLOR_PRESETS: ScheduleColorPreset[] = [
  { id: 'preset_0', groupLabel: 'RED 계열', name: '빨강+흰색', bgHex: '#FF0000', textHex: '#FFFFFF' },
  { id: 'preset_1', groupLabel: 'RED 계열', name: '빨강+노랑', bgHex: '#FF0000', textHex: '#FFFF00' },
  { id: 'preset_2', groupLabel: 'RED 계열', name: '빨강+검정', bgHex: '#FF0000', textHex: '#000000' },
  { id: 'preset_3', groupLabel: 'RED 계열', name: '다크레드+형광민트', bgHex: '#8B0000', textHex: '#00FFCC' },
  { id: 'preset_4', groupLabel: 'RED 계열', name: '네온레드+네온그린', bgHex: '#FF1744', textHex: '#00FF00' },
  { id: 'preset_5', groupLabel: 'GREEN 계열', name: '초록+검정', bgHex: '#00C853', textHex: '#000000' },
  { id: 'preset_6', groupLabel: 'GREEN 계열', name: '초록+흰색', bgHex: '#00C853', textHex: '#FFFFFF' },
  { id: 'preset_7', groupLabel: 'GREEN 계열', name: '네온그린+검정', bgHex: '#39FF14', textHex: '#000000' },
  { id: 'preset_8', groupLabel: 'GREEN 계열', name: '다크그린+형광노랑', bgHex: '#003300', textHex: '#EEFF00' },
  { id: 'preset_9', groupLabel: 'GREEN 계열', name: '민트+다크네이비', bgHex: '#00FFC6', textHex: '#001F3F' },
  { id: 'preset_10', groupLabel: 'BLUE 계열', name: '파랑+흰색', bgHex: '#0057FF', textHex: '#FFFFFF' },
  { id: 'preset_11', groupLabel: 'BLUE 계열', name: '파랑+노랑', bgHex: '#0057FF', textHex: '#FFFF00' },
  { id: 'preset_12', groupLabel: 'BLUE 계열', name: '네이비+형광시안', bgHex: '#001F54', textHex: '#00FFFF' },
  { id: 'preset_13', groupLabel: 'BLUE 계열', name: '네온블루+검정', bgHex: '#2979FF', textHex: '#000000' },
  { id: 'preset_14', groupLabel: 'BLUE 계열', name: '하늘색+다크브라운', bgHex: '#00BFFF', textHex: '#3A1F00' },
  { id: 'preset_15', groupLabel: 'YELLOW 계열', name: '노랑+검정', bgHex: '#FFD600', textHex: '#000000' },
  { id: 'preset_16', groupLabel: 'YELLOW 계열', name: '형광노랑+다크그레이', bgHex: '#EEFF00', textHex: '#1A1A1A' },
  { id: 'preset_17', groupLabel: 'YELLOW 계열', name: '머스터드+네이비', bgHex: '#FFB300', textHex: '#001F3F' },
  { id: 'preset_18', groupLabel: 'YELLOW 계열', name: '레몬+딥퍼플', bgHex: '#FFF700', textHex: '#2E003E' },
  { id: 'preset_19', groupLabel: 'YELLOW 계열', name: '골드+블랙', bgHex: '#FFC107', textHex: '#000000' },
  { id: 'preset_20', groupLabel: 'PURPLE / PINK 계열', name: '보라+흰색', bgHex: '#7C4DFF', textHex: '#FFFFFF' },
  { id: 'preset_21', groupLabel: 'PURPLE / PINK 계열', name: '다크퍼플+형광핑크', bgHex: '#2E003E', textHex: '#FF2FD1' },
  { id: 'preset_22', groupLabel: 'PURPLE / PINK 계열', name: '핑크+검정', bgHex: '#FF4081', textHex: '#000000' },
  { id: 'preset_23', groupLabel: 'PURPLE / PINK 계열', name: '네온핑크+흰색', bgHex: '#FF00FF', textHex: '#FFFFFF' },
  { id: 'preset_24', groupLabel: 'PURPLE / PINK 계열', name: '라벤더+다크블루', bgHex: '#B388FF', textHex: '#001F3F' },
  { id: 'preset_25', groupLabel: 'ORANGE 계열', name: '오렌지+흰색', bgHex: '#FF6D00', textHex: '#FFFFFF' },
  { id: 'preset_26', groupLabel: 'ORANGE 계열', name: '오렌지+검정', bgHex: '#FF6D00', textHex: '#000000' },
  { id: 'preset_27', groupLabel: 'ORANGE 계열', name: '네온오렌지+네이비', bgHex: '#FF9100', textHex: '#001F3F' },
  { id: 'preset_28', groupLabel: 'ORANGE 계열', name: '코랄+다크그린', bgHex: '#FF5252', textHex: '#013220' },
  { id: 'preset_29', groupLabel: 'ORANGE 계열', name: '탠저린+퍼플', bgHex: '#FF8F00', textHex: '#7C4DFF' },
  { id: 'preset_30', groupLabel: 'BLACK / DARK 계열', name: '검정+형광그린', bgHex: '#000000', textHex: '#00FF00' },
  { id: 'preset_31', groupLabel: 'BLACK / DARK 계열', name: '검정+형광핑크', bgHex: '#000000', textHex: '#FF2FD1' },
  { id: 'preset_32', groupLabel: 'BLACK / DARK 계열', name: '검정+형광블루', bgHex: '#000000', textHex: '#00FFFF' },
  { id: 'preset_33', groupLabel: 'BLACK / DARK 계열', name: '차콜+노랑', bgHex: '#1C1C1C', textHex: '#FFFF00' },
  { id: 'preset_34', groupLabel: 'BLACK / DARK 계열', name: '다크브라운+민트', bgHex: '#2B1B0E', textHex: '#00FFC6' },
  { id: 'preset_35', groupLabel: '시선 강탈 / CTA 특화', name: '형광시안+검정', bgHex: '#00FFFF', textHex: '#000000' },
  { id: 'preset_36', groupLabel: '시선 강탈 / CTA 특화', name: '형광그린+보라', bgHex: '#00FF00', textHex: '#5E2B97' },
  { id: 'preset_37', groupLabel: '시선 강탈 / CTA 특화', name: '형광핑크+네이비', bgHex: '#FF2FD1', textHex: '#001F3F' },
  { id: 'preset_38', groupLabel: '시선 강탈 / CTA 특화', name: '형광옐로+레드', bgHex: '#F6FF00', textHex: '#FF0000' },
  { id: 'preset_39', groupLabel: '시선 강탈 / CTA 특화', name: '형광레드+블랙', bgHex: '#FF1744', textHex: '#000000' },
  { id: 'preset_40', groupLabel: '끝판왕 조합', name: '보라+라임', bgHex: '#5E2B97', textHex: '#C6FF00' },
  { id: 'preset_41', groupLabel: '끝판왕 조합', name: '네이비+오렌지', bgHex: '#001F3F', textHex: '#FF851B' },
  { id: 'preset_42', groupLabel: '끝판왕 조합', name: '다크그린+핑크', bgHex: '#013220', textHex: '#FF6EC7' },
  { id: 'preset_43', groupLabel: '끝판왕 조합', name: '브라운+시안', bgHex: '#4E342E', textHex: '#00FFFF' },
  { id: 'preset_44', groupLabel: '끝판왕 조합', name: '그레이+형광옐로', bgHex: '#424242', textHex: '#EEFF00' },
  { id: 'preset_45', groupLabel: '끝판왕 조합', name: '레드브라운+아이보리', bgHex: '#7F0000', textHex: '#FFFFF0' },
  { id: 'preset_46', groupLabel: '끝판왕 조합', name: '청록+코랄', bgHex: '#00796B', textHex: '#FF5252' },
  { id: 'preset_47', groupLabel: '끝판왕 조합', name: '인디고+라임', bgHex: '#1A237E', textHex: '#C6FF00' },
  { id: 'preset_48', groupLabel: '끝판왕 조합', name: '오프화이트+네온레드', bgHex: '#FAFAFA', textHex: '#FF1744' },
  { id: 'preset_49', groupLabel: '끝판왕 조합', name: '실버그레이+딥블루', bgHex: '#BDBDBD', textHex: '#001F3F' },
];

/** 프리셋 id면 배경·글자색, 아니면 레거시 Tailwind className (ScheduleView와 동일) */
export function getScheduleProductDisplayProps(value: string | undefined): {
  style?: { backgroundColor: string; color: string };
  className?: string;
} {
  if (!value) return {};
  const preset = SCHEDULE_COLOR_PRESETS.find((p) => p.id === value);
  if (preset) return { style: { backgroundColor: preset.bgHex, color: preset.textHex } };
  return { className: value };
}
