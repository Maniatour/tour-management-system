import React from 'react'
import { Settings } from 'lucide-react'

export const OptionManagement: React.FC = () => {
  return (
    <div className="bg-white rounded-lg shadow-sm border">
      <div className="p-4">
        <h2 className="text-md font-semibold text-gray-900 mb-3">옵션 관리</h2>
        <div className="text-center py-6 text-gray-500">
          <Settings className="h-8 w-8 mx-auto mb-3 text-gray-300" />
          <p className="text-sm">등록된 옵션이 없습니다.</p>
          <p className="text-xs">배정된 고객이 옵션을 추가하면 여기에 표시됩니다.</p>
        </div>
      </div>
    </div>
  )
}
