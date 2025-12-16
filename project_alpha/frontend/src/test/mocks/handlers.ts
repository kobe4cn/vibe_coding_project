import { http, HttpResponse } from 'msw';
import type { TicketWithTags, Tag, Attachment, PaginatedResponse } from '@/types';

// Mock data
export const mockTags: Tag[] = [
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
    icon: 'sparkles',
    is_predefined: true,
    created_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'tag-3',
    name: 'Custom',
    color: '#10B981',
    icon: null,
    is_predefined: false,
    created_at: '2024-01-02T00:00:00Z',
  },
];

export const mockTickets: TicketWithTags[] = [
  {
    id: 'ticket-1',
    title: 'Fix login bug',
    description: 'Users cannot login on mobile',
    priority: 'high',
    status: 'open',
    resolution: null,
    completed_at: null,
    created_at: '2024-01-15T10:00:00Z',
    updated_at: '2024-01-15T10:00:00Z',
    tags: [mockTags[0]],
  },
  {
    id: 'ticket-2',
    title: 'Add dark mode',
    description: 'Implement dark theme support',
    priority: 'medium',
    status: 'in_progress',
    resolution: null,
    completed_at: null,
    created_at: '2024-01-14T09:00:00Z',
    updated_at: '2024-01-15T08:00:00Z',
    tags: [mockTags[1]],
  },
  {
    id: 'ticket-3',
    title: 'Documentation update',
    description: 'Update API docs',
    priority: 'low',
    status: 'completed',
    resolution: 'Documentation updated',
    completed_at: '2024-01-13T15:00:00Z',
    created_at: '2024-01-10T08:00:00Z',
    updated_at: '2024-01-13T15:00:00Z',
    tags: [],
  },
];

export const mockAttachments: Attachment[] = [
  {
    id: 'att-1',
    ticket_id: 'ticket-1',
    filename: 'screenshot.png',
    content_type: 'image/png',
    size_bytes: 125000,
    created_at: '2024-01-15T10:30:00Z',
  },
];

// API handlers
export const handlers = [
  // Tickets
  http.get('/api/tickets', () => {
    const response: PaginatedResponse<TicketWithTags> = {
      data: mockTickets,
      total: mockTickets.length,
      page: 1,
      per_page: 20,
      total_pages: 1,
    };
    return HttpResponse.json(response);
  }),

  http.get('/api/tickets/:id', ({ params }) => {
    const ticket = mockTickets.find((t) => t.id === params.id);
    if (!ticket) {
      return new HttpResponse(
        JSON.stringify({ error: 'not_found', message: 'Ticket not found' }),
        { status: 404 }
      );
    }
    return HttpResponse.json(ticket);
  }),

  http.post('/api/tickets', async ({ request }) => {
    const body = (await request.json()) as { title: string; description?: string; priority?: string };
    const newTicket: TicketWithTags = {
      id: 'ticket-new',
      title: body.title,
      description: body.description || null,
      priority: (body.priority as any) || 'medium',
      status: 'open',
      resolution: null,
      completed_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      tags: [],
    };
    return HttpResponse.json(newTicket, { status: 201 });
  }),

  http.put('/api/tickets/:id', async ({ params, request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    const ticket = mockTickets.find((t) => t.id === params.id);
    if (!ticket) {
      return new HttpResponse(null, { status: 404 });
    }
    return HttpResponse.json({ ...ticket, ...body });
  }),

  http.delete('/api/tickets/:id', ({ params }) => {
    const exists = mockTickets.some((t) => t.id === params.id);
    if (!exists) {
      return new HttpResponse(null, { status: 404 });
    }
    return new HttpResponse(null, { status: 204 });
  }),

  http.patch('/api/tickets/:id/status', async ({ params, request }) => {
    const body = (await request.json()) as { status: string; resolution?: string };
    const ticket = mockTickets.find((t) => t.id === params.id);
    if (!ticket) {
      return new HttpResponse(null, { status: 404 });
    }
    return HttpResponse.json({
      ...ticket,
      status: body.status,
      resolution: body.resolution || ticket.resolution,
      completed_at: body.status === 'completed' ? new Date().toISOString() : null,
    });
  }),

  // Tags
  http.get('/api/tags', () => {
    return HttpResponse.json(mockTags);
  }),

  http.post('/api/tags', async ({ request }) => {
    const body = (await request.json()) as { name: string; color?: string; icon?: string };
    const newTag: Tag = {
      id: 'tag-new',
      name: body.name,
      color: body.color || '#6B7280',
      icon: body.icon || null,
      is_predefined: false,
      created_at: new Date().toISOString(),
    };
    return HttpResponse.json(newTag, { status: 201 });
  }),

  http.delete('/api/tags/:id', ({ params }) => {
    const tag = mockTags.find((t) => t.id === params.id);
    if (!tag) {
      return new HttpResponse(null, { status: 404 });
    }
    if (tag.is_predefined) {
      return new HttpResponse(
        JSON.stringify({ error: 'bad_request', message: 'Cannot delete predefined tags' }),
        { status: 400 }
      );
    }
    return new HttpResponse(null, { status: 204 });
  }),

  // Ticket-Tag associations
  http.post('/api/tickets/:id/tags', async ({ params, request }) => {
    const body = (await request.json()) as { tag_id: string };
    const ticket = mockTickets.find((t) => t.id === params.id);
    const tag = mockTags.find((t) => t.id === body.tag_id);
    if (!ticket || !tag) {
      return new HttpResponse(null, { status: 404 });
    }
    return HttpResponse.json({ ...ticket, tags: [...ticket.tags, tag] });
  }),

  http.delete('/api/tickets/:ticketId/tags/:tagId', ({ params }) => {
    const ticket = mockTickets.find((t) => t.id === params.ticketId);
    if (!ticket) {
      return new HttpResponse(null, { status: 404 });
    }
    return HttpResponse.json({
      ...ticket,
      tags: ticket.tags.filter((t) => t.id !== params.tagId),
    });
  }),

  // Attachments
  http.get('/api/tickets/:id/attachments', ({ params }) => {
    const attachments = mockAttachments.filter((a) => a.ticket_id === params.id);
    return HttpResponse.json(attachments);
  }),

  http.delete('/api/attachments/:id', ({ params }) => {
    const exists = mockAttachments.some((a) => a.id === params.id);
    if (!exists) {
      return new HttpResponse(null, { status: 404 });
    }
    return new HttpResponse(null, { status: 204 });
  }),

  // Health check
  http.get('/health', () => {
    return HttpResponse.json({ status: 'ok', version: '0.1.0' });
  }),
];

