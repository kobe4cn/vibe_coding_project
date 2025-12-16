import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect } from 'vitest';
import { useTickets, useTicket, useCreateTicket } from './useTickets';
import { mockTickets } from '@/test/mocks/handlers';
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

describe('useTickets', () => {
  it('fetches tickets list successfully', async () => {
    const { result } = renderHook(() => useTickets(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.data).toHaveLength(mockTickets.length);
    expect(result.current.data?.data[0].title).toBe('Fix login bug');
  });

  it('fetches tickets with query parameters', async () => {
    const { result } = renderHook(
      () => useTickets({ status: 'open', page: 1 }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toBeDefined();
  });
});

describe('useTicket', () => {
  it('fetches single ticket successfully', async () => {
    const { result } = renderHook(() => useTicket('ticket-1'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.title).toBe('Fix login bug');
    expect(result.current.data?.status).toBe('open');
  });

  it('handles non-existent ticket', async () => {
    const { result } = renderHook(() => useTicket('non-existent'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });
});

describe('useCreateTicket', () => {
  it('creates ticket successfully', async () => {
    const { result } = renderHook(() => useCreateTicket(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({
      title: 'New Test Ticket',
      description: 'Test description',
      priority: 'high',
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.title).toBe('New Test Ticket');
    expect(result.current.data?.status).toBe('open');
  });
});

