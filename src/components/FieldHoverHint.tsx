'use client'

import { CircleHelp } from 'lucide-react'

export default function FieldHoverHint({ text }: { text: string }) {
  return (
    <span
      className="group relative ml-1 inline-flex cursor-help align-middle"
      tabIndex={0}
      aria-label={text}
    >
      <CircleHelp
        className="h-3.5 w-3.5 text-gray-400 transition-colors group-hover:text-gray-700 group-focus:text-gray-700"
        aria-hidden
      />
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-2 w-60 -translate-x-1/2 rounded-lg bg-gray-900 px-2.5 py-2 text-left text-[11px] font-normal leading-relaxed text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100 group-focus:opacity-100"
      >
        {text}
      </span>
    </span>
  )
}
