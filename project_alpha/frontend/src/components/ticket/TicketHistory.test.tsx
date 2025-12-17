import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TicketHistory } from './TicketHistory';
import * as useTicketHistoryHook from '@/hooks/useTicketHistory';
import type { UseQueryResult } from '@tanstack/react-query';
import type { TicketHistoryResponse } from '@/types';

vi.mock('@/hooks/useTicketHistory');

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
};

const mockHistoryData = {
  data: [
    {
      id: 'hist-1',
      ticket_id: 'ticket-1',
      change_type: 'status' as const,
      field_name: 'status',
      old_value: 'open',
      new_value: 'in_progress',
      created_at: '2024-01-01T10:00:00Z',
    },
    {
      id: 'hist-2',
      ticket_id: 'ticket-1',
      change_type: 'priority' as const,
      field_name: 'priority',
      old_value: 'medium',
      new_value: 'high',
      created_at: '2024-01-01T11:00:00Z',
    },
    {
      id: 'hist-3',
      ticket_id: 'ticket-1',
      change_type: 'resolution' as const,
      field_name: 'resolution',
      old_value: null,
      new_value: 'Fixed the bug',
      created_at: '2024-01-01T12:00:00Z',
    },
  ],
  total: 3,
};

describe('TicketHistory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading state', () => {
    vi.mocked(useTicketHistoryHook.useTicketHistory).mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    } as Partial<UseQueryResult<TicketHistoryResponse>> as UseQueryResult<TicketHistoryResponse>);

    render(<TicketHistory ticketId="ticket-1" />, { wrapper: createWrapper() });

    const spinner = document.querySelector('.animate-spin');
    expect(spinner).toBeInTheDocument();
  });

  it('shows error state', () => {
    vi.mocked(useTicketHistoryHook.useTicketHistory).mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('Failed to load'),
    } as Partial<UseQueryResult<TicketHistoryResponse>> as UseQueryResult<TicketHistoryResponse>);

    render(<TicketHistory ticketId="ticket-1" />, { wrapper: createWrapper() });

    expect(screen.getByText('加载历史记录失败')).toBeInTheDocument();
  });

  it('shows empty state when no history', () => {
    vi.mocked(useTicketHistoryHook.useTicketHistory).mockReturnValue({
      data: { data: [], total: 0 },
      isLoading: false,
      error: null,
    } as Partial<UseQueryResult<TicketHistoryResponse>> as UseQueryResult<TicketHistoryResponse>);

    render(<TicketHistory ticketId="ticket-1" />, { wrapper: createWrapper() });

    expect(screen.getByText('暂无历史记录')).toBeInTheDocument();
  });

  it('displays history entries', async () => {
    vi.mocked(useTicketHistoryHook.useTicketHistory).mockReturnValue({
      data: mockHistoryData,
      isLoading: false,
      error: null,
    } as Partial<UseQueryResult<TicketHistoryResponse>> as UseQueryResult<TicketHistoryResponse>);

    render(<TicketHistory ticketId="ticket-1" />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('状态变更')).toBeInTheDocument();
      expect(screen.getByText('优先级变更')).toBeInTheDocument();
      expect(screen.getByText('处理结果变更')).toBeInTheDocument();
    });
  });

  it('displays formatted status values', async () => {
    vi.mocked(useTicketHistoryHook.useTicketHistory).mockReturnValue({
      data: {
        data: [
          {
            id: 'hist-1',
            ticket_id: 'ticket-1',
            change_type: 'status' as const,
            field_name: 'status',
            old_value: 'open',
            new_value: 'in_progress',
            created_at: '2024-01-01T10:00:00Z',
          },
        ],
        total: 1,
      },
      isLoading: false,
      error: null,
    } as Partial<UseQueryResult<TicketHistoryResponse>> as UseQueryResult<TicketHistoryResponse>);

    render(<TicketHistory ticketId="ticket-1" />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('开放')).toBeInTheDocument();
      expect(screen.getByText('进行中')).toBeInTheDocument();
    });
  });

  it('displays formatted priority values', async () => {
    vi.mocked(useTicketHistoryHook.useTicketHistory).mockReturnValue({
      data: {
        data: [
          {
            id: 'hist-1',
            ticket_id: 'ticket-1',
            change_type: 'priority' as const,
            field_name: 'priority',
            old_value: 'medium',
            new_value: 'high',
            created_at: '2024-01-01T10:00:00Z',
          },
        ],
        total: 1,
      },
      isLoading: false,
      error: null,
    } as Partial<UseQueryResult<TicketHistoryResponse>> as UseQueryResult<TicketHistoryResponse>);

    render(<TicketHistory ticketId="ticket-1" />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('中')).toBeInTheDocument();
      expect(screen.getByText('高')).toBeInTheDocument();
    });
  });

  it('displays null values as dash', async () => {
    vi.mocked(useTicketHistoryHook.useTicketHistory).mockReturnValue({
      data: {
        data: [
          {
            id: 'hist-1',
            ticket_id: 'ticket-1',
            change_type: 'resolution' as const,
            field_name: 'resolution',
            old_value: null,
            new_value: 'Fixed',
            created_at: '2024-01-01T10:00:00Z',
          },
        ],
        total: 1,
      },
      isLoading: false,
      error: null,
    } as Partial<UseQueryResult<TicketHistoryResponse>> as UseQueryResult<TicketHistoryResponse>);

    render(<TicketHistory ticketId="ticket-1" />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('-')).toBeInTheDocument();
      expect(screen.getByText('Fixed')).toBeInTheDocument();
    });
  });

  it('filters by change type when provided', () => {
    vi.mocked(useTicketHistoryHook.useTicketHistory).mockReturnValue({
      data: mockHistoryData,
      isLoading: false,
      error: null,
    } as Partial<UseQueryResult<TicketHistoryResponse>> as UseQueryResult<TicketHistoryResponse>);

    render(<TicketHistory ticketId="ticket-1" changeType="status" />, {
      wrapper: createWrapper(),
    });

    expect(useTicketHistoryHook.useTicketHistory).toHaveBeenCalledWith('ticket-1', {
      change_type: 'status',
      limit: 50,
    });
  });
});

