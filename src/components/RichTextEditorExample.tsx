'use client'

import React, { useState } from 'react'
import LightRichEditor from '@/components/LightRichEditor'

// 사용 예시 컴포넌트
const RichTextEditorExample: React.FC = () => {
  const [content, setContent] = useState('')
  const [simpleContent, setSimpleContent] = useState('')
  const [minimalContent, setMinimalContent] = useState('')

  return (
    <div className="p-8 space-y-8">
      <h1 className="text-3xl font-bold mb-8">리치 텍스트 에디터 사용 예시</h1>
      
      {/* 기본 에디터 */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">1. 기본 에디터 (모든 기능 포함)</h2>
        <LightRichEditor
          value={content}
          onChange={setContent}
          height={300}
          placeholder="모든 기능이 활성화된 에디터입니다... (하단 핸들을 드래그하여 크기 조정 가능)"
          enableResize={true}
          minHeight={150}
          maxHeight={600}
        />
        <div className="text-sm text-gray-600">
          <strong>현재 내용:</strong>
          <pre className="mt-2 p-2 bg-gray-100 rounded text-xs overflow-auto max-h-32">
            {content}
          </pre>
        </div>
      </div>

      {/* 간단한 에디터 */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">2. 간단한 에디터 (기본 서식만)</h2>
        <LightRichEditor
          value={simpleContent}
          onChange={setSimpleContent}
          height={200}
          placeholder="굵게, 기울임, 밑줄만 사용 가능한 에디터입니다... (크기 조정 가능)"
          enableImageUpload={false}
          enableColorPicker={false}
          enableFontSize={false}
          enableLink={false}
          enableList={false}
          enableResize={true}
          minHeight={100}
          maxHeight={400}
        />
        <div className="text-sm text-gray-600">
          <strong>현재 내용:</strong>
          <pre className="mt-2 p-2 bg-gray-100 rounded text-xs overflow-auto max-h-32">
            {simpleContent}
          </pre>
        </div>
      </div>

      {/* 최소한의 에디터 */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">3. 최소한의 에디터 (툴바 없음, 크기 조정 비활성화)</h2>
        <LightRichEditor
          value={minimalContent}
          onChange={setMinimalContent}
          height={150}
          placeholder="툴바가 없는 순수 텍스트 에디터입니다... (크기 조정 비활성화)"
          showToolbar={false}
          enableResize={false}
        />
        <div className="text-sm text-gray-600">
          <strong>현재 내용:</strong>
          <pre className="mt-2 p-2 bg-gray-100 rounded text-xs overflow-auto max-h-32">
            {minimalContent}
          </pre>
        </div>
      </div>

      {/* 사용법 안내 */}
      <div className="mt-12 p-6 bg-blue-50 rounded-lg">
        <h3 className="text-lg font-semibold mb-4">사용법</h3>
        <div className="space-y-2 text-sm">
          <p><strong>기본 사용:</strong></p>
          <pre className="bg-white p-2 rounded text-xs overflow-x-auto">
{`import LightRichEditor from '@/components/LightRichEditor'

const [content, setContent] = useState('')

<LightRichEditor
  value={content}
  onChange={setContent}
  height={300}
/>`}
          </pre>
          
          <p><strong>커스터마이징:</strong></p>
          <pre className="bg-white p-2 rounded text-xs overflow-x-auto">
{`<LightRichEditor
  value={content}
  onChange={setContent}
  height={200}
  placeholder="커스텀 플레이스홀더..."
  className="custom-editor"
  showToolbar={true}
  enableImageUpload={true}
  enableColorPicker={true}
  enableFontSize={true}
  enableLink={true}
  enableList={true}
  enableBold={true}
  enableItalic={true}
  enableUnderline={true}
  enableResize={true}
  minHeight={100}
  maxHeight={800}
/>`}
          </pre>
        </div>
      </div>
    </div>
  )
}

export default RichTextEditorExample
