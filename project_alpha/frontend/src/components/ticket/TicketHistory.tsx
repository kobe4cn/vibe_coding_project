import { useTicketHistory } from '@/hooks/useTicketHistory';
import { formatDate } from '@/lib/utils';
import type { ChangeType, TicketStatus } from '@/types';
import { Clock, ArrowRight } from 'lucide-react';

interface TicketHistoryProps {
  ticketId: string;
  changeType?: ChangeType;
}

const changeTypeLabels: Record<ChangeType, string> = {
  status: '状态变更',
  priority: '优先级变更',
  resolution: '处理结果变更',
  tag_added: '添加标签',
  tag_removed: '删除标签',
};

const statusLabels: Record<TicketStatus, string> = {
  open: '开放',
  in_progress: '进行中',
  completed: '已完成',
  cancelled: '已取消',
};

const priorityLabels: Record<string, string> = {
  low: '低',
  medium: '中',
  high: '高',
  urgent: '紧急',
};

export function TicketHistory({ ticketId, changeType }: TicketHistoryProps) {
  const { data, isLoading, error } = useTicketHistory(ticketId, {
    change_type: changeType,
    limit: 50,
  });

  if (isLoading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full mx-auto"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8 text-red-600">
        加载历史记录失败
      </div>
    );
  }

  if (!data || data.data.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400">
        暂无历史记录
      </div>
    );
  }

  const formatValue = (changeType: ChangeType, value: string | null): string => {
    if (!value) return '-';
    
    if (changeType === 'status') {
      return statusLabels[value as TicketStatus] || value;
    }
    
    if (changeType === 'priority') {
      return priorityLabels[value] || value;
    }
    
    return value;
  };

  return (
    <div className="space-y-4">
      {data.data.map((entry) => (
        <div
          key={entry.id}
          className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg border border-gray-200"
        >
          <div className="flex-shrink-0 mt-0.5">
            <Clock className="w-4 h-4 text-gray-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-medium text-gray-900">
                {changeTypeLabels[entry.change_type]}
              </span>
              <span className="text-xs text-gray-500">
                {formatDate(entry.created_at)}
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span className="px-2 py-0.5 bg-white rounded border border-gray-200">
                {formatValue(entry.change_type, entry.old_value)}
              </span>
              <ArrowRight className="w-3 h-3 text-gray-400" />
              <span className="px-2 py-0.5 bg-white rounded border border-gray-200">
                {formatValue(entry.change_type, entry.new_value)}
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

