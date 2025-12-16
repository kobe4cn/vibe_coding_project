import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TicketDetailPage } from './TicketDetailPage';
import * as useTicketsHook from '@/hooks/useTickets';
import * as useAttachmentsHook from '@/hooks/useAttachments';
import * as useTicketHistoryHook from '@/hooks/useTicketHistory';

vi.mock('@/hooks/useTickets');
vi.mock('@/hooks/useAttachments');
vi.mock('@/hooks/useTicketHistory');
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useParams: () => ({ id: 'ticket-1' }),
    useNavigate: () => vi.fn(),
  };
});

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

const mockTicket = {
  id: 'ticket-1',
  title: 'Test Ticket',
  description: 'Test description',
  priority: 'high' as const,
  status: 'open' as const,
  resolution: null,
  completed_at: null,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  tags: [
    {
      id: 'tag-1',
      name: 'Bug',
      color: '#EF4444',
      icon: 'bug',
      is_predefined: true,
      created_at: '2024-01-01T00:00:00Z',
    },
  ],
};

describe('TicketDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.confirm = vi.fn(() => true);
    // Default mock for useTicketHistory
    vi.mocked(useTicketHistoryHook.useTicketHistory).mockReturnValue({
      data: { data: [], total: 0 },
      isLoading: false,
      error: null,
    } as any);
  });

  it('renders ticket details', () => {
    vi.mocked(useTicketsHook.useTicket).mockReturnValue({
      data: mockTicket,
      isLoading: false,
      error: null,
    } as any);
    vi.mocked(useTicketsHook.useDeleteTicket).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as any);
    vi.mocked(useTicketsHook.useUpdateTicketStatus).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as any);
    vi.mocked(useAttachmentsHook.useAttachments).mockReturnValue({
      data: [],
      isLoading: false,
    } as any);

    render(
      <BrowserRouter>
        <TicketDetailPage />
      </BrowserRouter>,
      { wrapper: createWrapper() }
    );

    expect(screen.getByText('Test Ticket')).toBeInTheDocument();
    expect(screen.getByText('Test description')).toBeInTheDocument();
  });

  it('shows loading state', () => {
    vi.mocked(useTicketsHook.useTicket).mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    } as any);
    vi.mocked(useTicketsHook.useDeleteTicket).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as any);
    vi.mocked(useTicketsHook.useUpdateTicketStatus).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as any);
    vi.mocked(useAttachmentsHook.useAttachments).mockReturnValue({
      data: [],
      isLoading: false,
    } as any);

    render(
      <BrowserRouter>
        <TicketDetailPage />
      </BrowserRouter>,
      { wrapper: createWrapper() }
    );

    const spinner = document.querySelector('.animate-spin');
    expect(spinner).toBeInTheDocument();
  });

  it('shows error state', () => {
    vi.mocked(useTicketsHook.useTicket).mockReturnValue({
      data: undefined,
      isLoading: false,
      error: { message: 'Not found' } as any,
    } as any);
    vi.mocked(useTicketsHook.useDeleteTicket).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as any);
    vi.mocked(useTicketsHook.useUpdateTicketStatus).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as any);
    vi.mocked(useAttachmentsHook.useAttachments).mockReturnValue({
      data: [],
      isLoading: false,
    } as any);

    render(
      <BrowserRouter>
        <TicketDetailPage />
      </BrowserRouter>,
      { wrapper: createWrapper() }
    );

    expect(screen.getByText(/票据不存在或加载失败/)).toBeInTheDocument();
  });

  it('displays ticket tags', () => {
    vi.mocked(useTicketsHook.useTicket).mockReturnValue({
      data: mockTicket,
      isLoading: false,
      error: null,
    } as any);
    vi.mocked(useTicketsHook.useDeleteTicket).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as any);
    vi.mocked(useTicketsHook.useUpdateTicketStatus).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as any);
    vi.mocked(useAttachmentsHook.useAttachments).mockReturnValue({
      data: [],
      isLoading: false,
    } as any);

    render(
      <BrowserRouter>
        <TicketDetailPage />
      </BrowserRouter>,
      { wrapper: createWrapper() }
    );

    expect(screen.getByText('Bug')).toBeInTheDocument();
  });

  it('shows resolution when ticket is completed', () => {
    const completedTicket = {
      ...mockTicket,
      status: 'completed' as const,
      resolution: 'Fixed the issue',
      completed_at: '2024-01-02T00:00:00Z',
    };

    vi.mocked(useTicketsHook.useTicket).mockReturnValue({
      data: completedTicket,
      isLoading: false,
      error: null,
    } as any);
    vi.mocked(useTicketsHook.useDeleteTicket).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as any);
    vi.mocked(useTicketsHook.useUpdateTicketStatus).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as any);
    vi.mocked(useAttachmentsHook.useAttachments).mockReturnValue({
      data: [],
      isLoading: false,
    } as any);

    render(
      <BrowserRouter>
        <TicketDetailPage />
      </BrowserRouter>,
      { wrapper: createWrapper() }
    );

    expect(screen.getByText('处理结果')).toBeInTheDocument();
    expect(screen.getByText('Fixed the issue')).toBeInTheDocument();
  });

  it('displays attachments', () => {
    const mockAttachments = [
      {
        id: 'att-1',
        ticket_id: 'ticket-1',
        filename: 'test.txt',
        content_type: 'text/plain',
        size_bytes: 1024,
        created_at: '2024-01-01T00:00:00Z',
      },
    ];

    vi.mocked(useTicketsHook.useTicket).mockReturnValue({
      data: mockTicket,
      isLoading: false,
      error: null,
    } as any);
    vi.mocked(useTicketsHook.useDeleteTicket).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as any);
    vi.mocked(useTicketsHook.useUpdateTicketStatus).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as any);
    vi.mocked(useAttachmentsHook.useAttachments).mockReturnValue({
      data: mockAttachments,
      isLoading: false,
    } as any);

    render(
      <BrowserRouter>
        <TicketDetailPage />
      </BrowserRouter>,
      { wrapper: createWrapper() }
    );

    expect(screen.getByText('test.txt')).toBeInTheDocument();
  });

  it('shows status transition buttons', () => {
    vi.mocked(useTicketsHook.useTicket).mockReturnValue({
      data: mockTicket,
      isLoading: false,
      error: null,
    } as any);
    vi.mocked(useTicketsHook.useDeleteTicket).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as any);
    vi.mocked(useTicketsHook.useUpdateTicketStatus).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as any);
    vi.mocked(useAttachmentsHook.useAttachments).mockReturnValue({
      data: [],
      isLoading: false,
    } as any);

    render(
      <BrowserRouter>
        <TicketDetailPage />
      </BrowserRouter>,
      { wrapper: createWrapper() }
    );

    expect(screen.getByText('处理中')).toBeInTheDocument();
    expect(screen.getByText('已取消')).toBeInTheDocument();
  });

  it('shows delete confirmation dialog when delete button clicked', () => {
    vi.mocked(useTicketsHook.useTicket).mockReturnValue({
      data: mockTicket,
      isLoading: false,
      error: null,
    } as any);
    vi.mocked(useTicketsHook.useDeleteTicket).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as any);
    vi.mocked(useTicketsHook.useUpdateTicketStatus).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as any);
    vi.mocked(useAttachmentsHook.useAttachments).mockReturnValue({
      data: [],
      isLoading: false,
    } as any);

    render(
      <BrowserRouter>
        <TicketDetailPage />
      </BrowserRouter>,
      { wrapper: createWrapper() }
    );

    const deleteButton = screen.getByText('删除');
    expect(deleteButton).toBeInTheDocument();
    fireEvent.click(deleteButton);

    // Should show confirmation dialog
    expect(screen.getByText('确认删除')).toBeInTheDocument();
    expect(screen.getByText(/确定要删除这个票据吗/)).toBeInTheDocument();
  });

  it('displays ticket history section', () => {
    vi.mocked(useTicketsHook.useTicket).mockReturnValue({
      data: mockTicket,
      isLoading: false,
      error: null,
    } as any);
    vi.mocked(useTicketsHook.useDeleteTicket).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as any);
    vi.mocked(useTicketsHook.useUpdateTicketStatus).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as any);
    vi.mocked(useAttachmentsHook.useAttachments).mockReturnValue({
      data: [],
      isLoading: false,
    } as any);
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
    } as any);

    render(
      <BrowserRouter>
        <TicketDetailPage />
      </BrowserRouter>,
      { wrapper: createWrapper() }
    );

    expect(screen.getByText('变更历史')).toBeInTheDocument();
    expect(useTicketHistoryHook.useTicketHistory).toHaveBeenCalledWith('ticket-1', {
      change_type: undefined,
      limit: 50,
    });
  });

  it('shows history loading state', () => {
    vi.mocked(useTicketsHook.useTicket).mockReturnValue({
      data: mockTicket,
      isLoading: false,
      error: null,
    } as any);
    vi.mocked(useTicketsHook.useDeleteTicket).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as any);
    vi.mocked(useTicketsHook.useUpdateTicketStatus).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as any);
    vi.mocked(useAttachmentsHook.useAttachments).mockReturnValue({
      data: [],
      isLoading: false,
    } as any);
    vi.mocked(useTicketHistoryHook.useTicketHistory).mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    } as any);

    render(
      <BrowserRouter>
        <TicketDetailPage />
      </BrowserRouter>,
      { wrapper: createWrapper() }
    );

    expect(screen.getByText('变更历史')).toBeInTheDocument();
  });

  it('shows empty history message', () => {
    vi.mocked(useTicketsHook.useTicket).mockReturnValue({
      data: mockTicket,
      isLoading: false,
      error: null,
    } as any);
    vi.mocked(useTicketsHook.useDeleteTicket).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as any);
    vi.mocked(useTicketsHook.useUpdateTicketStatus).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as any);
    vi.mocked(useAttachmentsHook.useAttachments).mockReturnValue({
      data: [],
      isLoading: false,
    } as any);
    vi.mocked(useTicketHistoryHook.useTicketHistory).mockReturnValue({
      data: { data: [], total: 0 },
      isLoading: false,
      error: null,
    } as any);

    render(
      <BrowserRouter>
        <TicketDetailPage />
      </BrowserRouter>,
      { wrapper: createWrapper() }
    );

    expect(screen.getByText('变更历史')).toBeInTheDocument();
    expect(screen.getByText('暂无历史记录')).toBeInTheDocument();
  });
});

