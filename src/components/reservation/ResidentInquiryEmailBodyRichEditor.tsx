'use client'

import { useEffect, type ReactNode } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Underline from '@tiptap/extension-underline'
import Placeholder from '@tiptap/extension-placeholder'
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  List,
  ListOrdered,
  Link2,
  Undo2,
  Redo2,
} from 'lucide-react'

export interface ResidentInquiryEmailBodyRichEditorProps {
  /** 카드 div 안쪽 HTML 조각(치환 변수 문자열 포함 가능). */
  value: string
  onChange: (html: string) => void
  disabled?: boolean
  /** 플레이스홀더 문구용 UI 로케일 */
  uiLocale?: string
  placeholder?: string
}

function ToolbarButton({
  active,
  disabled,
  onClick,
  title,
  children,
}: {
  active?: boolean
  disabled?: boolean
  onClick: () => void
  title: string
  children: ReactNode
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={`rounded px-2 py-1 text-gray-700 hover:bg-gray-200 disabled:opacity-40 ${
        active ? 'bg-gray-200 font-semibold text-gray-900' : ''
      }`}
    >
      {children}
    </button>
  )
}

export default function ResidentInquiryEmailBodyRichEditor({
  value,
  onChange,
  disabled = false,
  uiLocale = 'ko',
  placeholder,
}: ResidentInquiryEmailBodyRichEditorProps) {
  const defaultPlaceholder =
    uiLocale === 'en'
      ? 'Message body… Keep placeholders like {{FLOW_LINK_BLOCK}} as plain text.'
      : '본문을 편집하세요. {{FLOW_LINK_BLOCK}} 등 치환 변수는 지우지 마세요.'

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        autolink: true,
        linkOnPaste: true,
        HTMLAttributes: { class: 'text-teal-700 underline font-medium' },
      }),
      Placeholder.configure({ placeholder: placeholder ?? defaultPlaceholder }),
    ],
    content: value,
    editable: !disabled,
    editorProps: {
      attributes: {
        class:
          'resident-inquiry-rich-editor-prose min-h-[220px] max-w-none px-2 py-2 text-sm leading-relaxed text-gray-900 focus:outline-none [&_a]:text-teal-700 [&_a]:underline [&_h2]:mt-4 [&_h2]:mb-2 [&_h2]:text-base [&_h2]:font-semibold [&_h3]:text-sm [&_h3]:font-semibold [&_ul]:my-2 [&_ol]:my-2 [&_p]:my-2 [&_li]:my-0.5',
      },
    },
    onUpdate: ({ editor: ed }) => {
      onChange(ed.getHTML())
    },
  })

  useEffect(() => {
    editor?.setEditable(!disabled)
  }, [disabled, editor])

  const runLink = () => {
    if (!editor) return
    const prev = editor.getAttributes('link').href as string | undefined
    const next = window.prompt(
      uiLocale === 'en' ? 'Link URL (https://…)' : '링크 주소 (https://…)',
      prev ?? 'https://'
    )
    if (next === null) return
    const trimmed = next.trim()
    if (trimmed === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
      return
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: trimmed }).run()
  }

  if (!editor) {
    return (
      <div className="min-h-[260px] animate-pulse rounded border border-gray-200 bg-gray-50" aria-hidden />
    )
  }

  return (
    <div className="overflow-hidden rounded border border-gray-300 bg-white">
      <div className="flex flex-wrap items-center gap-0.5 border-b border-gray-200 bg-gray-50 px-1 py-1">
        <ToolbarButton
          title={uiLocale === 'en' ? 'Bold' : '굵게'}
          disabled={disabled}
          active={editor.isActive('bold')}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <Bold className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          title={uiLocale === 'en' ? 'Italic' : '기울임'}
          disabled={disabled}
          active={editor.isActive('italic')}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <Italic className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          title={uiLocale === 'en' ? 'Underline' : '밑줄'}
          disabled={disabled}
          active={editor.isActive('underline')}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
        >
          <UnderlineIcon className="h-4 w-4" />
        </ToolbarButton>
        <span className="mx-1 h-5 w-px bg-gray-300" aria-hidden />
        <ToolbarButton
          title={uiLocale === 'en' ? 'Bullet list' : '글머리 기호'}
          disabled={disabled}
          active={editor.isActive('bulletList')}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <List className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          title={uiLocale === 'en' ? 'Numbered list' : '번호 목록'}
          disabled={disabled}
          active={editor.isActive('orderedList')}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered className="h-4 w-4" />
        </ToolbarButton>
        <span className="mx-1 h-5 w-px bg-gray-300" aria-hidden />
        <ToolbarButton
          title={uiLocale === 'en' ? 'Link' : '링크'}
          disabled={disabled}
          active={editor.isActive('link')}
          onClick={() => runLink()}
        >
          <Link2 className="h-4 w-4" />
        </ToolbarButton>
        <span className="mx-1 h-5 w-px bg-gray-300" aria-hidden />
        <ToolbarButton
          title={uiLocale === 'en' ? 'Undo' : '실행 취소'}
          disabled={disabled || !editor.can().undo()}
          onClick={() => editor.chain().focus().undo().run()}
        >
          <Undo2 className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          title={uiLocale === 'en' ? 'Redo' : '다시 실행'}
          disabled={disabled || !editor.can().redo()}
          onClick={() => editor.chain().focus().redo().run()}
        >
          <Redo2 className="h-4 w-4" />
        </ToolbarButton>
      </div>
      <EditorContent editor={editor} />
    </div>
  )
}
