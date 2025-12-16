import type { TicketStatus } from '@/types';
import { STATUS_TRANSITIONS, STATUS_LABELS } from '@/types';
import { cn } from '@/lib/utils';
import { Play, CheckCircle, XCircle, RotateCcw } from 'lucide-react';

interface StatusActionsProps {
  currentStatus: TicketStatus;
  onStatusChange: (status: TicketStatus, resolution?: string) => void;
  isLoading?: boolean;
}

const statusIcons: Record<TicketStatus, React.ElementType> = {
  open: RotateCcw,
  in_progress: Play,
  completed: CheckCircle,
  cancelled: XCircle,
};

const statusButtonStyles: Record<TicketStatus, string> = {
  open: 'bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200',
  in_progress: 'bg-yellow-50 text-yellow-700 hover:bg-yellow-100 border-yellow-200',
  completed: 'bg-green-50 text-green-700 hover:bg-green-100 border-green-200',
  cancelled: 'bg-gray-50 text-gray-700 hover:bg-gray-100 border-gray-200',
};

export function StatusActions({ currentStatus, onStatusChange, isLoading }: StatusActionsProps) {
  const allowedTransitions = STATUS_TRANSITIONS[currentStatus] || [];

  if (allowedTransitions.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {allowedTransitions.map((status) => {
        const Icon = statusIcons[status];
        return (
          <button
            key={status}
            onClick={() => onStatusChange(status)}
            disabled={isLoading}
            className={cn(
              'inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg border transition-colors disabled:opacity-50',
              statusButtonStyles[status]
            )}
          >
            <Icon className="w-4 h-4" />
            {STATUS_LABELS[status]}
          </button>
        );
      })}
    </div>
  );
}

