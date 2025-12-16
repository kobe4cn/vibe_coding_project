import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect } from 'vitest';
import { useAttachments, useUploadAttachment, useDeleteAttachment } from './useAttachments';
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

describe('useAttachments', () => {
  it('fetches attachments for ticket', async () => {
    const { result } = renderHook(() => useAttachments('ticket-1'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toBeDefined();
    expect(Array.isArray(result.current.data)).toBe(true);
  });

  it('does not fetch when ticketId is empty', () => {
    const { result } = renderHook(() => useAttachments(''), {
      wrapper: createWrapper(),
    });

    expect(result.current.isFetching).toBe(false);
  });
});

describe('useUploadAttachment', () => {
  it('returns mutation function', () => {
    const { result } = renderHook(() => useUploadAttachment(), {
      wrapper: createWrapper(),
    });

    expect(result.current.mutate).toBeDefined();
    expect(typeof result.current.mutate).toBe('function');
  });
});

describe('useDeleteAttachment', () => {
  it('returns mutation function', () => {
    const { result } = renderHook(() => useDeleteAttachment(), {
      wrapper: createWrapper(),
    });

    expect(result.current.mutate).toBeDefined();
    expect(typeof result.current.mutate).toBe('function');
  });
});

