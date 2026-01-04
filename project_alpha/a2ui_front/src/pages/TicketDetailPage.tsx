/**
 * Ticket Detail Page - Pure A2UI implementation
 * Displays ticket details with status transitions
 */
import { useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { A2UISurface, A2UISurfaceRef } from '@/a2ui';

export default function TicketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const surfaceRef = useRef<A2UISurfaceRef>(null);

  const handleAction = (action: { name: string; context?: { key: string; value: unknown }[] }) => {
    switch (action.name) {
      case 'navigate_back':
        navigate('/tickets');
        break;
      case 'navigate_edit':
        navigate(`/tickets/${id}/edit`);
        break;
      case 'transition_status': {
        const newStatus = action.context?.find(c => c.key === 'status')?.value;
        console.log('Transition to:', newStatus);
        // Status transition handled by backend via SSE
        break;
      }
      case 'delete_ticket':
        // Confirmation handled in A2UI, then navigate back
        navigate('/tickets');
        break;
      default:
        console.log('Unhandled action:', action.name);
    }
  };

  return (
    <AppLayout>
      <A2UISurface
        ref={surfaceRef}
        surfaceId={`ticket-detail-${id}`}
        streamUrl={`/api/a2ui/tickets/${id}/stream`}
        actionUrl={`/api/a2ui/tickets/${id}/action`}
        onAction={handleAction}
        fallback={<DetailLoadingSkeleton />}
        className="animate-fade-in"
      />
    </AppLayout>
  );
}

function DetailLoadingSkeleton() {
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <div className="h-8 w-8 bg-gray-200 rounded animate-pulse" />
        <div className="h-8 w-48 bg-gray-200 rounded animate-pulse" />
      </div>
      <div className="bg-white rounded-xl p-6 border space-y-4">
        <div className="h-6 w-3/4 bg-gray-200 rounded animate-pulse" />
        <div className="h-4 w-full bg-gray-100 rounded animate-pulse" />
        <div className="h-4 w-2/3 bg-gray-100 rounded animate-pulse" />
        <div className="flex gap-4 pt-4">
          <div className="h-8 w-24 bg-gray-200 rounded-full animate-pulse" />
          <div className="h-8 w-24 bg-gray-200 rounded-full animate-pulse" />
        </div>
      </div>
    </div>
  );
}
