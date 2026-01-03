/**
 * Tickets Page - Hybrid A2UI + React implementation
 * Lists all tickets with filtering, search, and pagination
 */
import { useRef, useState, useMemo, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { A2UISurface, A2UISurfaceRef, useA2UIValue } from '@/a2ui';

// Status options for ticket processing
const STATUS_OPTIONS = [
  { value: 'open', label: '待处理' },
  { value: 'in_progress', label: '处理中' },
  { value: 'completed', label: '已完成' },
  { value: 'cancelled', label: '已取消' },
];

// Get allowed transitions based on current status
function getAllowedTransitions(currentStatus: string): { value: string; label: string }[] {
  switch (currentStatus) {
    case 'open':
      // 待处理可以转为：处理中、已完成、已取消
      return STATUS_OPTIONS.filter(s => ['in_progress', 'completed', 'cancelled'].includes(s.value));
    case 'in_progress':
      // 处理中可以转为：处理中（添加进度说明）、待处理、已完成、已取消
      return STATUS_OPTIONS.filter(s => ['in_progress', 'open', 'completed', 'cancelled'].includes(s.value));
    case 'completed':
      // 已完成可以转为：待处理（重新打开）
      return STATUS_OPTIONS.filter(s => ['open'].includes(s.value));
    case 'cancelled':
      // 已取消可以转为：待处理（重新打开）
      return STATUS_OPTIONS.filter(s => ['open'].includes(s.value));
    default:
      return [];
  }
}

interface ProcessModalData {
  ticketId: string;
  currentStatus: string;
}

interface HistoryRecord {
  id: string;
  ticket_id: string;
  change_type: string;
  field_name: string;
  old_value: string | null;
  new_value: string | null;
  created_at: string;
}

// Format status value to label
function formatStatusLabel(status: string | null): string {
  if (!status) return '-';
  const found = STATUS_OPTIONS.find(s => s.value === status);
  return found ? found.label : status;
}

// Format date to readable string
function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function TicketsPage() {
  const navigate = useNavigate();
  const surfaceRef = useRef<A2UISurfaceRef>(null);
  const [searchParams, setSearchParams] = useSearchParams();

  // Modal state for ticket processing
  const [showProcessModal, setShowProcessModal] = useState(false);
  const [processModalData, setProcessModalData] = useState<ProcessModalData | null>(null);
  const [newStatus, setNewStatus] = useState('');
  const [progressNote, setProgressNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [historyRecords, setHistoryRecords] = useState<HistoryRecord[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Get pagination values from DataModel
  const paginationTotalPages = useA2UIValue<string>('/app/tickets/pagination/totalPages');

  // Get current page from URL params
  const currentPage = useMemo(() => {
    const page = parseInt(searchParams.get('page') || '1', 10);
    return isNaN(page) || page < 1 ? 1 : page;
  }, [searchParams]);

  const statusFilter = searchParams.get('status') || '';
  const searchFilter = searchParams.get('search') || '';

  // NOTE: Removed auto-sync useEffect that was causing queries on every keystroke
  // Search is now triggered only by clicking the search button (search_tickets action)
  // Status filter is triggered only by clicking filter buttons (filter_status action)

  // Get _t timestamp from URL params (used to force refresh)
  const refreshTimestamp = searchParams.get('_t') || '';

  // Build stream URL with query parameters
  // Include _t timestamp to force reconnection when same filter is clicked
  const streamUrl = useMemo(() => {
    const params = new URLSearchParams();
    params.set('page', currentPage.toString());
    if (statusFilter) params.set('status', statusFilter);
    if (searchFilter) params.set('search', searchFilter);
    // Don't send _t to backend, but use it to trigger useMemo recalculation
    const url = `/api/a2ui/tickets/stream?${params.toString()}`;
    return url;
  }, [currentPage, statusFilter, searchFilter, refreshTimestamp]);

  const handleAction = useCallback((action: { name: string; context?: { key: string; value: unknown }[] }, sourceId: string) => {
    switch (action.name) {
      case 'navigate_ticket_detail': {
        const ticketId = action.context?.find(c => c.key === 'ticketId')?.value;
        if (ticketId) {
          navigate(`/tickets/${ticketId}`);
        }
        break;
      }
      case 'navigate_create_ticket':
        navigate('/tickets/new');
        break;
      case 'filter_status': {
        const status = action.context?.find(c => c.key === 'status')?.value as string ?? '';
        const search = action.context?.find(c => c.key === 'search')?.value as string || '';
        // Build new URL params
        const params = new URLSearchParams();
        params.set('page', '1');
        if (status) params.set('status', status);
        if (search) params.set('search', search);
        // Always add timestamp to force URL change and trigger stream reconnection
        // This ensures clicking the same filter button will still trigger a query
        params.set('_t', Date.now().toString());
        setSearchParams(params);
        // Action will be sent to backend automatically by A2UI
        // Backend will return dataUpdate and queryUpdate
        break;
      }
      case 'search_tickets': {
        const search = action.context?.find(c => c.key === 'search')?.value as string || '';
        const status = action.context?.find(c => c.key === 'status')?.value as string || '';
        // Build URL params for search
        const params = new URLSearchParams();
        params.set('page', '1');
        if (status) params.set('status', status);
        if (search) params.set('search', search);
        // Add timestamp to force stream reconnection
        params.set('_t', Date.now().toString());
        setSearchParams(params);
        // Action will be sent to backend automatically by A2UI
        break;
      }
      case 'prev_page': {
        const totalPages = parseInt(paginationTotalPages || '0', 10);
        const search = searchParams.get('search') || '';
        const status = searchParams.get('status') || '';
        // Only allow prev if there is data and we're not on page 1
        if (totalPages > 0 && currentPage > 1) {
          const params = new URLSearchParams();
          params.set('page', String(currentPage - 1));
          if (status) params.set('status', status);
          if (search) params.set('search', search);
          setSearchParams(params);
        }
        break;
      }
      case 'next_page': {
        const totalPages = parseInt(paginationTotalPages || '0', 10);
        const search = searchParams.get('search') || '';
        const status = searchParams.get('status') || '';
        // Only allow next if there is data and we're not on the last page
        if (totalPages > 0 && currentPage < totalPages) {
          const params = new URLSearchParams();
          params.set('page', String(currentPage + 1));
          if (status) params.set('status', status);
          if (search) params.set('search', search);
          setSearchParams(params);
        }
        break;
      }
      case 'open_process_modal': {
        const ticketId = action.context?.find(c => c.key === 'ticketId')?.value as string;
        const currentStatus = action.context?.find(c => c.key === 'currentStatus')?.value as string;
        if (ticketId && currentStatus && currentStatus !== 'completed') {
          setProcessModalData({ ticketId, currentStatus });
          setNewStatus('');
          setProgressNote('');
          setError(null);
          setHistoryRecords([]);
          setShowProcessModal(true);

          // Fetch history records for this ticket
          setIsLoadingHistory(true);
          fetch(`/api/tickets/${ticketId}/history?page_size=10`)
            .then(res => res.json())
            .then(data => {
              if (data.data) {
                setHistoryRecords(data.data);
              }
            })
            .catch(err => {
              console.error('Failed to fetch history:', err);
            })
            .finally(() => {
              setIsLoadingHistory(false);
            });
        }
        break;
      }
      default:
        console.log('Unhandled action:', action.name, sourceId);
    }
  }, [navigate, currentPage, paginationTotalPages, searchParams, setSearchParams]);

  const handleProcessSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!processModalData || !newStatus) {
      setError('请选择新状态');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/a2ui/tickets/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'process_ticket',
          surfaceId: 'tickets',
          sourceComponentId: 'process-modal-submit',
          timestamp: new Date().toISOString(),
          context: {
            ticketId: processModalData.ticketId,
            newStatus,
            progressNote,
          },
        }),
      });

      const result = await response.json();
      if (result.success) {
        setShowProcessModal(false);
        // Refresh the page to get updated data
        setSearchParams(new URLSearchParams({ page: '1' }));
      } else {
        setError(result.error || '处理失败');
      }
    } catch (err) {
      console.error('Failed to process ticket:', err);
      setError('提交失败，请重试');
    } finally {
      setIsSubmitting(false);
    }
  };

  const allowedTransitions = processModalData ? getAllowedTransitions(processModalData.currentStatus) : [];

  return (
    <AppLayout>
      <A2UISurface
        ref={surfaceRef}
        surfaceId="tickets"
        streamUrl={streamUrl}
        actionUrl="/api/a2ui/tickets/action"
        onAction={handleAction}
        fallback={<TicketsLoadingSkeleton />}
        className="animate-fade-in"
      />

      {/* Process Ticket Modal */}
      {showProcessModal && processModalData && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 bg-[#1E3A5F] text-white flex-shrink-0">
              <h2 className="text-xl font-semibold">处理工单</h2>
            </div>

            <form onSubmit={handleProcessSubmit} className="p-6 space-y-5 overflow-y-auto flex-1">
              {/* Current Status */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  当前状态
                </label>
                <div className="px-4 py-2.5 bg-gray-100 rounded-lg text-gray-600">
                  {STATUS_OPTIONS.find(s => s.value === processModalData.currentStatus)?.label || processModalData.currentStatus}
                </div>
              </div>

              {/* New Status Selection */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  转换到状态 <span className="text-red-500">*</span>
                </label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FFD93D] focus:border-[#FFD93D] outline-none transition-colors"
                >
                  <option value="">请选择状态...</option>
                  {allowedTransitions.map((status) => (
                    <option key={status.value} value={status.value}>
                      {status.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Progress Note */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  处理进度说明
                </label>
                <textarea
                  value={progressNote}
                  onChange={(e) => setProgressNote(e.target.value)}
                  placeholder="输入处理进度描述..."
                  rows={3}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FFD93D] focus:border-[#FFD93D] outline-none transition-colors resize-none"
                />
              </div>

              {/* History Records */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  历史处理记录
                </label>
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  {isLoadingHistory ? (
                    <div className="p-4 text-center text-gray-500 text-sm">
                      加载中...
                    </div>
                  ) : historyRecords.length === 0 ? (
                    <div className="p-4 text-center text-gray-400 text-sm">
                      暂无历史记录
                    </div>
                  ) : (
                    <div className="max-h-40 overflow-y-auto divide-y divide-gray-100">
                      {historyRecords.map((record) => (
                        <div key={record.id} className="px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors">
                          <div className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                              {record.field_name === 'status' ? (
                                <>
                                  <span className="text-gray-500">状态变更:</span>
                                  <span className="text-gray-600">{formatStatusLabel(record.old_value)}</span>
                                  <span className="text-gray-400">→</span>
                                  <span className="font-medium text-[#1E3A5F]">{formatStatusLabel(record.new_value)}</span>
                                </>
                              ) : record.field_name === 'progress_note' ? (
                                <>
                                  <span className="text-gray-500">处理说明:</span>
                                  <span className="text-gray-700 truncate max-w-[200px]" title={record.new_value || ''}>
                                    {record.new_value || '-'}
                                  </span>
                                </>
                              ) : (
                                <>
                                  <span className="text-gray-500">{record.field_name}:</span>
                                  <span className="text-gray-600">{record.old_value || '-'}</span>
                                  <span className="text-gray-400">→</span>
                                  <span className="text-gray-700">{record.new_value || '-'}</span>
                                </>
                              )}
                            </div>
                            <span className="text-xs text-gray-400 flex-shrink-0 ml-2">
                              {formatDate(record.created_at)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
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
                  onClick={() => setShowProcessModal(false)}
                  className="px-5 py-2.5 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors font-medium"
                  disabled={isSubmitting}
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 font-semibold rounded-lg bg-[#FFD93D] text-[#1E3A5F] hover:bg-[#FFE566] transition-colors disabled:opacity-50"
                  disabled={isSubmitting || !newStatus}
                >
                  {isSubmitting ? '提交中...' : '确认处理'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppLayout>
  );
}

function TicketsLoadingSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-10 w-64 bg-gray-200 rounded animate-pulse" />
      <div className="flex gap-4">
        <div className="h-10 w-80 bg-gray-200 rounded animate-pulse" />
        <div className="flex gap-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-10 w-20 bg-gray-200 rounded-full animate-pulse" />
          ))}
        </div>
      </div>
      <div className="space-y-3 mt-6">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-24 bg-white rounded-lg border animate-pulse" />
        ))}
      </div>
    </div>
  );
}
