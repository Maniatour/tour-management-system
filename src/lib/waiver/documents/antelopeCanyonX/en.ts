import {
  ANTELOPE_CANYON_X_WAIVER_VERSION,
  type WaiverDocumentContent,
} from '@/lib/waiver/types'

/**
 * Official operator document: TAADIDIIN TOURS — WAIVER FORM
 * Operator: Taadidiin Tours L.L.C. (TT LLC)
 * Relates to: Antelope Canyon X / Cardiac Canyon
 *
 * This English text is the governing operator form stored for electronic
 * presentation and for generating the printable two-page operator packet.
 * Do not substitute Las Vegas Mania Tour for Taadidiin Tours.
 *
 * Source type: OFFICIAL_OPERATOR_FORM
 * If Taadidiin provides a revised printed form, create a new version rather
 * than editing this snapshot.
 */
export const ANTELOPE_CANYON_X_WAIVER_EN: WaiverDocumentContent = {
  code: 'ANTELOPE_CANYON_X',
  version: ANTELOPE_CANYON_X_WAIVER_VERSION,
  operatorName: 'Taadidiin Tours L.L.C.',
  title: 'TAADIDIIN TOURS — WAIVER FORM',
  subtitle:
    'HIKING AND PHOTOGRAPHY TOUR RELEASE OF LIABILITY, WAIVER OF LEGAL RIGHTS AND ASSUMPTION OF RISK',
  warning:
    'IMPORTANT: PLEASE READ CAREFULLY BEFORE SIGNING. THIS DOCUMENT AFFECTS YOUR LEGAL RIGHTS.',
  intro: [
    'I hereby acknowledge that I have voluntarily applied to participate in a hiking and/or photography tour of Antelope Canyon X and/or Cardiac Canyon operated by Taadidiin Tours L.L.C. ("TT LLC").',
    'In consideration of being permitted to participate, I agree to the following terms.',
  ],
  sections: [
    {
      number: '1',
      title: 'Rules, Warnings, and Instructions',
      paragraphs: [
        'I agree to observe and obey all posted rules, written warnings, and verbal instructions and directions given by TT LLC, or the employees, representatives, or agents of TT LLC.',
      ],
    },
    {
      number: '2',
      title: 'Dirt Terrain and Assumption of Risk',
      paragraphs: [
        'I recognize that the tour involves walking and hiking on dirt terrain and other natural surfaces, and that there are inherent risks associated with this activity.',
        'I assume full responsibility for personal injury to myself and, if applicable, my family members, and I understand that participation may result in death, personal injuries, or other damage.',
        'I release and discharge TT LLC for injury, loss, or damage arising out of my or my family\'s participation in the tour or presence upon the facilities used by TT LLC, whether caused by the fault of myself, my family, TT LLC, or other third parties, to the fullest extent permitted by law.',
      ],
    },
    {
      number: '3',
      title: 'No Legal Action or Claim',
      paragraphs: [
        'I agree not to bring any legal action or make any claim against Taadidiin Tours L.L.C. related to my participation in the tour, to the fullest extent permitted by applicable law.',
      ],
    },
    {
      number: '4',
      title: 'Indemnity and Defense',
      paragraphs: [
        'I agree to indemnify and defend Taadidiin Tours L.L.C. against all claims, causes of action, damages, judgments, costs or expenses, including attorney fees and other litigation costs, which may in any way arise from my or my family\'s participation in the tour or presence upon the facilities used by TT LLC.',
      ],
    },
    {
      number: '5',
      title: 'Health, Voluntary Participation, and Medical Assistance',
      paragraphs: [
        'I represent that I am in good health and proper physical condition to participate in this activity.',
        'I acknowledge that I am voluntarily participating and that I assume all risks associated with the tour.',
        'I authorize TT LLC to provide or obtain medical assistance as reasonably necessary.',
      ],
    },
  ],
  closing: [
    'I HAVE READ THIS RELEASE OF LIABILITY, WAIVER OF LEGAL RIGHTS AND ASSUMPTION OF RISK AND FULLY UNDERSTAND ITS TERMS.',
    'I UNDERSTAND THE RISKS DESCRIBED ABOVE. I AM SIGNING VOLUNTARILY. I HAD THE OPPORTUNITY TO ASK QUESTIONS.',
    'I ASSUME THE RISKS FOR MYSELF AND, IF APPLICABLE, FOR MINOR CHILDREN FOR WHOM I AM AUTHORIZED TO SIGN.',
    'All participants must print their name and sign this Release of Liability Waiver before participating. For minors, the parent or legal guardian prints the minor\'s name and age and signs on behalf of the minor.',
  ],
  languageNotice:
    'This translation is provided to assist you in understanding the original Taadidiin Tours waiver. The official operator document is the English version.',
  governingLanguage: 'en',
}
