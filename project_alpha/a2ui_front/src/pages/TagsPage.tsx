/**
 * Tags Page - Hybrid A2UI + React implementation
 * A2UI for listing tags, React for create/edit modal
 */
import { useRef, useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { A2UISurface, A2UISurfaceRef, useA2UIContext, useA2UIValue } from '@/a2ui';

// Predefined colors for tag selection
const PRESET_COLORS = [
  '#EF4444', '#F97316', '#F59E0B', '#FBBF24',
  '#22C55E', '#10B981', '#14B8A6', '#06B6D4',
  '#3B82F6', '#6366F1', '#8B5CF6', '#A855F7',
  '#EC4899', '#F472B6', '#6B7280', '#B91C1C',
];

interface TagFormData {
  name: string;
  color: string;
  editingId?: string;
}

export default function TagsPage() {
  const surfaceRef = useRef<A2UISurfaceRef>(null);
  const { getValue } = useA2UIContext();
  const [searchParams] = useSearchParams();

  // Get current page from URL params
  const currentPage = useMemo(() => {
    const page = parseInt(searchParams.get('page') || '1', 10);
    return isNaN(page) || page < 1 ? 1 : page;
  }, [searchParams]);

  // Build stream URL with page parameter
  const streamUrl = useMemo(() => {
    return `/api/a2ui/tags/stream?page=${currentPage}`;
  }, [currentPage]);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [formData, setFormData] = useState<TagFormData>({ name: '', color: '#3B82F6' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get pagination info from A2UI DataModel
  const paginationTotalPages = useA2UIValue<string>('/app/tags/pagination/totalPages');
  const totalPages = parseInt(paginationTotalPages || '1', 10);

  const handleAction = (action: { name: string; context?: { key: string; value: unknown }[] }) => {
    switch (action.name) {
      case 'open_create_form':
        setFormData({ name: '', color: '#3B82F6' });
        setModalMode('create');
        setShowModal(true);
        setError(null);
        break;
      case 'edit_tag': {
        const tagId = action.context?.find(c => c.key === 'tagId')?.value as string;
        if (tagId) {
          // Get tag data from A2UI DataModel
          const tagName = getValue(`/app/tags/items/${tagId}/name`) as string || '';
          const tagColor = getValue(`/app/tags/items/${tagId}/color`) as string || '#3B82F6';
          setFormData({ name: tagName, color: tagColor, editingId: tagId });
          setModalMode('edit');
          setShowModal(true);
          setError(null);
        }
        break;
      }
      case 'prev_page': {
        if (currentPage > 1) {
          // Navigate with full page reload to clear DataModel
          window.location.href = `/tags?page=${currentPage - 1}`;
        }
        break;
      }
      case 'next_page': {
        if (currentPage < totalPages) {
          // Navigate with full page reload to clear DataModel
          window.location.href = `/tags?page=${currentPage + 1}`;
        }
        break;
      }
      default:
        // Let A2UI handle other actions (like delete_tag)
        break;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setError('标签名称不能为空');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/a2ui/tags/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'submit_tag',
          surfaceId: 'tags',
          sourceComponentId: 'modal-submit-btn',
          timestamp: new Date().toISOString(),
          context: {
            name: formData.name.trim(),
            color: formData.color,
            editingId: formData.editingId || null,
          },
        }),
      });

      const result = await response.json();
      if (result.success) {
        setShowModal(false);
        // Refresh the page to get updated data
        window.location.reload();
      } else {
        setError(result.error || '操作失败');
      }
    } catch (err) {
      console.error('Failed to submit tag:', err);
      setError('提交失败，请重试');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AppLayout>
      <A2UISurface
        key={currentPage} // Force re-mount when page changes
        ref={surfaceRef}
        surfaceId="tags"
        streamUrl={streamUrl}
        actionUrl="/api/a2ui/tags/action"
        onAction={handleAction}
        fallback={<TagsLoadingSkeleton />}
        className="animate-fade-in"
      />

      {/* Create/Edit Tag Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
            <div className="px-6 py-4 bg-[#1E3A5F] text-white">
              <h2 className="text-xl font-semibold">
                {modalMode === 'create' ? '新建标签' : '编辑标签'}
              </h2>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {/* Tag Name */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  标签名称 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="输入标签名称"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FFD93D] focus:border-[#FFD93D] outline-none transition-colors"
                  autoFocus
                />
              </div>

              {/* Color Selection */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  标签颜色
                </label>
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-lg border-2 border-gray-200"
                    style={{ backgroundColor: formData.color }}
                  />
                  <input
                    type="text"
                    value={formData.color}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                    placeholder="#3B82F6"
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FFD93D] focus:border-[#FFD93D] outline-none transition-colors text-sm font-mono"
                  />
                </div>
                <div className="grid grid-cols-8 gap-2 mt-3">
                  {PRESET_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setFormData({ ...formData, color })}
                      className={`w-8 h-8 rounded-lg border-2 transition-transform hover:scale-110 ${
                        formData.color === color
                          ? 'border-[#1E3A5F] ring-2 ring-[#FFD93D]'
                          : 'border-gray-200'
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>

              {/* Error Message */}
              {error && (
                <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">
                  {error}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-5 py-2.5 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors font-medium"
                  disabled={isSubmitting}
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 font-semibold rounded-lg bg-[#FFD93D] text-[#1E3A5F] hover:bg-[#FFE566] transition-colors disabled:opacity-50"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? '提交中...' : modalMode === 'create' ? '创建' : '保存'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppLayout>
  );
}

function TagsLoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="h-10 w-32 bg-gray-200 rounded animate-pulse" />
        <div className="h-10 w-32 bg-[#FFD93D]/30 rounded animate-pulse" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="h-20 bg-white rounded-lg border animate-pulse" />
        ))}
      </div>
    </div>
  );
}
