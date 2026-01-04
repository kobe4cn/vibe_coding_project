/**
 * Ticket Edit Page - Hybrid Architecture
 *
 * This page demonstrates the React + A2UI hybrid approach:
 * - A2UI Surface: Handles form fields (title, description, priority) via SDUI
 * - React Components: TagSelector (complex dropdown with search)
 * - React Query: Data fetching and mutations
 * - A2UIContext: State bridge between A2UI and React
 */
import { useRef, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { A2UISurface, A2UISurfaceRef, useA2UIContext } from '@/a2ui';
import { TagSelector } from '@/components/tag/TagSelector';
import { useTicket, useTags, useUpdateTicket, useUpdateTicketTags } from '@/hooks/useTicket';
import { useToast } from '@/components/common/Toast';
import { ArrowLeft, Save, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Priority } from '@/types';

export default function TicketEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const surfaceRef = useRef<A2UISurfaceRef>(null);
  const { setValue, getValue } = useA2UIContext();
  const { success, error: showError } = useToast();

  // React Query for data
  const { data: ticket, isLoading: isLoadingTicket } = useTicket(id!);
  const { data: allTags = [], isLoading: isLoadingTags } = useTags();
  const updateTicket = useUpdateTicket();
  const updateTicketTags = useUpdateTicketTags();

  // Local state for tags (React-managed)
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);

  // Note: A2UI form values are accessed via getValue() in handleSave
  // The useA2UIValue hook could be used for real-time display, but
  // we use getValue for on-demand access when saving

  // Initialize form values when ticket loads
  useEffect(() => {
    if (ticket) {
      setValue('/app/form/edit/title', ticket.title);
      setValue('/app/form/edit/description', ticket.description || '');
      setValue('/app/form/edit/priority', ticket.priority);
      // eslint-disable-next-line
      setSelectedTagIds(ticket.tags.map(t => t.id));
    }
  }, [ticket, setValue]);

  const handleAction = (action: { name: string }) => {
    switch (action.name) {
      case 'select_priority': {
        // Priority selection is handled via A2UI data binding
        break;
      }
      default:
        console.log('Unhandled A2UI action:', action.name);
    }
  };

  const handleSave = async () => {
    if (!id || !ticket) return;

    try {
      // Get form values from A2UI DataModel
      const title = getValue('/app/form/edit/title') as string;
      const description = getValue('/app/form/edit/description') as string;
      const priority = getValue('/app/form/edit/priority') as Priority;

      // Validate
      if (!title?.trim()) {
        showError('标题不能为空');
        return;
      }

      // Update ticket via React Query
      await updateTicket.mutateAsync({
        id,
        data: { title: title.trim(), description: description?.trim() || undefined, priority },
      });

      // Update tags if changed
      const originalTagIds = ticket.tags.map(t => t.id).sort().join(',');
      const newTagIds = [...selectedTagIds].sort().join(',');

      if (originalTagIds !== newTagIds) {
        await updateTicketTags.mutateAsync({ id, tagIds: selectedTagIds });
      }

      success('工单更新成功');
      navigate(`/tickets/${id}`);
    } catch (err) {
      showError(err instanceof Error ? err.message : '更新失败');
    }
  };

  const handleCancel = () => {
    navigate(`/tickets/${id}`);
  };

  const isLoading = isLoadingTicket || isLoadingTags;
  const isSaving = updateTicket.isPending || updateTicketTags.isPending;

  if (isLoading) {
    return (
      <AppLayout>
        <EditLoadingSkeleton />
      </AppLayout>
    );
  }

  if (!ticket) {
    return (
      <AppLayout>
        <div className="text-center py-12">
          <p className="text-gray-500">工单不存在</p>
          <button
            onClick={() => navigate('/tickets')}
            className="mt-4 text-[#1E3A5F] underline"
          >
            返回列表
          </button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto animate-fade-in">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-2xl font-bold text-[#1E3A5F]">编辑工单</h1>
        </div>

        {/* Form Card */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          {/* A2UI Surface for form fields */}
          <div className="p-6 space-y-6">
            <A2UISurface
              ref={surfaceRef}
              surfaceId={`ticket-edit-form-${id}`}
              streamUrl={`/api/a2ui/tickets/${id}/edit/stream`}
              actionUrl={`/api/a2ui/tickets/${id}/edit/action`}
              onAction={handleAction}
              fallback={<FormFieldsSkeleton />}
            />

            {/* React TagSelector - Complex component that stays as React */}
            <div className="space-y-2">
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
          </div>

          {/* Actions */}
          <div className="px-6 py-4 bg-gray-50 border-t flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={handleCancel}
              disabled={isSaving}
              className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              取消
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className={cn(
                'flex items-center gap-2 px-4 py-2 font-medium rounded-lg transition-colors',
                'bg-[#FFD93D] text-[#1E3A5F] hover:bg-[#FFE566]',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            >
              {isSaving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              保存
            </button>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

function EditLoadingSkeleton() {
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <div className="h-10 w-10 bg-gray-200 rounded animate-pulse" />
        <div className="h-8 w-32 bg-gray-200 rounded animate-pulse" />
      </div>
      <div className="bg-white rounded-xl p-6 border space-y-6">
        <FormFieldsSkeleton />
        <div className="space-y-2">
          <div className="h-4 w-16 bg-gray-200 rounded animate-pulse" />
          <div className="h-10 w-full bg-gray-100 rounded animate-pulse" />
        </div>
      </div>
    </div>
  );
}

function FormFieldsSkeleton() {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="h-4 w-12 bg-gray-200 rounded animate-pulse" />
        <div className="h-10 w-full bg-gray-100 rounded animate-pulse" />
      </div>
      <div className="space-y-2">
        <div className="h-4 w-16 bg-gray-200 rounded animate-pulse" />
        <div className="h-24 w-full bg-gray-100 rounded animate-pulse" />
      </div>
      <div className="space-y-2">
        <div className="h-4 w-16 bg-gray-200 rounded animate-pulse" />
        <div className="flex gap-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-8 w-16 bg-gray-200 rounded-full animate-pulse" />
          ))}
        </div>
      </div>
    </div>
  );
}
