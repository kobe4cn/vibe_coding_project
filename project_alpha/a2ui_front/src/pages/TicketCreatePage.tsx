/**
 * Ticket Create Page - Hybrid Architecture
 * A2UI for form fields, React for TagSelector
 */
import { useRef, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { A2UISurface, A2UISurfaceRef, useA2UIContext } from '@/a2ui';
import { TagSelector } from '@/components/tag/TagSelector';
import { useTags } from '@/hooks/useTicket';

export default function TicketCreatePage() {
  const navigate = useNavigate();
  const surfaceRef = useRef<A2UISurfaceRef>(null);
  const { setValue, getValue } = useA2UIContext();
  const { data: allTags = [] } = useTags();
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const submitHandledRef = useRef(false);
  
  const [isReady, setIsReady] = useState(false);
  const initDoneRef = useRef(false);

  // Helper to access elements inside A2UI Shadow DOM
  const getShadowRoot = () => {
    const surface = document.querySelector('a2ui-surface');
    return surface?.shadowRoot || null;
  };

  // Initialize component when A2UI renders
  useEffect(() => {
    if (initDoneRef.current) return;

    const checkReady = () => {
      const shadowRoot = getShadowRoot();
      if (!shadowRoot) {
        setTimeout(checkReady, 100);
        return;
      }

      // Look for A2UI card or priority buttons inside Shadow DOM
      const card = shadowRoot.querySelector('a2ui-card');
      if (card) {
        initDoneRef.current = true;
        setIsReady(true);
        
        // Remove bottom border radius from A2UI card so it connects with React section
        (card as HTMLElement).style.borderBottomLeftRadius = '0';
        (card as HTMLElement).style.borderBottomRightRadius = '0';
        (card as HTMLElement).style.borderBottom = 'none';
      } else {
        setTimeout(checkReady, 100);
      }
    };

    checkReady();
  }, []);

  const handleAction = (action: { name: string; context?: { key: string; value: unknown }[] }) => {
    switch (action.name) {
      case 'navigate_back':
        navigate('/tickets');
        break;
      case 'select_priority': {
        const priority = action.context?.find(c => c.key === 'priority')?.value;
        if (priority && typeof priority === 'string') {
          setValue('/app/form/create/priority', priority);
        }
        break;
      }
      default:
        console.log('Unhandled action:', action.name);
    }
  };

  const handleSubmit = async () => {
    if (submitHandledRef.current) return;
    submitHandledRef.current = true;

    // Get form values from A2UI context
    const title = (getValue('/app/form/create/title') as string) || '';
    const description = (getValue('/app/form/create/description') as string) || '';
    const priority = (getValue('/app/form/create/priority') as string) || 'medium';

    if (!title.trim()) {
      alert('标题不能为空');
      submitHandledRef.current = false;
      return;
    }

    try {
      const response = await fetch('/api/a2ui/tickets/create/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'submit_create',
          surfaceId: 'ticket-create',
          sourceComponentId: 'submit-btn',
          timestamp: new Date().toISOString(),
          context: {
            title,
            description,
            priority,
            tag_ids: selectedTagIds,
          },
        }),
      });

      const result = await response.json();
      if (result.success && result.ticketId) {
        navigate(`/tickets/${result.ticketId}`);
      } else if (result.error) {
        alert(result.error);
        submitHandledRef.current = false;
      }
    } catch (err) {
      console.error('Failed to create ticket:', err);
      alert('创建失败，请重试');
      submitHandledRef.current = false;
    }
  };

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto animate-fade-in">
        <A2UISurface
          ref={surfaceRef}
          surfaceId="ticket-create"
          streamUrl="/api/a2ui/tickets/create/stream"
          actionUrl="/api/a2ui/tickets/create/action"
          onAction={handleAction}
          fallback={<FormLoadingSkeleton />}
        />
        
        {/* Tag Selector and Action Buttons - inside same visual card */}
        {isReady && (
          <div className="bg-white rounded-b-xl border border-t-0 border-gray-200 shadow-sm -mt-3">
            {/* Tag Selector */}
            <div className="px-6 pt-4 pb-6 space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                标签
              </label>
              <TagSelector
                tags={allTags}
                selectedIds={selectedTagIds}
                onChange={setSelectedTagIds}
                placeholder="选择标签..."
              />
              <p className="text-xs text-gray-500">
                可多选，支持搜索筛选
              </p>
            </div>

            {/* Action Buttons */}
            <div className="px-6 py-4 bg-gray-50 border-t flex items-center gap-3">
              <button
                type="button"
                onClick={() => navigate('/tickets')}
                className="px-5 py-2.5 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors font-medium"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                className="px-5 py-2.5 font-semibold rounded-lg bg-[#FFD93D] text-[#1E3A5F] hover:bg-[#FFE566] transition-colors"
              >
                创建工单
              </button>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}

function FormLoadingSkeleton() {
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <div className="h-8 w-8 bg-gray-200 rounded animate-pulse" />
        <div className="h-8 w-48 bg-gray-200 rounded animate-pulse" />
      </div>
      <div className="bg-white rounded-xl p-6 border space-y-4">
        <div className="space-y-2">
          <div className="h-4 w-16 bg-gray-200 rounded animate-pulse" />
          <div className="h-10 w-full bg-gray-100 rounded animate-pulse" />
        </div>
        <div className="space-y-2">
          <div className="h-4 w-20 bg-gray-200 rounded animate-pulse" />
          <div className="h-24 w-full bg-gray-100 rounded animate-pulse" />
        </div>
        <div className="flex gap-4 pt-4">
          <div className="h-10 w-24 bg-gray-200 rounded animate-pulse" />
          <div className="h-10 w-24 bg-[#FFD93D]/30 rounded animate-pulse" />
        </div>
      </div>
    </div>
  );
}
