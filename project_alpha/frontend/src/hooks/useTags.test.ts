import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect } from 'vitest';
import { useTags, useCreateTag } from './useTags';
import { mockTags } from '@/test/mocks/handlers';
import React from 'react';

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
};

describe('useTags', () => {
  it('fetches tags list successfully', async () => {
    const { result } = renderHook(() => useTags(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toHaveLength(mockTags.length);
    expect(result.current.data?.[0].name).toBe('Bug');
  });

  it('returns predefined and custom tags', async () => {
    const { result } = renderHook(() => useTags(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    const predefined = result.current.data?.filter((t) => t.is_predefined);
    const custom = result.current.data?.filter((t) => !t.is_predefined);

    expect(predefined?.length).toBeGreaterThan(0);
    expect(custom?.length).toBeGreaterThan(0);
  });
});

describe('useCreateTag', () => {
  it('creates tag successfully', async () => {
    const { result } = renderHook(() => useCreateTag(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({
      name: 'New Tag',
      color: '#FF5733',
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.name).toBe('New Tag');
    expect(result.current.data?.color).toBe('#FF5733');
    expect(result.current.data?.is_predefined).toBe(false);
  });

  it('creates tag with default color', async () => {
    const { result } = renderHook(() => useCreateTag(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({
      name: 'Default Color Tag',
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.color).toBe('#6B7280');
  });
});

