import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import { NotFoundPage } from './NotFoundPage';

const renderWithRouter = (component: React.ReactNode) => {
  return render(<BrowserRouter>{component}</BrowserRouter>);
};

describe('NotFoundPage', () => {
  it('renders 404 heading', () => {
    renderWithRouter(<NotFoundPage />);
    expect(screen.getByText('404')).toBeInTheDocument();
  });

  it('renders error message', () => {
    renderWithRouter(<NotFoundPage />);
    expect(screen.getByText('页面未找到')).toBeInTheDocument();
  });

  it('renders home link', () => {
    renderWithRouter(<NotFoundPage />);
    const link = screen.getByText('返回首页').closest('a');
    expect(link).toHaveAttribute('href', '/');
  });

  it('link has correct styling', () => {
    renderWithRouter(<NotFoundPage />);
    const link = screen.getByText('返回首页').closest('a');
    expect(link).toHaveClass('bg-blue-600', 'text-white');
  });
});

