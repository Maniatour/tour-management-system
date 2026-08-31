import type { WaiverLocale } from '@/lib/waiver/types'

export type WaiverUiCopy = {
  brand: string
  language: string
  requiredAgreements: string
  startWaiver: string
  nextGuest: string
  nextParticipant: string
  waiversCompleted: string
  allComplete: string
  successTitle: string
  signed: string
  booking: string
  tour: string
  completed: string
  of: string
  guestPlaceholder: string
  participantInfo: string
  fullLegalName: string
  dateOfBirth: string
  tourDate: string
  bookingNumber: string
  email: string
  phone: string
  emergencyContactName: string
  emergencyContactPhone: string
  participantType: string
  adult: string
  minor: string
  guardianName: string
  relationshipToMinor: string
  guardianAck: string
  continue: string
  back: string
  viewDocument: string
  viewBeforeAccept: string
  acceptDocument: string
  acceptMania: string
  acceptCanyonX: string
  acknowledgmentsTitle: string
  ackRead: string
  ackRisks: string
  ackRelease: string
  ackRefuse: string
  ackAccurate: string
  eSignConsent: string
  eSignAgree: string
  signHere: string
  clear: string
  undo: string
  submit: string
  signatureRequired: string
  signatureHint: string
  invalidToken: string
  alreadySigned: string
  notConfigured: string
  notConfiguredBody: string
  languageNoticeMania: string
  languageNoticeCanyonX: string
  progress: string
  saving: string
  errorGeneric: string
  validationRequired: string
  validationEmail: string
  validationPhone: string
  validationDob: string
  clearBetweenGuests: string
  ready: string
  actionRequired: string
  pending: string
  previewOnly: string
  voided: string
}

const EN: WaiverUiCopy = {
  brand: 'LAS VEGAS MANIA TOUR',
  language: 'Language',
  requiredAgreements: 'Your required agreements',
  startWaiver: 'Start waiver',
  nextGuest: 'Next guest',
  nextParticipant: 'Next participant',
  waiversCompleted: 'Waivers completed',
  allComplete: 'All required waivers completed',
  successTitle: 'Waiver successfully signed',
  signed: 'Signed',
  booking: 'Booking',
  tour: 'Tour',
  completed: 'Completed',
  of: 'of',
  guestPlaceholder: 'Guest',
  participantInfo: 'Participant information',
  fullLegalName: 'Full legal name',
  dateOfBirth: 'Date of birth',
  tourDate: 'Tour date',
  bookingNumber: 'Booking / reservation number',
  email: 'Email',
  phone: 'Phone number',
  emergencyContactName: 'Emergency contact name',
  emergencyContactPhone: 'Emergency contact phone',
  participantType: 'Participant type',
  adult: 'Adult',
  minor: 'Minor',
  guardianName: 'Parent / legal guardian full legal name',
  relationshipToMinor: 'Relationship to minor',
  guardianAck:
    'I represent that I am the parent or legal guardian of the minor participant(s) identified and have authority to execute this Agreement on the minor’s behalf to the extent permitted by applicable law.',
  continue: 'Continue',
  back: 'Back',
  viewDocument: 'View document',
  viewBeforeAccept: 'Open and read this document before you can agree.',
  acceptDocument: 'I have read and agree to this document.',
  acceptMania: 'I have read and agree to the LAS VEGAS MANIA TOUR Waiver.',
  acceptCanyonX: 'I have read and agree to the Taadidiin Tours / Antelope Canyon X Waiver.',
  acknowledgmentsTitle: 'Required acknowledgments',
  ackRead: 'I have read the applicable Waiver and Release Agreement(s).',
  ackRisks:
    'I understand that participation involves inherent risks including walking, hiking, outdoor conditions, natural hazards, and transportation-related activities.',
  ackRelease:
    'I understand that the agreement(s) contain releases of certain legal rights and assumptions of risk.',
  ackRefuse:
    'I understand that I may refuse an activity, photography location, or pose that I believe is unsafe.',
  ackAccurate: 'I confirm that the information I provided is accurate.',
  eSignConsent:
    'By signing electronically below, I confirm that I have read and understood the applicable Agreement(s) and voluntarily agree to their terms. I understand that my electronic signature is intended to have the same effect as my handwritten signature.',
  eSignAgree: 'I agree to use an electronic signature.',
  signHere: 'Sign here',
  clear: 'Clear',
  undo: 'Undo',
  submit: 'Sign and submit',
  signatureRequired: 'Please draw your signature. A typed name is not accepted.',
  signatureHint: 'Draw your signature with your finger, stylus, or mouse. Use Clear to start over or Undo to remove the last stroke.',
  invalidToken: 'This waiver link is invalid or has expired.',
  alreadySigned: 'This participant has already signed the required waivers.',
  notConfigured: 'Not yet available',
  notConfiguredBody:
    'The official Lower Antelope Canyon operator waiver has not been configured. It will be added when the official form is provided.',
  languageNoticeMania:
    'This translation is provided for convenience. To the extent permitted by applicable law, if there is any inconsistency between this translation and the English version, the English version shall control.',
  languageNoticeCanyonX:
    'This translation is provided to assist you in understanding the original Taadidiin Tours waiver. The official operator document is the English version.',
  progress: 'Progress',
  saving: 'Saving…',
  errorGeneric: 'Something went wrong. Please try again.',
  validationRequired: 'This field is required.',
  validationEmail: 'Enter a valid email address.',
  validationPhone: 'Enter a valid phone number.',
  validationDob: 'Enter a valid date of birth.',
  clearBetweenGuests: 'The previous signature and acknowledgments were cleared for the next participant.',
  ready: 'Ready',
  actionRequired: 'Action required',
  pending: 'Pending',
  voided: 'Voided',
  previewOnly: 'Preview only. Signatures are not saved.',
}

