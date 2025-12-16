import { Link } from 'react-router-dom';
import type { TicketWithTags } from '@/types';
import { StatusBadge } from '@/components/common/StatusBadge';
import { PriorityBadge } from '@/components/common/PriorityBadge';
import { TagBadge } from '@/components/tag/TagBadge';
import { formatDate } from '@/lib/utils';

interface TicketCardProps {
  ticket: TicketWithTags;
}

export function TicketCard({ ticket }: TicketCardProps) {
  return (
    <Link
      to={`/tickets/${ticket.id}`}
      className="block bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-medium text-gray-900 truncate">
            {ticket.title}
          </h3>
          {ticket.description && (
            <p className="mt-1 text-sm text-gray-500 line-clamp-2">
              {ticket.description}
            </p>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <StatusBadge status={ticket.status} />
            <PriorityBadge priority={ticket.priority} />
            {ticket.tags.slice(0, 3).map((tag) => (
              <TagBadge key={tag.id} tag={tag} />
            ))}
            {ticket.tags.length > 3 && (
              <span className="text-xs text-gray-500">
                +{ticket.tags.length - 3}
              </span>
            )}
          </div>
        </div>
        <div className="text-xs text-gray-400 whitespace-nowrap">
          {formatDate(ticket.created_at)}
        </div>
      </div>
    </Link>
  );
}

