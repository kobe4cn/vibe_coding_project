import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TicketCreatePage } from './TicketCreatePage';
import * as useTicketsHook from '@/hooks/useTickets';
import type { UseMutationResult } from '@tanstack/react-query';
import type { TicketWithTags, CreateTicketRequest } from '@/types';

vi.mock('@/hooks/useTickets');
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
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

describe('TicketCreatePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders page title and form', () => {
    vi.mocked(useTicketsHook.useCreateTicket).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as Partial<UseMutationResult<TicketWithTags, Error, CreateTicketRequest>> as UseMutationResult<TicketWithTags, Error, CreateTicketRequest>);

    render(
      <BrowserRouter>
        <TicketCreatePage />
      </BrowserRouter>,
      { wrapper: createWrapper() }
    );

    expect(screen.getByText('新建票据')).toBeInTheDocument();
    expect(screen.getByLabelText(/标题/)).toBeInTheDocument();
    expect(screen.getByLabelText(/描述/)).toBeInTheDocument();
    expect(screen.getByLabelText(/优先级/)).toBeInTheDocument();
  });

  it('submits form with ticket data', async () => {
    const mockCreate = vi.fn().mockResolvedValue({
      id: 'ticket-1',
      title: 'New Ticket',
    });
    vi.mocked(useTicketsHook.useCreateTicket).mockReturnValue({
      mutateAsync: mockCreate,
      isPending: false,
    } as Partial<UseMutationResult<TicketWithTags, Error, CreateTicketRequest>> as UseMutationResult<TicketWithTags, Error, CreateTicketRequest>);

    render(
      <BrowserRouter>
        <TicketCreatePage />
      </BrowserRouter>,
      { wrapper: createWrapper() }
    );

    const titleInput = screen.getByLabelText(/标题/);
    fireEvent.change(titleInput, { target: { value: 'New Ticket' } });

    const descriptionInput = screen.getByLabelText(/描述/);
    fireEvent.change(descriptionInput, { target: { value: 'Description' } });

    const prioritySelect = screen.getByLabelText(/优先级/);
    fireEvent.change(prioritySelect, { target: { value: 'high' } });

    const submitButton = screen.getByText('创建票据');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalledWith({
        title: 'New Ticket',
        description: 'Description',
        priority: 'high',
      });
    });
  });

  it('disables submit button when title is empty', () => {
    vi.mocked(useTicketsHook.useCreateTicket).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as Partial<UseMutationResult<TicketWithTags, Error, CreateTicketRequest>> as UseMutationResult<TicketWithTags, Error, CreateTicketRequest>);

    render(
      <BrowserRouter>
        <TicketCreatePage />
      </BrowserRouter>,
      { wrapper: createWrapper() }
    );

    const submitButton = screen.getByText('创建票据');
    expect(submitButton).toBeDisabled();
  });

  it('shows loading state when creating', () => {
    vi.mocked(useTicketsHook.useCreateTicket).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: true,
    } as Partial<UseMutationResult<TicketWithTags, Error, CreateTicketRequest>> as UseMutationResult<TicketWithTags, Error, CreateTicketRequest>);

    render(
      <BrowserRouter>
        <TicketCreatePage />
      </BrowserRouter>,
      { wrapper: createWrapper() }
    );

    expect(screen.getByText('创建中...')).toBeInTheDocument();
  });

  it('handles optional description', async () => {
    const mockCreate = vi.fn().mockResolvedValue({ id: 'ticket-1' });
    vi.mocked(useTicketsHook.useCreateTicket).mockReturnValue({
      mutateAsync: mockCreate,
      isPending: false,
    } as Partial<UseMutationResult<TicketWithTags, Error, CreateTicketRequest>> as UseMutationResult<TicketWithTags, Error, CreateTicketRequest>);

    render(
      <BrowserRouter>
        <TicketCreatePage />
      </BrowserRouter>,
      { wrapper: createWrapper() }
    );

    const titleInput = screen.getByLabelText(/标题/);
    fireEvent.change(titleInput, { target: { value: 'New Ticket' } });

    const submitButton = screen.getByText('创建票据');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalledWith({
        title: 'New Ticket',
        description: undefined,
        priority: 'medium',
      });
    });
  });
});

