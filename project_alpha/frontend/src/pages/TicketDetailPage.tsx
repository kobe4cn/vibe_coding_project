import { useParams, useNavigate, Link } from 'react-router-dom';
import { useTicket, useDeleteTicket, useUpdateTicketStatus } from '@/hooks/useTickets';
import { useAttachments } from '@/hooks/useAttachments';
import { StatusBadge } from '@/components/common/StatusBadge';
import { PriorityBadge } from '@/components/common/PriorityBadge';
import { TagBadge } from '@/components/tag/TagBadge';
import { TicketHistory } from '@/components/ticket/TicketHistory';
import { formatDate, formatFileSize } from '@/lib/utils';
import { STATUS_TRANSITIONS, type TicketStatus, STATUS_LABELS } from '@/types';
import { ArrowLeft, Edit, Trash2, Paperclip, Download } from 'lucide-react';
import { useState } from 'react';
import { attachmentApi } from '@/api/attachments';

export function TicketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [statusResolution, setStatusResolution] = useState('');
  const [changingStatus, setChangingStatus] = useState<TicketStatus | null>(null);

  const { data: ticket, isLoading, error } = useTicket(id!);
  const { data: attachments } = useAttachments(id!);
  const deleteMutation = useDeleteTicket();
  const statusMutation = useUpdateTicketStatus();

  if (isLoading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto"></div>
      </div>
    );
  }

  if (error || !ticket) {
    return (
      <div className="text-center py-12">
        <p className="text-red-500">票据不存在或加载失败</p>
        <Link to="/tickets" className="text-blue-600 hover:underline mt-2 inline-block">
          返回列表
        </Link>
      </div>
    );
  }

  const allowedTransitions = STATUS_TRANSITIONS[ticket.status as TicketStatus] || [];

  const handleDelete = async () => {
    await deleteMutation.mutateAsync(id!);
    navigate('/tickets');
  };

  const handleStatusChange = async (newStatus: TicketStatus) => {
    if (newStatus === 'completed' && !statusResolution.trim()) {
      setChangingStatus(newStatus);
      return;
    }

    await statusMutation.mutateAsync({
      id: id!,
      data: {
        status: newStatus,
        resolution: statusResolution || undefined,
      },
    });
    setChangingStatus(null);
    setStatusResolution('');
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link
          to="/tickets"
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 flex-1">{ticket.title}</h1>
        <div className="flex items-center gap-2">
          <Link
            to={`/tickets/${id}/edit`}
            className="inline-flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <Edit className="w-4 h-4" />
            编辑
          </Link>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="inline-flex items-center gap-2 px-3 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50"
          >
            <Trash2 className="w-4 h-4" />
            删除
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Description */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-sm font-medium text-gray-500 mb-2">描述</h2>
            <p className="text-gray-900 whitespace-pre-wrap">
              {ticket.description || '无描述'}
            </p>
          </div>

          {/* Resolution */}
          {ticket.resolution && (
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-sm font-medium text-gray-500 mb-2">处理结果</h2>
              <p className="text-gray-900 whitespace-pre-wrap">{ticket.resolution}</p>
            </div>
          )}

          {/* Attachments */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-sm font-medium text-gray-500 mb-4 flex items-center gap-2">
              <Paperclip className="w-4 h-4" />
              附件 ({attachments?.length || 0})
            </h2>
            {attachments && attachments.length > 0 ? (
              <div className="space-y-2">
                {attachments.map((att) => (
                  <div
                    key={att.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-900">{att.filename}</p>
                      <p className="text-xs text-gray-500">{formatFileSize(att.size_bytes)}</p>
                    </div>
                    <a
                      href={attachmentApi.downloadUrl(att.id)}
                      className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
                      download
                    >
                      <Download className="w-4 h-4" />
                    </a>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-sm">暂无附件</p>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Status card */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-sm font-medium text-gray-500 mb-4">状态</h2>
            <StatusBadge status={ticket.status as TicketStatus} className="mb-4" />
            
            {allowedTransitions.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-gray-500">切换状态:</p>
                <div className="flex flex-wrap gap-2">
                  {allowedTransitions.map((status) => (
                    <button
                      key={status}
                      onClick={() => handleStatusChange(status)}
                      disabled={statusMutation.isPending}
                      className="px-3 py-1 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                    >
                      {STATUS_LABELS[status]}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Priority */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-sm font-medium text-gray-500 mb-2">优先级</h2>
            <PriorityBadge priority={ticket.priority} />
          </div>

          {/* Tags */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-sm font-medium text-gray-500 mb-2">标签</h2>
            {ticket.tags.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {ticket.tags.map((tag) => (
                  <TagBadge key={tag.id} tag={tag} />
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-sm">无标签</p>
            )}
          </div>

          {/* Timestamps */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-sm font-medium text-gray-500 mb-2">时间信息</h2>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-500">创建时间</dt>
                <dd className="text-gray-900">{formatDate(ticket.created_at)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">更新时间</dt>
                <dd className="text-gray-900">{formatDate(ticket.updated_at)}</dd>
              </div>
              {ticket.completed_at && (
                <div className="flex justify-between">
                  <dt className="text-gray-500">完成时间</dt>
                  <dd className="text-gray-900">{formatDate(ticket.completed_at)}</dd>
                </div>
              )}
            </dl>
          </div>

          {/* History */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-sm font-medium text-gray-500 mb-4">变更历史</h2>
            <TicketHistory ticketId={id!} />
          </div>
        </div>
      </div>

      {/* Delete confirmation dialog */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-medium text-gray-900 mb-2">确认删除</h3>
            <p className="text-gray-500 mb-4">确定要删除这个票据吗？此操作无法撤销。</p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteMutation.isPending}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                删除
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Status change dialog (for completed) */}
      {changingStatus === 'completed' && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-medium text-gray-900 mb-2">完成票据</h3>
            <p className="text-gray-500 mb-4">请填写处理结果：</p>
            <textarea
              value={statusResolution}
              onChange={(e) => setStatusResolution(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg mb-4"
              rows={4}
              placeholder="请输入处理结果..."
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setChangingStatus(null);
                  setStatusResolution('');
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={() => handleStatusChange('completed')}
                disabled={!statusResolution.trim() || statusMutation.isPending}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                确认完成
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

