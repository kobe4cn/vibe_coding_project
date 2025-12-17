import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TicketEditPage } from './TicketEditPage';
import * as useTicketsHook from '@/hooks/useTickets';
import * as useTagsHook from '@/hooks/useTags';
import * as useAttachmentsHook from '@/hooks/useAttachments';
import type { UseQueryResult, UseMutationResult } from '@tanstack/react-query';
import type { TicketWithTags, Tag, Attachment, UpdateTicketRequest } from '@/types';

vi.mock('@/hooks/useTickets');
vi.mock('@/hooks/useTags');
vi.mock('@/hooks/useAttachments');
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

const mockTags = [
  {
    id: 'tag-1',
    name: 'Bug',
    color: '#EF4444',
    icon: 'bug',
    is_predefined: true,
    created_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'tag-2',
    name: 'Feature',
    color: '#3B82F6',
    icon: null,
    is_predefined: false,
    created_at: '2024-01-02T00:00:00Z',
  },
];

describe('TicketEditPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders edit form with ticket data', async () => {
    vi.mocked(useTicketsHook.useTicket).mockReturnValue({
      data: mockTicket,
      isLoading: false,
    } as Partial<UseQueryResult<TicketWithTags>> as UseQueryResult<TicketWithTags>);
    vi.mocked(useTicketsHook.useUpdateTicket).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as Partial<UseMutationResult<TicketWithTags, Error, { id: string; data: UpdateTicketRequest }>> as UseMutationResult<TicketWithTags, Error, { id: string; data: UpdateTicketRequest }>);
    vi.mocked(useTicketsHook.useAddTag).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as Partial<UseMutationResult<TicketWithTags, Error, { ticketId: string; tagId: string }>> as UseMutationResult<TicketWithTags, Error, { ticketId: string; tagId: string }>);
    vi.mocked(useTicketsHook.useRemoveTag).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as Partial<UseMutationResult<TicketWithTags, Error, { ticketId: string; tagId: string }>> as UseMutationResult<TicketWithTags, Error, { ticketId: string; tagId: string }>);
    vi.mocked(useTagsHook.useTags).mockReturnValue({
      data: mockTags,
      isLoading: false,
    } as Partial<UseQueryResult<Tag[]>> as UseQueryResult<Tag[]>);
    vi.mocked(useAttachmentsHook.useAttachments).mockReturnValue({
      data: [],
      isLoading: false,
    } as Partial<UseQueryResult<Attachment[]>> as UseQueryResult<Attachment[]>);
    vi.mocked(useAttachmentsHook.useUploadAttachment).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as Partial<UseMutationResult<Attachment, Error, { ticketId: string; file: File }>> as UseMutationResult<Attachment, Error, { ticketId: string; file: File }>);
    vi.mocked(useAttachmentsHook.useDeleteAttachment).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as Partial<UseMutationResult<void, Error, { id: string; ticketId: string }>> as UseMutationResult<void, Error, { id: string; ticketId: string }>);

    render(
      <BrowserRouter>
        <TicketEditPage />
      </BrowserRouter>,
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(screen.getByDisplayValue('Test Ticket')).toBeInTheDocument();
    });
    expect(screen.getByDisplayValue('Test description')).toBeInTheDocument();
  });

  it('shows loading state', () => {
    vi.mocked(useTicketsHook.useTicket).mockReturnValue({
      data: undefined,
      isLoading: true,
    } as Partial<UseQueryResult<TicketWithTags>> as UseQueryResult<TicketWithTags>);
    vi.mocked(useTicketsHook.useUpdateTicket).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as Partial<UseMutationResult<TicketWithTags, Error, { id: string; data: UpdateTicketRequest }>> as UseMutationResult<TicketWithTags, Error, { id: string; data: UpdateTicketRequest }>);
    vi.mocked(useTicketsHook.useAddTag).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as Partial<UseMutationResult<TicketWithTags, Error, { ticketId: string; tagId: string }>> as UseMutationResult<TicketWithTags, Error, { ticketId: string; tagId: string }>);
    vi.mocked(useTicketsHook.useRemoveTag).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as Partial<UseMutationResult<TicketWithTags, Error, { ticketId: string; tagId: string }>> as UseMutationResult<TicketWithTags, Error, { ticketId: string; tagId: string }>);
    vi.mocked(useTagsHook.useTags).mockReturnValue({
      data: mockTags,
      isLoading: false,
    } as Partial<UseQueryResult<Tag[]>> as UseQueryResult<Tag[]>);
    vi.mocked(useAttachmentsHook.useAttachments).mockReturnValue({
      data: [],
      isLoading: false,
    } as Partial<UseQueryResult<Attachment[]>> as UseQueryResult<Attachment[]>);
    vi.mocked(useAttachmentsHook.useUploadAttachment).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as Partial<UseMutationResult<Attachment, Error, { ticketId: string; file: File }>> as UseMutationResult<Attachment, Error, { ticketId: string; file: File }>);
    vi.mocked(useAttachmentsHook.useDeleteAttachment).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as Partial<UseMutationResult<void, Error, { id: string; ticketId: string }>> as UseMutationResult<void, Error, { id: string; ticketId: string }>);

    render(
      <BrowserRouter>
        <TicketEditPage />
      </BrowserRouter>,
      { wrapper: createWrapper() }
    );

    const spinner = document.querySelector('.animate-spin');
    expect(spinner).toBeInTheDocument();
  });

  it('updates ticket when form submitted', async () => {
    const mockUpdate = vi.fn().mockResolvedValue(mockTicket);

    vi.mocked(useTicketsHook.useTicket).mockReturnValue({
      data: mockTicket,
      isLoading: false,
    } as Partial<UseQueryResult<TicketWithTags>> as UseQueryResult<TicketWithTags>);
    vi.mocked(useTicketsHook.useUpdateTicket).mockReturnValue({
      mutateAsync: mockUpdate,
      isPending: false,
    } as Partial<UseQueryResult<TicketWithTags>> as UseQueryResult<TicketWithTags>);
    vi.mocked(useTicketsHook.useAddTag).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as Partial<UseQueryResult<TicketWithTags>> as UseQueryResult<TicketWithTags>);
    vi.mocked(useTicketsHook.useRemoveTag).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as Partial<UseQueryResult<TicketWithTags>> as UseQueryResult<TicketWithTags>);
    vi.mocked(useTagsHook.useTags).mockReturnValue({
      data: mockTags,
      isLoading: false,
    } as Partial<UseQueryResult<TicketWithTags>> as UseQueryResult<TicketWithTags>);
    vi.mocked(useAttachmentsHook.useAttachments).mockReturnValue({
      data: [],
      isLoading: false,
    } as Partial<UseQueryResult<TicketWithTags>> as UseQueryResult<TicketWithTags>);
    vi.mocked(useAttachmentsHook.useUploadAttachment).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as Partial<UseQueryResult<TicketWithTags>> as UseQueryResult<TicketWithTags>);
    vi.mocked(useAttachmentsHook.useDeleteAttachment).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as Partial<UseQueryResult<TicketWithTags>> as UseQueryResult<TicketWithTags>);

    render(
      <BrowserRouter>
        <TicketEditPage />
      </BrowserRouter>,
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(screen.getByDisplayValue('Test Ticket')).toBeInTheDocument();
    });

    const titleInput = screen.getByLabelText(/标题/);
    fireEvent.change(titleInput, { target: { value: 'Updated Title' } });

    const submitButton = screen.getByText('保存');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledWith({
        id: 'ticket-1',
        data: expect.objectContaining({
          title: 'Updated Title',
        }),
      });
    });
  });

  it('displays current tags', async () => {
    vi.mocked(useTicketsHook.useTicket).mockReturnValue({
      data: mockTicket,
      isLoading: false,
    } as Partial<UseQueryResult<TicketWithTags>> as UseQueryResult<TicketWithTags>);
    vi.mocked(useTicketsHook.useUpdateTicket).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as Partial<UseMutationResult<TicketWithTags, Error, { id: string; data: UpdateTicketRequest }>> as UseMutationResult<TicketWithTags, Error, { id: string; data: UpdateTicketRequest }>);
    vi.mocked(useTicketsHook.useAddTag).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as Partial<UseMutationResult<TicketWithTags, Error, { ticketId: string; tagId: string }>> as UseMutationResult<TicketWithTags, Error, { ticketId: string; tagId: string }>);
    vi.mocked(useTicketsHook.useRemoveTag).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as Partial<UseMutationResult<TicketWithTags, Error, { ticketId: string; tagId: string }>> as UseMutationResult<TicketWithTags, Error, { ticketId: string; tagId: string }>);
    vi.mocked(useTagsHook.useTags).mockReturnValue({
      data: mockTags,
      isLoading: false,
    } as Partial<UseQueryResult<Tag[]>> as UseQueryResult<Tag[]>);
    vi.mocked(useAttachmentsHook.useAttachments).mockReturnValue({
      data: [],
      isLoading: false,
    } as Partial<UseQueryResult<Attachment[]>> as UseQueryResult<Attachment[]>);
    vi.mocked(useAttachmentsHook.useUploadAttachment).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as Partial<UseMutationResult<Attachment, Error, { ticketId: string; file: File }>> as UseMutationResult<Attachment, Error, { ticketId: string; file: File }>);
    vi.mocked(useAttachmentsHook.useDeleteAttachment).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as Partial<UseMutationResult<void, Error, { id: string; ticketId: string }>> as UseMutationResult<void, Error, { id: string; ticketId: string }>);

    render(
      <BrowserRouter>
        <TicketEditPage />
      </BrowserRouter>,
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(screen.getByText('Bug')).toBeInTheDocument();
    });
  });

  it('displays attachments', async () => {
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
    } as Partial<UseQueryResult<TicketWithTags>> as UseQueryResult<TicketWithTags>);
    vi.mocked(useTicketsHook.useUpdateTicket).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as Partial<UseQueryResult<TicketWithTags>> as UseQueryResult<TicketWithTags>);
    vi.mocked(useTicketsHook.useAddTag).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as Partial<UseQueryResult<TicketWithTags>> as UseQueryResult<TicketWithTags>);
    vi.mocked(useTicketsHook.useRemoveTag).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as Partial<UseQueryResult<TicketWithTags>> as UseQueryResult<TicketWithTags>);
    vi.mocked(useTagsHook.useTags).mockReturnValue({
      data: mockTags,
      isLoading: false,
    } as Partial<UseQueryResult<TicketWithTags>> as UseQueryResult<TicketWithTags>);
    vi.mocked(useAttachmentsHook.useAttachments).mockReturnValue({
      data: mockAttachments,
      isLoading: false,
    } as Partial<UseQueryResult<TicketWithTags>> as UseQueryResult<TicketWithTags>);
    vi.mocked(useAttachmentsHook.useUploadAttachment).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as Partial<UseQueryResult<TicketWithTags>> as UseQueryResult<TicketWithTags>);
    vi.mocked(useAttachmentsHook.useDeleteAttachment).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as Partial<UseQueryResult<TicketWithTags>> as UseQueryResult<TicketWithTags>);

    render(
      <BrowserRouter>
        <TicketEditPage />
      </BrowserRouter>,
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(screen.getByText('test.txt')).toBeInTheDocument();
    });
  });

  it('displays status selector with current status', async () => {
    vi.mocked(useTicketsHook.useTicket).mockReturnValue({
      data: mockTicket,
      isLoading: false,
    } as Partial<UseQueryResult<TicketWithTags>> as UseQueryResult<TicketWithTags>);
    vi.mocked(useTicketsHook.useUpdateTicket).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as Partial<UseMutationResult<TicketWithTags, Error, { id: string; data: UpdateTicketRequest }>> as UseMutationResult<TicketWithTags, Error, { id: string; data: UpdateTicketRequest }>);
    vi.mocked(useTicketsHook.useAddTag).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as Partial<UseMutationResult<TicketWithTags, Error, { ticketId: string; tagId: string }>> as UseMutationResult<TicketWithTags, Error, { ticketId: string; tagId: string }>);
    vi.mocked(useTicketsHook.useRemoveTag).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as Partial<UseMutationResult<TicketWithTags, Error, { ticketId: string; tagId: string }>> as UseMutationResult<TicketWithTags, Error, { ticketId: string; tagId: string }>);
    vi.mocked(useTagsHook.useTags).mockReturnValue({
      data: mockTags,
      isLoading: false,
    } as Partial<UseQueryResult<Tag[]>> as UseQueryResult<Tag[]>);
    vi.mocked(useAttachmentsHook.useAttachments).mockReturnValue({
      data: [],
      isLoading: false,
    } as Partial<UseQueryResult<Attachment[]>> as UseQueryResult<Attachment[]>);
    vi.mocked(useAttachmentsHook.useUploadAttachment).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as Partial<UseMutationResult<Attachment, Error, { ticketId: string; file: File }>> as UseMutationResult<Attachment, Error, { ticketId: string; file: File }>);
    vi.mocked(useAttachmentsHook.useDeleteAttachment).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as Partial<UseMutationResult<void, Error, { id: string; ticketId: string }>> as UseMutationResult<void, Error, { id: string; ticketId: string }>);

    render(
      <BrowserRouter>
        <TicketEditPage />
      </BrowserRouter>,
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      const statusSelect = screen.getByLabelText(/状态/);
      expect(statusSelect).toBeInTheDocument();
      expect(statusSelect).toHaveValue('open');
    });
  });

  it('submits form with status change', async () => {
    const mockUpdate = vi.fn().mockResolvedValue(mockTicket);

    vi.mocked(useTicketsHook.useTicket).mockReturnValue({
      data: mockTicket,
      isLoading: false,
    } as Partial<UseQueryResult<TicketWithTags>> as UseQueryResult<TicketWithTags>);
    vi.mocked(useTicketsHook.useUpdateTicket).mockReturnValue({
      mutateAsync: mockUpdate,
      isPending: false,
    } as Partial<UseQueryResult<TicketWithTags>> as UseQueryResult<TicketWithTags>);
    vi.mocked(useTicketsHook.useAddTag).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as Partial<UseQueryResult<TicketWithTags>> as UseQueryResult<TicketWithTags>);
    vi.mocked(useTicketsHook.useRemoveTag).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as Partial<UseQueryResult<TicketWithTags>> as UseQueryResult<TicketWithTags>);
    vi.mocked(useTagsHook.useTags).mockReturnValue({
      data: mockTags,
      isLoading: false,
    } as Partial<UseQueryResult<TicketWithTags>> as UseQueryResult<TicketWithTags>);
    vi.mocked(useAttachmentsHook.useAttachments).mockReturnValue({
      data: [],
      isLoading: false,
    } as Partial<UseQueryResult<TicketWithTags>> as UseQueryResult<TicketWithTags>);
    vi.mocked(useAttachmentsHook.useUploadAttachment).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as Partial<UseQueryResult<TicketWithTags>> as UseQueryResult<TicketWithTags>);
    vi.mocked(useAttachmentsHook.useDeleteAttachment).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as Partial<UseQueryResult<TicketWithTags>> as UseQueryResult<TicketWithTags>);

    render(
      <BrowserRouter>
        <TicketEditPage />
      </BrowserRouter>,
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(screen.getByDisplayValue('Test Ticket')).toBeInTheDocument();
    });

    const statusSelect = screen.getByLabelText(/状态/);
    fireEvent.change(statusSelect, { target: { value: 'in_progress' } });

    const submitButton = screen.getByText('保存');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledWith({
        id: 'ticket-1',
        data: expect.objectContaining({
          status: 'in_progress',
        }),
      });
    });
  });

  it('requires resolution when status is completed', async () => {
    const mockUpdate = vi.fn().mockResolvedValue(mockTicket);

    vi.mocked(useTicketsHook.useTicket).mockReturnValue({
      data: { ...mockTicket, status: 'in_progress' as const },
      isLoading: false,
    } as Partial<UseQueryResult<TicketWithTags>> as UseQueryResult<TicketWithTags>);
    vi.mocked(useTicketsHook.useUpdateTicket).mockReturnValue({
      mutateAsync: mockUpdate,
      isPending: false,
    } as Partial<UseQueryResult<TicketWithTags>> as UseQueryResult<TicketWithTags>);
    vi.mocked(useTicketsHook.useAddTag).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as Partial<UseQueryResult<TicketWithTags>> as UseQueryResult<TicketWithTags>);
    vi.mocked(useTicketsHook.useRemoveTag).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as Partial<UseQueryResult<TicketWithTags>> as UseQueryResult<TicketWithTags>);
    vi.mocked(useTagsHook.useTags).mockReturnValue({
      data: mockTags,
      isLoading: false,
    } as Partial<UseQueryResult<TicketWithTags>> as UseQueryResult<TicketWithTags>);
    vi.mocked(useAttachmentsHook.useAttachments).mockReturnValue({
      data: [],
      isLoading: false,
    } as Partial<UseQueryResult<TicketWithTags>> as UseQueryResult<TicketWithTags>);
    vi.mocked(useAttachmentsHook.useUploadAttachment).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as Partial<UseQueryResult<TicketWithTags>> as UseQueryResult<TicketWithTags>);
    vi.mocked(useAttachmentsHook.useDeleteAttachment).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as Partial<UseQueryResult<TicketWithTags>> as UseQueryResult<TicketWithTags>);

    render(
      <BrowserRouter>
        <TicketEditPage />
      </BrowserRouter>,
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(screen.getByDisplayValue('Test Ticket')).toBeInTheDocument();
    });

    const statusSelect = screen.getByLabelText(/状态/);
    fireEvent.change(statusSelect, { target: { value: 'completed' } });

    await waitFor(() => {
      const resolutionInput = screen.getByLabelText(/处理结果/);
      expect(resolutionInput).toBeRequired();
      expect(screen.getByText(/完成状态必须填写处理结果/)).toBeInTheDocument();
    });

    const submitButton = screen.getByText('保存');
    expect(submitButton).toBeDisabled();
  });

  it('enables submit when resolution is provided for completed status', async () => {
    const mockUpdate = vi.fn().mockResolvedValue(mockTicket);

    vi.mocked(useTicketsHook.useTicket).mockReturnValue({
      data: { ...mockTicket, status: 'in_progress' as const },
      isLoading: false,
    } as Partial<UseQueryResult<TicketWithTags>> as UseQueryResult<TicketWithTags>);
    vi.mocked(useTicketsHook.useUpdateTicket).mockReturnValue({
      mutateAsync: mockUpdate,
      isPending: false,
    } as Partial<UseQueryResult<TicketWithTags>> as UseQueryResult<TicketWithTags>);
    vi.mocked(useTicketsHook.useAddTag).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as Partial<UseQueryResult<TicketWithTags>> as UseQueryResult<TicketWithTags>);
    vi.mocked(useTicketsHook.useRemoveTag).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as Partial<UseQueryResult<TicketWithTags>> as UseQueryResult<TicketWithTags>);
    vi.mocked(useTagsHook.useTags).mockReturnValue({
      data: mockTags,
      isLoading: false,
    } as Partial<UseQueryResult<TicketWithTags>> as UseQueryResult<TicketWithTags>);
    vi.mocked(useAttachmentsHook.useAttachments).mockReturnValue({
      data: [],
      isLoading: false,
    } as Partial<UseQueryResult<TicketWithTags>> as UseQueryResult<TicketWithTags>);
    vi.mocked(useAttachmentsHook.useUploadAttachment).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as Partial<UseQueryResult<TicketWithTags>> as UseQueryResult<TicketWithTags>);
    vi.mocked(useAttachmentsHook.useDeleteAttachment).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as Partial<UseQueryResult<TicketWithTags>> as UseQueryResult<TicketWithTags>);

    render(
      <BrowserRouter>
        <TicketEditPage />
      </BrowserRouter>,
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(screen.getByDisplayValue('Test Ticket')).toBeInTheDocument();
    });

    const statusSelect = screen.getByLabelText(/状态/);
    fireEvent.change(statusSelect, { target: { value: 'completed' } });

    await waitFor(() => {
      const resolutionInput = screen.getByLabelText(/处理结果/);
      fireEvent.change(resolutionInput, { target: { value: 'Fixed the issue' } });
    });

    const submitButton = screen.getByText('保存');
    expect(submitButton).not.toBeDisabled();
  });
});

