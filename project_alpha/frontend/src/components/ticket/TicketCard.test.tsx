import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import { TicketCard } from './TicketCard';
import type { TicketWithTags } from '@/types';

const mockTicket: TicketWithTags = {
  id: 'ticket-1',
  title: 'Test Ticket',
  description: 'Test description',
  priority: 'high',
  status: 'open',
  resolution: null,
  completed_at: null,
  created_at: '2024-01-15T10:00:00Z',
  updated_at: '2024-01-15T10:00:00Z',
  tags: [
    { id: 'tag-1', name: 'Bug', color: '#EF4444', icon: 'bug', is_predefined: true, created_at: '2024-01-01T00:00:00Z' },
  ],
};

const renderWithRouter = (component: React.ReactNode) => {
  return render(<BrowserRouter>{component}</BrowserRouter>);
};

describe('TicketCard', () => {
  it('renders ticket title', () => {
    renderWithRouter(<TicketCard ticket={mockTicket} />);
    expect(screen.getByText('Test Ticket')).toBeInTheDocument();
  });

  it('renders ticket description', () => {
    renderWithRouter(<TicketCard ticket={mockTicket} />);
    expect(screen.getByText('Test description')).toBeInTheDocument();
  });

  it('renders status badge', () => {
    renderWithRouter(<TicketCard ticket={mockTicket} />);
    expect(screen.getByText('待处理')).toBeInTheDocument();
  });

  it('renders priority badge', () => {
    renderWithRouter(<TicketCard ticket={mockTicket} />);
    expect(screen.getByText('高')).toBeInTheDocument();
  });

  it('renders tags', () => {
    renderWithRouter(<TicketCard ticket={mockTicket} />);
    expect(screen.getByText('Bug')).toBeInTheDocument();
  });

  it('links to ticket detail page', () => {
    renderWithRouter(<TicketCard ticket={mockTicket} />);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/tickets/ticket-1');
  });

  it('renders without description', () => {
    const ticketNoDesc = { ...mockTicket, description: null };
    renderWithRouter(<TicketCard ticket={ticketNoDesc} />);
    expect(screen.getByText('Test Ticket')).toBeInTheDocument();
  });

  it('shows +N for many tags', () => {
    const ticketManyTags = {
      ...mockTicket,
      tags: [
        { id: 'tag-1', name: 'Tag1', color: '#EF4444', icon: null, is_predefined: false, created_at: '2024-01-01T00:00:00Z' },
        { id: 'tag-2', name: 'Tag2', color: '#3B82F6', icon: null, is_predefined: false, created_at: '2024-01-01T00:00:00Z' },
        { id: 'tag-3', name: 'Tag3', color: '#10B981', icon: null, is_predefined: false, created_at: '2024-01-01T00:00:00Z' },
        { id: 'tag-4', name: 'Tag4', color: '#F59E0B', icon: null, is_predefined: false, created_at: '2024-01-01T00:00:00Z' },
      ],
    };
    renderWithRouter(<TicketCard ticket={ticketManyTags} />);
    expect(screen.getByText('+1')).toBeInTheDocument();
  });
});

