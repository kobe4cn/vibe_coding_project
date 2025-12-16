import { cn } from '@/lib/utils';
import type { TicketStatus } from '@/types';
import { STATUS_LABELS } from '@/types';
import { Circle, Loader, CheckCircle, XCircle } from 'lucide-react';

interface StatusBadgeProps {
  status: TicketStatus;
  className?: string;
}

const statusConfig: Record<TicketStatus, { icon: React.ElementType; className: string }> = {
  open: {
    icon: Circle,
    className: 'bg-blue-100 text-blue-800 border-blue-200',
  },
  in_progress: {
    icon: Loader,
    className: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  },
  completed: {
    icon: CheckCircle,
    className: 'bg-green-100 text-green-800 border-green-200',
  },
  cancelled: {
    icon: XCircle,
    className: 'bg-gray-100 text-gray-800 border-gray-200',
  },
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full border',
        config.className,
        className
      )}
    >
      <Icon className="w-3 h-3" />
      {STATUS_LABELS[status]}
    </span>
  );
}

