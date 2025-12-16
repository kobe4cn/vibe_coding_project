import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTickets } from '@/hooks/useTickets';
import { TicketCard } from '@/components/ticket/TicketCard';
import type { TicketQuery, TicketStatus, Priority } from '@/types';
import { Plus, Search } from 'lucide-react';

export function TicketsPage() {
  const [query, setQuery] = useState<TicketQuery>({
    page: 1,
    per_page: 20,
  });
  const [search, setSearch] = useState('');

  const { data, isLoading, error } = useTickets(query);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setQuery((prev) => ({ ...prev, search: search || undefined, page: 1 }));
  };

  const handleStatusFilter = (status: TicketStatus | '') => {
    setQuery((prev) => ({
      ...prev,
      status: status || undefined,
      page: 1,
    }));
  };

  const handlePriorityFilter = (priority: Priority | '') => {
    setQuery((prev) => ({
      ...prev,
      priority: priority || undefined,
      page: 1,
    }));
  };

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-500">加载失败: {error.message}</p>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">票据列表</h1>
        <Link
          to="/tickets/new"
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          新建票据
        </Link>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
        <div className="flex flex-wrap items-center gap-4">
          <form onSubmit={handleSearch} className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="搜索票据..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </form>
          <select
            value={query.status || ''}
            onChange={(e) => handleStatusFilter(e.target.value as TicketStatus | '')}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="">全部状态</option>
            <option value="open">待处理</option>
            <option value="in_progress">处理中</option>
            <option value="completed">已完成</option>
            <option value="cancelled">已取消</option>
          </select>
          <select
            value={query.priority || ''}
            onChange={(e) => handlePriorityFilter(e.target.value as Priority | '')}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="">全部优先级</option>
            <option value="low">低</option>
            <option value="medium">中</option>
            <option value="high">高</option>
            <option value="urgent">紧急</option>
          </select>
        </div>
      </div>

      {/* Ticket list */}
      {isLoading ? (
        <div className="text-center py-12">
          <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto"></div>
          <p className="mt-2 text-gray-500">加载中...</p>
        </div>
      ) : data?.data.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
          <p className="text-gray-500">暂无票据</p>
          <Link
            to="/tickets/new"
            className="inline-flex items-center gap-2 mt-4 text-blue-600 hover:text-blue-700"
          >
            <Plus className="w-4 h-4" />
            创建第一个票据
          </Link>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {data?.data.map((ticket) => (
              <TicketCard key={ticket.id} ticket={ticket} />
            ))}
          </div>

          {/* Pagination */}
          {data && data.total_pages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-6">
              <button
                onClick={() => setQuery((prev) => ({ ...prev, page: (prev.page || 1) - 1 }))}
                disabled={data.page <= 1}
                className="px-3 py-1 border border-gray-300 rounded disabled:opacity-50"
              >
                上一页
              </button>
              <span className="text-sm text-gray-600">
                {data.page} / {data.total_pages}
              </span>
              <button
                onClick={() => setQuery((prev) => ({ ...prev, page: (prev.page || 1) + 1 }))}
                disabled={data.page >= data.total_pages}
                className="px-3 py-1 border border-gray-300 rounded disabled:opacity-50"
              >
                下一页
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

