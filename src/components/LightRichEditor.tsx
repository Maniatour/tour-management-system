'use client'

import React, { useRef, useState, useCallback } from 'react'

// 마크다운을 HTML로 변환하는 함수
const markdownToHtml = (markdown: string): string => {
  let html = markdown
  
  // 이미지 변환: ![alt](src) -> <img src="src" alt="alt" />
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" style="max-width: 100%; height: auto; margin: 8px 0; border-radius: 4px; display: block;" />')
  
  // 굵게 변환: **text** -> <strong>text</strong>
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  
  // 기울임 변환: *text* -> <em>text</em>
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>')
  
  // 링크 변환: [text](url) -> <a href="url" target="_blank">text</a>
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" style="color: #3b82f6; text-decoration: underline;">$1</a>')
  
  // 목록 변환: - item -> <li>item</li>
  html = html.replace(/^- (.+)$/gm, '<li>$1</li>')
  
  // 줄바꿈을 <br>로 변환
  html = html.replace(/\n/g, '<br>')
  
  return html
}

// HTML을 마크다운으로 변환하는 함수
const htmlToMarkdown = (html: string): string => {
  let markdown = html
  
  // 이미지 변환: <img src="..." alt="..." /> -> ![alt](src)
  markdown = markdown.replace(/<img[^>]+src="([^"]+)"[^>]*alt="([^"]*)"[^>]*\/?>/g, '![$2]($1)')
  markdown = markdown.replace(/<img[^>]+src="([^"]+)"[^>]*\/?>/g, '![]($1)')
  
  // 굵게 변환: <strong>text</strong> -> **text**
  markdown = markdown.replace(/<strong[^>]*>(.*?)<\/strong>/g, '**$1**')
  markdown = markdown.replace(/<b[^>]*>(.*?)<\/b>/g, '**$1**')
  
  // 기울임 변환: <em>text</em> -> *text*
  markdown = markdown.replace(/<em[^>]*>(.*?)<\/em>/g, '*$1*')
  markdown = markdown.replace(/<i[^>]*>(.*?)<\/i>/g, '*$1*')
  
  // 링크 변환: <a href="url">text</a> -> [text](url)
  markdown = markdown.replace(/<a[^>]+href="([^"]+)"[^>]*>(.*?)<\/a>/g, '[$2]($1)')
  
  // 목록 변환: <li>item</li> -> - item
  markdown = markdown.replace(/<li[^>]*>(.*?)<\/li>/g, '- $1')
  
  // 줄바꿈 변환: <br> -> \n
  markdown = markdown.replace(/<br\s*\/?>/g, '\n')
  
  // HTML 태그 제거
  markdown = markdown.replace(/<[^>]*>/g, '')
  
  return markdown
}

// 에디터 props 인터페이스
interface LightRichEditorProps {
  value: string
  onChange: (value: string | undefined) => void
  height?: number
  placeholder?: string
  className?: string
  showToolbar?: boolean
  enableImageUpload?: boolean
  enableColorPicker?: boolean
  enableFontSize?: boolean
  enableLink?: boolean
  enableList?: boolean
  enableBold?: boolean
  enableItalic?: boolean
  enableUnderline?: boolean
  enableResize?: boolean
  minHeight?: number
  maxHeight?: number
}

