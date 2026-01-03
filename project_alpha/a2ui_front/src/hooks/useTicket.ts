/**
 * Ticket API Hooks using TanStack Query
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { TicketWithTags, UpdateTicketRequest, Tag } from '@/types';

const API_BASE = '/api';

async function fetchTicket(id: string): Promise<TicketWithTags> {
  const response = await fetch(`${API_BASE}/tickets/${id}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch ticket: ${response.statusText}`);
  }
  return response.json();
}

async function updateTicket(id: string, data: UpdateTicketRequest): Promise<TicketWithTags> {
  const response = await fetch(`${API_BASE}/tickets/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to update ticket');
  }
  return response.json();
}

async function updateTicketTags(id: string, tagIds: string[]): Promise<TicketWithTags> {
  const response = await fetch(`${API_BASE}/tickets/${id}/tags`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tag_ids: tagIds }),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to update tags');
  }
  return response.json();
}

async function fetchTags(): Promise<Tag[]> {
  const response = await fetch(`${API_BASE}/tags`);
  if (!response.ok) {
    throw new Error('Failed to fetch tags');
  }
  return response.json();
}

export function useTicket(id: string) {
  return useQuery({
    queryKey: ['ticket', id],
    queryFn: () => fetchTicket(id),
    enabled: !!id,
  });
}

export function useTags() {
  return useQuery({
    queryKey: ['tags'],
    queryFn: fetchTags,
  });
}

export function useUpdateTicket() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateTicketRequest }) =>
      updateTicket(id, data),
    onSuccess: (ticket) => {
      queryClient.invalidateQueries({ queryKey: ['ticket', ticket.id] });
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
    },
  });
}

export function useUpdateTicketTags() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, tagIds }: { id: string; tagIds: string[] }) =>
      updateTicketTags(id, tagIds),
    onSuccess: (ticket) => {
      queryClient.invalidateQueries({ queryKey: ['ticket', ticket.id] });
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
    },
  });
}
