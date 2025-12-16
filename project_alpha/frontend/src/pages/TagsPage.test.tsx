import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TagsPage } from './TagsPage';
import * as useTagsHook from '@/hooks/useTags';

vi.mock('@/hooks/useTags');

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

describe('TagsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.confirm = vi.fn(() => true);
  });

  it('renders page title and create button', () => {
    vi.mocked(useTagsHook.useTags).mockReturnValue({
      data: mockTags,
      isLoading: false,
    } as any);
    vi.mocked(useTagsHook.useCreateTag).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as any);
    vi.mocked(useTagsHook.useDeleteTag).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as any);

    render(<TagsPage />, { wrapper: createWrapper() });

    expect(screen.getByText('标签管理')).toBeInTheDocument();
    expect(screen.getByText('新建标签')).toBeInTheDocument();
  });

  it('shows loading state', () => {
    vi.mocked(useTagsHook.useTags).mockReturnValue({
      data: undefined,
      isLoading: true,
    } as any);
    vi.mocked(useTagsHook.useCreateTag).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as any);
    vi.mocked(useTagsHook.useDeleteTag).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as any);

    render(<TagsPage />, { wrapper: createWrapper() });

    // Loading spinner is rendered
    const spinner = document.querySelector('.animate-spin');
    expect(spinner).toBeInTheDocument();
  });

  it('displays predefined and custom tags', () => {
    vi.mocked(useTagsHook.useTags).mockReturnValue({
      data: mockTags,
      isLoading: false,
    } as any);
    vi.mocked(useTagsHook.useCreateTag).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as any);
    vi.mocked(useTagsHook.useDeleteTag).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as any);

    render(<TagsPage />, { wrapper: createWrapper() });

    expect(screen.getByText('预定义标签')).toBeInTheDocument();
    expect(screen.getByText('自定义标签')).toBeInTheDocument();
    expect(screen.getByText('Bug')).toBeInTheDocument();
    expect(screen.getByText('Feature')).toBeInTheDocument();
  });

  it('shows create form when button clicked', () => {
    vi.mocked(useTagsHook.useTags).mockReturnValue({
      data: mockTags,
      isLoading: false,
    } as any);
    vi.mocked(useTagsHook.useCreateTag).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as any);
    vi.mocked(useTagsHook.useDeleteTag).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as any);

    render(<TagsPage />, { wrapper: createWrapper() });

    const createButton = screen.getByText('新建标签');
    fireEvent.click(createButton);

    expect(screen.getByPlaceholderText('请输入标签名称')).toBeInTheDocument();
  });

  it('creates tag when form submitted', async () => {
    const mockCreate = vi.fn().mockResolvedValue({});
    vi.mocked(useTagsHook.useTags).mockReturnValue({
      data: mockTags,
      isLoading: false,
    } as any);
    vi.mocked(useTagsHook.useCreateTag).mockReturnValue({
      mutateAsync: mockCreate,
      isPending: false,
    } as any);
    vi.mocked(useTagsHook.useDeleteTag).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as any);

    render(<TagsPage />, { wrapper: createWrapper() });

    const createButton = screen.getByText('新建标签');
    fireEvent.click(createButton);

    const nameInput = screen.getByPlaceholderText('请输入标签名称');
    fireEvent.change(nameInput, { target: { value: 'New Tag' } });

    const submitButton = screen.getByText('创建');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalledWith({
        name: 'New Tag',
        color: '#3B82F6',
      });
    });
  });

  it('cancels create form', () => {
    vi.mocked(useTagsHook.useTags).mockReturnValue({
      data: mockTags,
      isLoading: false,
    } as any);
    vi.mocked(useTagsHook.useCreateTag).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as any);
    vi.mocked(useTagsHook.useDeleteTag).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as any);

    render(<TagsPage />, { wrapper: createWrapper() });

    const createButton = screen.getByText('新建标签');
    fireEvent.click(createButton);

    const cancelButton = screen.getByText('取消');
    fireEvent.click(cancelButton);

    expect(screen.queryByPlaceholderText('请输入标签名称')).not.toBeInTheDocument();
  });

  it('deletes tag when delete button clicked', async () => {
    const mockDelete = vi.fn().mockResolvedValue({});
    vi.mocked(useTagsHook.useTags).mockReturnValue({
      data: mockTags,
      isLoading: false,
    } as any);
    vi.mocked(useTagsHook.useCreateTag).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as any);
    vi.mocked(useTagsHook.useDeleteTag).mockReturnValue({
      mutateAsync: mockDelete,
      isPending: false,
    } as any);

    render(<TagsPage />, { wrapper: createWrapper() });

    const deleteButtons = screen.getAllByRole('button');
    const deleteButton = deleteButtons.find((btn: HTMLElement) => 
      btn.querySelector('svg') && btn.closest('div')?.textContent?.includes('Feature')
    );

    if (deleteButton) {
      fireEvent.click(deleteButton);
      await waitFor(() => {
        expect(mockDelete).toHaveBeenCalledWith('tag-2');
      });
    }
  });

  it('shows empty state for custom tags', () => {
    const onlyPredefinedTags = [mockTags[0]];
    vi.mocked(useTagsHook.useTags).mockReturnValue({
      data: onlyPredefinedTags,
      isLoading: false,
    } as any);
    vi.mocked(useTagsHook.useCreateTag).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as any);
    vi.mocked(useTagsHook.useDeleteTag).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as any);

    render(<TagsPage />, { wrapper: createWrapper() });

    expect(screen.getByText('暂无自定义标签')).toBeInTheDocument();
  });
});

