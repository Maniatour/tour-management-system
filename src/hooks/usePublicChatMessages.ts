import { useMemo } from 'react'
import ko from '@/i18n/locales/ko.json'
import en from '@/i18n/locales/en.json'
import type { SupportedLanguage } from '@/lib/translation'

type PublicChatMessages = typeof ko.publicChat
type PublicChatTutorialMessages = typeof ko.publicChatTutorial

function interpolate(template: string, vars?: Record<string, string | number>) {
  if (!vars) return template
  let result = template
  Object.entries(vars).forEach(([key, value]) => {
    result = result.replace(`{${key}}`, String(value))
  })
  return result
}

export function usePublicChatMessages(language: SupportedLanguage) {
  return useMemo(() => {
    const messages = (language === 'ko' ? ko.publicChat : en.publicChat) as PublicChatMessages
    return (key: keyof PublicChatMessages, vars?: Record<string, string | number>) =>
      interpolate(messages[key], vars)
  }, [language])
}

export function usePublicChatTutorial(language: SupportedLanguage) {
  return useMemo(() => {
    const messages = (
      language === 'ko' ? ko.publicChatTutorial : en.publicChatTutorial
    ) as PublicChatTutorialMessages
    return (key: keyof PublicChatTutorialMessages, vars?: Record<string, string | number>) =>
      interpolate(messages[key], vars)
  }, [language])
}
