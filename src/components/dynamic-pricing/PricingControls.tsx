import React, { memo } from 'react';
import { Save, Loader2, AlertCircle, CheckCircle } from 'lucide-react';

interface PricingControlsProps {
  saving: boolean;
  saveMessage: string;
  onSave: () => void;
  onCancel?: () => void;
  canSave?: boolean;
  batchProgress?: { completed: number; total: number } | null;
}

export const PricingControls = memo(function PricingControls({
  saving,
  saveMessage,
  onSave,
  onCancel,
  canSave = true,
  batchProgress
}: PricingControlsProps) {
  const getMessageIcon = () => {
    if (saveMessage.includes('성공')) {
      return <CheckCircle className="h-4 w-4 text-green-600" />;
    }
    if (saveMessage.includes('실패')) {
      return <AlertCircle className="h-4 w-4 text-red-600" />;
    }
    return null;
  };

  const getMessageColor = () => {
    if (saveMessage.includes('성공')) {
      return 'text-green-700 bg-green-50 border-green-200';
    }
    if (saveMessage.includes('실패')) {
      return 'text-red-700 bg-red-50 border-red-200';
    }
    return 'text-blue-700 bg-blue-50 border-blue-200';
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
      {/* 저장 메시지 */}
      {saveMessage && (
        <div className={`mb-4 p-3 rounded-md border ${getMessageColor()}`}>
          <div className="flex items-center space-x-2">
            {getMessageIcon()}
            <span className="text-sm font-medium">{saveMessage}</span>
          </div>
        </div>
      )}

      {/* 배치 저장 진행률 */}
      {batchProgress && (
        <div className="mb-4 p-3 rounded-md border border-blue-200 bg-blue-50">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-blue-700">
              배치 저장 진행 중...
            </span>
            <span className="text-sm text-blue-600">
              {batchProgress.completed}/{batchProgress.total}
            </span>
          </div>
          <div className="w-full bg-blue-200 rounded-full h-2">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-300 ease-out"
              style={{ 
                width: `${(batchProgress.completed / batchProgress.total) * 100}%` 
              }}
            />
          </div>
          <div className="mt-1 text-xs text-blue-600">
            {Math.round((batchProgress.completed / batchProgress.total) * 100)}% 완료
          </div>
        </div>
      )}

      {/* 컨트롤 버튼들 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <button
            onClick={onSave}
            disabled={saving || !canSave}
            className={`flex items-center space-x-2 px-4 py-2 rounded-md font-medium transition-colors ${
              saving || !canSave
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>저장 중...</span>
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                <span>가격 규칙 저장</span>
              </>
            )}
          </button>

          {onCancel && (
            <button
              onClick={onCancel}
              disabled={saving}
              className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              취소
            </button>
          )}
        </div>

        {/* 추가 정보 */}
        <div className="text-sm text-gray-500">
          {saving ? '데이터를 저장하고 있습니다...' : '변경사항을 저장하세요'}
        </div>
      </div>
    </div>
  );
});
