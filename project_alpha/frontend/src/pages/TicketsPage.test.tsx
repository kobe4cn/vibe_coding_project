import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TicketsPage } from './TicketsPage';
import * as useTicketsHook from '@/hooks/useTickets';

vi.mock('@/hooks/useTickets');

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

const mockTickets = {
  data: [
    {
      id: 'ticket-1',
      title: 'Test Ticket 1',
      description: 'Description 1',
      priority: 'high' as const,
      status: 'open' as const,
      resolution: null,
      completed_at: null,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
      tags: [],
    },
    {
      id: 'ticket-2',
      title: 'Test Ticket 2',
      description: 'Description 2',
      priority: 'medium' as const,
      status: 'completed' as const,
      resolution: 'Fixed',
      completed_at: '2024-01-02T00:00:00Z',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-02T00:00:00Z',
      tags: [],
    },
  ],
  total: 2,
  page: 1,
  per_page: 20,
  total_pages: 1,
};

describe('TicketsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders page title and create button', () => {
    vi.mocked(useTicketsHook.useTickets).mockReturnValue({
      data: mockTickets,
      isLoading: false,
      error: null,
    } as any);

    render(
      <BrowserRouter>
        <TicketsPage />
      </BrowserRouter>,
      { wrapper: createWrapper() }
    );

    expect(screen.getByText('票据列表')).toBeInTheDocument();
    expect(screen.getByText('新建票据')).toBeInTheDocument();
  });

  it('shows loading state', () => {
    vi.mocked(useTicketsHook.useTickets).mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    } as any);

    render(
      <BrowserRouter>
        <TicketsPage />
      </BrowserRouter>,
      { wrapper: createWrapper() }
    );

    expect(screen.getByText('加载中...')).toBeInTheDocument();
  });

  it('shows error message', () => {
    vi.mocked(useTicketsHook.useTickets).mockReturnValue({
      data: undefined,
      isLoading: false,
      error: { message: 'Network error' } as any,
    } as any);

    render(
      <BrowserRouter>
        <TicketsPage />
      </BrowserRouter>,
      { wrapper: createWrapper() }
    );

    expect(screen.getByText(/加载失败/)).toBeInTheDocument();
  });

  it('displays tickets list', () => {
    vi.mocked(useTicketsHook.useTickets).mockReturnValue({
      data: mockTickets,
      isLoading: false,
      error: null,
    } as any);

    render(
      <BrowserRouter>
        <TicketsPage />
      </BrowserRouter>,
      { wrapper: createWrapper() }
    );

    expect(screen.getByText('Test Ticket 1')).toBeInTheDocument();
    expect(screen.getByText('Test Ticket 2')).toBeInTheDocument();
  });

  it('shows empty state when no tickets', () => {
    vi.mocked(useTicketsHook.useTickets).mockReturnValue({
      data: { ...mockTickets, data: [], total: 0 },
      isLoading: false,
      error: null,
    } as any);

    render(
      <BrowserRouter>
        <TicketsPage />
      </BrowserRouter>,
      { wrapper: createWrapper() }
    );

    expect(screen.getByText('暂无票据')).toBeInTheDocument();
  });

  it('handles search input', async () => {
    const mockUseTickets = vi.fn().mockReturnValue({
      data: mockTickets,
      isLoading: false,
      error: null,
    });
    vi.mocked(useTicketsHook.useTickets).mockImplementation(mockUseTickets);

    render(
      <BrowserRouter>
        <TicketsPage />
      </BrowserRouter>,
      { wrapper: createWrapper() }
    );

    const searchInput = screen.getByPlaceholderText('搜索票据...');
    fireEvent.change(searchInput, { target: { value: 'test' } });
    fireEvent.submit(searchInput.closest('form')!);

    await waitFor(() => {
      expect(mockUseTickets).toHaveBeenCalled();
    });
  });

  it('handles status filter', () => {
    const mockUseTickets = vi.fn().mockReturnValue({
      data: mockTickets,
      isLoading: false,
      error: null,
    });
    vi.mocked(useTicketsHook.useTickets).mockImplementation(mockUseTickets);

    render(
      <BrowserRouter>
        <TicketsPage />
      </BrowserRouter>,
      { wrapper: createWrapper() }
    );

    const statusSelect = screen.getByDisplayValue('全部状态');
    fireEvent.change(statusSelect, { target: { value: 'open' } });

    expect(mockUseTickets).toHaveBeenCalled();
  });

  it('handles priority filter', () => {
    const mockUseTickets = vi.fn().mockReturnValue({
      data: mockTickets,
      isLoading: false,
      error: null,
    });
    vi.mocked(useTicketsHook.useTickets).mockImplementation(mockUseTickets);

    render(
      <BrowserRouter>
        <TicketsPage />
      </BrowserRouter>,
      { wrapper: createWrapper() }
    );

    const prioritySelect = screen.getByDisplayValue('全部优先级');
    fireEvent.change(prioritySelect, { target: { value: 'high' } });

    expect(mockUseTickets).toHaveBeenCalled();
  });

  it('shows pagination when multiple pages', () => {
    vi.mocked(useTicketsHook.useTickets).mockReturnValue({
      data: { ...mockTickets, total_pages: 3, page: 2 },
      isLoading: false,
      error: null,
    } as any);

    render(
      <BrowserRouter>
        <TicketsPage />
      </BrowserRouter>,
      { wrapper: createWrapper() }
    );

    expect(screen.getByText('2 / 3')).toBeInTheDocument();
    expect(screen.getByText('上一页')).toBeInTheDocument();
    expect(screen.getByText('下一页')).toBeInTheDocument();
  });

  it('disables previous button on first page', () => {
    vi.mocked(useTicketsHook.useTickets).mockReturnValue({
      data: { ...mockTickets, total_pages: 2, page: 1 },
      isLoading: false,
      error: null,
    } as any);

    render(
      <BrowserRouter>
        <TicketsPage />
      </BrowserRouter>,
      { wrapper: createWrapper() }
    );

    const prevButton = screen.getByText('上一页');
    expect(prevButton).toBeDisabled();
  });

  it('disables next button on last page', () => {
    vi.mocked(useTicketsHook.useTickets).mockReturnValue({
      data: { ...mockTickets, total_pages: 2, page: 2 },
      isLoading: false,
      error: null,
    } as any);

    render(
      <BrowserRouter>
        <TicketsPage />
      </BrowserRouter>,
      { wrapper: createWrapper() }
    );

    const nextButton = screen.getByText('下一页');
    expect(nextButton).toBeDisabled();
  });
});

