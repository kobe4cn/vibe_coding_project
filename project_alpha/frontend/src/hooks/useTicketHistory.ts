import { useQuery } from '@tanstack/react-query';
import { ticketApi } from '@/api/tickets';
import type { HistoryQuery, TicketHistoryResponse } from '@/types';

export function useTicketHistory(ticketId: string, query: HistoryQuery = {}) {
  return useQuery<TicketHistoryResponse>({
    queryKey: ['ticket-history', ticketId, query],
    queryFn: () => ticketApi.getHistory(ticketId, query),
    enabled: !!ticketId,
  });
}

