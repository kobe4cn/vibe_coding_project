import { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useTicket, useUpdateTicket, useAddTag, useRemoveTag } from '@/hooks/useTickets';
import { useTags } from '@/hooks/useTags';
import { useAttachments, useUploadAttachment, useDeleteAttachment } from '@/hooks/useAttachments';
import { TagBadge } from '@/components/tag/TagBadge';
import { formatFileSize } from '@/lib/utils';
import { attachmentApi } from '@/api/attachments';
import type { Priority, TicketStatus } from '@/types';
import { ArrowLeft, Upload, Trash2, Download } from 'lucide-react';

export function TicketEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: ticket, isLoading } = useTicket(id!);
  const { data: allTags } = useTags();
  const { data: attachments } = useAttachments(id!);

  const updateMutation = useUpdateTicket();
  const addTagMutation = useAddTag();
  const removeTagMutation = useRemoveTag();
  const uploadMutation = useUploadAttachment();
  const deleteAttachmentMutation = useDeleteAttachment();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<Priority>('medium');
  const [status, setStatus] = useState<TicketStatus>('open');
  const [resolution, setResolution] = useState('');

  useEffect(() => {
    if (ticket) {
      setTitle(ticket.title);
      setDescription(ticket.description || '');
      setPriority(ticket.priority);
      setStatus(ticket.status);
      setResolution(ticket.resolution || '');
    }
  }, [ticket]);

  if (isLoading || !ticket) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto"></div>
      </div>
    );
  }

  // Get allowed status transitions
  const getAllowedStatuses = (currentStatus: TicketStatus): TicketStatus[] => {
    switch (currentStatus) {
      case 'open':
        return ['in_progress', 'cancelled'];
      case 'in_progress':
        return ['open', 'completed', 'cancelled'];
      case 'completed':
        return ['open'];
      case 'cancelled':
        return ['open'];
      default:
        return [];
    }
  };

  const allowedStatuses = getAllowedStatuses(ticket.status);
  const isCompleted = status === 'completed';
  const requiresResolution = isCompleted && !resolution.trim();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (requiresResolution) {
      return;
    }

    await updateMutation.mutateAsync({
      id: id!,
      data: {
        title,
        description: description || undefined,
        priority,
        status: status !== ticket.status ? status : undefined,
        resolution: resolution || undefined,
      },
    });
    navigate(`/tickets/${id}`);
  };

  const handleAddTag = async (tagId: string) => {
    await addTagMutation.mutateAsync({ ticketId: id!, tagId });
  };

  const handleRemoveTag = async (tagId: string) => {
    await removeTagMutation.mutateAsync({ ticketId: id!, tagId });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await uploadMutation.mutateAsync({ ticketId: id!, file });
      e.target.value = '';
    }
  };

  const handleDeleteAttachment = async (attachmentId: string) => {
    await deleteAttachmentMutation.mutateAsync({ id: attachmentId, ticketId: id! });
  };

  const ticketTagIds = new Set(ticket.tags.map((t) => t.id));
  const availableTags = allTags?.filter((t) => !ticketTagIds.has(t.id)) || [];

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link
          to={`/tickets/${id}`}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">编辑票据</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main form */}
        <form onSubmit={handleSubmit} className="lg:col-span-2">
          <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-6">
            {/* Title */}
            <div>
              <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
                标题 <span className="text-red-500">*</span>
              </label>
              <input
                id="title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Description */}
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                描述
              </label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={5}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Priority */}
            <div>
              <label htmlFor="priority" className="block text-sm font-medium text-gray-700 mb-1">
                优先级
              </label>
              <select
                id="priority"
                value={priority}
                onChange={(e) => setPriority(e.target.value as Priority)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="low">低</option>
                <option value="medium">中</option>
                <option value="high">高</option>
                <option value="urgent">紧急</option>
              </select>
            </div>

            {/* Status */}
            <div>
              <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-1">
                状态
              </label>
              <select
                id="status"
                value={status}
                onChange={(e) => setStatus(e.target.value as TicketStatus)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value={ticket.status}>
                  {ticket.status === 'open' && '开放'}
                  {ticket.status === 'in_progress' && '进行中'}
                  {ticket.status === 'completed' && '已完成'}
                  {ticket.status === 'cancelled' && '已取消'}
                </option>
                {allowedStatuses.map((s) => (
                  <option key={s} value={s}>
                    {s === 'open' && '开放'}
                    {s === 'in_progress' && '进行中'}
                    {s === 'completed' && '已完成'}
                    {s === 'cancelled' && '已取消'}
                  </option>
                ))}
              </select>
            </div>

            {/* Resolution */}
            <div>
              <label htmlFor="resolution" className="block text-sm font-medium text-gray-700 mb-1">
                处理结果 {isCompleted && <span className="text-red-500">*</span>}
              </label>
              <textarea
                id="resolution"
                value={resolution}
                onChange={(e) => setResolution(e.target.value)}
                rows={3}
                required={isCompleted}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                  requiresResolution ? 'border-red-300' : 'border-gray-300'
                }`}
                placeholder={isCompleted ? '完成状态必须填写处理结果' : ''}
              />
              {requiresResolution && (
                <p className="mt-1 text-sm text-red-600">完成状态必须填写处理结果</p>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
              <Link
                to={`/tickets/${id}`}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                取消
              </Link>
              <button
                type="submit"
                disabled={!title.trim() || requiresResolution || updateMutation.isPending}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {updateMutation.isPending ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </form>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Tags */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-sm font-medium text-gray-500 mb-4">标签</h2>
            
            {/* Current tags */}
            <div className="flex flex-wrap gap-2 mb-4">
              {ticket.tags.map((tag) => (
                <TagBadge key={tag.id} tag={tag} onRemove={() => handleRemoveTag(tag.id)} />
              ))}
              {ticket.tags.length === 0 && (
                <span className="text-sm text-gray-400">暂无标签</span>
              )}
            </div>

            {/* Add tag */}
            {availableTags.length > 0 && (
              <div>
                <p className="text-xs text-gray-500 mb-2">添加标签:</p>
                <div className="flex flex-wrap gap-2">
                  {availableTags.map((tag) => (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => handleAddTag(tag.id)}
                      disabled={addTagMutation.isPending}
                      className="opacity-60 hover:opacity-100 transition-opacity"
                    >
                      <TagBadge tag={tag} />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Attachments */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-sm font-medium text-gray-500 mb-4">附件</h2>
            
            {/* Upload */}
            <label className="flex items-center justify-center gap-2 p-4 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-500 transition-colors mb-4">
              <Upload className="w-5 h-5 text-gray-400" />
              <span className="text-sm text-gray-500">点击上传文件</span>
              <input
                type="file"
                className="hidden"
                onChange={handleFileUpload}
                disabled={uploadMutation.isPending}
              />
            </label>

            {/* Attachment list */}
            {attachments && attachments.length > 0 && (
              <div className="space-y-2">
                {attachments.map((att) => (
                  <div
                    key={att.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 truncate">{att.filename}</p>
                      <p className="text-xs text-gray-500">{formatFileSize(att.size_bytes)}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <a
                        href={attachmentApi.downloadUrl(att.id)}
                        className="p-1.5 hover:bg-gray-200 rounded"
                        download
                      >
                        <Download className="w-4 h-4" />
                      </a>
                      <button
                        type="button"
                        onClick={() => handleDeleteAttachment(att.id)}
                        className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

