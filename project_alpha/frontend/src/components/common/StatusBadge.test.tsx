import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { StatusBadge } from './StatusBadge';

describe('StatusBadge', () => {
  it('renders open status correctly', () => {
    render(<StatusBadge status="open" />);
    expect(screen.getByText('待处理')).toBeInTheDocument();
  });

  it('renders in_progress status correctly', () => {
    render(<StatusBadge status="in_progress" />);
    expect(screen.getByText('处理中')).toBeInTheDocument();
  });

  it('renders completed status correctly', () => {
    render(<StatusBadge status="completed" />);
    expect(screen.getByText('已完成')).toBeInTheDocument();
  });

  it('renders cancelled status correctly', () => {
    render(<StatusBadge status="cancelled" />);
    expect(screen.getByText('已取消')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    render(<StatusBadge status="open" className="custom-class" />);
    const badge = screen.getByText('待处理').closest('span');
    expect(badge).toHaveClass('custom-class');
  });

  it('has correct styling for open status', () => {
    render(<StatusBadge status="open" />);
    const badge = screen.getByText('待处理').closest('span');
    expect(badge).toHaveClass('bg-blue-100');
  });

  it('has correct styling for completed status', () => {
    render(<StatusBadge status="completed" />);
    const badge = screen.getByText('已完成').closest('span');
    expect(badge).toHaveClass('bg-green-100');
  });
});

