import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { StatusActions } from './StatusActions';

describe('StatusActions', () => {
  it('renders allowed transitions for open status', () => {
    const onStatusChange = vi.fn();
    render(<StatusActions currentStatus="open" onStatusChange={onStatusChange} />);
    
    expect(screen.getByText('处理中')).toBeInTheDocument();
    expect(screen.getByText('已取消')).toBeInTheDocument();
  });

  it('renders allowed transitions for in_progress status', () => {
    const onStatusChange = vi.fn();
    render(<StatusActions currentStatus="in_progress" onStatusChange={onStatusChange} />);
    
    expect(screen.getByText('待处理')).toBeInTheDocument();
    expect(screen.getByText('已完成')).toBeInTheDocument();
    expect(screen.getByText('已取消')).toBeInTheDocument();
  });

  it('renders allowed transitions for completed status', () => {
    const onStatusChange = vi.fn();
    render(<StatusActions currentStatus="completed" onStatusChange={onStatusChange} />);
    
    expect(screen.getByText('待处理')).toBeInTheDocument();
  });

  it('renders allowed transitions for cancelled status', () => {
    const onStatusChange = vi.fn();
    render(<StatusActions currentStatus="cancelled" onStatusChange={onStatusChange} />);
    
    expect(screen.getByText('待处理')).toBeInTheDocument();
  });

  it('calls onStatusChange when button clicked', () => {
    const onStatusChange = vi.fn();
    render(<StatusActions currentStatus="open" onStatusChange={onStatusChange} />);
    
    fireEvent.click(screen.getByText('处理中'));
    expect(onStatusChange).toHaveBeenCalledWith('in_progress');
  });

  it('disables buttons when loading', () => {
    const onStatusChange = vi.fn();
    render(<StatusActions currentStatus="open" onStatusChange={onStatusChange} isLoading />);
    
    const buttons = screen.getAllByRole('button');
    buttons.forEach(button => {
      expect(button).toBeDisabled();
    });
  });
});

