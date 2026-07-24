'use client'

import { useEffect, useState } from 'react'

export function formatCommaSeparatedValues(values: string[]): string {
  return values.join(', ')
}

export function parseCommaSeparatedValues(input: string): string[] {
  return input
    .split(',')
    .map((segment) => segment.trim())
    .filter(Boolean)
}

/** 입력 중에도 단어 사이·끝 공백을 유지하면서 완료된(쉼표 앞) 항목만 정규화 */
export function parseCommaSeparatedLive(input: string): string[] {
  if (!input) return []
  const parts = input.split(',')
  const completed = parts.slice(0, -1).map((segment) => segment.trim()).filter(Boolean)
  const current = parts[parts.length - 1] ?? ''
  if (current.length > 0 || input.endsWith(',')) {
    return [...completed, current.trimStart()]
  }
  return completed
}

type CommaSeparatedTextInputProps = {
  value: string[]
  onChange: (next: string[]) => void
  placeholder?: string
  className?: string
}

export default function CommaSeparatedTextInput({
  value,
  onChange,
  placeholder,
  className,
}: CommaSeparatedTextInputProps) {
  const [text, setText] = useState(() => formatCommaSeparatedValues(value))

  useEffect(() => {
    const normalized = formatCommaSeparatedValues(value)
    setText((current) => {
      const currentParsed = parseCommaSeparatedLive(current).join('\u0001')
      const nextParsed = value.join('\u0001')
      return currentParsed === nextParsed ? current : normalized
    })
  }, [value])

  return (
    <input
      type="text"
      value={text}
      onChange={(e) => {
        const nextText = e.target.value
        setText(nextText)
        onChange(parseCommaSeparatedLive(nextText))
      }}
      onBlur={() => {
        const parsed = parseCommaSeparatedValues(text)
        const normalized = formatCommaSeparatedValues(parsed)
        setText(normalized)
        onChange(parsed)
      }}
      placeholder={placeholder}
      className={className}
    />
  )
}