export const WAIVER_UI: Record<WaiverLocale, WaiverUiCopy> = {
  en: EN,
  ko: {
    ...EN,
    language: '언어',
    requiredAgreements: '필수 동의 서류',
    startWaiver: '면책 동의 시작',
    nextGuest: '다음 게스트',
    nextParticipant: '다음 참가자',
    waiversCompleted: '완료된 면책 동의',
    allComplete: '필수 면책 동의가 모두 완료되었습니다',
    successTitle: '면책 동의가 서명되었습니다',
    signed: '서명됨',
    booking: '예약',
    tour: '투어',
    completed: '완료',
    of: '/',
    guestPlaceholder: '게스트',
    participantInfo: '참가자 정보',
    fullLegalName: '법적 성명',
    dateOfBirth: '생년월일',
    tourDate: '투어 날짜',
    bookingNumber: '예약 번호',
    email: '이메일',
    phone: '전화번호',
    emergencyContactName: '비상 연락처 이름',
    emergencyContactPhone: '비상 연락처 전화',
    participantType: '참가자 유형',
    adult: '성인',
    minor: '미성년자',
    guardianName: '부모 / 법정 후견인 법적 성명',
    relationshipToMinor: '미성년자와의 관계',
    guardianAck:
      '본인은 위에 확인된 미성년 참가자의 부모 또는 법정 후견인이며, 적용 법령이 허용하는 범위 내에서 미성년자를 대신하여 본 약정을 체결할 권한이 있음을 진술합니다.',
    continue: '계속',
    back: '이전',
    viewDocument: '문서 보기',
    viewBeforeAccept: '동의하기 전에 문서를 열어 읽어 주세요.',
    acceptDocument: '본 문서를 읽었으며 이에 동의합니다.',
    acceptMania: 'LAS VEGAS MANIA TOUR 면책 동의서를 읽었으며 이에 동의합니다.',
    acceptCanyonX: 'Taadidiin Tours / Antelope Canyon X 면책 동의서를 읽었으며 이에 동의합니다.',
    acknowledgmentsTitle: '필수 확인 사항',
    ackRead: '해당 면책 및 책임 면제 약정을 읽었습니다.',
    ackRisks:
      '참여가 걷기, 하이킹, 야외 조건, 자연 위험 및 교통과 관련된 고유 위험을 수반함을 이해합니다.',
    ackRelease: '약정에 특정 법적 권리의 면제와 위험 인수가 포함되어 있음을 이해합니다.',
    ackRefuse: '안전하지 않다고 생각하는 활동, 사진 촬영 장소 또는 포즈를 거부할 수 있음을 이해합니다.',
    ackAccurate: '제공한 정보가 정확함을 확인합니다.',
    eSignConsent:
      '아래에 전자 서명함으로써, 본인은 해당 약정을 읽고 이해했으며 그 조건에 자발적으로 동의함을 확인합니다. 본인의 전자 서명이 자필 서명과 동일한 효력을 갖는다는 점을 이해합니다.',
    eSignAgree: '전자 서명 사용에 동의합니다.',
    signHere: '여기에 서명',
    clear: '지우기',
    undo: '실행 취소',
    submit: '서명하고 제출',
    signatureRequired: '서명을 그려 주세요. 입력된 이름만으로는 접수되지 않습니다.',
    signatureHint: '손가락, 스타일러스 또는 마우스로 서명을 그리세요. 지우기로 처음부터, 실행 취소로 마지막 획을 지울 수 있습니다.',
    invalidToken: '이 면책 동의 링크가 유효하지 않거나 만료되었습니다.',
    alreadySigned: '이 참가자는 이미 필수 면책 동의에 서명했습니다.',
    notConfigured: '아직 제공되지 않음',
    notConfiguredBody:
      '공식 Lower Antelope Canyon 운영자 면책 동의서가 아직 설정되지 않았습니다. 공식 양식이 제공되면 추가됩니다.',
    languageNoticeMania:
      '이 번역은 편의를 위해 제공됩니다. 적용 법령이 허용하는 범위 내에서, 이 번역과 영어 버전 사이에 불일치가 있는 경우 영어 버전이 우선합니다.',
    languageNoticeCanyonX:
      '이 번역은 원본 Taadidiin Tours 면책 동의서를 이해하는 데 도움을 드리기 위해 제공됩니다. 공식 운영자 문서는 영어 버전입니다.',
    progress: '진행 상황',
    saving: '저장 중…',
    errorGeneric: '문제가 발생했습니다. 다시 시도해 주세요.',
    validationRequired: '필수 항목입니다.',
    validationEmail: '올바른 이메일을 입력해 주세요.',
    validationPhone: '올바른 전화번호를 입력해 주세요.',
    validationDob: '올바른 생년월일을 입력해 주세요.',
    clearBetweenGuests: '다음 참가자를 위해 이전 서명과 동의 항목이 초기화되었습니다.',
    ready: '준비 완료',
    actionRequired: '조치 필요',
    pending: '대기',
    voided: '무효',
    previewOnly: '미리보기입니다. 서명은 저장되지 않습니다.',
  },
  ja: {
    ...EN,
    language: '言語',
    requiredAgreements: '必要な同意書類',
    startWaiver: '免責同意を開始',
    nextGuest: '次のゲスト',
    nextParticipant: '次の参加者',
    waiversCompleted: '完了した免責同意',
    allComplete: '必要な免責同意はすべて完了しました',
    successTitle: '免責同意が署名されました',
    signed: '署名済み',
    booking: '予約',
    tour: 'ツアー',
    completed: '完了',
    guestPlaceholder: 'ゲスト',
    participantInfo: '参加者情報',
    fullLegalName: '法的氏名',
    dateOfBirth: '生年月日',
    tourDate: 'ツアー日',
    bookingNumber: '予約番号',
    email: 'メール',
    phone: '電話番号',
    emergencyContactName: '緊急連絡先氏名',
    emergencyContactPhone: '緊急連絡先電話',
    participantType: '参加者の区分',
    adult: '成人',
    minor: '未成年者',
    guardianName: '親／法定後見人の法的氏名',
    relationshipToMinor: '未成年者との関係',
    guardianAck:
      '私は、特定された未成年参加者の親または法定後見人であり、適用法が認める範囲で未成年者に代わって本合意を締結する権限を有することを表明します。',
    continue: '続ける',
    back: '戻る',
    viewDocument: '文書を見る',
    viewBeforeAccept: '同意する前に、この文書を開いて読んでください。',
    acceptMania: 'LAS VEGAS MANIA TOUR の免責同意書を読み、これに同意します。',
    acceptCanyonX: 'Taadidiin Tours / Antelope Canyon X の免責同意書を読み、これに同意します。',
    acknowledgmentsTitle: '必要な確認事項',
    ackRead: '該当する免責および責任免除合意を読みました。',
    ackRisks:
      '参加が歩行、ハイキング、屋外条件、自然の危険および輸送関連活動を含む固有の危険を伴うことを理解します。',
    ackRelease: '合意に一定の法的権利の免除および危険の引受が含まれることを理解します。',
    ackRefuse: '安全でないと考える活動、撮影場所またはポーズを拒否できることを理解します。',
    ackAccurate: '提供した情報が正確であることを確認します。',
    eSignConsent:
      '以下に電子署名することにより、該当する合意を読み理解し、その条件に自発的に同意することを確認します。私の電子署名が自筆署名と同じ効力を持つことを理解します。',
    eSignAgree: '電子署名の使用に同意します。',
    signHere: 'ここに署名',
    clear: '消去',
    undo: '元に戻す',
    submit: '署名して送信',
    signatureRequired: '署名を描いてください。入力した氏名のみでは受け付けられません。',
    signatureHint: '指、スタイラスまたはマウスで署名を描いてください。消去で最初から、元に戻すで最後の線を消せます。',
    invalidToken: 'この免責同意リンクは無効または期限切れです。',
    alreadySigned: 'この参加者はすでに必要な免責同意に署名しています。',
    notConfigured: '未設定',
    notConfiguredBody:
      '公式の Lower Antelope Canyon 運営者免責同意書はまだ設定されていません。公式用紙が提供されたときに追加されます。',
    languageNoticeMania:
      'この翻訳は便宜のために提供されます。適用法が認める範囲で、この翻訳と英語版との間に不一致がある場合、英語版が優先します。',
    languageNoticeCanyonX:
      'この翻訳は、原本である Taadidiin Tours の免責同意書を理解する助けとして提供されます。公式の運営者文書は英語版です。',
    progress: '進捗',
    saving: '保存中…',
    errorGeneric: '問題が発生しました。もう一度お試しください。',
    validationRequired: 'この項目は必須です。',
    validationEmail: '有効なメールアドレスを入力してください。',
    validationPhone: '有効な電話番号を入力してください。',
    validationDob: '有効な生年月日を入力してください。',
    clearBetweenGuests: '次の参加者のために、前の署名と確認事項を消去しました。',
    ready: '準備完了',
    actionRequired: '対応が必要',
    pending: '未完了',
    voided: '無効',
    previewOnly: 'プレビューです。署名は保存されません。',
  },
  zh: {
    ...EN,
    language: '语言',
    requiredAgreements: '您需要签署的协议',
    startWaiver: '开始签署弃权书',
    nextGuest: '下一位客人',
    nextParticipant: '下一位参加者',
    waiversCompleted: '已完成的弃权书',
    allComplete: '所有必需的弃权书均已完成',
    successTitle: '弃权书已成功签署',
    signed: '已签署',
    booking: '预订',
    tour: '行程',
    completed: '已完成',
    guestPlaceholder: '客人',
    participantInfo: '参加者信息',
    fullLegalName: '法定全名',
    dateOfBirth: '出生日期',
    tourDate: '行程日期',
    bookingNumber: '预订／预约编号',
    email: '电子邮件',
    phone: '电话号码',
    emergencyContactName: '紧急联系人姓名',
    emergencyContactPhone: '紧急联系人电话',
    participantType: '参加者类型',
    adult: '成人',
    minor: '未成年人',
    guardianName: '父母／法定监护人法定全名',
    relationshipToMinor: '与未成年人的关系',
    guardianAck:
      '本人声明本人是上述未成年参加者的父母或法定监护人，并在适用法律允许的范围内有权代表该未成年人签署本协议。',
    continue: '继续',
    back: '返回',
    viewDocument: '查看文件',
    viewBeforeAccept: '同意前请先打开并阅读本文件。',
    acceptMania: '本人已阅读并同意 LAS VEGAS MANIA TOUR 弃权书。',
    acceptCanyonX: '本人已阅读并同意 Taadidiin Tours / Antelope Canyon X 弃权书。',
    acknowledgmentsTitle: '必要确认事项',
    ackRead: '本人已阅读适用的弃权及责任免除协议。',
    ackRisks: '本人理解参加涉及步行、徒步、户外条件、自然危害及交通相关活动等固有风险。',
    ackRelease: '本人理解协议包含对特定法律权利的免除以及风险承担。',
    ackRefuse: '本人理解可以拒绝本人认为不安全的活动、拍摄地点或姿势。',
    ackAccurate: '本人确认所提供的信息准确无误。',
    eSignConsent:
      '通过在下方电子签名，本人确认已阅读并理解适用协议，并自愿同意其条款。本人理解电子签名旨在与手写签名具有同等效力。',
    eSignAgree: '本人同意使用电子签名。',
    signHere: '在此签名',
    clear: '清除',
    undo: '撤销',
    submit: '签署并提交',
    signatureRequired: '请手绘签名。仅输入姓名不被接受。',
    signatureHint: '请用手指、触控笔或鼠标绘制签名。可使用清除重新开始，或使用撤销去掉最后一笔。',
    invalidToken: '此弃权书链接无效或已过期。',
    alreadySigned: '该参加者已签署所需弃权书。',
    notConfigured: '尚未提供',
    notConfiguredBody: '官方下羚羊峡谷运营商弃权书尚未配置。待官方表格提供后即可添加。',
    languageNoticeMania:
      '本译本仅为便利而提供。在适用法律允许的范围内，如本译本与英文版本存在任何不一致，应以英文版本为准。',
    languageNoticeCanyonX:
      '本译本旨在帮助您理解原始的 Taadidiin Tours 弃权书。官方运营商文件为英文版本。',
    progress: '进度',
    saving: '保存中…',
    errorGeneric: '出现问题，请重试。',
    validationRequired: '此项为必填。',
    validationEmail: '请输入有效的电子邮件地址。',
    validationPhone: '请输入有效的电话号码。',
    validationDob: '请输入有效的出生日期。',
    clearBetweenGuests: '已为下一位参加者清除上一份签名和确认事项。',
    ready: '已就绪',
    actionRequired: '需要处理',
    pending: '待完成',
    voided: '已作废',
    previewOnly: '预览模式。签名不会被保存。',
  },
  es: {
    ...EN,
    language: 'Idioma',
    requiredAgreements: 'Sus acuerdos requeridos',
    startWaiver: 'Comenzar exención',
    nextGuest: 'Siguiente huésped',
    nextParticipant: 'Siguiente participante',
    waiversCompleted: 'Exenciones completadas',
    allComplete: 'Todas las exenciones requeridas están completas',
    successTitle: 'Exención firmada correctamente',
    signed: 'Firmado',
    booking: 'Reserva',
    tour: 'Tour',
    completed: 'Completado',
    guestPlaceholder: 'Huésped',
    participantInfo: 'Información del participante',
    fullLegalName: 'Nombre legal completo',
    dateOfBirth: 'Fecha de nacimiento',
    tourDate: 'Fecha del tour',
    bookingNumber: 'Número de reserva',
    email: 'Correo electrónico',
    phone: 'Número de teléfono',
    emergencyContactName: 'Nombre del contacto de emergencia',
    emergencyContactPhone: 'Teléfono del contacto de emergencia',
    participantType: 'Tipo de participante',
    adult: 'Adulto',
    minor: 'Menor',
    guardianName: 'Nombre legal completo del padre / tutor legal',
    relationshipToMinor: 'Relación con el menor',
    guardianAck:
      'Declaro que soy el padre, la madre o el tutor legal del menor o menores identificados y que tengo autoridad para otorgar este Acuerdo en su nombre en la medida permitida por la ley aplicable.',
    continue: 'Continuar',
    back: 'Atrás',
    viewDocument: 'Ver documento',
    viewBeforeAccept: 'Abra y lea este documento antes de poder aceptar.',
    acceptMania: 'He leído y acepto la exención de LAS VEGAS MANIA TOUR.',
    acceptCanyonX: 'He leído y acepto la exención de Taadidiin Tours / Antelope Canyon X.',
    acknowledgmentsTitle: 'Reconocimientos requeridos',
    ackRead: 'He leído el o los Acuerdos de exención y liberación aplicables.',
    ackRisks:
      'Entiendo que la participación implica riesgos inherentes, incluidos caminar, hacer senderismo, condiciones al aire libre, peligros naturales y actividades relacionadas con el transporte.',
    ackRelease:
      'Entiendo que el o los acuerdos contienen exenciones de ciertos derechos legales y asunciones de riesgo.',
    ackRefuse:
      'Entiendo que puedo rechazar una actividad, un lugar de fotografía o una pose que considere insegura.',
    ackAccurate: 'Confirmo que la información que proporcioné es precisa.',
    eSignConsent:
      'Al firmar electrónicamente a continuación, confirmo que he leído y comprendido el o los Acuerdos aplicables y acepto voluntariamente sus términos. Entiendo que mi firma electrónica tiene el mismo efecto que mi firma manuscrita.',
    eSignAgree: 'Acepto usar una firma electrónica.',
    signHere: 'Firme aquí',
    clear: 'Borrar',
    undo: 'Deshacer',
    submit: 'Firmar y enviar',
    signatureRequired: 'Dibuje su firma. No se acepta un nombre escrito como única firma.',
    signatureHint:
      'Dibuje su firma con el dedo, un lápiz óptico o el ratón. Use Borrar para empezar de nuevo o Deshacer para quitar el último trazo.',
    invalidToken: 'Este enlace de exención no es válido o ha caducado.',
    alreadySigned: 'Este participante ya ha firmado las exenciones requeridas.',
    notConfigured: 'Aún no disponible',
    notConfiguredBody:
      'La exención oficial del operador de Lower Antelope Canyon aún no está configurada. Se añadirá cuando se proporcione el formulario oficial.',
    languageNoticeMania:
      'Esta traducción se proporciona por conveniencia. En la medida permitida por la ley aplicable, si existe alguna inconsistencia entre esta traducción y la versión en inglés, prevalecerá la versión en inglés.',
    languageNoticeCanyonX:
      'Esta traducción se proporciona para ayudarle a comprender la exención original de Taadidiin Tours. El documento oficial del operador es la versión en inglés.',
    progress: 'Progreso',
    saving: 'Guardando…',
    errorGeneric: 'Algo salió mal. Inténtelo de nuevo.',
    validationRequired: 'Este campo es obligatorio.',
    validationEmail: 'Introduzca un correo electrónico válido.',
    validationPhone: 'Introduzca un número de teléfono válido.',
    validationDob: 'Introduzca una fecha de nacimiento válida.',
    clearBetweenGuests: 'Se borraron la firma y los reconocimientos anteriores para el siguiente participante.',
    ready: 'Listo',
    actionRequired: 'Acción requerida',
    pending: 'Pendiente',
    voided: 'Anulado',
    previewOnly: 'Solo vista previa. Las firmas no se guardan.',
  },
  fr: {
    ...EN,
    language: 'Langue',
    requiredAgreements: 'Vos accords requis',
    startWaiver: 'Commencer la décharge',
    nextGuest: 'Client suivant',
    nextParticipant: 'Participant suivant',
    waiversCompleted: 'Décharges terminées',
    allComplete: 'Toutes les décharges requises sont terminées',
    successTitle: 'Décharge signée avec succès',
    signed: 'Signé',
    booking: 'Réservation',
    tour: 'Visite',
    completed: 'Terminé',
    guestPlaceholder: 'Client',
    participantInfo: 'Informations du participant',
    fullLegalName: 'Nom légal complet',
    dateOfBirth: 'Date de naissance',
    tourDate: 'Date de la visite',
    bookingNumber: 'Numéro de réservation',
    email: 'E-mail',
    phone: 'Numéro de téléphone',
    emergencyContactName: 'Nom du contact d’urgence',
    emergencyContactPhone: 'Téléphone du contact d’urgence',
    participantType: 'Type de participant',
    adult: 'Adulte',
    minor: 'Mineur',
    guardianName: 'Nom légal complet du parent / tuteur légal',
    relationshipToMinor: 'Lien avec le mineur',
    guardianAck:
      'Je déclare être le parent ou le tuteur légal du ou des participants mineurs identifiés et avoir le pouvoir d’exécuter le présent Accord en leur nom dans la mesure permise par le droit applicable.',
    continue: 'Continuer',
    back: 'Retour',
    viewDocument: 'Voir le document',
    viewBeforeAccept: 'Ouvrez et lisez ce document avant de pouvoir accepter.',
    acceptMania: 'J’ai lu et j’accepte la décharge de LAS VEGAS MANIA TOUR.',
    acceptCanyonX: 'J’ai lu et j’accepte la décharge Taadidiin Tours / Antelope Canyon X.',
    acknowledgmentsTitle: 'Accusés de réception requis',
    ackRead: 'J’ai lu le ou les accords de décharge et de libération applicables.',
    ackRisks:
      'Je comprends que la participation comporte des risques inhérents, notamment la marche, la randonnée, les conditions extérieures, les dangers naturels et les activités liées au transport.',
    ackRelease:
      'Je comprends que le ou les accords contiennent des décharges de certains droits légaux et des acceptations de risques.',
    ackRefuse:
      'Je comprends que je peux refuser une activité, un lieu de photographie ou une pose que je considère dangereux.',
    ackAccurate: 'Je confirme que les informations que j’ai fournies sont exactes.',
    eSignConsent:
      'En signant électroniquement ci-dessous, je confirme avoir lu et compris le ou les Accords applicables et en accepter volontairement les conditions. Je comprends que ma signature électronique est destinée à avoir le même effet que ma signature manuscrite.',
    eSignAgree: 'J’accepte d’utiliser une signature électronique.',
    signHere: 'Signez ici',
    clear: 'Effacer',
    undo: 'Annuler',
    submit: 'Signer et envoyer',
    signatureRequired: 'Veuillez dessiner votre signature. Un nom dactylographié n’est pas accepté comme seule signature.',
    signatureHint:
      'Dessinez votre signature avec le doigt, un stylet ou la souris. Utilisez Effacer pour recommencer ou Annuler pour retirer le dernier trait.',
    invalidToken: 'Ce lien de décharge est invalide ou a expiré.',
    alreadySigned: 'Ce participant a déjà signé les décharges requises.',
    notConfigured: 'Pas encore disponible',
    notConfiguredBody:
      'La décharge officielle de l’exploitant de Lower Antelope Canyon n’est pas encore configurée. Elle sera ajoutée lorsque le formulaire officiel sera fourni.',
    languageNoticeMania:
      'Cette traduction est fournie pour des raisons de commodité. Dans la mesure permise par le droit applicable, en cas d’incohérence entre cette traduction et la version anglaise, la version anglaise prévaut.',
    languageNoticeCanyonX:
      'Cette traduction est fournie pour vous aider à comprendre la décharge originale de Taadidiin Tours. Le document officiel de l’exploitant est la version anglaise.',
    progress: 'Progression',
    saving: 'Enregistrement…',
    errorGeneric: 'Une erreur s’est produite. Veuillez réessayer.',
    validationRequired: 'Ce champ est obligatoire.',
    validationEmail: 'Saisissez une adresse e-mail valide.',
    validationPhone: 'Saisissez un numéro de téléphone valide.',
    validationDob: 'Saisissez une date de naissance valide.',
    clearBetweenGuests: 'La signature et les confirmations précédentes ont été effacées pour le participant suivant.',
    ready: 'Prêt',
    actionRequired: 'Action requise',
    pending: 'En attente',
    voided: 'Annulé',
    previewOnly: 'Aperçu uniquement. Les signatures ne sont pas enregistrées.',
  },
  de: {
    ...EN,
    language: 'Sprache',
    requiredAgreements: 'Ihre erforderlichen Vereinbarungen',
    startWaiver: 'Haftungsausschluss beginnen',
    nextGuest: 'Nächster Gast',
    nextParticipant: 'Nächster Teilnehmer',
    waiversCompleted: 'Abgeschlossene Haftungsausschlüsse',
    allComplete: 'Alle erforderlichen Haftungsausschlüsse sind abgeschlossen',
    successTitle: 'Haftungsausschluss erfolgreich unterzeichnet',
    signed: 'Unterzeichnet',
    booking: 'Buchung',
    tour: 'Tour',
    completed: 'Abgeschlossen',
    guestPlaceholder: 'Gast',
    participantInfo: 'Teilnehmerangaben',
    fullLegalName: 'Vollständiger rechtlicher Name',
    dateOfBirth: 'Geburtsdatum',
    tourDate: 'Tourdatum',
    bookingNumber: 'Buchungs- / Reservierungsnummer',
    email: 'E-Mail',
    phone: 'Telefonnummer',
    emergencyContactName: 'Name des Notfallkontakts',
    emergencyContactPhone: 'Telefon des Notfallkontakts',
    participantType: 'Teilnehmertyp',
    adult: 'Erwachsener',
    minor: 'Minderjähriger',
    guardianName: 'Vollständiger rechtlicher Name des Elternteils / gesetzlichen Vormunds',
    relationshipToMinor: 'Beziehung zum Minderjährigen',
    guardianAck:
      'Ich erkläre, dass ich Elternteil oder gesetzlicher Vormund des oder der genannten minderjährigen Teilnehmer bin und befugt bin, diese Vereinbarung im gesetzlich zulässigen Umfang in deren Namen abzuschließen.',
    continue: 'Weiter',
    back: 'Zurück',
    viewDocument: 'Dokument ansehen',
    viewBeforeAccept: 'Öffnen und lesen Sie dieses Dokument, bevor Sie zustimmen können.',
    acceptMania: 'Ich habe den Haftungsausschluss von LAS VEGAS MANIA TOUR gelesen und stimme ihm zu.',
    acceptCanyonX: 'Ich habe den Haftungsausschluss von Taadidiin Tours / Antelope Canyon X gelesen und stimme ihm zu.',
    acknowledgmentsTitle: 'Erforderliche Bestätigungen',
    ackRead: 'Ich habe die geltende(n) Haftungsausschluss- und Freistellungsvereinbarung(en) gelesen.',
    ackRisks:
      'Ich verstehe, dass die Teilnahme inhärente Risiken umfasst, darunter Gehen, Wandern, Outdoor-Bedingungen, natürliche Gefahren und transportbezogene Aktivitäten.',
    ackRelease:
      'Ich verstehe, dass die Vereinbarung(en) den Verzicht auf bestimmte rechtliche Ansprüche und die Übernahme von Risiken enthalten.',
    ackRefuse:
      'Ich verstehe, dass ich eine Aktivität, einen Fotoort oder eine Pose ablehnen darf, die ich für unsicher halte.',
    ackAccurate: 'Ich bestätige, dass die von mir angegebenen Informationen zutreffend sind.',
    eSignConsent:
      'Mit der elektronischen Unterschrift unten bestätige ich, dass ich die geltende(n) Vereinbarung(en) gelesen und verstanden habe und ihren Bedingungen freiwillig zustimme. Ich verstehe, dass meine elektronische Unterschrift dieselbe Wirkung wie meine handschriftliche Unterschrift haben soll.',
    eSignAgree: 'Ich stimme der Verwendung einer elektronischen Unterschrift zu.',
    signHere: 'Hier unterschreiben',
    clear: 'Löschen',
    undo: 'Rückgängig',
    submit: 'Unterschreiben und senden',
    signatureRequired: 'Bitte zeichnen Sie Ihre Unterschrift. Ein getippter Name wird nicht als alleinige Unterschrift akzeptiert.',
    signatureHint:
      'Zeichnen Sie Ihre Unterschrift mit Finger, Stift oder Maus. Mit Löschen beginnen Sie neu, mit Rückgängig entfernen Sie den letzten Strich.',
    invalidToken: 'Dieser Haftungsausschluss-Link ist ungültig oder abgelaufen.',
    alreadySigned: 'Dieser Teilnehmer hat die erforderlichen Haftungsausschlüsse bereits unterzeichnet.',
    notConfigured: 'Noch nicht verfügbar',
    notConfiguredBody:
      'Der offizielle Haftungsausschluss des Lower-Antelope-Canyon-Betreibers ist noch nicht konfiguriert. Er wird hinzugefügt, sobald das offizielle Formular vorliegt.',
    languageNoticeMania:
      'Diese Übersetzung wird zur Erleichterung bereitgestellt. Soweit nach geltendem Recht zulässig, gilt bei Unstimmigkeiten zwischen dieser Übersetzung und der englischen Fassung die englische Fassung.',
    languageNoticeCanyonX:
      'Diese Übersetzung wird bereitgestellt, um Ihnen das Verständnis des ursprünglichen Taadidiin-Tours-Haftungsausschlusses zu erleichtern. Das offizielle Betreiberdokument ist die englische Fassung.',
    progress: 'Fortschritt',
    saving: 'Speichern…',
    errorGeneric: 'Etwas ist schiefgelaufen. Bitte versuchen Sie es erneut.',
    validationRequired: 'Dieses Feld ist erforderlich.',
    validationEmail: 'Geben Sie eine gültige E-Mail-Adresse ein.',
    validationPhone: 'Geben Sie eine gültige Telefonnummer ein.',
    validationDob: 'Geben Sie ein gültiges Geburtsdatum ein.',
    clearBetweenGuests: 'Unterschrift und Bestätigungen des vorherigen Teilnehmers wurden für den nächsten Teilnehmer gelöscht.',
    ready: 'Bereit',
    actionRequired: 'Handlung erforderlich',
    pending: 'Ausstehend',
    voided: 'Ungültig',
    previewOnly: 'Nur Vorschau. Unterschriften werden nicht gespeichert.',
  },
}

export function getWaiverUi(locale: WaiverLocale): WaiverUiCopy {
  return WAIVER_UI[locale] ?? WAIVER_UI.en
}