// 가벼운 리치 텍스트 에디터 컴포넌트
const LightRichEditor: React.FC<LightRichEditorProps> = ({
  value,
  onChange,
  height = 200,
  placeholder = "텍스트를 입력하세요... (Ctrl+B: 굵게, Ctrl+I: 기울임, Ctrl+U: 밑줄)",
  className = "",
  showToolbar = true,
  enableImageUpload = true,
  enableColorPicker = true,
  enableFontSize = true,
  enableLink = true,
  enableList = true,
  enableBold = true,
  enableItalic = true,
  enableUnderline = true,
  enableResize = true,
  minHeight = 100,
  maxHeight = 800
}) => {
  const editorRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const isInitializedRef = useRef(false)
  
  // 드롭다운 상태 관리
  const [showColorPicker, setShowColorPicker] = useState(false)
  const [showFontSizePicker, setShowFontSizePicker] = useState(false)
  
  // 사이즈 조정 상태 관리
  const [currentHeight, setCurrentHeight] = useState(height)
  
  // 미리 정의된 색상 팔레트 (고유한 색상들)
  const colorPalette = [
    // 기본 색상
    '#000000', '#333333', '#666666', '#999999', '#CCCCCC', '#FFFFFF',
    // 빨간색 계열
    '#FF0000', '#CC0000', '#990000', '#FF3333', '#FF6666', '#FF9999',
    // 주황색 계열
    '#FF6600', '#FF9900', '#FFCC00', '#FFD700', '#FFA500', '#FF8C00',
    // 초록색 계열
    '#00FF00', '#00CC00', '#009900', '#00FF33', '#00FF66', '#00FF99',
    // 파란색 계열
    '#0066FF', '#0099FF', '#00CCFF', '#00FFFF', '#0000FF', '#3333FF',
    // 보라색 계열
    '#6600FF', '#9900FF', '#CC00FF', '#FF00FF', '#9966FF', '#CC99FF',
    // 분홍색 계열
    '#FF0066', '#FF3366', '#FF6699', '#FF99CC', '#FFCCFF', '#FFB6C1'
  ]
  
  // 폰트 크기 옵션
  const fontSizeOptions = [
    { label: '8px', value: '8px' },
    { label: '9px', value: '9px' },
    { label: '10px', value: '10px' },
    { label: '11px', value: '11px' },
    { label: '12px', value: '12px' },
    { label: '14px', value: '14px' },
    { label: '16px', value: '16px' },
    { label: '18px', value: '18px' },
    { label: '20px', value: '20px' },
    { label: '24px', value: '24px' },
    { label: '28px', value: '28px' },
    { label: '32px', value: '32px' },
    { label: '36px', value: '36px' },
    { label: '48px', value: '48px' },
    { label: '72px', value: '72px' }
  ]

  // 에디터 초기화 (한 번만 실행)
  React.useEffect(() => {
    if (editorRef.current && value && !isInitializedRef.current) {
      const htmlContent = markdownToHtml(value)
      editorRef.current.innerHTML = htmlContent
      isInitializedRef.current = true
    }
  }, [value])

  // 드롭다운 외부 클릭 시 닫기
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showColorPicker || showFontSizePicker) {
        const target = event.target as HTMLElement
        if (!target.closest('.relative')) {
          setShowColorPicker(false)
          setShowFontSizePicker(false)
        }
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showColorPicker, showFontSizePicker])

  // 사이즈 조정 이벤트 핸들러 (단순화)
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    console.log('드래그 시작') // 디버깅용
    
    const startY = e.clientY
    const startHeight = currentHeight
    
    const handleMouseMove = (e: MouseEvent) => {
      e.preventDefault()
      const deltaY = e.clientY - startY
      const newHeight = Math.max(minHeight, Math.min(maxHeight, startHeight + deltaY))
      setCurrentHeight(newHeight)
    }
    
    const handleMouseUp = () => {
      console.log('드래그 종료') // 디버깅용
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
    
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }, [currentHeight, minHeight, maxHeight])

  // 에디터 내용 업데이트
  const updateEditorContent = () => {
    if (editorRef.current && isInitializedRef.current) {
      const htmlContent = editorRef.current.innerHTML
      const markdownContent = htmlToMarkdown(htmlContent)
      onChange(markdownContent)
    }
  }

  const insertLink = () => {
    const url = prompt('링크 URL을 입력하세요:')
    if (url) {
      const text = prompt('링크 텍스트를 입력하세요:', '링크')
      if (text) {
        const linkHtml = `<a href="${url}" target="_blank" rel="noopener noreferrer" style="color: #3b82f6; text-decoration: underline;">${text}</a>`
        document.execCommand('insertHTML', false, linkHtml)
        setTimeout(updateEditorContent, 0)
      }
    }
  }

  const insertList = () => {
    document.execCommand('insertUnorderedList')
    setTimeout(updateEditorContent, 0)
  }

  // 이미지 삽입
  const insertImage = () => {
    fileInputRef.current?.click()
  }

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.onload = (event) => {
        const imageUrl = event.target?.result as string
        const imageHtml = `<img src="${imageUrl}" alt="${file.name}" style="max-width: 100%; height: auto; margin: 8px 0; border-radius: 4px; display: block;" />`
        document.execCommand('insertHTML', false, imageHtml)
        setTimeout(updateEditorContent, 0)
      }
      reader.readAsDataURL(file)
    }
  }

  // 글자색 적용
  const applyColor = (color: string) => {
    document.execCommand('foreColor', false, color)
    setTimeout(updateEditorContent, 0)
    setShowColorPicker(false)
  }

  // 글자 크기 적용
  const applyFontSize = (size: string) => {
    const selection = window.getSelection()
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0)
      const span = document.createElement('span')
      span.style.fontSize = size
      try {
        range.surroundContents(span)
        setTimeout(updateEditorContent, 0)
      } catch {
        console.log('Cannot surround contents')
      }
    }
    setShowFontSizePicker(false)
  }

  return (
    <div className={`border border-gray-300 rounded overflow-hidden ${className}`}>
      {/* 툴바 */}
      {showToolbar && (
        <div className="bg-gray-50 border-b border-gray-200 p-2 flex flex-wrap gap-1">
          {enableBold && (
            <button
              type="button"
              onClick={() => {
                document.execCommand('bold')
                setTimeout(updateEditorContent, 0)
              }}
              className="px-3 py-1 text-sm bg-white border border-gray-300 rounded hover:bg-gray-100 font-bold"
              title="굵게 (Ctrl+B)"
            >
              B
            </button>
          )}
          {enableItalic && (
            <button
              type="button"
              onClick={() => {
                document.execCommand('italic')
                setTimeout(updateEditorContent, 0)
              }}
              className="px-3 py-1 text-sm bg-white border border-gray-300 rounded hover:bg-gray-100 italic"
              title="기울임 (Ctrl+I)"
            >
              I
            </button>
          )}
          {enableUnderline && (
            <button
              type="button"
              onClick={() => {
                document.execCommand('underline')
                setTimeout(updateEditorContent, 0)
              }}
              className="px-3 py-1 text-sm bg-white border border-gray-300 rounded hover:bg-gray-100 underline"
              title="밑줄 (Ctrl+U)"
            >
              U
            </button>
          )}
          {(enableBold || enableItalic || enableUnderline) && (
            <div className="w-px bg-gray-300 mx-1"></div>
          )}
          {enableList && (
            <button
              type="button"
              onClick={insertList}
              className="px-3 py-1 text-sm bg-white border border-gray-300 rounded hover:bg-gray-100"
              title="목록"
            >
              • 목록
            </button>
          )}
          {enableLink && (
            <button
              type="button"
              onClick={insertLink}
              className="px-3 py-1 text-sm bg-white border border-gray-300 rounded hover:bg-gray-100"
              title="링크"
            >
              🔗 링크
            </button>
          )}
          {enableImageUpload && (
            <button
              type="button"
              onClick={insertImage}
              className="px-3 py-1 text-sm bg-white border border-gray-300 rounded hover:bg-gray-100"
              title="이미지 삽입"
            >
              🖼️ 이미지
            </button>
          )}
          {(enableList || enableLink || enableImageUpload) && (
            <div className="w-px bg-gray-300 mx-1"></div>
          )}
          
          {/* 색상 선택기 */}
          {enableColorPicker && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowColorPicker(!showColorPicker)}
                className="px-3 py-1 text-sm bg-white border border-gray-300 rounded hover:bg-gray-100 flex items-center gap-1"
                title="글자색"
              >
                <span style={{ color: '#000000' }}>A</span>
                <span className="text-xs">▼</span>
              </button>
              {showColorPicker && (
                <div className="absolute top-full left-0 mt-1 bg-white border border-gray-300 rounded shadow-lg p-2 z-10">
                  <div className="grid grid-cols-6 gap-1 w-48">
                    {colorPalette.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => applyColor(color)}
                        className="w-6 h-6 border border-gray-300 rounded hover:scale-110 transition-transform"
                        style={{ backgroundColor: color }}
                        title={color}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          
          {/* 폰트 크기 선택기 */}
          {enableFontSize && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowFontSizePicker(!showFontSizePicker)}
                className="px-3 py-1 text-sm bg-white border border-gray-300 rounded hover:bg-gray-100 flex items-center gap-1"
                title="글자 크기"
              >
                <span>12px</span>
                <span className="text-xs">▼</span>
              </button>
              {showFontSizePicker && (
                <div className="absolute top-full left-0 mt-1 bg-white border border-gray-300 rounded shadow-lg z-10">
                  <div className="max-h-48 overflow-y-auto">
                    {fontSizeOptions.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => applyFontSize(option.value)}
                        className="w-full px-3 py-1 text-sm text-left hover:bg-gray-100 flex items-center justify-between"
                      >
                        <span>{option.label}</span>
                        <span style={{ fontSize: option.value }}>A</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
      
      {/* 에디터 영역 */}
      <div 
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning={true}
        onInput={updateEditorContent}
        onBlur={updateEditorContent}
        onKeyUp={updateEditorContent}
        onPaste={() => {
          setTimeout(() => {
            updateEditorContent()
          }, 0)
        }}
        onKeyDown={(e) => {
          // Ctrl+B: 굵게
          if (e.ctrlKey && e.key === 'b' && enableBold) {
            e.preventDefault()
            document.execCommand('bold')
            setTimeout(updateEditorContent, 0)
          }
          // Ctrl+I: 기울임
          else if (e.ctrlKey && e.key === 'i' && enableItalic) {
            e.preventDefault()
            document.execCommand('italic')
            setTimeout(updateEditorContent, 0)
          }
          // Ctrl+U: 밑줄
          else if (e.ctrlKey && e.key === 'u' && enableUnderline) {
            e.preventDefault()
            document.execCommand('underline')
            setTimeout(updateEditorContent, 0)
          }
        }}
        className="w-full p-4 focus:outline-none text-sm"
        style={{ 
          height: `${currentHeight}px`,
          lineHeight: '1.6',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          whiteSpace: 'pre-wrap'
        }}
        data-placeholder={placeholder}
      />
      
      {/* 사이즈 조정 핸들 */}
      {enableResize && (
        <div
          onMouseDown={handleMouseDown}
          className="w-full h-4 bg-gray-200 hover:bg-gray-300 cursor-ns-resize flex items-center justify-center group transition-colors border-t border-gray-300 relative"
          style={{ 
            cursor: 'ns-resize',
            userSelect: 'none'
          }}
        >
          <div className="w-16 h-1 bg-gray-500 group-hover:bg-gray-600 rounded transition-colors"></div>
          <div className="absolute inset-0 flex items-center justify-center text-xs text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity">
            드래그하여 크기 조정
          </div>
        </div>
      )}
      
      {/* 숨겨진 파일 입력 */}
      {enableImageUpload && (
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleImageUpload}
          className="hidden"
        />
      )}
    </div>
  )
}

export default LightRichEditor
