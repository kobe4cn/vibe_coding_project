import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { AppLayout } from './AppLayout';

const renderWithRouter = (initialEntries = ['/']) => {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <AppLayout />
    </MemoryRouter>
  );
};

describe('AppLayout', () => {
  it('renders header with title', () => {
    renderWithRouter();
    expect(screen.getByText('Ticket System')).toBeInTheDocument();
  });

  it('renders navigation links', () => {
    renderWithRouter();
    expect(screen.getByText('票据')).toBeInTheDocument();
    expect(screen.getByText('标签')).toBeInTheDocument();
  });

  it('highlights active route for tickets', () => {
    renderWithRouter(['/tickets']);
    const ticketsLink = screen.getByText('票据').closest('a');
    expect(ticketsLink).toHaveClass('bg-blue-50', 'text-blue-700');
  });

  it('highlights active route for tags', () => {
    renderWithRouter(['/tags']);
    const tagsLink = screen.getByText('标签').closest('a');
    expect(tagsLink).toHaveClass('bg-blue-50', 'text-blue-700');
  });

  it('highlights active route for nested ticket routes', () => {
    renderWithRouter(['/tickets/123']);
    const ticketsLink = screen.getByText('票据').closest('a');
    expect(ticketsLink).toHaveClass('bg-blue-50', 'text-blue-700');
  });

  it('renders main content area', () => {
    renderWithRouter();
    const main = screen.getByRole('main');
    expect(main).toBeInTheDocument();
  });

  it('renders outlet for child routes', () => {
    renderWithRouter();
    const main = screen.getByRole('main');
    expect(main).toBeInTheDocument();
  });
});

