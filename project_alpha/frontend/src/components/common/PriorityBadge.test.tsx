import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { PriorityBadge } from './PriorityBadge';

describe('PriorityBadge', () => {
  it('renders low priority correctly', () => {
    render(<PriorityBadge priority="low" />);
    expect(screen.getByText('低')).toBeInTheDocument();
  });

  it('renders medium priority correctly', () => {
    render(<PriorityBadge priority="medium" />);
    expect(screen.getByText('中')).toBeInTheDocument();
  });

  it('renders high priority correctly', () => {
    render(<PriorityBadge priority="high" />);
    expect(screen.getByText('高')).toBeInTheDocument();
  });

  it('renders urgent priority correctly', () => {
    render(<PriorityBadge priority="urgent" />);
    expect(screen.getByText('紧急')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    render(<PriorityBadge priority="high" className="my-custom" />);
    const badge = screen.getByText('高');
    expect(badge).toHaveClass('my-custom');
  });

  it('has correct styling for urgent priority', () => {
    render(<PriorityBadge priority="urgent" />);
    const badge = screen.getByText('紧急');
    expect(badge).toHaveClass('bg-red-100');
  });

  it('has correct styling for low priority', () => {
    render(<PriorityBadge priority="low" />);
    const badge = screen.getByText('低');
    expect(badge).toHaveClass('bg-slate-100');
  });
});

