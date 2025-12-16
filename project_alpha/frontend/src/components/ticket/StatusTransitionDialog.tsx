import { useState } from 'react';
import type { TicketStatus } from '@/types';
import { STATUS_LABELS } from '@/types';
import { X } from 'lucide-react';

interface StatusTransitionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (resolution?: string) => void;
  targetStatus: TicketStatus;
  isLoading?: boolean;
}

export function StatusTransitionDialog({
  isOpen,
  onClose,
  onConfirm,
  targetStatus,
  isLoading,
}: StatusTransitionDialogProps) {
  const [resolution, setResolution] = useState('');
  const requiresResolution = targetStatus === 'completed';

  if (!isOpen) return null;

  const handleConfirm = () => {
    onConfirm(resolution || undefined);
    setResolution('');
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-semibold text-gray-900">
            {targetStatus === 'completed' ? '完成票据' : `切换为${STATUS_LABELS[targetStatus]}`}
          </h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4">
          {requiresResolution ? (
            <>
              <p className="text-sm text-gray-600 mb-3">
                请填写处理结果：
              </p>
              <textarea
                value={resolution}
                onChange={(e) => setResolution(e.target.value)}
                rows={4}
                placeholder="请输入处理结果..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </>
          ) : targetStatus === 'cancelled' ? (
            <>
              <p className="text-sm text-gray-600 mb-3">
                确定要取消这个票据吗？您可以填写取消原因（可选）：
              </p>
              <textarea
                value={resolution}
                onChange={(e) => setResolution(e.target.value)}
                rows={3}
                placeholder="取消原因（可选）..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </>
          ) : (
            <p className="text-sm text-gray-600">
              确定要将状态切换为 <strong>{STATUS_LABELS[targetStatus]}</strong> 吗？
            </p>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 p-4 border-t bg-gray-50 rounded-b-lg">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg"
          >
            取消
          </button>
          <button
            onClick={handleConfirm}
            disabled={isLoading || (requiresResolution && !resolution.trim())}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50"
          >
            {isLoading ? '处理中...' : '确认'}
          </button>
        </div>
      </div>
    </div>
  );
}

